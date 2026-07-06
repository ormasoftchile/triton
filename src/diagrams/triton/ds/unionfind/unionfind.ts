/**
 * @file diagrams/ds/unionfind/unionfind.ts — Disjoint Set Union (DSU) forest.
 *
 * A union-find structure is a forest of parent-pointer trees: each set is one
 * tree rooted at its representative. This renders the whole forest side by side
 * (the shared tidy-tree kernel places each root block left→right), with the
 * representative of each set marked distinctly (filled) and the members drawn
 * as plain circles. Edges are parent pointers (child → parent, drawn top-down).
 *
 * Value-driven mini-syntax (header `unionfind` or alias `dsu`):
 *   unionfind 7
 *     parent 0 0 1 1 3 5 5        // parent[i]; parent[i]==i ⇒ representative
 *
 *   dsu 7
 *     union 1 0                    // attach set(1) under set(0)
 *     union 3 1
 *     union 6 5
 *
 * Compiles to the shared decorated-tree IR and reuses layout.ts (graph/tree).
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../../../contracts/index.js';
import type { TreeDocument, TreeNode } from '../tree/ir.js';
import { layoutTree } from '../tree/layout.js';

export interface UnionFindDoc extends TreeDocument {
  /** parent[i] is the parent of element i; parent[i] === i ⇒ representative. */
  readonly parent: readonly number[];
  /** Indices of the set representatives (roots). */
  readonly roots: readonly number[];
  /** Number of disjoint sets (= roots.length). */
  readonly count: number;
}

function find(parent: number[], x: number): number {
  let r = x;
  // Walk to the root without path compression (preserve the drawn shape),
  // guarding against malformed cycles by capping iterations.
  for (let guard = 0; guard < parent.length && parent[r] !== r; guard++) r = parent[r]!;
  return r;
}

export function buildUnionFind(input: string): UnionFindDoc {
  const linesArr = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let count = 0;
  let parent: number[] = [];
  let title: string | undefined;
  const unions: [number, number][] = [];

  for (const line of linesArr) {
    const t = line.split(/\s+/);
    if (t[0] === 'unionfind' || t[0] === 'dsu') {
      const n = Number(t[1]);
      if (Number.isFinite(n) && n > 0) count = Math.floor(n);
      continue;
    }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'parent') {
      const vals = t.slice(1).map(Number).filter(Number.isFinite);
      parent = vals;
      count = Math.max(count, vals.length);
      continue;
    }
    if (t[0] === 'union') {
      const a = Number(t[1]); const b = Number(t[2]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        unions.push([a, b]);
        count = Math.max(count, a + 1, b + 1);
      }
      continue;
    }
  }

  // Seed parent[] as singletons, then apply any explicit array + union ops.
  const par: number[] = Array.from({ length: count }, (_, i) => (parent[i] !== undefined ? parent[i]! : i));
  for (const [a, b] of unions) {
    const ra = find(par, a); const rb = find(par, b);
    if (ra !== rb) par[ra] = rb;     // attach a's set under b's representative
  }

  const roots: number[] = [];
  for (let i = 0; i < count; i++) if (par[i] === i) roots.push(i);

  // Build the decorated-tree node list: each element points to its parent;
  // representatives are roots (never referenced as a child of anyone else).
  const nodes: TreeNode[] = [];
  for (let i = 0; i < count; i++) {
    const children: string[] = [];
    for (let j = 0; j < count; j++) if (j !== i && par[j] === i) children.push(`e${j}`);
    const isRoot = par[i] === i;
    nodes.push({
      id: `e${i}`,
      label: String(i),
      kinds: isRoot ? ['circle', 'active'] : ['circle'],
      children,
    });
  }

  return {
    version: '1.0',
    metadata: { ...(title !== undefined ? { title } : {}) },
    direction: 'TB',
    nodes,
    parent: par,
    roots,
    count,
  };
}

export function layoutUnionFind(ir: UnionFindDoc, theme: ResolvedTheme): LayoutResult {
  return layoutTree(ir, theme);
}

export const unionfind: DiagramModule<UnionFindDoc> = {
  parseMermaid: buildUnionFind,
  parseYaml: (input) => JSON.parse(input) as UnionFindDoc,
  layout: layoutUnionFind,
};
