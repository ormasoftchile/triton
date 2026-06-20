/**
 * Flowchart Diagram Module — Public API.
 *
 * Pipeline:
 *   Mermaid text → parser.js (generated from grammar.peggy) → FlowDocument
 *   YAML text    → schema.ts (validate) → FlowDocument
 *   FlowDocument → layout() → Scene
 */

import type { DiagramModule } from '../contract.js';
import type { FlowDocument } from './ir.js';
import type { Scene } from '../../scene/types.js';
import type { ResolvedTheme } from '../../theme/types.js';
import { layoutFlowchart } from './layout.js';
import * as parser from './parser.js';

export type { FlowDocument, FlowNode, FlowEdge, FlowSubgraph, FlowDirection } from './ir.js';

export const flowchart: DiagramModule<FlowDocument> = {
  parseMermaid(input: string): FlowDocument {
    const raw = parser.parse(input) as any;
    return {
      version: raw.version,
      metadata: raw.metadata || {},
      direction: raw.direction,
      nodes: raw.flow.nodes,
      edges: raw.flow.edges,
      subgraphs: [],
      overlays: raw.overlays?.length > 0 ? raw.overlays : undefined,
    };
  },

  parseYaml(input: string): FlowDocument {
    return JSON.parse(input) as FlowDocument;
  },

  layout(ir: FlowDocument, theme: ResolvedTheme): Scene {
    return layoutFlowchart(ir, theme);
  },
};