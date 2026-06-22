import type { TimelineDocument, Activity, Milestone, Section, Track } from './ir.js';
import type { Scene, SceneElement, Rect, Point, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { compileOverlays } from '../../overlay/compiler.js';
import { layoutOverlays } from '../../overlay/layout.js';
import { layoutVerticalSpine } from './vertical-spine.js';
import { layoutSerpentine } from './serpentine.js';
import { layoutRoadmap } from './roadmap.js';
import { layoutTimelineColumns } from './timeline-columns.js';

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
    case 'horizontal':
    default:
      return layoutHorizontal(ir, theme);
  }
}

// ─── Horizontal Layout ────────────────────────────────────────────────────────

function layoutHorizontal(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
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
  const totalProportionalW = Math.max(400, dateMap.range * 80);
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
    elements.push({ type: 'text', content: ir.metadata.title, position: { x: margin, y: margin + typography.titleFontSize }, fontSize: typography.titleFontSize, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
  }

  // ── Section backgrounds (positioned from child date extents) ──────────────
  if (ir.sections) {
    const bgHeight = 50 + trackOrder.length * (trackHeight + trackPad) + 40;
    for (const sec of ir.sections) {
      const sx = dateX.get(sec.start) ?? axisLeft;
      const endDateX = dateX.get(sec.end) ?? sx;
      const endSlotW = slotWidth.get(sec.end) ?? 0;
      const ex = endDateX + Math.max(endSlotW, 20);
      elements.push({ type: 'rect', bounds: { x: sx - 8, y: axisY - 50, width: ex - sx + 16, height: bgHeight }, fill: palette.primary + '0A', stroke: palette.primary + '33', strokeWidth: 1, rx: 4 });
      elements.push({ type: 'text', content: sec.label, position: { x: sx - 2, y: axisY - 36 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.primary, fontWeight: 'bold' });
    }
  }

  // ── Axis line ─────────────────────────────────────────────────────────────
  elements.push({ type: 'path', d: `M ${axisLeft} ${axisY} L ${axisRight} ${axisY}`, stroke: palette.border, strokeWidth: 2 });

  // ── Track labels ──────────────────────────────────────────────────────────
  // Suppress the label for an implicit single "default" track — it's noise, not
  // an authored lane name.
  const showTrackLabels = !(trackOrder.length === 1 && trackOrder[0] === 'default');
  if (showTrackLabels) {
    for (let i = 0; i < trackOrder.length; i++) {
      const track = ir.tracks.find(t => t.id === trackOrder[i]);
      if (!track) continue;
      const laneY = axisY + milestoneR + trackPad + i * (trackHeight + trackPad);
      elements.push({ type: 'text', content: track.label, position: { x: margin, y: laneY + trackHeight / 2 + typography.smallFontSize * 0.4 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted });
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
    elements.push({ type: 'rect', bounds: { x: barX, y: barY, width: barW, height: barH }, fill, stroke: palette.border, strokeWidth: 1, rx: 4 });
    elements.push({ type: 'text', content: act.label, position: { x: barX + barW / 2, y: barY + barH / 2 + typography.smallFontSize * 0.4 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.text, anchor: 'middle' });
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  for (const ms of ir.milestones) {
    const mx = dateX.get(ms.date) ?? axisLeft;
    const my = axisY;
    const r  = milestoneR;

    elements.push({ type: 'path', d: `M ${mx} ${my - r} L ${mx + r} ${my} L ${mx} ${my + r} L ${mx - r} ${my} Z`, fill: palette.primary, stroke: palette.background, strokeWidth: 1 });
    elements.push({ type: 'text', content: ms.date, position: { x: mx, y: my - r - 6 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted, anchor: 'middle' });
    elements.push({ type: 'text', content: ms.label, position: { x: mx, y: my + r + typography.baseFontSize + 2 }, fontSize: typography.baseFontSize, fontFamily: typography.fontFamily, fill: palette.text, anchor: 'middle' });
  }

  // ── ViewBox ───────────────────────────────────────────────────────────────
  const numTracks = Math.max(trackOrder.length, 1);
  const totalH = axisY + milestoneR + trackPad + numTracks * (trackHeight + trackPad) + typography.baseFontSize + 20 + margin;

  let scene: Scene = {
    viewBox: { x: 0, y: 0, width: axisRight + margin, height: totalH },
    background: palette.background,
    elements,
  };

  // ── Overlays ──────────────────────────────────────────────────────────────
  if (ir.overlays && ir.overlays.length > 0) {
    const compiled = compileOverlays(ir.overlays);
    const { elements: overlayEls, viewBox } = layoutOverlays(compiled, scene, theme);
    scene = { ...scene, elements: [...scene.elements, ...overlayEls], viewBox };
  }

  return { scene, anchors: {} };
}

// ─── Date Mapping ─────────────────────────────────────────────────────────────

interface DateMapping {
  toNum: (date: string) => number;
  min: number;
  max: number;
  range: number;
}

function buildDateMap(dates: string[]): DateMapping {
  const unique = [...new Set(dates)];
  const nums   = unique.map(parseTimelineDate);
  const hasNumeric = nums.some(n => !isNaN(n));

  if (hasNumeric) {
    const validNums = nums.filter(n => !isNaN(n));
    const min = Math.min(...validNums);
    const max = Math.max(...validNums);
    const range = max - min || 1;
    return {
      toNum: (d) => {
        const n = parseTimelineDate(d);
        return isNaN(n) ? min : n;
      },
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

function parseTimelineDate(date: string): number {
  // "2025"      → 2025.0
  // "2025-01"   → 2025 + 0/12
  // "2025-Q1"   → 2025 + 0/4
  // "2025-H1"   → 2025 + 0/2
  const year = date.match(/^(\d{4})$/);
  if (year) return parseInt(year[1]!);

  const ym = date.match(/^(\d{4})-(\d{2})$/);
  if (ym) return parseInt(ym[1]!) + (parseInt(ym[2]!) - 1) / 12;

  const yq = date.match(/^(\d{4})-Q([1-4])$/);
  if (yq) return parseInt(yq[1]!) + (parseInt(yq[2]!) - 1) / 4;

  const yh = date.match(/^(\d{4})-H([12])$/);
  if (yh) return parseInt(yh[1]!) + (parseInt(yh[2]!) - 1) / 2;

  return NaN;
}

function dateToX(date: string, map: DateMapping, axisLeft: number, axisWidth: number): number {
  const n = map.toNum(date);
  if (map.range === 0) return axisLeft;
  return axisLeft + ((n - map.min) / map.range) * axisWidth;
}

function activityFill(act: Activity, palette: ResolvedTheme['palette']): string {
  switch (act.status) {
    case 'active':  return palette.primary  + '33';
    case 'done':    return palette.success  + '33';
    case 'blocked': return palette.error    + '33';
    default:        return palette.surface;
  }
}
