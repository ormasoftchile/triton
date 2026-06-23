/**
 * @file diagrams/tree/build.ts — Shared parsing helpers for the tree family.
 *
 * The indentation grammar (shared by `tree` and `plan`) is parsed here and the
 * raw lines are folded into a child-linked node list. Semantic front-ends
 * (plan) reuse this; value-driven front-ends (avl, …) build nodes directly.
 */

import * as parser from './parser.js';

export interface RawLine {
  indent: number;
  label: string;
  kinds: string[];
  attrs: Record<string, unknown>;
  edgeLabel?: string;
}

export interface ParsedTree {
  version: string;
  metadata: Record<string, unknown>;
  direction: 'TB' | 'LR';
  lines: RawLine[];
}

/** A node with mutable arrays so front-ends can post-process before freezing. */
export interface MutableTreeNode {
  id: string;
  label: string;
  kinds: string[];
  children: string[];
  info?: string;
  badge?: string;
  edgeLabel?: string;
}

export function parseLines(input: string): ParsedTree {
  return parser.parse(input) as ParsedTree;
}

/** Fold indentation-nested raw lines into a flat, child-linked node list. */
export function buildNodes(lines: readonly RawLine[]): MutableTreeNode[] {
  const nodes: MutableTreeNode[] = [];
  const byId = new Map<string, MutableTreeNode>();
  const stack: { indent: number; id: string }[] = [];

  lines.forEach((ln, i) => {
    const id = `n${i}`;
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= ln.indent) stack.pop();
    const parent = stack.length > 0 ? stack[stack.length - 1] : undefined;

    const kinds = [...ln.kinds];
    const infoParts: string[] = [];
    let badge: string | undefined;
    for (const [k, v] of Object.entries(ln.attrs ?? {})) {
      if (v === true) { kinds.push(k); continue; }
      if (k === 'badge') { badge = String(v); continue; }
      infoParts.push(k === 'sub' || k === 'info' ? String(v) : `${k}: ${v}`);
    }
    const info = infoParts.length > 0 ? infoParts.join(' · ') : undefined;

    const node: MutableTreeNode = {
      id, label: ln.label, kinds, children: [],
      ...(info !== undefined ? { info } : {}),
      ...(badge !== undefined ? { badge } : {}),
      ...(ln.edgeLabel !== undefined ? { edgeLabel: ln.edgeLabel } : {}),
    };
    nodes.push(node);
    byId.set(id, node);
    if (parent) byId.get(parent.id)!.children.push(id);
    stack.push({ indent: ln.indent, id });
  });

  return nodes;
}
