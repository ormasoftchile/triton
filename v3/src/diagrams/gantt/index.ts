import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { GanttDocument, GanttSection, GanttTask, GanttStatus } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutGantt } from './layout.js';
import { parseIRDate, coerceLeft, dateToOrdinal, ordinalToDate } from '../../time/dates.js';
import * as parser from './parser.js';

export type { GanttDocument, GanttSection, GanttTask, GanttStatus } from './ir.js';

interface RawTask { name: string; meta: string }
interface RawSection { label: string; tasks: RawTask[] }
interface RawDoc { version: string; metadata: GanttDocument['metadata']; dateFormat: string; sections: RawSection[] }

const STATUS_FLAGS = new Set(['done', 'active', 'crit', 'milestone']);

function isoFromOrdinal(ord: number): string {
  const [y, m, d] = ordinalToDate(ord);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function durationDays(token: string): number {
  const m = token.match(/^(\d+(?:\.\d+)?)\s*([dwhm]?)/i);
  if (!m) return 1;
  const n = parseFloat(m[1]!);
  switch ((m[2] || 'd').toLowerCase()) {
    case 'w': return n * 7;
    case 'h': return Math.max(1, Math.round(n / 24));
    default:  return n;            // days
  }
}

function dateOrdinal(date: string): number {
  try { const [y, m, d] = coerceLeft(parseIRDate(date)); return dateToOrdinal(y, m, d); }
  catch { return 0; }
}

/** Resolve one raw task's metadata into a concrete GanttTask. */
function resolveTask(raw: RawTask, endById: Map<string, number>): GanttTask {
  const tokens = raw.meta.split(',').map(t => t.trim()).filter(Boolean);
  const flags: string[] = [];
  const rest: string[] = [];
  for (const tok of tokens) {
    if (STATUS_FLAGS.has(tok.toLowerCase())) flags.push(tok.toLowerCase());
    else rest.push(tok);
  }

  // rest is [id?, start, duration]; id present when 3+ tokens remain.
  let id: string | undefined;
  let startTok: string;
  let durTok: string;
  if (rest.length >= 3) { id = rest[0]; startTok = rest[1]!; durTok = rest[2]!; }
  else                  { startTok = rest[0] ?? ''; durTok = rest[1] ?? '0d'; }

  const startOrd = /^after\s+/i.test(startTok)
    ? (endById.get(startTok.replace(/^after\s+/i, '').trim()) ?? 0)
    : dateOrdinal(startTok);

  const isMilestone = flags.includes('milestone') || durationDays(durTok) === 0;
  const endOrd = isMilestone ? startOrd : startOrd + durationDays(durTok);
  if (id) endById.set(id, endOrd);

  const status: GanttStatus =
    flags.includes('done')   ? 'done' :
    flags.includes('active') ? 'active' :
    flags.includes('crit')   ? 'crit' : 'default';

  return {
    ...(id ? { id } : {}),
    label: raw.name,
    status,
    start: isoFromOrdinal(startOrd),
    end: isoFromOrdinal(endOrd),
    isMilestone,
  };
}

export const gantt: DiagramModule<GanttDocument> = {
  parseMermaid(input: string): GanttDocument {
    const raw = parser.parse(input) as RawDoc;
    const endById = new Map<string, number>();
    const sections: GanttSection[] = raw.sections.map(sec => ({
      label: sec.label,
      tasks: sec.tasks.map(t => resolveTask(t, endById)),
    }));
    return { version: raw.version, metadata: raw.metadata, sections };
  },

  parseYaml(input: string): GanttDocument {
    return JSON.parse(input) as GanttDocument;
  },

  async layout(ir: GanttDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutGantt(ir, theme);
  },
};
