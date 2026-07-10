import type { DiagramModule, ResolvedTheme, LayoutResult } from '../../../../contracts/index.js';
import type { TreeDocument } from './ir.js';
import { layoutTree } from './layout.js';
import { parseLines, buildNodes } from './build.js';

export type { TreeDocument, TreeNode, TreeDirection } from './ir.js';

/** Pre-process `path A -> B -> C` directives, returning them separately. */
function extractPathDirectives(input: string): { clean: string; paths: string[][] } {
  const cleanLines: string[] = [];
  const paths: string[][] = [];
  const PATH_RE = /^[ \t]*path[ \t]+(.+)$/;

  for (const line of input.split('\n')) {
    const m = line.match(PATH_RE);
    if (m && m[1]!.includes('->')) {
      const nodes = m[1]!.split('->').map(s => s.trim()).filter(Boolean);
      if (nodes.length >= 2) { paths.push(nodes); continue; }
    }
    cleanLines.push(line);
  }
  return { clean: cleanLines.join('\n'), paths };
}

export const tree: DiagramModule<TreeDocument> = {
  parseMermaid(input: string): TreeDocument {
    const { clean, paths } = extractPathDirectives(input);
    const raw = parseLines(clean);
    const nodes = buildNodes(raw.lines);

    // Map label → first node id
    const labelToId = new Map<string, string>();
    for (const node of nodes) {
      if (!labelToId.has(node.label)) labelToId.set(node.label, node.id);
    }

    const activePairs: [string, string][] = [];
    for (const seg of paths) {
      for (let i = 0; i < seg.length - 1; i++) {
        const fromId = labelToId.get(seg[i]!);
        const toId   = labelToId.get(seg[i + 1]!);
        if (fromId && toId) activePairs.push([fromId, toId]);
      }
    }

    return {
      version: raw.version,
      metadata: raw.metadata ?? {},
      direction: raw.direction,
      nodes,
      ...(activePairs.length > 0 ? { activePaths: activePairs } : {}),
    };
  },

  parseYaml(input: string): TreeDocument {
    return JSON.parse(input) as TreeDocument;
  },

  layout(ir: TreeDocument, theme: ResolvedTheme): LayoutResult {
    return layoutTree(ir, theme);
  },
};
