/**
 * Routing — Shared edge-routing algorithms.
 *
 * All graph-based diagram types (flow, state, ER, class, C4, etc.)
 * use these algorithms to compute edge paths between nodes.
 */

import type { Point, Rect } from '../scene/types.js';

// ─── Route Types ───────────────────────────────────────────────────────────────

export type RouteStyle = 'orthogonal' | 'polyline' | 'bezier' | 'straight';

export interface RouteOptions {
  style: RouteStyle;
  /** Obstacles to route around (other node bounding boxes) */
  obstacles: Rect[];
  /** Minimum clearance from obstacles (px) */
  padding: number;
  /** For bezier: curve tension (0-1) */
  tension?: number;
}

export interface Route {
  /** Ordered control/waypoints from source to target */
  points: Point[];
  /** SVG path data string */
  path: string;
  /** Label anchor point (midpoint of the route) */
  labelPosition: Point;
}

// ─── Routing Functions (stubs — to be implemented) ─────────────────────────────

/**
 * Compute a route between two anchor points, avoiding obstacles.
 */
export function computeRoute(
  from: Point,
  to: Point,
  options: RouteOptions,
): Route {
  // TODO: Implement proper routing algorithms.
  // For now, straight line as placeholder.
  switch (options.style) {
    case 'straight':
      return straightRoute(from, to);
    case 'orthogonal':
      return orthogonalRoute(from, to, options);
    case 'bezier':
      return bezierRoute(from, to, options);
    case 'polyline':
      return polylineRoute(from, to, options);
    default:
      return straightRoute(from, to);
  }
}

function straightRoute(from: Point, to: Point): Route {
  const mid: Point = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return {
    points: [from, to],
    path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
    labelPosition: mid,
  };
}

function orthogonalRoute(from: Point, to: Point, _options: RouteOptions): Route {
  // Simple L-shaped route (to be replaced with proper A* grid routing)
  const midX = (from.x + to.x) / 2;
  const points = [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  const path = `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
  return { points, path, labelPosition: { x: midX, y: (from.y + to.y) / 2 } };
}

function bezierRoute(from: Point, to: Point, options: RouteOptions): Route {
  const tension = options.tension ?? 0.4;
  const dx = (to.x - from.x) * tension;
  const cp1: Point = { x: from.x + dx, y: from.y };
  const cp2: Point = { x: to.x - dx, y: to.y };
  const mid: Point = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const path = `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
  return { points: [from, cp1, cp2, to], path, labelPosition: mid };
}

function polylineRoute(from: Point, to: Point, _options: RouteOptions): Route {
  // TODO: Implement visibility-graph or A* pathfinding
  return straightRoute(from, to);
}
