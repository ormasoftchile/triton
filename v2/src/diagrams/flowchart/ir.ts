/**
 * FlowDocument — Canonical IR for flowchart/graph diagrams.
 *
 * This is the target output of both:
 *   1. Mermaid text → grammar.peggy → compiler.ts → FlowDocument
 *   2. YAML input  → schema.ts (validate) → FlowDocument
 */

import type { RawOverlay } from '../../scene/compile-overlays.js';

// ─── Node Types ────────────────────────────────────────────────────────────────

export type NodeShape =
  | 'rect'
  | 'rounded-rect'
  | 'circle'
  | 'diamond'
  | 'stadium'
  | 'subroutine'
  | 'cylinder'
  | 'hexagon'
  | 'parallelogram'
  | 'parallelogram-alt'
  | 'asymmetric';

export interface FlowNode {
  id: string;
  label: string;
  shape: NodeShape;
  icon?: string;
  status?: 'default' | 'active' | 'success' | 'warning' | 'error' | 'muted';
  description?: string;
  subgraph?: string;
}

// ─── Edge Types ────────────────────────────────────────────────────────────────

export type EdgeKind = 'sync' | 'async';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  kind: EdgeKind;
  style: EdgeStyle;
  animated?: boolean;
}

// ─── Subgraph ──────────────────────────────────────────────────────────────────

export interface FlowSubgraph {
  id: string;
  label: string;
  nodeIds: string[];
}

// ─── Document ──────────────────────────────────────────────────────────────────

export type FlowDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export interface FlowDocument {
  version: string;
  metadata: {
    title?: string;
    theme?: string;
    [key: string]: string | undefined;
  };
  direction: FlowDirection;
  nodes: FlowNode[];
  edges: FlowEdge[];
  subgraphs: FlowSubgraph[];
  overlays?: RawOverlay[];
}
