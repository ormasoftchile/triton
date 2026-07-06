/**
 * @file diagrams/quadrant/layout.ts — Four-quadrant scatter.
 *
 * A square plot split into four tinted quadrants with crossed axes, quadrant
 * captions, edge axis labels, and positioned points (normalized 0..1). Quadrant
 * tints come from the shared categorical hue cycle at low opacity.
 */

import type { QuadrantDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { rhu, rhuInt } from '../../../util/round.js';

export function layoutQuadrant(ir: QuadrantDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 18 : 0;

  const side      = 460;
  const axisPad   = 30;                         // room for edge axis labels
  const plotLeft  = margin + axisPad;
  const plotTop   = margin + titleH;
  const plotRight = plotLeft + side;
  const plotBot   = plotTop + side;
  const midX      = rhuInt((plotLeft + plotRight) / 2);
  const midY      = rhuInt((plotTop + plotBot) / 2);
  const half      = side / 2;

  const px = (x: number): number => rhu(plotLeft + x * side);
  const py = (y: number): number => rhu(plotBot - y * side);

  const elements: SceneElement[] = [];

  if (title) {
    elements.push(p.text(title, rhuInt((plotLeft + plotRight) / 2), margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold', anchor: 'middle' }));
  }

  // ── Quadrant tints (q1 TR, q2 TL, q3 BL, q4 BR) ───────────────────────────
  const quads: Array<{ x: number; y: number; hue: number }> = [
    { x: midX,     y: plotTop, hue: 0 }, // q1 top-right
    { x: plotLeft, y: plotTop, hue: 1 }, // q2 top-left
    { x: plotLeft, y: midY,    hue: 2 }, // q3 bottom-left
    { x: midX,     y: midY,    hue: 3 }, // q4 bottom-right
  ];
  quads.forEach((q, i) => {
    elements.push(p.rect({ x: q.x, y: q.y, width: half, height: half }, categoricalHue(q.hue), categoricalHue(q.hue), 0, { opacity: 0.12 }));
    const label = ir.quadrants[i];
    if (label) {
      elements.push(p.text(label, rhuInt(q.x + half / 2), q.y + typography.baseFontSize + 12, typography.baseFontSize, categoricalHue(q.hue), { weight: 'bold', anchor: 'middle' }));
    }
  });

  // ── Plot border + crossing axes ──────────────────────────────────────────
  elements.push(p.rect({ x: plotLeft, y: plotTop, width: side, height: side }, 'none', palette.border, 1.5));
  elements.push(p.path(`M ${midX} ${plotTop} L ${midX} ${plotBot}`, palette.border, 1, { dash: '4 4' }));
  elements.push(p.path(`M ${plotLeft} ${midY} L ${plotRight} ${midY}`, palette.border, 1, { dash: '4 4' }));

  // ── Points ───────────────────────────────────────────────────────────────
  const dotFont = typography.smallFontSize;
  for (const pt of ir.points) {
    const x = px(pt.x), y = py(pt.y);
    elements.push(p.circle({ x, y }, 5, palette.primary, palette.background, 1.5));
    elements.push(p.text(pt.label, x + 9, y + dotFont * 0.35, dotFont, palette.text));
  }

  // ── Edge axis labels ─────────────────────────────────────────────────────
  const axFont = typography.smallFontSize;
  const xY = plotBot + axFont + 8;
  if (ir.xAxisLeft)  elements.push(p.text(ir.xAxisLeft,  plotLeft,  xY, axFont, palette.textMuted, { anchor: 'start' }));
  if (ir.xAxisRight) elements.push(p.text(ir.xAxisRight, plotRight, xY, axFont, palette.textMuted, { anchor: 'end' }));

  const yLx = margin + axFont;
  if (ir.yAxisBottom) {
    const yy = plotBot;
    elements.push(p.group([p.text(ir.yAxisBottom, yLx, yy, axFont, palette.textMuted, { anchor: 'start' })], { transform: `rotate(-90 ${yLx} ${yy})` }));
  }
  if (ir.yAxisTop) {
    const yy = plotTop;
    elements.push(p.group([p.text(ir.yAxisTop, yLx, yy, axFont, palette.textMuted, { anchor: 'end' })], { transform: `rotate(-90 ${yLx} ${yy})` }));
  }

  const totalW = rhuInt(plotRight + margin);
  const totalH = rhuInt(plotBot + axFont + 16 + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
