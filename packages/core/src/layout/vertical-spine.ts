/**
 * @file layout/vertical-spine.ts — Deterministic VERTICAL CENTRAL-SPINE layout engine.
 *
 * `layoutVerticalSpine(ir, theme)` implements the vertical-spine family (§5, T1/T3/T5).
 *
 * Design:
 *  - Time axis runs TOP (earliest) → BOTTOM (latest).
 *  - Central vertical SPINE LINE at canvas mid-x.
 *  - Entries (milestones + activities as dated points) sorted by (date_ordinal, id),
 *    placed on the spine at their date y-coordinate.
 *  - Alternating LEFT / RIGHT: even-index entries on the RIGHT, odd on the LEFT.
 *  - Each entry has: a NODE MARKER on the spine, a horizontal CONNECTOR, and a CONTENT BLOCK.
 *  - Content block style: 'card' (rounded rect + border) or 'plain' (text only),
 *    driven by theme.entryStyle token (additive; does not affect horizontal layouts).
 *  - Activities with real duration: vertical segment on spine from start→end.
 *  - Ongoing/TBD activities: dashed extension to spine bottom with open indicator.
 *  - Icon hints: small text-glyph placeholder (pictographic badges deferred to later).
 *
 * Determinism contract (§5.1):
 *  - round-half-up for all coordinate values (Math.floor(x + 0.5)).
 *  - No Date.now(), Math.random(), or system locale.
 *  - Stable sort: (date_ordinal, id).
 *  - Min-spacing pass is top-to-bottom sequential (deterministic).
 */

import type { IRDocument } from '../types.js';
import type { Scene, ScenePrimitive } from '../scene.js';
import type { ResolvedTheme } from '../themes/types.js';
import { ptToPx } from '../fonts/metrics.js';
import { wrapText, truncateText } from '../text-wrap.js';
import { getIcon } from '../icons.js';
import {
  dateToOrdinal,
  coerceLeft,
  coerceRight,
  parseIRDate,
  parseAndCoerceLeft,
  parseAndCoerceRight,
  formatMilestoneDate,
  inferAxisUnit,
  enumTicks,
  formatTickLabel,
} from './dates.js';

// ---------------------------------------------------------------------------
// Rounding helpers (§5.1 item 3)
// ---------------------------------------------------------------------------

function rhu(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.floor(v * f + 0.5) / f;
}

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Month abbreviations for date formatting
// ---------------------------------------------------------------------------

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ---------------------------------------------------------------------------
// Spine entry (unified milestone + activity record)
// ---------------------------------------------------------------------------

interface SpineEntry {
  id:            string;
  label:         string;
  /** Formatted date string shown in the content block. */
  dateStr:       string;
  description?:  string;
  /** Start ordinal (day since 2000-01-01 epoch). */
  ord:           number;
  /** End ordinal, if duration is known. */
  endOrd?:       number;
  /** End kind for duration rendering on spine. */
  endKind:       'fixed' | 'ongoing' | 'tbd' | 'none';
  statusFill:    string;
  statusStroke:  string;
  statusOpacity: number;
  type:          'milestone' | 'activity';
  /** Optional icon hint text (placeholder for future pictographic badges). */
  iconHint?:     string;
}

// ---------------------------------------------------------------------------
// Date string formatter (precision-aware)
// ---------------------------------------------------------------------------

function formatEntryDate(irDateStr: string): string {
  try {
    const parsed = parseIRDate(irDateStr);
    switch (parsed.precision) {
      case 'day': {
        const [y, mo, d] = coerceLeft(parsed);
        return formatMilestoneDate(y, mo, d);
      }
      case 'month':
        return `${MONTH_ABBR[(parsed.month ?? 1) - 1] ?? ''} ${parsed.year}`;
      case 'quarter':
        return `Q${parsed.quarter ?? ''} ${parsed.year}`;
      case 'half':
        return `H${parsed.half ?? ''} ${parsed.year}`;
      case 'year':
        return String(parsed.year);
    }
  } catch {
    return irDateStr;
  }
}

// ---------------------------------------------------------------------------
// Dark-background detection (for card contrast)
// ---------------------------------------------------------------------------

function isHexDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

// ---------------------------------------------------------------------------
// Layout entry point
// ---------------------------------------------------------------------------

export function layoutVerticalSpine(ir: IRDocument, theme: ResolvedTheme): Scene {
  const W  = theme.canvas.width;
  const m  = theme.canvas.margin;
  const mT = m.top;
  const mB = m.bottom;

  const entryStyle = theme.entryStyle ?? 'plain';

  // ── Spine geometry constants ──────────────────────────────────────────────
  const SPINE_X        = rhu(W / 2);
  // CONNECTOR_LEN was 48; raised to 58 to clear year-qualified tick labels ("Q1 20XX")
  // which span ~46 px from TICK_LABEL_X (SPINE_X+14), reaching x≈660 — only 2 px shy of
  // the old content-block start (x=658).  The 10 px increase gives an 8 px gap (> TIGHT_GAP)
  // and keeps BLOCK_W unchanged (min(330, W/2−58−40) = 330 for W=1200).
  const CONNECTOR_LEN  = 58;
  /** Spine node radius for this layout (smaller than horizontal milestone.size). */
  const NODE_R         = rhu(Math.min(rhu(theme.milestone.size * 0.55), 11));
  /** Content block width. */
  const BLOCK_W        = rhuInt(Math.min(330, (W / 2) - CONNECTOR_LEN - 40));
  const BLOCK_INNER_PAD = 10;
  /** Minimum vertical distance (px) between consecutive entry node centres. */
  const ENTRY_MIN_SPACING = 100;
  const SPINE_TOP_PAD    = 24;
  const SPINE_BOTTOM_PAD = 32;

  // ── Typography ────────────────────────────────────────────────────────────
  const FONT_FAM  = `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`;
  const titlePx   = ptToPx(theme.typography.fontSizeBase + 1);
  const datePx    = ptToPx(theme.typography.fontSizeAxis);
  const descPx    = ptToPx(Math.max(theme.typography.fontSizeAxis - 1, 7));
  const yearFontPx = ptToPx(Math.max(theme.typography.fontSizeAxis - 1, 7));

  const VERT_PAD     = entryStyle === 'card' ? BLOCK_INNER_PAD : 4;
  const DATE_LINE_H  = rhuInt(datePx * 1.4);
  const TITLE_LINE_H = rhuInt(titlePx * 1.5);
  const DESC_LINE_H  = rhuInt(descPx * 1.4);
  const TEXT_GAP     = 4;

  // ── Card colours (additive, only used when entryStyle === 'card') ─────────
  const isDark    = isHexDark(theme.canvas.backgroundColor);
  const cardFill  = isDark ? '#1A2E44' : '#F4F6F8';

  // ── Header block (title / subtitle / meta-line) geometry ─────────────────
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

  // ── Time range ────────────────────────────────────────────────────────────
  const trStart = ir.metadata.time_range.start;
  const trEnd   = ir.metadata.time_range.end ?? trStart;

  const [tsY, tsM, tsD] = coerceLeft(parseIRDate(trStart));
  const [teY, teM, teD] = coerceRight(parseIRDate(trEnd));
  const tsOrd = dateToOrdinal(tsY, tsM, tsD);
  const teOrd = dateToOrdinal(teY, teM, teD);

  if (teOrd < tsOrd) {
    throw new Error(`time_range end (${trEnd}) is before start (${trStart})`);
  }

  // ── Collect entries ───────────────────────────────────────────────────────

  function resolveStatusStyle(status?: string, category?: string) {
    const s = (status ?? 'planned') as keyof typeof theme.statusMap;
    const base = theme.statusMap[s] ?? theme.statusMap['planned']!;
    const cat  = category ? theme.categoryMap[category] : undefined;
    return {
      fill:    cat?.fill   ?? base.fill,
      stroke:  cat?.stroke ?? base.stroke,
      opacity: base.opacity,
    };
  }

  const entries: SpineEntry[] = [];

  // Milestones
  for (const mil of ir.milestones ?? []) {
    const [y, mo, d] = coerceLeft(parseIRDate(mil.date));
    const ord = dateToOrdinal(y, mo, d);
    if (ord < tsOrd || ord > teOrd) continue;
    const st = resolveStatusStyle(mil.status, mil.category);
    entries.push({
      id:            mil.id,
      label:         mil.label,
      dateStr:       formatEntryDate(mil.date),
      description:   mil.description,
      ord,
      endKind:       'none',
      statusFill:    st.fill,
      statusStroke:  st.stroke,
      statusOpacity: st.opacity,
      type:          'milestone',
      iconHint:      mil.icon,
    });
  }

  // Activities (placed at their start date)
  for (const act of ir.activities ?? []) {
    const startOrd = act.span
      ? parseAndCoerceLeft(act.span)
      : parseAndCoerceLeft(act.start ?? trStart);

    if (startOrd < tsOrd || startOrd > teOrd) continue;

    let endOrd: number;
    let endKind: 'fixed' | 'ongoing' | 'tbd';

    if (act.span) {
      endOrd  = parseAndCoerceRight(act.span);
      endKind = 'fixed';
    } else if (!act.end || act.end === 'ongoing') {
      endOrd  = teOrd;
      endKind = 'ongoing';
    } else if (act.end === 'tbd' || act.end === 'unknown') {
      endOrd  = teOrd;
      endKind = 'tbd';
    } else {
      endOrd  = parseAndCoerceRight(act.end);
      endKind = 'fixed';
    }

    const st = resolveStatusStyle(act.status, act.category);
    const dateIRStr = act.span ?? act.start ?? trStart;
    entries.push({
      id:            act.id,
      label:         act.label,
      dateStr:       formatEntryDate(dateIRStr),
      description:   act.description,
      ord:           startOrd,
      endOrd,
      endKind,
      statusFill:    st.fill,
      statusStroke:  st.stroke,
      statusOpacity: st.opacity,
      type:          'activity',
    });
  }

  // Deterministic sort: (date_ordinal, id)
  entries.sort((a, b) => a.ord !== b.ord ? a.ord - b.ord : a.id.localeCompare(b.id));

  const nEntries = entries.length;

  // ── Spine coordinate system ───────────────────────────────────────────────
  //
  // pixelsPerDay is calibrated so that, if entries were evenly distributed
  // across the time range, they would naturally respect ENTRY_MIN_SPACING.
  // This makes the min-spacing pass a no-op for uniformly spaced events,
  // while still correcting clusters.

  const spanDays     = Math.max(teOrd - tsOrd, 1);
  const pixelsPerDay = Math.max(
    (ENTRY_MIN_SPACING * Math.max(nEntries, 1)) / spanDays,
    0.4,
  );
  const hDraw = rhuInt(Math.max(
    spanDays * pixelsPerDay,
    nEntries > 0 ? nEntries * ENTRY_MIN_SPACING : 200,
    200,
  ));

  const spineTopY    = rhu(mT + headerH + SPINE_TOP_PAD);
  const spineBottomY = rhu(spineTopY + hDraw);

  /** Map a day ordinal to a canvas y coordinate (deterministic, analogous to dateX). */
  function dateY(ord: number): number {
    if (teOrd === tsOrd) return spineTopY;
    const raw = spineTopY + Math.floor(((ord - tsOrd) * hDraw) / (teOrd - tsOrd) + 0.5);
    return Math.max(spineTopY, Math.min(spineBottomY, raw));
  }

  // Compute raw y positions (time-proportional)
  const rawNodeYs = entries.map((e) => dateY(e.ord));

  // Minimum-spacing pass (top-to-bottom, deterministic)
  const nodeYs: number[] = [...rawNodeYs];
  for (let i = 1; i < nodeYs.length; i++) {
    const minY = (nodeYs[i - 1] ?? spineTopY) + ENTRY_MIN_SPACING;
    const cur  = nodeYs[i] ?? spineTopY;
    if (cur < minY) nodeYs[i] = rhu(minY);
  }

  // Extend spine bottom to accommodate stacked entries
  const lastNodeY          = nEntries > 0 ? (nodeYs[nEntries - 1] ?? spineBottomY) : spineBottomY;
  const finalSpineBottomY  = rhu(Math.max(spineBottomY, lastNodeY + SPINE_BOTTOM_PAD));

  // Canvas height
  const H = rhu(finalSpineBottomY + 50 + mB);

  // ── Entry block height helper ─────────────────────────────────────────────

  function blockH(e: SpineEntry): number {
    const titleWrapped = wrapText(e.label, titlePx, BLOCK_W - BLOCK_INNER_PAD * 2, 2);
    let h = VERT_PAD;
    h += DATE_LINE_H;
    h += TEXT_GAP + TITLE_LINE_H * titleWrapped.lines.length;
    if (e.description) h += TEXT_GAP + DESC_LINE_H;
    h += VERT_PAD;
    return rhuInt(h);
  }

  // ── Axis ticks ─────────────────────────────────────────────────────────────

  const vsAxisUnit = ir.metadata.axis_unit ?? inferAxisUnit(teOrd - tsOrd);
  const vsTicks = enumTicks(tsOrd, teOrd, vsAxisUnit);

  // ── Build Scene primitives (painter's algorithm: back → front) ────────────

  const primitives: ScenePrimitive[] = [];

  // 1. Background
  primitives.push({
    kind: 'rect', x: 0, y: 0, width: W, height: H,
    fill: theme.canvas.backgroundColor,
  });

  // SECTION BANDS (horizontal bands spanning full width)
  if (ir.sections && ir.sections.length > 0) {
    ir.sections.forEach((sec, si) => {
      const sStart = sec.time_range?.start ?? trStart;
      const sEnd   = sec.time_range?.end ?? trEnd;
      let yBandTop: number;
      let yBandBot: number;
      try {
        yBandTop = rhu(dateY(parseAndCoerceLeft(sStart)));
        yBandBot = rhu(dateY(parseAndCoerceRight(sEnd)));
      } catch {
        return;
      }
      const bh = Math.max(0, yBandBot - yBandTop);
      if (bh <= 0) return;

      const isEven = si % 2 === 0;
      const fill = isEven ? theme.section.bandFillEven : theme.section.bandFillOdd;
      const opacity = isEven ? theme.section.bandOpacityEven : theme.section.bandOpacityOdd;

      if (opacity > 0) {
        primitives.push({
          kind: 'rect', x: 0, y: yBandTop, width: W, height: bh,
          fill, opacity: rhu(opacity),
        });
      }

      const secFontPx = ptToPx(theme.section.labelFontSize);
      primitives.push({
        kind: 'text',
        x: rhu(m.left + 4),
        y: rhu(yBandTop + 4 + secFontPx),
        text: sec.label,
        fontFamily: FONT_FAM,
        fontSize: secFontPx,
        fontWeight: theme.section.labelFontWeight,
        fill: theme.section.labelColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
        opacity: rhu(theme.section.labelOpacity),
      });
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

    // Subtitle
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

    // Author / date meta-line
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

    // Subtle separator line
    primitives.push({
      kind:        'line',
      x1:          rhu(m.left),
      y1:          rhu(mT + headerH - 6),
      x2:          rhu(W - m.right),
      y2:          rhu(mT + headerH - 6),
      stroke:      theme.axis.axisLineColor,
      strokeWidth: 0.5,
      opacity:     0.35,
    });
  }

  // 3. Activity duration segments on the spine (drawn BEHIND spine line)
  for (let i = 0; i < entries.length; i++) {
    const entry  = entries[i]!;
    const nodeY  = nodeYs[i]!;
    if (entry.type !== 'activity' || entry.endKind === 'none') continue;

    if (entry.endKind === 'fixed' && entry.endOrd !== undefined) {
      const yEnd = rhu(Math.max(dateY(entry.endOrd), nodeY + 4));
      if (yEnd > nodeY + 4) {
        primitives.push({
          kind:    'rect',
          x:       rhu(SPINE_X - 3),
          y:       nodeY,
          width:   6,
          height:  rhu(yEnd - nodeY),
          fill:    entry.statusFill,
          opacity: rhu(entry.statusOpacity * 0.7),
        });
      }
    } else if (entry.endKind === 'ongoing') {
      primitives.push({
        kind:        'line',
        x1:          SPINE_X,
        y1:          nodeY,
        x2:          SPINE_X,
        y2:          rhu(finalSpineBottomY - 8),
        stroke:      entry.statusFill,
        strokeWidth: 5,
        opacity:     rhu(entry.statusOpacity * 0.5),
        dashArray:   '6,4',
      });
    } else if (entry.endKind === 'tbd') {
      primitives.push({
        kind:        'line',
        x1:          SPINE_X,
        y1:          nodeY,
        x2:          SPINE_X,
        y2:          rhu(finalSpineBottomY - 8),
        stroke:      entry.statusFill,
        strokeWidth: 4,
        opacity:     rhu(entry.statusOpacity * 0.4),
        dashArray:   '3,5',
      });
    }
  }

  // 4. Central spine line
  primitives.push({
    kind:        'line',
    x1:          SPINE_X,
    y1:          spineTopY,
    x2:          SPINE_X,
    y2:          finalSpineBottomY,
    stroke:      theme.axis.axisLineColor,
    strokeWidth: 2,
  });

  // 5. Axis ticks
  const TICK_W = 8;
  const TICK_LABEL_X = rhu(SPINE_X + TICK_W + 6);

  for (let ti = 0; ti < vsTicks.length; ti++) {
    const tick = vsTicks[ti]!;
    const ty = rhu(dateY(tick.ordinal));

    primitives.push({
      kind: 'line',
      x1: rhu(SPINE_X - TICK_W), y1: ty,
      x2: rhu(SPINE_X + TICK_W), y2: ty,
      stroke: theme.axis.axisLineColor, strokeWidth: 1, opacity: 0.5,
    });

    const tickLabel = formatTickLabel(tick, vsAxisUnit, ti);
    if (tickLabel) {
      primitives.push({
        kind: 'text',
        x: TICK_LABEL_X, y: rhu(ty - 2),
        text: tickLabel,
        fontFamily: FONT_FAM,
        fontSize: yearFontPx,
        fontWeight: theme.typography.fontWeightAxis,
        fill: theme.axis.tickLabelColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
        opacity: 0.6,
      });
    }
  }

  // TODAY MARKER annotation
  const todayMarkerAnnotationVS = (ir.annotations ?? []).find((a) => a.type === 'today-marker');
  const todayDateVS = todayMarkerAnnotationVS?.date ?? ir.metadata.today;
  const todayMarkerEnabledVS = !!todayDateVS && (theme.axis.todayMarker.enabled || !!todayMarkerAnnotationVS);

  if (todayMarkerEnabledVS && todayDateVS) {
    try {
      const todayOrd = parseAndCoerceLeft(todayDateVS);
      if (todayOrd >= tsOrd && todayOrd <= teOrd) {
        const yToday = rhu(dateY(todayOrd));
        primitives.push({
          kind: 'line',
          x1: rhu(m.left), y1: yToday, x2: rhu(W - m.right), y2: yToday,
          stroke: theme.axis.todayMarker.color,
          strokeWidth: theme.axis.todayMarker.width,
          dashArray: theme.axis.todayMarker.style === 'dashed' ? '6,4' : undefined,
          opacity: 0.85,
        });
        const tFontPx = ptToPx(theme.typography.fontSizeAxis - 1);
        primitives.push({
          kind: 'text',
          x: rhu(m.left + 4),
          y: rhu(yToday - 3),
          text: todayMarkerAnnotationVS?.text ?? 'Today',
          fontFamily: FONT_FAM,
          fontSize: tFontPx,
          fontWeight: 600,
          fill: theme.axis.todayMarker.color,
          textAnchor: 'start',
          dominantBaseline: 'alphabetic',
          opacity: 0.9,
        });
      }
    } catch {
      // skip
    }
  }

  // PERIOD/BRACKET annotations (horizontal spans on vertical spine)
  for (const ann of ir.annotations ?? []) {
    if (ann.type !== 'period' && ann.type !== 'bracket') continue;
    const aStart = ann.start ?? ann.date;
    const aEnd = ann.end ?? ann.date;
    if (!aStart || !aEnd) continue;
    try {
      const yT = rhu(dateY(parseAndCoerceLeft(aStart)));
      const yB = rhu(dateY(parseAndCoerceRight(aEnd)));
      if (yB <= yT) continue;
      const periodX = rhu(W - m.right - 16);
      const periodColor = theme.axis.todayMarker.color;
      primitives.push({
        kind: 'line', x1: periodX, y1: yT, x2: periodX, y2: yB,
        stroke: periodColor, strokeWidth: 1.5, opacity: 0.7,
      });
      for (const ty of [yT, yB]) {
        primitives.push({
          kind: 'line', x1: rhu(periodX - 4), y1: ty, x2: rhu(periodX + 4), y2: ty,
          stroke: periodColor, strokeWidth: 1.5, opacity: 0.7,
        });
      }
      if (ann.text ?? ann.label) {
        const bFontPx = ptToPx(theme.section.labelFontSize);
        primitives.push({
          kind: 'text',
          x: rhu(periodX - 8),
          y: rhu((yT + yB) / 2),
          text: ann.text ?? ann.label ?? '',
          fontFamily: FONT_FAM,
          fontSize: bFontPx,
          fontWeight: 400,
          fill: periodColor,
          textAnchor: 'end',
          dominantBaseline: 'middle',
          opacity: 0.75,
        });
      }
    } catch {
      // skip
    }
  }

  // 6. Entry connectors and content blocks (behind node markers)
  for (let i = 0; i < entries.length; i++) {
    const entry  = entries[i]!;
    const nodeY  = nodeYs[i]!;
    /** Even index → right side; odd index → left side (deterministic). */
    const side   = i % 2 === 0 ? 'right' : 'left';

    // Connector line: from spine node edge to block edge
    const connXStart = side === 'right'
      ? rhu(SPINE_X + NODE_R)
      : rhu(SPINE_X - NODE_R);
    const connXEnd = side === 'right'
      ? rhu(SPINE_X + CONNECTOR_LEN)
      : rhu(SPINE_X - CONNECTOR_LEN);

    primitives.push({
      kind:        'line',
      x1:          connXStart,
      y1:          nodeY,
      x2:          connXEnd,
      y2:          nodeY,
      stroke:      entry.statusFill,
      strokeWidth: 1.5,
      opacity:     0.8,
    });

    // Content block geometry
    const bh        = blockH(entry);
    const blockTop  = rhu(nodeY - bh / 2);
    const blockLeft = side === 'right'
      ? rhu(SPINE_X + CONNECTOR_LEN)
      : rhu(SPINE_X - CONNECTOR_LEN - BLOCK_W);

    // Card background (only for card-style themes)
    if (entryStyle === 'card') {
      // Attach cardEffects if theme declares them (Skia-only; SVG ignores)
      const cardEffects = theme.effects?.cardEffects;
      primitives.push({
        kind:        'rect',
        x:           blockLeft,
        y:           blockTop,
        width:       BLOCK_W,
        height:      bh,
        fill:        cardFill,
        stroke:      entry.statusFill,
        strokeWidth: 1,
        rx:          6,
        opacity:     0.95,
        ...(cardEffects ? { effects: cardEffects } : {}),
      });
    }

    // Text anchor based on side
    const textX      = side === 'right'
      ? rhu(blockLeft + BLOCK_INNER_PAD)
      : rhu(blockLeft + BLOCK_W - BLOCK_INNER_PAD);
    const textAnchor = (side === 'right' ? 'start' : 'end') as 'start' | 'end';

    // Date label (top line in block)
    let textY = rhu(blockTop + VERT_PAD + DATE_LINE_H * 0.85);
    primitives.push({
      kind:             'text',
      x:                textX,
      y:                textY,
      text:             entry.dateStr,
      fontFamily:       FONT_FAM,
      fontSize:         datePx,
      fontWeight:       theme.milestone.dateLabelFontWeight,
      fill:             theme.milestone.dateLabelColor,
      textAnchor,
      dominantBaseline: 'alphabetic',
    });

    // Title label (second line) — with wrapping
    textY = rhu(textY + TEXT_GAP + TITLE_LINE_H);
    const titleWrapped = wrapText(entry.label, titlePx, BLOCK_W - BLOCK_INNER_PAD * 2, 2);
    if (titleWrapped.lines.length > 1) {
      primitives.push({
        kind:             'multitext',
        x:                textX,
        y:                textY,
        lines:            titleWrapped.lines,
        lineHeight:       TITLE_LINE_H,
        fontFamily:       FONT_FAM,
        fontSize:         titlePx,
        fontWeight:       theme.milestone.titleLabelFontWeight,
        fill:             theme.milestone.titleLabelColor,
        textAnchor,
        dominantBaseline: 'alphabetic',
      });
      textY = rhu(textY + (titleWrapped.lines.length - 1) * TITLE_LINE_H);
    } else {
      primitives.push({
        kind:             'text',
        x:                textX,
        y:                textY,
        text:             titleWrapped.lines[0] ?? entry.label,
        fontFamily:       FONT_FAM,
        fontSize:         titlePx,
        fontWeight:       theme.milestone.titleLabelFontWeight,
        fill:             theme.milestone.titleLabelColor,
        textAnchor,
        dominantBaseline: 'alphabetic',
      });
    }

    // Description — with truncation
    if (entry.description) {
      textY = rhu(textY + TEXT_GAP + DESC_LINE_H);
      const descTruncated = truncateText(entry.description, descPx, BLOCK_W - BLOCK_INNER_PAD * 2);
      primitives.push({
        kind:             'text',
        x:                textX,
        y:                textY,
        text:             descTruncated,
        fontFamily:       FONT_FAM,
        fontSize:         descPx,
        fontWeight:       theme.typography.fontWeightAxis,
        fill:             theme.milestone.dateLabelColor,
        textAnchor,
        dominantBaseline: 'alphabetic',
        opacity:          0.85,
      });
    }

    // Icon: render resolved icon glyph in top-right (right side) or top-left (left side) of block.
    // If the icon name doesn't resolve, fall back silently (no placeholder text).
    if (entry.iconHint) {
      const iconDef = getIcon(entry.iconHint);
      if (iconDef) {
        // Small icon badge at the top corner of the content block.
        const BADGE_R  = rhu(datePx * 0.75);
        const badgeCX  = side === 'right'
          ? rhu(blockLeft + BLOCK_W - BLOCK_INNER_PAD - BADGE_R)
          : rhu(blockLeft + BLOCK_INNER_PAD + BADGE_R);
        const badgeCY  = rhu(blockTop + VERT_PAD + DATE_LINE_H * 0.5);
        const iconScale = theme.milestone.iconScale ?? 0.65;
        const s         = rhu(BADGE_R * iconScale / 12, 4);
        const iconColor = theme.milestone.iconColor ?? theme.canvas.backgroundColor;
        const transform = `translate(${badgeCX},${badgeCY}) scale(${s}) translate(-12,-12)`;

        // Backing circle for the badge
        primitives.push({
          kind:        'circle',
          cx:          badgeCX,
          cy:          badgeCY,
          r:           BADGE_R,
          fill:        entry.statusFill,
          opacity:     0.85,
        });

        for (const pathDef of iconDef.paths) {
          const iconFill   = pathDef.fill   ? iconColor : 'none';
          const iconStroke = pathDef.stroke !== false ? iconColor : undefined;
          primitives.push({
            kind:         'path',
            d:            pathDef.d,
            fill:         iconFill,
            stroke:       iconStroke,
            strokeWidth:  iconStroke ? 2 : undefined,
            strokeLinecap: iconStroke ? 'round' : undefined,
            transform,
          });
        }
      }
      // Unknown icon hint → silent fallback (no text placeholder)
    }
  }

  // 7. Spine node markers (drawn last — on top of connectors and card edges)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const nodeY = nodeYs[i]!;
    const shape = theme.milestone.shape;
    const nr    = NODE_R;

    // Attach nodeEffects if theme declares them (Skia-only; SVG ignores)
    const nodeEffects = theme.effects?.nodeEffects;

    if (shape === 'circle') {
      primitives.push({
        kind:        'circle',
        cx:          SPINE_X,
        cy:          nodeY,
        r:           nr,
        fill:        entry.statusFill,
        stroke:      theme.canvas.backgroundColor,
        strokeWidth: 1.5,
        ...(nodeEffects ? { effects: nodeEffects } : {}),
      });
    } else if (shape === 'diamond') {
      primitives.push({
        kind:   'path',
        d:      `M ${SPINE_X} ${rhu(nodeY - nr)} L ${rhu(SPINE_X + nr)} ${nodeY} L ${SPINE_X} ${rhu(nodeY + nr)} L ${rhu(SPINE_X - nr)} ${nodeY} Z`,
        fill:        entry.statusFill,
        stroke:      theme.canvas.backgroundColor,
        strokeWidth: 1.5,
        ...(nodeEffects ? { effects: nodeEffects } : {}),
      });
    } else {
      // triangle
      primitives.push({
        kind:   'path',
        d:      `M ${rhu(SPINE_X - nr)} ${rhu(nodeY - nr)} L ${rhu(SPINE_X + nr)} ${rhu(nodeY - nr)} L ${SPINE_X} ${rhu(nodeY + nr)} Z`,
        fill:        entry.statusFill,
        stroke:      theme.canvas.backgroundColor,
        strokeWidth: 1.5,
        ...(nodeEffects ? { effects: nodeEffects } : {}),
      });
    }

    // Icon inside the spine node marker (replaces the plain coloured circle/diamond)
    if (entry.iconHint) {
      const iconDef = getIcon(entry.iconHint);
      if (iconDef) {
        const iconScale = theme.milestone.iconScale ?? 0.65;
        const s         = rhu(nr * iconScale / 12, 4);
        const iconColor = theme.milestone.iconColor ?? theme.canvas.backgroundColor;
        const transform = `translate(${SPINE_X},${nodeY}) scale(${s}) translate(-12,-12)`;

        for (const pathDef of iconDef.paths) {
          const iconFill   = pathDef.fill   ? iconColor : 'none';
          const iconStroke = pathDef.stroke !== false ? iconColor : undefined;
          primitives.push({
            kind:         'path',
            d:            pathDef.d,
            fill:         iconFill,
            stroke:       iconStroke,
            strokeWidth:  iconStroke ? 2 : undefined,
            strokeLinecap: iconStroke ? 'round' : undefined,
            transform,
          });
        }
      }
    }
  }

  // CALLOUT / NOTE annotations
  for (const ann of ir.annotations ?? []) {
    if (ann.type !== 'callout' && ann.type !== 'note') continue;
    const aDate = ann.date;
    if (!aDate) continue;
    try {
      const annOrd = parseAndCoerceLeft(aDate);
      if (annOrd < tsOrd || annOrd > teOrd) continue;
      const yAnn = rhu(dateY(annOrd));
      const calloutW = 110;
      const calloutH = 24;
      const side = ann.position === 'left' ? 'left' : 'right';
      const boxX = side === 'right'
        ? rhu(SPINE_X + CONNECTOR_LEN + 10)
        : rhu(SPINE_X - CONNECTOR_LEN - calloutW - 10);
      const boxY = rhu(yAnn - calloutH / 2);
      primitives.push({
        kind: 'line',
        x1: side === 'right' ? SPINE_X : rhu(boxX + calloutW),
        y1: yAnn,
        x2: side === 'right' ? boxX : SPINE_X,
        y2: yAnn,
        stroke: theme.axis.tickLabelColor, strokeWidth: 1, opacity: 0.5, dashArray: '3,3',
      });
      primitives.push({
        kind: 'rect',
        x: boxX, y: boxY, width: calloutW, height: calloutH,
        fill: theme.canvas.backgroundColor, stroke: theme.axis.todayMarker.color, strokeWidth: 1,
        rx: 3, opacity: 0.92,
      });
      if (ann.text ?? ann.label) {
        const cFontPx = ptToPx(theme.typography.fontSizeAxis - 1);
        primitives.push({
          kind: 'text',
          x: rhu(boxX + calloutW / 2), y: rhu(boxY + calloutH / 2),
          text: ann.text ?? ann.label ?? '',
          fontFamily: FONT_FAM,
          fontSize: cFontPx, fontWeight: 400,
          fill: theme.axis.tickLabelColor,
          textAnchor: 'middle', dominantBaseline: 'middle',
        });
      }
    } catch {
      // skip
    }
  }

  // 8. Empty-timeline message
  if (nEntries === 0) {
    primitives.push({
      kind:             'text',
      x:                SPINE_X,
      y:                rhu(spineTopY + (finalSpineBottomY - spineTopY) / 2),
      text:             'No entries in time range',
      fontFamily:       FONT_FAM,
      fontSize:         datePx,
      fontWeight:       theme.typography.fontWeightAxis,
      fill:             theme.axis.tickLabelColor,
      textAnchor:       'middle',
      dominantBaseline: 'middle',
      opacity:          0.5,
    });
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
      const lgX = pos.includes('right') ? W - m.right - lgW - margin : m.left + margin;
      const lgY = pos.includes('bottom') ? H - m.bottom - lgH - margin : m.top + margin;

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
        fontFamily: FONT_FAM,
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
          fontFamily: FONT_FAM,
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
    background: theme.canvas.backgroundColor,
    primitives,
    // Attach theme's declarative background (Skia backend uses it; SVG ignores it)
    ...(theme.sceneBackground ? { sceneBackground: theme.sceneBackground } : {}),
  };
}
