/**
 * @file diagrams/timeline/shared.ts — Helpers shared across timeline layouts.
 *
 * These are specific to the timeline diagram family (vertical-spine, serpentine,
 * roadmap, columns, horizontal) but common to all of them — so they live here
 * rather than being copy-pasted per layout. Cross-diagram utilities (rounding,
 * dates, text metrics) live in the top-level general modules instead.
 */

import type { ResolvedTheme } from '../../contracts/index.js';
import type { TimelineDocument } from './ir.js';
import { startOrdinal } from '../../time/dates.js';

/**
 * Map a timeline activity status to the theme's semantic palette.
 *   done → success, active → primary, blocked → error, else → secondary.
 * Reads only shared palette tokens so every theme restyles consistently.
 */
export function statusColor(palette: ResolvedTheme['palette'], status?: string): string {
  switch (status) {
    case 'done':    return palette.success;
    case 'active':  return palette.primary;
    case 'blocked': return palette.error;
    default:        return palette.secondary;
  }
}

/** A milestone or activity, normalized for layouts that treat both uniformly. */
export interface TimelineEntry {
  readonly id: string;
  readonly label: string;
  readonly kind: 'milestone' | 'activity';
  /** Period-start date string (milestone.date or activity.start). */
  readonly date: string;
  /** Activity end date, when present. */
  readonly end?: string;
  /** Day-ordinal of the start date, for ordering. */
  readonly ord: number;
  readonly status?: string;
  readonly description?: string;
}

/**
 * Merge milestones + activities into one list keyed by start date, sorted by
 * (ordinal, id) for stable, deterministic placement. Used by the layouts that
 * lay both kinds along a single track (spine, serpentine).
 */
export function collectEntries(ir: TimelineDocument): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const m of ir.milestones) {
    entries.push({
      id: m.id, label: m.label, kind: 'milestone', date: m.date, ord: startOrdinal(m.date),
      ...(m.description ? { description: m.description } : {}),
    });
  }
  for (const a of ir.activities) {
    entries.push({
      id: a.id, label: a.label, kind: 'activity', date: a.start, ord: startOrdinal(a.start),
      ...(a.end ? { end: a.end } : {}),
      ...(a.status ? { status: a.status } : {}),
      ...(a.description ? { description: a.description } : {}),
    });
  }
  entries.sort((p, q) => (p.ord - q.ord) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  return entries;
}
