import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { MindmapDocument, MindNode } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutMindmap } from './layout.js';
import * as parser from './parser.js';

export type { MindmapDocument, MindNode } from './ir.js';

interface RawLine { indent: number; raw: string }
interface RawDoc { version: string; metadata: MindmapDocument['metadata']; lines: RawLine[] }

interface MutNode { label: string; children: MutNode[] }

function cleanLabel(raw: string): string {
  // Strip a node-shape wrapper, ignoring any leading id: id((label)) → label.
  const m = raw.match(/^[^([{]*[([{]+(.+?)[)\]}]+$/);
  return (m ? m[1]! : raw).trim();
}

function buildTree(lines: RawLine[]): MindNode | undefined {
  const usable = lines.filter(l => !l.raw.startsWith('::'));
  if (usable.length === 0) return undefined;
  const root: MutNode = { label: cleanLabel(usable[0]!.raw), children: [] };
  const stack: Array<{ node: MutNode; indent: number }> = [{ node: root, indent: usable[0]!.indent }];
  for (let i = 1; i < usable.length; i++) {
    const ln = usable[i]!;
    const node: MutNode = { label: cleanLabel(ln.raw), children: [] };
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= ln.indent) stack.pop();
    stack[stack.length - 1]!.node.children.push(node);
    stack.push({ node, indent: ln.indent });
  }
  return root as MindNode;
}

export const mindmap: DiagramModule<MindmapDocument> = {
  parseMermaid(input: string): MindmapDocument {
    const raw = parser.parse(input) as RawDoc;
    const root = buildTree(raw.lines);
    return { version: raw.version, metadata: raw.metadata, ...(root ? { root } : {}) };
  },

  parseYaml(input: string): MindmapDocument {
    return JSON.parse(input) as MindmapDocument;
  },

  async layout(ir: MindmapDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutMindmap(ir, theme);
  },
};
