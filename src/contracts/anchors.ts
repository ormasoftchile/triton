/**
 * Anchors
 *
 * Contracts for the node-anchor registry: the mechanism that makes
 * individual nodes addressable from outside their parent diagram.
 *
 * Every linkable diagram's layout engine produces a NodeAnchorRegistry
 * alongside its Scene. The registry maps each node's logical ID to its
 * bounding box and optional cardinal ports, expressed in the diagram's
 * LOCAL coordinate space (before any composition-level translation/scaling).
 *
 * The composition layer (poster layout) transforms local anchors to
 * poster-space coordinates, merges registries from child cells with
 * path-prefixed keys, and publishes the merged result upward — enabling
 * cross-diagram linking at any nesting depth.
 *
 * Dependency: primitives.ts
 */

import type { Point, Rect } from './primitives.js';
import type { Scene } from './scene.js';

// ─── Cardinal Ports ───────────────────────────────────────────────────────────

/** The four cardinal attachment sides of a node bounding box. */
export type CardinalSide = 'N' | 'S' | 'E' | 'W';

/**
 * Explicit port positions on a node's boundary.
 * If absent, the link layer derives port midpoints from the bounding box:
 *   N = (x + w/2, y)
 *   S = (x + w/2, y + h)
 *   E = (x + w, y + h/2)
 *   W = (x, y + h/2)
 */
export type CardinalPorts = Partial<Record<CardinalSide, Point>>;

// ─── Node Anchor ──────────────────────────────────────────────────────────────

/**
 * Anchor for a single node: bounding box in local diagram coordinates,
 * plus optional explicit port attachment points.
 *
 * The bounding box is the axis-aligned rectangle that fully encloses
 * the node's visual representation (shape + label + padding).
 */
export interface NodeAnchor {
  /** Bounding box in local diagram coordinates. */
  readonly bounds: Rect;
  /**
   * Optional explicit port positions.
   * When present, cross-link routing uses these instead of deriving
   * midpoints from the bounding box edges.
   */
  readonly ports?: CardinalPorts;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Maps node IDs to their anchors in local diagram coordinates.
 *
 * For flat diagrams (flowchart, class, state, etc.):
 *   keys are the raw node IDs as authored: "pay", "db", "UserService"
 *
 * For hierarchical diagrams (poster with nested children):
 *   keys are dot-separated paths: "A1.pay", "B1.A1.db"
 *   Each level of nesting prepends the cell address.
 *
 * The registry is intentionally a plain Record for JSON serialisability
 * and O(1) lookup. Iteration order is not guaranteed.
 */
export type NodeAnchorRegistry = Readonly<Record<string, NodeAnchor>>;

// ─── Layout Result ────────────────────────────────────────────────────────────

// ─── Occupied Ports ──────────────────────────────────────────────────────────

/**
 * A port position on a node wall that is already in use by an edge rendered
 * within a diagram cell (intra) or by another cross-link (inter).
 *
 * The cross-link routing engine uses these to avoid stacking connectors
 * at the same wall position. Intra-diagram ports carry a softer penalty
 * than inter-crosslink ports so the global cost function can override them
 * when necessary.
 */
export interface OccupiedPort {
  /** Prefixed node key (same format as NodeAnchorRegistry keys). */
  readonly nodeKey: string;
  /** Which wall the port is on. */
  readonly wall: CardinalSide;
  /**
   * Fractional position along the wall (0 = start, 1 = end).
   * N/S walls: 0 = left edge, 1 = right edge.
   * E/W walls: 0 = top edge, 1 = bottom edge.
   */
  readonly t: number;
  /**
   * Origin of the occupancy.
   * 'intra' — edge produced by the cell's own diagram layout pass.
   * 'inter' — cross-link committed by the cross-link routing engine.
   */
  readonly source: 'intra' | 'inter';
}

/**
 * The extended return type of a diagram layout pass.
 *
 * All diagram layout engines return LayoutResult instead of bare Scene.
 * This carries the renderable scene AND the anchor registry for
 * cross-diagram linking.
 *
 * Non-linkable diagrams (pie, timeline, sankey, etc.) return an empty
 * registry {}. Links referencing their nodes degrade gracefully (WARN + skip).
 */
export interface LayoutResult {
  /** The fully resolved, renderable scene. */
  readonly scene: Scene;
  /**
   * Node anchors in local diagram coordinates.
   * Empty {} for non-linkable diagram types.
   */
  readonly anchors: NodeAnchorRegistry;
  /**
   * Port positions occupied by edges produced during this layout pass.
   * The cross-link routing engine uses these to avoid stacking connectors
   * on top of existing intra-diagram edges.
   * Empty or absent for non-linkable diagram types.
   */
  readonly occupiedPorts?: readonly OccupiedPort[];
  /**
   * Bounding boxes of internal diagram chrome (e.g. header bars, region
   * headers) that cross-link labels must avoid.  Reported in local diagram
   * coordinates; the composition layer scales + offsets them to poster space
   * before feeding them into the label de-collision pass.
   * Optional — diagrams that have no chrome that could occlude labels may
   * omit this field.
   */
  readonly chromeRects?: readonly Rect[];
}

/**
 * A soft layout constraint injected by the composition layer to bias
 * a node's placement toward a specific boundary edge.
 *
 * Port hints enable Phase 2 negotiation: when a cross-link route has
 * poor quality (crosses cells, excessive bends), the composition layer
 * re-invokes the child layout with hints, nudging connected nodes
 * toward the boundary facing their cross-link target.
 *
 * Hints are advisory — the layout engine should treat them as tie-breakers,
 * not hard constraints. A hint with strength 0 is ignored; strength 1
 * means "place this node as close to the specified side as possible
 * without violating internal graph constraints."
 */
export interface PortHint {
  /** The node ID to bias. */
  readonly nodeId: string;
  /** Which boundary edge to prefer. */
  readonly preferredSide: CardinalSide;
  /** Bias strength in [0, 1]. Default interpretation: 0 = ignore, 1 = maximum bias. */
  readonly strength: number;
}

/**
 * Optional layout constraints passed to a diagram layout engine
 * during negotiation rounds.
 *
 * The base layout() call receives no options (first pass).
 * Subsequent negotiation passes may include port hints derived from
 * cross-link quality analysis.
 */
export interface LayoutOptions {
  /** Port placement hints from the composition layer. */
  readonly portHints?: readonly PortHint[];
  /**
   * Loaded icon packs passed from the host layer.
   * Used by layout engines that support @icon node annotations (e.g. flowchart).
   * Core never touches the filesystem — the host builds this map and passes it in.
   */
  readonly icons?: import('./icons.js').IconPackMap;
}
