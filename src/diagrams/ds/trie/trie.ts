/**
 * @file diagrams/ds/trie/trie.ts — Prefix tree (trie) front-end.
 *
 * Value-driven: `trie insert cat car card dog do` inserts strings into a
 * character trie. Unlike the radix/Patricia trie, edges are NOT compressed —
 * every character gets its own edge and node. Shared prefixes share a path,
 * branch/intermediate nodes render as small dots, and word-terminal nodes
 * render as filled pills showing the full word.
 *
 * Compiles down to the shared decorated-tree IR (ir.ts) and reuses the tidy
 * tree placement kernel (graph/tree via layout.ts), exactly like radix.
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../../contracts/index.js';
import type { TreeDocument, TreeNode } from '../tree/ir.js';
import { layoutTree } from '../tree/layout.js';

interface TNode { edges: Map<string, TNode>; end: boolean; }

const newNode = (): TNode => ({ edges: new Map(), end: false });

function insert(root: TNode, word: string): void {
  let node = root;
  for (const ch of word) {
    let child = node.edges.get(ch);
    if (child === undefined) { child = newNode(); node.edges.set(ch, child); }
    node = child;
  }
  node.end = true;
}

export function buildTrie(input: string): TreeDocument {
  // words = non-keyword alphanumeric tokens after `trie`/`insert`
  const tokens = input.split(/\s+/).filter(Boolean);
  const words = tokens.filter(t => t !== 'trie' && t !== 'insert' && /^[A-Za-z0-9]+$/.test(t));
  const root = newNode();
  for (const w of words) insert(root, w);

  const nodes: TreeNode[] = [];
  let i = 0;
  const emit = (n: TNode, prefix: string, edgeLabel?: string): string => {
    const id = `n${i++}`;
    const children: string[] = [];
    // Terminal nodes (end of a word) → filled pill labelled with the full word.
    // Intermediate/branch nodes → small dot; the character lives on the edge.
    const node: TreeNode = n.end
      ? { id, label: prefix, kinds: ['leaf', 'active'], children, ...(edgeLabel !== undefined ? { edgeLabel } : {}) }
      : { id, label: '', kinds: ['dot'], children, ...(edgeLabel !== undefined ? { edgeLabel } : {}) };
    nodes.push(node);
    // Stable child order: insertion order of the Map (first-seen character).
    for (const [ch, child] of n.edges) children.push(emit(child, prefix + ch, ch));
    return id;
  };
  emit(root, '');

  return { version: '1.0', metadata: {}, direction: 'TB', nodes };
}

export const trie: DiagramModule<TreeDocument> = {
  parseMermaid: buildTrie,
  parseYaml: (input) => JSON.parse(input) as TreeDocument,
  layout: (ir: TreeDocument, theme: ResolvedTheme): LayoutResult => layoutTree(ir, theme),
};
