import type { BaseIR } from '../../contracts/index.js';

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

export type EdgeKind  = 'sync' | 'async';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly kind: EdgeKind;
  readonly style: EdgeStyle;
  readonly bidirectional?: boolean;
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
