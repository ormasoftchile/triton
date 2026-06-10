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
import {
  dateToOrdinal,
  coerceLeft,
  coerceRight,
  parseIRDate,
  parseAndCoerceLeft,
  parseAndCoerceRight,
  formatMilestoneDate,
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
  const CONNECTOR_LEN  = 48;
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

  const spineTopY    = rhu(mT + SPINE_TOP_PAD);
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
    let h = VERT_PAD;
    h += DATE_LINE_H;
    h += TEXT_GAP + TITLE_LINE_H;
    if (e.description) h += TEXT_GAP + DESC_LINE_H;
    h += VERT_PAD;
    return rhuInt(h);
  }

  // ── Year tick positions (spine axis reference) ────────────────────────────

  const yearTicks: { year: number; y: number }[] = [];
  for (let y = tsY; y <= teY; y++) {
    const janOrd     = dateToOrdinal(y, 1, 1);
    const clampedOrd = Math.max(tsOrd, Math.min(teOrd, janOrd));
    yearTicks.push({ year: y, y: rhu(dateY(clampedOrd)) });
  }

  // ── Build Scene primitives (painter's algorithm: back → front) ────────────

  const primitives: ScenePrimitive[] = [];

  // 1. Background
  primitives.push({
    kind: 'rect', x: 0, y: 0, width: W, height: H,
    fill: theme.canvas.backgroundColor,
  });

  // 2. Document title
  if (ir.metadata.title) {
    const titleSizePx = ptToPx(theme.typography.fontSizeTitle);
    primitives.push({
      kind:             'text',
      x:                rhu(W / 2),
      y:                rhu(mT / 2 + titleSizePx / 2),
      text:             ir.metadata.title,
      fontFamily:       FONT_FAM,
      fontSize:         titleSizePx,
      fontWeight:       theme.typography.fontWeightHeader,
      fill:             theme.typography.titleColor,
      textAnchor:       'middle',
      dominantBaseline: 'middle',
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

  // 5. Year tick marks and labels
  const TICK_W        = 8;
  const YEAR_LABEL_X  = rhu(SPINE_X + TICK_W + 6);

  for (const yt of yearTicks) {
    primitives.push({
      kind:        'line',
      x1:          rhu(SPINE_X - TICK_W),
      y1:          yt.y,
      x2:          rhu(SPINE_X + TICK_W),
      y2:          yt.y,
      stroke:      theme.axis.axisLineColor,
      strokeWidth: 1,
      opacity:     0.5,
    });
    primitives.push({
      kind:             'text',
      x:                YEAR_LABEL_X,
      y:                rhu(yt.y - 2),
      text:             String(yt.year),
      fontFamily:       FONT_FAM,
      fontSize:         yearFontPx,
      fontWeight:       theme.typography.fontWeightAxis,
      fill:             theme.axis.tickLabelColor,
      textAnchor:       'start',
      dominantBaseline: 'alphabetic',
      opacity:          0.6,
    });
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

    // Title label (second line)
    textY = rhu(textY + TEXT_GAP + TITLE_LINE_H);
    primitives.push({
      kind:             'text',
      x:                textX,
      y:                textY,
      text:             entry.label,
      fontFamily:       FONT_FAM,
      fontSize:         titlePx,
      fontWeight:       theme.milestone.titleLabelFontWeight,
      fill:             theme.milestone.titleLabelColor,
      textAnchor,
      dominantBaseline: 'alphabetic',
    });

    // Description (optional third line)
    if (entry.description) {
      textY = rhu(textY + TEXT_GAP + DESC_LINE_H);
      primitives.push({
        kind:             'text',
        x:                textX,
        y:                textY,
        text:             entry.description,
        fontFamily:       FONT_FAM,
        fontSize:         descPx,
        fontWeight:       theme.typography.fontWeightAxis,
        fill:             theme.milestone.dateLabelColor,
        textAnchor,
        dominantBaseline: 'alphabetic',
        opacity:          0.85,
      });
    }

    // Icon hint placeholder (2-char text glyph; full pictographic badges deferred)
    if (entry.iconHint) {
      const iconX = side === 'right'
        ? rhu(blockLeft + BLOCK_W - BLOCK_INNER_PAD)
        : rhu(blockLeft + BLOCK_INNER_PAD);
      const iconAnchor = (side === 'right' ? 'end' : 'start') as 'start' | 'end';
      primitives.push({
        kind:             'text',
        x:                iconX,
        y:                rhu(blockTop + VERT_PAD + DATE_LINE_H * 0.85),
        text:             entry.iconHint.slice(0, 2),
        fontFamily:       FONT_FAM,
        fontSize:         datePx,
        fontWeight:       400,
        fill:             entry.statusFill,
        textAnchor:       iconAnchor,
        dominantBaseline: 'alphabetic',
        opacity:          0.7,
      });
    }
  }

  // 7. Spine node markers (drawn last — on top of connectors and card edges)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const nodeY = nodeYs[i]!;
    const shape = theme.milestone.shape;
    const nr    = NODE_R;

    if (shape === 'circle') {
      primitives.push({
        kind:        'circle',
        cx:          SPINE_X,
        cy:          nodeY,
        r:           nr,
        fill:        entry.statusFill,
        stroke:      theme.canvas.backgroundColor,
        strokeWidth: 1.5,
      });
    } else if (shape === 'diamond') {
      primitives.push({
        kind:   'path',
        d:      `M ${SPINE_X} ${rhu(nodeY - nr)} L ${rhu(SPINE_X + nr)} ${nodeY} L ${SPINE_X} ${rhu(nodeY + nr)} L ${rhu(SPINE_X - nr)} ${nodeY} Z`,
        fill:        entry.statusFill,
        stroke:      theme.canvas.backgroundColor,
        strokeWidth: 1.5,
      });
    } else {
      // triangle
      primitives.push({
        kind:   'path',
        d:      `M ${rhu(SPINE_X - nr)} ${rhu(nodeY - nr)} L ${rhu(SPINE_X + nr)} ${rhu(nodeY - nr)} L ${SPINE_X} ${rhu(nodeY + nr)} Z`,
        fill:        entry.statusFill,
        stroke:      theme.canvas.backgroundColor,
        strokeWidth: 1.5,
      });
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

  return {
    width:      W,
    height:     H,
    background: theme.canvas.backgroundColor,
    primitives,
  };
}
