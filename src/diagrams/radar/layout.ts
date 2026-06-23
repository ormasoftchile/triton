/**
 * @file diagrams/radar/layout.ts — Multi-axis radar (spider) chart.
 *
 * Equiangular spokes (one per axis) from a shared centre, concentric grid
 * rings, and one filled polygon per curve. Curve colours come from the shared
 * categorical hue cycle; a legend lists each curve.
 */

import type { RadarDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { categoricalHue } from '../../palette/categorical.js';
import { measureText } from '../../text/metrics.js';
import { rhu, rhuInt } from '../../util/round.js';

export function layoutRadar(ir: RadarDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const axes = ir.axes;
  const n    = Math.max(axes.length, 1);
  const allVals = ir.curves.flatMap(c => c.values as number[]);
  const min  = ir.min ?? 0;
  const max  = ir.max ?? (allVals.length ? Math.max(...allVals) : 1);
  const span = (max - min) || 1;

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 18 : 0;

  const R    = 180;
  const labelPad = 90;                         // room for axis labels around the ring
  const cx   = margin + labelPad + R;
  const cy   = margin + titleH + labelPad + R;

  // Angle for axis i: start at top (-90°), clockwise.
  const angle = (i: number): number => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const ptAt  = (i: number, frac: number): { x: number; y: number } => ({
    x: cx + Math.cos(angle(i)) * R * frac,
    y: cy + Math.sin(angle(i)) * R * frac,
  });

  const elements: SceneElement[] = [];

  if (title) {
    elements.push(p.text(title, rhuInt(cx), margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold', anchor: 'middle' }));
  }

  // ── Grid rings ─────────────────────────────────────────────────────────────
  const rings = 4;
  for (let r = 1; r <= rings; r++) {
    const frac = r / rings;
    const d = axes.map((_, i) => { const pt = ptAt(i, frac); return `${rhu(pt.x)} ${rhu(pt.y)}`; }).join(' L ');
    elements.push(p.path(`M ${d} Z`, palette.border, 1, { opacity: 0.5 }));
  }

  // ── Spokes + axis labels ───────────────────────────────────────────────────
  axes.forEach((ax, i) => {
    const outer = ptAt(i, 1);
    elements.push(p.path(`M ${rhu(cx)} ${rhu(cy)} L ${rhu(outer.x)} ${rhu(outer.y)}`, palette.border, 1, { opacity: 0.6 }));
    const lp = ptAt(i, 1.12);
    const a  = angle(i);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    elements.push(p.text(ax.label, rhu(lp.x), rhu(lp.y + typography.smallFontSize * 0.35), typography.smallFontSize, palette.text, { anchor }));
  });

  // ── Curves ─────────────────────────────────────────────────────────────────
  ir.curves.forEach((curve, ci) => {
    const color = categoricalHue(ci);
    const pts = axes.map((_, i) => {
      const v = curve.values[i] ?? min;
      const frac = Math.max(0, Math.min(1, (v - min) / span));
      const pt = ptAt(i, frac);
      return `${rhu(pt.x)} ${rhu(pt.y)}`;
    });
    if (pts.length) {
      elements.push(p.path(`M ${pts.join(' L ')} Z`, color, 2, { fill: color, opacity: 0.18 }));
      elements.push(p.path(`M ${pts.join(' L ')} Z`, color, 2));
    }
  });

  // ── Legend ─────────────────────────────────────────────────────────────────
  const legendFont = typography.baseFontSize;
  const swatch = 12;
  const legendX = cx + R + labelPad - 30;
  const legendTop = margin + titleH;
  let legendW = 0;
  ir.curves.forEach((curve, ci) => {
    const ly = legendTop + ci * (legendFont + 10);
    elements.push(p.rect({ x: legendX, y: ly, width: swatch, height: swatch }, categoricalHue(ci), categoricalHue(ci), 0, { rx: 2 }));
    elements.push(p.text(curve.label, legendX + swatch + 8, ly + swatch - 2, legendFont, palette.text));
    legendW = Math.max(legendW, swatch + 8 + measureText(curve.label, legendFont).width);
  });

  const ringRight = cx + R + labelPad;
  const totalW = rhuInt(Math.max(ringRight, legendX + legendW) + margin);
  const totalH = rhuInt(cy + R + labelPad + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
