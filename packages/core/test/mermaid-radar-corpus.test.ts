/**
 * @file test/mermaid-radar-corpus.test.ts — Mermaid radar / radar-beta corpus.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ChartDocument } from '../src/grammars/chart/index.js';
import { RadialScale } from '../src/grammars/chart/scales.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseRadarDiagram, parseRadarDiagramInternal } from '../src/frontend/mermaid/radar.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const RADAR_MMD = join(GALLERY, 'mermaid-radar.mmd');
const RADAR_SVG = join(GALLERY, 'mermaid-radar.svg');
const RADAR_PNG = join(GALLERY, 'mermaid-radar.png');

interface RadarCase {
  name: string;
  text: string;
  expectedAxes: string[];
  expectedSeries: number;
  expectedSyntax?: 'radar-beta' | 'radar-simple';
  warningPattern?: RegExp;
  expectedLabelIncludes?: string[];
}

const RADAR_CASES: RadarCase[] = [
  {
    name: 'radar beta all features',
    text: `radar-beta
  title "Beta Radar"
  axis a["Speed"], b["Reliability"], c["Comfort"], d["Safety"]
  curve "Series 1"{4, 3, 5, 2}
  curve "Series 2"[3, 4, 2, 5]
  max 5
  min 0
  graticule 5`,
    expectedAxes: ['Speed', 'Reliability', 'Comfort', 'Safety'],
    expectedSeries: 2,
    expectedSyntax: 'radar-beta',
    expectedLabelIncludes: ['Beta Radar', 'Series 1', 'Series 2', 'Speed'],
  },
  {
    name: 'simple radar syntax',
    text: `radar
  title Skills Assessment
  axes: [Speed, Reliability, Comfort, Safety, Efficiency]
  "Model A": [4, 3, 2, 5, 4]
  "Model B": [2, 5, 4, 3, 3]`,
    expectedAxes: ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency'],
    expectedSeries: 2,
    expectedSyntax: 'radar-simple',
    expectedLabelIncludes: ['Skills Assessment', 'Model A', 'Model B'],
  },
  {
    name: 'three axis radar',
    text: `radar
  axes: [A, B, C]
  "Only": [1, 2, 3]`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 1,
  },
  {
    name: 'six axis radar',
    text: `radar-beta
  axis a["A"], b["B"], c["C"], d["D"], e["E"], f["F"]
  curve "One"{1, 2, 3, 4, 5, 6}`,
    expectedAxes: ['A', 'B', 'C', 'D', 'E', 'F'],
    expectedSeries: 1,
    expectedSyntax: 'radar-beta',
  },
  {
    name: 'eight axis radar',
    text: `radar
  axes: [A, B, C, D, E, F, G, H]
  "Octo": [1, 2, 3, 4, 5, 6, 7, 8]`,
    expectedAxes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    expectedSeries: 1,
  },
  {
    name: 'three series simple',
    text: `radar
  axes: [A, B, C, D]
  "S1": [1, 2, 3, 4]
  "S2": [4, 3, 2, 1]
  "S3": [2, 2, 2, 2]`,
    expectedAxes: ['A', 'B', 'C', 'D'],
    expectedSeries: 3,
  },
  {
    name: 'single series beta',
    text: `radar-beta
  axis a["Latency"], b["Throughput"], c["Stability"]
  curve service{2, 5, 4}`,
    expectedAxes: ['Latency', 'Throughput', 'Stability'],
    expectedSeries: 1,
  },
  {
    name: 'min max bounds stored',
    text: `radar
  axes: [A, B, C]
  "Bounded": [10, 20, 30]
  min 10
  max 30`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 1,
  },
  {
    name: 'mismatched value counts warns',
    text: `radar
  axes: [A, B, C, D]
  "Short": [1, 2, 3]`,
    expectedAxes: ['A', 'B', 'C', 'D'],
    expectedSeries: 1,
    warningPattern: /padding\/truncating/i,
  },
  {
    name: 'no series warning',
    text: `radar
  axes: [A, B, C]`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 0,
    warningPattern: /no series data/i,
  },
  {
    name: 'no axes warning',
    text: `radar
  "Series": [1, 2, 3]`,
    expectedAxes: [],
    expectedSeries: 1,
    warningPattern: /fewer than 3 axes/i,
  },
  {
    name: 'fewer than three axes warning',
    text: `radar
  axes: [A, B]
  "Series": [1, 2]`,
    expectedAxes: ['A', 'B'],
    expectedSeries: 1,
    warningPattern: /fewer than 3 axes/i,
  },
  {
    name: 'frontmatter title fallback',
    text: `---
title: Frontmatter Radar
---
radar
  axes: [A, B, C]
  "Series": [1, 2, 3]`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 1,
    expectedLabelIncludes: ['Frontmatter Radar'],
  },
  {
    name: 'directive title fallback',
    text: `%%{init: {"title": "Directive Radar"}}%%
radar-beta
  axis a["A"], b["B"], c["C"]
  curve alpha{1, 2, 3}`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 1,
    expectedSyntax: 'radar-beta',
    expectedLabelIncludes: ['Directive Radar'],
  },
  {
    name: 'graticule option simple',
    text: `radar
  axes: [A, B, C, D]
  graticule 6
  "Series": [2, 2, 2, 2]`,
    expectedAxes: ['A', 'B', 'C', 'D'],
    expectedSeries: 1,
  },
  {
    name: 'radar header with beta subset syntax',
    text: `radar
  axis a["Speed"], b["Quality"], c["Scale"]
  curve team{3, 4, 5}`,
    expectedAxes: ['Speed', 'Quality', 'Scale'],
    expectedSeries: 1,
    expectedSyntax: 'radar-beta',
  },
  {
    name: 'axes after curves backfill',
    text: `radar-beta
  curve "Late"{1, 2, 3}
  axis a["A"], b["B"], c["C"]`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 1,
    expectedSyntax: 'radar-beta',
  },
  {
    name: 'malformed curve warning',
    text: `radar-beta
  axis a["A"], b["B"], c["C"]
  curve "Oops"1, 2, 3`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 0,
    expectedSyntax: 'radar-beta',
    warningPattern: /Malformed curve line skipped/i,
  },
  {
    name: 'non numeric simple warning',
    text: `radar
  axes: [A, B, C]
  "Bad": [1, nope, 3]`,
    expectedAxes: ['A', 'B', 'C'],
    expectedSeries: 0,
    warningPattern: /Non-numeric values/i,
  },
  {
    name: 'multiple named beta series',
    text: `radar-beta
  title Team Comparison
  axis s["Speed"], q["Quality"], c["Clarity"], o["Ownership"], l["Learning"], p["Planning"]
  curve one["Team A"]{5, 4, 4, 5, 4, 5}
  curve two["Team B"][4, 5, 5, 4, 5, 4]
  curve three["Team C"]{3, 4, 5, 3, 4, 5}`,
    expectedAxes: ['Speed', 'Quality', 'Clarity', 'Ownership', 'Learning', 'Planning'],
    expectedSeries: 3,
    expectedSyntax: 'radar-beta',
    expectedLabelIncludes: ['Team Comparison', 'Team A', 'Team B', 'Team C'],
  },
];

function toChartDocument(doc: ReturnType<typeof parseMermaid>['doc']): ChartDocument {
  return doc as ChartDocument;
}

describe('Mermaid radar corpus', () => {
  it.each(RADAR_CASES)('$name', ({ text, expectedAxes, expectedSeries, expectedSyntax, warningPattern, expectedLabelIncludes }) => {
    expect(detectDiagramType(text)).toBe('radar');
    expect(() => parseRadarDiagram(text)).not.toThrow();

    const parsed = parseRadarDiagramInternal(text);
    const viaIndex = parseMermaid(text);
    expect(viaIndex.kind).toBe('radar');

    const doc = toChartDocument(viaIndex.doc);
    expect(doc.chartType).toBe('radar');
    expect(doc.config?.radarAxes ?? []).toEqual(expectedAxes);
    expect(doc.data.values).toHaveLength(expectedSeries);

    if (expectedSyntax) expect(parsed.syntax).toBe(expectedSyntax);
    if (warningPattern) {
      expect(parsed.warnings.some((warning) => warningPattern.test(warning))).toBe(true);
    }

    const rendered = renderMermaid(text, { format: 'svg' });
    expect(rendered.kind).toBe('radar');
    expect(rendered.svg).toContain('<svg');
    const pathCount = rendered.scene.primitives.filter((primitive) => primitive.kind === 'path').length;
    if (expectedAxes.length >= 3 && expectedSeries > 0) {
      expect(pathCount).toBeGreaterThanOrEqual(expectedSeries + (doc.config?.radarGraticule ?? 4));
    }

    const sceneTexts = rendered.scene.primitives
      .filter((primitive): primitive is Extract<typeof primitive, { kind: 'text' }> => primitive.kind === 'text')
      .map((primitive) => primitive.text);
    expectedLabelIncludes?.forEach((label) => expect(sceneTexts.some((textValue) => textValue.includes(label))).toBe(true));
  });

  it('detectDiagramType returns radar for radar-beta and radar', () => {
    expect(detectDiagramType('radar-beta\naxis a["A"], b["B"], c["C"]')).toBe('radar');
    expect(detectDiagramType('radar\naxes: [A, B, C]')).toBe('radar');
  });

  it('parseMermaid round-trips to chart document', () => {
    const parsed = parseMermaid(`radar
  title Round Trip Radar
  axes: [A, B, C]
  "Series": [2, 3, 4]`);
    const doc = toChartDocument(parsed.doc);
    expect(parsed.kind).toBe('radar');
    expect(doc.title).toBe('Round Trip Radar');
    expect(doc.encoding.color?.field).toBe('_name');
  });

  it('renders png bytes', () => {
    const result = renderMermaid(`radar-beta
  axis a["A"], b["B"], c["C"], d["D"]
  curve "One"{1, 2, 3, 4}
  curve "Two"{2, 3, 4, 5}` , { format: 'png' });
    expect(result.png).toBeInstanceOf(Uint8Array);
    expect(result.png!.byteLength).toBeGreaterThan(1000);
  });

  it('svg contains expected labels and series names', () => {
    const rendered = renderMermaid(`radar-beta
  title Dev Radar
  axis a["Speed"], b["Reliability"], c["Communication"], d["Leadership"]
  curve "Senior"{9, 8, 7, 8}
  curve "Junior"{6, 5, 5, 3}
  max 10
  min 0`, { format: 'svg' });
    expect(rendered.svg).toContain('Speed');
    expect(rendered.svg).toContain('Reliability');
    expect(rendered.svg).toContain('Senior');
    expect(rendered.svg).toContain('Junior');
  });

  it('renders deterministically across repeated calls', () => {
    const text = `radar
  title Stable Radar
  axes: [A, B, C, D, E]
  "Series": [1, 2, 3, 4, 5]`;
    const first = renderMermaid(text, { format: 'svg' });
    const second = renderMermaid(text, { format: 'svg' });
    expect(first.sceneHash).toBe(second.sceneHash);
    expect(first.svg).toBe(second.svg);
  });

  it('renders placeholder text when fewer than three axes exist', () => {
    const result = renderMermaid(`radar
  axes: [A, B]
  "Series": [1, 2]`, { format: 'svg' });
    expect(result.svg).toContain('Radar requires at least 3 axes');
  });
});

describe('RadialScale determinism', () => {
  it('returns same normalized radius for same value', () => {
    const scale = new RadialScale([0, 10], [0, 1]);
    expect(scale.scale(4)).toBe(scale.scale(4));
    expect(scale.scale(5)).toBe(0.5);
  });

  it('clamps consistently at domain edges', () => {
    const scale = new RadialScale([2, 8], [0, 1]);
    expect(scale.clampedScale(-10)).toBe(0);
    expect(scale.clampedScale(20)).toBe(1);
  });
});

describe('Mermaid radar gallery assets', () => {
  it('mermaid-radar.mmd exists', () => {
    expect(existsSync(RADAR_MMD)).toBe(true);
  });

  it('parses mermaid-radar.mmd without error', () => {
    const text = readFileSync(RADAR_MMD, 'utf8');
    const doc = parseRadarDiagram(text);
    expect(doc.data.values.length).toBeGreaterThan(1);
    expect(doc.config?.radarAxes?.length).toBeGreaterThan(5);
  });

  it('emits mermaid-radar.svg to examples/gallery/', () => {
    const text = readFileSync(RADAR_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    writeFileSync(RADAR_SVG, result.svg!, 'utf8');
    expect(result.svg).toContain('Speed');
    expect(result.svg).toContain('Senior Dev');
    expect(statSync(RADAR_SVG).size).toBeGreaterThan(1500);
  });

  it('emits mermaid-radar.png to examples/gallery/', () => {
    const text = readFileSync(RADAR_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(RADAR_PNG, result.png!);
    expect(statSync(RADAR_PNG).size).toBeGreaterThan(5000);
  });

  it('asserts gallery SVG and PNG exist and are non-empty', () => {
    expect(existsSync(RADAR_SVG)).toBe(true);
    expect(existsSync(RADAR_PNG)).toBe(true);
    expect(statSync(RADAR_SVG).size).toBeGreaterThan(1500);
    expect(statSync(RADAR_PNG).size).toBeGreaterThan(5000);
  });
});
