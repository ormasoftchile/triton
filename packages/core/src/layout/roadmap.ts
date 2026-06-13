/**
 * @file layout/roadmap.ts — Roadmap three-zone layout family (INCREMENT 1).
 *
 * Renders a deterministic infographic composition with four horizontal zones:
 *
 *   1. HEADER      — title (bold, top-left) + optional subtitle
 *   2. CALLOUT ROW — milestone callouts above the phase band:
 *                    label (bold, ≤2 lines, centred at dateX) + date-in-parens below,
 *                    thin leader line down to band top edge, filled dot on edge;
 *                    goal milestones (category:'goal') get a rounded outlined box.
 *   3. PHASE BAND  — continuous activity pills (dateX(start)→dateX(end)):
 *                    circular icon badge (darker fill, white icon) + label + description.
 *   4. DATE AXIS   — thin horizontal line below band, date labels at milestone x positions,
 *                    "//" break marker rendered at each axis_break location.
 *
 * Reuses: dateX / axisState / breakSegs pattern from horizontal.ts; measureText,
 * ptToPx, rhu; getIcon registry.  Does NOT reuse track/lane geometry — the roadmap
 * family has one flat phase band and a single callout row.
 *
 * DETERMINISM: all coordinates via rhu() (round-half-up); no Date.now(),
 * Math.random(), or locale queries.
 */

import type { IRDocument } from '../types.js';
import type { Scene, ScenePrimitive } from '../scene.js';
import type { ResolvedTheme } from '../themes/types.js';
import { measureText, ptToPx } from '../fonts/metrics.js';
import { wrapText, truncateText } from '../text-wrap.js';
import { getIcon } from '../icons.js';
import {
  dateToOrdinal,
  coerceLeft,
  coerceRight,
  parseIRDate,
  parseAndCoerceLeft,
  parseAndCoerceRight,
} from './dates.js';

// ---------------------------------------------------------------------------
// Rounding helpers (§5.1 determinism contract — identical to horizontal.ts)
// ---------------------------------------------------------------------------

function rhu(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.floor(v * f + 0.5) / f;
}

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Darken a hex colour by multiplying each channel by `frac` (0–1). */
function darkenHex(hex: string, frac: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.max(0, rhuInt(parseInt(clean.slice(0, 2), 16) * frac));
  const g = Math.max(0, rhuInt(parseInt(clean.slice(2, 4), 16) * frac));
  const b = Math.max(0, rhuInt(parseInt(clean.slice(4, 6), 16) * frac));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Date-label formatters (deterministic — no locale)
// ---------------------------------------------------------------------------

const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Axis date label: "Nov 2025" for day-1 dates, "Jun 30" for specific days. */
function formatAxisDate(y: number, mo: number, d: number): string {
  const mon = MONTH_ABBRS[mo - 1] ?? '';
  return d === 1 ? `${mon} ${y}` : `${mon} ${d}`;
}

/** Callout date string in parens: "(Nov 2025)" or "(Jun 30)". */
function formatCalloutDate(y: number, mo: number, d: number): string {
  const mon = MONTH_ABBRS[mo - 1] ?? '';
  return d === 1 ? `(${mon} ${y})` : `(${mon} ${d})`;
}

// ---------------------------------------------------------------------------
// Axis-state and break-segment types (same pattern as horizontal.ts)
// ---------------------------------------------------------------------------

interface AxisState {
  tsOrd: number;
  teOrd: number;
  offset: number;
  wDraw:  number;
  breakSegs?:     BreakSeg[];
  nonBreakTime?:  number;
  nonBreakWDraw?: number;
  /** Resolved break-gap width (px); falls back to BREAK_GAP_PX when absent. */
  breakGapPx?: number;
}

interface BreakSeg {
  fromOrd: number;
  toOrd:   number;
  xLeft:   number;
  xRight:  number;
  xMid:    number;
}

/** Fixed pixel width consumed by each break gap (same as horizontal.ts). */
const BREAK_GAP_PX = 24;

/**
 * Map a day ordinal to a canvas x coordinate.
 * Byte-identical to horizontal.ts `dateX` — same formula, same break logic.
 */
function dateX(ord: number, ax: AxisState): number {
  const { tsOrd, teOrd, offset, wDraw } = ax;
  if (teOrd === tsOrd) return offset;

  if (!ax.breakSegs || ax.breakSegs.length === 0) {
    const raw = offset + Math.floor(((ord - tsOrd) * wDraw) / (teOrd - tsOrd) + 0.5);
    return Math.max(offset, Math.min(offset + wDraw, raw));
  }

  const nbTime  = ax.nonBreakTime!;
  const nbWDraw = ax.nonBreakWDraw!;
  let nonBreakOrd   = ord - tsOrd;
  let nBreaksBefore = 0;

  for (const seg of ax.breakSegs) {
    if (ord <= seg.fromOrd) break;
    if (ord < seg.toOrd)    return seg.xLeft;
    nonBreakOrd -= (seg.toOrd - seg.fromOrd);
    nBreaksBefore++;
  }

  const raw = offset + nBreaksBefore * (ax.breakGapPx ?? BREAK_GAP_PX) +
              Math.floor(nonBreakOrd * nbWDraw / nbTime + 0.5);
  return Math.max(offset, Math.min(offset + wDraw, raw));
}

function ordInBreak(ord: number, breakSegs: BreakSeg[] | undefined): boolean {
  if (!breakSegs || breakSegs.length === 0) return false;
  return breakSegs.some((s) => ord > s.fromOrd && ord < s.toOrd);
}

// ---------------------------------------------------------------------------
// Layout geometry constants (INCREMENT 1 — refine in later passes)
// ---------------------------------------------------------------------------

/** Height of the continuous phase band (tall enough for icon + 2 text lines). */
const PILL_HEIGHT      = 56;
/** Icon badge circle radius inside each phase pill. */
const BADGE_RADIUS     = 18;
/** Badge fill = activity colour × this factor (gives darker background for icon). */
const BADGE_DARK_FRAC  = 0.65;
/** Filled dot radius at the band top edge (where each leader line lands). */
const DOT_RADIUS       = 4;
/** Maximum callout text block width before wrapping. */
const CALLOUT_WRAP_W   = 130;
/** Horizontal padding inside the goal-milestone outlined box. */
const CALLOUT_H_PAD    = 6;
/** Vertical padding inside the goal-milestone outlined box. */
const CALLOUT_V_PAD    = 4;
/** Extra outward padding on the goal-milestone outlined box (so text isn't cramped). */
const GOAL_BOX_PAD_X   = 9;
const GOAL_BOX_PAD_TOP = 6;
const GOAL_BOX_PAD_BOT = 3;
/** Gap between title lines when label wraps. */
const TITLE_LINE_GAP   = 2;
/** Vertical gap between header bottom and callout blocks. */
const HEADER_CALLOUT_GAP = 16;
/** Vertical gap between callout block bottoms and band top (leader end zone). */
const LEADER_GAP       = 6;
/** Gap between band bottom and axis line. */
const AXIS_BELOW_GAP   = 4;
/** Gap between axis line and date label baseline. */
const AXIS_LABEL_GAP   = 3;
/** Minimum horizontal gap (px) between adjacent callout block EDGES during de-collision. */
const CALLOUT_DECOLLIDE_GAP = 12;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function layoutRoadmap(ir: IRDocument, theme: ResolvedTheme, _baseDir?: string): Scene {
  const m      = theme.canvas.margin;
  const W      = theme.canvas.width;
  const mL     = m.left;
  const mR     = m.right;
  const mT     = m.top;
  const mB     = m.bottom;
  const wDraw  = W - mL - mR;
  const offset = mL;

  const FONT_FAM = `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`;

  // ── Time-range ordinals ──────────────────────────────────────────────────
  const trStart = ir.metadata.time_range.start;
  const trEnd   = ir.metadata.time_range.end ?? trStart;
  const [tsY, tsM, tsD] = coerceLeft(parseIRDate(trStart));
  const [teY, teM, teD] = coerceRight(parseIRDate(trEnd));
  const tsOrd = dateToOrdinal(tsY, tsM, tsD);
  const teOrd = dateToOrdinal(teY, teM, teD);

  if (teOrd < tsOrd) {
    throw new Error(`time_range end (${trEnd}) is before start (${trStart})`);
  }

  // ── Resolve geometry tokens from theme (fallback → hardcoded constant) ───
  // Padding
  const calloutHPad      = theme.roadmap?.calloutHPad      ?? CALLOUT_H_PAD;
  const calloutVPad      = theme.roadmap?.calloutVPad      ?? CALLOUT_V_PAD;
  const goalBoxPadX      = theme.roadmap?.goalBoxPadX      ?? GOAL_BOX_PAD_X;
  const goalBoxPadTop    = theme.roadmap?.goalBoxPadTop    ?? GOAL_BOX_PAD_TOP;
  const goalBoxPadBot    = theme.roadmap?.goalBoxPadBottom ?? GOAL_BOX_PAD_BOT;
  // Gaps / separation
  const headerCalloutGap = theme.roadmap?.headerCalloutGap ?? HEADER_CALLOUT_GAP;
  const leaderGap        = theme.roadmap?.leaderGap        ?? LEADER_GAP;
  const axisBelowGap     = theme.roadmap?.axisBelowGap     ?? AXIS_BELOW_GAP;
  const axisLabelGap     = theme.roadmap?.axisLabelGap     ?? AXIS_LABEL_GAP;
  const milestoneGap     = theme.roadmap?.milestoneGap     ?? CALLOUT_DECOLLIDE_GAP;
  const titleLineGap     = theme.roadmap?.titleLineGap     ?? TITLE_LINE_GAP;
  // Sizes
  const pillHeight       = theme.roadmap?.pillHeight       ?? PILL_HEIGHT;
  const badgeRadius      = theme.roadmap?.badgeRadius      ?? BADGE_RADIUS;
  const badgeDarkFrac    = theme.roadmap?.badgeDarkFrac    ?? BADGE_DARK_FRAC;
  const dotRadius        = theme.roadmap?.dotRadius        ?? DOT_RADIUS;
  const calloutWrapW     = theme.roadmap?.calloutWrapWidth ?? CALLOUT_WRAP_W;
  const breakGapPx       = theme.roadmap?.breakGapPx       ?? BREAK_GAP_PX;

  // ── Axis-break precomputation ────────────────────────────────────────────
  // Opt-in: absent/empty → breakSegs undefined → dateX uses exact original formula.
  let breakSegs:     BreakSeg[] | undefined;
  let nonBreakTime:  number    | undefined;
  let nonBreakWDraw: number    | undefined;

  {
    const rawBreaks = ir.metadata.axis_breaks ?? [];
    if (rawBreaks.length > 0) {
      const parsed = rawBreaks
        .map((b) => ({
          fromOrd: (() => { try { return parseAndCoerceLeft(b.from); } catch { return -1; } })(),
          toOrd:   (() => { try { return parseAndCoerceLeft(b.to);   } catch { return -1; } })(),
        }))
        .filter((b) => b.fromOrd >= 0 && b.toOrd > b.fromOrd)
        .sort((a, b) => a.fromOrd - b.fromOrd);

      if (parsed.length > 0) {
        const totalBreakDuration = parsed.reduce((s, b) => s + (b.toOrd - b.fromOrd), 0);
        const nbTime0  = teOrd - tsOrd - totalBreakDuration;
        const nbWDraw0 = wDraw - parsed.length * breakGapPx;

        if (nbTime0 > 0 && nbWDraw0 > 0) {
          nonBreakTime  = nbTime0;
          nonBreakWDraw = nbWDraw0;
          let priorDuration = 0;
          breakSegs = parsed.map((b, idx) => {
            const nonBreakOrdAtFrom = b.fromOrd - tsOrd - priorDuration;
            const xLeft  = offset + idx * breakGapPx +
                           Math.floor(nonBreakOrdAtFrom * nbWDraw0 / nbTime0 + 0.5);
            const xRight = xLeft + breakGapPx;
            priorDuration += (b.toOrd - b.fromOrd);
            return {
              fromOrd: b.fromOrd,
              toOrd:   b.toOrd,
              xLeft,
              xRight,
              xMid: Math.floor((xLeft + xRight) / 2 + 0.5),
            } satisfies BreakSeg;
          });
        }
      }
    }
  }

  const axisState: AxisState = {
    tsOrd, teOrd, offset, wDraw, breakGapPx,
    ...(breakSegs && nonBreakTime !== undefined && nonBreakWDraw !== undefined
      ? { breakSegs, nonBreakTime, nonBreakWDraw }
      : {}),
  };

  // ── Font-size helpers ─────────────────────────────────────────────────────
  const hdrTitlePx     = ptToPx(theme.typography.fontSizeTitle);
  const hdrSubtitlePx  = ptToPx(theme.typography.fontSizeSubtitle);
  const calloutTitlePx = ptToPx(theme.milestone.titleLabelFontSize);
  const calloutDatePx  = ptToPx(theme.milestone.dateLabelFontSize);
  const axisLabelPx    = ptToPx(theme.typography.fontSizeAxis);
  const actLabelPx     = ptToPx(theme.activity.labelFontSize);
  const actDescPx      = Math.max(6, actLabelPx * 0.82);

  // ── Zone 1: header height ────────────────────────────────────────────────
  const HEADER_V_PAD = 12;
  let headerH = 0;
  if (ir.metadata.title) {
    headerH += HEADER_V_PAD + rhuInt(hdrTitlePx * 1.4);
    if (ir.metadata.subtitle) headerH += 4 + rhuInt(hdrSubtitlePx * 1.35);
    headerH += HEADER_V_PAD;
  }

  // ── Sorted milestones within time range ──────────────────────────────────
  const msWithOrd = (ir.milestones ?? [])
    .map((ms) => {
      const [y, mo, d] = coerceLeft(parseIRDate(ms.date));
      return { ms, ord: dateToOrdinal(y, mo, d), y, mo, d };
    })
    .filter(({ ord }) => ord >= tsOrd && ord <= teOrd);
  msWithOrd.sort((a, b) =>
    a.ord !== b.ord ? a.ord - b.ord : a.ms.id.localeCompare(b.ms.id),
  );

  // ── Zone 2: callout block geometry ───────────────────────────────────────
  const titleLineH = rhu(calloutTitlePx * 1.25);

  interface CalloutInfo {
    ms:         (typeof msWithOrd)[0]['ms'];
    ord:        number;
    y:          number;   // calendar year (for axis date label)
    mo:         number;   // calendar month
    d:          number;   // calendar day
    xTrue:      number;   // dateX(ord) — true axis position
    titleLines: string[];
    dateStr:    string;
    blockW:     number;
    blockH:     number;
  }

  const calloutInfos: CalloutInfo[] = msWithOrd.map(({ ms, ord, y, mo, d }) => {
    const xTrue      = rhu(dateX(ord, axisState));
    const titleLines = wrapText(ms.label, calloutTitlePx, calloutWrapW, 2).lines;
    const dateStr    = formatCalloutDate(y, mo, d);

    const titleW     = titleLines.length > 0
      ? Math.max(...titleLines.map((l) => measureText(l, calloutTitlePx).width))
      : 0;
    const dateW      = measureText(dateStr, calloutDatePx).width;
    const textInnerW = Math.max(titleW, dateW);
    const blockW     = rhu(textInnerW + calloutHPad * 2);

    const titleBlockH = titleLines.length * titleLineH +
                        (titleLines.length > 1 ? titleLineGap * (titleLines.length - 1) : 0);
    const blockH      = rhu(calloutVPad * 2 + titleBlockH + 3 + rhu(calloutDatePx * 1.25));

    return { ms, ord, y, mo, d, xTrue, titleLines, dateStr, blockW, blockH };
  });

  const maxCalloutH = calloutInfos.reduce((mx, c) => Math.max(mx, c.blockH), 0);

  // ── Greedy horizontal de-collision (left→right, single row) ─────────────
  // Ensures no two callout blocks overlap; all visual elements for a milestone
  // (box, leader, dot, axis date) share the same x = placedCenters[i].
  const placedCenters: number[] = new Array(calloutInfos.length).fill(0);

  // Forward pass: push each block right of its true position only enough to
  // clear the previous block.
  for (let i = 0; i < calloutInfos.length; i++) {
    const c = calloutInfos[i]!;
    const canvasMinX = mL + c.blockW / 2;
    if (i === 0) {
      placedCenters[i] = rhu(Math.max(canvasMinX, c.xTrue));
    } else {
      const prev    = calloutInfos[i - 1]!;
      const minNext = placedCenters[i - 1]! + prev.blockW / 2 + c.blockW / 2 + milestoneGap;
      placedCenters[i] = rhu(Math.max(c.xTrue, minNext));
    }
  }

  // Backward clamp: if the rightmost block overflows the canvas right margin,
  // clamp it then walk left ensuring each block still clears its right neighbour.
  for (let i = calloutInfos.length - 1; i >= 0; i--) {
    const c = calloutInfos[i]!;
    const canvasMaxX = W - mR - c.blockW / 2;
    if (placedCenters[i]! > canvasMaxX) {
      placedCenters[i] = rhu(canvasMaxX);
    }
    if (i < calloutInfos.length - 1) {
      const next       = calloutInfos[i + 1]!;
      const maxForThis = placedCenters[i + 1]! - next.blockW / 2 - c.blockW / 2 - milestoneGap;
      if (placedCenters[i]! > maxForThis) {
        placedCenters[i] = rhu(Math.max(mL + c.blockW / 2, maxForThis));
      }
    }
  }

  // ── Zone Y coordinates ───────────────────────────────────────────────────
  const calloutTopY  = rhu(mT + headerH + headerCalloutGap);
  const bandTopY     = rhu(calloutTopY + maxCalloutH + leaderGap);
  const bandBottomY  = rhu(bandTopY + pillHeight);
  const axisY        = rhu(bandBottomY + axisBelowGap);
  const axisLabelY   = rhu(axisY + axisLabelGap + axisLabelPx);
  const H            = rhu(axisLabelY + axisLabelPx * 0.3 + mB);

  // ── Sorted activities for the phase band ─────────────────────────────────
  const sortedActs = (ir.activities ?? [])
    .map((a) => {
      const startOrd = a.span
        ? parseAndCoerceLeft(a.span)
        : parseAndCoerceLeft(a.start ?? trStart);
      return { a, startOrd };
    })
    .sort((p, q) =>
      p.startOrd !== q.startOrd ? p.startOrd - q.startOrd : p.a.id.localeCompare(q.a.id),
    );

  // ── Build primitives (painter's algorithm: back → front) ─────────────────
  const primitives: ScenePrimitive[] = [];

  // 0. Background
  primitives.push({
    kind: 'rect', x: 0, y: 0, width: W, height: H,
    fill: theme.canvas.backgroundColor,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Zone 1: Header — title bold, top-left; optional subtitle below
  // ──────────────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    let hdrCursorY = mT + HEADER_V_PAD;

    primitives.push({
      kind:             'text',
      x:                rhu(offset),
      y:                rhu(hdrCursorY + hdrTitlePx),
      text:             ir.metadata.title,
      fontFamily:       FONT_FAM,
      fontSize:         hdrTitlePx,
      fontWeight:       theme.typography.fontWeightHeader,
      fill:             theme.typography.titleColor,
      textAnchor:       'start',
      dominantBaseline: 'alphabetic',
    });
    hdrCursorY += rhuInt(hdrTitlePx * 1.4);

    if (ir.metadata.subtitle) {
      hdrCursorY += 4;
      primitives.push({
        kind:             'text',
        x:                rhu(offset),
        y:                rhu(hdrCursorY + hdrSubtitlePx),
        text:             ir.metadata.subtitle,
        fontFamily:       FONT_FAM,
        fontSize:         hdrSubtitlePx,
        fontWeight:       theme.typography.fontWeightAxis,
        fill:             theme.typography.titleColor,
        textAnchor:       'start',
        dominantBaseline: 'alphabetic',
        opacity:          0.7,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Zone 3: Phase band — continuous pills with icon badges
  // (drawn before callout dots so dots render on top of the band edge)
  // ──────────────────────────────────────────────────────────────────────────
  for (const { a } of sortedActs) {
    let xLeft: number;
    let xRight: number;

    try {
      if (a.span) {
        xLeft  = rhu(dateX(parseAndCoerceLeft(a.span), axisState));
        xRight = rhu(dateX(parseAndCoerceRight(a.span), axisState));
      } else {
        xLeft = rhu(dateX(parseAndCoerceLeft(a.start ?? trStart), axisState));
        const end = a.end;
        if (!end || end === 'ongoing') {
          xRight = rhu(offset + wDraw);
        } else if (end === 'tbd' || end === 'unknown') {
          xRight = rhu(offset + wDraw);
        } else {
          xRight = rhu(dateX(parseAndCoerceRight(end), axisState));
        }
      }
    } catch {
      continue; // skip activities with unparseable dates
    }

    const pillW  = Math.max(4, xRight - xLeft);
    const fill   = a.color ?? theme.statusMap['planned']?.fill ?? '#3B82F6';

    // Pill rectangle
    primitives.push({
      kind:   'rect',
      x:       xLeft,
      y:       bandTopY,
      width:   pillW,
      height:  pillHeight,
      fill,
      rx:      theme.activity.barRadius,
    });

    // Icon badge: darker circle, white icon inside
    const badgeR  = Math.min(badgeRadius, rhuInt(pillHeight / 2) - 2);
    const badgeCX = rhu(xLeft + badgeR + 8);
    const badgeCY = rhu(bandTopY + pillHeight / 2);
    const badgeFill = darkenHex(fill, badgeDarkFrac);

    primitives.push({
      kind: 'circle',
      cx:   badgeCX,
      cy:   badgeCY,
      r:    badgeR,
      fill: badgeFill,
    });

    const iconName = a.icon ? a.icon.toLowerCase().trim() : undefined;
    const iconDef  = iconName ? getIcon(iconName) : undefined;
    if (iconDef && pillW >= badgeR * 2 + 16) {
      const iconScale = rhu((badgeR * 0.72) / 12, 4);
      const transform = `translate(${badgeCX},${badgeCY}) scale(${iconScale}) translate(-12,-12)`;
      for (const pathDef of iconDef.paths) {
        primitives.push({
          kind:          'path',
          d:             pathDef.d,
          fill:          pathDef.fill   ? '#FFFFFF' : 'none',
          stroke:        pathDef.stroke !== false ? '#FFFFFF' : undefined,
          strokeWidth:   pathDef.stroke !== false ? 2         : undefined,
          strokeLinecap: pathDef.stroke !== false ? 'round'   : undefined,
          transform,
        });
      }
    }

    // Label + description to the right of the badge
    const textStartX = rhu(xLeft + badgeR * 2 + 16);
    const textAvailW = rhu(xRight - textStartX - 8);

    if (textAvailW >= 20) {
      // Label: vertically positioned at upper-third of pill; truncated to fit
      const labelY     = rhu(bandTopY + pillHeight * 0.38);
      const truncLabel = truncateText(a.label, actLabelPx, textAvailW);
      primitives.push({
        kind:             'text',
        x:                textStartX,
        y:                labelY,
        text:             truncLabel,
        fontFamily:       FONT_FAM,
        fontSize:         actLabelPx,
        fontWeight:       theme.typography.fontWeightLabel,
        fill:             '#FFFFFF',
        textAnchor:       'start',
        dominantBaseline: 'middle',
      });

      // Description: vertically positioned at lower-third of pill; truncated to fit
      if (a.description) {
        const descY      = rhu(bandTopY + pillHeight * 0.72);
        const truncDesc  = truncateText(a.description, actDescPx, textAvailW);
        primitives.push({
          kind:             'text',
          x:                textStartX,
          y:                descY,
          text:             truncDesc,
          fontFamily:       FONT_FAM,
          fontSize:         actDescPx,
          fontWeight:       400,
          fill:             '#FFFFFF',
          textAnchor:       'start',
          dominantBaseline: 'middle',
          opacity:          0.82,
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Zone 2: Milestone callout row + leaders + dots
  // (drawn after the band so dots sit visually on the band top edge)
  // ──────────────────────────────────────────────────────────────────────────
  for (let idx = 0; idx < calloutInfos.length; idx++) {
    const c = calloutInfos[idx]!;
    const { ms, titleLines, dateStr, blockW, blockH } = c;
    const isGoal = ms.category === 'goal';

    // Use the de-collided centre; already clamped within canvas during de-collision pass.
    const xCenter = placedCenters[idx]!;
    const boxLeft = rhu(xCenter - blockW / 2);

    // Goal milestone: outlined rounded box around the text block
    if (isGoal) {
      primitives.push({
        kind:        'rect',
        x:           rhu(boxLeft - goalBoxPadX),
        y:           rhu(calloutTopY - goalBoxPadTop),
        width:       rhu(blockW + goalBoxPadX * 2),
        height:      rhu(blockH + goalBoxPadTop + goalBoxPadBot),
        fill:        'none',
        stroke:      theme.axis.axisLineColor,
        strokeWidth: 1.5,
        rx:          5,
        opacity:     0.9,
      });
    }

    // Title lines (bold, centred)
    for (let li = 0; li < titleLines.length; li++) {
      primitives.push({
        kind:             'text',
        x:                xCenter,
        y:                rhu(calloutTopY + calloutVPad + titleLineH * (li + 0.85) + li * titleLineGap),
        text:             titleLines[li]!,
        fontFamily:       FONT_FAM,
        fontSize:         calloutTitlePx,
        fontWeight:       700,
        fill:             theme.typography.titleColor,
        textAnchor:       'middle',
        dominantBaseline: 'alphabetic',
      });
    }

    // Date-in-parens line (smaller, lighter)
    const titleBlockH = titleLines.length * titleLineH +
                        (titleLines.length > 1 ? titleLineGap * (titleLines.length - 1) : 0);
    primitives.push({
      kind:             'text',
      x:                xCenter,
      y:                rhu(calloutTopY + calloutVPad + titleBlockH + 3 + calloutDatePx * 0.85),
      text:             dateStr,
      fontFamily:       FONT_FAM,
      fontSize:         calloutDatePx,
      fontWeight:       400,
      fill:             theme.axis.tickLabelColor,
      textAnchor:       'middle',
      dominantBaseline: 'alphabetic',
    });

    // Leader line: from bottom of callout block down to band top, aligned with xCenter
    const leaderStartY = rhu(calloutTopY + blockH + (isGoal ? goalBoxPadBot : 0));
    primitives.push({
      kind:        'line',
      x1:          xCenter,
      y1:          leaderStartY,
      x2:          xCenter,
      y2:          bandTopY,
      stroke:      theme.axis.axisLineColor,
      strokeWidth: 1,
      opacity:     0.5,
    });

    // Dot: filled circle at band top edge, aligned with xCenter
    const dotFill = ms.color ?? theme.axis.axisLineColor;
    primitives.push({
      kind: 'circle',
      cx:   xCenter,
      cy:   bandTopY,
      r:    dotRadius,
      fill: dotFill,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Zone 4: Date axis below the band
  // ──────────────────────────────────────────────────────────────────────────

  // Axis line (segmented if axis_breaks present, with "//" break markers)
  if (!breakSegs || breakSegs.length === 0) {
    primitives.push({
      kind:        'line',
      x1:          rhu(offset),
      y1:          axisY,
      x2:          rhu(offset + wDraw),
      y2:          axisY,
      stroke:      theme.axis.axisLineColor,
      strokeWidth: 1,
    });
  } else {
    let segStartX = rhu(offset);
    for (const seg of breakSegs) {
      // Axis segment up to the break
      primitives.push({
        kind: 'line',
        x1: segStartX,         y1: axisY,
        x2: rhu(seg.xLeft),   y2: axisY,
        stroke: theme.axis.axisLineColor, strokeWidth: 1,
      });
      // "//" break marker — two forward-diagonal strokes centred in the gap
      const xm = seg.xMid;
      primitives.push({
        kind: 'line',
        x1: rhu(xm - 5), y1: rhu(axisY + 7),
        x2: rhu(xm - 1), y2: rhu(axisY - 7),
        stroke: theme.axis.axisLineColor, strokeWidth: 1.5,
      });
      primitives.push({
        kind: 'line',
        x1: rhu(xm + 1), y1: rhu(axisY + 7),
        x2: rhu(xm + 5), y2: rhu(axisY - 7),
        stroke: theme.axis.axisLineColor, strokeWidth: 1.5,
      });
      segStartX = rhu(seg.xRight);
    }
    // Final segment after last break
    primitives.push({
      kind: 'line',
      x1: segStartX,            y1: axisY,
      x2: rhu(offset + wDraw),  y2: axisY,
      stroke: theme.axis.axisLineColor, strokeWidth: 1,
    });
  }

  // Date labels at each milestone's de-collided x position
  for (let idx = 0; idx < calloutInfos.length; idx++) {
    const { ord, y, mo, d } = calloutInfos[idx]!;
    // Skip milestones whose dates fall strictly inside a break interval
    if (ordInBreak(ord, breakSegs)) continue;

    const xMilestone = placedCenters[idx]!;
    const labelText  = formatAxisDate(y, mo, d);

    // Tick mark above axis line (aligned with de-collided x)
    primitives.push({
      kind:        'line',
      x1:          xMilestone, y1: rhu(axisY - 4),
      x2:          xMilestone, y2: axisY,
      stroke:      theme.axis.axisLineColor,
      strokeWidth: 1,
    });

    // Label text (centred at xMilestone, clamped to canvas edges for safety)
    const labelHalfW = measureText(labelText, axisLabelPx).width / 2;
    const clampedX   = rhu(Math.max(labelHalfW + mL, Math.min(W - labelHalfW - mR, xMilestone)));
    primitives.push({
      kind:             'text',
      x:                clampedX,
      y:                axisLabelY,
      text:             labelText,
      fontFamily:       FONT_FAM,
      fontSize:         axisLabelPx,
      fontWeight:       400,
      fill:             theme.axis.tickLabelColor,
      textAnchor:       'middle',
      dominantBaseline: 'alphabetic',
    });
  }

  return {
    width:      W,
    height:     H,
    background: theme.canvas.backgroundColor,
    primitives,
  };
}
