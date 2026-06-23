/**
 * @file diagrams/gantt/layout.ts — Classic Gantt chart.
 *
 * One row per task, grouped under section bands, against a date grid. Bars span
 * start→end on a day-ordinal axis (shared time/dates utilities); status maps to
 * the semantic palette; zero-duration tasks render as milestone diamonds.
 */

import type { GanttDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { statusColor } from '../timeline/shared.js';
import { startOrdinal, inferAxisUnit, enumTicks, formatTickLabel } from '../../time/dates.js';
import { truncateText } from '../../text/wrap.js';
import { rhu, rhuInt } from '../../util/round.js';

export function layoutGantt(ir: GanttDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  // ── Date range ─────────────────────────────────────────────────────────────
  const ords: number[] = [];
  for (const sec of ir.sections) for (const t of sec.tasks) { ords.push(startOrdinal(t.start), startOrdinal(t.end)); }
  if (ords.length === 0) ords.push(0, 30);
  const minOrd = Math.min(...ords);
  const maxOrd = Math.max(...ords);
  const span   = Math.max(1, maxOrd - minOrd);
  const unit   = inferAxisUnit(span);
  const ticks  = enumTicks(minOrd, maxOrd, unit);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const title   = ir.metadata.title;
  const titleH  = title ? typography.titleFontSize + 18 : 0;
  const leftColW = 230;
  const gridLeft = margin + leftColW;
  const gridW    = 720;
  const gridRight = gridLeft + gridW;
  const axisH    = 26;
  const rowH     = 26;
  const rowGap   = 4;
  const secHdrH  = 26;

  const gridTop = margin + titleH + axisH;
  const dateX = (ord: number): number => rhu(gridLeft + ((ord - minOrd) / span) * gridW);

  const elements: SceneElement[] = [];

  if (title) {
    elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // ── Compute total height first (for full-height gridlines) ────────────────
  let rowCount = 0;
  for (const sec of ir.sections) rowCount += 1 + sec.tasks.length;
  const bodyH = rowCount * (rowH + rowGap);
  const gridBottom = gridTop + bodyH;

  // ── Date gridlines + axis labels ──────────────────────────────────────────
  ticks.forEach((t, i) => {
    const x = dateX(t.ordinal);
    elements.push(p.path(`M ${x} ${gridTop} L ${x} ${gridBottom}`, palette.border, 1, { opacity: 0.4 }));
    elements.push(p.text(formatTickLabel(t, unit, i), x, margin + titleH + axisH - 8, typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
  });
  // axis baseline
  elements.push(p.path(`M ${gridLeft} ${gridTop} L ${gridRight} ${gridTop}`, palette.border, 1.5));

  // ── Rows ───────────────────────────────────────────────────────────────────
  let y = gridTop;
  for (const sec of ir.sections) {
    // Section header band
    elements.push(p.rect({ x: margin, y, width: leftColW + gridW, height: secHdrH }, palette.surface, palette.surface, 0));
    elements.push(p.text(sec.label, margin + 6, y + secHdrH / 2 + typography.baseFontSize * 0.35, typography.baseFontSize, palette.text, { weight: 'bold' }));
    y += secHdrH + rowGap;

    for (const task of sec.tasks) {
      const x0 = dateX(startOrdinal(task.start));
      const color = statusColor(palette, task.status === 'crit' ? 'blocked' : task.status);

      // Task name (left column)
      elements.push(p.text(truncateText(task.label, typography.smallFontSize, leftColW - 12), margin + 4, y + rowH / 2 + typography.smallFontSize * 0.35, typography.smallFontSize, palette.text));

      if (task.isMilestone) {
        const cx = x0, cy = y + rowH / 2, r = 8;
        elements.push(p.path(`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`, palette.background, 1.5, { fill: color }));
      } else {
        const x1 = dateX(startOrdinal(task.end));
        const barW = Math.max(4, x1 - x0);
        elements.push(p.rect({ x: x0, y: y + 4, width: rhu(barW), height: rowH - 8 }, color, color, 0, { rx: 3 }));
      }
      y += rowH + rowGap;
    }
  }

  const totalW = rhuInt(gridRight + margin);
  const totalH = rhuInt(gridBottom + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
