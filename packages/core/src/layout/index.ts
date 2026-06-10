/**
 * @file layout/index.ts — Deterministic six-phase layout engine.
 *
 * `layout(ir, theme)` implements the pipeline defined in §5.4 for the
 * HORIZONTAL family.  It consumes an IRDocument and a ResolvedTheme and
 * produces a Scene — a backend-agnostic ordered list of drawing primitives.
 *
 * Scope (Phase 1): horizontal family + consulting theme + T2 (numbered-circle
 * milestones, date above / title below, no activities required for T2).
 *
 * Determinism contract (§5.1):
 *  - Stable sort keys: tracks by index; activities by (start_ordinal, id);
 *    milestones by (date_ordinal, id).
 *  - round-half-up for all coordinate values (Math.floor(x + 0.5)).
 *  - No Date.now(), Math.random(), or system locale.
 */

import type { Activity, IRDocument, Milestone, Track } from '../types.js';
import type { Scene, ScenePrimitive } from '../scene.js';
import type { ResolvedTheme } from '../themes/types.js';
import { measureText, ptToPx } from '../fonts/metrics.js';
import {
  dateToOrdinal,
  coerceLeft,
  coerceRight,
  parseIRDate,
  parseAndCoerceLeft,
  parseAndCoerceRight,
  inferAxisUnit,
  enumTicks,
  formatTickLabel,
  formatMilestoneDate,
} from './dates.js';

// ---------------------------------------------------------------------------
// Rounding helper (§5.1 item 3)
// ---------------------------------------------------------------------------

/** Round-half-up to n decimal places (default 2). */
function rhu(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.floor(v * f + 0.5) / f;
}

/** Round to nearest integer (round-half-up). */
function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// x-coordinate function (§5.3.2)
// ---------------------------------------------------------------------------

interface AxisState {
  tsOrd: number;
  teOrd: number;
  offset: number; // H_hdr + m_L
  wDraw:  number;
}

/** Map a day ordinal to a canvas x coordinate (deterministic). */
function dateX(ord: number, ax: AxisState): number {
  const { tsOrd, teOrd, offset, wDraw } = ax;
  if (teOrd === tsOrd) return offset;
  const raw = offset + Math.floor(((ord - tsOrd) * wDraw) / (teOrd - tsOrd) + 0.5);
  return Math.max(offset, Math.min(offset + wDraw, raw));
}

// ---------------------------------------------------------------------------
// Layout entry point
// ---------------------------------------------------------------------------

export function layout(ir: IRDocument, theme: ResolvedTheme): Scene {
  const { canvas: cv, axis: ax, track: tk, milestone: ms } = {
    canvas:   theme.canvas,
    axis:     theme.axis,
    track:    theme.track,
    milestone: theme.milestone,
  };
  const m = theme.canvas.margin;

  // -------------------------------------------------------------------------
  // Phase 1: Axis computation
  // -------------------------------------------------------------------------

  // 1a. Resolve time_range
  const trStart = ir.metadata.time_range.start;
  const trEnd   = ir.metadata.time_range.end ?? trStart;

  const [tsY, tsM, tsD] = coerceLeft(parseIRDate(trStart));
  const [teY, teM, teD] = coerceRight(parseIRDate(trEnd));
  const tsOrd = dateToOrdinal(tsY, tsM, tsD);
  const teOrd = dateToOrdinal(teY, teM, teD);

  if (teOrd < tsOrd) {
    throw new Error(`time_range end (${trEnd}) is before start (${trStart})`);
  }

  // 1b. Infer axis unit
  const axisUnit = ir.metadata.axis_unit ?? inferAxisUnit(teOrd - tsOrd);

  // Sort tracks early — needed to compute effective header width (fix #2).
  const sortedTracks = [...ir.tracks].sort((a, b) => {
    const ai = a.index ?? 0;
    const bi = b.index ?? 0;
    return ai !== bi ? ai - bi : a.id.localeCompare(b.id);
  });

  // 1c. Canvas geometry
  const W     = cv.width;
  // Suppress the header gutter when no track has a meaningful (non-empty) label.
  const hasTrackLabels = sortedTracks.some((t) => !!t.label && t.label.trim().length > 0);
  const Hhdr  = hasTrackLabels ? tk.headerWidth : 0;
  const Haxis = ax.height;
  const mL    = m.left;
  const mR    = m.right;
  const mT    = m.top;
  const wDraw = W - mL - mR - Hhdr;
  const offset = Hhdr + mL;

  const axisState: AxisState = { tsOrd, teOrd, offset, wDraw };

  // 1d. Enumerate ticks
  const ticks = enumTicks(tsOrd, teOrd, axisUnit);

  // -------------------------------------------------------------------------
  // Phase 2: Track placement
  // -------------------------------------------------------------------------

  interface TrackLayout {
    track:  Track;
    yTop:   number;
    height: number; // provisional; may expand in Phase 3
  }

  let yCursor = mT + Haxis;
  const trackLayouts: TrackLayout[] = sortedTracks.map((t) => {
    const tl: TrackLayout = { track: t, yTop: yCursor, height: tk.rowHeight };
    yCursor += tk.rowHeight + tk.rowGap;
    return tl;
  });

  const trackIndex = new Map<string, TrackLayout>(trackLayouts.map((tl) => [tl.track.id, tl]));

  // -------------------------------------------------------------------------
  // Phase 3: Activity geometry
  // -------------------------------------------------------------------------

  // Simplified for T2 (no activities in the worked IR).  Full sub-lane
  // assignment from §5.4.3 is implemented here for completeness.

  interface ActivityLayout {
    activity: Activity;
    xLeft:    number;
    xRight:   number;
    y:        number;
    width:    number;
    lane:     number;
    /** Whether the bar has an open/uncertain right edge. */
    endKind:  'fixed' | 'ongoing' | 'tbd';
  }

  const activityLayouts: ActivityLayout[] = [];

  for (const tl of trackLayouts) {
    const acts = (ir.activities ?? [])
      .filter((a) => a.track === tl.track.id)
      .map((a) => {
        const startOrd = a.span
          ? parseAndCoerceLeft(a.span)
          : parseAndCoerceLeft(a.start ?? trStart);
        return { a, startOrd };
      })
      .sort((p, q) =>
        p.startOrd !== q.startOrd ? p.startOrd - q.startOrd : p.a.id.localeCompare(q.a.id),
      );

    const laneEndX: number[] = [-Infinity];
    let nLanes = 1;

    for (const { a, startOrd } of acts) {
      const xLeft = dateX(startOrd, axisState);
      let xRight: number;
      let endKind: 'fixed' | 'ongoing' | 'tbd';

      // NOTE: span check must precede !a.end — span activities have a.end === undefined,
      // which would otherwise be incorrectly treated as 'ongoing'.
      if (a.span) {
        xRight  = dateX(parseAndCoerceRight(a.span), axisState);
        endKind = 'fixed';
      } else if (!a.end || a.end === 'ongoing') {
        xRight  = offset + wDraw;
        endKind = 'ongoing';
      } else if (a.end === 'tbd' || a.end === 'unknown') {
        // TBD/unknown: extend to right edge with dashed indicator (§5 open-interval ruling)
        xRight  = offset + wDraw;
        endKind = 'tbd';
      } else {
        xRight  = dateX(parseAndCoerceRight(a.end), axisState);
        endKind = 'fixed';
      }

      // Min-width enforcement
      let finalLeft = xLeft;
      let finalRight = xRight;
      if (finalRight - finalLeft < theme.activity.minWidth) {
        const mid = rhuInt((finalLeft + finalRight) / 2);
        finalLeft  = mid - rhuInt(theme.activity.minWidth / 2);
        finalRight = finalLeft + theme.activity.minWidth;
      }

      // Greedy sub-lane assignment
      let lane = laneEndX.findIndex((ex) => ex <= finalLeft);
      if (lane === -1) {
        if (laneEndX.length < tk.maxSubLanes) {
          laneEndX.push(-Infinity);
          lane = laneEndX.length - 1;
        } else {
          lane = tk.maxSubLanes - 1;
        }
      }
      laneEndX[lane] = finalRight;
      nLanes = Math.max(nLanes, lane + 1);

      const yPos = tl.yTop + theme.activity.barTopMargin + lane * tk.subLaneHeight;
      activityLayouts.push({
        activity: a,
        xLeft:    rhu(finalLeft),
        xRight:   rhu(finalRight),
        y:        rhu(yPos),
        width:    rhu(finalRight - finalLeft),
        lane,
        endKind,
      });
    }

    // Expand track height for sub-lanes
    if (nLanes > 1) {
      tl.height = tk.rowHeight + (nLanes - 1) * tk.subLaneHeight;
    }
  }

  // Recompute y_top after Phase 3 height changes
  let yCursor3 = mT + Haxis;
  for (const tl of trackLayouts) {
    tl.yTop = yCursor3;
    yCursor3 += tl.height + tk.rowGap;
  }
  // Recompute activity y positions with final heights
  for (const al of activityLayouts) {
    const tl = trackIndex.get(al.activity.track);
    if (tl) {
      al.y = rhu(tl.yTop + theme.activity.barTopMargin + al.lane * tk.subLaneHeight);
    }
  }

  const hDraw = trackLayouts.reduce((sum, tl) => sum + tl.height + tk.rowGap, 0) - tk.rowGap;

  // -------------------------------------------------------------------------
  // Phase 4: Milestone geometry
  // -------------------------------------------------------------------------

  interface MilestoneLayout {
    milestone:   Milestone;
    xCenter:     number;
    yCenter:     number;
    stackIndex:  number;
    ordinal:     number;    // 1-based sequential number for display
    dateFmt:     string;    // formatted date label
  }

  // Determine milestone ordinals (sorted by date_ordinal, id)
  const msWithOrd = (ir.milestones ?? [])
    .map((m) => {
      const [y, mo, d] = coerceLeft(parseIRDate(m.date));
      return { m, ord: dateToOrdinal(y, mo, d) };
    })
    .filter(({ ord }) => ord >= tsOrd && ord <= teOrd);  // outside-range suppression

  msWithOrd.sort((a, b) =>
    a.ord !== b.ord ? a.ord - b.ord : a.m.id.localeCompare(b.m.id),
  );

  const milestoneLayouts: MilestoneLayout[] = [];

  // Stacking: group by (effective_track_id, xCenter)
  const stackGroups = new Map<string, MilestoneLayout[]>();

  msWithOrd.forEach(({ m: mil, ord }, seqIdx) => {
    const xCenter = rhu(dateX(ord, axisState));
    const tl = mil.track ? trackIndex.get(mil.track) : undefined;
    const yCenter = tl
      ? rhu(tl.yTop + tl.height / 2)
      : rhu(mT + Haxis + hDraw / 2);

    const [y, mo, d] = coerceLeft(parseIRDate(mil.date));
    const dateFmt = formatMilestoneDate(y, mo, d);

    const ml: MilestoneLayout = {
      milestone: mil,
      xCenter,
      yCenter,
      stackIndex: 0,
      ordinal:    seqIdx + 1,
      dateFmt,
    };
    milestoneLayouts.push(ml);

    const groupKey = `${mil.track ?? '__cross__'}:${xCenter}`;
    const group = stackGroups.get(groupKey) ?? [];
    stackGroups.set(groupKey, group);
    group.push(ml);
  });

  // Assign stack indices within each (track, x) group, sorted by id
  for (const group of stackGroups.values()) {
    group.sort((a, b) => a.milestone.id.localeCompare(b.milestone.id));
    group.forEach((ml, i) => {
      ml.stackIndex = i;
      ml.yCenter = rhu(ml.yCenter + i * ms.stackOffsetY);
    });
  }

  // -------------------------------------------------------------------------
  // Phase 5: Sections and Annotations (simplified)
  // -------------------------------------------------------------------------
  // Sections and annotations are deferred to a later phase for T2 (no
  // sections or annotations in the T2 worked IR).

  // -------------------------------------------------------------------------
  // Phase 6: Milestone label collision resolution (§5.4.6)
  // -------------------------------------------------------------------------

  interface LabelBox {
    mlIdx:  number;
    x:      number;
    y:      number;
    width:  number;
    height: number;
    isDate: boolean;
  }

  const dateLabelSizePx = ptToPx(ms.dateLabelFontSize);
  const titleLabelSizePx = ptToPx(ms.titleLabelFontSize);
  const labelGap = ms.labelGapPx;

  // Build label bounding boxes for date (above) and title (below)
  const labelBoxes: LabelBox[] = [];
  milestoneLayouts.forEach((ml, idx) => {
    const dateW = measureText(ml.dateFmt, dateLabelSizePx).width;
    const titleW = measureText(ml.milestone.label, titleLabelSizePx).width;

    const dateY = ml.yCenter - ms.size - labelGap - dateLabelSizePx;
    const titleY = ml.yCenter + ms.size + labelGap;

    if (ms.dateLabelAbove) {
      labelBoxes.push({
        mlIdx: idx,
        x:     rhu(ml.xCenter - dateW / 2),
        y:     rhu(dateY),
        width: rhu(dateW),
        height: rhu(dateLabelSizePx * 1.2),
        isDate: true,
      });
    }
    if (ms.titleLabelBelow) {
      labelBoxes.push({
        mlIdx: idx,
        x:     rhu(ml.xCenter - titleW / 2),
        y:     rhu(titleY),
        width: rhu(titleW),
        height: rhu(titleLabelSizePx * 1.2),
        isDate: false,
      });
    }
  });

  // Collision resolution (title labels only — bounded N passes)
  const titleBoxes = labelBoxes.filter((b) => !b.isDate);
  titleBoxes.sort((a, b) =>
    a.x !== b.x ? a.x - b.x : a.y !== b.y ? a.y - b.y : a.mlIdx - b.mlIdx,
  );

  let changed = true;
  let passes = 0;
  while (changed && passes < titleBoxes.length) {
    changed = false;
    for (let i = 0; i + 1 < titleBoxes.length; i++) {
      const lb = titleBoxes[i]!;
      const rb = titleBoxes[i + 1]!;
      if (lb.x + lb.width > rb.x && Math.abs(lb.y - rb.y) < lb.height) {
        rb.y = rhu(rb.y + ms.labelStackOffset);
        changed = true;
      }
    }
    passes += 1;
  }

  // Clamp to canvas
  const canvasBottom = mT + Haxis + hDraw + m.bottom;
  for (const lb of labelBoxes) {
    lb.y = rhu(Math.max(mT, Math.min(lb.y, canvasBottom - lb.height)));
  }

  // -------------------------------------------------------------------------
  // Build label maps
  // -------------------------------------------------------------------------

  const dateLabelByIdx  = new Map<number, LabelBox>();
  const titleLabelByIdx = new Map<number, LabelBox>();
  for (const lb of labelBoxes) {
    if (lb.isDate) dateLabelByIdx.set(lb.mlIdx, lb);
    else titleLabelByIdx.set(lb.mlIdx, lb);
  }

  // -------------------------------------------------------------------------
  // Canvas height
  // -------------------------------------------------------------------------

  const H = rhu(mT + Haxis + hDraw + m.bottom);

  // -------------------------------------------------------------------------
  // Build Scene primitives (painter's algorithm: back → front)
  // -------------------------------------------------------------------------

  const primitives: ScenePrimitive[] = [];

  // 1. Background
  primitives.push({ kind: 'rect', x: 0, y: 0, width: W, height: H, fill: cv.backgroundColor });

  // 2. Document title
  if (ir.metadata.title) {
    const titleSizePx = ptToPx(theme.typography.fontSizeTitle);
    primitives.push({
      kind:            'text',
      x:               rhu(W / 2),
      y:               rhu(mT / 2 + titleSizePx / 2),
      text:            ir.metadata.title,
      fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
      fontSize:        titleSizePx,
      fontWeight:      theme.typography.fontWeightHeader,
      fill:            theme.typography.titleColor,
      textAnchor:      'middle',
      dominantBaseline:'middle',
    });
  }

  // 3. Axis band (horizontal line at bottom of axis zone)
  const axisY = rhu(mT + Haxis);
  primitives.push({
    kind:        'line',
    x1:          rhu(offset),
    y1:          axisY,
    x2:          rhu(offset + wDraw),
    y2:          axisY,
    stroke:      theme.axis.axisLineColor,
    strokeWidth: 1,
  });

  // 4. Tick marks
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i]!;
    const xk = rhu(dateX(tick.ordinal, axisState));
    // Tick mark
    primitives.push({
      kind:        'line',
      x1:          xk,
      y1:          rhu(axisY - ax.tickHeight),
      x2:          xk,
      y2:          axisY,
      stroke:      theme.axis.axisLineColor,
      strokeWidth: 1,
    });
    // Gridlines (only if configured)
    if (ax.gridlineStyle !== 'none' && ax.gridlineWidth > 0) {
      primitives.push({
        kind:        'line',
        x1:          xk,
        y1:          axisY,
        x2:          xk,
        y2:          rhu(mT + Haxis + hDraw),
        stroke:      ax.gridlineColor,
        strokeWidth: ax.gridlineWidth,
        opacity:     ax.gridlineOpacity,
        dashArray:   ax.gridlineStyle === 'dashed' ? '4,4' : undefined,
      });
    }
    // Tick label
    const label = formatTickLabel(tick, axisUnit, i);
    if (label) {
      const axisFontPx = ptToPx(theme.typography.fontSizeAxis);
      primitives.push({
        kind:            'text',
        x:               xk,
        y:               rhu(axisY - ax.tickHeight - ax.tickLabelOffset - axisFontPx * 0.3),
        text:            label,
        fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize:        axisFontPx,
        fontWeight:      theme.typography.fontWeightAxis,
        fill:            theme.axis.tickLabelColor,
        textAnchor:      'middle',
        dominantBaseline:'alphabetic',
      });
    }
  }

  // 5. Track separators
  for (const tl of trackLayouts) {
    primitives.push({
      kind:        'line',
      x1:          rhu(offset),
      y1:          rhu(tl.yTop + tl.height),
      x2:          rhu(offset + wDraw),
      y2:          rhu(tl.yTop + tl.height),
      stroke:      tk.separatorColor,
      strokeWidth: tk.separatorWidth,
      opacity:     0.3,
    });
    // Track header label (only if headerWidth > 0)
    if (Hhdr > 0 && tl.track.label) {
      const thFontPx = ptToPx(tk.headerFontSize);
      primitives.push({
        kind:            'text',
        x:               rhu(mL + 8),
        y:               rhu(tl.yTop + tl.height / 2),
        text:            tl.track.label,
        fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize:        thFontPx,
        fontWeight:      tk.headerFontWeight,
        fill:            tk.headerColor,
        textAnchor:      'start',
        dominantBaseline:'middle',
      });
    }
  }

  // 6. Activity bars
  const actFontPx = ptToPx(theme.activity.labelFontSize);
  for (const al of activityLayouts) {
    const status = al.activity.status ?? 'planned';
    const cat    = al.activity.category;
    const base   = theme.statusMap[status];
    const catOverride = cat ? theme.categoryMap[cat] : undefined;

    const fill   = catOverride?.fill   ?? base?.fill   ?? '#1F497D';
    const stroke = catOverride?.stroke ?? base?.stroke ?? '#163760';
    const opacity = base?.opacity ?? 1;

    primitives.push({
      kind:        'rect',
      x:           al.xLeft,
      y:           al.y,
      width:       al.width,
      height:      theme.activity.barHeight,
      fill,
      stroke,
      strokeWidth: 0.5,
      rx:          theme.activity.barRadius,
      opacity,
    });

    // Progress fill strip (§5/§6: filled strip at bar bottom when progress is set)
    const prog = al.activity.progress;
    if (prog !== undefined && prog > 0) {
      const pw = rhuInt(al.width * prog);
      if (pw > 0) {
        const ph = theme.activity.progressBarHeight;
        primitives.push({
          kind:    'rect',
          x:       al.xLeft,
          y:       rhu(al.y + theme.activity.barHeight - ph),
          width:   pw,
          height:  ph,
          fill:    theme.activity.progressFillColor,
          rx:      theme.activity.barRadius,
          opacity: theme.activity.progressFillOpacity,
        });
      }
    }

    // Activity label
    const lw = measureText(al.activity.label, actFontPx).width;
    if (al.width >= theme.activity.labelInsideMinWidth) {
      primitives.push({
        kind:            'text',
        x:               rhu(al.xLeft + al.width / 2),
        y:               rhu(al.y + theme.activity.barHeight / 2),
        text:            al.activity.label,
        fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize:        actFontPx,
        fontWeight:      theme.typography.fontWeightLabel,
        fill:            theme.activity.labelColorInside,
        textAnchor:      'middle',
        dominantBaseline:'middle',
      });
    } else {
      const rightX = al.xRight + 4;
      const fits   = rightX + lw < offset + wDraw - 4;
      primitives.push({
        kind:            'text',
        x:               rhu(fits ? rightX : al.xLeft - 4),
        y:               rhu(al.y + theme.activity.barHeight / 2),
        text:            al.activity.label,
        fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize:        actFontPx,
        fontWeight:      theme.typography.fontWeightLabel,
        fill:            theme.activity.labelColorOutside,
        textAnchor:      fits ? 'start' : 'end',
        dominantBaseline:'middle',
      });
    }

    // Open-end indicator (§5: right-edge decoration for ongoing/tbd activities)
    const bH = theme.activity.barHeight;
    if (al.endKind === 'ongoing') {
      // Solid right-pointing arrowhead — protrudes 10 px into the right margin
      const tipX = rhu(al.xRight + 10);
      const cy   = rhu(al.y + bH / 2);
      primitives.push({
        kind:    'path',
        d:       `M ${rhu(al.xRight)} ${rhu(al.y)} L ${tipX} ${cy} L ${rhu(al.xRight)} ${rhu(al.y + bH)} Z`,
        fill,
        opacity,
      });
    } else if (al.endKind === 'tbd') {
      // Dashed right-border line for TBD/unknown activities
      primitives.push({
        kind:        'line',
        x1:          al.xRight,
        y1:          al.y,
        x2:          al.xRight,
        y2:          rhu(al.y + bH),
        stroke,
        strokeWidth: 2,
        dashArray:   '3,3',
        opacity:     0.5,
      });
    }
  }

  // 7. Milestones (circles + labels)
  const dateFontPx  = ptToPx(ms.dateLabelFontSize);
  const titleFontPx = ptToPx(ms.titleLabelFontSize);
  const ordFontPx   = ptToPx(ms.ordinalFontSize);

  milestoneLayouts.forEach((ml, idx) => {
    const { xCenter, yCenter, ordinal } = ml;
    const mil = ml.milestone;
    const status = mil.status ?? 'planned';
    const base = theme.statusMap[status];
    const cat  = mil.category;
    const catOverride = cat ? theme.categoryMap[cat] : undefined;
    const fill = catOverride?.fill ?? base?.fill ?? '#1F497D';

    // Milestone shape primitive
    if (ms.shape === 'circle') {
      primitives.push({
        kind:        'circle',
        cx:          xCenter,
        cy:          yCenter,
        r:           ms.size,
        fill,
        stroke:      ms.strokeColor,
        strokeWidth: ms.strokeWidth,
      });
    } else if (ms.shape === 'triangle') {
      // Downward-pointing triangle centered at (xCenter, yCenter)
      const s = ms.size;
      primitives.push({
        kind:   'path',
        d:      `M ${rhu(xCenter - s)} ${rhu(yCenter - s)} L ${rhu(xCenter + s)} ${rhu(yCenter - s)} L ${xCenter} ${rhu(yCenter + s)} Z`,
        fill,
        stroke:      ms.strokeColor,
        strokeWidth: ms.strokeWidth,
      });
    } else {
      // diamond
      const s = ms.size;
      primitives.push({
        kind:   'path',
        d:      `M ${xCenter} ${rhu(yCenter - s)} L ${rhu(xCenter + s)} ${yCenter} L ${xCenter} ${rhu(yCenter + s)} L ${rhu(xCenter - s)} ${yCenter} Z`,
        fill,
        stroke:      ms.strokeColor,
        strokeWidth: ms.strokeWidth,
      });
    }

    // Ordinal number inside circle
    if (ms.showOrdinalNumber) {
      const numStr = String(ordinal).padStart(2, '0');
      primitives.push({
        kind:            'text',
        x:               xCenter,
        y:               yCenter,
        text:            numStr,
        fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize:        ordFontPx,
        fontWeight:      ms.ordinalFontWeight,
        fill:            ms.ordinalColor,
        textAnchor:      'middle',
        dominantBaseline:'middle',
      });
    }

    // Date label above
    const dBox = dateLabelByIdx.get(idx);
    if (ms.dateLabelAbove && dBox) {
      primitives.push({
        kind:            'text',
        x:               rhu(dBox.x + dBox.width / 2),
        y:               rhu(dBox.y + dBox.height * 0.85),
        text:            ml.dateFmt,
        fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize:        dateFontPx,
        fontWeight:      ms.dateLabelFontWeight,
        fill:            ms.dateLabelColor,
        textAnchor:      'middle',
        dominantBaseline:'alphabetic',
      });
    }

    // Title label below
    const tBox = titleLabelByIdx.get(idx);
    if (ms.titleLabelBelow && tBox) {
      primitives.push({
        kind:            'text',
        x:               rhu(tBox.x + tBox.width / 2),
        y:               rhu(tBox.y + titleFontPx),
        text:            mil.label,
        fontFamily:      `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize:        titleFontPx,
        fontWeight:      ms.titleLabelFontWeight,
        fill:            ms.titleLabelColor,
        textAnchor:      'middle',
        dominantBaseline:'alphabetic',
      });
    }
  });

  return {
    width:      W,
    height:     H,
    background: cv.backgroundColor,
    primitives,
  };
}
