/**
 * @file diagrams/tree/heap.ts — Binary-heap front-end over the tree engine.
 *
 * Value-driven: `heap max insert 50 30 70 …` builds a binary heap (max by
 * default, `min` supported) with real sift-up, then renders the implicit tree
 * (children of i are 2i+1, 2i+2) as circle nodes.
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../contracts/index.js';
import type { TreeDocument, TreeNode } from './ir.js';
import { layoutTree } from './layout.js';

export function buildHeap(input: string): TreeDocument {
  const isMin = /\bmin\b/i.test(input);
  const keys = (input.match(/-?\d+/g) ?? []).map(Number);
  const higher = (a: number, b: number): boolean => (isMin ? a < b : a > b);

  const heap: number[] = [];
  for (const k of keys) {
    heap.push(k);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (higher(heap[i]!, heap[parent]!)) {
        [heap[i], heap[parent]] = [heap[parent]!, heap[i]!];
        i = parent;
      } else break;
    }
  }

  const nodes: TreeNode[] = [];
  const emit = (idx: number): string => {
    const id = `n${idx}`;
    const children: string[] = [];
    nodes.push({ id, label: String(heap[idx]), kinds: ['circle'], children });
    const l = 2 * idx + 1, r = 2 * idx + 2;
    if (l < heap.length) children.push(emit(l));
    if (r < heap.length) children.push(emit(r));
    return id;
  };
  if (heap.length > 0) emit(0);

  return { version: '1.0', metadata: {}, direction: 'TB', nodes };
}

export const heap: DiagramModule<TreeDocument> = {
  parseMermaid: buildHeap,
  parseYaml: (input) => JSON.parse(input) as TreeDocument,
  layout: async (ir: TreeDocument, theme: ResolvedTheme): Promise<LayoutResult> => layoutTree(ir, theme),
};
