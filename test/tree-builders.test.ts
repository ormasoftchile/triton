import { describe, it, expect } from 'vitest';
import { buildRbtree } from '../src/diagrams/tree/rbtree.js';
import { buildBtree } from '../src/diagrams/tree/btree.js';
import { buildRadix } from '../src/diagrams/tree/radix.js';
import { buildSegtree } from '../src/diagrams/tree/segtree.js';
import { buildHeap } from '../src/diagrams/tree/heap.js';
import type { TreeDocument } from '../src/diagrams/tree/ir.js';

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
