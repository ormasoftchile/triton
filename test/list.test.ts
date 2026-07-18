import { describe, it, expect } from 'vitest';
import { parseList, layoutList } from '../src/diagrams/triton/deck/list/list.js';
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
