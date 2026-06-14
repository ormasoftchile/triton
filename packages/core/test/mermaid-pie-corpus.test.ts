/**
 * @file test/mermaid-pie-corpus.test.ts — Mermaid pie corpus + chart scale tests.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ChartDocument } from '../src/grammars/chart/index.js';
import { BandScale, LinearScale } from '../src/grammars/chart/scales.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parsePieDiagram, parsePieDiagramInternal } from '../src/frontend/mermaid/pie.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const PIE_MMD = join(GALLERY, 'mermaid-pie.mmd');
const PIE_SVG = join(GALLERY, 'mermaid-pie.svg');
const PIE_PNG = join(GALLERY, 'mermaid-pie.png');

interface PieCase {
  name: string;
  text: string;
  expectedSlices: number;
  expectedSum: number;
  warningPattern?: RegExp;
  expectedLabelIncludes?: string[];
}

const PIE_CASES: PieCase[] = [
  {
    name: 'basic 3-slice pie',
    text: `pie\n  title Pet Adoption\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15`,
    expectedSlices: 3,
    expectedSum: 486,
    expectedLabelIncludes: ['Dogs', 'Cats', 'Rats'],
  },
  {
    name: 'single slice 100%',
    text: `pie\n  title One Slice\n  "Only" : 100`,
    expectedSlices: 1,
    expectedSum: 100,
    expectedLabelIncludes: ['Only'],
  },
  {
    name: 'many slices 8+',
    text: `pie\n  title Market Mix\n  "A" : 14\n  "B" : 12\n  "C" : 11\n  "D" : 10\n  "E" : 9\n  "F" : 8\n  "G" : 7\n  "H" : 6\n  "I" : 5`,
    expectedSlices: 9,
    expectedSum: 82,
  },
  {
    name: 'showData flag',
    text: `pie showData\n  title Pet Adoption\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15`,
    expectedSlices: 3,
    expectedSum: 486,
    expectedLabelIncludes: ['Dogs: 386'],
  },
  {
    name: 'very long labels',
    text: `pie\n  title Long Labels\n  "Very Long Product Strategy Theme Alpha" : 40\n  "Very Long Product Strategy Theme Beta" : 35\n  "Very Long Product Strategy Theme Gamma" : 25`,
    expectedSlices: 3,
    expectedSum: 100,
    expectedLabelIncludes: ['Very Long Product Strategy Theme Alpha'],
  },
  {
    name: 'small slices outside',
    text: `pie\n  title Small Slices\n  "Large" : 94\n  "Tiny1" : 2\n  "Tiny2" : 2\n  "Tiny3" : 2`,
    expectedSlices: 4,
    expectedSum: 100,
  },
  {
    name: 'zero value skipped with warning',
    text: `pie\n  title Zero\n  "Dogs" : 10\n  "Cats" : 0\n  "Birds" : 5`,
    expectedSlices: 2,
    expectedSum: 15,
    warningPattern: /Non-positive pie value skipped/i,
  },
  {
    name: 'negative value skipped with warning',
    text: `pie\n  title Negative\n  "Dogs" : 10\n  "Cats" : -2\n  "Birds" : 5`,
    expectedSlices: 2,
    expectedSum: 15,
    warningPattern: /Non-positive pie value skipped/i,
  },
  {
    name: 'missing title',
    text: `pie\n  "Dogs" : 10\n  "Cats" : 20`,
    expectedSlices: 2,
    expectedSum: 30,
  },
  {
    name: 'only title no data',
    text: `pie\n  title Empty Pie`,
    expectedSlices: 0,
    expectedSum: 0,
    warningPattern: /no positive data rows/i,
    expectedLabelIncludes: ['No data'],
  },
  {
    name: 'frontmatter theme',
    text: `---\ntheme: dark-chart\n---\npie\n  title Frontmatter Theme\n  "A" : 5\n  "B" : 3`,
    expectedSlices: 2,
    expectedSum: 8,
  },
  {
    name: 'init directive',
    text: `%%{init: {"theme": "dark-chart", "title": "Directive Pie"}}%%\npie\n  "A" : 4\n  "B" : 6`,
    expectedSlices: 2,
    expectedSum: 10,
    expectedLabelIncludes: ['Directive Pie'],
  },
  {
    name: 'real docs pet adoption',
    text: `pie showData\n  title Pet Adoption\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15`,
    expectedSlices: 3,
    expectedSum: 486,
  },
  {
    name: 'browser market share',
    text: `pie\n  title Browser Market Share 2026\n  "Chrome" : 64.4\n  "Safari" : 19.1\n  "Edge" : 5.2\n  "Firefox" : 3.5\n  "Other" : 7.8`,
    expectedSlices: 5,
    expectedSum: 100,
  },
  {
    name: 'decimal values',
    text: `pie\n  title Decimals\n  "A" : 10.5\n  "B" : 20.25\n  "C" : 5.25`,
    expectedSlices: 3,
    expectedSum: 36,
  },
  {
    name: 'blank lines and comments',
    text: `pie\n\n  %% ignored\n  title Commented\n\n  "A" : 3\n  "B" : 7`,
    expectedSlices: 2,
    expectedSum: 10,
  },
  {
    name: 'unquoted labels',
    text: `pie\n  title Unquoted\n  Dogs : 3\n  Cats : 2`,
    expectedSlices: 2,
    expectedSum: 5,
  },
  {
    name: 'inline title on header',
    text: `pie title Inline Header\n  "A" : 8\n  "B" : 2`,
    expectedSlices: 2,
    expectedSum: 10,
    expectedLabelIncludes: ['Inline Header'],
  },
  {
    name: 'inline title plus showData',
    text: `pie showData title Inline Header ShowData\n  "A" : 8\n  "B" : 2`,
    expectedSlices: 2,
    expectedSum: 10,
    expectedLabelIncludes: ['A: 8'],
  },
  {
    name: 'duplicate labels allowed',
    text: `pie\n  title Duplicate Labels\n  "A" : 4\n  "A" : 6`,
    expectedSlices: 2,
    expectedSum: 10,
  },
  {
    name: 'tiny slices all around',
    text: `pie\n  title Tiny All Around\n  "A" : 60\n  "B" : 10\n  "C" : 10\n  "D" : 5\n  "E" : 5\n  "F" : 4\n  "G" : 3\n  "H" : 2\n  "I" : 1`,
    expectedSlices: 9,
    expectedSum: 100,
  },
  {
    name: 'single decimal slice',
    text: `pie\n  title Fractional\n  "Whole" : 99.9`,
    expectedSlices: 1,
    expectedSum: 99.9,
  },
  {
    name: 'sparse whitespace',
    text: `pie\n  title   Spacing Test\n  "A"    :    1\n  "B" : 2`,
    expectedSlices: 2,
    expectedSum: 3,
  },
  {
    name: 'quoted single quotes',
    text: `pie\n  title Quotes\n  'Alpha' : 11\n  'Beta' : 9`,
    expectedSlices: 2,
    expectedSum: 20,
  },
  {
    name: 'malformed row warning',
    text: `pie\n  title Bad Row\n  "A" : 3\n  not-a-row\n  "B" : 7`,
    expectedSlices: 2,
    expectedSum: 10,
    warningPattern: /Malformed pie data row skipped/i,
  },
  {
    name: 'multiple malformed rows',
    text: `pie\n  title More Bad Rows\n  bad\n  "A" : 3\n  ???\n  "B" : 4`,
    expectedSlices: 2,
    expectedSum: 7,
    warningPattern: /Malformed pie data row skipped/i,
  },
  {
    name: 'frontmatter title fallback',
    text: `---\ntitle: FM Pie Title\n---\npie\n  "A" : 1\n  "B" : 2`,
    expectedSlices: 2,
    expectedSum: 3,
    expectedLabelIncludes: ['FM Pie Title'],
  },
  {
    name: 'directive title fallback',
    text: `%%{init: {"title": "Directive Title Pie"}}%%\npie\n  "A" : 1\n  "B" : 2`,
    expectedSlices: 2,
    expectedSum: 3,
    expectedLabelIncludes: ['Directive Title Pie'],
  },
  {
    name: 'large numeric values',
    text: `pie\n  title Large Values\n  "North" : 12500\n  "South" : 8300\n  "East" : 7600\n  "West" : 5400`,
    expectedSlices: 4,
    expectedSum: 33800,
  },
  {
    name: '2026 programming languages gallery sample',
    text: `pie title Programming Language Popularity 2026\n  "Python" : 28.5\n  "JavaScript" : 22.3\n  "TypeScript" : 12.1\n  "Java" : 10.8\n  "Rust" : 8.4\n  "Go" : 6.2\n  "Other" : 11.7`,
    expectedSlices: 7,
    expectedSum: 100,
  },
];

describe('Mermaid pie corpus', () => {
  it.each(PIE_CASES)('$name', ({ text, expectedSlices, expectedSum, warningPattern, expectedLabelIncludes }) => {
    expect(detectDiagramType(text)).toBe('pie');
    expect(() => parsePieDiagram(text)).not.toThrow();

    const parsed = parsePieDiagramInternal(text);
    const parsedViaIndex = parseMermaid(text);
    expect(parsedViaIndex.kind).toBe('pie');

    const doc = parsed.doc;
    const total = doc.data.values.reduce((sum, row) => sum + Number(row['value'] ?? 0), 0);
    expect(doc.chartType).toBe('pie');
    expect(doc.data.values).toHaveLength(expectedSlices);
    expect(Math.abs(total - expectedSum)).toBeLessThan(0.0001);

    if (warningPattern) {
      expect(parsed.warnings.some((warning) => warningPattern.test(warning))).toBe(true);
    }

    const rendered = renderMermaid(text, { format: 'svg' });
    expect(rendered.kind).toBe('pie');
    expect(rendered.svg).toContain('<svg');
    const slicePaths = rendered.scene.primitives.filter((primitive) => primitive.kind === 'path');
    expect(slicePaths).toHaveLength(expectedSlices);

    const sceneTexts = rendered.scene.primitives
      .filter((primitive): primitive is Extract<typeof primitive, { kind: 'text' }> => primitive.kind === 'text')
      .map((primitive) => primitive.text);
    expectedLabelIncludes?.forEach((label) => expect(sceneTexts.some((textValue) => textValue.includes(label))).toBe(true));
  });

  it('applies frontmatter theme in renderMermaid', () => {
    const result = renderMermaid(`---\ntheme: dark-chart\n---\npie\n  "A" : 5\n  "B" : 3`, { format: 'svg' });
    expect(result.scene.background).toBe('#1a1a2e');
  });

  it('renders deterministically across repeated calls', () => {
    const text = `pie\n  title Deterministic\n  "A" : 7\n  "B" : 2\n  "C" : 1`;
    const first = renderMermaid(text, { format: 'svg' });
    const second = renderMermaid(text, { format: 'svg' });
    expect(first.sceneHash).toBe(second.sceneHash);
    expect(first.svg).toBe(second.svg);
  });
});

describe('Chart scales', () => {
  it('rounds nice linear domains deterministically', () => {
    expect(LinearScale.nice([12, 87], 5)).toEqual([0, 100]);
    expect(LinearScale.nice([1200, 4200], 5)).toEqual([1000, 5000]);
  });

  it('generates deterministic ticks from nicened domains', () => {
    const scale = new LinearScale([0, 100], [0, 400]);
    expect(scale.ticks(5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('computes deterministic band spacing', () => {
    const scale = new BandScale(['A', 'B', 'C', 'D'], [0, 400], 0.2);
    expect(scale.step()).toBe(100);
    expect(scale.bandwidth()).toBe(80);
    expect(scale.scale('A')).toBeCloseTo(50, 6);
    expect(scale.scale('D')).toBeCloseTo(350, 6);
  });
});

describe('Mermaid pie gallery assets', () => {
  it('mermaid-pie.mmd exists', () => {
    expect(existsSync(PIE_MMD)).toBe(true);
  });

  it('parses mermaid-pie.mmd without error', () => {
    const text = readFileSync(PIE_MMD, 'utf8');
    const doc = parsePieDiagram(text);
    expect(doc.data.values.length).toBeGreaterThan(5);
  });

  it('emits mermaid-pie.svg to examples/gallery/', () => {
    const text = readFileSync(PIE_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    writeFileSync(PIE_SVG, result.svg!, 'utf8');
    expect(statSync(PIE_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-pie.png to examples/gallery/', () => {
    const text = readFileSync(PIE_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(PIE_PNG, result.png!);
    expect(statSync(PIE_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts gallery SVG and PNG exist and are non-empty', () => {
    expect(existsSync(PIE_SVG)).toBe(true);
    expect(existsSync(PIE_PNG)).toBe(true);
    expect(statSync(PIE_SVG).size).toBeGreaterThan(1000);
    expect(statSync(PIE_PNG).size).toBeGreaterThan(1000);
  });
});
