import { describe, it, expect } from 'vitest';
import { buildAvl } from '../src/diagrams/triton/ds/tree/avl.js';
import { buildRbtree } from '../src/diagrams/triton/ds/tree/rbtree.js';
import { buildBtree } from '../src/diagrams/triton/ds/tree/btree.js';
import { buildRadix } from '../src/diagrams/triton/ds/tree/radix.js';
import { buildSegtree } from '../src/diagrams/triton/ds/tree/segtree.js';
import { buildHeap } from '../src/diagrams/triton/ds/tree/heap.js';
import { layoutTree } from '../src/diagrams/triton/ds/tree/layout.js';
import { defaultTheme, executiveTheme } from '../src/theme/preset.js';
import { resolveTheme } from '../src/theme/resolver.js';
import type { TreeDocument } from '../src/diagrams/triton/ds/tree/ir.js';
import type { Color, ResolvedTheme, SceneCircle, SceneRect } from '../src/contracts/index.js';

const byId = (doc: TreeDocument) => new Map(doc.nodes.map(n => [n.id, n]));

/** Binary BST in-order (children = [left, right]). */
function bstInorder(doc: TreeDocument): number[] {
  const m = byId(doc); const out: number[] = [];
  const walk = (id: string): void => {
    const n = m.get(id)!; const [l, r] = n.children;
    if (l) walk(l); out.push(Number(n.label)); if (r) walk(r);
  };
  if (doc.nodes.length) walk(doc.nodes[0]!.id);
  return out;
}

function parseHex(c: Color): [number, number, number] | null {
  const s = c.trim();
  const m3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m3) return [parseInt(m3[1]! + m3[1]!, 16), parseInt(m3[2]! + m3[2]!, 16), parseInt(m3[3]! + m3[3]!, 16)];
  const m6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m6) return [parseInt(m6[1]!, 16), parseInt(m6[2]!, 16), parseInt(m6[3]!, 16)];
  return null;
}

function relativeLuminance(c: Color): number {
  const rgb = parseHex(c);
  if (!rgb) return 0;
  const linear = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

function contrastRatio(a: Color, b: Color): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function outlineStroke(fill: Color, theme: ResolvedTheme): Color {
  const canvas = parseHex(theme.palette.background) ? theme.palette.background : theme.palette.surface;
  const candidates = [theme.palette.text, theme.palette.border, theme.palette.textMuted, theme.palette.background];
  let best = theme.palette.text, score = -Infinity;
  for (const c of candidates) {
    if (!parseHex(c)) continue;
    const next = Math.min(contrastRatio(c, fill), contrastRatio(c, canvas)) + contrastRatio(c, canvas) * 0.15;
    if (next > score) { best = c; score = next; }
  }
  return best;
}

function nodeCircles(doc: TreeDocument, theme = defaultTheme): SceneCircle[] {
  return layoutTree(doc, theme).scene.elements.filter((el): el is SceneCircle => el.type === 'circle');
}

function nodeRects(doc: TreeDocument, theme = defaultTheme): SceneRect[] {
  return layoutTree(doc, theme).scene.elements.filter((el): el is SceneRect => el.type === 'rect');
}

describe('rbtree builder', () => {
  it('has a black root and a valid two-colouring', () => {
    const doc = buildRbtree('rbtree insert 13 8 17 1 11 15 25 6');
    expect(doc.nodes[0]!.kinds).toContain('black');
    for (const n of doc.nodes) {
      const red = n.kinds.includes('red'), black = n.kinds.includes('black');
      expect(red !== black).toBe(true); // exactly one colour
    }
  });
  it('keeps BST ordering', () => {
    const seq = bstInorder(buildRbtree('rbtree insert 13 8 17 1 11 15 25 6'));
    expect(seq).toEqual([...seq].sort((a, b) => a - b));
  });

  it('renders red and black colours from the resolved theme instead of legacy literals', () => {
    const doc = buildRbtree('rbtree insert 13 8 17 1 11 15 25 6');
    const light = nodeCircles(doc, defaultTheme);
    const darkTheme = resolveTheme({ palette: { background: '#0f1117' } }, executiveTheme);
    const dark = nodeCircles(doc, darkTheme);
    const redIndex = doc.nodes.findIndex(n => n.kinds.includes('red'));

    expect(light[0]!.fill).not.toBe('#2b2b2b');
    expect(light[0]!.stroke).not.toBe('#2b2b2b');
    expect(light[redIndex]!.fill).not.toBe('#d64545');
    expect(light[redIndex]!.stroke).not.toBe('#d64545');
    expect(dark[0]!.fill).not.toBe(light[0]!.fill);
    expect(dark[0]!.stroke).not.toBe(light[0]!.stroke);
    expect(dark[redIndex]!.fill).not.toBe(light[redIndex]!.fill);
  });

  it('gives black nodes a contrasting stroke on dark themes', () => {
    const darkTheme = resolveTheme({ palette: { background: '#0f1117' } }, executiveTheme);
    const doc = buildRbtree('rbtree insert 13 8 17 1 11 15 25 6');
    const blackRoot = nodeCircles(doc, darkTheme)[0]!;

    expect(contrastRatio(blackRoot.stroke, darkTheme.palette.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(blackRoot.fill, darkTheme.palette.background)).toBeGreaterThanOrEqual(1.7);
  });

  it('keeps dark-palette black nodes visible when the SVG background is transparent', () => {
    const transparentExecutive = resolveTheme({ palette: { background: '' } }, executiveTheme);
    const doc = buildRbtree('rbtree insert 13 8 17 1 11 15 25 6');
    const blackRoot = nodeCircles(doc, transparentExecutive)[0]!;

    expect(blackRoot.fill).not.toBe(nodeCircles(doc, defaultTheme)[0]!.fill);
    expect(contrastRatio(blackRoot.stroke, transparentExecutive.palette.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses the neutral outline treatment for AVL, plain circle, and RB structural borders', () => {
    const themes = [
      defaultTheme,
      resolveTheme({ palette: { background: '#0f1117' } }, executiveTheme),
    ];
    const plainCircle: TreeDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TB',
      nodes: [{ id: 'n0', label: '42', kinds: ['circle'], children: [] }],
    };
    const avl = buildAvl('avl insert 20 10 30');
    const rb = buildRbtree('rbtree insert 13 8 17 1 11 15 25 6');

    for (const theme of themes) {
      const expectedSurfaceOutline = outlineStroke(theme.palette.surface, theme);
      const plain = nodeCircles(plainCircle, theme)[0]!;
      const avlRoot = nodeCircles(avl, theme)[0]!;
      const rbCircles = nodeCircles(rb, theme);
      const redIndex = rb.nodes.findIndex(n => n.kinds.includes('red'));

      expect(plain.stroke).toBe(expectedSurfaceOutline);
      expect(avlRoot.stroke).toBe(expectedSurfaceOutline);
      expect(plain.stroke).not.toBe(theme.palette.primary);
      expect(avlRoot.stroke).not.toBe(theme.palette.primary);
      expect(rbCircles[0]!.stroke).toBe(outlineStroke(rbCircles[0]!.fill, theme));
      expect(rbCircles[redIndex]!.stroke).toBe(outlineStroke(rbCircles[redIndex]!.fill, theme));
    }
  });

  it('keeps state node strokes semantic after structural border unification', () => {
    const doc: TreeDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TB',
      nodes: [
        { id: 'n0', label: 'Active', kinds: ['active'], children: ['n1', 'n2', 'n3'] },
        { id: 'n1', label: 'Seq Scan', kinds: ['scan'], children: [] },
        { id: 'n2', label: 'Hash Join', kinds: ['join'], children: [] },
        { id: 'n3', label: 'Hash', kinds: ['build'], children: [] },
      ],
    };
    const [active, scan, join, build] = nodeRects(doc, defaultTheme);

    expect(active!.stroke).toBe(defaultTheme.palette.primary);
    expect(scan!.stroke).toBe(defaultTheme.palette.primary);
    expect(join!.stroke).toBe(defaultTheme.palette.secondary);
    expect(build!.stroke).toBe(defaultTheme.palette.textMuted);
  });
});

describe('btree builder', () => {
  const doc = buildBtree('btree order 3 insert 10 20 5 6 12 30 7 17');
  const keysOf = (label: string) => label.split('|').map(s => Number(s.trim()));

  it('holds every key, sorted, via B-tree in-order traversal', () => {
    const m = byId(doc); const out: number[] = [];
    const walk = (id: string): void => {
      const n = m.get(id)!; const keys = keysOf(n.label); const ch = n.children;
      for (let i = 0; i < keys.length; i++) { if (ch[i]) walk(ch[i]!); out.push(keys[i]!); }
      if (ch[keys.length]) walk(ch[keys.length]!);
    };
    walk(doc.nodes[0]!.id);
    expect(out).toEqual([5, 6, 7, 10, 12, 17, 20, 30]);
  });

  it('never exceeds order-1 keys per node', () => {
    for (const n of doc.nodes) expect(keysOf(n.label).length).toBeLessThanOrEqual(2);
  });
});

describe('radix builder', () => {
  const doc = buildRadix('radix insert cat car card dog do');
  it('marks every inserted word as a terminal node', () => {
    const words = doc.nodes.filter(n => n.kinds.includes('active')).map(n => n.label).sort();
    expect(words).toEqual(['car', 'card', 'cat', 'do', 'dog']);
  });
  it('compresses shared prefixes onto a single edge', () => {
    expect(doc.nodes.some(n => n.edgeLabel === 'ca')).toBe(true);
  });
});

describe('segtree builder', () => {
  it('reduces with sum by default and supports min', () => {
    expect(buildSegtree('segtree over [5,8,13,21] reduce sum').nodes[0]!.label).toBe('47');
    expect(buildSegtree('segtree over [5,8,13,21] reduce min').nodes[0]!.label).toBe('5');
    expect(buildSegtree('segtree over [5,8,13,21] reduce max').nodes[0]!.label).toBe('21');
  });
  it('annotates nodes with their [lo,hi] range', () => {
    expect(buildSegtree('segtree over [5,8] reduce sum').nodes[0]!.info).toBe('[0,1]');
  });
});

describe('heap builder', () => {
  const heapValid = (doc: TreeDocument, cmp: (parent: number, child: number) => boolean) => {
    const m = byId(doc);
    for (const n of doc.nodes) {
      for (const c of n.children) expect(cmp(Number(n.label), Number(m.get(c)!.label))).toBe(true);
    }
  };
  it('satisfies the max-heap property', () => {
    heapValid(buildHeap('heap max insert 50 30 70 20 40 60 80 10'), (p, c) => p >= c);
  });
  it('satisfies the min-heap property', () => {
    heapValid(buildHeap('heap min insert 50 30 70 20 40 60 80 10'), (p, c) => p <= c);
  });
});
