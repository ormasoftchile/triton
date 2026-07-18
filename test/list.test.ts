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
    for (const style of ['bullets', 'numbered', 'block', 'box', 'tree'] as const) {
      const doc = parseList(`list\n  style ${style}\n  One\n  Two\n`);
      const result = layoutList(doc, theme);
      expect(Object.keys(result.anchors).sort()).toEqual(['item-0', 'item-1']);
      expect(result.scene.elements.length).toBeGreaterThan(0);
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
