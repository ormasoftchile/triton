/**
 * @file diagrams/xychart/layout.ts — Cartesian bar + line chart.
 *
 * Categorical x-axis, numeric y-axis with gridlines and ticks. Bar series are
 * grouped per category; line series are drawn as polylines with dots on top.
 * Series colours come from the shared categorical hue cycle.
 */

import type { XYChartDocument, XYSeries } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { categoricalHue } from '../../palette/categorical.js';
import { measureText } from '../../text/metrics.js';
import { rhu, rhuInt } from '../../util/round.js';

/** Pick ~5 "nice" tick values spanning [min, max]. */
function niceTicks(min: number, max: number): number[] {
  const span = max - min || 1;
  const rawStep = span / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function fmtTick(n: number): string {
  if (Math.abs(n) >= 1000) return `${n / 1000}k`;
  return String(n);
}

export function layoutXYChart(ir: XYChartDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const cats    = ir.categories;
  const nCats   = Math.max(cats.length, 1);
  const series  = ir.series;
  const barSeries  = series.filter(s => s.kind === 'bar');
  const lineSeries = series.filter(s => s.kind === 'line');

  // ── Y range ────────────────────────────────────────────────────────────────
  const allVals = series.flatMap(s => s.values as number[]);
  const dataMin = allVals.length ? Math.min(...allVals) : 0;
  const dataMax = allVals.length ? Math.max(...allVals) : 1;
  const yMin = ir.yMin ?? Math.min(0, dataMin);
  const yMax = ir.yMax ?? (dataMax > 0 ? dataMax * 1.1 : 1);
  const ticks = niceTicks(yMin, yMax);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 18 : 0;
  const tickFont = typography.smallFontSize;
  const tickW  = Math.max(...ticks.map(t => measureText(fmtTick(t), tickFont).width), 0);
  const yLabelW = ir.yLabel ? typography.baseFontSize + 6 : 0;

  const plotLeft   = margin + yLabelW + tickW + 10;
  const plotTop    = margin + titleH;
  const plotH      = 360;
  const plotBottom = plotTop + plotH;
  const bandW      = 78;
  const plotW      = bandW * nCats;
  const plotRight  = plotLeft + plotW;

  const yToPx = (v: number): number => rhu(plotBottom - ((v - yMin) / (yMax - yMin || 1)) * plotH);
  const catX  = (i: number): number => plotLeft + (i + 0.5) * bandW;

  const elements: SceneElement[] = [];

  if (title) {
    elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // ── Gridlines + y ticks ──────────────────────────────────────────────────
  for (const t of ticks) {
    const y = yToPx(t);
    elements.push(p.path(`M ${plotLeft} ${y} L ${plotRight} ${y}`, palette.border, 1, { opacity: 0.5 }));
    elements.push(p.text(fmtTick(t), plotLeft - 8, y + tickFont * 0.35, tickFont, palette.textMuted, { anchor: 'end' }));
  }

  // ── Axes ─────────────────────────────────────────────────────────────────
  elements.push(p.path(`M ${plotLeft} ${plotTop} L ${plotLeft} ${plotBottom}`, palette.text, 1.5));
  elements.push(p.path(`M ${plotLeft} ${plotBottom} L ${plotRight} ${plotBottom}`, palette.text, 1.5));

  if (ir.yLabel) {
    const ly = rhuInt(plotTop + plotH / 2);
    const lx = margin + typography.baseFontSize;
    elements.push(p.text(ir.yLabel, lx, ly, typography.baseFontSize, palette.textMuted, { anchor: 'middle', weight: 'bold' }));
    // rotate via group transform
    const last = elements.pop()!;
    elements.push(p.group([last], { transform: `rotate(-90 ${lx} ${ly})` }));
  }

  // ── Bars (grouped per category) ──────────────────────────────────────────
  const nBars = Math.max(barSeries.length, 1);
  const groupW = bandW * 0.62;
  const barW   = groupW / nBars;
  barSeries.forEach((s, si) => {
    const color = categoricalHue(si);
    (s.values as number[]).forEach((v, i) => {
      const x = catX(i) - groupW / 2 + si * barW;
      const y = yToPx(v);
      const h = yToPx(yMin) - y;
      if (h > 0) elements.push(p.rect({ x: rhu(x), y, width: rhu(barW - 2), height: rhu(h) }, color, color, 0, { rx: 2 }));
    });
  });

  // ── Lines (drawn on top) ─────────────────────────────────────────────────
  lineSeries.forEach((s, si) => {
    const color = categoricalHue(barSeries.length + si);
    const pts = (s.values as number[]).map((v, i) => `${rhu(catX(i))} ${yToPx(v)}`);
    if (pts.length) {
      elements.push(p.path(`M ${pts.join(' L ')}`, color, 2.5));
      (s.values as number[]).forEach((v, i) => {
        elements.push(p.circle({ x: rhu(catX(i)), y: yToPx(v) }, 4, color, palette.background, 1.5));
      });
    }
  });

  // ── X category labels ────────────────────────────────────────────────────
  cats.forEach((c, i) => {
    elements.push(p.text(c, rhu(catX(i)), plotBottom + tickFont + 8, tickFont, palette.textMuted, { anchor: 'middle' }));
  });

  const totalW = rhuInt(plotRight + margin);
  const totalH = rhuInt(plotBottom + tickFont + 16 + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
