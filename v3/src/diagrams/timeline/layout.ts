import type { TimelineDocument, Activity, Milestone, Section, Track } from './ir.js';
import type { Scene, SceneElement, Rect, Point, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { applyOverlays } from '../../overlay/apply.js';
import { pen } from '../../scene/build.js';
import { parseIRDate, coerceLeft, dateToOrdinal } from '../../time/dates.js';
import { layoutVerticalSpine } from './vertical-spine.js';
import { layoutSerpentine } from './serpentine.js';
import { layoutRoadmap } from './roadmap.js';
import { layoutTimelineColumns } from './timeline-columns.js';
import { layoutNumbered } from './numbered.js';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export function layoutTimeline(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  switch (ir.layout) {
    case 'vertical-spine':
      return layoutVerticalSpine(ir, theme);
    case 'serpentine':
      return layoutSerpentine(ir, theme);
    case 'roadmap':
      return layoutRoadmap(ir, theme);
    case 'timeline-columns':
      return layoutTimelineColumns(ir, theme);
    case 'numbered':
      return layoutNumbered(ir, theme);
    case 'horizontal':
    default:
      return layoutHorizontal(ir, theme);
  }
}

// ─── Horizontal Layout ────────────────────────────────────────────────────────

function layoutHorizontal(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const elements: SceneElement[] = [];

  const charWidth    = typography.smallFontSize * 0.6;
  const minBarW      = 60;
  const barPadding   = 16;
  const slotGap      = 24;   // minimum gap between date slots
  const staggerGap   = 8;    // gap between staggered bars at same date
  const trackHeight  = 36;
  const trackPad     = 8;
  const milestoneR   = 8;

  const trackOrder   = ir.tracks.map(t => t.id);
  const trackIndex   = new Map(trackOrder.map((id, i) => [id, i]));

  // ── Pass 1: Measure — how much width does each date slot need? ────────────

  // Collect all unique dates sorted by numeric value
  const dateMap = buildDateMap([
    ...ir.milestones.map(m => m.date),
    ...ir.activities.flatMap(a => [a.start, ...(a.end ? [a.end] : [])]),
    ...(ir.sections?.flatMap(s => [s.start, s.end]) ?? []),
  ]);

  const sortedDates = [...new Set([
    ...ir.milestones.map(m => m.date),
    ...ir.activities.map(a => a.start),
    ...(ir.activities.filter(a => a.end).map(a => a.end!)),
    ...(ir.sections?.flatMap(s => [s.start, s.end]) ?? []),
  ])].sort((a, b) => dateMap.toNum(a) - dateMap.toNum(b));

  // Compute bar width for a single activity
  function actBarWidth(act: Activity): number {
    const textW = act.label.length * charWidth + barPadding;
    return Math.max(textW, minBarW);
  }

  // Group activities by start date (across all tracks at each date)
  const activitiesAtDate = new Map<string, Activity[]>();
  for (const act of ir.activities) {
    if (!activitiesAtDate.has(act.start)) activitiesAtDate.set(act.start, []);
    activitiesAtDate.get(act.start)!.push(act);
  }

  // For each date, compute total width needed (widest track group)
  const slotWidth = new Map<string, number>();
  for (const date of sortedDates) {
    const acts = activitiesAtDate.get(date);
    if (!acts || acts.length === 0) {
      slotWidth.set(date, 0);
      continue;
    }

    // Group by track within this date — bars on different tracks don't compete horizontally
    const byTrack = new Map<string, Activity[]>();
    for (const a of acts) {
      if (!byTrack.has(a.track)) byTrack.set(a.track, []);
      byTrack.get(a.track)!.push(a);
    }

    // The widest track group determines the slot width
    let widest = 0;
    for (const [, trackActs] of byTrack) {
      let w = 0;
      for (let i = 0; i < trackActs.length; i++) {
        if (i > 0) w += staggerGap;
        w += actBarWidth(trackActs[i]!);
      }
      widest = Math.max(widest, w);
    }
    slotWidth.set(date, widest);
  }

  // ── Pass 2: Position — assign x coordinates respecting content widths ─────

  const axisLeft  = margin + 20;
  const dateX     = new Map<string, number>();

  // Walk left to right: each date gets x = max(proportional, previous + previous_width + gap)
  // range is in day-ordinals; ~80px per year keeps the prior visual density.
  const totalProportionalW = Math.max(400, (dateMap.range / 365) * 80);
  let cursor = axisLeft;

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i]!;
    const proportionalX = axisLeft + ((dateMap.toNum(date) - dateMap.min) / (dateMap.range || 1)) * totalProportionalW;
    const x = Math.max(proportionalX, cursor);
    dateX.set(date, x);
    cursor = x + (slotWidth.get(date) ?? 0) + slotGap;
  }

  const axisRight = cursor - slotGap + margin;
  const axisY     = margin + (ir.metadata.title ? typography.titleFontSize + 16 : 0) + 60;

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push(p.text(ir.metadata.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // ── Section backgrounds (positioned from child date extents) ──────────────
  if (ir.sections) {
    const bgHeight = 50 + trackOrder.length * (trackHeight + trackPad) + 40;
    for (const sec of ir.sections) {
      const sx = dateX.get(sec.start) ?? axisLeft;
      const endDateX = dateX.get(sec.end) ?? sx;
      const endSlotW = slotWidth.get(sec.end) ?? 0;
      const ex = endDateX + Math.max(endSlotW, 20);
      elements.push(p.rect({ x: sx - 8, y: axisY - 50, width: ex - sx + 16, height: bgHeight }, palette.primary + '0A', palette.primary + '33', 1, { rx: 4 }));
      elements.push(p.text(sec.label, sx - 2, axisY - 36, typography.smallFontSize, palette.primary, { weight: 'bold' }));
    }
  }

  // ── Axis line ─────────────────────────────────────────────────────────────
  elements.push(p.path(`M ${axisLeft} ${axisY} L ${axisRight} ${axisY}`, palette.border, 2));

  // ── Track labels ──────────────────────────────────────────────────────────
  // Suppress the label for an implicit single "default" track — it's noise, not
  // an authored lane name.
  const showTrackLabels = !(trackOrder.length === 1 && trackOrder[0] === 'default');
  if (showTrackLabels) {
    for (let i = 0; i < trackOrder.length; i++) {
      const track = ir.tracks.find(t => t.id === trackOrder[i]);
      if (!track) continue;
      const laneY = axisY + milestoneR + trackPad + i * (trackHeight + trackPad);
      elements.push(p.text(track.label, margin, laneY + trackHeight / 2 + typography.smallFontSize * 0.4, typography.smallFontSize, palette.textMuted));
    }
  }

  // ── Activities ────────────────────────────────────────────────────────────
  // Track the running offset within each (track, date) group
  const slotCursor = new Map<string, number>();

  for (const act of ir.activities) {
    const tIdx  = trackIndex.get(act.track) ?? 0;
    const laneY = axisY + milestoneR + trackPad + tIdx * (trackHeight + trackPad);
    const sx    = dateX.get(act.start) ?? axisLeft;

    const barW  = act.end
      ? Math.max((dateX.get(act.end) ?? sx) - sx, actBarWidth(act))
      : actBarWidth(act);

    // Stagger: accumulate previous bars' widths within this (track, date)
    const groupKey = `${act.track}:${act.start}`;
    const offset = slotCursor.get(groupKey) ?? 0;
    slotCursor.set(groupKey, offset + barW + staggerGap);

    const barX  = sx + offset;
    const barH  = trackHeight - 4;
    const barY  = laneY + 2;

    const fill = activityFill(act, palette);
    elements.push(p.rect({ x: barX, y: barY, width: barW, height: barH }, fill, palette.border, 1, { rx: 4 }));
    elements.push(p.text(act.label, barX + barW / 2, barY + barH / 2 + typography.smallFontSize * 0.4, typography.smallFontSize, palette.text, { anchor: 'middle' }));
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  for (const ms of ir.milestones) {
    const mx = dateX.get(ms.date) ?? axisLeft;
    const my = axisY;
    const r  = milestoneR;

    elements.push(p.path(`M ${mx} ${my - r} L ${mx + r} ${my} L ${mx} ${my + r} L ${mx - r} ${my} Z`, palette.background, 1, { fill: palette.primary }));
    elements.push(p.text(ms.date, mx, my - r - 6, typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
    elements.push(p.text(ms.label, mx, my + r + typography.baseFontSize + 2, typography.baseFontSize, palette.text, { anchor: 'middle' }));
  }

  // ── ViewBox ───────────────────────────────────────────────────────────────
  const numTracks = Math.max(trackOrder.length, 1);
  const totalH = axisY + milestoneR + trackPad + numTracks * (trackHeight + trackPad) + typography.baseFontSize + 20 + margin;

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: axisRight + margin, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}

// ─── Date Mapping ─────────────────────────────────────────────────────────────

interface DateMapping {
  toNum: (date: string) => number;
  min: number;
  max: number;
  range: number;
}

/** Day-ordinal of a date's period start, or NaN when it isn't a real date. */
function tryOrdinal(date: string): number {
  try { const [y, m, d] = coerceLeft(parseIRDate(date)); return dateToOrdinal(y, m, d); }
  catch { return NaN; }
}

/**
 * Map IR dates to the shared day-ordinal axis (days since 2000-01-01). When no
 * value parses as a date, fall back to a sequential index so plain-label
 * timelines still lay out left→right.
 */
function buildDateMap(dates: string[]): DateMapping {
  const unique = [...new Set(dates)];
  const ords   = unique.map(tryOrdinal);
  const valid  = ords.filter(n => !isNaN(n));

  if (valid.length > 0) {
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    return {
      toNum: (d) => { const n = tryOrdinal(d); return isNaN(n) ? min : n; },
      min, max, range,
    };
  }

  // Sequential fallback: map to index
  const order = new Map(unique.map((d, i) => [d, i]));
  return {
    toNum: (d) => order.get(d) ?? 0,
    min: 0,
    max: unique.length - 1,
    range: unique.length,
  };
}

function activityFill(act: Activity, palette: ResolvedTheme['palette']): string {
  switch (act.status) {
    case 'active':  return palette.primary  + '33';
    case 'done':    return palette.success  + '33';
    case 'blocked': return palette.error    + '33';
    default:        return palette.surface;
  }
}
