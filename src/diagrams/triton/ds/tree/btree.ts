/**
 * @file diagrams/tree/btree.ts — B-tree front-end over the tree engine.
 *
 * Value-driven: `btree order 3 insert 10 20 …` performs real B-tree insertion
 * with node splitting and emits multi-key strip nodes. Structure is valid by
 * construction (every non-root node holds between ⌈order/2⌉−1 and order−1 keys).
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../../../contracts/index.js';
import type { TreeDocument, TreeNode } from './ir.js';
import { layoutTree } from './layout.js';

interface BNode { keys: number[]; children: BNode[]; leaf: boolean; }

interface Split { up: number; right: BNode; }

/** Insert into a subtree; return a Split if this node overflowed and divided. */
function insertRec(node: BNode, key: number, order: number): Split | null {
  if (node.leaf) {
    let i = node.keys.length - 1;
    while (i >= 0 && key < node.keys[i]!) i--;
    if (i >= 0 && node.keys[i] === key) return null; // dup
    node.keys.splice(i + 1, 0, key);
  } else {
    let i = node.keys.length - 1;
    while (i >= 0 && key < node.keys[i]!) i--;
    if (i >= 0 && node.keys[i] === key) return null; // dup
    i++;
    const split = insertRec(node.children[i]!, key, order);
    if (split) {
      node.keys.splice(i, 0, split.up);
      node.children.splice(i + 1, 0, split.right);
    }
  }
  if (node.keys.length <= order - 1) return null;

  // overflow: divide around the median
  const mid = node.keys.length >> 1;
  const up = node.keys[mid]!;
  const right: BNode = {
    keys: node.keys.slice(mid + 1),
    children: node.leaf ? [] : node.children.slice(mid + 1),
    leaf: node.leaf,
  };
  node.keys = node.keys.slice(0, mid);
  node.children = node.leaf ? [] : node.children.slice(0, mid + 1);
  return { up, right };
}

export function buildBtree(input: string): TreeDocument {
  const orderMatch = input.match(/order\s+(\d+)/i);
  const order = Math.max(3, orderMatch ? Number(orderMatch[1]) : 3);
  const afterOrder = input.replace(/order\s+\d+/i, '');
  const keys = (afterOrder.match(/-?\d+/g) ?? []).map(Number);

  let root: BNode = { keys: [], children: [], leaf: true };
  for (const k of keys) {
    const split = insertRec(root, k, order);
    if (split) root = { keys: [split.up], children: [root, split.right], leaf: false };
  }

  const nodes: TreeNode[] = [];
  let i = 0;
  const emit = (n: BNode): string => {
    const id = `n${i++}`;
    const children: string[] = [];
    nodes.push({ id, label: n.keys.join(' | '), kinds: ['strip'], children });
    for (const c of n.children) children.push(emit(c));
    return id;
  };
  if (root.keys.length > 0 || root.children.length > 0) emit(root);

  return { version: '1.0', metadata: {}, direction: 'TB', nodes };
}

export const btree: DiagramModule<TreeDocument> = {
  parseMermaid: buildBtree,
  parseYaml: (input) => JSON.parse(input) as TreeDocument,
  layout: (ir: TreeDocument, theme: ResolvedTheme): LayoutResult => layoutTree(ir, theme),
};
