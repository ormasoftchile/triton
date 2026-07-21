import { describe, it, expect } from 'vitest';
import { parseList, layoutList, asFlow, cellForIndex, asTurn } from '../src/diagrams/triton/deck/list/list.js';
import { detect } from '../src/frontend/detect.js';
import { renderSync, compileAndRenderSync } from '../src/frontend/index.js';
import { embedRevealManifest } from '../src/render/svg.js';
import { resolveTheme } from '../src/theme/resolver.js';
import { defaultTheme } from '../src/theme/preset.js';
import '../src/frontend/index.js'; // registers diagram modules

const SOURCE = `list
  title Agenda
  Introduction
  - The problem
  * Our approach
  Results
`;

const NESTED = `list
  Frontend
    React app
    CDN
  Backend
    API gateway
      Auth
    Workers
  Data
`;

// ─── Detection ────────────────────────────────────────────────────────────────

describe('list detection', () => {
  it('routes `list` source to the list diagram', () => {
    expect(detect(SOURCE).diagramType).toBe('list');
  });
});

// ─── Parse ────────────────────────────────────────────────────────────────────

describe('parseList', () => {
  it('extracts the title and item list, stripping list markers', () => {
    const doc = parseList(SOURCE);
    expect(doc.title).toBe('Agenda');
    expect(doc.items.map(i => i.text)).toEqual(['Introduction', 'The problem', 'Our approach', 'Results']);
  });

  it('defaults to the `bullets` style and `sequence` reveal', () => {
    const doc = parseList(SOURCE);
    expect(doc.style).toBe('bullets');
    expect(doc.reveal).toBe('sequence');
  });

  it('reads a `style` directive', () => {
    expect(parseList('list\n  style block\n  One\n').style).toBe('block');
    expect(parseList('list\n  style numbered\n  One\n').style).toBe('numbered');
    expect(parseList('list\n  style box\n  One\n').style).toBe('box');
    expect(parseList('list\n  style tree\n  One\n').style).toBe('tree');
  });

  it('ignores an unknown `style` and keeps the default', () => {
    expect(parseList('list\n  style spaghetti\n  One\n').style).toBe('bullets');
  });

  it('reads a `reveal` directive', () => {
    expect(parseList('list\n  reveal subtree\n  One\n').reveal).toBe('subtree');
  });

  it('works with no title', () => {
    const doc = parseList('list\n  One\n  Two\n');
    expect(doc.title).toBeUndefined();
    expect(doc.items.map(i => i.text)).toEqual(['One', 'Two']);
  });

  it('ignores an injected `---…---` theme frontmatter block', () => {
    const doc = parseList('---\ntheme: midnight\n---\nlist\n  One\n  Two\n  Three\n');
    expect(doc.items.map(i => i.text)).toEqual(['One', 'Two', 'Three']);
  });

  it('lifts the frontmatter `theme` into metadata so the theme resolver sees it', () => {
    const doc = parseList('---\ntheme: minimal\n---\nlist\n  One\n  Two\n');
    expect(doc.metadata.theme).toBe('minimal');
  });

  it('has empty metadata when there is no frontmatter', () => {
    expect(parseList('list\n  One\n').metadata).toEqual({});
  });
});

// ─── Parse: nesting ─────────────────────────────────────────────────────────

describe('parseList nesting', () => {
  it('assigns depth from indentation', () => {
    const doc = parseList(NESTED);
    expect(doc.items.map(i => [i.text, i.depth])).toEqual([
      ['Frontend', 0],
      ['React app', 1],
      ['CDN', 1],
      ['Backend', 0],
      ['API gateway', 1],
      ['Auth', 2],
      ['Workers', 1],
      ['Data', 0],
    ]);
  });

  it('assigns stable hierarchical ids', () => {
    const doc = parseList(NESTED);
    expect(doc.items.map(i => i.id)).toEqual([
      'item-0',
      'item-0-0',
      'item-0-1',
      'item-1',
      'item-1-0',
      'item-1-0-0',
      'item-1-1',
      'item-2',
    ]);
  });

  it('assigns 1-based dotted ordinals for numbered style', () => {
    const doc = parseList(NESTED);
    expect(doc.items.map(i => i.numberLabel)).toEqual([
      '1', '1.1', '1.2', '2', '2.1', '2.1.1', '2.2', '3',
    ]);
  });

  it('handles 4-space and tab indentation the same way', () => {
    const fourSpace = parseList('list\nRoot\n    Child\n        Grandchild\n');
    expect(fourSpace.items.map(i => i.depth)).toEqual([0, 1, 2]);
    const tabbed = parseList('list\nRoot\n\tChild\n\t\tGrandchild\n');
    expect(tabbed.items.map(i => i.depth)).toEqual([0, 1, 2]);
  });
});

// ─── Layout: anchors + reveal ──────────────────────────────────────────────────

describe('layoutList', () => {
  const theme = resolveTheme({}, defaultTheme);

  it('emits one anchor group per item, including nested items', () => {
    const result = layoutList(parseList(NESTED), theme);
    expect(Object.keys(result.anchors).sort()).toEqual([
      'item-0', 'item-0-0', 'item-0-1',
      'item-1', 'item-1-0', 'item-1-0-0', 'item-1-1',
      'item-2',
    ].sort());
  });

  it('emits a reveal track with one step per item in sequence mode', () => {
    const result = layoutList(parseList(SOURCE), theme);
    expect(result.reveal).toBeDefined();
    const steps = result.reveal!.steps;
    expect(steps).toHaveLength(4);
    expect(steps.map(s => s.enter)).toEqual([
      ['item-0'], ['item-1'], ['item-2'], ['item-3'],
    ]);
  });

  it('renders each style without error and keeps per-item groups', () => {
    for (const style of [
      'bullets', 'numbered', 'block', 'box', 'tree',
      'chevron', 'process', 'timeline', 'pyramid', 'columns',
      'cycle', 'matrix', 'funnel', 'stepup', 'venn',
    ] as const) {
      const doc = parseList(`list\n  style ${style}\n  One\n  Two\n`);
      const result = layoutList(doc, theme);
      expect(Object.keys(result.anchors).sort()).toEqual(['item-0', 'item-1']);
      expect(result.scene.elements.length).toBeGreaterThan(0);
      // No degenerate geometry leaks into any style's SVG.
      expect(JSON.stringify(result.scene)).not.toMatch(/NaN|undefined/);
    }
  });

  it('tree style emits a node group per item plus parent connectors', () => {
    const treed = 'list\n  style tree\n' + NESTED.split('\n').slice(1).join('\n');
    const result = layoutList(parseList(treed), theme);
    // Every item (root + nested) is a positioned node.
    expect(Object.keys(result.anchors)).toHaveLength(8);
    // A path (connector) exists for every non-root node (5 of the 8).
    const paths = JSON.stringify(result.scene.elements).match(/"type":"path"/g) ?? [];
    expect(paths).toHaveLength(5);
  });
});

// ─── Phase C styles (chevron / process / timeline / pyramid / columns) ──────────

describe('list Phase C styles', () => {
  const theme = resolveTheme({}, defaultTheme);
  const FLAT = 'list\n  Alpha\n  Beta\n  Gamma\n';

  const countPaths = (r: ReturnType<typeof layoutList>): number =>
    (JSON.stringify(r.scene.elements).match(/"type":"path"/g) ?? []).length;

  it('chevron lays out items in a single horizontal row of filled arrows', () => {
    const r = layoutList(parseList('list\n  style chevron\n' + FLAT.split('\n').slice(1).join('\n')), theme);
    expect(Object.keys(r.anchors).sort()).toEqual(['item-0', 'item-1', 'item-2']);
    // One filled arrow path per item; all share the same top (single row).
    expect(countPaths(r)).toBe(3);
    const ys = Object.values(r.anchors).map(a => a.bounds.y);
    expect(new Set(ys).size).toBe(1);
    // Blocks advance left→right.
    const xs = ['item-0', 'item-1', 'item-2'].map(id => r.anchors[id]!.bounds.x);
    expect(xs[1]!).toBeGreaterThan(xs[0]!);
    expect(xs[2]!).toBeGreaterThan(xs[1]!);
  });

  it('process joins boxes with arrow connectors (one incoming arrow per non-first box)', () => {
    const r = layoutList(parseList('list\n  style process\n' + FLAT.split('\n').slice(1).join('\n')), theme);
    // Each non-first box carries a line + arrowhead = 2 paths × 2 boxes = 4.
    expect(countPaths(r)).toBe(4);
    // Boxes are rects, one per item.
    const rects = (JSON.stringify(r.scene.elements).match(/"type":"rect"/g) ?? []).length;
    expect(rects).toBe(3);
  });

  it('timeline places dots on a shared horizontal axis with connecting segments', () => {
    const r = layoutList(parseList('list\n  style timeline\n' + FLAT.split('\n').slice(1).join('\n')), theme);
    const circles = (JSON.stringify(r.scene.elements).match(/"type":"circle"/g) ?? []).length;
    expect(circles).toBe(3);
    // One axis segment between each pair of dots (2 for 3 items).
    expect(countPaths(r)).toBe(2);
  });

  it('pyramid stacks trapezoids that widen toward the base', () => {
    const r = layoutList(parseList('list\n  style pyramid\n' + FLAT.split('\n').slice(1).join('\n')), theme);
    expect(countPaths(r)).toBe(3);
    const widths = ['item-0', 'item-1', 'item-2'].map(id => r.anchors[id]!.bounds.width);
    expect(widths[1]!).toBeGreaterThan(widths[0]!);
    expect(widths[2]!).toBeGreaterThan(widths[1]!);
  });

  it('columns groups depth-0 headers with their nested cells side by side', () => {
    const src = `list
  style columns
  Pros
    Fast
    Cheap
  Cons
    Risky
`;
    const r = layoutList(parseList(src), theme);
    // Two column headers at the same y; their cells sit below.
    const pros = r.anchors['item-0']!;
    const cons = r.anchors['item-1']!;
    expect(pros.bounds.y).toBe(cons.bounds.y);
    expect(cons.bounds.x).toBeGreaterThan(pros.bounds.x);
    // Cells are below their header.
    expect(r.anchors['item-0-0']!.bounds.y).toBeGreaterThan(pros.bounds.y);
    // subtree reveal groups a whole column (header + its cells) per step.
    const sub = layoutList(parseList(src.replace('style columns', 'style columns\n  reveal subtree')), theme);
    expect(sub.reveal!.steps.map(s => s.enter)).toEqual([
      ['item-0', 'item-0-0', 'item-0-1'],
      ['item-1', 'item-1-0'],
    ]);
  });
});

// ─── Phase D styles (cycle / matrix / funnel / stepup / venn) ───────────────────

describe('list Phase D styles', () => {
  const theme = resolveTheme({}, defaultTheme);
  const FLAT = 'list\n  Alpha\n  Beta\n  Gamma\n  Delta\n';
  const withStyle = (s: string) => 'list\n  style ' + s + '\n' + FLAT.split('\n').slice(1).join('\n');

  const countType = (r: ReturnType<typeof layoutList>, t: string): number =>
    (JSON.stringify(r.scene.elements).match(new RegExp(`"type":"${t}"`, 'g')) ?? []).length;

  it('cycle places every item on a ring with connecting arcs', () => {
    const r = layoutList(parseList(withStyle('cycle')), theme);
    expect(Object.keys(r.anchors)).toHaveLength(4);
    // A node rect per item + one arc + one arrowhead per item (closed loop).
    expect(countType(r, 'rect')).toBe(4);
    expect(countType(r, 'path')).toBe(8);
    // Ring: nodes are not colinear (distinct x AND y spread).
    const xs = Object.values(r.anchors).map(a => a.bounds.x);
    const ys = Object.values(r.anchors).map(a => a.bounds.y);
    expect(new Set(xs).size).toBeGreaterThan(1);
    expect(new Set(ys).size).toBeGreaterThan(1);
  });

  it('matrix lays four items into a 2×2 grid of tiles', () => {
    const r = layoutList(parseList(withStyle('matrix')), theme);
    expect(countType(r, 'rect')).toBe(4);
    const b = (id: string) => r.anchors[id]!.bounds;
    // Row 0: items 0,1 share a y; item 1 is right of item 0.
    expect(b('item-0').y).toBe(b('item-1').y);
    expect(b('item-1').x).toBeGreaterThan(b('item-0').x);
    // Row 1: items 2,3 sit below row 0, aligned in the same columns.
    expect(b('item-2').y).toBeGreaterThan(b('item-0').y);
    expect(b('item-2').x).toBe(b('item-0').x);
    expect(b('item-3').x).toBe(b('item-1').x);
  });

  it('funnel narrows from a wide top to a narrow base', () => {
    const r = layoutList(parseList(withStyle('funnel')), theme);
    expect(countType(r, 'path')).toBe(4);
    const widths = ['item-0', 'item-1', 'item-2', 'item-3'].map(id => r.anchors[id]!.bounds.width);
    expect(widths[0]!).toBeGreaterThan(widths[3]!);
    expect(widths[1]!).toBeGreaterThan(widths[2]!);
  });

  it('stepup arranges blocks as an ascending staircase (later = higher)', () => {
    const r = layoutList(parseList(withStyle('stepup')), theme);
    const b = (id: string) => r.anchors[id]!.bounds;
    // x increases, y decreases (higher on screen) with each step.
    expect(b('item-1').x).toBeGreaterThan(b('item-0').x);
    expect(b('item-3').y).toBeLessThan(b('item-0').y);
    // Elbow connectors: one per non-first block.
    expect(countType(r, 'path')).toBe(3);
  });

  it('venn clusters translucent circles radially (not colinear for 3+)', () => {
    const r = layoutList(parseList(withStyle('venn')), theme);
    expect(countType(r, 'circle')).toBe(4);
    const svg = JSON.stringify(r.scene.elements);
    expect(svg).toMatch(/"opacity":0\.5/);
    // Circles form a cluster, not a single row.
    const ys = ['item-0', 'item-1', 'item-2', 'item-3'].map(id => r.anchors[id]!.bounds.y);
    expect(new Set(ys).size).toBeGreaterThan(1);
  });

  it('venn places two items side by side (same row)', () => {
    const r = layoutList(parseList('list\n  style venn\n  Left\n  Right\n'), theme);
    const a = r.anchors['item-0']!.bounds;
    const b = r.anchors['item-1']!.bounds;
    expect(a.y).toBe(b.y);
    expect(b.x).toBeGreaterThan(a.x);
  });
});

// ─── Reveal modes ─────────────────────────────────────────────────────────────

describe('list reveal modes', () => {
  const theme = resolveTheme({}, defaultTheme);
  const stepsOf = (src: string) => layoutList(parseList(src), theme).reveal!.steps;

  it('subtree mode reveals each top-level item with all its descendants', () => {
    const steps = stepsOf(`list\n  reveal subtree\n${'Frontend\n  React\n  CDN\nBackend\n  API\n'}`);
    expect(steps.map(s => s.enter)).toEqual([
      ['item-0', 'item-0-0', 'item-0-1'],
      ['item-1', 'item-1-0'],
    ]);
  });

  it('layer mode reveals one step per depth level (BFS)', () => {
    const layered = 'list\n  reveal layer\n' + NESTED.split('\n').slice(1).join('\n');
    const steps = layoutList(parseList(layered), theme).reveal!.steps;
    expect(steps.map(s => s.enter)).toEqual([
      ['item-0', 'item-1', 'item-2'],                   // depth 0: Frontend, Backend, Data
      ['item-0-0', 'item-0-1', 'item-1-0', 'item-1-1'], // depth 1
      ['item-1-0-0'],                                   // depth 2: Auth
    ]);
  });

  it('layer mode is not the default (sequence is)', () => {
    expect(parseList(NESTED).reveal).toBe('sequence');
  });

  it('`reveal none` parses and emits NO reveal track (show-all-at-once)', () => {
    const doc = parseList(`list\n  reveal none\n  One\n  Two\n`);
    expect(doc.reveal).toBe('none');
    const result = layoutList(doc, theme);
    expect(result.reveal).toBeUndefined();
  });

  it('accepts `all`/`off`/`static` as aliases for `none`', () => {
    for (const alias of ['all', 'off', 'static']) {
      const doc = parseList(`list\n  reveal ${alias}\n  One\n`);
      expect(doc.reveal).toBe('none');
      expect(layoutList(doc, theme).reveal).toBeUndefined();
    }
  });

  it('sequence mode chunks items N-per-step with `group N`', () => {
    const steps = stepsOf('list\n  group 2\n  A\n  B\n  C\n  D\n  E\n');
    expect(steps.map(s => s.enter)).toEqual([
      ['item-0', 'item-1'],
      ['item-2', 'item-3'],
      ['item-4'],
    ]);
  });

  it('merges a `+`-prefixed item into the previous step', () => {
    const doc = parseList('list\n  Problem\n  + and its cost\n  Approach\n');
    expect(doc.items.map(i => i.text)).toEqual(['Problem', 'and its cost', 'Approach']);
    expect(doc.items.map(i => i.join)).toEqual([false, true, false]);
    const steps = layoutList(doc, theme).reveal!.steps;
    expect(steps.map(s => s.enter)).toEqual([
      ['item-0', 'item-1'],
      ['item-2'],
    ]);
  });

  it('defaults every step to the fade effect', () => {
    stepsOf(SOURCE).forEach(s => expect(s.effect).toBe('fade'));
  });

  it('applies a global `effect` directive to all steps', () => {
    const steps = stepsOf('list\n  effect slide\n  One\n  Two\n');
    expect(steps.map(s => s.effect)).toEqual(['slide', 'slide']);
  });

  it('honors a per-item `@effect` override on the step it starts', () => {
    const steps = stepsOf('list\n  effect fade\n  One\n  Two @grow\n');
    expect(steps.map(s => s.effect)).toEqual(['fade', 'grow']);
  });

  it('ignores unknown effect tokens (kept as literal text)', () => {
    const doc = parseList('list\n  One @bogus\n');
    expect(doc.items.map(i => i.text)).toEqual(['One @bogus']);
    expect(doc.items.map(i => i.effect)).toEqual([undefined]);
  });
});

// ─── Static render stays reveal-free ────────────────────────────────────────────

describe('list render paths', () => {
  it('renderSync produces static SVG with per-item groups but NO reveal manifest', () => {
    const result = renderSync(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('id="item-0"');
    expect(result.value).not.toContain('triton-reveal');
    expect(result.value).not.toContain('triton-anchors');
  });

  it('compileAndRenderSync returns the reveal track as data (svg still manifest-free)', () => {
    const result = compileAndRenderSync(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reveal).toBeDefined();
    expect(result.value.reveal!.steps).toHaveLength(4);
    expect(result.value.svg).not.toContain('triton-reveal');
  });

  it('embedRevealManifest injects a parseable, deterministic reveal script for hosts', () => {
    const result = compileAndRenderSync(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.reveal) return;
    const withManifest = embedRevealManifest(result.value.svg, result.value.reveal);
    expect(withManifest).toContain('<script type="application/json" id="triton-reveal">');
    const match = withManifest.match(/<script type="application\/json" id="triton-reveal">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed.steps).toHaveLength(4);
    expect(parsed.steps[0].enter).toEqual(['item-0']);
    // Deterministic
    expect(embedRevealManifest(result.value.svg, result.value.reveal)).toBe(withManifest);
  });
});

// ─── Process flow: asFlow + cellForIndex ────────────────────────────────────

describe('asFlow', () => {
  it('returns the canonical ProcessFlow for valid tokens', () => {
    expect(asFlow('ltr')).toBe('ltr');
    expect(asFlow('ttb')).toBe('ttb');
    expect(asFlow('snake')).toBe('snake');
    expect(asFlow('snake-v')).toBe('snake-v');
  });

  it('is case-insensitive', () => {
    expect(asFlow('LTR')).toBe('ltr');
    expect(asFlow('Snake')).toBe('snake');
    expect(asFlow('SNAKE-V')).toBe('snake-v');
  });

  it('returns undefined for unknown tokens', () => {
    expect(asFlow('spiral')).toBeUndefined();
    expect(asFlow('')).toBeUndefined();
    expect(asFlow('horizontal')).toBeUndefined();
  });
});

describe('cellForIndex', () => {
  it('ltr: all cells on row 0, col = index', () => {
    expect(cellForIndex(0, 'ltr', 3)).toEqual({ row: 0, col: 0 });
    expect(cellForIndex(1, 'ltr', 3)).toEqual({ row: 0, col: 1 });
    expect(cellForIndex(5, 'ltr', 3)).toEqual({ row: 0, col: 5 });
  });

  it('ttb: all cells on col 0, row = index', () => {
    expect(cellForIndex(0, 'ttb', 3)).toEqual({ row: 0, col: 0 });
    expect(cellForIndex(1, 'ttb', 3)).toEqual({ row: 1, col: 0 });
    expect(cellForIndex(5, 'ttb', 3)).toEqual({ row: 5, col: 0 });
  });

  it('snake wrap=3: row-major boustrophedon with correct R→L reversal on odd rows', () => {
    // Row 0 (even, L→R): i=0→col0, i=1→col1, i=2→col2
    expect(cellForIndex(0, 'snake', 3)).toEqual({ row: 0, col: 0 });
    expect(cellForIndex(1, 'snake', 3)).toEqual({ row: 0, col: 1 });
    expect(cellForIndex(2, 'snake', 3)).toEqual({ row: 0, col: 2 });
    // Row 1 (odd, R→L): i=3→col2, i=4→col1, i=5→col0
    expect(cellForIndex(3, 'snake', 3)).toEqual({ row: 1, col: 2 });
    expect(cellForIndex(4, 'snake', 3)).toEqual({ row: 1, col: 1 });
    expect(cellForIndex(5, 'snake', 3)).toEqual({ row: 1, col: 0 });
    // Row 2 (even, L→R): i=6→col0
    expect(cellForIndex(6, 'snake', 3)).toEqual({ row: 2, col: 0 });
  });

  it('snake wrap=2: works with wrap=2', () => {
    expect(cellForIndex(0, 'snake', 2)).toEqual({ row: 0, col: 0 });
    expect(cellForIndex(1, 'snake', 2)).toEqual({ row: 0, col: 1 });
    expect(cellForIndex(2, 'snake', 2)).toEqual({ row: 1, col: 1 });
    expect(cellForIndex(3, 'snake', 2)).toEqual({ row: 1, col: 0 });
    expect(cellForIndex(4, 'snake', 2)).toEqual({ row: 2, col: 0 });
  });

  it('snake-v wrap=3: column-major boustrophedon with correct B→T reversal on odd cols', () => {
    // Col 0 (even, T→B): i=0→row0, i=1→row1, i=2→row2
    expect(cellForIndex(0, 'snake-v', 3)).toEqual({ row: 0, col: 0 });
    expect(cellForIndex(1, 'snake-v', 3)).toEqual({ row: 1, col: 0 });
    expect(cellForIndex(2, 'snake-v', 3)).toEqual({ row: 2, col: 0 });
    // Col 1 (odd, B→T): i=3→row2, i=4→row1, i=5→row0
    expect(cellForIndex(3, 'snake-v', 3)).toEqual({ row: 2, col: 1 });
    expect(cellForIndex(4, 'snake-v', 3)).toEqual({ row: 1, col: 1 });
    expect(cellForIndex(5, 'snake-v', 3)).toEqual({ row: 0, col: 1 });
    // Col 2 (even, T→B): i=6→row0
    expect(cellForIndex(6, 'snake-v', 3)).toEqual({ row: 0, col: 2 });
  });
});

// ─── Process flow parsing ─────────────────────────────────────────────────────

describe('parseList process flow directives', () => {
  it('defaults flow to undefined (ltr) when not specified', () => {
    const doc = parseList('list\n  style process\n  One\n');
    expect(doc.flow).toBeUndefined();
  });

  it('parses `flow ttb`', () => {
    expect(parseList('list\n  style process\n  flow ttb\n  One\n').flow).toBe('ttb');
  });

  it('parses `flow snake`', () => {
    expect(parseList('list\n  style process\n  flow snake\n  One\n').flow).toBe('snake');
  });

  it('parses `flow snake-v`', () => {
    expect(parseList('list\n  style process\n  flow snake-v\n  One\n').flow).toBe('snake-v');
  });

  it('ignores an unknown flow token and keeps the default', () => {
    expect(parseList('list\n  flow spiral\n  One\n').flow).toBeUndefined();
  });

  it('parses `wrap N` and stores it', () => {
    expect(parseList('list\n  wrap 4\n  One\n').wrap).toBe(4);
  });

  it('ignores `wrap 0` or `wrap -1`', () => {
    expect(parseList('list\n  wrap 0\n  One\n').wrap).toBeUndefined();
    expect(parseList('list\n  wrap -1\n  One\n').wrap).toBeUndefined();
  });

  it('omits wrap from the returned doc when not specified', () => {
    expect(parseList('list\n  style process\n  One\n').wrap).toBeUndefined();
  });
});

// ─── Process flow layout ──────────────────────────────────────────────────────

describe('list process flow layout', () => {
  const theme = resolveTheme({}, defaultTheme);
  const FIVE = 'list\n  style process\n  A\n  B\n  C\n  D\n  E\n';

  const countType = (r: ReturnType<typeof layoutList>, t: string): number =>
    (JSON.stringify(r.scene.elements).match(new RegExp(`"type":"${t}"`, 'g')) ?? []).length;

  it('ltr (default) is structurally identical to pre-flow process behavior', () => {
    const r = layoutList(parseList('list\n  style process\n  Alpha\n  Beta\n  Gamma\n'), theme);
    expect(countType(r, 'rect')).toBe(3);
    // Each non-first box: 1 line + 1 arrowhead = 2 paths × 2 = 4 paths.
    expect(countType(r, 'path')).toBe(4);
    expect(Object.keys(r.anchors).sort()).toEqual(['item-0', 'item-1', 'item-2']);
    // Single row: all same y.
    const ys = Object.values(r.anchors).map(a => a.bounds.y);
    expect(new Set(ys).size).toBe(1);
    // L→R order.
    const xs = ['item-0', 'item-1', 'item-2'].map(id => r.anchors[id]!.bounds.x);
    expect(xs[1]!).toBeGreaterThan(xs[0]!);
    expect(xs[2]!).toBeGreaterThan(xs[1]!);
  });

  it('ttb stacks boxes in a single column with downward arrows', () => {
    const r = layoutList(parseList('list\n  style process\n  flow ttb\n  One\n  Two\n  Three\n'), theme);
    expect(countType(r, 'rect')).toBe(3);
    // 2 connectors (line + arrowhead each) = 4 paths.
    expect(countType(r, 'path')).toBe(4);
    // All same x (single column).
    const xs = Object.values(r.anchors).map(a => a.bounds.x);
    expect(new Set(xs).size).toBe(1);
    // Items advance downward.
    const ys = ['item-0', 'item-1', 'item-2'].map(id => r.anchors[id]!.bounds.y);
    expect(ys[1]!).toBeGreaterThan(ys[0]!);
    expect(ys[2]!).toBeGreaterThan(ys[1]!);
    // Uniform width: all boxes same width and height.
    const widths = Object.values(r.anchors).map(a => a.bounds.width);
    expect(new Set(widths).size).toBe(1);
  });

  it('snake with wrap=3 places items in a boustrophedon grid', () => {
    const r = layoutList(parseList('list\n  style process\n  flow snake\n  wrap 3\n  A\n  B\n  C\n  D\n  E\n'), theme);
    expect(Object.keys(r.anchors).sort()).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4']);
    // Row 0 (L→R): items 0,1,2 share same y; x increases.
    const b = (id: string) => r.anchors[id]!.bounds;
    expect(b('item-0').y).toBe(b('item-1').y);
    expect(b('item-1').y).toBe(b('item-2').y);
    expect(b('item-1').x).toBeGreaterThan(b('item-0').x);
    expect(b('item-2').x).toBeGreaterThan(b('item-1').x);
    // Row 1 (R→L): items 3,4 share same y (below row 0); item 3 is rightmost.
    expect(b('item-3').y).toBeGreaterThan(b('item-0').y);
    expect(b('item-3').y).toBe(b('item-4').y);
    expect(b('item-3').x).toBeGreaterThan(b('item-4').x);
    // item-2 and item-3 are in the same column (rightmost, col 2).
    expect(b('item-2').x).toBe(b('item-3').x);
    // All boxes same width (uniform grid).
    const widths = Object.values(r.anchors).map(a => a.bounds.width);
    expect(new Set(widths).size).toBe(1);
    // No NaN in output.
    expect(JSON.stringify(r.scene)).not.toMatch(/NaN/);
  });

  it('snake-v with wrap=3 places items in column-major boustrophedon', () => {
    const r = layoutList(parseList('list\n  style process\n  flow snake-v\n  wrap 3\n  A\n  B\n  C\n  D\n  E\n'), theme);
    const b = (id: string) => r.anchors[id]!.bounds;
    // Col 0 (T→B): items 0,1,2 share same x; y increases.
    expect(b('item-0').x).toBe(b('item-1').x);
    expect(b('item-1').x).toBe(b('item-2').x);
    expect(b('item-1').y).toBeGreaterThan(b('item-0').y);
    expect(b('item-2').y).toBeGreaterThan(b('item-1').y);
    // Col 1 (B→T): items 3,4 share same x (right of col 0); item 3 is lowest.
    expect(b('item-3').x).toBeGreaterThan(b('item-0').x);
    expect(b('item-3').x).toBe(b('item-4').x);
    expect(b('item-3').y).toBeGreaterThan(b('item-4').y);
    // item-2 and item-3 are in the same row (row 2, the bottom).
    expect(b('item-2').y).toBe(b('item-3').y);
    expect(JSON.stringify(r.scene)).not.toMatch(/NaN/);
  });

  it('snake uses ceil(sqrt(n)) as default wrap when not specified', () => {
    // 5 items → wrap = ceil(sqrt(5)) = 3
    const r = layoutList(parseList('list\n  style process\n  flow snake\n  A\n  B\n  C\n  D\n  E\n'), theme);
    const b = (id: string) => r.anchors[id]!.bounds;
    // With wrap=3: items 0,1,2 on row 0; items 3,4 on row 1 (reversed).
    expect(b('item-0').y).toBe(b('item-1').y);
    expect(b('item-2').y).toBe(b('item-0').y);
    expect(b('item-3').y).toBeGreaterThan(b('item-0').y);
  });

  it('process with non-ltr flow emits no NaN and has correct anchor count', () => {
    for (const flow of ['ttb', 'snake', 'snake-v'] as const) {
      const src = `list\n  style process\n  flow ${flow}\n  wrap 2\n  One\n  Two\n  Three\n`;
      const r = layoutList(parseList(src), theme);
      expect(Object.keys(r.anchors)).toHaveLength(3);
      expect(JSON.stringify(r.scene)).not.toMatch(/NaN|undefined/);
    }
  });

  it('renderSync emits no reveal manifest for process snake (static path)', () => {
    const result = renderSync('list\n  style process\n  flow snake\n  wrap 2\n  A\n  B\n  C\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('triton-reveal');
  });
});

// ─── Turn style ───────────────────────────────────────────────────────────────

describe('asTurn', () => {
  it('returns canonical TurnStyle for valid tokens', () => {
    expect(asTurn('corridor')).toBe('corridor');
    expect(asTurn('direct')).toBe('direct');
  });

  it('is case-insensitive', () => {
    expect(asTurn('Direct')).toBe('direct');
    expect(asTurn('CORRIDOR')).toBe('corridor');
  });

  it('returns undefined for unknown tokens', () => {
    expect(asTurn('elbow')).toBeUndefined();
    expect(asTurn('')).toBeUndefined();
  });
});

describe('parseList turn directive', () => {
  it('defaults turn to undefined (corridor) when not specified', () => {
    expect(parseList('list\n  style process\n  flow snake\n  One\n').turn).toBeUndefined();
  });

  it('parses `turn direct`', () => {
    expect(parseList('list\n  flow snake\n  turn direct\n  One\n').turn).toBe('direct');
  });

  it('ignores unknown turn token and keeps the default', () => {
    expect(parseList('list\n  turn zigzag\n  One\n').turn).toBeUndefined();
  });

  it('omits turn from returned doc when corridor (default)', () => {
    const doc = parseList('list\n  turn corridor\n  One\n');
    expect(doc.turn).toBeUndefined();
  });
});

describe('list process turn=direct layout', () => {
  const theme = resolveTheme({}, defaultTheme);

  // Extract all path `d` attribute strings from the scene.
  const pathDs = (r: ReturnType<typeof layoutList>): string[] => {
    const paths: string[] = [];
    const walk = (els: unknown[]): void => {
      for (const el of els) {
        const e = el as Record<string, unknown>;
        if (e['type'] === 'path') paths.push(e['d'] as string);
        if (e['type'] === 'group') walk((e['children'] as unknown[]) ?? []);
      }
    };
    walk(r.scene.elements);
    return paths;
  };

  it('snake turn=direct: turn connector is a straight vertical (constant x)', () => {
    // 4 items, wrap=2 → two rows; item-1 (row 0, col 1) turns to item-2 (row 1, col 1).
    const r = layoutList(
      parseList('list\n  style process\n  flow snake\n  wrap 2\n  turn direct\n  A\n  B\n  C\n  D\n'),
      theme,
    );
    // Get all path ds from item-2's group (the turn target).
    const item2Group = r.scene.elements.find(
      (el) => (el as Record<string, unknown>)['id'] === 'item-2',
    ) as Record<string, unknown> | undefined;
    expect(item2Group).toBeDefined();
    const children = item2Group!['children'] as Array<Record<string, unknown>>;
    const connectorPaths = children.filter(c => c['type'] === 'path').slice(0, 2); // line + arrowhead
    // Both should be defined.
    expect(connectorPaths).toHaveLength(2);
    // The line path (first path) should have a constant x — i.e., it is vertical.
    const linePath = connectorPaths[0]!['d'] as string;
    // Extract all x values from the SVG path command pairs "M x y L x y".
    const nums = linePath.match(/[\d.]+/g)?.map(Number) ?? [];
    // M x0 y0 L x1 y1 → nums = [x0, y0, x1, y1]; x0 === x1 for vertical.
    expect(nums).toHaveLength(4);
    expect(nums[0]).toBe(nums[2]); // same x
    expect(nums[1]).toBeLessThan(nums[3]!); // y increases (going down)
  });

  it('snake turn=direct: arrowhead points down (y tip is lowest point)', () => {
    const r = layoutList(
      parseList('list\n  style process\n  flow snake\n  wrap 2\n  turn direct\n  A\n  B\n  C\n  D\n'),
      theme,
    );
    const item2Group = r.scene.elements.find(
      (el) => (el as Record<string, unknown>)['id'] === 'item-2',
    ) as Record<string, unknown> | undefined;
    const children = item2Group!['children'] as Array<Record<string, unknown>>;
    const arrowPath = children.filter(c => c['type'] === 'path')[1]!['d'] as string;
    // A downward arrowhead: M (tx-ah) (ty-ah) L tx ty L (tx+ah) (ty-ah) Z
    // The middle point (tip) should have the largest y value.
    const coords = [...arrowPath.matchAll(/([0-9.]+)\s+([0-9.]+)/g)].map(m => ({
      x: parseFloat(m[1]!), y: parseFloat(m[2]!),
    }));
    const maxY = Math.max(...coords.map(c => c.y));
    // The tip is the point with max y (lowest on screen).
    const tipPoint = coords.find(c => c.y === maxY)!;
    // The other two base points should have smaller y.
    const others = coords.filter(c => c !== tipPoint);
    expect(others.every(o => o.y < maxY)).toBe(true);
  });

  it('snake turn=corridor: turn connector has varying x (jogs sideways)', () => {
    // Default turn=corridor should differ from direct.
    const r = layoutList(
      parseList('list\n  style process\n  flow snake\n  wrap 2\n  A\n  B\n  C\n  D\n'),
      theme,
    );
    const item2Group = r.scene.elements.find(
      (el) => (el as Record<string, unknown>)['id'] === 'item-2',
    ) as Record<string, unknown> | undefined;
    const children = item2Group!['children'] as Array<Record<string, unknown>>;
    const linePath = children.filter(c => c['type'] === 'path')[0]!['d'] as string;
    // The corridor path is "M x0 y0 L x1 y0 L x1 y1 L x2 y1" — x values differ.
    const nums = linePath.match(/[\d.]+/g)?.map(Number) ?? [];
    // More than 4 numbers = multi-segment path (corridor).
    expect(nums.length).toBeGreaterThan(4);
  });

  it('snake-v turn=direct: turn connector is horizontal (constant y)', () => {
    // 4 items, wrap=2, snake-v → two cols; item-2 (row 1→0 turn) is the turn target.
    // col 0 (T→B): items 0,1; col 1 (B→T): items 2,3 (item-2 at row 1, item-3 at row 0)
    // The turn is from item-1 (row 1, col 0) to item-2 (row 1, col 1).
    const r = layoutList(
      parseList('list\n  style process\n  flow snake-v\n  wrap 2\n  turn direct\n  A\n  B\n  C\n  D\n'),
      theme,
    );
    const item2Group = r.scene.elements.find(
      (el) => (el as Record<string, unknown>)['id'] === 'item-2',
    ) as Record<string, unknown> | undefined;
    expect(item2Group).toBeDefined();
    const children = item2Group!['children'] as Array<Record<string, unknown>>;
    const linePath = children.filter(c => c['type'] === 'path')[0]!['d'] as string;
    const nums = linePath.match(/[\d.]+/g)?.map(Number) ?? [];
    // M x0 y0 L x1 y1 → y0 === y1 for horizontal.
    expect(nums).toHaveLength(4);
    expect(nums[1]).toBe(nums[3]); // same y
    expect(nums[0]).toBeLessThan(nums[2]!); // x increases (going right)
  });

  it('no NaN in direct turn output', () => {
    for (const flow of ['snake', 'snake-v'] as const) {
      const src = `list\n  style process\n  flow ${flow}\n  wrap 3\n  turn direct\n  A\n  B\n  C\n  D\n  E\n  F\n  G\n`;
      const r = layoutList(parseList(src), theme);
      expect(JSON.stringify(r.scene)).not.toMatch(/NaN/);
    }
  });
});
