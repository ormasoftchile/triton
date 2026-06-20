import type { DiagramModule } from '../../contracts/index.js';
import type { FlowDocument } from './ir.js';
import type { Scene } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutFlowchart } from './layout.js';
import * as parser from './parser.js';

export type { FlowDocument, FlowNode, FlowEdge, FlowSubgraph, FlowDirection, NodeShape, NodeStatus, EdgeKind, EdgeStyle } from './ir.js';

export const flowchart: DiagramModule<FlowDocument> = {
  parseMermaid(input: string): FlowDocument {
    const raw = parser.parse(input) as any;
    return {
      version:   raw.version,
      metadata:  raw.metadata ?? {},
      direction: raw.direction,
      nodes:     raw.flow.nodes,
      edges:     raw.flow.edges,
      subgraphs: raw.subgraphs ?? [],
      overlays:  raw.overlays?.length > 0 ? raw.overlays : undefined,
    };
  },

  parseYaml(input: string): FlowDocument {
    // TODO: replace with schema validation
    return JSON.parse(input) as FlowDocument;
  },

  async layout(ir: FlowDocument, theme: ResolvedTheme): Promise<Scene> {
    return layoutFlowchart(ir, theme);
  },
};
