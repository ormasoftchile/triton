/**
 * @file layout/gantt.ts — Faithful Mermaid-compatible Gantt layout engine.
 *
 * Produces a Gantt chart with:
 *   1. Section labels on the LEFT in a fixed-width column.
 *   2. A date axis at the BOTTOM with YYYY-MM-DD tick labels and vertical
 *      gridlines extending from the axis up through all section bands.
 *   3. Task bars positioned by start/end date, coloured by status:
 *      done → muted gray; active → blue; critical → red; planned → light blue.
 *   4. Milestone diamonds (◆) placed at their dates with labels to the right.
 *   5. Alternating section band fills (even→light blue, odd→white/neutral).
 *
 * OPT-IN: gated behind `layout: 'gantt'`.  All existing layout families are
 * completely untouched — this is a brand-new code path.
 *
 * DETERMINISM: all coordinates via rhuInt() (round-half-up); no Date.now(),
 * Math.random(), or locale queries.
 */

import type { Activity, IRDocument, Milestone } from '../types.js';
import type { Scene, ScenePrimitive } from '../scene.js';
import type { ResolvedTheme } from '../themes/types.js';
import { measureText, ptToPx } from '../fonts/metrics.js';
import {
  dateToOrdinal,
  coerceLeft,
  coerceRight,
  parseIRDate,
  enumTicks,
} from './dates.js';

// ---------------------------------------------------------------------------
// Rounding helpers (§5.1 determinism contract)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

function rhu(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.floor(v * f + 0.5) / f;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Width of the left section-label column. */
const SECTION_LABEL_W = 120;
/** Height of each task row (bar + vertical padding). */
const TASK_ROW_H = 28;
/** Height of the task bar itself. */
const TASK_BAR_H = 20;
/** Vertical padding above the bar within the row. */
const TASK_BAR_TOP = 4;
/** Top/bottom padding inside each section band beyond the task rows. */
const SECTION_PAD_TOP = 6;
const SECTION_PAD_BOT = 6;
/** Bottom axis height (date labels + tick marks). */
const AXIS_H = 40;
/** Tick mark height (px above the axis baseline). */
const TICK_H = 5;
/** Gap between tick mark top and label baseline. */
const TICK_LABEL_GAP = 3;
/** Milestone diamond half-diagonal size. */
const DIAMOND_SIZE = 8;
/** Label offset from diamond right vertex. */
const MILESTONE_LABEL_OFFSET = 8;
/** Minimum gap between adjacent tick labels (px). */
const MIN_TICK_LABEL_GAP = 6;

// ---------------------------------------------------------------------------
// Color palette — status-to-fill mapping
// ---------------------------------------------------------------------------

/**
 * Returns the bar fill and stroke for a task based on its status and whether
 * it is in the 'critical' category.  Designed to match real Mermaid gantt.
 */
function taskColors(
  status: string | undefined,
  category: string | undefined,
): { fill: string; stroke: string; labelColor: string } {
  const isCrit = category === 'critical';

  if (isCrit) {
    // Critical tasks: red fill regardless of status
    return { fill: '#FF8080', stroke: '#E53E3E', labelColor: '#6B0000' };
  }

  switch (status) {
    case 'done':
      return { fill: '#C0C7D4', stroke: '#8E9AAF', labelColor: '#374151' };
    case 'in-progress':
      return { fill: '#7B9FE0', stroke: '#3B5FC0', labelColor: '#0E2F68' };
    default:
      return { fill: '#C8D9F5', stroke: '#7B9FE0', labelColor: '#1E3A6E' };
  }
}

/**
 * Colors for milestone diamonds based on status/category.
 */
function milestoneColors(
  status: string | undefined,
  category: string | undefined,
): { fill: string; stroke: string; labelColor: string } {
  if (category === 'critical') {
    return { fill: '#E53E3E', stroke: '#9B2C2C', labelColor: '#1A0000' };
  }
  switch (status) {
    case 'done':
      return { fill: '#8E9AAF', stroke: '#6B7280', labelColor: '#374151' };
    case 'in-progress':
      return { fill: '#4267C7', stroke: '#2A3F8C', labelColor: '#0E2F68' };
    default:
      return { fill: '#6666CC', stroke: '#4444AA', labelColor: '#1A1060' };
  }
}

// ---------------------------------------------------------------------------
// Diamond path helper
// ---------------------------------------------------------------------------

/**
 * Build an SVG `d` attribute for a diamond centered at (cx, cy) with
 * half-diagonal `r`.  Points: top, right, bottom, left, closed.
 */
function diamondPath(cx: number, cy: number, r: number): string {
  const t = rhuInt(cy - r);
  const ri = rhuInt(cx + r);
  const b = rhuInt(cy + r);
  const l = rhuInt(cx - r);
  return `M ${cx} ${t} L ${ri} ${cy} L ${cx} ${b} L ${l} ${cy} Z`;
}

// ---------------------------------------------------------------------------
// Date axis x-coordinate mapper
// ---------------------------------------------------------------------------

interface GanttAxisState {
  tsOrd:  number;
  teOrd:  number;
  xLeft:  number; // chart area left x (after label column)
  xRight: number; // chart area right x
}

function dateX(ord: number, ax: GanttAxisState): number {
  const { tsOrd, teOrd, xLeft, xRight } = ax;
  if (teOrd === tsOrd) return xLeft;
  const raw = xLeft + Math.floor(((ord - tsOrd) * (xRight - xLeft)) / (teOrd - tsOrd) + 0.5);
  return Math.max(xLeft, Math.min(xRight, raw));
}

// ---------------------------------------------------------------------------
// Date tick label formatter (YYYY-MM-DD style matching real Mermaid)
// ---------------------------------------------------------------------------

function formatGanttTickLabel(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Text truncation helper
// ---------------------------------------------------------------------------

function truncateLabel(text: string, maxWidth: number, fontPx: number): string {
  const ELLIPSIS = '…';
  const ellW = measureText(ELLIPSIS, fontPx).width;
  if (measureText(text, fontPx).width <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && measureText(s, fontPx).width + ellW > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + ELLIPSIS;
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

export function layoutGantt(ir: IRDocument, theme: ResolvedTheme, _baseDir?: string): Scene {
  const FONT_FAM = `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`;
  const bg = theme.canvas.backgroundColor;

  // ── Time range ─────────────────────────────────────────────────────────
  const trStart = ir.metadata.time_range.start;
  const trEnd   = ir.metadata.time_range.end ?? trStart;
  const [tsY, tsM, tsD] = coerceLeft(parseIRDate(trStart));
  const [teY, teM, teD] = coerceRight(parseIRDate(trEnd));
  const tsOrd = dateToOrdinal(tsY, tsM, tsD);
  const teOrd = dateToOrdinal(teY, teM, teD);

  if (teOrd < tsOrd) {
    throw new Error(`[gantt layout] time_range end (${trEnd}) is before start (${trStart})`);
  }

  // ── Sort tracks by index ───────────────────────────────────────────────
  const sortedTracks = [...ir.tracks].sort((a, b) => {
    const ai = a.index ?? 0;
    const bi = b.index ?? 0;
    return ai !== bi ? ai - bi : a.id.localeCompare(b.id);
  });

  // ── Group activities and milestones by track ───────────────────────────
  const activitiesByTrack = new Map<string, Activity[]>();
  const milestonesByTrack = new Map<string, Milestone[]>();

  for (const track of sortedTracks) {
    activitiesByTrack.set(track.id, []);
    milestonesByTrack.set(track.id, []);
  }

  for (const act of ir.activities) {
    const arr = activitiesByTrack.get(act.track);
    if (arr) arr.push(act);
  }

  for (const ms of ir.milestones ?? []) {
    const arr = milestonesByTrack.get(ms.track ?? '');
    if (arr) arr.push(ms);
    else {
      // Milestone not assigned to a track — add to last track
      const lastTrack = sortedTracks[sortedTracks.length - 1];
      if (lastTrack) {
        const arr2 = milestonesByTrack.get(lastTrack.id);
        if (arr2) arr2.push(ms);
      }
    }
  }

  // ── Compute section heights ────────────────────────────────────────────
  // Each task gets its own dedicated row (declaration order), matching real
  // Mermaid semantics. Milestones share their own row at the bottom of the section.
  const sectionRowCounts = new Map<string, number>();
  for (const track of sortedTracks) {
    const acts = activitiesByTrack.get(track.id) ?? [];
    const mss  = milestonesByTrack.get(track.id) ?? [];
    // One row per activity; if milestones exist they share an additional row
    const actRows = acts.length;
    const msRows  = mss.length > 0 ? 1 : 0;
    const rowCount = Math.max(actRows + msRows, 1);
    sectionRowCounts.set(track.id, rowCount);
  }

  // ── Canvas geometry ────────────────────────────────────────────────────
  const W = 1400;
  const mL = 0;   // no margin; section label column acts as left margin
  const mR = 24;
  const mT = 16;
  const mB = 16;

  // Title height
  const TITLE_FONT_PX = ptToPx(theme.typography.fontSizeTitle);
  const TITLE_H       = ir.metadata.title ? rhuInt(TITLE_FONT_PX * 1.6) + 16 : 0;

  // Chart X extents
  const chartLeft  = SECTION_LABEL_W;              // where the time chart starts
  const chartRight = W - mR;                        // right edge
  const chartWidth = chartRight - chartLeft;

  // Infer axis unit for tick generation
  const axisUnit = ir.metadata.axis_unit ?? (
    (teOrd - tsOrd) < 60   ? 'day'   :
    (teOrd - tsOrd) < 365  ? 'month' :
    (teOrd - tsOrd) < 1095 ? 'quarter' : 'year'
  );

  // Generate ticks
  const ticks = enumTicks(tsOrd, teOrd, axisUnit);

  // Axis state for date→x mapping
  const axisState: GanttAxisState = {
    tsOrd, teOrd,
    xLeft:  chartLeft,
    xRight: chartRight,
  };

  // Tick label crowding check
  const axisLabelFontPx = ptToPx(theme.typography.fontSizeAxis);
  const tickLabelVisible: boolean[] = [];
  {
    let lastRight = -Infinity;
    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i]!;
      const lbl = formatGanttTickLabel(tick.year, tick.month, tick.day);
      const x   = rhu(dateX(tick.ordinal, axisState));
      const w   = measureText(lbl, axisLabelFontPx).width;
      const left = x - w / 2;
      if (left >= lastRight + MIN_TICK_LABEL_GAP) {
        tickLabelVisible.push(true);
        lastRight = x + w / 2;
      } else {
        tickLabelVisible.push(false);
      }
    }
  }

  // ── Compute section Y positions ────────────────────────────────────────
  const sectionYStart = new Map<string, number>();
  let curY = mT + TITLE_H;
  for (const track of sortedTracks) {
    const rowCount = sectionRowCounts.get(track.id) ?? 1;
    const sectionH = SECTION_PAD_TOP + rowCount * TASK_ROW_H + SECTION_PAD_BOT;
    sectionYStart.set(track.id, curY);
    curY += sectionH;
  }
  const contentBottomY = curY;

  // Axis sits below content
  const axisY    = contentBottomY;                 // baseline of axis
  const axisTopY = axisY;                          // top of tick marks
  const H        = axisY + AXIS_H + mB;

  // ── Begin drawing ──────────────────────────────────────────────────────
  const primitives: ScenePrimitive[] = [];

  // Background
  primitives.push({
    kind: 'rect', x: 0, y: 0, width: W, height: H,
    fill: bg,
  });

  // ── Title ─────────────────────────────────────────────────────────────
  if (ir.metadata.title && TITLE_H > 0) {
    primitives.push({
      kind:            'text',
      x:               rhuInt(W / 2),
      y:               rhuInt(mT + TITLE_FONT_PX * 1.2),
      text:            ir.metadata.title,
      fontFamily:      FONT_FAM,
      fontSize:        TITLE_FONT_PX,
      fontWeight:      theme.typography.fontWeightHeader,
      fill:            theme.typography.titleColor,
      textAnchor:      'middle',
      dominantBaseline: 'alphabetic',
    });
  }

  const contentTopY = mT + TITLE_H;

  // ── Section bands and labels ──────────────────────────────────────────
  const BAND_FILL_EVEN = '#EEF2FF'; // light periwinkle (like Mermaid's Infrastructure/Frontend)
  const BAND_FILL_ODD  = '#FAFAFA'; // near-white
  const SECTION_LABEL_FONT_PX = ptToPx(10);
  const SECTION_LABEL_COLOR   = '#374151';

  for (let si = 0; si < sortedTracks.length; si++) {
    const track = sortedTracks[si]!;
    const startY = sectionYStart.get(track.id)!;
    const rowCount = sectionRowCounts.get(track.id) ?? 1;
    const sectionH = SECTION_PAD_TOP + rowCount * TASK_ROW_H + SECTION_PAD_BOT;

    // Alternating section band (full width for chart area)
    const bandFill = si % 2 === 0 ? BAND_FILL_EVEN : BAND_FILL_ODD;
    primitives.push({
      kind:   'rect',
      x:      chartLeft,
      y:      startY,
      width:  chartWidth,
      height: sectionH,
      fill:   bandFill,
      opacity: 1,
    });

    // Section label in left column — vertically centered
    const labelCenterY = rhuInt(startY + sectionH / 2);
    primitives.push({
      kind:            'text',
      x:               rhuInt(SECTION_LABEL_W - 8),
      y:               labelCenterY,
      text:            track.label,
      fontFamily:      FONT_FAM,
      fontSize:        SECTION_LABEL_FONT_PX,
      fontWeight:      400,
      fill:            SECTION_LABEL_COLOR,
      textAnchor:      'end',
      dominantBaseline: 'middle',
    });
  }

  // ── Vertical gridlines (drawn after section bands so they're visible) ──
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i]!;
    const x = rhuInt(dateX(tick.ordinal, axisState));
    primitives.push({
      kind:        'line',
      x1: x, y1: contentTopY,
      x2: x, y2: axisTopY,
      stroke:      '#AAAACC',
      strokeWidth: 0.75,
      opacity:     0.5,
    });
  }

  // Thin separator line between label column and chart area
  primitives.push({
    kind:        'line',
    x1: chartLeft, y1: contentTopY,
    x2: chartLeft, y2: axisTopY,
    stroke:      '#9999BB',
    strokeWidth:  1,
    opacity:      0.5,
  });

  // ── Task bars ─────────────────────────────────────────────────────────
  const TASK_LABEL_FONT_PX = ptToPx(8.5);

  for (const track of sortedTracks) {
    const acts   = activitiesByTrack.get(track.id) ?? [];
    const startY = sectionYStart.get(track.id)!;

    // Each activity gets its own row in declaration order (matching Mermaid semantics)
    for (let row = 0; row < acts.length; row++) {
      const act = acts[row]!;
      const { fill, stroke, labelColor } = taskColors(act.status, act.category);

      const actStartOrd = act.start
        ? dateToOrdinal(...coerceLeft(parseIRDate(act.start)))
        : tsOrd;
      const actEndOrd   = act.end
        ? dateToOrdinal(...coerceLeft(parseIRDate(act.end)))
        : actStartOrd + 1;

      const barX  = rhuInt(dateX(actStartOrd, axisState));
      const barX2 = rhuInt(dateX(actEndOrd,   axisState));
      const barW  = Math.max(barX2 - barX, 3);
      const barY  = rhuInt(startY + SECTION_PAD_TOP + row * TASK_ROW_H + TASK_BAR_TOP);

      // Bar rect
      primitives.push({
        kind:        'rect',
        x:           barX,
        y:           barY,
        width:       barW,
        height:      TASK_BAR_H,
        fill,
        stroke,
        strokeWidth: 0.5,
        rx:          3,
      });

      // Label inside bar (truncated to fit)
      const labelPad   = 4;
      const maxLabelW  = Math.max(barW - labelPad * 2, 10);
      const labelText  = truncateLabel(act.label, maxLabelW, TASK_LABEL_FONT_PX);

      if (barW >= 30) {
        const labelX = rhuInt(barX + labelPad);
        const labelY = rhuInt(barY + TASK_BAR_H / 2);
        primitives.push({
          kind:            'text',
          x:               labelX,
          y:               labelY,
          text:            labelText,
          fontFamily:      FONT_FAM,
          fontSize:        TASK_LABEL_FONT_PX,
          fontWeight:      600,
          fill:            labelColor,
          textAnchor:      'start',
          dominantBaseline: 'middle',
        });
      }
    }
  }

  // ── Milestones (diamonds) ─────────────────────────────────────────────
  const MS_LABEL_FONT_PX = ptToPx(8.5);

  for (const track of sortedTracks) {
    const mss    = milestonesByTrack.get(track.id) ?? [];
    const acts   = activitiesByTrack.get(track.id) ?? [];
    const startY = sectionYStart.get(track.id)!;
    // Milestones sit in the row after the last activity row
    const msRow  = acts.length;
    const msRowY = rhuInt(startY + SECTION_PAD_TOP + msRow * TASK_ROW_H + TASK_BAR_TOP + TASK_BAR_H / 2);

    for (const ms of mss) {
      const msOrd = dateToOrdinal(...coerceLeft(parseIRDate(ms.date)));
      const msX   = rhuInt(dateX(msOrd, axisState));
      const { fill, stroke, labelColor } = milestoneColors(ms.status, ms.category);

      // Diamond path
      primitives.push({
        kind:        'path',
        d:           diamondPath(msX, msRowY, DIAMOND_SIZE),
        fill,
        stroke,
        strokeWidth: 1.5,
      });

      // Label: render to the right; if that would overflow, render to the left
      const labelText2 = ms.label;
      const labelW     = measureText(labelText2, MS_LABEL_FONT_PX).width;
      const labelRightX = msX + DIAMOND_SIZE + MILESTONE_LABEL_OFFSET;
      const labelLeftX  = msX - DIAMOND_SIZE - MILESTONE_LABEL_OFFSET;
      // Use right side if label fits, otherwise flip left
      const renderRight = labelRightX + labelW <= chartRight - 4;
      const labelX2 = renderRight ? labelRightX : labelLeftX;
      const anchor  = renderRight ? 'start' : 'end';
      // Only render if there's any room on canvas
      if (labelX2 > chartLeft || !renderRight) {
        primitives.push({
          kind:            'text',
          x:               labelX2,
          y:               msRowY,
          text:            labelText2,
          fontFamily:      FONT_FAM,
          fontSize:        MS_LABEL_FONT_PX,
          fontWeight:      600,
          fill:            labelColor,
          textAnchor:      anchor,
          dominantBaseline: 'middle',
        });
      }
    }
  }

  // ── Bottom date axis ──────────────────────────────────────────────────
  // Axis baseline
  primitives.push({
    kind:        'line',
    x1: chartLeft, y1: axisY,
    x2: chartRight, y2: axisY,
    stroke:      '#374151',
    strokeWidth: 1,
  });

  // Tick marks and labels
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i]!;
    const x    = rhuInt(dateX(tick.ordinal, axisState));

    // Tick mark
    primitives.push({
      kind:        'line',
      x1: x, y1: axisY,
      x2: x, y2: rhuInt(axisY + TICK_H),
      stroke:      '#374151',
      strokeWidth: 1,
    });

    // Label (if not crowded)
    if (tickLabelVisible[i]) {
      const lbl = formatGanttTickLabel(tick.year, tick.month, tick.day);
      const labelY = rhuInt(axisY + TICK_H + TICK_LABEL_GAP + axisLabelFontPx * 0.9);
      primitives.push({
        kind:            'text',
        x,
        y:               labelY,
        text:            lbl,
        fontFamily:      FONT_FAM,
        fontSize:        axisLabelFontPx,
        fontWeight:      theme.typography.fontWeightAxis,
        fill:            theme.axis.tickLabelColor,
        textAnchor:      'middle',
        dominantBaseline: 'alphabetic',
      });
    }
  }

  return {
    width:      W,
    height:     rhu(H),
    background: bg,
    primitives,
  };
}

// (No activity-packing helpers needed: each task gets its own declared row.)
