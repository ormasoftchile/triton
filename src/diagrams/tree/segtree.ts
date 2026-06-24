/**
 * @file diagrams/tree/segtree.ts — Segment-tree front-end over the tree engine.
 *
 * Value-driven: `segtree over [1,2,3,4] reduce sum` builds a segment tree whose
 * nodes each carry a [lo,hi] range (info sub-line) and the reduced value.
 * Supported reducers: sum (default), min, max.
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../contracts/index.js';
import type { TreeDocument, TreeNode } from './ir.js';
import { layoutTree } from './layout.js';

type Reducer = (a: number, b: number) => number;

function pickReducer(input: string): Reducer {
  const l = input.toLowerCase();
  if (l.includes('min')) return Math.min;
  if (l.includes('max')) return Math.max;
  return (a, b) => a + b;
}

export function buildSegtree(input: string): TreeDocument {
  // numbers inside the array literal; ignore an `order`/`reduce` word's digits — there are none
  const arr = (input.match(/-?\d+/g) ?? []).map(Number);
  const reduce = pickReducer(input);

  const nodes: TreeNode[] = [];
  let i = 0;
  const build = (lo: number, hi: number): { id: string; value: number } => {
    const id = `n${i++}`;
    const children: string[] = [];
    const node: TreeNode = { id, label: '', kinds: ['box'], info: `[${lo},${hi}]`, children };
    nodes.push(node);
    let value: number;
    if (lo === hi) {
      value = arr[lo]!;
    } else {
      const mid = (lo + hi) >> 1;
      const left = build(lo, mid);
      const right = build(mid + 1, hi);
      children.push(left.id, right.id);
      value = reduce(left.value, right.value);
    }
    (node as { label: string }).label = String(value);
    return { id, value };
  };
  if (arr.length > 0) build(0, arr.length - 1);

  return { version: '1.0', metadata: {}, direction: 'TB', nodes };
}

export const segtree: DiagramModule<TreeDocument> = {
  parseMermaid: buildSegtree,
  parseYaml: (input) => JSON.parse(input) as TreeDocument,
  layout: (ir: TreeDocument, theme: ResolvedTheme): LayoutResult => layoutTree(ir, theme),
};
