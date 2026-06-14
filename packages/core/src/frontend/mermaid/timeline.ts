/**
 * @file frontend/mermaid/timeline.ts — Mermaid timeline → IRDocument parser.
 *
 * Translates Mermaid `timeline` syntax into the Timeline Grammar Domain IR
 * (IRDocument). Follows the fidelity bar established by flowchart.ts hardening.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IMPLEMENTED
 * ─────────────────────────────────────────────────────────────────────────
 *   Header
 *     timeline  (case-insensitive)
 *
 *   Metadata
 *     title X   → IRDocument.metadata.title
 *
 *   Sections
 *     section Name   → IR Section + Track
 *
 *   Period + event lines
 *     period : event : event   → period label + one/more events
 *     : event                  → continuation: extra event for current period
 *
 *   Period label → IRDate mapping
 *     "2002"         → year  IRDate "2002"
 *     "2026-06"      → month IRDate "2026-06"
 *     "2026-06-01"   → ISO   IRDate "2026-06-01"
 *     Leading 4-digit year    → extract year
 *     Otherwise               → sequential month (2024-01, 2024-02, …)
 *
 *   Events → IR milestones at the period date (one milestone per event)
 *   Period anchor milestone   → milestone labelled with the period name
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEFERRED
 * ─────────────────────────────────────────────────────────────────────────
 *   1. disableMulticolor directive → warn + skip
 *   2. accTitle / accDescr       → warn + skip
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ERROR POLICY
 * ─────────────────────────────────────────────────────────────────────────
 *   Unrecognised lines → skip with collected warning.
 *   NEVER throws on syntax errors. Always returns a valid IRDocument.
 */

import type {
  IRDocument,
  Track,
  Activity,
  Milestone,
  Section,
} from '../../types.js';
import { preprocessMermaid } from './utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TimelineParseResult {
  doc: IRDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ID sanitization
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
// Period label → IRDate
// ---------------------------------------------------------------------------

/**
 * Convert a Mermaid timeline period label to an IRDate string.
 *
 * Strategy (in priority order):
 *   1. ISO date YYYY-MM-DD → use directly
 *   2. Year-month YYYY-MM  → use directly
 *   3. 4-digit year        → use as year IRDate
 *   4. Starts with 4-digit year (e.g. "2003 — Ajax era") → extract year
 *   5. Otherwise           → sequential month based on index (2024-01, 2024-02, …)
 */
function periodToIRDate(label: string, index: number): string {
  const s = label.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) return s;

  const yearPrefix = s.match(/^(\d{4})\b/);
  if (yearPrefix) return yearPrefix[1]!;

  // Sequential fallback
  const year  = 2024 + Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse Mermaid timeline text. Returns TimelineParseResult.
 */
export function parseTimelineInternal(text: string): TimelineParseResult {
  const { body, frontmatter, directiveTheme } = preprocessMermaid(text);
  const warnings: string[] = [];
  const idMap   = new Map<string, string>();
  const usedIds = new Set<string>();

  let title               = '';
  let currentSectionLabel = 'Events';
  let currentSectionId    = sanitizeId('Events', idMap, usedIds);
  let currentPeriod       = '';
  let currentPeriodDate   = '2024-01';
  let periodIndex         = 0;

  const trackMap:   Map<string, { id: string; label: string }> = new Map();
  const sectionMap: Map<string, { id: string; label: string }> = new Map();

  const activities: Activity[] = [];
  const milestones: Milestone[] = [];

  // Register default track
  const ensureTrack = () => {
    if (!trackMap.has(currentSectionId)) {
      trackMap.set(currentSectionId, { id: currentSectionId, label: currentSectionLabel });
      sectionMap.set(currentSectionId, { id: currentSectionId, label: currentSectionLabel });
    }
  };

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^timeline\s*$/i.test(line)) continue;

    if (/^title\s+/i.test(line)) {
      title = line.replace(/^title\s+/i, '').trim();
      continue;
    }

    if (/^section\s+/i.test(line)) {
      const label = line.replace(/^section\s+/i, '').trim();
      const id    = sanitizeId(label, idMap, usedIds);
      currentSectionLabel = label;
      currentSectionId    = id;
      ensureTrack();
      continue;
    }

    // Accessibility / directive lines
    if (/^(disableMulticolor|accTitle|accDescr)\s*/i.test(line)) {
      warnings.push(`DEFERRED: directive "${line}" not supported.`);
      continue;
    }

    // Period line: "period : event : event..." OR continuation ": event"
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) {
      warnings.push(`SKIP: unrecognized timeline line: "${line}"`);
      continue;
    }

    const periodPart = line.slice(0, colonIdx).trim();
    const eventsPart = line.slice(colonIdx + 1);

    if (periodPart) {
      // New period
      currentPeriod     = periodPart;
      currentPeriodDate = periodToIRDate(periodPart, periodIndex++);
    }
    // else: continuation line (no period change)

    ensureTrack();

    // Parse events (split remainder on ':')
    const events = eventsPart.split(':').map((e) => e.trim()).filter(Boolean);
    for (const eventText of events) {
      const eid = sanitizeId(eventText, idMap, usedIds);

      // Use span for year/year-month periods, start+end for full dates
      if (/^\d{4}$/.test(currentPeriodDate) || /^\d{4}-\d{2}$/.test(currentPeriodDate)) {
        activities.push({
          id:     eid,
          label:  eventText,
          track:  currentSectionId,
          span:   currentPeriodDate,
        });
      } else {
        // Full date: 1-month span
        const endDate = addOneMonth(currentPeriodDate);
        activities.push({
          id:    eid,
          label: eventText,
          track: currentSectionId,
          start: currentPeriodDate,
          end:   endDate,
        });
      }
    }

    // Add a period anchor milestone (only on period-starting lines)
    if (periodPart && currentPeriod) {
      const pid = sanitizeId(`period-${currentPeriod}`, idMap, usedIds);
      milestones.push({
        id:    pid,
        label: currentPeriod,
        date:  currentPeriodDate,
        track: currentSectionId,
      });
    }
  }

  // Title fallback
  if (!title) {
    title = (typeof frontmatter['title'] === 'string' ? frontmatter['title'] : '') || 'Timeline';
  }

  // Ensure at least one track
  ensureTrack();

  // Compute time range from milestone dates and activity spans
  const allDates: string[] = [
    ...milestones.map((m) => m.date),
    ...activities.flatMap((a) => [a.start, a.end, a.span].filter((d): d is string => !!d)),
  ];
  const sorted   = [...new Set(allDates)].filter(Boolean).sort();
  const timeStart = expandToISO(sorted[0] ?? '2024');
  const timeEnd   = expandToISO(sorted[sorted.length - 1] ?? '2030', true);

  // Auto-select axis unit
  const irTracks: Track[] = Array.from(trackMap.values()).map((t, i) => ({
    id:    t.id,
    label: t.label,
    index: i,
  }));

  const irSections: Section[] = Array.from(sectionMap.values()).map((s) => ({
    id:    s.id,
    label: s.label,
  }));

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const theme   = fmTheme ?? directiveTheme ?? 'consulting';

  const doc: IRDocument = {
    version: '1.0',
    metadata: {
      title,
      time_range: { start: timeStart, end: timeEnd },
      layout:     'horizontal',
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
 * Simple wrapper — parse Mermaid timeline text and return the IRDocument.
 */
export function parseTimeline(text: string): IRDocument {
  return parseTimelineInternal(text).doc;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Add one month to an ISO date string. */
function addOneMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Expand a short IRDate ("2002", "2002-06") to a full ISO date for time_range.
 * When `isEnd` is true, returns end of the period rather than the start.
 */
function expandToISO(irDate: string, isEnd = false): string {
  if (/^\d{4}$/.test(irDate)) {
    return isEnd ? `${irDate}-12-31` : `${irDate}-01-01`;
  }
  if (/^\d{4}-\d{2}$/.test(irDate)) {
    if (isEnd) {
      const d = new Date(`${irDate}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    return `${irDate}-01`;
  }
  return irDate;
}
