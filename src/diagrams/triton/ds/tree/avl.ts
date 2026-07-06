/**
 * @file diagrams/tree/avl.ts — AVL-tree front-end over the tree engine.
 *
 * Value-driven: the source is a list of integers (`avl insert 50 30 70 …`); the
 * builder performs real BST insertion with AVL rotations and emits one circle
 * node per key with its balance-factor badge. The structure is always valid by
 * construction — you cannot author an unbalanced AVL tree.
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../../../contracts/index.js';
import type { TreeDocument, TreeNode } from './ir.js';
import { layoutTree } from './layout.js';

interface AvlNode { key: number; left: AvlNode | null; right: AvlNode | null; height: number; }

const h = (n: AvlNode | null): number => (n ? n.height : 0);
const upd = (n: AvlNode): void => { n.height = 1 + Math.max(h(n.left), h(n.right)); };
const bf = (n: AvlNode): number => h(n.left) - h(n.right);

function rotateRight(y: AvlNode): AvlNode {
  const x = y.left!;
  y.left = x.right;
  x.right = y;
  upd(y); upd(x);
  return x;
}
function rotateLeft(x: AvlNode): AvlNode {
  const y = x.right!;
  x.right = y.left;
  y.left = x;
  upd(x); upd(y);
  return y;
}

function insert(node: AvlNode | null, key: number): AvlNode {
  if (!node) return { key, left: null, right: null, height: 1 };
  if (key < node.key) node.left = insert(node.left, key);
  else if (key > node.key) node.right = insert(node.right, key);
  else return node; // ignore duplicates
  upd(node);
  const balance = bf(node);
  if (balance > 1 && key < node.left!.key) return rotateRight(node);
  if (balance < -1 && key > node.right!.key) return rotateLeft(node);
  if (balance > 1 && key > node.left!.key) { node.left = rotateLeft(node.left!); return rotateRight(node); }
  if (balance < -1 && key < node.right!.key) { node.right = rotateRight(node.right!); return rotateLeft(node); }
  return node;
}

/** Build a valid AVL tree IR from the integers in the source. */
export function buildAvl(input: string): TreeDocument {
  const keys = (input.match(/-?\d+/g) ?? []).map(Number);
  let root: AvlNode | null = null;
  for (const k of keys) root = insert(root, k);

  const nodes: TreeNode[] = [];
  let i = 0;
  const emit = (n: AvlNode): string => {
    const id = `n${i++}`;
    const children: string[] = [];
    nodes.push({ id, label: String(n.key), kinds: ['circle'], badge: String(bf(n)), children });
    if (n.left) children.push(emit(n.left));
    if (n.right) children.push(emit(n.right));
    return id;
  };
  if (root) emit(root);

  return { version: '1.0', metadata: {}, direction: 'TB', nodes };
}

export const avl: DiagramModule<TreeDocument> = {
  parseMermaid(input: string): TreeDocument {
    return buildAvl(input);
  },
  parseYaml(input: string): TreeDocument {
    return JSON.parse(input) as TreeDocument;
  },
  layout(ir: TreeDocument, theme: ResolvedTheme): LayoutResult {
    return layoutTree(ir, theme);
  },
};
