import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../../contracts/index.js';
import type { TreeDocument } from './ir.js';
import { layoutTree } from './layout.js';
import { parseLines, buildNodes } from './build.js';

export type { TreeDocument, TreeNode, TreeDirection } from './ir.js';

export const tree: DiagramModule<TreeDocument> = {
  parseMermaid(input: string): TreeDocument {
    const raw = parseLines(input);
    return {
      version: raw.version,
      metadata: raw.metadata ?? {},
      direction: raw.direction,
      nodes: buildNodes(raw.lines),
    };
  },

  parseYaml(input: string): TreeDocument {
    return JSON.parse(input) as TreeDocument;
  },

  layout(ir: TreeDocument, theme: ResolvedTheme): LayoutResult {
    return layoutTree(ir, theme);
  },
};
