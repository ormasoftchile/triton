/**
 * @file diagrams/tree/ir.ts — Decorated tree IR.
 *
 * One generic hierarchy whose nodes carry a small decoration vocabulary
 * (kinds → shape/colour, badge, info sub-line, edge label). The semantic
 * front-ends (avl, rbtree, btree, radix, segtree, heap, plan) all compile
 * down to this IR.
 */

import type { BaseIR } from '../../contracts/index.js';

export type TreeDirection = 'TB' | 'LR';

export interface TreeNode {
  readonly id: string;
  readonly label: string;
  /** Kind/colour tags, e.g. 'circle', 'leaf', 'box', 'red', 'black', 'scan'. */
  readonly kinds: readonly string[];
  /** Muted sub-line under the label (e.g. 'rows: 980', a range). */
  readonly info?: string;
  /** Corner badge value (e.g. an AVL balance factor). */
  readonly badge?: string;
  /** Label on the edge from this node's parent (e.g. 'yes' / 'no'). */
  readonly edgeLabel?: string;
  readonly children: readonly string[];
}

export interface TreeDocument extends BaseIR {
  readonly direction: TreeDirection;
  /** Flat, ordered node list; roots are nodes never referenced as a child. */
  readonly nodes: readonly TreeNode[];
}
