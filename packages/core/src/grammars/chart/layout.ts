/**
 * @file grammars/chart/layout.ts — Shared chart layout engine.
 */

import type { LinePrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';
import type { ChartDocument } from './types.js';
import type { ChartTheme } from './theme.js';
import { defaultChartTheme } from './theme.js';
import { generateGridlines, generateXAxis, generateYAxis, type PlotArea } from './axes.js';
import { arcMarks, barMarks, lineMarks, pointMarks, type XYMarkDatum } from './marks.js';
import { BandScale, LinearScale, type ScaleValue } from './scales.js';

function rhuInt(value: number): number {
  return Math.floor(value + 0.5);
}

interface PieSlice {
  label: string;
  value: number;
  startAngle: number;
  endAngle: number;
  angle: number;
  color: string;
  index: number;
}

interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function boxFromAnchor(text: string, fontSize: number, x: number, y: number, anchor: 'start' | 'middle' | 'end'): LabelBox {
  const measured = measureText(text, fontSize);
  const w = measured.width;
  const h = measured.height;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { x: left, y: y - h / 2, w, h };
}

function formatValue(value: number): string {
  return Number(value.toFixed(2)).toString().replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
}

function legendPrimitives(
  items: Array<{ label: string; color: string }>,
  x: number,
  y: number,
  theme: ChartTheme,
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  items.forEach((item, index) => {
    const rowY = y + index * (theme.legendSwatchSize + theme.legendGap + 2);
    primitives.push({
      kind: 'rect',
      x,
      y: rowY,
      width: theme.legendSwatchSize,
      height: theme.legendSwatchSize,
      fill: item.color,
      stroke: theme.background,
      strokeWidth: 1,
      rx: 2,
    });
    primitives.push({
      kind: 'text',
      x: x + theme.legendSwatchSize + 8,
      y: rowY + theme.legendSwatchSize / 2 + 1,
      text: item.label,
      fontFamily: theme.fontFamily,
      fontSize: theme.legendFontSize,
      fontWeight: 400,
      fill: theme.tickLabelColor,
      textAnchor: 'start',
      dominantBaseline: 'middle',
    });
  });
  return primitives;
}

function layoutPie(
  doc: ChartDocument,
  plotArea: PlotArea,
  legendX: number,
  theme: ChartTheme,
): ScenePrimitive[] {
  const rawRows = doc.data.values;
  const rows = rawRows.filter((row) => Number(row[doc.encoding.theta?.field ?? 'value'] ?? 0) > 0);
  const innerRadius = Math.max(0, doc.config?.innerRadius ?? 0);
  const cx = plotArea.x + plotArea.width / 2;
  const cy = plotArea.y + plotArea.height / 2;
  const radius = Math.max(24, Math.min(plotArea.width, plotArea.height) / 2 - 20);
  const thetaField = doc.encoding.theta?.field ?? 'value';
  const labelField = doc.encoding.color?.field ?? 'label';
  const arcs = arcMarks(rows, thetaField, theme.piePalette, cx, cy, radius, innerRadius, theme);

  const total = rows.reduce((sum, row) => sum + Number(row[thetaField] ?? 0), 0);
  let runningAngle = -Math.PI / 2;
  const slices: PieSlice[] = rows.map((row, index) => {
    const value = Number(row[thetaField] ?? 0);
    const angle = total > 0 ? (value / total) * Math.PI * 2 : 0;
    const startAngle = runningAngle;
    const endAngle = startAngle + angle;
    runningAngle = endAngle;
    return {
      label: String(row[labelField] ?? `Slice ${index + 1}`),
      value,
      startAngle,
      endAngle,
      angle,
      color: theme.piePalette[index % theme.piePalette.length]!,
      index,
    };
  });

  const placed: LabelBox[] = [];
  const labels: ScenePrimitive[] = [];
  const leaders: LinePrimitive[] = [];
  const showData = doc.config?.showData === true;

  [...slices]
    .sort((a, b) => b.angle - a.angle || a.index - b.index)
    .forEach((slice) => {
      const mid = (slice.startAngle + slice.endAngle) / 2;
      const text = showData ? `${slice.label}: ${formatValue(slice.value)}` : slice.label;
      const smallSlice = slice.angle < 0.2;
      const prefersInside = !smallSlice && slice.angle > 0.4;
      const insideRadius = innerRadius > 0 ? innerRadius + (radius - innerRadius) * 0.45 : radius * 0.7;
      const outsideRadius = radius * 1.15;
      const outsideAnchor: 'start' | 'end' = Math.cos(mid) >= 0 ? 'start' : 'end';

      const insideX = cx + insideRadius * Math.cos(mid);
      const insideY = cy + insideRadius * Math.sin(mid);
      const outsideXBase = cx + outsideRadius * Math.cos(mid);
      let outsideY = cy + outsideRadius * Math.sin(mid);
      const outsideX = outsideAnchor === 'start' ? outsideXBase + 10 : outsideXBase - 10;

      let chosenX = outsideX;
      let chosenY = outsideY;
      let chosenAnchor: 'start' | 'middle' | 'end' = outsideAnchor;
      let leader = smallSlice;
      let labelBox = boxFromAnchor(text, theme.pieLabelFontSize, chosenX, chosenY, chosenAnchor);

      if (prefersInside) {
        const insideBox = boxFromAnchor(text, theme.pieLabelFontSize, insideX, insideY, 'middle');
        if (!placed.some((box) => overlaps(box, insideBox))) {
          chosenX = insideX;
          chosenY = insideY;
          chosenAnchor = 'middle';
          labelBox = insideBox;
          leader = false;
        }
      }

      if (chosenAnchor !== 'middle') {
        const collided = placed.some((box) => overlaps(box, labelBox));
        if (collided && !smallSlice) {
          outsideY += Math.sin(mid) >= 0 ? labelBox.h + 6 : -(labelBox.h + 6);
          chosenY = outsideY;
          labelBox = boxFromAnchor(text, theme.pieLabelFontSize, chosenX, chosenY, chosenAnchor);
          leader = true;
        }
      }

      placed.push(labelBox);
      labels.push({
        kind: 'text',
        x: chosenX,
        y: chosenY,
        text,
        fontFamily: theme.fontFamily,
        fontSize: theme.pieLabelFontSize,
        fontWeight: 500,
        fill: theme.pieLabelColor,
        textAnchor: chosenAnchor,
        dominantBaseline: 'middle',
      });

      if (leader) {
        const sx = cx + radius * Math.cos(mid);
        const sy = cy + radius * Math.sin(mid);
        const ex = chosenAnchor === 'start' ? chosenX - 6 : chosenAnchor === 'end' ? chosenX + 6 : chosenX;
        leaders.push({
          kind: 'line',
          x1: sx,
          y1: sy,
          x2: ex,
          y2: chosenY,
          stroke: theme.pieLeaderLineColor,
          strokeWidth: 1,
        });
      }
    });

  if (rows.length === 0) {
    labels.push({
      kind: 'text',
      x: cx,
      y: cy,
      text: 'No data',
      fontFamily: theme.fontFamily,
      fontSize: theme.pieLabelFontSize + 2,
      fontWeight: 600,
      fill: theme.tickLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
  }

  return [
    ...arcs,
    ...leaders,
    ...labels,
    ...legendPrimitives(slices.map((slice) => ({ label: slice.label, color: slice.color })), legendX, plotArea.y + 20, theme),
  ];
}

function layoutXY(doc: ChartDocument, basePlotArea: PlotArea, theme: ChartTheme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const xField = doc.encoding.x?.field ?? 'x';
  const rows = doc.data.values;
  const numericKeys = Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== xField && typeof row[key] === 'number'))));
  const barKeys = numericKeys.filter((key) => key.startsWith('bar_'));
  const lineKeys = numericKeys.filter((key) => key.startsWith('line_'));
  const fallbackYKeys = numericKeys.filter((key) => !key.startsWith('bar_') && !key.startsWith('line_'));
  const activeBarKeys = barKeys.length > 0 ? barKeys : (doc.config?.marks?.includes('bar') ? fallbackYKeys : []);
  const activeLineKeys = lineKeys.length > 0 ? lineKeys : (doc.config?.marks?.includes('line') ? fallbackYKeys : []);
  const markKeys = Array.from(new Set([...activeBarKeys, ...activeLineKeys]));

  const xIsNominal = doc.encoding.x?.type !== 'quantitative';
  const plotArea: PlotArea = {
    x: basePlotArea.x + 64,
    y: basePlotArea.y + 10,
    width: Math.max(200, basePlotArea.width - 84),
    height: Math.max(160, basePlotArea.height - 82),
  };

  const xValues = rows.map((row) => row[xField] as ScaleValue).filter((value) => value !== undefined);
  const numericXValues = xValues.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const xScale = xIsNominal
    ? new BandScale(xValues, [plotArea.x, plotArea.x + plotArea.width], doc.config?.padding ?? 0.18)
    : new LinearScale([
        numericXValues.length > 0 ? Math.min(...numericXValues) : 0,
        numericXValues.length > 0 ? Math.max(...numericXValues) : 1,
      ], [plotArea.x, plotArea.x + plotArea.width]);

  const yValues = rows.flatMap((row) => markKeys.map((key) => Number(row[key] ?? 0))).filter((value) => Number.isFinite(value));
  const includesBars = activeBarKeys.length > 0;
  const rawYMin = doc.config?.yMin ?? (yValues.length > 0 ? Math.min(...yValues) : 0);
  const rawYMax = doc.config?.yMax ?? (yValues.length > 0 ? Math.max(...yValues) : 1);
  const adjustedMin = includesBars ? Math.min(0, rawYMin) : rawYMin;
  const adjustedMax = includesBars ? Math.max(0, rawYMax) : rawYMax;
  const niceDomain = LinearScale.nice([adjustedMin, adjustedMax], 5);
  const yScale = new LinearScale(niceDomain, [plotArea.y + plotArea.height, plotArea.y]);

  primitives.push(...generateGridlines(yScale, plotArea, theme));

  const seriesLegend: Array<{ label: string; color: string }> = [];

  const barData: XYMarkDatum[] = [];
  activeBarKeys.forEach((key, seriesIndex) => {
    const color = theme.piePalette[seriesIndex % theme.piePalette.length]!;
    seriesLegend.push({ label: key.replace(/_/g, ' '), color });
    rows.forEach((row) => {
      const value = Number(row[key] ?? NaN);
      if (!Number.isFinite(value)) return;
      barData.push({
        x: row[xField] as ScaleValue,
        y: value,
        seriesIndex,
        seriesCount: activeBarKeys.length,
        color,
      });
    });
  });

  const lineData: XYMarkDatum[] = [];
  activeLineKeys.forEach((key, offset) => {
    const seriesIndex = activeBarKeys.length + offset;
    const color = theme.piePalette[seriesIndex % theme.piePalette.length]!;
    seriesLegend.push({ label: key.replace(/_/g, ' '), color });
    rows.forEach((row) => {
      const value = Number(row[key] ?? NaN);
      if (!Number.isFinite(value)) return;
      lineData.push({
        x: row[xField] as ScaleValue,
        y: value,
        seriesIndex,
        color,
      });
    });
  });

  if (barData.length > 0) primitives.push(...barMarks(barData, xScale, yScale, plotArea, theme));
  if (lineData.length > 0) {
    primitives.push(...lineMarks(lineData, xScale, yScale, plotArea, theme));
    primitives.push(...pointMarks(lineData, xScale, yScale, plotArea, theme));
  }

  primitives.push(...generateXAxis(xScale, plotArea, theme, doc.config?.xTitle));
  primitives.push(...generateYAxis(yScale, plotArea, theme, doc.config?.yTitle));

  if (seriesLegend.length > 1) {
    primitives.push(...legendPrimitives(seriesLegend, plotArea.x + plotArea.width - 110, plotArea.y + 10, theme));
  }

  return primitives;
}

export function layoutChart(doc: ChartDocument, themeOverride?: ChartTheme): Scene {
  const resolvedTheme = themeOverride ?? defaultChartTheme;
  const titleBand = doc.title ? resolvedTheme.titleFontSize + 24 : 0;
  const legendWidth = doc.chartType === 'pie' ? 180 : 0;
  const plotArea: PlotArea = {
    x: resolvedTheme.marginLeft,
    y: resolvedTheme.marginTop + titleBand,
    width: resolvedTheme.canvasWidth - resolvedTheme.marginLeft - resolvedTheme.marginRight - legendWidth,
    height: resolvedTheme.canvasHeight - resolvedTheme.marginTop - resolvedTheme.marginBottom - titleBand,
  };

  const primitives: ScenePrimitive[] = [
    {
      kind: 'rect',
      x: 0,
      y: 0,
      width: resolvedTheme.canvasWidth,
      height: resolvedTheme.canvasHeight,
      fill: resolvedTheme.background,
    },
  ];

  if (doc.title) {
    const title: TextPrimitive = {
      kind: 'text',
      x: rhuInt(resolvedTheme.canvasWidth / 2),
      y: resolvedTheme.marginTop + resolvedTheme.titleFontSize,
      text: doc.title,
      fontFamily: resolvedTheme.fontFamily,
      fontSize: resolvedTheme.titleFontSize,
      fontWeight: resolvedTheme.titleFontWeight,
      fill: resolvedTheme.titleColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    };
    primitives.push(title);
  }

  if (doc.chartType === 'pie') {
    primitives.push(...layoutPie(doc, plotArea, plotArea.x + plotArea.width + 28, resolvedTheme));
  } else if (doc.chartType === 'xy') {
    primitives.push(...layoutXY(doc, plotArea, resolvedTheme));
  } else {
    primitives.push({
      kind: 'text',
      x: resolvedTheme.canvasWidth / 2,
      y: resolvedTheme.canvasHeight / 2,
      text: `Chart type ${doc.chartType} is not implemented yet.`,
      fontFamily: resolvedTheme.fontFamily,
      fontSize: resolvedTheme.titleFontSize - 4,
      fontWeight: 500,
      fill: resolvedTheme.tickLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
  }

  return {
    width: resolvedTheme.canvasWidth,
    height: resolvedTheme.canvasHeight,
    background: resolvedTheme.background,
    primitives,
  };
}
