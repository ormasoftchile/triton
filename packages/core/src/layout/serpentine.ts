/**
 * @file layout/serpentine.ts — Deterministic SERPENTINE (boustrophedon) layout engine.
 *
 * `layoutSerpentine(ir, theme, baseDir?)` produces a Scene from an IRDocument
 * for the SERPENTINE family.
 *
 * Design:
 *  - Boustrophedon path: runs left→right, U-turns right, runs right→left, U-turns left, etc.
 *  - Path rendered as N gradient sub-segments (light-green → dark-green) for cross-backend gradient.
 *  - Entries sorted by (date_ordinal, id), mapped to UNIFORM positions along path arc-length.
 *    Each entry node is at t_i = (i + 0.5) / n (centred intervals).
 *  - Start/end icon badges at exact path endpoints (t=0, t=1).
 *  - Optional text labels near each node (controlled by serpentine.showLabels theme token).
 *  - Title/subtitle header reused from the shared header pattern.
 *
 * Geometry:
 *  - PATH_XL=90, PATH_XR=1110, rowWidth=1020, turnRadius from theme (default 80).
 *  - rowSpacing = 2 * turnRadius. nRows = max(2, ceil(n/3)).
 *  - canvasH = headerH + TOP_PAD + (nRows-1)*rowSpacing + BOTTOM_PAD.
 *
 * Gradient approach:
 *  - GRADIENT_SEGS short path segments, each with a solid interpolated colour.
 *  - Each segment is a M x0 y0 L x1 y1 (straight-line approximation of the arc).
 *  - One additional glow PathPrimitive drawn before the segments (full path, glow effect).
 *
 * Determinism contract (§5.1):
 *  - round-half-up for all coordinate values.
 *  - No Date.now(), Math.random(), or system locale.
 *  - Stable sort: (date_ordinal, id).
 */

import type { Scene, ScenePrimitive } from '../scene.js';
import type { IRDocument } from '../types.js';
import type { ResolvedTheme } from '../themes/types.js';
import { loadImageAsset } from '../asset-loader.js';
import { ptToPx } from '../fonts/metrics.js';
import { getIcon } from '../icons.js';
import {
  coerceLeft,
  dateToOrdinal,
  parseIRDate,
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
// Colour interpolation
// ---------------------------------------------------------------------------

/** Parse a '#RRGGBB' hex colour into [r, g, b] components [0..255]. */
function parseHex(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  if (c.length !== 6) return [0, 128, 0];
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

/** Linearly interpolate between two '#RRGGBB' colours at t ∈ [0,1]. */
function lerpColor(from: string, to: string, t: number): string {
  const [r0, g0, b0] = parseHex(from);
  const [r1, g1, b1] = parseHex(to);
  const r = rhuInt(r0 + (r1 - r0) * t);
  const g = rhuInt(g0 + (g1 - g0) * t);
  const b = rhuInt(b0 + (b1 - b0) * t);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ---------------------------------------------------------------------------
// Serpentine geometry
// ---------------------------------------------------------------------------

interface SerpentineGeo {
  /** Left edge of horizontal row segments (start of L→R rows). */
  xl: number;
  /** Right edge of horizontal row segments (end of L→R rows). */
  xr: number;
  /** Y coordinate of row 0 (topmost row). */
  pathStartY: number;
  /** Number of horizontal rows. */
  nRows: number;
  /** Vertical distance between rows in px (= 2 * turnRadius). */
  rowSpacing: number;
  /** Radius of the semicircular U-turns in px. */
  turnRadius: number;
  /** Row length in px (= xr - xl). */
  rowWidth: number;
  /** Total arc length of the path in px. */
  totalLength: number;
}

/**
 * Compute a point (x, y) on the boustrophedon path at arc-length distance s.
 * s is clamped to [0, totalLength].
 */
function pathPointAtS(s: number, geo: SerpentineGeo): { x: number; y: number } {
  const { xl, xr, pathStartY, nRows, rowSpacing, turnRadius: r, rowWidth } = geo;
  const L_row = rowWidth;
  const L_turn = Math.PI * r;

  let remaining = Math.max(0, Math.min(s, geo.totalLength));

  for (let row = 0; row < nRows; row++) {
    const y_row = pathStartY + row * rowSpacing;

    // Row segment
    if (remaining <= L_row + 1e-9) {
      const t = Math.min(remaining, L_row);
      if (row % 2 === 0) {
        return { x: rhu(xl + t), y: rhu(y_row) };
      }
      return { x: rhu(xr - t), y: rhu(y_row) };
    }
    remaining -= L_row;

    // Turn (not after last row)
    if (row < nRows - 1) {
      if (remaining <= L_turn + 1e-9) {
        const alpha = Math.min(remaining, L_turn) / r;
        if (row % 2 === 0) {
          return {
            x: rhu(xr + r * Math.sin(alpha)),
            y: rhu(y_row + r * (1 - Math.cos(alpha))),
          };
        }
        return {
          x: rhu(xl - r * Math.sin(alpha)),
          y: rhu(y_row + r * (1 - Math.cos(alpha))),
        };
      }
      remaining -= L_turn;
    }
  }

  const lastRow = nRows - 1;
  const y_last = rhu(pathStartY + lastRow * rowSpacing);
  return lastRow % 2 === 0
    ? { x: rhu(xr), y: y_last }
    : { x: rhu(xl), y: y_last };
}

/**
 * Build the SVG path `d` string for the full boustrophedon path.
 * Uses arc commands for smooth turns.
 */
function buildPathD(geo: SerpentineGeo): string {
  const { xl, xr, pathStartY, nRows, rowSpacing, turnRadius: r } = geo;
  const parts: string[] = [];

  for (let row = 0; row < nRows; row++) {
    const y = rhu(pathStartY + row * rowSpacing);
    const y_next = rhu(pathStartY + (row + 1) * rowSpacing);

    if (row === 0) {
      parts.push(`M ${xl} ${y}`);
    }

    if (row % 2 === 0) {
      parts.push(`L ${xr} ${y}`);
      if (row < nRows - 1) {
        parts.push(`A ${r} ${r} 0 1 1 ${xr} ${y_next}`);
      }
    } else {
      parts.push(`L ${xl} ${y}`);
      if (row < nRows - 1) {
        parts.push(`A ${r} ${r} 0 1 0 ${xl} ${y_next}`);
      }
    }
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function layoutSerpentine(ir: IRDocument, theme: ResolvedTheme, baseDir?: string): Scene {
  const primitives: ScenePrimitive[] = [];
  const W = theme.canvas.width;
  const bg = theme.canvas.backgroundColor;
  const sTheme = theme.serpentine ?? {
    pathStrokeWidth: 14,
    gradientFrom: '#86EFAC',
    gradientTo: '#15803D',
    glowColor: '#4ADE80',
    glowRadius: 18,
    nodeRadius: 10,
    nodeFill: '#FFFFFF',
    nodeStroke: '#15803D',
    nodeStrokeWidth: 3,
    startIcon: 'play',
    endIcon: 'target',
    badgeRadius: 22,
    badgeFill: '#15803D',
    badgeIconColor: '#FFFFFF',
    rowSpacing: 160,
    turnRadius: 80,
    showLabels: true,
    labelColor: '#374151',
    labelFontSize: 9,
  };

  const FONT_FAM = `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`;

  // ── Header geometry ────────────────────────────────────────────────────────
  const HEADER_V_PAD = 12;
  const hdrTitlePx = ptToPx(theme.typography.fontSizeTitle);
  const hdrSubtitlePx = ptToPx(theme.typography.fontSizeSubtitle);

  let headerH = 0;
  if (ir.metadata.title) {
    headerH += HEADER_V_PAD + rhuInt(hdrTitlePx * 1.4);
    if (ir.metadata.subtitle) headerH += 4 + rhuInt(hdrSubtitlePx * 1.35);
    headerH += HEADER_V_PAD;
  }

  const LOGO_V_PAD = 8;
  if (ir.metadata.logo) {
    const logoH = ir.metadata.logo.height ?? 32;
    if (logoH + LOGO_V_PAD * 2 > headerH) headerH = rhuInt(logoH + LOGO_V_PAD * 2);
  }

  // ── Path geometry ──────────────────────────────────────────────────────────
  const r = sTheme.turnRadius;
  const PATH_XL = rhu(r + 10);
  const PATH_XR = rhu(W - r - 10);
  const ROW_W = rhu(PATH_XR - PATH_XL);

  interface SerpEntry {
    id: string;
    label: string;
    ord: number;
    statusFill: string;
  }

  const entries: SerpEntry[] = [];

  for (const ms of ir.milestones ?? []) {
    const parsed = parseIRDate(ms.date);
    const [y, mo, d] = coerceLeft(parsed);
    const ord = dateToOrdinal(y, mo, d);
    const cat = ms.category ? theme.categoryMap[ms.category] : undefined;
    const status = ms.status ?? 'planned';
    const statusStyle = theme.statusMap[status] ?? theme.statusMap.planned;
    const statusFill = cat?.fill ?? (ms.color ?? statusStyle.fill);
    entries.push({ id: ms.id, label: ms.label, ord, statusFill });
  }

  for (const act of ir.activities ?? []) {
    if (!act.start) continue;
    const parsed = parseIRDate(act.start);
    const [y, mo, d] = coerceLeft(parsed);
    const ord = dateToOrdinal(y, mo, d);
    const cat = act.category ? theme.categoryMap[act.category] : undefined;
    const status = act.status ?? 'planned';
    const statusStyle = theme.statusMap[status] ?? theme.statusMap.planned;
    const statusFill = cat?.fill ?? (act.color ?? statusStyle.fill);
    entries.push({ id: act.id, label: act.label, ord, statusFill });
  }

  entries.sort((a, b) => (a.ord !== b.ord ? a.ord - b.ord : a.id.localeCompare(b.id)));

  const n = entries.length;
  const NODES_PER_ROW = 3;
  const nRows = Math.max(2, Math.ceil(n / NODES_PER_ROW));

  const rowSpacing = rhu(sTheme.rowSpacing);

  const TOP_PAD = 72;
  const BOTTOM_PAD = 72;
  const pathStartY = rhu(headerH + TOP_PAD);
  const pathEndY = rhu(pathStartY + (nRows - 1) * rowSpacing);
  const canvasH = rhuInt(pathEndY + BOTTOM_PAD);

  const L_row = ROW_W;
  const L_turn = rhu(Math.PI * r);
  const totalLength = rhu(nRows * L_row + (nRows - 1) * L_turn);

  const geo: SerpentineGeo = {
    xl: PATH_XL,
    xr: PATH_XR,
    pathStartY,
    nRows,
    rowSpacing,
    turnRadius: r,
    rowWidth: ROW_W,
    totalLength,
  };

  // ── Background ─────────────────────────────────────────────────────────────
  primitives.push({
    kind: 'rect',
    x: 0,
    y: 0,
    width: W,
    height: canvasH,
    fill: bg,
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    const titlePx = ptToPx(theme.typography.fontSizeTitle);
    const titleAlign = theme.typography.titleAlign ?? 'center';
    const titleX = titleAlign === 'left' ? theme.canvas.margin.left : rhu(W / 2);
    const titleAnchor = titleAlign === 'left' ? 'start' : 'middle';
    const titleY = rhu(HEADER_V_PAD + titlePx * 0.8);

    primitives.push({
      kind: 'text',
      x: titleX,
      y: titleY,
      text: ir.metadata.title,
      fontFamily: FONT_FAM,
      fontSize: titlePx,
      fontWeight: theme.typography.fontWeightHeader,
      fill: theme.typography.titleColor,
      textAnchor: titleAnchor,
      dominantBaseline: 'hanging',
    });

    if (ir.metadata.subtitle) {
      const subPx = ptToPx(theme.typography.fontSizeSubtitle);
      const subY = rhu(titleY + rhuInt(titlePx * 1.4) + 4);
      primitives.push({
        kind: 'text',
        x: titleX,
        y: subY,
        text: ir.metadata.subtitle,
        fontFamily: FONT_FAM,
        fontSize: subPx,
        fontWeight: theme.typography.fontWeightAxis,
        fill: theme.milestone.dateLabelColor,
        textAnchor: titleAnchor,
        dominantBaseline: 'hanging',
      });
    }
  }

  if (ir.metadata.logo) {
    const logo = ir.metadata.logo;
    const logoW = logo.width ?? 100;
    const logoH = logo.height ?? 32;
    const asset = loadImageAsset(logo.src, baseDir);
    if (asset) {
      const logoY = rhu((headerH - logoH) / 2);
      primitives.push({
        kind: 'image',
        x: rhu(theme.canvas.margin.left),
        y: logoY,
        width: logoW,
        height: logoH,
        data: asset.dataUri,
        mimeType: asset.mimeType,
      });
    }
  }

  // ── Path rendering ─────────────────────────────────────────────────────────
  const GRADIENT_SEGS = 64;
  const pathD = buildPathD(geo);

  primitives.push({
    kind: 'path',
    d: pathD,
    fill: 'none',
    stroke: sTheme.gradientFrom,
    strokeWidth: rhu(sTheme.pathStrokeWidth + 4),
    strokeLinecap: 'round',
    opacity: 0.6,
    transform: 'translate(0,0)',
    effects: [{ kind: 'glow', color: sTheme.glowColor, radius: sTheme.glowRadius }],
  });

  for (let i = 0; i < GRADIENT_SEGS; i++) {
    const s0 = (i / GRADIENT_SEGS) * totalLength;
    const s1 = ((i + 1) / GRADIENT_SEGS) * totalLength;
    const t_mid = (i + 0.5) / GRADIENT_SEGS;
    const color = lerpColor(sTheme.gradientFrom, sTheme.gradientTo, t_mid);
    const p0 = pathPointAtS(s0, geo);
    const p1 = pathPointAtS(s1, geo);
    primitives.push({
      kind: 'path',
      d: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`,
      fill: 'none',
      stroke: color,
      strokeWidth: sTheme.pathStrokeWidth,
      strokeLinecap: 'round',
    });
  }

  // ── Entry dot nodes ────────────────────────────────────────────────────────
  const nodeR = sTheme.nodeRadius;
  const showLabels = sTheme.showLabels !== false;
  const labelColor = sTheme.labelColor ?? theme.milestone.titleLabelColor;
  const labelFontPx = ptToPx(sTheme.labelFontSize ?? 9);
  const labelFontSize = rhu(labelFontPx);

  function rowForS(s: number): number {
    const L_turn_val = Math.PI * r;
    let remaining = Math.max(0, s);
    for (let row = 0; row < nRows; row++) {
      if (remaining <= ROW_W + 1e-9) return row;
      remaining -= ROW_W;
      if (row < nRows - 1) {
        if (remaining <= L_turn_val + 1e-9) return row;
        remaining -= L_turn_val;
      }
    }
    return nRows - 1;
  }

  if (n > 0) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const s = rhu(t * totalLength);
      const pt = pathPointAtS(s, geo);

      primitives.push({
        kind: 'circle',
        cx: pt.x,
        cy: pt.y,
        r: nodeR,
        fill: sTheme.nodeFill,
        stroke: sTheme.nodeStroke,
        strokeWidth: sTheme.nodeStrokeWidth,
      });

      if (showLabels) {
        const entry = entries[i]!;
        const row = rowForS(s);
        const isEvenRow = row % 2 === 0;
        const labelOffsetY = isEvenRow
          ? rhu(pt.y + nodeR + 4 + labelFontPx * 0.8)
          : rhu(pt.y - nodeR - 4);
        const labelText = entry.label.length > 16 ? `${entry.label.slice(0, 14)}…` : entry.label;

        primitives.push({
          kind: 'text',
          x: pt.x,
          y: labelOffsetY,
          text: labelText,
          fontFamily: FONT_FAM,
          fontSize: labelFontSize,
          fontWeight: theme.typography.fontWeightLabel,
          fill: labelColor,
          textAnchor: 'middle',
          dominantBaseline: isEvenRow ? 'hanging' : 'alphabetic',
        });
      }
    }
  }

  // ── Icon badges at path start and end ──────────────────────────────────────
  const badgeR = sTheme.badgeRadius;
  const badgeFill = sTheme.badgeFill;
  const badgeIconColor = sTheme.badgeIconColor;
  const ICON_SCALE = 0.65;

  function renderBadge(cx: number, cy: number, iconName?: string): void {
    primitives.push({
      kind: 'circle',
      cx,
      cy,
      r: badgeR,
      fill: badgeFill,
      stroke: badgeFill,
      strokeWidth: 2,
    });

    if (iconName) {
      const iconDef = getIcon(iconName);
      if (iconDef) {
        const s_icon = rhu(ICON_SCALE * (badgeR * 2) / 24);
        const iconTx = rhu(cx - 12 * s_icon);
        const iconTy = rhu(cy - 12 * s_icon);
        const transform = `translate(${iconTx},${iconTy}) scale(${s_icon})`;
        for (const path of iconDef.paths) {
          primitives.push({
            kind: 'path',
            d: path.d,
            fill: path.fill ? badgeIconColor : 'none',
            stroke: path.stroke !== false ? badgeIconColor : undefined,
            strokeWidth: path.stroke !== false ? rhu(1.5 / s_icon) : undefined,
            strokeLinecap: 'round',
            transform,
          });
        }
      }
    }
  }

  const startPt = pathPointAtS(0, geo);
  if (sTheme.startIcon) {
    renderBadge(startPt.x, startPt.y, sTheme.startIcon);
  }

  const endPt = pathPointAtS(totalLength, geo);
  if (sTheme.endIcon) {
    renderBadge(endPt.x, endPt.y, sTheme.endIcon);
  }

  return {
    width: W,
    height: canvasH,
    background: bg,
    primitives,
  };
}
