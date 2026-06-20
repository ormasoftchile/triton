/**
 * Routing
 *
 * Contracts for edge-path routing algorithms.
 *
 * Defines what routing algorithms accept and return.
 * All graph-based diagrams (flow, state, ER, class, …) use a common
 * routing contract so layout engines can swap algorithms without
 * changing their own interface.
 *
 * No routing logic lives here — only the shapes that implementations must satisfy.
 */

import type { Point, Rect } from './primitives.js';

// ─── Route Style ──────────────────────────────────────────────────────────────

/**
 * The geometric style of a computed route.
 *
 *   straight    — direct line from source to target.
 *   orthogonal  — axis-aligned segments (L/Z shape), routes around obstacles.
 *   bezier      — smooth cubic bezier curve.
 *   polyline    — straight segments between explicit waypoints.
 */
export type RouteStyle = 'straight' | 'orthogonal' | 'bezier' | 'polyline';

// ─── Routing Input ────────────────────────────────────────────────────────────

export interface RouteRequest {
  /** Source anchor point (center of source node edge). */
  readonly from: Point;
  /** Target anchor point (center of target node edge). */
  readonly to: Point;
  readonly style: RouteStyle;
  /** Bounding boxes of other nodes to route around. */
  readonly obstacles: ReadonlyArray<Rect>;
  /** Minimum clearance from obstacle edges in px. */
  readonly padding: number;
  /** Bezier only — curve tension in [0, 1]. Default 0.4. */
  readonly tension?: number;
}

// ─── Routing Output ───────────────────────────────────────────────────────────

export interface Route {
  /** Ordered waypoints from source to target, including endpoints. */
  readonly points: ReadonlyArray<Point>;
  /** Fully resolved SVG path data string, ready for a <path d="...">. */
  readonly path: string;
  /** Suggested position for an edge label — typically the route midpoint. */
  readonly labelPosition: Point;
}

// ─── Router Contract ──────────────────────────────────────────────────────────

/**
 * A routing algorithm must satisfy this interface.
 * Layout engines depend on this, not on a concrete implementation.
 */
export interface Router {
  route(request: RouteRequest): Route;
}
