/**
 * @file grammars/chart/axes.ts — Deterministic axis and gridline emitters.
 */

import type { ScenePrimitive } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';
import type { ChartTheme } from './theme.js';
import { BandScale, LinearScale } from './scales.js';

export interface PlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function formatTick(value: string | number): string {
  if (typeof value === 'string') return value;
  if (Math.abs(value) >= 1000) return Number(value.toFixed(0)).toString();
  if (Math.abs(value) >= 10) return Number(value.toFixed(1)).toString().replace(/\.0$/, '');
  return Number(value.toFixed(2)).toString().replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
}

export function generateGridlines(
  scale: LinearScale,
  plotArea: PlotArea,
  theme: ChartTheme,
): ScenePrimitive[] {
  return scale.ticks(5).map((tick) => ({
    kind: 'line' as const,
    x1: plotArea.x,
    y1: scale.scale(tick),
    x2: plotArea.x + plotArea.width,
    y2: scale.scale(tick),
    stroke: theme.gridlineColor,
    strokeWidth: 1,
    dashArray: theme.gridlineDash,
    opacity: 0.9,
  }));
}

export function generateXAxis(
  scale: LinearScale | BandScale,
  plotArea: PlotArea,
  theme: ChartTheme,
  title?: string,
): ScenePrimitive[] {
  const y = plotArea.y + plotArea.height;
  const primitives: ScenePrimitive[] = [
    {
      kind: 'line',
      x1: plotArea.x,
      y1: y,
      x2: plotArea.x + plotArea.width,
      y2: y,
      stroke: theme.axisColor,
      strokeWidth: theme.axisStrokeWidth,
    },
  ];

  if (scale instanceof BandScale) {
    const labels = scale.domain.map((value) => String(value));
    const widest = labels.reduce((acc, label) => Math.max(acc, measureText(label, theme.tickLabelFontSize).width), 0);
    const step = scale.bandwidth() > 0 ? Math.max(1, Math.ceil(widest / Math.max(scale.bandwidth(), 1))) : 1;

    for (let i = 0; i < scale.domain.length; i++) {
      const value = scale.domain[i]!;
      const cx = scale.scale(value);
      primitives.push({
        kind: 'line',
        x1: cx,
        y1: y,
        x2: cx,
        y2: y + theme.tickLength,
        stroke: theme.axisColor,
        strokeWidth: theme.axisStrokeWidth,
      });

      if (i % step !== 0) continue;
      primitives.push({
        kind: 'text',
        x: cx,
        y: y + theme.tickLength + theme.tickLabelFontSize + 4,
        text: labels[i]!,
        fontFamily: theme.fontFamily,
        fontSize: theme.tickLabelFontSize,
        fontWeight: 400,
        fill: theme.tickLabelColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      });
    }
  } else {
    for (const tick of scale.ticks(6)) {
      const x = scale.scale(tick);
      primitives.push({
        kind: 'line',
        x1: x,
        y1: y,
        x2: x,
        y2: y + theme.tickLength,
        stroke: theme.axisColor,
        strokeWidth: theme.axisStrokeWidth,
      });
      primitives.push({
        kind: 'text',
        x,
        y: y + theme.tickLength + theme.tickLabelFontSize + 4,
        text: formatTick(tick),
        fontFamily: theme.fontFamily,
        fontSize: theme.tickLabelFontSize,
        fontWeight: 400,
        fill: theme.tickLabelColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      });
    }
  }

  if (title) {
    primitives.push({
      kind: 'text',
      x: plotArea.x + plotArea.width / 2,
      y: y + theme.tickLength + theme.tickLabelFontSize + theme.axisTitleFontSize + 18,
      text: title,
      fontFamily: theme.fontFamily,
      fontSize: theme.axisTitleFontSize,
      fontWeight: 600,
      fill: theme.axisTitleColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    });
  }

  return primitives;
}

export function generateYAxis(
  scale: LinearScale,
  plotArea: PlotArea,
  theme: ChartTheme,
  title?: string,
): ScenePrimitive[] {
  const x = plotArea.x;
  const primitives: ScenePrimitive[] = [
    {
      kind: 'line',
      x1: x,
      y1: plotArea.y,
      x2: x,
      y2: plotArea.y + plotArea.height,
      stroke: theme.axisColor,
      strokeWidth: theme.axisStrokeWidth,
    },
  ];

  for (const tick of scale.ticks(5)) {
    const y = scale.scale(tick);
    primitives.push({
      kind: 'line',
      x1: x - theme.tickLength,
      y1: y,
      x2: x,
      y2: y,
      stroke: theme.axisColor,
      strokeWidth: theme.axisStrokeWidth,
    });
    primitives.push({
      kind: 'text',
      x: x - theme.tickLength - 6,
      y,
      text: formatTick(tick),
      fontFamily: theme.fontFamily,
      fontSize: theme.tickLabelFontSize,
      fontWeight: 400,
      fill: theme.tickLabelColor,
      textAnchor: 'end',
      dominantBaseline: 'middle',
    });
  }

  if (title) {
    primitives.push({
      kind: 'text',
      x: plotArea.x,
      y: plotArea.y - 10,
      text: title,
      fontFamily: theme.fontFamily,
      fontSize: theme.axisTitleFontSize,
      fontWeight: 600,
      fill: theme.axisTitleColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    });
  }

  return primitives;
}
