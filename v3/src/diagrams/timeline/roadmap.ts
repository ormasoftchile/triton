/**
 * @file diagrams/timeline/roadmap.ts — Roadmap infographic layout.
 *
 * Four horizontal zones (top→bottom):
 *   1. Header     — title.
 *   2. Callouts   — milestone labels + (date), leader line + dot down to band.
 *   3. Phase band — activity pills from dateX(start)→dateX(end), status-coloured,
 *                   lane-packed so overlapping ranges stack instead of collide.
 *   4. Date axis  — baseline with date labels at milestone x positions.
 *
 * Built on the GENERAL time/dates + text/metrics modules. Linear date mapping
 * (no axis breaks in v1). Uses only shared theme tokens.
 */

import type { TimelineDocument, Activity, Milestone } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { compileOverlays } from '../../overlay/compiler.js';
import { layoutOverlays } from '../../overlay/layout.js';
import { measureText } from '../../text/metrics.js';
import { truncateText } from '../../text/wrap.js';
import {
  parseIRDate, coerceLeft, coerceRight, dateToOrdinal,
} from '../../time/dates.js';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rhuInt(v: number): number { return Math.floor(v + 0.5); }

function leftOrd(date: string): number {
  try { const [y, m, d] = coerceLeft(parseIRDate(date)); return dateToOrdinal(y, m, d); } catch { return 0; }
}
function rightOrd(date: string): number {
  try { const [y, m, d] = coerceRight(parseIRDate(date)); return dateToOrdinal(y, m, d); } catch { return 0; }
}
function fmtDate(date: string): string {
  try {
    const p = parseIRDate(date);
    switch (p.precision) {
      case 'day':     return `${MONTH_ABBR[(p.month ?? 1) - 1]} ${p.day}`;
      case 'month':   return `${MONTH_ABBR[(p.month ?? 1) - 1]} ${p.year}`;
      case 'quarter': return `Q${p.quarter} ${p.year}`;
      case 'half':    return `H${p.half} ${p.year}`;
      case 'year':    return String(p.year);
    }
  } catch { /* noop */ }
  return date;
}

interface Pill { label: string; startOrd: number; endOrd: number; color: string; lane: number; }

export function layoutRoadmap(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const margin = spacing.diagramMargin;

  const statusColor = (s?: string): string => {
    switch (s) {
      case 'done':    return palette.success;
      case 'active':  return palette.primary;
      case 'blocked': return palette.error;
      default:        return palette.secondary;
    }
  };

  // ── Time range ─────────────────────────────────────────────────────────────
  const acts = ir.activities as readonly Activity[];
  const miles = ir.milestones as readonly Milestone[];
  const allOrds: number[] = [];
  for (const a of acts) { allOrds.push(leftOrd(a.start), rightOrd(a.end ?? a.start)); }
  for (const m of miles) allOrds.push(leftOrd(m.date));
  if (allOrds.length === 0) allOrds.push(0, 1);
  const minOrd = Math.min(...allOrds);
  const maxOrd = Math.max(...allOrds);
  const span = Math.max(1, maxOrd - minOrd);

  // ── Canvas + axis geometry ─────────────────────────────────────────────────
  const W         = 1040;
  const axisLeft  = margin + 10;
  const axisRight = W - margin - 10;
  const axisW     = axisRight - axisLeft;
  const dateX = (ord: number): number => rhuInt(axisLeft + ((ord - minOrd) / span) * axisW);

  // ── Lane-pack activities (avoid overlap) ───────────────────────────────────
  const sorted = [...acts].sort((a, b) => leftOrd(a.start) - leftOrd(b.start));
  const laneEnds: number[] = [];
  const pills: Pill[] = sorted.map(a => {
    const s = leftOrd(a.start);
    const e = Math.max(rightOrd(a.end ?? a.start), s + Math.round(span / 30)); // min visible width
    let lane = laneEnds.findIndex(end => s >= end);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); }
    else laneEnds[lane] = e;
    return { label: a.label, startOrd: s, endOrd: e, color: statusColor(a.status), lane };
  });
  const numLanes = Math.max(1, laneEnds.length);

  // ── Vertical zones ─────────────────────────────────────────────────────────
  const headerH   = ir.metadata.title ? typography.titleFontSize + 20 : 8;
  const calloutH  = miles.length ? 56 : 12;
  const laneH     = 34;
  const lanePad   = 6;
  const bandTop   = margin + headerH + calloutH;
  const bandH     = numLanes * laneH + (numLanes - 1) * lanePad;
  const bandBot   = bandTop + bandH;
  const axisY     = bandBot + 26;
  const totalH    = rhuInt(axisY + typography.smallFontSize + margin);

  const elements: SceneElement[] = [];

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push({
      type: 'text', content: ir.metadata.title,
      position: { x: margin, y: margin + typography.titleFontSize },
      fontSize: typography.titleFontSize, fontFamily: typography.fontFamily,
      fontWeight: 'bold', fill: palette.text, anchor: 'start',
    });
  }

  // ── Band background ────────────────────────────────────────────────────────
  elements.push({
    type: 'rect', bounds: { x: axisLeft, y: bandTop, width: axisW, height: bandH },
    fill: palette.surface, stroke: palette.border, strokeWidth: 1, rx: 6,
  });

  // ── Activity pills ─────────────────────────────────────────────────────────
  const pillFont = typography.smallFontSize;
  for (const p of pills) {
    const x1 = dateX(p.startOrd), x2 = dateX(p.endOrd);
    const px = x1, pw = Math.max(14, x2 - x1);
    const py = bandTop + p.lane * (laneH + lanePad);
    elements.push({
      type: 'rect', bounds: { x: px, y: py, width: pw, height: laneH },
      fill: p.color, stroke: p.color, strokeWidth: 0, rx: 6,
    });
    const label = truncateText(p.label, pillFont, pw - 12);
    if (label && measureText(label, pillFont).width <= pw - 8) {
      elements.push({
        type: 'text', content: label,
        position: { x: px + pw / 2, y: py + laneH / 2 + pillFont * 0.35 },
        fontSize: pillFont, fontFamily: typography.fontFamily,
        fontWeight: 'bold', fill: palette.background, anchor: 'middle',
      });
    }
  }

  // ── Milestone callouts (above band) ────────────────────────────────────────
  for (const m of miles) {
    const mx = dateX(leftOrd(m.date));
    const labelY = margin + headerH + typography.baseFontSize;
    elements.push({
      type: 'text', content: m.label, position: { x: mx, y: labelY },
      fontSize: typography.baseFontSize, fontFamily: typography.fontFamily,
      fontWeight: 'bold', fill: palette.text, anchor: 'middle',
    });
    elements.push({
      type: 'text', content: `(${fmtDate(m.date)})`,
      position: { x: mx, y: labelY + typography.smallFontSize + 2 },
      fontSize: typography.smallFontSize, fontFamily: typography.fontFamily,
      fill: palette.textMuted, anchor: 'middle',
    });
    // leader line down to band top + dot
    elements.push({
      type: 'path', d: `M ${mx} ${labelY + typography.smallFontSize + 6} L ${mx} ${bandTop}`,
      stroke: palette.border, strokeWidth: 1,
    });
    elements.push({
      type: 'circle', center: { x: mx, y: bandTop }, radius: 4,
      fill: palette.primary, stroke: palette.background, strokeWidth: 1.5,
    });
  }

  // ── Date axis ──────────────────────────────────────────────────────────────
  elements.push({
    type: 'path', d: `M ${axisLeft} ${axisY} L ${axisRight} ${axisY}`,
    stroke: palette.border, strokeWidth: 1.5,
  });
  const axisDates = new Set<string>();
  for (const m of miles) axisDates.add(m.date);
  for (const a of acts) { axisDates.add(a.start); if (a.end) axisDates.add(a.end); }
  for (const d of axisDates) {
    const x = dateX(leftOrd(d));
    elements.push({
      type: 'path', d: `M ${x} ${axisY - 3} L ${x} ${axisY + 3}`,
      stroke: palette.border, strokeWidth: 1,
    });
    elements.push({
      type: 'text', content: fmtDate(d),
      position: { x, y: axisY + typography.smallFontSize + 2 },
      fontSize: typography.smallFontSize, fontFamily: typography.fontFamily,
      fill: palette.textMuted, anchor: 'middle',
    });
  }

  let scene: Scene = {
    viewBox: { x: 0, y: 0, width: W, height: totalH },
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
