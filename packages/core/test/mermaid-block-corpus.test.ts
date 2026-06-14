/**
 * @file test/mermaid-block-corpus.test.ts — Block grammar corpus tests.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  blockDocumentSchema,
  buildBlockScene,
  resolveBlockTheme,
} from '../src/grammars/block/index.js';
import type { BlockDocument } from '../src/grammars/block/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseBlockDiagram, parseBlockDiagramInternal } from '../src/frontend/mermaid/block.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const BLOCK_MMD = join(GALLERY, 'mermaid-block.mmd');
const BLOCK_SVG = join(GALLERY, 'mermaid-block.svg');
const BLOCK_PNG = join(GALLERY, 'mermaid-block.png');

function texts(rendered: ReturnType<typeof renderMermaid>): string[] {
  return rendered.scene.primitives.flatMap((p) => {
    if (p.kind === 'text') return [p.text];
    if (p.kind === 'multitext') return p.lines;
    return [] as string[];
  });
}

function count(rendered: ReturnType<typeof renderMermaid>, kind: string): number {
  return rendered.scene.primitives.filter((p) => p.kind === kind).length;
}

interface BlockCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: BlockDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

const BASE_BLOCK_CASES: BlockCase[] = [
  {
    name: 'minimal 3-column grid with arrow',
    text: `block-beta
  columns 3
  a["A"] b["B"] c["C"]
  d["D"] e["E"] f["F"]
  a --> d`,
    assert: (doc, warnings, rendered) => {
      expect(doc.columns).toBe(3);
      expect(doc.items.filter((item) => !item.isSpace)).toHaveLength(6);
      expect(doc.arrows).toHaveLength(1);
      expect(warnings).toHaveLength(0);
      expect(count(rendered, 'line')).toBeGreaterThanOrEqual(1);
      expect(texts(rendered)).toContain('A');
      expect(texts(rendered)).toContain('F');
    },
  },
  {
    name: 'bare ids use id as label',
    text: `block-beta
  columns 2
  alpha beta`,
    assert: (doc) => {
      expect(doc.items[0]?.label).toBe('alpha');
      expect(doc.items[1]?.label).toBe('beta');
    },
  },
  {
    name: 'labeled span parses',
    text: `block-beta
  columns 3
  api["API Layer"]:2 db["DB"]`,
    assert: (doc) => {
      expect(doc.items[0]?.span).toBe(2);
      expect(doc.items[1]?.span).toBe(1);
    },
  },
  {
    name: 'space token is preserved for placement',
    text: `block-beta
  columns 3
  a["A"] space c["C"]`,
    assert: (doc) => {
      expect(doc.items.some((item) => item.isSpace)).toBe(true);
      expect(doc.items.filter((item) => !item.isSpace)).toHaveLength(2);
    },
  },
  {
    name: 'space:N span parses',
    text: `block-beta
  columns 4
  a["A"] space:2 d["D"]`,
    assert: (doc) => {
      const space = doc.items.find((item) => item.isSpace);
      expect(space?.span).toBe(2);
    },
  },
  {
    name: 'rounded shape parses',
    text: `block-beta
  columns 1
  a("Rounded")`,
    assert: (doc) => {
      expect(doc.items[0]?.shape).toBe('rounded');
    },
  },
  {
    name: 'circle shape parses',
    text: `block-beta
  columns 1
  a(("Circle"))`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.items[0]?.shape).toBe('circle');
      expect(count(rendered, 'circle')).toBe(1);
    },
  },
  {
    name: 'diamond shape parses',
    text: `block-beta
  columns 1
  a{"Choice"}`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.items[0]?.shape).toBe('diamond');
      expect(count(rendered, 'path')).toBeGreaterThanOrEqual(1);
    },
  },
  {
    name: 'flag shape degrades gracefully',
    text: `block-beta
  columns 1
  a>"Flag"]`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.items[0]?.shape).toBe('flag');
      expect(count(rendered, 'rect')).toBeGreaterThanOrEqual(1);
    },
  },
  {
    name: 'labeled arrow parses',
    text: `block-beta
  columns 2
  a["A"] b["B"]
  a -- "calls" --> b`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.arrows[0]?.label).toBe('calls');
      expect(texts(rendered)).toContain('calls');
    },
  },
  {
    name: 'group parses child ids',
    text: `block-beta
  columns 3
  block:svc["Services"]:3 api["API"] auth["Auth"] db["DB"] end`,
    assert: (doc) => {
      expect(doc.groups).toHaveLength(1);
      expect(doc.groups[0]?.label).toBe('Services');
      expect(doc.groups[0]?.childIds).toHaveLength(3);
    },
  },
  {
    name: 'nested groups parse parent relationship',
    text: `block-beta
  columns 3
  block:outer["Outer"]:3 block:inner["Inner"]:2 a["A"] b["B"] end c["C"] end`,
    assert: (doc) => {
      expect(doc.groups).toHaveLength(2);
      const inner = doc.groups.find((group) => group.id.startsWith('inner'));
      expect(inner?.group).toMatch(/^outer/);
    },
  },
  {
    name: 'frontmatter theme and title are captured',
    text: `---
theme: dark-block
title: Block Title
---
block-beta
  columns 1
  a["A"]`,
    assert: (doc) => {
      expect(doc.metadata.theme).toBe('dark-block');
      expect(doc.metadata.title).toBe('Block Title');
    },
  },
  {
    name: 'inline title line is captured',
    text: `block-beta
  title Local Block Title
  columns 1
  a["A"]`,
    assert: (doc) => {
      expect(doc.metadata.title).toBe('Local Block Title');
    },
  },
  {
    name: 'unknown token warns and skips',
    text: `block-beta
  columns 2
  a["A"] ??? b["B"]`,
    warningPattern: /could not parse block token/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /could not parse block token/.test(w))).toBe(true);
      expect(doc.items.filter((item) => !item.isSpace)).toHaveLength(2);
    },
  },
  {
    name: 'stray end warns',
    text: `block-beta
  columns 1
  end
  a["A"]`,
    warningPattern: /stray 'end'/,
    assert: (_doc, warnings) => {
      expect(warnings.some((w) => /stray 'end'/.test(w))).toBe(true);
    },
  },
  {
    name: 'schema validation passes',
    text: `block-beta
  columns 2
  a["A"] b["B"]`,
    assert: (doc) => {
      expect(() => blockDocumentSchema.parse(doc)).not.toThrow();
    },
  },
  {
    name: 'render scene has arrowhead path',
    text: `block-beta
  columns 2
  a["A"] b["B"]
  a --> b`,
    assert: (_doc, _warnings, rendered) => {
      expect(count(rendered, 'line')).toBe(1);
      expect(count(rendered, 'path')).toBeGreaterThanOrEqual(1);
    },
  },
  {
    name: 'dark theme renders without error',
    text: `block-beta
  columns 2
  a["Dark"] b["Node"]`,
    assert: (_doc, _warnings) => {
      const rendered = renderMermaid(`block-beta\n  columns 2\n  a["Dark"] b["Node"]`, { format: 'svg', theme: 'dark-block' });
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(200);
    },
  },
  {
    name: 'scene size is positive',
    text: `block-beta
  columns 4
  a b c d
a --> d`,
    assert: (_doc, _warnings, rendered) => {
      expect(rendered.scene.width).toBeGreaterThan(0);
      expect(rendered.scene.height).toBeGreaterThan(0);
    },
  },
  {
    name: 'parseBlockDiagram helper returns document',
    text: `block-beta
  columns 1
  a["A"]`,
    assert: (_doc) => {
      const parsed = parseBlockDiagram(`block-beta\n  columns 1\n  a["A"]`);
      expect(parsed.items[0]?.label).toBe('A');
    },
  },
  {
    name: 'direct parser exposes frontmatter metadata',
    text: `%%{init: {"theme": "dark-block", "title": "Directive Title"}}%%
block-beta
  columns 1
  a["A"]`,
    assert: (doc) => {
      const direct = parseBlockDiagramInternal(`%%{init: {"theme": "dark-block", "title": "Directive Title"}}%%\nblock-beta\n  columns 1\n  a["A"]`);
      expect(direct.doc.metadata.theme).toBe('dark-block');
      expect(doc.metadata.title).toBe('Directive Title');
    },
  },
];

const GENERATED_BLOCK_CASES: BlockCase[] = [
  ...['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map((label, index) => ({
    name: `generated single-row label ${label}`,
    text: `block-beta\n  columns 3\n  n${index}["${label}"]`,
    assert: (doc: BlockDocument, _warnings: string[], rendered: ReturnType<typeof renderMermaid>) => {
      expect(doc.items[0]?.label).toBe(label);
      expect(texts(rendered)).toContain(label);
    },
  })),
  ...[
    { span: 2, cols: 3 },
    { span: 3, cols: 4 },
    { span: 2, cols: 2 },
    { span: 1, cols: 4 },
    { span: 2, cols: 5 },
    { span: 3, cols: 3 },
  ].map(({ span, cols }, index) => ({
    name: `generated span case ${index + 1}`,
    text: `block-beta\n  columns ${cols}\n  a["A"]:${span} b["B"]`,
    assert: (doc: BlockDocument) => {
      expect(doc.items[0]?.span).toBe(span);
      expect(doc.columns).toBe(cols);
    },
  })),
  ...[
    ['rect', 'a["Rect"]'],
    ['rounded', 'a("Round")'],
    ['circle', 'a(("Circle"))'],
    ['diamond', 'a{"Diamond"}'],
    ['flag', 'a>"Flag"]'],
  ].map(([shape, token]) => ({
    name: `generated shape ${shape}`,
    text: `block-beta\n  columns 1\n  ${token}`,
    assert: (doc: BlockDocument) => {
      expect(doc.items[0]?.shape).toBe(shape);
    },
  })),
];

const BLOCK_CASES = [...BASE_BLOCK_CASES, ...GENERATED_BLOCK_CASES];

describe('mermaid-block-corpus', () => {
  it('detectDiagramType recognises block-beta', () => {
    expect(detectDiagramType('block-beta\n  columns 1\n  a["A"]')).toBe('block');
  });

  it('resolveBlockTheme returns default theme', () => {
    expect(resolveBlockTheme().cellWidth).toBeGreaterThan(0);
  });

  it('buildBlockScene works directly', () => {
    const doc = parseBlockDiagram(`block-beta\n  columns 2\n  a["A"] b["B"]`);
    const scene = buildBlockScene(doc);
    expect(scene.width).toBeGreaterThan(0);
  });

  for (const tc of BLOCK_CASES) {
    it(tc.name, () => {
      const normalised = tc.text.trim();
      const { doc: rawDoc, warnings } = parseMermaid(normalised);
      const doc = rawDoc as BlockDocument;
      blockDocumentSchema.parse(doc);
      const rendered = renderMermaid(normalised, { format: 'svg' });
      expect(rendered.kind).toBe('block');
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(10);
      if (tc.warningPattern) {
        expect(warnings.some((w) => tc.warningPattern!.test(w))).toBe(true);
      }
      tc.assert(doc, warnings, rendered);
    });
  }

  it('emits mermaid-block.svg to examples/gallery/', () => {
    const text = readFileSync(BLOCK_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('block');
    writeFileSync(BLOCK_SVG, result.svg!, 'utf8');
    expect(statSync(BLOCK_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-block.png to examples/gallery/', () => {
    const text = readFileSync(BLOCK_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(BLOCK_PNG, result.png!);
    expect(statSync(BLOCK_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts block gallery files exist and are non-empty', () => {
    expect(existsSync(BLOCK_SVG)).toBe(true);
    expect(existsSync(BLOCK_PNG)).toBe(true);
    expect(statSync(BLOCK_SVG).size).toBeGreaterThan(1000);
    expect(statSync(BLOCK_PNG).size).toBeGreaterThan(1000);
  });
});
