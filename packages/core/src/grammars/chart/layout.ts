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
import { BandScale, LinearScale, RadialScale, type ScaleValue } from './scales.js';

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

function formatNumber(n: number): string {
  return Number(n.toFixed(2)).toString().replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
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


function layoutQuadrant(doc: ChartDocument, basePlotArea: PlotArea, theme: ChartTheme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  // 110 px reserved on the left for y-axis end labels (e.g. "High Engagement" ≈ 97 px wide at 12 px).
  // 20 px reserved on the right keeps x-axis "High" label clear of the canvas edge.
  const yLabelReserve = 110;
  const side = Math.min(basePlotArea.width - (yLabelReserve + 20), basePlotArea.height - 80);
  const plotX = basePlotArea.x + yLabelReserve;
  const plotY = basePlotArea.y + 20;
  const plotSide = Math.max(200, side);
  const xScale = new LinearScale([0, 1], [plotX, plotX + plotSide]);
  const yScale = new LinearScale([0, 1], [plotY + plotSide, plotY]);
  const cx = plotX + plotSide / 2;
  const cy = plotY + plotSide / 2;
  const quadrantColors = ['#f0f9ff', '#f0fdf4', '#fefce8', '#fff7ed'];

  primitives.push({ kind: 'rect', x: plotX, y: plotY, width: cx - plotX, height: cy - plotY, fill: quadrantColors[1]!, stroke: 'none' });
  primitives.push({ kind: 'rect', x: cx, y: plotY, width: plotX + plotSide - cx, height: cy - plotY, fill: quadrantColors[0]!, stroke: 'none' });
  primitives.push({ kind: 'rect', x: plotX, y: cy, width: cx - plotX, height: plotY + plotSide - cy, fill: quadrantColors[2]!, stroke: 'none' });
  primitives.push({ kind: 'rect', x: cx, y: cy, width: plotX + plotSide - cx, height: plotY + plotSide - cy, fill: quadrantColors[3]!, stroke: 'none' });

  primitives.push({
    kind: 'rect',
    x: plotX,
    y: plotY,
    width: plotSide,
    height: plotSide,
    fill: 'none',
    stroke: theme.axisColor,
    strokeWidth: 1.5,
  });
  primitives.push({
    kind: 'line',
    x1: cx,
    y1: plotY,
    x2: cx,
    y2: plotY + plotSide,
    stroke: theme.axisColor,
    strokeWidth: 1.5,
    dashArray: '6,3',
  });
  primitives.push({
    kind: 'line',
    x1: plotX,
    y1: cy,
    x2: plotX + plotSide,
    y2: cy,
    stroke: theme.axisColor,
    strokeWidth: 1.5,
    dashArray: '6,3',
  });

  const quadLabelFontSize = 11;
  const quadrantLabelConfig = doc.config?.quadrantLabels ?? ['', '', '', ''];
  const qLabelPad = 14;

  if (quadrantLabelConfig[0]) {
    primitives.push({
      kind: 'text',
      x: plotX + plotSide - qLabelPad,
      y: plotY + qLabelPad,
      text: quadrantLabelConfig[0],
      fontFamily: theme.fontFamily,
      fontSize: quadLabelFontSize,
      fontWeight: 600,
      fill: '#475569',
      textAnchor: 'end',
      dominantBaseline: 'hanging',
      opacity: 0.75,
    });
  }
  if (quadrantLabelConfig[1]) {
    primitives.push({
      kind: 'text',
      x: plotX + qLabelPad,
      y: plotY + qLabelPad,
      text: quadrantLabelConfig[1],
      fontFamily: theme.fontFamily,
      fontSize: quadLabelFontSize,
      fontWeight: 600,
      fill: '#475569',
      textAnchor: 'start',
      dominantBaseline: 'hanging',
      opacity: 0.75,
    });
  }
  if (quadrantLabelConfig[2]) {
    primitives.push({
      kind: 'text',
      x: plotX + qLabelPad,
      y: plotY + plotSide - qLabelPad,
      text: quadrantLabelConfig[2],
      fontFamily: theme.fontFamily,
      fontSize: quadLabelFontSize,
      fontWeight: 600,
      fill: '#475569',
      textAnchor: 'start',
      dominantBaseline: 'auto',
      opacity: 0.75,
    });
  }
  if (quadrantLabelConfig[3]) {
    primitives.push({
      kind: 'text',
      x: plotX + plotSide - qLabelPad,
      y: plotY + plotSide - qLabelPad,
      text: quadrantLabelConfig[3],
      fontFamily: theme.fontFamily,
      fontSize: quadLabelFontSize,
      fontWeight: 600,
      fill: '#475569',
      textAnchor: 'end',
      dominantBaseline: 'auto',
      opacity: 0.75,
    });
  }

  const xLow = doc.config?.xAxisLow ?? 'Low';
  const xHigh = doc.config?.xAxisHigh ?? 'High';
  const yLow = doc.config?.yAxisLow ?? 'Low';
  const yHigh = doc.config?.yAxisHigh ?? 'High';

  primitives.push({ kind: 'line', x1: plotX, y1: plotY + plotSide, x2: plotX + plotSide, y2: plotY + plotSide, stroke: theme.axisColor, strokeWidth: 1.5 });
  primitives.push({
    kind: 'text',
    x: plotX,
    y: plotY + plotSide + 18,
    text: xLow,
    fontFamily: theme.fontFamily,
    fontSize: theme.tickLabelFontSize,
    fontWeight: 400,
    fill: theme.tickLabelColor,
    textAnchor: 'start',
    dominantBaseline: 'hanging',
  });
  primitives.push({
    kind: 'text',
    x: plotX + plotSide,
    y: plotY + plotSide + 18,
    text: xHigh,
    fontFamily: theme.fontFamily,
    fontSize: theme.tickLabelFontSize,
    fontWeight: 400,
    fill: theme.tickLabelColor,
    textAnchor: 'end',
    dominantBaseline: 'hanging',
  });
  primitives.push({ kind: 'line', x1: plotX, y1: plotY + plotSide + 9, x2: plotX + plotSide, y2: plotY + plotSide + 9, stroke: theme.axisColor, strokeWidth: 1 });

  primitives.push({ kind: 'line', x1: plotX, y1: plotY, x2: plotX, y2: plotY + plotSide, stroke: theme.axisColor, strokeWidth: 1.5 });
  primitives.push({
    kind: 'text',
    x: plotX - 8,
    y: plotY + plotSide,
    text: yLow,
    fontFamily: theme.fontFamily,
    fontSize: theme.tickLabelFontSize,
    fontWeight: 400,
    fill: theme.tickLabelColor,
    textAnchor: 'end',
    dominantBaseline: 'auto',
  });
  primitives.push({
    kind: 'text',
    x: plotX - 8,
    y: plotY,
    text: yHigh,
    fontFamily: theme.fontFamily,
    fontSize: theme.tickLabelFontSize,
    fontWeight: 400,
    fill: theme.tickLabelColor,
    textAnchor: 'end',
    dominantBaseline: 'hanging',
  });
  primitives.push({ kind: 'line', x1: plotX - 4, y1: plotY, x2: plotX - 4, y2: plotY + plotSide, stroke: theme.axisColor, strokeWidth: 1 });

  const rows = doc.data.values;
  const pointRadius = 7;
  const itemFontSize = 11;
  const placed: LabelBox[] = [];
  const offsetCandidates: Array<[number, number, 'start' | 'middle' | 'end']> = [
    [pointRadius + 6, 0, 'start'],
    [pointRadius + 6, -pointRadius - 4, 'start'],
    [pointRadius + 6, pointRadius + 4, 'start'],
    [-(pointRadius + 6), 0, 'end'],
    [-(pointRadius + 6), -pointRadius - 4, 'end'],
    [-(pointRadius + 6), pointRadius + 4, 'end'],
    [0, -(pointRadius + 10), 'middle'],
    [0, pointRadius + 14, 'middle'],
  ];

  rows.forEach((row, index) => {
    const x = Number(row['x'] ?? 0.5);
    const y = Number(row['y'] ?? 0.5);
    const label = String(row['label'] ?? `Item ${index + 1}`);
    const px = xScale.scale(x);
    const py = yScale.scale(y);
    const color = theme.piePalette[index % theme.piePalette.length]!;

    primitives.push({ kind: 'circle', cx: px, cy: py, r: pointRadius, fill: color, stroke: '#ffffff', strokeWidth: 2 });

    let chosenX = px + pointRadius + 6;
    let chosenY = py;
    let chosenAnchor: 'start' | 'middle' | 'end' = 'start';
    let found = false;

    // Safety margin so labels don't render flush against the plot border line.
    const EDGE_MARGIN = 6;
    const plotRight = plotX + plotSide;

    for (const [dx, dy, anchor] of offsetCandidates) {
      const lx = px + dx;
      const ly = py + dy;
      const box = boxFromAnchor(label, itemFontSize, lx, ly, anchor);
      // Skip positions whose bounding box would overflow the plot's horizontal bounds.
      if (box.x - EDGE_MARGIN < plotX || box.x + box.w + EDGE_MARGIN > plotRight) continue;
      if (!placed.some((existing) => overlaps(existing, box))) {
        chosenX = lx;
        chosenY = ly;
        chosenAnchor = anchor;
        placed.push(box);
        found = true;
        break;
      }
    }

    if (!found) {
      // Prefer right side; fall back to left when right would overflow the plot.
      const rX = px + pointRadius + 6;
      const rBox = boxFromAnchor(label, itemFontSize, rX, py, 'start');
      const useLeft = rBox.x + rBox.w + EDGE_MARGIN > plotRight;
      chosenX = useLeft ? px - pointRadius - 6 : rX;
      chosenAnchor = useLeft ? 'end' : 'start';
      const fallbackY = py - placed.filter((b) => Math.abs(b.x - chosenX) < 60).length * 14;
      chosenY = fallbackY;
      placed.push(boxFromAnchor(label, itemFontSize, chosenX, chosenY, chosenAnchor));
    }

    primitives.push({
      kind: 'text',
      x: chosenX,
      y: chosenY,
      text: label,
      fontFamily: theme.fontFamily,
      fontSize: itemFontSize,
      fontWeight: 600,
      fill: theme.tickLabelColor,
      textAnchor: chosenAnchor,
      dominantBaseline: 'middle',
    });
  });

  return primitives;
}

function layoutRadar(doc: ChartDocument, basePlotArea: PlotArea, theme: ChartTheme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const radarAxes = doc.config?.radarAxes ?? [];
  const axisCount = radarAxes.length;

  if (axisCount < 3) {
    primitives.push({
      kind: 'text',
      x: basePlotArea.x + basePlotArea.width / 2,
      y: basePlotArea.y + basePlotArea.height / 2,
      text: 'Radar requires at least 3 axes',
      fontFamily: theme.fontFamily,
      fontSize: 14,
      fontWeight: 500,
      fill: theme.tickLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
    return primitives;
  }

  const rows = doc.data.values;
  const graticule = Math.max(1, doc.config?.radarGraticule ?? 4);
  const allValues = rows.flatMap((row) => radarAxes.map((axis) => Number(row[axis] ?? 0)).filter((value) => Number.isFinite(value)));
  const configuredMin = doc.config?.radarMin ?? 0;
  const configuredMax = doc.config?.radarMax ?? (allValues.length > 0 ? Math.max(...allValues) : 5);
  const domainMin = Math.min(configuredMin, configuredMax);
  const domainMax = Math.max(configuredMin, configuredMax);
  const radialScale = new RadialScale([domainMin, domainMax], [0, 1]);

  const labelMargin = 50;
  const legendWidth = rows.length > 1 ? 120 : 0;
  const cx = basePlotArea.x + (basePlotArea.width - legendWidth) / 2;
  const cy = basePlotArea.y + basePlotArea.height / 2;
  const outerRadius = Math.max(40, Math.min(
    (basePlotArea.width - legendWidth - 2 * labelMargin) / 2,
    (basePlotArea.height - 2 * labelMargin) / 2,
  ));
  const angles = radarAxes.map((_, index) => (index / axisCount) * Math.PI * 2 - Math.PI / 2);
  const spokePoint = (angleIdx: number, normRadius: number) => {
    const angle = angles[angleIdx]!;
    const radius = normRadius * outerRadius;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  };

  for (let ring = 1; ring <= graticule; ring++) {
    const normRadius = ring / graticule;
    const d = angles.map((_, index) => {
      const point = spokePoint(index, normRadius);
      return `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`;
    }).join(' ') + ' Z';
    primitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke: theme.gridlineColor,
      strokeWidth: 1,
      dashArray: theme.gridlineDash,
    });
  }

  for (let index = 0; index < axisCount; index++) {
    const point = spokePoint(index, 1);
    primitives.push({
      kind: 'line',
      x1: cx,
      y1: cy,
      x2: point.x,
      y2: point.y,
      stroke: theme.axisColor,
      strokeWidth: 1,
      opacity: 0.6,
    });
  }

  for (let ring = 1; ring <= graticule; ring++) {
    const normRadius = ring / graticule;
    const tickValue = domainMin + (domainMax - domainMin) * normRadius;
    const point = spokePoint(0, normRadius);
    primitives.push({
      kind: 'text',
      x: point.x + 4,
      y: point.y - 4,
      text: formatValue(tickValue),
      fontFamily: theme.fontFamily,
      fontSize: 9,
      fontWeight: 400,
      fill: theme.tickLabelColor,
      textAnchor: 'start',
      dominantBaseline: 'auto',
      opacity: 0.85,
    });
  }

  rows.forEach((row, seriesIndex) => {
    const color = theme.piePalette[seriesIndex % theme.piePalette.length]!;
    const points = radarAxes.map((axis, axisIndex) => {
      const value = Number(row[axis] ?? domainMin);
      const normRadius = radialScale.clampedScale(value);
      return spokePoint(axisIndex, normRadius);
    });

    if (points.length === 0) return;

    const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`).join(' ') + ' Z';
    primitives.push({
      kind: 'path',
      d,
      fill: color,
      stroke: 'none',
      opacity: 0.18,
    });
    primitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke: color,
      strokeWidth: 2,
      strokeLinecap: 'round',
    });
    points.forEach((point) => {
      primitives.push({ kind: 'circle', cx: point.x, cy: point.y, r: 3, fill: color, stroke: '#ffffff', strokeWidth: 1 });
    });
  });

  for (let index = 0; index < axisCount; index++) {
    const axis = radarAxes[index]!;
    const angle = angles[index]!;
    const labelRadius = outerRadius + 22;
    const lx = cx + labelRadius * Math.cos(angle);
    const ly = cy + labelRadius * Math.sin(angle);
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    let anchor: 'start' | 'middle' | 'end' = 'middle';
    let baseline: 'auto' | 'middle' | 'hanging' = 'middle';
    if (cosAngle > 0.25) anchor = 'start';
    else if (cosAngle < -0.25) anchor = 'end';
    if (sinAngle < -0.5) baseline = 'auto';
    else if (sinAngle > 0.5) baseline = 'hanging';

    primitives.push({
      kind: 'text',
      x: lx,
      y: ly,
      text: axis,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      fontWeight: 600,
      fill: theme.axisTitleColor,
      textAnchor: anchor,
      dominantBaseline: baseline,
    });
  }

  if (rows.length > 1) {
    const legendX = basePlotArea.x + basePlotArea.width - legendWidth + 10;
    const legendY = basePlotArea.y + 20;
    rows.forEach((row, index) => {
      const color = theme.piePalette[index % theme.piePalette.length]!;
      const name = String(row['_name'] ?? `Series ${index + 1}`);
      const rowY = legendY + index * (theme.legendSwatchSize + theme.legendGap + 2);
      primitives.push({
        kind: 'rect',
        x: legendX,
        y: rowY,
        width: theme.legendSwatchSize,
        height: theme.legendSwatchSize,
        fill: color,
        stroke: theme.background,
        strokeWidth: 1,
        rx: 2,
      });
      primitives.push({
        kind: 'text',
        x: legendX + theme.legendSwatchSize + 6,
        y: rowY + theme.legendSwatchSize / 2 + 1,
        text: name,
        fontFamily: theme.fontFamily,
        fontSize: theme.legendFontSize,
        fontWeight: 400,
        fill: theme.tickLabelColor,
        textAnchor: 'start',
        dominantBaseline: 'middle',
      });
    });
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
  } else if (doc.chartType === 'quadrant') {
    primitives.push(...layoutQuadrant(doc, plotArea, resolvedTheme));
  } else if (doc.chartType === 'radar') {
    primitives.push(...layoutRadar(doc, plotArea, resolvedTheme));
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
