/**
 * @file layout/horizontal.ts — Deterministic six-phase horizontal layout engine.
 *
 * `layoutHorizontal(ir, theme)` implements the pipeline defined in §5.4 for the
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
import { truncateText } from '../text-wrap.js';
import { getIcon } from '../icons.js';
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
// Compact date format for milestone label blocks ("Month Year", no day)
// ---------------------------------------------------------------------------

/**
 * Format a concrete date as a compact milestone block label: "May 2021",
 * "February 2023", etc.  Omits the day ordinal to reduce label noise.
 * Deterministic: no locale queries.
 */
function formatCompactDate(year: number, month: number): string {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${MONTHS[month - 1] ?? ''} ${year}`;
}

// ---------------------------------------------------------------------------
// Contrast-aware text colour (WCAG relative-luminance, deterministic)
// ---------------------------------------------------------------------------

/**
 * Return `lightText` or `darkText` depending on whether `hexFill` is a
 * dark or light colour.  Uses the WCAG 2.1 relative-luminance formula so
 * the choice is byte-deterministic across all platforms.
 */
function contrastColor(hexFill: string, lightText: string, darkText: string): string {
  const clean = hexFill.replace('#', '');
  if (clean.length !== 6) return darkText;
  const r8 = parseInt(clean.slice(0, 2), 16);
  const g8 = parseInt(clean.slice(2, 4), 16);
  const b8 = parseInt(clean.slice(4, 6), 16);
  const lin = (c8: number): number => {
    const c = c8 / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(r8) + 0.7152 * lin(g8) + 0.0722 * lin(b8);
  // WCAG §1.4.3 threshold — above this luminance dark text is legible
  return L > 0.179 ? darkText : lightText;
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

export function layoutHorizontal(ir: IRDocument, theme: ResolvedTheme): Scene {
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

  // ── Shared font-family string ─────────────────────────────────────────────
  const FONT_FAM = `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`;

  // ── Header block (title / subtitle / meta-line) geometry ─────────────────
  // Reserve vertical space above the axis so the header never overlaps content.
  const HEADER_V_PAD   = 12;
  const hdrTitlePx     = ptToPx(theme.typography.fontSizeTitle);
  const hdrSubtitlePx  = ptToPx(theme.typography.fontSizeSubtitle);
  const hdrMetaFontPx  = ptToPx(Math.max(theme.typography.fontSizeAxis - 1, 7));

  let headerH = 0;
  if (ir.metadata.title) {
    headerH += HEADER_V_PAD + rhuInt(hdrTitlePx * 1.4);
    if (ir.metadata.subtitle) headerH += 4 + rhuInt(hdrSubtitlePx * 1.35);
    const hasMetaLine = !!(ir.metadata.author || ir.metadata.updated || ir.metadata.created);
    if (hasMetaLine) headerH += 4 + rhuInt(hdrMetaFontPx * 1.35);
    headerH += HEADER_V_PAD;
  }

  /** Effective top-of-canvas margin including the header block. */
  const mT_eff = mT + headerH;

  const axisState: AxisState = { tsOrd, teOrd, offset, wDraw };

  // 1d. Enumerate ticks
  const ticks = enumTicks(tsOrd, teOrd, axisUnit);

  // -------------------------------------------------------------------------
  // Phase 1.5: Milestone x-space geometry — decluttering + side assignment
  //            (must precede Phase 2 so aboveZoneH can shift track Y-start)
  // -------------------------------------------------------------------------

  // Effective milestone layout tokens (apply defaults for optional tokens)
  const minNodeGap_eff  = ms.minNodeGap  ?? (2 * ms.size + 6);
  const leaderColor_eff = ms.leaderColor ?? ms.dateLabelColor;
  const leaderWidth_eff = ms.leaderWidth ?? 0.75;
  const blockTierGap_eff = ms.blockTierGap ?? 6;

  // Font pixel sizes used for label blocks
  const titleFontPx = ptToPx(ms.titleLabelFontSize);
  const dateFontPx  = ptToPx(ms.dateLabelFontSize);
  const blockTitleH    = rhu(titleFontPx * 1.3);
  const blockDateLineH = rhu(dateFontPx * 1.3);
  const blockH         = rhu(blockTitleH + 4 + blockDateLineH);

  // Build sorted milestone list (by date ordinal, then id) — same key as Phase 4
  const msWithOrd = (ir.milestones ?? [])
    .map((m) => {
      const [y, mo, d] = coerceLeft(parseIRDate(m.date));
      return { m, ord: dateToOrdinal(y, mo, d), y, mo, d };
    })
    .filter(({ ord }) => ord >= tsOrd && ord <= teOrd);

  msWithOrd.sort((a, b) =>
    a.ord !== b.ord ? a.ord - b.ord : a.m.id.localeCompare(b.m.id),
  );

  // Compute trueX (date-accurate) and placedX (decluttered) for each milestone
  const trueXArr: number[]   = [];
  const placedXArr: number[] = [];
  {
    // Right-edge clamp: node must fit within canvas AND its label must not overflow.
    // Use the larger of the node radius and the label half-width as the right guard.
    const labelHalfW = rhu((ms.labelMaxWidth + 4) / 2);
    const rightLimit  = rhu(offset + wDraw - Math.max(ms.size, labelHalfW));
    let lastPlacedX = -Infinity;
    for (const { ord } of msWithOrd) {
      const tx = rhu(dateX(ord, axisState));
      trueXArr.push(tx);
      const rawPx =
        lastPlacedX === -Infinity ? tx : Math.max(tx, lastPlacedX + minNodeGap_eff);
      // Clamp so node + label stay within canvas
      const px = rhu(Math.min(rawPx, rightLimit));
      placedXArr.push(px);
      lastPlacedX = px;
    }
    // Backward pass: right-edge clamping can collapse multiple nodes to the same x.
    // Walk right-to-left ensuring each node is at least minNodeGap_eff from its right neighbour.
    for (let i = placedXArr.length - 2; i >= 0; i--) {
      const want = placedXArr[i + 1]! - minNodeGap_eff;
      if (placedXArr[i]! > want) placedXArr[i] = rhu(want);
    }
  }

  // Block info per milestone (x-space only — yCenter filled in Phase 4)
  interface BlockInfo {
    msIdx:       number;
    xCenter:     number;
    trueX:       number;
    side:        'above' | 'below';
    tier:        number;
    blockW:      number;
    titleText:   string;
    compactDate: string;
  }

  const blockInfos: BlockInfo[] = [];
  for (let i = 0; i < msWithOrd.length; i++) {
    const { m: mil, y, mo } = msWithOrd[i]!;
    // Alternating sides: odd-index → above axis zone; even-index → below node.
    // Exception: untracked milestones in multi-track layouts are always above so
    // their labels don't land inside the draw area and overlap activity bars.
    const hasMultipleTracks = ir.tracks != null && ir.tracks.length > 1;
    const forceAbove = mil.track == null && hasMultipleTracks;
    const side: 'above' | 'below' = forceAbove ? 'above' : ((i % 2 === 1) ? 'above' : 'below');
    const showTitle = ms.titleLabelBelow;
    const showDate  = ms.dateLabelAbove;
    const titleText   = showTitle ? truncateText(mil.label, titleFontPx, ms.labelMaxWidth) : '';
    const compactDate = showDate  ? formatCompactDate(y, mo) : '';
    const titleW = titleText   ? measureText(titleText,   titleFontPx).width : 0;
    const dateW  = compactDate ? measureText(compactDate, dateFontPx).width  : 0;
    const blockW = rhu(Math.max(titleW, dateW) + 4);
    blockInfos.push({
      msIdx:       i,
      xCenter:     placedXArr[i]!,
      trueX:       trueXArr[i]!,
      side,
      tier:        0,
      blockW,
      titleText,
      compactDate,
    });
  }

  // Above-side tier assignment (left-to-right greedy, x-space only)
  {
    const aboveBlocks = blockInfos
      .filter((b) => b.side === 'above')
      .sort((a, b) => a.xCenter !== b.xCenter ? a.xCenter - b.xCenter : a.msIdx - b.msIdx);
    const tierEndX: number[] = [];
    for (const b of aboveBlocks) {
      const bL = rhu(b.xCenter - b.blockW / 2);
      const bR = rhu(b.xCenter + b.blockW / 2);
      let t = tierEndX.findIndex((ex) => ex + 2 <= bL);
      if (t === -1) { tierEndX.push(-Infinity); t = tierEndX.length - 1; }
      tierEndX[t] = bR;
      b.tier = t;
    }
  }

  // Below-side tier assignment (left-to-right greedy, x-space only)
  {
    const belowBlocks = blockInfos
      .filter((b) => b.side === 'below')
      .sort((a, b) => a.xCenter !== b.xCenter ? a.xCenter - b.xCenter : a.msIdx - b.msIdx);
    const tierEndX: number[] = [];
    for (const b of belowBlocks) {
      const bL = rhu(b.xCenter - b.blockW / 2);
      const bR = rhu(b.xCenter + b.blockW / 2);
      let t = tierEndX.findIndex((ex) => ex + 2 <= bL);
      if (t === -1) { tierEndX.push(-Infinity); t = tierEndX.length - 1; }
      tierEndX[t] = bR;
      b.tier = t;
    }
  }

  const maxAboveTier = blockInfos
    .filter((b) => b.side === 'above')
    .reduce((mx, b) => Math.max(mx, b.tier), -1);

  // aboveZoneH: extra vertical space inserted between the axis line and the first
  // track row to accommodate "above" label blocks — keeps them cleanly separated
  // from the axis tick labels (which live above the axis line in the Haxis zone).
  const aboveZoneH = maxAboveTier >= 0
    ? rhu((maxAboveTier + 1) * (blockH + blockTierGap_eff) + ms.labelGapPx + 6)
    : 0;

  // -------------------------------------------------------------------------
  // Phase 2: Track placement
  // -------------------------------------------------------------------------

  interface TrackLayout {
    track:  Track;
    yTop:   number;
    height: number; // provisional; may expand in Phase 3
  }

  let yCursor = mT_eff + Haxis + aboveZoneH;
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
  let yCursor3 = mT_eff + Haxis + aboveZoneH;
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
  // Phase 4: Milestone y-space geometry
  // -------------------------------------------------------------------------

  interface MilestoneLayout {
    milestone:   Milestone;
    trueX:       number;
    xCenter:     number;
    yCenter:     number;
    ordinal:     number;
    side:        'above' | 'below';
    tier:        number;
    blockW:      number;
    titleText:   string;
    compactDate: string;
  }

  const milestoneLayouts: MilestoneLayout[] = msWithOrd.map(({ m: mil }, idx) => {
    const tl = mil.track ? trackIndex.get(mil.track) : undefined;
    const yCenter = tl
      ? rhu(tl.yTop + tl.height / 2)
      : rhu(mT_eff + Haxis + aboveZoneH + hDraw / 2);
    const bi = blockInfos[idx]!;
    return {
      milestone:   mil,
      trueX:       bi.trueX,
      xCenter:     bi.xCenter,
      yCenter,
      ordinal:     idx + 1,
      side:        bi.side,
      tier:        bi.tier,
      blockW:      bi.blockW,
      titleText:   bi.titleText,
      compactDate: bi.compactDate,
    };
  });

  // -------------------------------------------------------------------------
  // Phase 5: Sections and annotations
  // -------------------------------------------------------------------------

  const sections = ir.sections ?? [];
  const annotations = ir.annotations ?? [];
  const todayMarkerAnnotation = annotations.find((a) => a.type === 'today-marker');
  const periodBracketAnnotations = annotations.filter((a) => a.type === 'period' || a.type === 'bracket');
  const calloutNoteAnnotations = annotations.filter((a) => a.type === 'callout' || a.type === 'note');

  // -------------------------------------------------------------------------
  // Canvas height — grows to accommodate below-side label blocks + legend
  // -------------------------------------------------------------------------

  // axisY is the y coordinate of the axis line
  const axisY_early = rhu(mT_eff + Haxis);
  const aboveZoneBottomY = rhu(axisY_early + aboveZoneH);
  const contentBottomY   = rhu(aboveZoneBottomY + hDraw);

  // Find the deepest below-block extent
  let belowMaxY = contentBottomY;
  for (const ml of milestoneLayouts) {
    if (ml.side === 'below' && (ml.titleText || ml.compactDate)) {
      const blockBottom = rhu(
        ml.yCenter + ms.size + ms.labelGapPx + (ml.tier + 1) * (blockH + blockTierGap_eff),
      );
      if (blockBottom > belowMaxY) belowMaxY = blockBottom;
    }
  }

  // Pre-compute legend height so the canvas can accommodate the legend below the
  // milestone-label zone (the old formula placed the legend INSIDE that zone,
  // causing legend labels to overlap with milestone/activity labels).
  const lgMargin = 16;
  const lgPreH = (() => {
    const shouldRender = (() => {
      if (!ir.legend) {
        const s = new Set<string>();
        for (const a of ir.activities ?? []) { if (a.status) s.add(a.status); }
        for (const mil of ir.milestones ?? []) { if (mil.status) s.add(mil.status); }
        return s.size > 1;
      }
      return ir.legend.show !== false;
    })();
    if (!shouldRender) return 0;
    const lg = theme.legend;
    if (!lg.position.includes('bottom')) return 0;
    const lgFontPx  = ptToPx(lg.labelFontSize);
    const lgTitlePx = ptToPx(lg.titleFontSize);
    const ROW_H = Math.max(lg.swatchSize, lgFontPx * 1.2);
    const titleH = lgTitlePx * 1.4 + lg.titleBottomGap;
    let nEntries = 0;
    if (ir.legend?.entries?.length) {
      nEntries = ir.legend.entries.length;
    } else {
      const seenS = new Set<string>(); const seenC = new Set<string>();
      for (const a of ir.activities ?? []) {
        if (a.status) seenS.add(a.status);
        if (a.category) seenC.add(a.category);
      }
      for (const mil of ir.milestones ?? []) {
        if (mil.status) seenS.add(mil.status);
        if (mil.category) seenC.add(mil.category);
      }
      for (const s of seenS) { if (theme.statusMap[s as keyof typeof theme.statusMap]) nEntries++; }
      for (const c of seenC) { if (theme.categoryMap[c]) nEntries++; }
    }
    if (nEntries === 0) return 0;
    return lg.padding * 2 + titleH + nEntries * (ROW_H + lg.rowGap) - lg.rowGap;
  })();

  const H = rhu(belowMaxY + m.bottom + (lgPreH > 0 ? lgPreH + lgMargin : 0));

  // -------------------------------------------------------------------------
  // Build Scene primitives (painter's algorithm: back → front)
  // -------------------------------------------------------------------------

  const primitives: ScenePrimitive[] = [];

  // 1. Background
  primitives.push({ kind: 'rect', x: 0, y: 0, width: W, height: H, fill: cv.backgroundColor });

  // SECTIONS: background bands (back → front, before all content)
  if (sections.length > 0) {
    sections.forEach((sec, si) => {
      const sStart = sec.time_range?.start ?? trStart;
      const sEnd   = sec.time_range?.end ?? trEnd;
      let xBandLeft: number;
      let xBandRight: number;
      try {
        xBandLeft  = rhu(dateX(parseAndCoerceLeft(sStart), axisState));
        xBandRight = rhu(dateX(parseAndCoerceRight(sEnd), axisState));
      } catch {
        return;
      }
      const bw = Math.max(0, xBandRight - xBandLeft);
      if (bw <= 0) return;

      const isEven = si % 2 === 0;
      const fill = isEven ? theme.section.bandFillEven : theme.section.bandFillOdd;
      const opacity = isEven ? theme.section.bandOpacityEven : theme.section.bandOpacityOdd;

      if (opacity > 0) {
        primitives.push({
          kind:    'rect',
          x:       xBandLeft,
          y:       rhu(mT_eff + Haxis + aboveZoneH),
          width:   bw,
          height:  rhu(hDraw),
          fill,
          opacity: rhu(opacity),
        });
      }

      const secFontPx = ptToPx(theme.section.labelFontSize);
      // Truncate to canvas right edge so label never overflows the canvas.
      const secAvailW = Math.max(24, W - mR - (xBandLeft + 4));
      const secText   = truncateText(sec.label, secFontPx, secAvailW);
      if (secText) {
        primitives.push({
          kind:             'text',
          x:                rhu(xBandLeft + 4),
          y:                rhu(mT_eff + Haxis + aboveZoneH + 4 + secFontPx),
          text:             secText,
          fontFamily:       `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
          fontSize:         secFontPx,
          fontWeight:       theme.section.labelFontWeight,
          fill:             theme.section.labelColor,
          textAnchor:       'start',
          dominantBaseline: 'alphabetic',
          opacity:          rhu(theme.section.labelOpacity),
        });
      }
    });
  }

  // 2. Header block — title / subtitle / meta-line (themed typography, reserved space)
  if (ir.metadata.title) {
    let hdrCursorY = mT + HEADER_V_PAD;

    // Primary title
    primitives.push({
      kind:             'text',
      x:                rhu(W / 2),
      y:                rhu(hdrCursorY + hdrTitlePx),
      text:             ir.metadata.title,
      fontFamily:       FONT_FAM,
      fontSize:         hdrTitlePx,
      fontWeight:       theme.typography.fontWeightHeader,
      fill:             theme.typography.titleColor,
      textAnchor:       'middle',
      dominantBaseline: 'alphabetic',
    });
    hdrCursorY += rhuInt(hdrTitlePx * 1.4);

    // Subtitle (if present)
    if (ir.metadata.subtitle) {
      hdrCursorY += 4;
      primitives.push({
        kind:             'text',
        x:                rhu(W / 2),
        y:                rhu(hdrCursorY + hdrSubtitlePx),
        text:             ir.metadata.subtitle,
        fontFamily:       FONT_FAM,
        fontSize:         hdrSubtitlePx,
        fontWeight:       theme.typography.fontWeightAxis,
        fill:             theme.typography.titleColor,
        textAnchor:       'middle',
        dominantBaseline: 'alphabetic',
        opacity:          0.75,
      });
      hdrCursorY += rhuInt(hdrSubtitlePx * 1.35);
    }

    // Author / date meta-line (if any metadata present)
    const metaParts: string[] = [];
    if (ir.metadata.author) metaParts.push(ir.metadata.author);
    if (ir.metadata.updated)      metaParts.push(`Updated: ${ir.metadata.updated}`);
    else if (ir.metadata.created) metaParts.push(`Created: ${ir.metadata.created}`);

    if (metaParts.length > 0) {
      hdrCursorY += 4;
      primitives.push({
        kind:             'text',
        x:                rhu(W / 2),
        y:                rhu(hdrCursorY + hdrMetaFontPx),
        text:             metaParts.join(' · '),
        fontFamily:       FONT_FAM,
        fontSize:         hdrMetaFontPx,
        fontWeight:       theme.typography.fontWeightAxis,
        fill:             theme.typography.titleColor,
        textAnchor:       'middle',
        dominantBaseline: 'alphabetic',
        opacity:          0.6,
      });
    }

    // Subtle separator line between header and axis zone
    primitives.push({
      kind:        'line',
      x1:          rhu(offset),
      y1:          rhu(mT_eff - 6),
      x2:          rhu(offset + wDraw),
      y2:          rhu(mT_eff - 6),
      stroke:      theme.axis.axisLineColor,
      strokeWidth: 0.5,
      opacity:     0.35,
    });
  }

  // 3. Axis band (horizontal line at bottom of axis zone)
  const axisY = rhu(mT_eff + Haxis);
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
        y2:          rhu(mT_eff + Haxis + aboveZoneH + hDraw),
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
      // Clamp tick-label x so its bbox stays within the canvas (textAnchor='middle').
      const labelHalfW = measureText(label, axisFontPx).width / 2;
      const clampedX   = rhu(Math.max(labelHalfW, Math.min(W - labelHalfW, xk)));
      primitives.push({
        kind:            'text',
        x:               clampedX,
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

  // TODAY MARKER annotation (if present, or if metadata.today is set + axis.todayMarker.enabled)
  const todayDate = todayMarkerAnnotation?.date ?? ir.metadata.today;
  const todayMarkerEnabled = !!todayDate && (theme.axis.todayMarker.enabled || !!todayMarkerAnnotation);

  if (todayMarkerEnabled && todayDate) {
    try {
      const todayOrd = parseAndCoerceLeft(todayDate);
      if (todayOrd >= tsOrd && todayOrd <= teOrd) {
        const xToday = rhu(dateX(todayOrd, axisState));
        const todayY1 = rhu(mT_eff + Haxis + aboveZoneH);
        const todayY2 = rhu(mT_eff + Haxis + aboveZoneH + hDraw);
        primitives.push({
          kind:        'line',
          x1:          xToday,
          y1:          todayY1,
          x2:          xToday,
          y2:          todayY2,
          stroke:      theme.axis.todayMarker.color,
          strokeWidth: theme.axis.todayMarker.width,
          dashArray:   theme.axis.todayMarker.style === 'dashed' ? '6,4' : undefined,
          opacity:     0.85,
        });
        const todayFontPx = ptToPx(theme.typography.fontSizeAxis - 1);
        primitives.push({
          kind:             'text',
          x:                rhu(xToday + 3),
          y:                rhu(todayY1 + 4 + todayFontPx),
          text:             todayMarkerAnnotation?.text ?? 'Today',
          fontFamily:       `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
          fontSize:         todayFontPx,
          fontWeight:       600,
          fill:             theme.axis.todayMarker.color,
          textAnchor:       'start',
          dominantBaseline: 'alphabetic',
          opacity:          0.9,
        });
      }
    } catch {
      // skip if date parse fails
    }
  }

  // PERIOD/BRACKET annotations
  for (const ann of periodBracketAnnotations) {
    const aStart = ann.start ?? ann.date;
    const aEnd   = ann.end ?? ann.date;
    if (!aStart || !aEnd) continue;
    try {
      const xL = rhu(dateX(parseAndCoerceLeft(aStart), axisState));
      const xR = rhu(dateX(parseAndCoerceRight(aEnd), axisState));
      if (xR <= xL) continue;
      const bracketY = rhu(mT_eff + Haxis + aboveZoneH + hDraw + 12);
      const bracketColor = theme.axis.todayMarker.color;
      primitives.push({
        kind: 'line', x1: xL, y1: bracketY, x2: xR, y2: bracketY,
        stroke: bracketColor, strokeWidth: 1.5, opacity: 0.7,
      });
      for (const tx of [xL, xR]) {
        primitives.push({
          kind: 'line', x1: tx, y1: rhu(bracketY - 4), x2: tx, y2: rhu(bracketY + 4),
          stroke: bracketColor, strokeWidth: 1.5, opacity: 0.7,
        });
      }
      if (ann.text ?? ann.label) {
        const bFontPx = ptToPx(theme.typography.fontSizeAxis - 1);
        primitives.push({
          kind: 'text',
          x: rhu((xL + xR) / 2),
          y: rhu(bracketY + 4 + bFontPx),
          text: ann.text ?? ann.label ?? '',
          fontFamily: `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
          fontSize: bFontPx,
          fontWeight: 400,
          fill: bracketColor,
          textAnchor: 'middle',
          dominantBaseline: 'alphabetic',
          opacity: 0.75,
        });
      }
    } catch {
      // skip
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

    // Activity label — contrast-aware, left-aligned inside / clamped outside
    {
      const LPAD = 4; // inside padding px (matches existing width - 8 budget)
      const labelFullWidth = measureText(al.activity.label, actFontPx).width;
      const insideAvail    = rhu(al.width - 2 * LPAD);
      const barMidY        = rhu(al.y + theme.activity.barHeight / 2);
      // Contrast-aware text colour for inside placement
      const insideColor = contrastColor(
        fill,
        theme.activity.labelColorInside,
        theme.activity.labelColorOutside,
      );

      if (labelFullWidth <= insideAvail && insideAvail > 0) {
        // Full label fits without truncation — left-aligned, contrast-aware
        primitives.push({
          kind:             'text',
          x:                rhu(al.xLeft + LPAD),
          y:                barMidY,
          text:             al.activity.label,
          fontFamily:       `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
          fontSize:         actFontPx,
          fontWeight:       theme.typography.fontWeightLabel,
          fill:             insideColor,
          textAnchor:       'start',
          dominantBaseline: 'middle',
        });
      } else if (insideAvail >= theme.activity.labelInsideMinWidth) {
        // Bar wide enough — truncate to fit and render inside
        const truncated = truncateText(al.activity.label, actFontPx, insideAvail);
        primitives.push({
          kind:             'text',
          x:                rhu(al.xLeft + LPAD),
          y:                barMidY,
          text:             truncated,
          fontFamily:       `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
          fontSize:         actFontPx,
          fontWeight:       theme.typography.fontWeightLabel,
          fill:             insideColor,
          textAnchor:       'start',
          dominantBaseline: 'middle',
        });
      } else {
        // Bar too narrow — place outside right, fall back to left
        const OUTSIDE_MIN = 20;
        const rightAvail = rhu(offset + wDraw - al.xRight - 8);
        const leftAvail  = rhu(al.xLeft - offset - 4);

        if (rightAvail >= OUTSIDE_MIN) {
          primitives.push({
            kind:             'text',
            x:                rhu(al.xRight + 4),
            y:                barMidY,
            text:             truncateText(al.activity.label, actFontPx, rightAvail),
            fontFamily:       `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
            fontSize:         actFontPx,
            fontWeight:       theme.typography.fontWeightLabel,
            fill:             theme.activity.labelColorOutside,
            textAnchor:       'start',
            dominantBaseline: 'middle',
          });
        } else if (leftAvail >= OUTSIDE_MIN) {
          primitives.push({
            kind:             'text',
            x:                rhu(al.xLeft - 4),
            y:                barMidY,
            text:             truncateText(al.activity.label, actFontPx, leftAvail),
            fontFamily:       `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
            fontSize:         actFontPx,
            fontWeight:       theme.typography.fontWeightLabel,
            fill:             theme.activity.labelColorOutside,
            textAnchor:       'end',
            dominantBaseline: 'middle',
          });
        }
        // Neither side has room (extreme edge case) — skip label silently
      }
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

  // 7. Milestones — decluttered nodes + leader ticks + alternating label blocks
  const ordFontPx = ptToPx(ms.ordinalFontSize);
  // axisY is defined below at section 3; use the same computed value here
  const axisY_ms          = axisY_early;  // alias
  const aboveZoneBottom_ms = rhu(axisY_ms + aboveZoneH);

  milestoneLayouts.forEach((ml) => {
    const { xCenter, yCenter, trueX, side, tier, titleText, compactDate, ordinal } = ml;
    const mil = ml.milestone;
    const status = mil.status ?? 'planned';
    const base = theme.statusMap[status];
    const cat  = mil.category;
    const catOverride = cat ? theme.categoryMap[cat] : undefined;
    const fill = catOverride?.fill ?? base?.fill ?? '#1F497D';

    // (a) Declutter leader: show true-date anchor when node was displaced
    if (rhu(Math.abs(trueX - xCenter)) >= 1) {
      // Short tick at true date position on the axis line
      primitives.push({
        kind:        'line',
        x1:          trueX,
        y1:          rhu(axisY_ms - ax.tickHeight),
        x2:          trueX,
        y2:          rhu(axisY_ms + 4),
        stroke:      leaderColor_eff,
        strokeWidth: leaderWidth_eff,
        opacity:     0.45,
      });
      // Dotted horizontal bridge from true position to placed position
      primitives.push({
        kind:        'line',
        x1:          trueX,
        y1:          axisY_ms,
        x2:          xCenter,
        y2:          axisY_ms,
        stroke:      leaderColor_eff,
        strokeWidth: leaderWidth_eff,
        opacity:     0.25,
        dashArray:   '2,3',
      });
    }

    // (b) Leader line from node edge to label block
    const hasBlock = !!(titleText || compactDate);
    if (hasBlock) {
      if (side === 'above') {
        const blockBottom = rhu(aboveZoneBottom_ms - 6 - tier * (blockH + blockTierGap_eff));
        primitives.push({
          kind:        'line',
          x1:          xCenter,
          y1:          blockBottom,
          x2:          xCenter,
          y2:          rhu(yCenter - ms.size),
          stroke:      leaderColor_eff,
          strokeWidth: leaderWidth_eff,
          opacity:     0.45,
        });
      } else {
        const blockTop = rhu(yCenter + ms.size + ms.labelGapPx + tier * (blockH + blockTierGap_eff));
        primitives.push({
          kind:        'line',
          x1:          xCenter,
          y1:          rhu(yCenter + ms.size),
          x2:          xCenter,
          y2:          blockTop,
          stroke:      leaderColor_eff,
          strokeWidth: leaderWidth_eff,
          opacity:     0.45,
        });
      }
    }

    // (c) Node shape
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

    // (d) Ordinal number OR icon inside the node marker
    {
      const iconName = mil.icon ? mil.icon.toLowerCase().trim() : undefined;
      const iconDef  = iconName ? getIcon(iconName) : undefined;

      if (iconDef) {
        const iconScale = ms.iconScale ?? 0.65;
        const s = rhu(ms.size * iconScale / 12, 4);
        const iconColor = ms.iconColor ?? ms.ordinalColor;
        const transform = `translate(${rhu(xCenter)},${rhu(yCenter)}) scale(${s}) translate(-12,-12)`;

        for (const pathDef of iconDef.paths) {
          const iconFill   = pathDef.fill   ? iconColor : 'none';
          const iconStroke = pathDef.stroke !== false ? iconColor : undefined;
          primitives.push({
            kind:          'path',
            d:             pathDef.d,
            fill:          iconFill,
            stroke:        iconStroke,
            strokeWidth:   iconStroke ? 2 : undefined,
            strokeLinecap: iconStroke ? 'round' : undefined,
            transform,
          });
        }
      } else if (ms.showOrdinalNumber) {
        const numStr = String(ordinal).padStart(2, '0');
        primitives.push({
          kind:             'text',
          x:                xCenter,
          y:                yCenter,
          text:             numStr,
          fontFamily:       FONT_FAM,
          fontSize:         ordFontPx,
          fontWeight:       ms.ordinalFontWeight,
          fill:             ms.ordinalColor,
          textAnchor:       'middle',
          dominantBaseline: 'middle',
        });
      }
    }

    // (e) Combined label block: primary title line + secondary compact-date line
    if (hasBlock) {
      let blockTopY: number;
      if (side === 'above') {
        const blockBottom = rhu(aboveZoneBottom_ms - 6 - tier * (blockH + blockTierGap_eff));
        blockTopY = rhu(blockBottom - blockH);
      } else {
        blockTopY = rhu(yCenter + ms.size + ms.labelGapPx + tier * (blockH + blockTierGap_eff));
      }

      if (titleText) {
        primitives.push({
          kind:             'text',
          x:                xCenter,
          y:                rhu(blockTopY + blockTitleH * 0.85),
          text:             titleText,
          fontFamily:       FONT_FAM,
          fontSize:         titleFontPx,
          fontWeight:       ms.titleLabelFontWeight,
          fill:             ms.titleLabelColor,
          textAnchor:       'middle',
          dominantBaseline: 'alphabetic',
        });
      }

      if (compactDate) {
        primitives.push({
          kind:             'text',
          x:                xCenter,
          y:                rhu(blockTopY + blockTitleH + 4 + dateFontPx * 0.85),
          text:             compactDate,
          fontFamily:       FONT_FAM,
          fontSize:         dateFontPx,
          fontWeight:       ms.dateLabelFontWeight,
          fill:             ms.dateLabelColor,
          textAnchor:       'middle',
          dominantBaseline: 'alphabetic',
        });
      }
    }
  });

  // CALLOUT / NOTE annotations
  for (const ann of calloutNoteAnnotations) {
    const aDate = ann.date;
    if (!aDate) continue;
    try {
      const annOrd = parseAndCoerceLeft(aDate);
      if (annOrd < tsOrd || annOrd > teOrd) continue;
      const xAnn = rhu(dateX(annOrd, axisState));
      const targetActivity = ann.target ? activityLayouts.find((al) => al.activity.id === ann.target) : undefined;
      const targetMilestone = ann.target ? milestoneLayouts.find((ml) => ml.milestone.id === ann.target) : undefined;
      const anchorY = targetActivity
        ? rhu(targetActivity.y + theme.activity.barHeight / 2)
        : targetMilestone
          ? targetMilestone.yCenter
          : rhu(mT_eff + Haxis + aboveZoneH + hDraw / 2);

      const calloutW = 120;
      const calloutH = 28;
      const pos = ann.position ?? 'above';
      const boxY = pos === 'above'
        ? rhu(anchorY - calloutH - 10)
        : rhu(anchorY + 10);
      const boxX = rhu(xAnn - calloutW / 2);

      primitives.push({
        kind: 'line',
        x1: xAnn, y1: pos === 'above' ? rhu(boxY + calloutH) : anchorY,
        x2: xAnn, y2: pos === 'above' ? anchorY : boxY,
        stroke: theme.axis.tickLabelColor, strokeWidth: 1, opacity: 0.5, dashArray: '3,3',
      });
      primitives.push({
        kind: 'rect',
        x: boxX, y: boxY, width: calloutW, height: calloutH,
        fill: theme.canvas.backgroundColor,
        stroke: theme.axis.todayMarker.color, strokeWidth: 1,
        rx: 3, opacity: 0.92,
      });
      if (ann.text ?? ann.label) {
        const cFontPx = ptToPx(theme.typography.fontSizeAxis - 1);
        primitives.push({
          kind: 'text',
          x: rhu(boxX + calloutW / 2),
          y: rhu(boxY + calloutH / 2),
          text: ann.text ?? ann.label ?? '',
          fontFamily: `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
          fontSize: cFontPx,
          fontWeight: 400,
          fill: theme.axis.tickLabelColor,
          textAnchor: 'middle',
          dominantBaseline: 'middle',
        });
      }
    } catch {
      // skip
    }
  }

  // LEGEND BLOCK
  const shouldRenderLegend = (() => {
    if (!ir.legend) {
      const usedStatuses = new Set<string>();
      for (const a of ir.activities ?? []) {
        if (a.status) usedStatuses.add(a.status);
      }
      for (const mil of ir.milestones ?? []) {
        if (mil.status) usedStatuses.add(mil.status);
      }
      return usedStatuses.size > 1;
    }
    return ir.legend.show !== false;
  })();

  if (shouldRenderLegend) {
    const lg = theme.legend;
    const lgFontPx = ptToPx(lg.labelFontSize);
    const lgTitlePx = ptToPx(lg.titleFontSize);
    const ROW_H = Math.max(lg.swatchSize, lgFontPx * 1.2);

    const entries: Array<{ label: string; fill: string }> = [];
    if (ir.legend?.entries && ir.legend.entries.length > 0) {
      for (const e of ir.legend.entries) {
        const cat = theme.categoryMap[e.key];
        const st = theme.statusMap[e.key as keyof typeof theme.statusMap];
        const fill = cat?.fill ?? st?.fill ?? '#888888';
        entries.push({ label: e.label, fill });
      }
    } else {
      const usedStatuses: string[] = [];
      const usedCategories: string[] = [];
      const seenS = new Set<string>();
      const seenC = new Set<string>();
      for (const a of ir.activities ?? []) {
        if (a.status && !seenS.has(a.status)) {
          seenS.add(a.status);
          usedStatuses.push(a.status);
        }
        if (a.category && !seenC.has(a.category)) {
          seenC.add(a.category);
          usedCategories.push(a.category);
        }
      }
      for (const mil of ir.milestones ?? []) {
        if (mil.status && !seenS.has(mil.status)) {
          seenS.add(mil.status);
          usedStatuses.push(mil.status);
        }
        if (mil.category && !seenC.has(mil.category)) {
          seenC.add(mil.category);
          usedCategories.push(mil.category);
        }
      }
      for (const s of usedStatuses) {
        const st = theme.statusMap[s as keyof typeof theme.statusMap];
        if (st) entries.push({ label: s, fill: st.fill });
      }
      for (const c of usedCategories) {
        const cat = theme.categoryMap[c];
        if (cat) entries.push({ label: c, fill: cat.fill });
      }
    }

    if (entries.length > 0) {
      const titleText = ir.legend?.title ?? 'Legend';
      const titleH = lgTitlePx * 1.4 + lg.titleBottomGap;
      const lgH = lg.padding * 2 + titleH + entries.length * (ROW_H + lg.rowGap) - lg.rowGap;
      const lgW = lg.maxWidth;
      const pos = lg.position;
      const margin = 16;
      const lgX = pos.includes('right') ? W - mR - lgW - margin : mL + margin;
      // Place legend below the milestone-label zone so it never overlaps with
      // activity or milestone labels.  The canvas height already accounts for lgH.
      const lgY = pos.includes('bottom') ? rhu(belowMaxY + margin) : rhu(mT_eff + margin);

      primitives.push({
        kind: 'rect', x: rhu(lgX), y: rhu(lgY), width: lgW, height: rhu(lgH),
        fill: lg.backgroundColor, stroke: lg.borderColor, strokeWidth: lg.borderWidth,
        rx: 4, opacity: 0.95,
      });

      primitives.push({
        kind: 'text',
        x: rhu(lgX + lg.padding),
        y: rhu(lgY + lg.padding + lgTitlePx),
        text: titleText,
        fontFamily: `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
        fontSize: lgTitlePx,
        fontWeight: lg.titleFontWeight,
        fill: lg.titleColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
      });

      let rowY = rhu(lgY + lg.padding + titleH);
      for (const e of entries) {
        const swatchCY = rhu(rowY + ROW_H / 2);
        primitives.push({
          kind: 'rect',
          x: rhu(lgX + lg.padding),
          y: rhu(rowY + (ROW_H - lg.swatchSize) / 2),
          width: lg.swatchSize, height: lg.swatchSize,
          fill: e.fill, rx: lg.swatchRadius,
        });
        primitives.push({
          kind: 'text',
          x: rhu(lgX + lg.padding + lg.swatchSize + lg.swatchLabelGap),
          y: rhu(swatchCY),
          text: truncateText(e.label, lgFontPx, lgW - lg.padding * 2 - lg.swatchSize - lg.swatchLabelGap - 4),
          fontFamily: `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`,
          fontSize: lgFontPx,
          fontWeight: lg.labelFontWeight,
          fill: lg.labelColor,
          textAnchor: 'start',
          dominantBaseline: 'middle',
        });
        rowY = rhu(rowY + ROW_H + lg.rowGap);
      }
    }
  }

  return {
    width:      W,
    height:     H,
    background: cv.backgroundColor,
    primitives,
  };
}
