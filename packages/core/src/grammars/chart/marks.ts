/**
 * @file grammars/chart/marks.ts — Deterministic chart mark emitters.
 */

import type { CirclePrimitive, PathPrimitive, RectPrimitive } from '../../scene.js';
import type { ChartTheme } from './theme.js';
import { BandScale, LinearScale, type ScaleValue } from './scales.js';
import type { PlotArea } from './axes.js';

export interface XYMarkDatum {
  x: ScaleValue;
  y: number;
  seriesIndex?: number;
  seriesCount?: number;
  color?: string;
}

function formatNumber(n: number): string {
  return Number(n.toFixed(2)).toString().replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
}

export function barMarks(
  data: XYMarkDatum[],
  xScale: LinearScale | BandScale,
  yScale: LinearScale,
  _plotArea: PlotArea,
  theme: ChartTheme,
): RectPrimitive[] {
  const zeroY = yScale.scale(0);
  return data.map((datum, index) => {
    const seriesIndex = datum.seriesIndex ?? 0;
    const seriesCount = Math.max(1, datum.seriesCount ?? 1);
    let x = 0;
    let width = 10;

    if (xScale instanceof BandScale) {
      const groupWidth = xScale.bandwidth();
      const gap = Math.min(4, groupWidth * 0.08);
      width = Math.max(4, (groupWidth - gap * (seriesCount - 1)) / seriesCount);
      x = xScale.bandStart(datum.x) + seriesIndex * (width + gap);
    } else {
      const nextX = xScale.scale(typeof datum.x === 'number' ? datum.x : index + 1);
      width = 14;
      x = nextX - width / 2;
    }

    const valueY = yScale.scale(datum.y);
    const y = Math.min(zeroY, valueY);
    const height = Math.max(1, Math.abs(zeroY - valueY));

    return {
      kind: 'rect',
      x,
      y,
      width,
      height,
      fill: datum.color ?? theme.piePalette[seriesIndex % theme.piePalette.length]!,
      stroke: theme.barStroke,
      strokeWidth: theme.barStrokeWidth,
      rx: 3,
    };
  });
}

export function lineMarks(
  data: XYMarkDatum[],
  xScale: LinearScale | BandScale,
  yScale: LinearScale,
  _plotArea: PlotArea,
  theme: ChartTheme,
): PathPrimitive[] {
  const groups = new Map<number, XYMarkDatum[]>();
  for (const datum of data) {
    const key = datum.seriesIndex ?? 0;
    const arr = groups.get(key) ?? [];
    arr.push(datum);
    groups.set(key, arr);
  }

  return Array.from(groups.entries()).map(([seriesIndex, values]) => {
    const d = values
      .map((datum, idx) => {
        const x = xScale instanceof BandScale ? xScale.scale(datum.x) : xScale.scale(typeof datum.x === 'number' ? datum.x : idx + 1);
        const y = yScale.scale(datum.y);
        return `${idx === 0 ? 'M' : 'L'} ${formatNumber(x)} ${formatNumber(y)}`;
      })
      .join(' ');

    return {
      kind: 'path',
      d,
      fill: 'none',
      stroke: values[0]?.color ?? theme.piePalette[seriesIndex % theme.piePalette.length]!,
      strokeWidth: theme.lineStrokeWidth,
      strokeLinecap: 'round',
    };
  });
}

export function pointMarks(
  data: XYMarkDatum[],
  xScale: LinearScale | BandScale,
  yScale: LinearScale,
  _plotArea: PlotArea,
  theme: ChartTheme,
): CirclePrimitive[] {
  return data.map((datum, idx) => ({
    kind: 'circle',
    cx: xScale instanceof BandScale ? xScale.scale(datum.x) : xScale.scale(typeof datum.x === 'number' ? datum.x : idx + 1),
    cy: yScale.scale(datum.y),
    r: theme.pointRadius,
    fill: datum.color ?? theme.piePalette[(datum.seriesIndex ?? 0) % theme.piePalette.length]!,
    stroke: theme.background,
    strokeWidth: 1,
  }));
}

export function arcMarks(
  data: Array<Record<string, number | string>>,
  thetaField: string,
  colorPalette: string[],
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  theme: ChartTheme,
): PathPrimitive[] {
  const total = data.reduce((sum, row) => sum + Math.max(0, Number(row[thetaField] ?? 0)), 0);
  if (total <= 0) return [];

  let angle = -Math.PI / 2;
  return data.map((row, index) => {
    const value = Math.max(0, Number(row[thetaField] ?? 0));
    const startAngle = angle;
    const delta = (value / total) * Math.PI * 2;
    const endAngle = startAngle + delta;
    angle = endAngle;

    const sx = cx + outerR * Math.cos(startAngle);
    const sy = cy + outerR * Math.sin(startAngle);
    const ex = cx + outerR * Math.cos(endAngle);
    const ey = cy + outerR * Math.sin(endAngle);
    const largeArcFlag = delta > Math.PI ? 1 : 0;
    const fill = colorPalette[index % colorPalette.length] ?? colorPalette[0] ?? '#4C72B0';

    let d = '';
    if (innerR > 0) {
      const isx = cx + innerR * Math.cos(startAngle);
      const isy = cy + innerR * Math.sin(startAngle);
      const iex = cx + innerR * Math.cos(endAngle);
      const iey = cy + innerR * Math.sin(endAngle);
      d = [
        `M ${formatNumber(sx)} ${formatNumber(sy)}`,
        `A ${formatNumber(outerR)} ${formatNumber(outerR)} 0 ${largeArcFlag} 1 ${formatNumber(ex)} ${formatNumber(ey)}`,
        `L ${formatNumber(iex)} ${formatNumber(iey)}`,
        `A ${formatNumber(innerR)} ${formatNumber(innerR)} 0 ${largeArcFlag} 0 ${formatNumber(isx)} ${formatNumber(isy)}`,
        'Z',
      ].join(' ');
    } else {
      d = [
        `M ${formatNumber(cx)} ${formatNumber(cy)}`,
        `L ${formatNumber(sx)} ${formatNumber(sy)}`,
        `A ${formatNumber(outerR)} ${formatNumber(outerR)} 0 ${largeArcFlag} 1 ${formatNumber(ex)} ${formatNumber(ey)}`,
        'Z',
      ].join(' ');
    }

    return {
      kind: 'path',
      d,
      fill,
      stroke: theme.background,
      strokeWidth: 1,
    };
  });
}
