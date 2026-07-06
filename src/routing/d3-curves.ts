/**
 * d3-curves.ts — Routing path emission via d3-shape / d3-path.
 *
 * This adapter provides path-building helpers that delegate SVG path string
 * construction to d3-shape and d3-path. The routing logic (control-point
 * computation, obstacle avoidance) lives in router.ts; this module only
 * converts computed geometry into well-formed SVG path strings.
 */

import { line, curveLinear, curveCatmullRom, curveCardinal, curveBasis, curveNatural, curveMonotoneX, curveMonotoneY } from 'd3-shape';
import type { CurveFactory } from 'd3-shape';
import { path } from 'd3-path';
import type { Point, CurveStyle } from '../contracts/index.js';

/**
 * Build an SVG cubic-bezier path string from explicit control points.
 * Uses d3-path's `bezierCurveTo` to emit the C command.
 *
 * Output format: `M{x},{y}C{cx1},{cy1},{cx2},{cy2},{x},{y}`
 */
export function buildCubicBezierPath(
  from: Point,
  cp1: Point,
  cp2: Point,
  to: Point,
): string {
  const p = path();
  p.moveTo(from.x, from.y);
  p.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y);
  return p.toString();
}

/**
 * Build an SVG linear (polyline) path string through an ordered list of waypoints
 * using d3-shape's `line` generator.
 *
 * Output format: `M{x},{y}L{x},{y}...`
 */
export function buildLinePath(points: readonly Point[]): string {
  const gen = line<Point>()
    .x(d => d.x)
    .y(d => d.y);
  return gen([...points]) ?? '';
}

// ─── Named-curve dispatch ──────────────────────────────────────────────────────

const CURVE_FACTORIES: Record<CurveStyle, CurveFactory> = {
  'linear':      curveLinear,
  'catmull-rom': curveCatmullRom,
  'cardinal':    curveCardinal,
  'basis':       curveBasis,
  'natural':     curveNatural,
  'monotone-x':  curveMonotoneX,
  'monotone-y':  curveMonotoneY,
};

/**
 * Build an SVG path string through waypoints using the named d3-shape curve factory.
 *
 * Control-point computation lives in the caller; this function only governs
 * how those points are interpolated into an SVG path string.
 */
export function buildCurvedLinePath(
  points: readonly Point[],
  curveStyle: CurveStyle,
): string {
  const gen = line<Point>()
    .x(d => d.x)
    .y(d => d.y)
    .curve(CURVE_FACTORIES[curveStyle]);
  return gen([...points]) ?? '';
}
