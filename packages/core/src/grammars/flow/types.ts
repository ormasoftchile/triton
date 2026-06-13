/**
 * @file grammars/flow/types.ts — Flow Grammar Domain IR.
 *
 * The Flow Grammar is the second "de-risked" grammar after Sequence. Where the
 * Sequence grammar proves the kernel handles time-ordered message exchanges, the
 * Flow grammar proves the kernel is genuinely grammar-agnostic: node-link
 * topologies (pipelines, DAGs, process flows) work without kernel modifications.
 *
 * LOWERING: FlowDocument → layoutFlow() → Scene (shared kernel IR)
 * The Scene is then consumed by sceneToSvg / sceneToPngSkia unchanged.
 *
 * PRINCIPLE: Grammar = semantics (structure, topology, kind hints).
 *            Theme   = style  (colors, fonts, geometry, edge style).
 */

// ---------------------------------------------------------------------------
// FlowNode
// ---------------------------------------------------------------------------

/**
 * A discrete entity in the flow: a processing step, decision point, data
 * store, or any labeled box. Nodes are the primary vocabulary of the flow IR.
 *
 * SEMANTIC FIELDS ONLY — no colors, fonts, or layout parameters here.
 * All visual decisions belong in FlowTheme.
 */
export interface FlowNode {
  /** Document-unique identifier (kebab-case, e.g. "query", "embed"). */
  id: string;
  /** Display text rendered inside the node box. */
  label: string;
  /**
   * Shape kind hint. The FlowTheme maps this to a visual shape:
   *   'rect'         → sharp-cornered rectangle
   *   'rounded-rect' → rounded rectangle (default)
   *   'stadium'      → pill shape (rx = height/2)
   *   'circle'       → circle
   *   'diamond'      → diamond / rhombus (decision node)
   * Any unknown value falls back to 'rounded-rect'.
   */
  kind?: string;
  /**
   * Icon registry key (e.g. 'database', 'sparkles').
   * The theme controls whether icons are shown and how they are sized.
   */
  icon?: string;
  /**
   * Semantic status hint. Resolved by the theme to fill/text colors.
   *   'default' | 'active' | 'success' | 'warning' | 'error' | 'muted'
   * The domain IR carries no color values — all color is theme-resolved.
   */
  status?: string;
  /** Tooltip or secondary text. Not rendered in increment-1. */
  description?: string;
}

// ---------------------------------------------------------------------------
// FlowEdge
// ---------------------------------------------------------------------------

/**
 * A directed relationship between two nodes.
 * Edges are identified by list position (no mandatory id).
 */
export interface FlowEdge {
  /** Optional document-unique edge identifier. */
  id?: string;
  /** Source node id. */
  from: string;
  /** Target node id. */
  to: string;
  /** Optional annotation text displayed near the edge midpoint. */
  label?: string;
  /**
   * Edge communication kind (semantic):
   *   'sync'  → solid stroke (default)
   *   'async' → dashed stroke
   */
  kind?: 'sync' | 'async';
  /**
   * Animated flowing-dash hint.
   * SVG/HTML backends: CSS stroke-dashoffset animation (dashflow, implemented).
   * PNG/raster backends: static dashed stroke (resting frame).
   * Setting animated=true has zero impact on PNG output (deterministic).
   */
  animated?: boolean;
  /**
   * Explicit stroke style override (takes precedence over `kind`).
   *   'solid'  → continuous stroke
   *   'dashed' → long dashes (6,4)
   *   'dotted' → short dots (2,4)
   */
  style?: 'solid' | 'dashed' | 'dotted';
}

// ---------------------------------------------------------------------------
// FlowDefinition and FlowDocument
// ---------------------------------------------------------------------------

export interface FlowDefinition {
  /** All nodes in declaration order. Order is canonical for layout tie-breaking. */
  nodes: FlowNode[];
  /** All edges in declaration order. May be empty. */
  edges: FlowEdge[];
}

export interface FlowMetadata {
  /** Diagram title. Not rendered in increment-1. */
  title?: string;
  /** Theme name. Default: 'default-flow'. */
  theme?: string;
}

/** Root document for the Flow Grammar IR. */
export interface FlowDocument {
  /** Spec version (semver string, e.g. "1.0"). */
  version: string;
  metadata: FlowMetadata;
  /** The flow graph definition (nodes + edges). */
  flow: FlowDefinition;
}
