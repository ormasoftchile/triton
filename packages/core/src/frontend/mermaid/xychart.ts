/**
 * @file frontend/mermaid/xychart.ts — Mermaid xychart-beta → ChartDocument parser.
 */

import type { ChartDocument } from '../../grammars/chart/types.js';
import { preprocessMermaid } from './utils.js';

export interface XYChartParseResult {
  doc: ChartDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNumberArray(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  const values = inner.split(',').map((part) => Number(part.trim()));
  return values.every((value) => Number.isFinite(value)) ? values : null;
}

function parseStringArray(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((part) => stripQuotes(part));
}

export function parseXYChartDiagram(text: string): ChartDocument {
  return parseXYChartDiagramInternal(text).doc;
}

export function parseXYChartDiagramInternal(text: string): XYChartParseResult {
  const { body, frontmatter, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^xychart-beta\b/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    warnings.push(`Expected "xychart-beta" header on first content line; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  let title: string | undefined;
  let xType: 'nominal' | 'quantitative' = 'nominal';
  let xValues: Array<string | number> = [];
  let xTitle: string | undefined;
  let yTitle: string | undefined;
  let xMin: number | undefined;
  let xMax: number | undefined;
  let yMin: number | undefined;
  let yMax: number | undefined;
  const bars: number[][] = [];
  const linesSeries: number[][] = [];

  for (let i = Math.max(0, headerIdx + 1); i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    if (/^title\b/i.test(trimmed)) {
      title = stripQuotes(trimmed.replace(/^title\s+/i, ''));
      continue;
    }

    const categoricalX = trimmed.match(/^x-axis(?:\s+"([^"]+)")?\s+(\[[^\]]*\])\s*$/i);
    if (categoricalX) {
      xType = 'nominal';
      xTitle = categoricalX[1] ? stripQuotes(categoricalX[1]) : xTitle;
      xValues = parseStringArray(categoricalX[2] ?? '') ?? [];
      continue;
    }

    const quantitativeX = trimmed.match(/^x-axis(?:\s+"([^"]+)")?\s+(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)\s*$/i);
    if (quantitativeX) {
      xType = 'quantitative';
      xTitle = quantitativeX[1] ? stripQuotes(quantitativeX[1]) : xTitle;
      xMin = Number(quantitativeX[2] ?? '0');
      xMax = Number(quantitativeX[3] ?? '0');
      continue;
    }

    const yAxis = trimmed.match(/^y-axis(?:\s+"([^"]+)")?(?:\s+(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)\s*)?$/i);
    if (yAxis) {
      yTitle = yAxis[1] ? stripQuotes(yAxis[1]) : yTitle;
      if (yAxis[2] !== undefined && yAxis[3] !== undefined) {
        yMin = Number(yAxis[2]);
        yMax = Number(yAxis[3]);
      }
      continue;
    }

    const bar = trimmed.match(/^bar\s+(\[[^\]]*\])\s*$/i);
    if (bar) {
      const values = parseNumberArray(bar[1] ?? '');
      if (values === null) warnings.push(`Malformed bar series skipped: "${trimmed}"`);
      else bars.push(values);
      continue;
    }

    const line = trimmed.match(/^line\s+(\[[^\]]*\])\s*$/i);
    if (line) {
      const values = parseNumberArray(line[1] ?? '');
      if (values === null) warnings.push(`Malformed line series skipped: "${trimmed}"`);
      else linesSeries.push(values);
      continue;
    }

    warnings.push(`Malformed xychart line skipped: "${trimmed}"`);
  }

  const maxPoints = Math.max(
    xValues.length,
    ...bars.map((series) => series.length),
    ...linesSeries.map((series) => series.length),
    0,
  );

  if (xValues.length === 0) {
    if (xType === 'quantitative' && xMin !== undefined && xMax !== undefined) {
      if (maxPoints <= 1) {
        xValues = [xMin];
      } else {
        const step = (xMax - xMin) / (maxPoints - 1);
        xValues = Array.from({ length: maxPoints }, (_, index) => Number((xMin + index * step).toFixed(6)));
      }
    } else {
      xValues = Array.from({ length: maxPoints }, (_, index) => String(index + 1));
    }
  }

  const values: Array<Record<string, number | string>> = xValues.map((x, index) => {
    const row: Record<string, number | string> = { x };
    bars.forEach((series, seriesIndex) => {
      const value = series[index];
      if (value !== undefined) row[`bar_${seriesIndex}`] = value;
    });
    linesSeries.forEach((series, seriesIndex) => {
      const value = series[index];
      if (value !== undefined) row[`line_${seriesIndex}`] = value;
    });
    return row;
  });

  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  if (values.length === 0) warnings.push('XY chart has no data points.');
  if (bars.length === 0 && linesSeries.length === 0) warnings.push('XY chart has no bar or line series.');

  return {
    doc: {
      version: '1.0',
      chartType: 'xy',
      ...(title ?? fmTitle ?? directiveTitle ? { title: title ?? fmTitle ?? directiveTitle } : {}),
      data: { values },
      encoding: {
        x: { field: 'x', type: xType },
        y: { field: 'y', type: 'quantitative' },
      },
      config: {
        marks: [
          ...(bars.length > 0 ? ['bar'] : []),
          ...(linesSeries.length > 0 ? ['line'] : []),
        ],
        ...(xTitle !== undefined ? { xTitle } : {}),
        ...(yTitle !== undefined ? { yTitle } : {}),
        ...(yMin !== undefined ? { yMin } : {}),
        ...(yMax !== undefined ? { yMax } : {}),
      },
    },
    warnings,
    frontmatter,
  };
}
