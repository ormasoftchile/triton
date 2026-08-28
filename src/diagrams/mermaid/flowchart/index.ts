import type { DiagramModule, LayoutResult, LayoutOptions } from '../../../contracts/index.js';
import type { FlowDocument, FlowNode } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { parseIconRef } from '../../../icons/resolver.js';
import { layoutFlowchart } from './layout.js';
import * as parser from './parser.js';

export type {
  FlowDocument,
  FlowNode,
  FlowEdge,
  FlowSubgraph,
  FlowDirection,
  NodeShape,
  NodeStatus,
  EdgeStyle,
  EdgeEndMarker,
} from './ir.js';

function normalizeIconToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.includes(':')) return trimmed;
  const faMatch = trimmed.match(/^fa(?:\s+fa|-)?-([a-z0-9-]+)$/i);
  if (faMatch) return `fa:${faMatch[1]}`;
  const hyphenIdx = trimmed.indexOf('-');
  if (hyphenIdx > 0) {
    return `${trimmed.slice(0, hyphenIdx)}:${trimmed.slice(hyphenIdx + 1)}`;
  }
  return trimmed;
}

export const flowchart: DiagramModule<FlowDocument> = {
  parseMermaid(input: string): FlowDocument {
    const raw = parser.parse(input) as any;
    const nodes: FlowNode[] = (raw.flow.nodes as any[]).map((n: any): FlowNode => {
      const base: FlowNode = {
        id: n.id,
        label: n.label,
        shape: n.shape || 'rect',
        status: n.status || 'default',
        ...(n.subgraph !== undefined ? { subgraph: n.subgraph as string } : {}),
      };
      if (n.iconToken !== undefined) {
        const token = normalizeIconToken(String(n.iconToken));
        const result = parseIconRef(token);
        if (!result.ok) {
          throw new Error(
            `Flowchart parse error: invalid @icon value "${n.iconToken}": ${result.error.message}`,
          );
        }
        return { ...base, icon: result.value };
      }
      return base;
    });
    return {
      version: raw.version,
      metadata: raw.metadata ?? {},
      direction: raw.direction,
      nodes,
      edges: raw.flow.edges,
      subgraphs: raw.subgraphs ?? [],
      overlays: raw.overlays?.length > 0 ? raw.overlays : undefined,
    };
  },

  parseYaml(input: string): FlowDocument {
    // TODO: replace with schema validation
    return JSON.parse(input) as FlowDocument;
  },

  layout(ir: FlowDocument, theme: ResolvedTheme, options?: LayoutOptions): LayoutResult {
    return layoutFlowchart(ir, theme, options);
  },
};
