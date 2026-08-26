/**
 * @file diagrams/pie/layout.ts — Proportional pie chart.
 *
 * Sectors sized by value share, coloured from the shared categorical hue
 * cycle, with a value/percentage legend to the right. Reads only shared theme
 * tokens; geometry rounds half-up for deterministic output.
 */

import type { PieDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { measureText } from '../../../text/metrics.js';
import { rhu, rhuInt } from '../../../util/round.js';
import { readableText } from '../../../theme/contrast.js';

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function layoutPie(ir: PieDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const titleH = ir.metadata.title ? typography.titleFontSize + 20 : 0;
  const slices = ir.slices;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;

  const R = 110;
  const cx = margin + R;
  const cy = margin + titleH + R;

  // ── Legend measurement ───────────────────────────────────────────────────
  const legendFont = typography.smallFontSize;
  const legendLabels = slices.map((s) => (ir.showData ? `${s.label} [${s.value}]` : s.label));
  const legendTextW = legendLabels.reduce(
    (m, l) => Math.max(m, measureText(l, legendFont).width),
    0,
  );
  const swatch = 10;
  const legendGap = 8;
  const legendX = cx + R + 36;
  const rowH = 20;
  const legendTop = cy - (slices.length * rowH) / 2;

  const elements: SceneElement[] = [];

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    const totalWEst = legendX + legendTextW + swatch + legendGap + margin;
    elements.push(
      p.text(
        ir.metadata.title,
        rhuInt(totalWEst / 2),
        margin + typography.titleFontSize,
        typography.titleFontSize,
        palette.text,
        { weight: 'bold', anchor: 'middle' },
      ),
    );
  }

  // ── Slices ────────────────────────────────────────────────────────────────
  let a0 = -Math.PI / 2; // start at top
  slices.forEach((s, i) => {
    const frac = s.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const color = categoricalHue(i, theme);

    if (slices.length === 1) {
      elements.push(p.circle({ x: cx, y: cy }, R, color, palette.background, 1));
    } else {
      const x0 = rhu(cx + R * Math.cos(a0)),
        y0 = rhu(cy + R * Math.sin(a0));
      const x1 = rhu(cx + R * Math.cos(a1)),
        y1 = rhu(cy + R * Math.sin(a1));
      const large = frac > 0.5 ? 1 : 0;
      const d = `M ${rhu(cx)} ${rhu(cy)} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
      elements.push(p.path(d, palette.background, 1, { fill: color }));
    }

    // Percentage label inside the slice (skip slivers).
    const pct = frac * 100;
    if (pct >= 4) {
      const am = (a0 + a1) / 2;
      const lr = R * 0.62;
      elements.push(
        p.text(
          `${pct.toFixed(0)}%`,
          rhu(cx + lr * Math.cos(am)),
          rhu(cy + lr * Math.sin(am) + typography.smallFontSize * 0.35),
          typography.smallFontSize,
          readableText(color, theme),
          { weight: 'bold', anchor: 'middle' },
        ),
      );
    }
    a0 = a1;
  });

  // ── Legend ───────────────────────────────────────────────────────────────
  slices.forEach((s, i) => {
    const ly = legendTop + i * rowH;
    const swatchColor = categoricalHue(i, theme);
    elements.push(
      p.rect(
        { x: legendX, y: ly, width: swatch, height: swatch },
        swatchColor,
        swatchColor,
        0,
        { rx: 2 },
      ),
    );
    elements.push(
      p.text(
        legendLabels[i]!,
        legendX + swatch + legendGap,
        ly + swatch - 2,
        legendFont,
        palette.text,
      ),
    );
  });

  const totalW = rhuInt(legendX + legendTextW + swatch + legendGap + margin);
  const totalH = rhuInt(Math.max(cy + R, legendTop + slices.length * rowH) + margin);

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: 0, y: 0, width: totalW, height: totalH },
      background: palette.background,
      elements,
    },
    ir.overlays,
    theme,
  );

  return { scene, anchors: {} };
}
