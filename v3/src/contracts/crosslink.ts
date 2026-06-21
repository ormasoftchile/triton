/**
 * Cross-Link
 *
 * Contracts for cross-diagram linking in poster compositions.
 *
 * Two constructs:
 *   - CrossLink: a single directed/undirected edge between nodes in
 *     different cells of a poster.
 *   - Trace: a named, ordered, optionally-typed multi-hop path of
 *     cross-links representing a logical thread (user journey,
 *     requirement traceability, distributed request path).
 *
 * Cross-links are presentation-layer assertions on the composition.
 * They do NOT modify any child diagram's IR or Scene — each cell
 * compiles as if links don't exist. All resolution happens at
 * composition time, after every cell has produced its LayoutResult.
 *
 * Dependency: primitives.ts, anchors.ts
 */

import type { Point, Color } from './primitives.js';
import type { CardinalSide, NodeAnchor } from './anchors.js';
import type { RouteStyle } from './routing.js';

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
   * If this link is part of a trace, the trace's ID.
   * Used to apply consistent styling (colour, grouping) across trace members.
   */
  readonly traceId?: string;
  /**
   * Optional property bag for future per-link overrides (tension, color, etc.).
   * Parsed from `{ key: value }` blocks in the syntax.
   */
  readonly props?: Readonly<Record<string, string | number>>;
}

// ─── Trace ────────────────────────────────────────────────────────────────────

/**
 * Semantic type of a trace — what relationship the hops represent.
 * Extensible; these are the built-in vocabulary from the design spec.
 */
export type TraceType =
  | 'satisfies'   // requirement → implementation
  | 'triggers'    // event → handler
  | 'calls'       // service → service
  | 'reads'       // component → data store
  | 'writes'      // component → data store
  | 'extends'     // type hierarchy
  | 'custom';     // user-defined (type label in the trace name)

/**
 * A named, ordered, optionally-typed multi-hop path of cross-diagram links.
 *
 * Traces desugar to atomic CrossLink[]s at composition time.
 * The TraceRecord groups them under a name for consistent styling,
 * legend display, and agent addressability.
 */
export interface TraceRecord {
  /** Unique trace ID (auto-generated or author-specified). */
  readonly id: string;
  /** Human-readable name displayed in the legend. */
  readonly name: string;
  /** Optional semantic type governing the trace legend pill label. */
  readonly type?: TraceType;
  /**
   * Ordered hop endpoints. Length N produces N-1 atomic links:
   *   hops[0]→hops[1], hops[1]→hops[2], …, hops[N-2]→hops[N-1]
   */
  readonly hops: readonly NodeAddress[];
  /** Resolved colour assigned at composition time from the categorical palette. */
  readonly color?: Color;
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
