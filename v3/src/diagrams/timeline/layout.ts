import type { TimelineDocument, Activity, Milestone, Section, Track } from './ir.js';
import type { Scene, SceneElement, Rect, Point } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { compileOverlays } from '../../overlay/compiler.js';
import { layoutOverlays } from '../../overlay/layout.js';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export function layoutTimeline(ir: TimelineDocument, theme: ResolvedTheme): Scene {
  switch (ir.layout) {
    case 'horizontal':
    default:
      return layoutHorizontal(ir, theme);
  }
}

// ─── Horizontal Layout ────────────────────────────────────────────────────────

function layoutHorizontal(ir: TimelineDocument, theme: ResolvedTheme): Scene {
  const { palette, typography, spacing } = theme;
  const margin = spacing.diagramMargin;
  const elements: SceneElement[] = [];

  // ── Date mapping ──────────────────────────────────────────────────────────
  const allDates: string[] = [
    ...ir.milestones.map(m => m.date),
    ...ir.activities.flatMap(a => [a.start, ...(a.end ? [a.end] : [])]),
    ...(ir.sections?.flatMap(s => [s.start, s.end]) ?? []),
  ];

  const dateMap = buildDateMap(allDates);
  const dateRange = dateMap.range;

  // Layout constants
  const axisY        = margin + (ir.metadata.title ? typography.titleFontSize + 16 : 0) + 60;
  const axisLeft     = margin + 20;
  const axisRight    = Math.max(600, dateRange * 80 + axisLeft + margin);
  const axisWidth    = axisRight - axisLeft;
  const trackHeight  = 36;
  const trackPad     = 8;
  const milestoneR   = 8;

  // Unique tracks (in order of first appearance)
  const trackOrder   = ir.tracks.map(t => t.id);
  const trackIndex   = new Map(trackOrder.map((id, i) => [id, i]));

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push({ type: 'text', content: ir.metadata.title, position: { x: margin, y: margin + typography.titleFontSize }, fontSize: typography.titleFontSize, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
  }

  // ── Section backgrounds ───────────────────────────────────────────────────
  if (ir.sections) {
    for (const sec of ir.sections) {
      const sx = dateToX(sec.start, dateMap, axisLeft, axisWidth);
      const ex = dateToX(sec.end,   dateMap, axisLeft, axisWidth);
      elements.push({ type: 'rect', bounds: { x: sx, y: axisY - 50, width: Math.max(ex - sx, 20), height: 50 + trackOrder.length * (trackHeight + trackPad) + 40 }, fill: palette.primary + '0A', stroke: palette.primary + '33', strokeWidth: 1, rx: 4 });
      elements.push({ type: 'text', content: sec.label, position: { x: sx + 6, y: axisY - 36 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.primary, fontWeight: 'bold' });
    }
  }

  // ── Axis line ─────────────────────────────────────────────────────────────
  elements.push({ type: 'path', d: `M ${axisLeft} ${axisY} L ${axisRight} ${axisY}`, stroke: palette.border, strokeWidth: 2 });

  // ── Track lanes (for activities) ──────────────────────────────────────────
  const trackLabelX = margin;
  for (let i = 0; i < trackOrder.length; i++) {
    const track = ir.tracks.find(t => t.id === trackOrder[i]);
    if (!track) continue;
    const laneY = axisY + milestoneR + trackPad + i * (trackHeight + trackPad);
    elements.push({ type: 'text', content: track.label, position: { x: trackLabelX, y: laneY + trackHeight / 2 + typography.smallFontSize * 0.4 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted });
  }

  // ── Activities ────────────────────────────────────────────────────────────
  for (const act of ir.activities) {
    const tIdx  = trackIndex.get(act.track) ?? 0;
    const laneY = axisY + milestoneR + trackPad + tIdx * (trackHeight + trackPad);
    const sx    = dateToX(act.start, dateMap, axisLeft, axisWidth);
    const ex    = act.end
      ? dateToX(act.end, dateMap, axisLeft, axisWidth)
      : sx + 60;
    const barW  = Math.max(ex - sx, 20);
    const barH  = trackHeight - 4;
    const barY  = laneY + 2;

    const fill = activityFill(act, palette);
    elements.push({ type: 'rect', bounds: { x: sx, y: barY, width: barW, height: barH }, fill, stroke: palette.border, strokeWidth: 1, rx: 4 });
    if (barW > 30) {
      elements.push({ type: 'text', content: act.label, position: { x: sx + barW / 2, y: barY + barH / 2 + typography.smallFontSize * 0.4 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.text, anchor: 'middle' });
    }
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  for (const ms of ir.milestones) {
    const mx = dateToX(ms.date, dateMap, axisLeft, axisWidth);
    const my = axisY;
    const r  = milestoneR;

    // Diamond
    elements.push({ type: 'path', d: `M ${mx} ${my - r} L ${mx + r} ${my} L ${mx} ${my + r} L ${mx - r} ${my} Z`, fill: palette.primary, stroke: palette.background, strokeWidth: 1 });

    // Date label (above)
    elements.push({ type: 'text', content: ms.date, position: { x: mx, y: my - r - 6 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted, anchor: 'middle' });

    // Event label (below)
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

  return scene;
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
