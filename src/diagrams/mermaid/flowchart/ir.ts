import type { BaseIR, CardinalSide, RouteStyle } from '../../../contracts/index.js';

export type NodeShape =
  | 'rect' | 'rounded-rect' | 'circle' | 'diamond' | 'stadium'
  | 'subroutine' | 'cylinder' | 'hexagon'
  | 'parallelogram' | 'parallelogram-alt' | 'asymmetric';

export type NodeStatus = 'default' | 'active' | 'success' | 'warning' | 'error' | 'muted';

export interface FlowNode {
  readonly id: string;
  readonly label: string;
  readonly shape: NodeShape;
  readonly status?: NodeStatus;
  readonly subgraph?: string;
}

export type EdgeStyle = 'solid' | 'dashed' | 'dotted' | 'thick' | 'wavy';

/** Endpoint marker shape for flowchart edges. */
export type EdgeEndMarker = 'arrow' | 'circle' | 'cross' | 'none';

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly style: EdgeStyle;
  readonly bidirectional?: boolean;
  readonly endMarker?: EdgeEndMarker;
  /** Optional routing style hint (straight | orthogonal | bezier | polyline). */
  readonly routing?: RouteStyle;
  /** Optional wall hint: force the edge to exit `from` on this side. */
  readonly exitWall?: CardinalSide;
  /** Optional wall hint: force the edge to enter `to` on this side. */
  readonly entryWall?: CardinalSide;
}

export interface FlowSubgraph {
  readonly id: string;
  readonly label: string;
  readonly nodeIds: readonly string[];
}

export type FlowDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export interface FlowDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly direction: FlowDirection;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
  readonly subgraphs: readonly FlowSubgraph[];
}
