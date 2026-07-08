/**
 * Cross-Link
 *
 * Contracts for cross-diagram linking in poster compositions.
 *
 * CrossLink: a single directed/undirected edge between nodes in
 * different cells of a poster.
 *
 * Cross-links are presentation-layer assertions on the composition.
 * They do NOT modify any child diagram's IR or Scene — each cell
 * compiles as if links don't exist. All resolution happens at
 * composition time, after every cell has produced its LayoutResult.
 *
 * Dependency: primitives.ts, anchors.ts
 */

import type { Point } from './primitives.js';
import type { CardinalSide, NodeAnchor } from './anchors.js';
import type { CurveStyle, RouteStyle } from './routing.js';

// ─── Cell Address ─────────────────────────────────────────────────────────────

/**
 * Address of a node across poster nesting levels.
 *
 * A flat poster uses a single-segment path: ["A1", "pay"]
 *   → cell A1, node "pay"
 *
 * A nested poster uses multi-segment paths: ["A1", "B1", "db"]
 *   → cell A1 (which is itself a poster), cell B1 within it, node "db"
 *
 * The last segment is always the node ID.
 * All preceding segments are cell addresses traversed from the poster
 * where the link is declared.
 */
export interface NodeAddress {
  /** Ordered cell path from the declaring poster to the target cell. */
  readonly cellPath: readonly string[];
  /** Node ID within the target cell's diagram. */
  readonly nodeId: string;
}

// ─── Edge Style ───────────────────────────────────────────────────────────────

/** Visual style of a cross-diagram edge. */
export type CrossLinkEdgeStyle =
  | 'solid'      // ──────
  | 'dashed'     // - - - -
  | 'dotted';    // · · · ·

/** Direction of a cross-diagram edge. */
export type CrossLinkDirection =
  | 'directed'   // -->
  | 'undirected' // ---
  | 'bidirectional'; // <-->

// ─── Cross-Link (Atomic) ─────────────────────────────────────────────────────

/**
 * A single cross-diagram edge between two nodes in different cells.
 * This is the primitive — traces desugar into ordered sequences of these.
 */
export interface CrossLink {
  /** Source endpoint address. */
  readonly from: NodeAddress;
  /** Target endpoint address. */
  readonly to: NodeAddress;
  readonly direction: CrossLinkDirection;
  readonly style: CrossLinkEdgeStyle;
  /** Optional label rendered at the route midpoint. */
  readonly label?: string;
  /**
   * Geometric routing style for this edge.
   * Defaults to 'orthogonal' when omitted.
   */
  readonly routing?: RouteStyle;
  /**
   * Optional interpolation style for curved connectors.
   */
  readonly curveStyle?: CurveStyle;
  /**
   * Optional hint for which wall to exit from the source node.
   * When set, the routing engine skips all other srcWall candidates.
   */
  readonly exitWall?: CardinalSide;
  /**
   * Optional hint for which wall to enter the destination node.
   * When set, the routing engine skips all other dstWall candidates.
   */
  readonly entryWall?: CardinalSide;
  /**
   * Animation applied to the rendered connector.
   *
   * 'march'    — marching ants (stroke-dashoffset cycle). Only visible when
   *              the edge style is dashed or dotted; silently ignored on solid.
   * 'particle' — a dot travels along the path. Works on any edge style.
   * 'none'     — explicitly suppresses the default animation for this edge.
   *
   * When omitted the renderer applies defaults:
   *   dashed → 'march', dotted → 'march', solid → no animation.
   */
  readonly animation?: 'march' | 'particle' | 'none';
  /**
   * Optional property bag for future per-link overrides (tension, color, etc.).
   * Parsed from `{ key: value }` blocks in the syntax.
   */
  readonly props?: Readonly<Record<string, string | number>>;
}

// ─── Resolved Cross-Link (after anchor lookup) ────────────────────────────────

/**
 * A cross-link with both endpoints resolved to poster-space coordinates.
 * Produced by the resolution pass; consumed by the routing pass.
 */
export interface ResolvedCrossLink {
  readonly link: CrossLink;
  /** Source anchor in poster coordinates. */
  readonly fromAnchor: NodeAnchor;
  /** Target anchor in poster coordinates. */
  readonly toAnchor: NodeAnchor;
  /** Selected port pair (minimises distance). */
  readonly fromPort: Point;
  readonly toPort: Point;
  readonly fromSide: CardinalSide;
  readonly toSide: CardinalSide;
}

// ─── Route Quality ────────────────────────────────────────────────────────────

/**
 * Quality metrics for a computed cross-link route.
 * Used by Phase 2 negotiation to decide whether to perturb layout.
 */
export interface RouteQuality {
  /** Number of 90° bends in the route. */
  readonly bends: number;
  /** Total route length in px. */
  readonly length: number;
  /** Number of cell bounding boxes the route crosses through. */
  readonly cellCrossings: number;
  /**
   * Ratio of actual route length to straight-line distance.
   * 1.0 = perfectly direct. Higher = more detour.
   */
  readonly detourRatio: number;
  /** Overall quality verdict. */
  readonly acceptable: boolean;
}

// ─── Negotiation ──────────────────────────────────────────────────────────────

/**
 * A perturbation proposal generated by the quality analyser.
 * The composition engine evaluates proposals and applies the best ones.
 */
export type PerturbationKind =
  | 'expand-gutter'      // widen the gap between two specific cells
  | 'swap-cells'         // swap positions of two cells in the grid
  | 'add-routing-bus'    // reserve a horizontal/vertical routing channel
  | 'port-hint';         // inject PortHint into a child layout re-run

export interface Perturbation {
  readonly kind: PerturbationKind;
  /** Which cross-link triggered this proposal. */
  readonly linkIndex: number;
  /** Perturbation-specific payload. */
  readonly payload: Readonly<Record<string, unknown>>;
}
