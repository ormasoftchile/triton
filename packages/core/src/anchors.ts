/**
 * @file anchors.ts — Node-Anchor Registry (§30b, Phase A)
 *
 * Defines the sidecar `NodeAnchorRegistry` returned alongside a `Scene` by
 * linkable grammar layout engines (flow, class, state — starter set).
 *
 * Coordinates are in the grammar's LOCAL cell coordinate space (before any
 * composition-level translation or scaling).  The composition layer transforms
 * them to poster space using each cell's `(dx, dy, scale)` from
 * `layoutCompositionFull`.
 *
 * Phase B (traces) builds directly on this type — no changes needed.
 */

// ---------------------------------------------------------------------------
// Cardinal side — port attachment side on a node bounding box
// ---------------------------------------------------------------------------

export type CardinalSide = 'N' | 'S' | 'E' | 'W';

// ---------------------------------------------------------------------------
// NodeAnchor — single-node bounding box + optional port attachment points
// ---------------------------------------------------------------------------

/**
 * Anchor for one node in LOCAL cell coordinates (before composition transform).
 *
 *  (x, y) ─── top-left corner of the bounding box
 *  (w, h) ─── box dimensions
 *
 * `ports` maps cardinal sides to explicit attachment points.  If absent the
 * link layer derives mid-side port centres from (x, y, w, h) at render time.
 */
export interface NodeAnchor {
  /** Diagram-local node id (mirrors the registry key; carried for convenience). */
  id: string;
  /** Bounding-box top-left x in local cell coordinates. */
  x: number;
  /** Bounding-box top-left y in local cell coordinates. */
  y: number;
  /** Bounding-box width. */
  w: number;
  /** Bounding-box height. */
  h: number;
  /** Optional explicit port attachment points (mid-side fallbacks used when absent). */
  ports?: Partial<Record<CardinalSide, { x: number; y: number }>>;
}

// ---------------------------------------------------------------------------
// NodeAnchorRegistry — the sidecar map
// ---------------------------------------------------------------------------

/**
 * Maps diagram-local node id → `NodeAnchor` in local cell coordinates.
 *
 * Grammars that opt in (flow, class, state) populate this from the placed-node
 * data they already own during layout — no additional computation required.
 *
 * Grammars that have NOT yet opted in return `{}`.  Links referencing their
 * nodes degrade gracefully: the link is skipped with a WARN.
 */
export type NodeAnchorRegistry = Record<string, NodeAnchor>;

// ---------------------------------------------------------------------------
// RenderResult — sidecar pattern used by linkable layout functions
// ---------------------------------------------------------------------------

/**
 * Extended result returned by linkable grammar layout functions.
 *
 * The `scene` field is byte-identical to the plain `Scene` returned previously
 * — the registry is purely additive metadata that does not affect rendering.
 */
export interface RenderWithAnchors<S> {
  scene: S;
  anchors: NodeAnchorRegistry;
}
