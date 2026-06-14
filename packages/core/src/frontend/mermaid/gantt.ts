/**
 * @file frontend/mermaid/gantt.ts — Mermaid gantt → IRDocument parser.
 *
 * Translates Mermaid `gantt` syntax into the Timeline Grammar Domain IR
 * (IRDocument). Follows the tokenizer fidelity bar established by flowchart.ts:
 * whitespace-independent, graceful degradation, public warnings.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IMPLEMENTED
 * ─────────────────────────────────────────────────────────────────────────
 *   Header
 *     gantt  (case-insensitive)
 *
 *   Metadata directives
 *     title X          → IRDocument.metadata.title
 *     dateFormat FMT   → used to parse task dates (YYYY-MM-DD, DD/MM/YYYY, etc.)
 *
 *   Sections
 *     section Name     → IR Track + IR Section; tasks within go to that track
 *
 *   Task lines:  Name :flags, id, start, duration/end
 *     Status flags: done, active → IR status; crit → category:'critical'
 *     Milestone flag: milestone → IR Milestone (not Activity)
 *     ID token: first non-flag, non-date, non-duration token
 *     Start: ISO date in dateFormat, or 'after <id>'
 *     End:   ISO date in dateFormat, or duration Nd/Nw/Nm/Ny/Nh
 *
 *   Dependencies
 *     'after id' → start at predecessor's computed end date
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEFERRED
 * ─────────────────────────────────────────────────────────────────────────
 *   1. axisFormat          → display hint; warn + skip
 *   2. excludes            → no IR equivalent; warn + skip
 *   3. todayMarker         → warn + skip
 *   4. click / href        → warn + skip
 *   5. until <id>          → milestone dependency; default 30d + warn
 *   6. Vertical layout     → gantt uses horizontal; note in output
 *   7. Exotic dateFormats  → fallback to YYYY-MM-DD + warn
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ERROR POLICY
 * ─────────────────────────────────────────────────────────────────────────
 *   Unrecognised lines → skip with collected warning. NEVER throws on syntax
 *   errors. Always returns a valid (possibly partial) IRDocument.
 */

import type {
  IRDocument,
  Track,
  Activity,
  Milestone,
  Section,
  Status,
} from '../../types.js';
import { preprocessMermaid } from './utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GanttParseResult {
  doc: IRDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ID sanitization (shared algorithm with flowchart/sequence)
// ---------------------------------------------------------------------------

function sanitizeId(raw: string, idMap: Map<string, string>, usedIds: Set<string>): string {
  if (idMap.has(raw)) return idMap.get(raw)!;

  let s = raw;
  s = s.replace(/([a-z])([A-Z])/g, '$1-$2');
  s = s.toLowerCase();
  s = s.replace(/[_\s]+/g, '-');
  s = s.replace(/[^a-z0-9-]/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  if (/^\d/.test(s)) s = 'n' + s;
  if (!s) s = 'node';

  const base = s;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    idMap.set(raw, base);
    return base;
  }
  let i = 2;
  while (usedIds.has(`${base}-${i}`)) i++;
  const final = `${base}-${i}`;
  usedIds.add(final);
  idMap.set(raw, final);
  return final;
}

// ---------------------------------------------------------------------------
// Date parsing / arithmetic
// ---------------------------------------------------------------------------

/**
 * Determine if a token looks like a date in the given dateFormat.
 */
function isDateToken(tok: string, fmt: string): boolean {
  switch (fmt) {
    case 'YYYY-MM-DD': return /^\d{4}-\d{2}-\d{2}$/.test(tok);
    case 'YYYY/MM/DD': return /^\d{4}\/\d{2}\/\d{2}$/.test(tok);
    case 'DD/MM/YYYY': return /^\d{2}\/\d{2}\/\d{4}$/.test(tok);
    case 'MM/DD/YYYY': return /^\d{2}\/\d{2}\/\d{4}$/.test(tok);
    case 'YYYY-MM':    return /^\d{4}-\d{2}$/.test(tok);
    default:           return /^\d{4}-\d{2}-\d{2}$/.test(tok);
  }
}

/**
 * Parse a date token (in the given dateFormat) to ISO YYYY-MM-DD.
 */
function parseDateToken(tok: string, fmt: string): string {
  switch (fmt) {
    case 'YYYY/MM/DD': {
      const p = tok.split('/');
      return `${p[0]}-${p[1]}-${p[2]}`;
    }
    case 'DD/MM/YYYY': {
      const p = tok.split('/');
      return `${p[2]}-${p[1]}-${p[0]}`;
    }
    case 'MM/DD/YYYY': {
      const p = tok.split('/');
      return `${p[2]}-${p[0]}-${p[1]}`;
    }
    default: return tok; // YYYY-MM-DD passes through
  }
}

const DURATION_RE = /^(\d+)([dwmyh])$/i;
const AFTER_RE    = /^after\s+(\S+)$/i;
const UNTIL_RE    = /^until\s+\S+$/i;
const STATUS_KEYS = new Set(['done', 'active', 'crit', 'milestone']);

/**
 * Add a Mermaid duration string (Nd / Nw / Nm / Ny / Nh) to an ISO date.
 * Returns the new ISO date string.
 */
export function addDurationToDate(isoDate: string, dur: string): string {
  const m = DURATION_RE.exec(dur);
  if (!m) return isoDate;
  const n = parseInt(m[1]!, 10);
  const unit = m[2]!.toLowerCase();

  const d = new Date(`${isoDate}T00:00:00Z`);
  switch (unit) {
    case 'h': d.setUTCHours(d.getUTCHours() + n); break;
    case 'd': d.setUTCDate(d.getUTCDate() + n); break;
    case 'w': d.setUTCDate(d.getUTCDate() + n * 7); break;
    case 'm': d.setUTCMonth(d.getUTCMonth() + n); break;
    case 'y': d.setUTCFullYear(d.getUTCFullYear() + n); break;
  }
  return d.toISOString().slice(0, 10);
}

function dateDiffDays(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round(Math.abs(db - da) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Task args parser
// ---------------------------------------------------------------------------

interface TaskArgs {
  flags: Set<string>;
  rawMermaidId?: string;
  startIso?: string;
  afterRawId?: string;
  endIso?: string;
  duration?: string;
}

function parseTaskArgs(argsStr: string, dateFormat: string, warnings: string[]): TaskArgs {
  const tokens = argsStr.split(',').map((t) => t.trim()).filter(Boolean);
  const result: TaskArgs = { flags: new Set<string>() };
  let dateCount = 0;

  for (const tok of tokens) {
    const lower = tok.toLowerCase();

    if (STATUS_KEYS.has(lower)) {
      result.flags.add(lower);
      continue;
    }

    const afterM = AFTER_RE.exec(tok);
    if (afterM) {
      result.afterRawId = afterM[1]!.trim();
      continue;
    }

    if (UNTIL_RE.test(tok)) {
      warnings.push(`DEFERRED: "until" dependency not supported; defaulting to 30d.`);
      result.duration = '30d';
      continue;
    }

    if (DURATION_RE.test(tok)) {
      result.duration = tok;
      continue;
    }

    if (isDateToken(tok, dateFormat)) {
      if (dateCount === 0) {
        result.startIso = parseDateToken(tok, dateFormat);
      } else {
        result.endIso = parseDateToken(tok, dateFormat);
      }
      dateCount++;
      continue;
    }

    // First unrecognised token = task ID
    if (!result.rawMermaidId) {
      result.rawMermaidId = tok;
      continue;
    }

    warnings.push(`SKIP: unrecognized task argument token "${tok}".`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse Mermaid gantt text. Returns GanttParseResult (IRDocument + warnings + frontmatter).
 *
 * EXPORT: this function is the internal entry point; `parseGantt` is the simple wrapper.
 */
export function parseGanttInternal(text: string): GanttParseResult {
  const { body, frontmatter, directiveTheme } = preprocessMermaid(text);
  const warnings: string[] = [];
  const idMap   = new Map<string, string>();
  const usedIds = new Set<string>();

  let title       = '';
  let dateFormat  = 'YYYY-MM-DD';
  let currentSectionLabel = 'Tasks';
  let currentSectionId    = sanitizeId('Tasks', idMap, usedIds);

  // Preserve insertion order for tracks / sections
  const trackMap:   Map<string, { id: string; label: string }> = new Map();
  const sectionMap: Map<string, { id: string; label: string }> = new Map();

  interface RawTask {
    name: string;
    rawMermaidId?: string;
    flags: Set<string>;
    startIso?: string;
    afterRawId?: string;
    endIso?: string;
    duration?: string;
    sectionId: string;
  }

  const rawTasks: RawTask[] = [];

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^gantt\s*$/i.test(line)) continue;

    if (/^title\s+/i.test(line)) {
      title = line.replace(/^title\s+/i, '').trim();
      continue;
    }
    if (/^dateFormat\s+/i.test(line)) {
      const fmt = line.replace(/^dateFormat\s+/i, '').trim();
      if (!['YYYY-MM-DD','YYYY/MM/DD','DD/MM/YYYY','MM/DD/YYYY','YYYY-MM'].includes(fmt)) {
        warnings.push(`WARN: dateFormat "${fmt}" not natively supported; falling back to YYYY-MM-DD.`);
      } else {
        dateFormat = fmt;
      }
      continue;
    }
    if (/^axisFormat\s+/i.test(line)) {
      warnings.push(`DEFERRED: axisFormat "${line}" is display-only; deferred to Inc 2.`);
      continue;
    }
    if (/^excludes\s+/i.test(line)) {
      warnings.push(`DEFERRED: excludes "${line}" not supported yet.`);
      continue;
    }
    if (/^todayMarker\s+/i.test(line)) {
      warnings.push(`DEFERRED: todayMarker "${line}" not supported yet.`);
      continue;
    }
    if (/^click\s+/i.test(line)) {
      warnings.push(`DEFERRED: click directive "${line}" not supported.`);
      continue;
    }

    if (/^section\s+/i.test(line)) {
      const label = line.replace(/^section\s+/i, '').trim();
      const id    = sanitizeId(label, idMap, usedIds);
      currentSectionLabel = label;
      currentSectionId    = id;
      if (!trackMap.has(id)) {
        trackMap.set(id, { id, label });
        sectionMap.set(id, { id, label });
      }
      continue;
    }

    // Task line: "Name :..."
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) {
      warnings.push(`SKIP: unrecognized gantt line: "${line}"`);
      continue;
    }

    const taskName = line.slice(0, colonIdx).trim();
    const argsStr  = line.slice(colonIdx + 1).trim();
    if (!taskName) {
      warnings.push(`SKIP: task line with empty name: "${line}"`);
      continue;
    }

    // Ensure default section/track is registered
    if (!trackMap.has(currentSectionId)) {
      trackMap.set(currentSectionId, { id: currentSectionId, label: currentSectionLabel });
      sectionMap.set(currentSectionId, { id: currentSectionId, label: currentSectionLabel });
    }

    const args = parseTaskArgs(argsStr, dateFormat, warnings);
    rawTasks.push({
      name:          taskName,
      rawMermaidId:  args.rawMermaidId,
      flags:         args.flags,
      startIso:      args.startIso,
      afterRawId:    args.afterRawId,
      endIso:        args.endIso,
      duration:      args.duration,
      sectionId:     currentSectionId,
    });
  }

  // Resolve title from frontmatter if not found in body
  if (!title) {
    title = (typeof frontmatter['title'] === 'string' ? frontmatter['title'] : '') || 'Gantt Diagram';
  }

  // If no tracks parsed yet, create default
  if (trackMap.size === 0) {
    trackMap.set(currentSectionId, { id: currentSectionId, label: currentSectionLabel });
    sectionMap.set(currentSectionId, { id: currentSectionId, label: currentSectionLabel });
  }

  // Two-pass resolution: process in document order; resolve 'after' from already-seen tasks
  const taskEndByRawMermaidId = new Map<string, string>(); // raw Mermaid id → ISO end
  const sectionCursor         = new Map<string, string>(); // sectionId → ISO end of last task
  // Initialise cursors from first available trackId
  for (const [id] of trackMap) sectionCursor.set(id, '2024-01-01');

  const activities: Activity[] = [];
  const milestones: Milestone[] = [];
  const allDates: string[] = [];

  for (const raw of rawTasks) {
    const cursor = sectionCursor.get(raw.sectionId) ?? '2024-01-01';

    let start: string;
    if (raw.afterRawId) {
      const predEnd = taskEndByRawMermaidId.get(raw.afterRawId);
      if (predEnd) {
        start = predEnd;
      } else {
        warnings.push(`WARN: "after ${raw.afterRawId}" predecessor not yet seen; using section cursor.`);
        start = cursor;
      }
    } else if (raw.startIso) {
      start = raw.startIso;
    } else {
      start = cursor;
    }

    let end: string;
    if (raw.endIso) {
      end = raw.endIso;
    } else if (raw.duration) {
      end = addDurationToDate(start, raw.duration);
    } else {
      warnings.push(`WARN: task "${raw.name}" has no end/duration; defaulting to 7d.`);
      end = addDurationToDate(start, '7d');
    }

    // Update tracking maps
    sectionCursor.set(raw.sectionId, end);
    if (raw.rawMermaidId) taskEndByRawMermaidId.set(raw.rawMermaidId, end);

    allDates.push(start, end);
    const irId  = sanitizeId(raw.rawMermaidId ?? raw.name, idMap, usedIds);
    const track = raw.sectionId;

    if (raw.flags.has('milestone')) {
      const status: Status = raw.flags.has('done') ? 'done' : raw.flags.has('active') ? 'in-progress' : 'planned';
      milestones.push({
        id:     irId,
        label:  raw.name,
        date:   start,
        track,
        status,
        ...(raw.flags.has('crit') ? { category: 'critical' } : {}),
      });
    } else {
      const status: Status = raw.flags.has('done') ? 'done' : raw.flags.has('active') ? 'in-progress' : 'planned';
      activities.push({
        id: irId,
        label: raw.name,
        track,
        start,
        end,
        status,
        ...(raw.flags.has('crit') ? { category: 'critical' } : {}),
      });
    }
  }

  // Compute time_range
  const sorted = allDates.filter(Boolean).sort();
  const timeStart = sorted[0]          ?? '2024-01-01';
  const timeEnd   = sorted[sorted.length - 1] ?? '2024-12-31';

  // Auto-select axis unit
  const rangeDays = dateDiffDays(timeStart, timeEnd);
  const axis_unit =
    rangeDays < 60   ? 'day'     :
    rangeDays < 365  ? 'month'   :
    rangeDays < 1095 ? 'quarter' : 'year';

  const irTracks: Track[] = Array.from(trackMap.values()).map((t, i) => ({
    id:    t.id,
    label: t.label,
    index: i,
  }));

  const irSections: Section[] = Array.from(sectionMap.values()).map((s) => ({
    id:    s.id,
    label: s.label,
  }));

  const fmTheme  = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const theme    = fmTheme ?? directiveTheme ?? 'roadmap';

  const doc: IRDocument = {
    version: '1.0',
    metadata: {
      title,
      time_range:  { start: timeStart, end: timeEnd },
      axis_unit,
      layout:      'gantt',
      theme,
      ...(typeof frontmatter['subtitle'] === 'string' ? { subtitle: frontmatter['subtitle'] } : {}),
    },
    tracks:     irTracks,
    sections:   irSections.length > 0 ? irSections : undefined,
    activities,
    milestones: milestones.length > 0 ? milestones : undefined,
  };

  return { doc, warnings, frontmatter };
}

/**
 * Simple wrapper — parse Mermaid gantt text and return the IRDocument.
 * For full parse result (warnings + frontmatter) use parseGanttInternal.
 */
export function parseGantt(text: string): IRDocument {
  return parseGanttInternal(text).doc;
}
