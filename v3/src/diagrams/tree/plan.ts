/**
 * @file diagrams/tree/plan.ts — Query-plan front-end over the tree engine.
 *
 * Same indentation source as `tree`, but operator nodes are auto-coloured by
 * kind inferred from their name (scan / join / build), so authors don't tag
 * every node by hand.
 */

import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../contracts/index.js';
import type { TreeDocument } from './ir.js';
import { layoutTree } from './layout.js';
import { parseLines, buildNodes } from './build.js';

const COLOUR_KINDS = ['scan', 'join', 'build', 'red', 'black', 'active', 'primary', 'muted'];

/** Infer an operator colour-kind from its label. */
function inferKind(label: string): string | undefined {
  const l = label.toLowerCase();
  if (l.includes('join')) return 'join';
  if (l.includes('scan')) return 'scan';
  if (l.includes('hash') || l.includes('sort') || l.includes('aggregate')
    || l.includes('group') || l.includes('materialize') || l.includes('gather')) return 'build';
  return undefined;
}

export const plan: DiagramModule<TreeDocument> = {
  parseMermaid(input: string): TreeDocument {
    const raw = parseLines(input);
    const nodes = buildNodes(raw.lines);
    for (const n of nodes) {
      if (n.kinds.some(k => COLOUR_KINDS.includes(k))) continue;
      const k = inferKind(n.label);
      if (k) n.kinds.push(k);
    }
    return {
      version: raw.version,
      metadata: raw.metadata ?? {},
      direction: raw.direction,
      nodes,
    };
  },

  parseYaml(input: string): TreeDocument {
    return JSON.parse(input) as TreeDocument;
  },

  async layout(ir: TreeDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutTree(ir, theme);
  },
};
