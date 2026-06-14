/**
 * @file test/mermaid-xychart-corpus.test.ts — Mermaid xychart-beta corpus.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ChartDocument } from '../src/grammars/chart/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseXYChartDiagram, parseXYChartDiagramInternal } from '../src/frontend/mermaid/xychart.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const XY_MMD = join(GALLERY, 'mermaid-xychart.mmd');
const XY_SVG = join(GALLERY, 'mermaid-xychart.svg');
const XY_PNG = join(GALLERY, 'mermaid-xychart.png');

interface XYCase {
  name: string;
  text: string;
  expectedRows: number;
  expectedBarRects?: number;
  expectedLineSeries?: number;
  expectedLinePoints?: number;
  warningPattern?: RegExp;
  expectedTickLabelUpperBound?: number;
}

const XY_CASES: XYCase[] = [
  {
    name: 'basic bar chart',
    text: `xychart-beta\n  title "Monthly Revenue"\n  x-axis [Jan, Feb, Mar]\n  y-axis "Revenue" 0 --> 4000\n  bar [1200, 2400, 3100]`,
    expectedRows: 3,
    expectedBarRects: 3,
  },
  {
    name: 'basic line chart',
    text: `xychart-beta\n  title "Trend"\n  x-axis [Jan, Feb, Mar]\n  y-axis "Value" 0 --> 100\n  line [20, 40, 60]`,
    expectedRows: 3,
    expectedLineSeries: 1,
    expectedLinePoints: 3,
  },
  {
    name: 'bar and line combo',
    text: `xychart-beta\n  title "Combo"\n  x-axis [Jan, Feb, Mar]\n  y-axis "Value" 0 --> 100\n  bar [20, 40, 60]\n  line [10, 50, 55]`,
    expectedRows: 3,
    expectedBarRects: 3,
    expectedLineSeries: 1,
    expectedLinePoints: 3,
  },
  {
    name: 'categorical x-axis',
    text: `xychart-beta\n  x-axis [North, South, East, West]\n  y-axis 0 --> 50\n  bar [10, 20, 30, 40]`,
    expectedRows: 4,
    expectedBarRects: 4,
  },
  {
    name: 'quantitative x-axis',
    text: `xychart-beta\n  title Day Plot\n  x-axis "Day" 1 --> 5\n  y-axis "Units" 0 --> 100\n  line [10, 30, 50, 40, 80]`,
    expectedRows: 5,
    expectedLineSeries: 1,
    expectedLinePoints: 5,
  },
  {
    name: 'missing y-axis range auto-computes',
    text: `xychart-beta\n  x-axis [A, B, C]\n  y-axis "Value"\n  bar [5, 15, 9]`,
    expectedRows: 3,
    expectedBarRects: 3,
  },
  {
    name: 'empty bar data',
    text: `xychart-beta\n  x-axis [A, B, C]\n  y-axis 0 --> 10\n  bar []`,
    expectedRows: 3,
    expectedBarRects: 0,
  },
  {
    name: 'single data point',
    text: `xychart-beta\n  x-axis [Only]\n  y-axis 0 --> 10\n  line [7]`,
    expectedRows: 1,
    expectedLineSeries: 1,
    expectedLinePoints: 1,
  },
  {
    name: 'very long category labels',
    text: `xychart-beta\n  title Long Labels\n  x-axis [VeryLongJanuaryLabel, VeryLongFebruaryLabel, VeryLongMarchLabel, VeryLongAprilLabel, VeryLongMayLabel]\n  y-axis 0 --> 100\n  bar [10, 20, 30, 40, 50]`,
    expectedRows: 5,
    expectedBarRects: 5,
    expectedTickLabelUpperBound: 3,
  },
  {
    name: 'negative y values',
    text: `xychart-beta\n  title Negatives\n  x-axis [A, B, C]\n  y-axis -20 --> 20\n  bar [-5, 10, -8]`,
    expectedRows: 3,
    expectedBarRects: 3,
  },
  {
    name: 'bar only',
    text: `xychart-beta\n  x-axis [A, B]\n  y-axis 0 --> 10\n  bar [3, 7]`,
    expectedRows: 2,
    expectedBarRects: 2,
  },
  {
    name: 'line only',
    text: `xychart-beta\n  x-axis [A, B, C, D]\n  y-axis 0 --> 10\n  line [3, 7, 2, 9]`,
    expectedRows: 4,
    expectedLineSeries: 1,
    expectedLinePoints: 4,
  },
  {
    name: 'multiple bar series',
    text: `xychart-beta\n  title Multi Bars\n  x-axis [Jan, Feb, Mar]\n  y-axis 0 --> 20\n  bar [3, 7, 2]\n  bar [4, 6, 5]`,
    expectedRows: 3,
    expectedBarRects: 6,
  },
  {
    name: 'multiple line series',
    text: `xychart-beta\n  title Multi Lines\n  x-axis [Jan, Feb, Mar]\n  y-axis 0 --> 20\n  line [3, 7, 2]\n  line [4, 6, 5]`,
    expectedRows: 3,
    expectedLineSeries: 2,
    expectedLinePoints: 6,
  },
  {
    name: 'title with quotes',
    text: `xychart-beta\n  title "Quoted Title"\n  x-axis [A, B]\n  y-axis 0 --> 10\n  bar [3, 4]`,
    expectedRows: 2,
    expectedBarRects: 2,
  },
  {
    name: 'title without quotes',
    text: `xychart-beta\n  title Plain Title\n  x-axis [A, B]\n  y-axis 0 --> 10\n  bar [3, 4]`,
    expectedRows: 2,
    expectedBarRects: 2,
  },
  {
    name: 'frontmatter with theme',
    text: `---\ntheme: dark-chart\n---\nxychart-beta\n  x-axis [A, B]\n  y-axis 0 --> 10\n  bar [3, 4]`,
    expectedRows: 2,
    expectedBarRects: 2,
  },
  {
    name: 'init directive with title',
    text: `%%{init: {"title": "Directive XY", "theme": "dark-chart"}}%%\nxychart-beta\n  x-axis [A, B]\n  y-axis 0 --> 10\n  bar [3, 4]`,
    expectedRows: 2,
    expectedBarRects: 2,
  },
  {
    name: 'malformed series warning',
    text: `xychart-beta\n  x-axis [A, B, C]\n  y-axis 0 --> 10\n  bar [3, nope, 4]\n  line [2, 5, 6]`,
    expectedRows: 3,
    expectedLineSeries: 1,
    expectedLinePoints: 3,
    warningPattern: /Malformed bar series skipped/i,
  },
  {
    name: 'malformed line skipped',
    text: `xychart-beta\n  x-axis [A, B, C]\n  y-axis 0 --> 10\n  line 2, 5, 6`,
    expectedRows: 3,
    expectedLineSeries: 0,
    expectedLinePoints: 0,
    warningPattern: /Malformed xychart line skipped/i,
  },
  {
    name: 'real monthly revenue',
    text: `xychart-beta\n  title "Monthly Revenue"\n  x-axis [Jan, Feb, Mar, Apr, May]\n  y-axis "Revenue (USD)" 0 --> 5000\n  bar [1200, 2400, 3100, 2800, 4200]`,
    expectedRows: 5,
    expectedBarRects: 5,
  },
  {
    name: 'monthly revenue vs target',
    text: `xychart-beta\n  title "Monthly Revenue vs Target 2026"\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis "Revenue (USD k)" 0 --> 6000\n  bar [1800, 2600, 3400, 3100, 4500, 5200]\n  line [2000, 2500, 3000, 3200, 4000, 5000]`,
    expectedRows: 6,
    expectedBarRects: 6,
    expectedLineSeries: 1,
    expectedLinePoints: 6,
  },
  {
    name: 'quantitative x auto positions',
    text: `xychart-beta\n  x-axis 0 --> 40\n  y-axis 0 --> 100\n  line [5, 25, 50, 80, 90]`,
    expectedRows: 5,
    expectedLineSeries: 1,
    expectedLinePoints: 5,
  },
  {
    name: 'comments and blanks',
    text: `xychart-beta\n\n  %% comment\n  x-axis [A, B, C]\n  y-axis 0 --> 10\n\n  bar [1, 2, 3]`,
    expectedRows: 3,
    expectedBarRects: 3,
  },
  {
    name: 'empty chart warning',
    text: `xychart-beta\n  x-axis [A, B]\n  y-axis 0 --> 10`,
    expectedRows: 2,
    expectedBarRects: 0,
    warningPattern: /no bar or line series/i,
  },
  {
    name: 'mixed negative and positive line',
    text: `xychart-beta\n  x-axis [A, B, C, D]\n  y-axis -10 --> 10\n  line [-5, 0, 5, 9]`,
    expectedRows: 4,
    expectedLineSeries: 1,
    expectedLinePoints: 4,
  },
  {
    name: 'two bar and two line series',
    text: `xychart-beta\n  x-axis [Q1, Q2, Q3]\n  y-axis 0 --> 100\n  bar [10, 20, 30]\n  bar [12, 18, 28]\n  line [8, 22, 35]\n  line [11, 21, 32]`,
    expectedRows: 3,
    expectedBarRects: 6,
    expectedLineSeries: 2,
    expectedLinePoints: 6,
  },
  {
    name: 'short quantitative axis with bar fallback',
    text: `xychart-beta\n  x-axis "Step" 1 --> 3\n  y-axis 0 --> 10\n  bar [2, 4, 6]`,
    expectedRows: 3,
    expectedBarRects: 3,
  },
  {
    name: 'sparse whitespace',
    text: `xychart-beta\n  title   Space Test\n  x-axis [A, B, C]\n  y-axis 0 --> 10\n  line [1, 2, 3]`,
    expectedRows: 3,
    expectedLineSeries: 1,
    expectedLinePoints: 3,
  },
  {
    name: 'y-axis title only',
    text: `xychart-beta\n  x-axis [A, B, C]\n  y-axis "Requests per minute"\n  bar [10, 12, 15]`,
    expectedRows: 3,
    expectedBarRects: 3,
  },
  {
    name: 'long line series',
    text: `xychart-beta\n  x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug]\n  y-axis 0 --> 80\n  line [10, 20, 30, 40, 35, 50, 60, 70]`,
    expectedRows: 8,
    expectedLineSeries: 1,
    expectedLinePoints: 8,
  },
  {
    name: 'decimal series values',
    text: `xychart-beta\n  x-axis [A, B, C]\n  y-axis 0 --> 10\n  bar [1.5, 2.25, 3.75]`,
    expectedRows: 3,
    expectedBarRects: 3,
  },
  {
    name: 'header with no title but two series',
    text: `xychart-beta\n  x-axis [A, B, C]\n  y-axis 0 --> 10\n  bar [1, 2, 3]\n  line [2, 3, 4]`,
    expectedRows: 3,
    expectedBarRects: 3,
    expectedLineSeries: 1,
    expectedLinePoints: 3,
  },
];

function toChartDocument(result: ReturnType<typeof parseMermaid>['doc']): ChartDocument {
  return result as ChartDocument;
}

describe('Mermaid xychart-beta corpus', () => {
  it.each(XY_CASES)('$name', ({ text, expectedRows, expectedBarRects = 0, expectedLineSeries = 0, expectedLinePoints = 0, warningPattern, expectedTickLabelUpperBound }) => {
    expect(detectDiagramType(text)).toBe('xychart');
    expect(() => parseXYChartDiagram(text)).not.toThrow();

    const parsed = parseXYChartDiagramInternal(text);
    const parsedViaIndex = parseMermaid(text);
    expect(parsedViaIndex.kind).toBe('xychart');

    const doc = toChartDocument(parsedViaIndex.doc);
    expect(doc.chartType).toBe('xy');
    expect(doc.data.values).toHaveLength(expectedRows);

    if (warningPattern) {
      expect(parsed.warnings.some((warning) => warningPattern.test(warning))).toBe(true);
    }

    const rendered = renderMermaid(text, { format: 'svg' });
    expect(rendered.kind).toBe('xychart');
    expect(rendered.svg).toContain('<svg');

    const rects = rendered.scene.primitives.filter(
      (primitive) => primitive.kind === 'rect' && primitive.width > 10 && primitive.height >= 1 && primitive.fill !== rendered.scene.background,
    );
    const linePaths = rendered.scene.primitives.filter(
      (primitive) => primitive.kind === 'path' && primitive.fill === 'none',
    );
    const linePoints = rendered.scene.primitives.filter((primitive) => primitive.kind === 'circle');
    const axisLines = rendered.scene.primitives.filter((primitive) => primitive.kind === 'line');

    expect(rects.length).toBeGreaterThanOrEqual(expectedBarRects);
    expect(linePaths).toHaveLength(expectedLineSeries);
    expect(linePoints).toHaveLength(expectedLinePoints);
    expect(axisLines.length).toBeGreaterThan(0);

    if (expectedTickLabelUpperBound !== undefined) {
      const tickLabels = rendered.scene.primitives
        .filter((primitive): primitive is Extract<typeof primitive, { kind: 'text' }> => primitive.kind === 'text')
        .map((primitive) => primitive.text)
        .filter((textValue) => /^VeryLong/.test(textValue) || /^(Jan|Feb|Mar|Apr|May)$/.test(textValue));
      expect(tickLabels.length).toBeLessThanOrEqual(expectedTickLabelUpperBound);
    }
  });

  it('applies frontmatter theme in renderMermaid', () => {
    const result = renderMermaid(`---\ntheme: dark-chart\n---\nxychart-beta\n  x-axis [A, B]\n  y-axis 0 --> 10\n  bar [1, 2]`, { format: 'svg' });
    expect(result.scene.background).toBe('#1a1a2e');
  });

  it('renders deterministically across repeated calls', () => {
    const text = `xychart-beta\n  title Deterministic\n  x-axis [Jan, Feb, Mar]\n  y-axis 0 --> 10\n  bar [1, 2, 3]\n  line [2, 3, 4]`;
    const first = renderMermaid(text, { format: 'svg' });
    const second = renderMermaid(text, { format: 'svg' });
    expect(first.sceneHash).toBe(second.sceneHash);
    expect(first.svg).toBe(second.svg);
  });
});

describe('Mermaid xychart gallery assets', () => {
  it('mermaid-xychart.mmd exists', () => {
    expect(existsSync(XY_MMD)).toBe(true);
  });

  it('parses mermaid-xychart.mmd without error', () => {
    const text = readFileSync(XY_MMD, 'utf8');
    const doc = parseXYChartDiagram(text);
    expect(doc.data.values.length).toBeGreaterThan(4);
  });

  it('emits mermaid-xychart.svg to examples/gallery/', () => {
    const text = readFileSync(XY_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    writeFileSync(XY_SVG, result.svg!, 'utf8');
    expect(statSync(XY_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-xychart.png to examples/gallery/', () => {
    const text = readFileSync(XY_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(XY_PNG, result.png!);
    expect(statSync(XY_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts gallery SVG and PNG exist and are non-empty', () => {
    expect(existsSync(XY_SVG)).toBe(true);
    expect(existsSync(XY_PNG)).toBe(true);
    expect(statSync(XY_SVG).size).toBeGreaterThan(1000);
    expect(statSync(XY_PNG).size).toBeGreaterThan(1000);
  });
});
