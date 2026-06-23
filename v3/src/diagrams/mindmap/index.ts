import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { MindmapDocument, MindNode } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutMindmap } from './layout.js';
import * as parser from './parser.js';

export type { MindmapDocument, MindNode } from './ir.js';

interface RawLine { indent: number; raw: string }
interface RawDoc { version: string; metadata: MindmapDocument['metadata']; lines: RawLine[] }

interface MutNode { label: string; icon?: string; children: MutNode[] }

function cleanLabel(raw: string): string {
  // Strip a node-shape wrapper, ignoring any leading id: id((label)) → label.
  const m = raw.match(/^[^([{]*[([{]+(.+?)[)\]}]+$/);
  return (m ? m[1]! : raw).trim();
}

function buildTree(lines: RawLine[]): MindNode | undefined {
  if (lines.length === 0) return undefined;
  const first = lines.find(l => !l.raw.startsWith('::'));
  if (!first) return undefined;
  const root: MutNode = { label: cleanLabel(first.raw), children: [] };
  const stack: Array<{ node: MutNode; indent: number }> = [{ node: root, indent: first.indent }];
  let last: MutNode = root;
  let started = false;
  for (const ln of lines) {
    if (!started) { if (ln === first) started = true; continue; }
    // `::icon(...)` attaches to the most recent node rather than creating one.
    const iconMatch = ln.raw.match(/^::icon\(([^)]*)\)/);
    if (iconMatch) { last.icon = iconMatch[1]!.trim(); continue; }
    const node: MutNode = { label: cleanLabel(ln.raw), children: [] };
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= ln.indent) stack.pop();
    stack[stack.length - 1]!.node.children.push(node);
    stack.push({ node, indent: ln.indent });
    last = node;
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
