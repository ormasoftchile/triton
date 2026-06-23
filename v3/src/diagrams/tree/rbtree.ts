/**
 * @file diagrams/tree/rbtree.ts — Red-black tree front-end over the tree engine.
 *
 * Value-driven via a left-leaning red-black tree (Sedgewick): real insertion
 * with rotations + colour flips yields a valid red-black colouring by
 * construction. Each key becomes a circle node tagged red or black.
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../contracts/index.js';
import type { TreeDocument, TreeNode } from './ir.js';
import { layoutTree } from './layout.js';

const RED = true, BLACK = false;
interface RbNode { key: number; left: RbNode | null; right: RbNode | null; color: boolean; }

const isRed = (n: RbNode | null): boolean => n !== null && n.color === RED;

function rotateLeft(h: RbNode): RbNode {
  const x = h.right!;
  h.right = x.left;
  x.left = h;
  x.color = h.color;
  h.color = RED;
  return x;
}
function rotateRight(h: RbNode): RbNode {
  const x = h.left!;
  h.left = x.right;
  x.right = h;
  x.color = h.color;
  h.color = RED;
  return x;
}
function flip(h: RbNode): void {
  h.color = !h.color;
  if (h.left) h.left.color = !h.left.color;
  if (h.right) h.right.color = !h.right.color;
}

function insert(h: RbNode | null, key: number): RbNode {
  if (!h) return { key, left: null, right: null, color: RED };
  if (key < h.key) h.left = insert(h.left, key);
  else if (key > h.key) h.right = insert(h.right, key);
  // duplicates ignored
  if (isRed(h.right) && !isRed(h.left)) h = rotateLeft(h);
  if (isRed(h.left) && isRed(h.left!.left)) h = rotateRight(h);
  if (isRed(h.left) && isRed(h.right)) flip(h);
  return h;
}

export function buildRbtree(input: string): TreeDocument {
  const keys = (input.match(/-?\d+/g) ?? []).map(Number);
  let root: RbNode | null = null;
  for (const k of keys) { root = insert(root, k); root.color = BLACK; }

  const nodes: TreeNode[] = [];
  let i = 0;
  const emit = (n: RbNode): string => {
    const id = `n${i++}`;
    const children: string[] = [];
    nodes.push({ id, label: String(n.key), kinds: [n.color === RED ? 'red' : 'black'], children });
    if (n.left) children.push(emit(n.left));
    if (n.right) children.push(emit(n.right));
    return id;
  };
  if (root) emit(root);

  return { version: '1.0', metadata: {}, direction: 'TB', nodes };
}

export const rbtree: DiagramModule<TreeDocument> = {
  parseMermaid: buildRbtree,
  parseYaml: (input) => JSON.parse(input) as TreeDocument,
  layout: async (ir: TreeDocument, theme: ResolvedTheme): Promise<LayoutResult> => layoutTree(ir, theme),
};
