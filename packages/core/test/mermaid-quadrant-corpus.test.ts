/**
 * @file test/mermaid-quadrant-corpus.test.ts — Mermaid quadrantChart corpus.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ChartDocument } from '../src/grammars/chart/index.js';
import { LinearScale } from '../src/grammars/chart/scales.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseQuadrantDiagram, parseQuadrantDiagramInternal } from '../src/frontend/mermaid/quadrant.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const QUADRANT_MMD = join(GALLERY, 'mermaid-quadrant.mmd');
const QUADRANT_SVG = join(GALLERY, 'mermaid-quadrant.svg');
const QUADRANT_PNG = join(GALLERY, 'mermaid-quadrant.png');

interface QuadrantCase {
  name: string;
  text: string;
  expectedItems: number;
  warningPattern?: RegExp;
  expectedLabelIncludes?: string[];
  expectedQuadrantLabels?: [string, string, string, string];
  expectedAxisLabels?: { xLow: string; xHigh: string; yLow: string; yHigh: string };
}

const QUADRANT_CASES: QuadrantCase[] = [
  {
    name: 'basic all quadrants',
    text: `quadrantChart
  title Reach Matrix
  x-axis Low Reach --> High Reach
  y-axis Low Engagement --> High Engagement
  quadrant-1 Expand
  quadrant-2 Promote
  quadrant-3 Revisit
  quadrant-4 Watch
  Alpha: [0.8, 0.9]
  Beta: [0.2, 0.8]
  Gamma: [0.2, 0.2]
  Delta: [0.8, 0.3]`,
    expectedItems: 4,
    expectedLabelIncludes: ['Reach Matrix', 'Alpha', 'Beta', 'Gamma', 'Delta'],
    expectedQuadrantLabels: ['Expand', 'Promote', 'Revisit', 'Watch'],
    expectedAxisLabels: { xLow: 'Low Reach', xHigh: 'High Reach', yLow: 'Low Engagement', yHigh: 'High Engagement' },
  },
  {
    name: 'boundary values clamp and retain labels',
    text: `quadrantChart
  Zero: [0, 0]
  One: [1, 1]
  LeftTop: [0, 1]
  RightBottom: [1, 0]`,
    expectedItems: 4,
    expectedLabelIncludes: ['Zero', 'One', 'LeftTop', 'RightBottom'],
  },
  {
    name: 'center point',
    text: `quadrantChart
  Center: [0.5, 0.5]`,
    expectedItems: 1,
    expectedLabelIncludes: ['Center'],
  },
  {
    name: 'no items empty chart',
    text: `quadrantChart
  title Empty Quadrant
  quadrant-1 Grow`,
    expectedItems: 0,
    expectedLabelIncludes: ['Empty Quadrant', 'Grow'],
  },
  {
    name: 'missing quadrant labels allowed',
    text: `quadrantChart
  title Sparse Labels
  quadrant-1 North East
  Item: [0.6, 0.7]`,
    expectedItems: 1,
    expectedQuadrantLabels: ['North East', '', '', ''],
  },
  {
    name: 'class suffix ignored',
    text: `quadrantChart
  title Styled
  Important: [0.72, 0.44]:::hot`,
    expectedItems: 1,
    expectedLabelIncludes: ['Styled', 'Important'],
  },
  {
    name: 'quoted axis labels',
    text: `quadrantChart
  x-axis "Low Impact" --> "High Impact"
  y-axis 'Low Risk' --> 'High Risk'
  Item: [0.3, 0.8]`,
    expectedItems: 1,
    expectedAxisLabels: { xLow: 'Low Impact', xHigh: 'High Impact', yLow: 'Low Risk', yHigh: 'High Risk' },
  },
  {
    name: 'frontmatter title fallback',
    text: `---
title: Frontmatter Quadrant
---
quadrantChart
  Item: [0.4, 0.4]`,
    expectedItems: 1,
    expectedLabelIncludes: ['Frontmatter Quadrant'],
  },
  {
    name: 'directive title fallback',
    text: `%%{init: {"title": "Directive Quadrant"}}%%
quadrantChart
  Item: [0.4, 0.4]`,
    expectedItems: 1,
    expectedLabelIncludes: ['Directive Quadrant'],
  },
  {
    name: 'single item with quoted label',
    text: `quadrantChart
  "Solo": [0.66, 0.33]`,
    expectedItems: 1,
    expectedLabelIncludes: ['Solo'],
  },
  {
    name: 'many items for collision handling',
    text: `quadrantChart
  title Busy Plot
  A: [0.51, 0.52]
  B: [0.54, 0.53]
  C: [0.57, 0.55]
  D: [0.59, 0.57]
  E: [0.62, 0.59]
  F: [0.64, 0.61]
  G: [0.66, 0.63]
  H: [0.68, 0.65]
  I: [0.7, 0.67]
  J: [0.72, 0.69]
  K: [0.74, 0.71]`,
    expectedItems: 11,
    expectedLabelIncludes: ['Busy Plot', 'K'],
  },
  {
    name: 'near center cluster',
    text: `quadrantChart
  title Cluster
  P1: [0.49, 0.51]
  P2: [0.5, 0.51]
  P3: [0.51, 0.49]
  P4: [0.52, 0.5]`,
    expectedItems: 4,
    expectedLabelIncludes: ['Cluster'],
  },
  {
    name: 'default axis labels',
    text: `quadrantChart
  Item: [0.3, 0.7]`,
    expectedItems: 1,
    expectedAxisLabels: { xLow: 'Low', xHigh: 'High', yLow: 'Low', yHigh: 'High' },
  },
  {
    name: 'malformed coordinate warning',
    text: `quadrantChart
  Bad: [oops, 0.5]
  Good: [0.6, 0.4]`,
    expectedItems: 1,
    warningPattern: /Malformed quadrant item coordinates/i,
    expectedLabelIncludes: ['Good'],
  },
  {
    name: 'out of range coordinates clamp',
    text: `quadrantChart
  High: [1.8, 3]
  Low: [-2, -0.4]`,
    expectedItems: 2,
  },
  {
    name: 'lowercase header works',
    text: `quadrantchart
  title Lowercase
  Item: [0.3, 0.8]`,
    expectedItems: 1,
    expectedLabelIncludes: ['Lowercase'],
  },
  {
    name: 'unknown line warning',
    text: `quadrantChart
  title Warnings
  nope nope
  Item: [0.2, 0.3]`,
    expectedItems: 1,
    warningPattern: /Unrecognised quadrantChart line skipped/i,
  },
  {
    name: 'sparse whitespace',
    text: `quadrantChart

  title   Space Test

  Item A: [0.25, 0.75]`,
    expectedItems: 1,
    expectedLabelIncludes: ['Space Test', 'Item A'],
  },
  {
    name: 'quoted quadrant labels',
    text: `quadrantChart
  quadrant-1 "Scale Up"
  quadrant-2 'Build Awareness'
  quadrant-3 "Revisit Fit"
  quadrant-4 "Protect"
  Item: [0.8, 0.6]`,
    expectedItems: 1,
    expectedQuadrantLabels: ['Scale Up', 'Build Awareness', 'Revisit Fit', 'Protect'],
  },
  {
    name: 'multiple items different quadrants',
    text: `quadrantChart
  NorthEast: [0.75, 0.75]
  NorthWest: [0.25, 0.75]
  SouthWest: [0.25, 0.25]
  SouthEast: [0.75, 0.25]
  Centerish: [0.52, 0.48]`,
    expectedItems: 5,
  },
];

function toChartDocument(doc: ReturnType<typeof parseMermaid>['doc']): ChartDocument {
  return doc as ChartDocument;
}

describe('Mermaid quadrantChart corpus', () => {
  it.each(QUADRANT_CASES)('$name', ({ text, expectedItems, warningPattern, expectedLabelIncludes, expectedQuadrantLabels, expectedAxisLabels }) => {
    expect(detectDiagramType(text)).toBe('quadrantChart');
    expect(() => parseQuadrantDiagram(text)).not.toThrow();

    const parsed = parseQuadrantDiagramInternal(text);
    const viaIndex = parseMermaid(text);
    expect(viaIndex.kind).toBe('quadrantChart');

    const doc = toChartDocument(viaIndex.doc);
    expect(doc.chartType).toBe('quadrant');
    expect(doc.data.values).toHaveLength(expectedItems);

    if (warningPattern) {
      expect(parsed.warnings.some((warning) => warningPattern.test(warning))).toBe(true);
    }
    if (expectedQuadrantLabels) {
      expect(doc.config?.quadrantLabels).toEqual(expectedQuadrantLabels);
    }
    if (expectedAxisLabels) {
      expect(doc.config?.xAxisLow).toBe(expectedAxisLabels.xLow);
      expect(doc.config?.xAxisHigh).toBe(expectedAxisLabels.xHigh);
      expect(doc.config?.yAxisLow).toBe(expectedAxisLabels.yLow);
      expect(doc.config?.yAxisHigh).toBe(expectedAxisLabels.yHigh);
    }

    const rendered = renderMermaid(text, { format: 'svg' });
    expect(rendered.kind).toBe('quadrantChart');
    expect(rendered.svg).toContain('<svg');
    expect(rendered.scene.primitives.filter((primitive) => primitive.kind === 'circle')).toHaveLength(expectedItems);
    expect(rendered.scene.primitives.filter((primitive) => primitive.kind === 'rect').length).toBeGreaterThanOrEqual(5);

    const sceneTexts = rendered.scene.primitives
      .filter((primitive): primitive is Extract<typeof primitive, { kind: 'text' }> => primitive.kind === 'text')
      .map((primitive) => primitive.text);
    expectedLabelIncludes?.forEach((label) => expect(sceneTexts.some((textValue) => textValue.includes(label))).toBe(true));
  });

  it('parseMermaid round-trips to chart document', () => {
    const text = `quadrantChart
  title Round Trip
  Item: [0.4, 0.6]`;
    const parsed = parseMermaid(text);
    const doc = toChartDocument(parsed.doc);
    expect(parsed.kind).toBe('quadrantChart');
    expect(doc.title).toBe('Round Trip');
    expect(doc.encoding.label?.field).toBe('label');
  });

  it('renders png bytes', () => {
    const text = `quadrantChart
  title PNG
  quadrant-1 Grow
  Item: [0.75, 0.8]`;
    const rendered = renderMermaid(text, { format: 'png' });
    expect(rendered.png).toBeInstanceOf(Uint8Array);
    expect(rendered.png!.byteLength).toBeGreaterThan(1000);
  });

  it('svg contains expected axis and item text', () => {
    const text = `quadrantChart
  title Visibility
  x-axis Low Reach --> High Reach
  y-axis Low Engagement --> High Engagement
  Lead Gen: [0.65, 0.72]`;
    const rendered = renderMermaid(text, { format: 'svg' });
    expect(rendered.svg).toContain('High Reach');
    expect(rendered.svg).toContain('High Engagement');
    expect(rendered.svg).toContain('Lead Gen');
  });

  it('renders deterministically across repeated calls', () => {
    const text = `quadrantChart
  title Stable
  A: [0.3, 0.4]
  B: [0.7, 0.8]`;
    const first = renderMermaid(text, { format: 'svg' });
    const second = renderMermaid(text, { format: 'svg' });
    expect(first.sceneHash).toBe(second.sceneHash);
    expect(first.svg).toBe(second.svg);
  });
});

describe('Quadrant linear scale determinism', () => {
  it('returns same pixel for same input', () => {
    const scale = new LinearScale([0, 1], [100, 500]);
    expect(scale.scale(0.25)).toBe(scale.scale(0.25));
    expect(scale.scale(0.5)).toBe(300);
  });

  it('keeps midpoint stable', () => {
    const scale = new LinearScale([0, 1], [50, 250]);
    expect(scale.scale(0.5)).toBe(150);
  });
});

describe('Mermaid quadrant gallery assets', () => {
  it('mermaid-quadrant.mmd exists', () => {
    expect(existsSync(QUADRANT_MMD)).toBe(true);
  });

  it('parses mermaid-quadrant.mmd without error', () => {
    const text = readFileSync(QUADRANT_MMD, 'utf8');
    const doc = parseQuadrantDiagram(text);
    expect(doc.data.values.length).toBeGreaterThan(8);
  });

  it('emits mermaid-quadrant.svg to examples/gallery/', () => {
    const text = readFileSync(QUADRANT_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    writeFileSync(QUADRANT_SVG, result.svg!, 'utf8');
    expect(result.svg).toContain('High Reach');
    expect(result.svg).toContain('Viral Video');
    expect(statSync(QUADRANT_SVG).size).toBeGreaterThan(1500);
  });

  it('emits mermaid-quadrant.png to examples/gallery/', () => {
    const text = readFileSync(QUADRANT_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(QUADRANT_PNG, result.png!);
    expect(statSync(QUADRANT_PNG).size).toBeGreaterThan(5000);
  });

  it('asserts gallery SVG and PNG exist and are non-empty', () => {
    expect(existsSync(QUADRANT_SVG)).toBe(true);
    expect(existsSync(QUADRANT_PNG)).toBe(true);
    expect(statSync(QUADRANT_SVG).size).toBeGreaterThan(1500);
    expect(statSync(QUADRANT_PNG).size).toBeGreaterThan(5000);
  });
});
