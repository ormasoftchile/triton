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
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { rhuInt } from '../../../util/round.js';
import { pen } from '../../../scene/build.js';
import { measureText } from '../../../text/metrics.js';
import { truncateText } from '../../../text/wrap.js';
import { startOrdinal, endOrdinal, formatDate } from '../../../time/dates.js';
import { statusColor } from './shared.js';

const leftOrd = startOrdinal;
const rightOrd = endOrdinal;
const fmtDate = (date: string): string => formatDate(date, 'axis');

interface Pill { label: string; startOrd: number; endOrd: number; color: string; lane: number; }

export function layoutRoadmap(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const draw = pen(theme);
  const margin = spacing.diagramMargin;

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
    return { label: a.label, startOrd: s, endOrd: e, color: statusColor(palette, a.status), lane };
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
    elements.push(draw.text(ir.metadata.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold', anchor: 'start' }));
  }

  // ── Band background ────────────────────────────────────────────────────────
  elements.push(draw.rect({ x: axisLeft, y: bandTop, width: axisW, height: bandH }, palette.surface, palette.border, 1, { rx: 6 }));

  // ── Activity pills ─────────────────────────────────────────────────────────
  const pillFont = typography.smallFontSize;
  for (const p of pills) {
    const x1 = dateX(p.startOrd), x2 = dateX(p.endOrd);
    const px = x1, pw = Math.max(14, x2 - x1);
    const py = bandTop + p.lane * (laneH + lanePad);
    elements.push(draw.rect({ x: px, y: py, width: pw, height: laneH }, p.color, p.color, 0, { rx: 6 }));
    const label = truncateText(p.label, pillFont, pw - 12);
    if (label && measureText(label, pillFont).width <= pw - 8) {
      elements.push(draw.text(label, px + pw / 2, py + laneH / 2 + pillFont * 0.35, pillFont, palette.background, { weight: 'bold', anchor: 'middle' }));
    }
  }

  // ── Milestone callouts (above band) ────────────────────────────────────────
  for (const m of miles) {
    const mx = dateX(leftOrd(m.date));
    const labelY = margin + headerH + typography.baseFontSize;
    elements.push(draw.text(m.label, mx, labelY, typography.baseFontSize, palette.text, { weight: 'bold', anchor: 'middle' }));
    elements.push(draw.text(`(${fmtDate(m.date)})`, mx, labelY + typography.smallFontSize + 2, typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
    // leader line down to band top + dot
    elements.push(draw.path(`M ${mx} ${labelY + typography.smallFontSize + 6} L ${mx} ${bandTop}`, palette.border, 1));
    elements.push(draw.circle({ x: mx, y: bandTop }, 4, palette.primary, palette.background, 1.5));
  }

  // ── Date axis ──────────────────────────────────────────────────────────────
  elements.push(draw.path(`M ${axisLeft} ${axisY} L ${axisRight} ${axisY}`, palette.border, 1.5));
  const axisDates = new Set<string>();
  for (const m of miles) axisDates.add(m.date);
  for (const a of acts) { axisDates.add(a.start); if (a.end) axisDates.add(a.end); }
  for (const d of axisDates) {
    const x = dateX(leftOrd(d));
    elements.push(draw.path(`M ${x} ${axisY - 3} L ${x} ${axisY + 3}`, palette.border, 1));
    elements.push(draw.text(fmtDate(d), x, axisY + typography.smallFontSize + 2, typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
  }

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: W, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
