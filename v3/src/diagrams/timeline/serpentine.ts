/**
 * @file diagrams/timeline/serpentine.ts — Serpentine (boustrophedon) layout.
 *
 * A single winding track runs left→right, U-turns down, right→left, U-turns, …
 * Entries (milestones + activities, by start date) are placed at uniform
 * arc-length positions t_i = (i + 0.5) / n along the path. A play cap marks the
 * start, a target/bullseye cap the end. Labels sit above/below each node by row
 * parity.
 *
 * Built on the GENERAL time/dates module. Uses only shared theme tokens.
 * v3 fidelity notes vs core: solid track (v3 scene has no stroke gradients) and
 * inline play/target caps (no icon registry yet).
 *
 * Determinism: round-half-up, stable (ordinal, id) sort, no clock.
 */

import type { TimelineDocument, Activity, Milestone } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { compileOverlays } from '../../overlay/compiler.js';
import { layoutOverlays } from '../../overlay/layout.js';
import { parseIRDate, coerceLeft, dateToOrdinal } from '../../time/dates.js';

function rhu(v: number, d = 2): number { const f = 10 ** d; return Math.floor(v * f + 0.5) / f; }
function rhuInt(v: number): number { return Math.floor(v + 0.5); }

interface Geo {
  xl: number; xr: number; pathStartY: number;
  nRows: number; rowSpacing: number; turnRadius: number; rowWidth: number; totalLength: number;
}

/** Point (x,y) at arc-length s along the boustrophedon path. */
function pathPointAtS(s: number, geo: Geo): { x: number; y: number } {
  const { xl, xr, pathStartY, nRows, rowSpacing, turnRadius: r, rowWidth } = geo;
  const L_turn = Math.PI * r;
  let remaining = Math.max(0, Math.min(s, geo.totalLength));

  for (let row = 0; row < nRows; row++) {
    const y_row = pathStartY + row * rowSpacing;
    if (remaining <= rowWidth + 1e-9) {
      const t = Math.min(remaining, rowWidth);
      return row % 2 === 0 ? { x: rhu(xl + t), y: rhu(y_row) } : { x: rhu(xr - t), y: rhu(y_row) };
    }
    remaining -= rowWidth;
    if (row < nRows - 1) {
      if (remaining <= L_turn + 1e-9) {
        const alpha = Math.min(remaining, L_turn) / r;
        return row % 2 === 0
          ? { x: rhu(xr + r * Math.sin(alpha)), y: rhu(y_row + r * (1 - Math.cos(alpha))) }
          : { x: rhu(xl - r * Math.sin(alpha)), y: rhu(y_row + r * (1 - Math.cos(alpha))) };
      }
      remaining -= L_turn;
    }
  }
  const lastRow = nRows - 1;
  const y_last = rhu(pathStartY + lastRow * rowSpacing);
  return lastRow % 2 === 0 ? { x: rhu(xr), y: y_last } : { x: rhu(xl), y: y_last };
}

/** SVG path d for the full boustrophedon, smooth arc U-turns. */
function buildPathD(geo: Geo): string {
  const { xl, xr, pathStartY, nRows, rowSpacing, turnRadius: r } = geo;
  const parts: string[] = [];
  for (let row = 0; row < nRows; row++) {
    const y = rhu(pathStartY + row * rowSpacing);
    const y_next = rhu(pathStartY + (row + 1) * rowSpacing);
    if (row === 0) parts.push(`M ${xl} ${y}`);
    if (row % 2 === 0) {
      parts.push(`L ${xr} ${y}`);
      if (row < nRows - 1) parts.push(`A ${r} ${r} 0 1 1 ${xr} ${y_next}`);
    } else {
      parts.push(`L ${xl} ${y}`);
      if (row < nRows - 1) parts.push(`A ${r} ${r} 0 1 0 ${xl} ${y_next}`);
    }
  }
  return parts.join(' ');
}

function startOrd(date: string): number {
  try { const [y, m, d] = coerceLeft(parseIRDate(date)); return dateToOrdinal(y, m, d); }
  catch { return 0; }
}

interface SerpEntry { id: string; label: string; ord: number; color: string; }

export function layoutSerpentine(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography } = theme;

  const statusColor = (s?: string): string => {
    switch (s) {
      case 'done':    return palette.success;
      case 'active':  return palette.primary;
      case 'blocked': return palette.error;
      default:        return palette.secondary;
    }
  };

  // ── Entries ────────────────────────────────────────────────────────────────
  const entries: SerpEntry[] = [];
  for (const m of ir.milestones as readonly Milestone[]) {
    entries.push({ id: m.id, label: m.label, ord: startOrd(m.date), color: palette.primary });
  }
  for (const a of ir.activities as readonly Activity[]) {
    entries.push({ id: a.id, label: a.label, ord: startOrd(a.start), color: statusColor(a.status) });
  }
  entries.sort((p, q) => (p.ord - q.ord) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  const n = entries.length;

  // ── Geometry ─────────────────────────────────────────────────────────────
  const W           = 1040;
  const turnRadius  = 80;
  const rowSpacing  = 160;
  const trackWidth  = 14;
  const nodeR       = 10;
  const badgeR      = 22;
  const PATH_XL     = rhu(turnRadius + 10);
  const PATH_XR     = rhu(W - turnRadius - 10);
  const ROW_W       = rhu(PATH_XR - PATH_XL);

  const nRows       = Math.max(2, Math.ceil(n / 3));
  const headerH     = ir.metadata.title ? typography.titleFontSize + 28 : 0;
  const TOP_PAD     = 64;
  const BOTTOM_PAD  = 64;
  const pathStartY  = rhu(headerH + TOP_PAD);
  const L_turn      = rhu(Math.PI * turnRadius);
  const totalLength = rhu(nRows * ROW_W + (nRows - 1) * L_turn);
  const pathEndY    = rhu(pathStartY + (nRows - 1) * rowSpacing);
  const canvasH     = rhuInt(pathEndY + BOTTOM_PAD);

  const geo: Geo = { xl: PATH_XL, xr: PATH_XR, pathStartY, nRows, rowSpacing, turnRadius, rowWidth: ROW_W, totalLength };

  const elements: SceneElement[] = [];

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push({
      type: 'text', content: ir.metadata.title,
      position: { x: rhu(W / 2), y: rhuInt(typography.titleFontSize + 8) },
      fontSize: typography.titleFontSize, fontFamily: typography.fontFamily,
      fontWeight: 'bold', fill: palette.text, anchor: 'middle',
    });
  }

  // ── Track ─────────────────────────────────────────────────────────────────
  const pathD     = buildPathD(geo);
  const pathStart = pathPointAtS(0, geo);
  const pathEnd   = pathPointAtS(totalLength, geo);

  elements.push({ type: 'path', d: pathD, fill: 'none', stroke: palette.primary, strokeWidth: trackWidth });

  // ── Nodes + labels ────────────────────────────────────────────────────────
  function rowForS(s: number): number {
    let remaining = Math.max(0, s);
    for (let row = 0; row < nRows; row++) {
      if (remaining <= ROW_W + 1e-9) return row;
      remaining -= ROW_W;
      if (row < nRows - 1) { if (remaining <= L_turn + 1e-9) return row; remaining -= L_turn; }
    }
    return nRows - 1;
  }

  const labelFontSize = typography.smallFontSize;
  for (let i = 0; i < n; i++) {
    const s  = rhu(((i + 0.5) / n) * totalLength);
    const pt = pathPointAtS(s, geo);
    const e  = entries[i]!;

    elements.push({
      type: 'circle', center: { x: pt.x, y: pt.y }, radius: nodeR,
      fill: palette.background, stroke: e.color, strokeWidth: 3,
    });

    const isEvenRow = rowForS(s) % 2 === 0;
    const labelY = isEvenRow
      ? rhu(pt.y + nodeR + 6 + labelFontSize * 0.9)
      : rhu(pt.y - nodeR - 8);
    const labelText = e.label.length > 18 ? `${e.label.slice(0, 16)}…` : e.label;
    elements.push({
      type: 'text', content: labelText, position: { x: pt.x, y: labelY },
      fontSize: labelFontSize, fontFamily: typography.fontFamily,
      fill: palette.text, anchor: 'middle',
    });
  }

  // ── Start cap (play triangle) ─────────────────────────────────────────────
  elements.push({
    type: 'circle', center: { x: pathStart.x, y: pathStart.y }, radius: badgeR,
    fill: palette.primary, stroke: palette.primary, strokeWidth: 2,
  });
  {
    const cx = pathStart.x, cy = pathStart.y, t = badgeR * 0.5;
    elements.push({
      type: 'path',
      d: `M ${rhu(cx - t * 0.5)} ${rhu(cy - t)} L ${rhu(cx + t)} ${rhu(cy)} L ${rhu(cx - t * 0.5)} ${rhu(cy + t)} Z`,
      fill: palette.background, stroke: palette.background, strokeWidth: 0,
    });
  }

  // ── End cap (target / bullseye) ───────────────────────────────────────────
  elements.push({
    type: 'circle', center: { x: pathEnd.x, y: pathEnd.y }, radius: badgeR,
    fill: palette.primary, stroke: palette.primary, strokeWidth: 2,
  });
  elements.push({
    type: 'circle', center: { x: pathEnd.x, y: pathEnd.y }, radius: rhu(badgeR * 0.62),
    fill: 'none', stroke: palette.background, strokeWidth: 2.5,
  });
  elements.push({
    type: 'circle', center: { x: pathEnd.x, y: pathEnd.y }, radius: rhu(badgeR * 0.28),
    fill: palette.background, stroke: palette.background, strokeWidth: 0,
  });

  let scene: Scene = {
    viewBox: { x: 0, y: 0, width: W, height: canvasH },
    background: palette.background,
    elements,
  };

  if (ir.overlays && ir.overlays.length > 0) {
    const compiled = compileOverlays(ir.overlays);
    const { elements: overlayEls, viewBox } = layoutOverlays(compiled, scene, theme);
    scene = { ...scene, elements: [...scene.elements, ...overlayEls], viewBox };
  }

  return { scene, anchors: {} };
}
