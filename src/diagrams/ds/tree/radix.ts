/**
 * @file diagrams/tree/radix.ts — Radix (Patricia) trie front-end.
 *
 * Value-driven: `radix insert cat car card dog` inserts strings into a
 * prefix-compressed trie. Shared prefixes collapse onto single labelled edges;
 * branch nodes render as small dots, word-terminal nodes as filled pills.
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../../contracts/index.js';
import type { TreeDocument, TreeNode } from './ir.js';
import { layoutTree } from './layout.js';

interface RNode { edges: Map<string, RNode>; end: boolean; }

const newNode = (): RNode => ({ edges: new Map(), end: false });

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function insert(root: RNode, word: string): void {
  let node = root;
  let rest = word;
  while (rest.length > 0) {
    let matched: string | undefined;
    for (const label of node.edges.keys()) {
      if (label[0] === rest[0]) { matched = label; break; }
    }
    if (matched === undefined) {
      const child = newNode();
      child.end = true;
      node.edges.set(rest, child);
      return;
    }
    const cp = commonPrefix(matched, rest);
    if (cp === matched.length) {
      node = node.edges.get(matched)!;
      rest = rest.slice(cp);
      if (rest.length === 0) node.end = true;
    } else {
      // split the existing edge at cp
      const existingChild = node.edges.get(matched)!;
      node.edges.delete(matched);
      const mid = newNode();
      node.edges.set(matched.slice(0, cp), mid);
      mid.edges.set(matched.slice(cp), existingChild);
      if (cp === rest.length) {
        mid.end = true;
      } else {
        const leaf = newNode();
        leaf.end = true;
        mid.edges.set(rest.slice(cp), leaf);
      }
      return;
    }
  }
  node.end = true;
}

export function buildRadix(input: string): TreeDocument {
  // words = alphabetic tokens after the leading `radix`/`insert` keywords
  const tokens = input.split(/\s+/).filter(Boolean);
  const words = tokens.filter(t => /^[A-Za-z]+$/.test(t) && t !== 'radix' && t !== 'insert');
  const root = newNode();
  for (const w of words) insert(root, w);

  const nodes: TreeNode[] = [];
  let i = 0;
  const emit = (n: RNode, prefix: string, edgeLabel?: string): string => {
    const id = `n${i++}`;
    const children: string[] = [];
    const node: TreeNode = n.end
      ? { id, label: prefix, kinds: ['leaf', 'active'], children, ...(edgeLabel !== undefined ? { edgeLabel } : {}) }
      : { id, label: '', kinds: ['dot'], children, ...(edgeLabel !== undefined ? { edgeLabel } : {}) };
    nodes.push(node);
    for (const [label, child] of n.edges) children.push(emit(child, prefix + label, label));
    return id;
  };
  emit(root, '');

  return { version: '1.0', metadata: {}, direction: 'TB', nodes };
}

export const radix: DiagramModule<TreeDocument> = {
  parseMermaid: buildRadix,
  parseYaml: (input) => JSON.parse(input) as TreeDocument,
  layout: (ir: TreeDocument, theme: ResolvedTheme): LayoutResult => layoutTree(ir, theme),
};
