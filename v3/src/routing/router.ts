import type { Router, RouteRequest, Route, RouteStyle } from '../contracts/index.js';
import type { Point } from '../contracts/index.js';

// ─── Straight ─────────────────────────────────────────────────────────────────

class StraightRouter implements Router {
  route({ from, to }: RouteRequest): Route {
    return {
      points: [from, to],
      path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      labelPosition: midpoint(from, to),
    };
  }
}

// ─── Orthogonal ───────────────────────────────────────────────────────────────

class OrthogonalRouter implements Router {
  route({ from, to }: RouteRequest): Route {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);

    let points: Point[];
    let path: string;

    if (dy >= dx) {
      // Mainly vertical — bend at mid-Y
      const v1: Point = { x: from.x, y: midY };
      const v2: Point = { x: to.x,   y: midY };
      points = [from, v1, v2, to];
      path   = `M ${from.x} ${from.y} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${to.x} ${to.y}`;
    } else {
      // Mainly horizontal — bend at mid-X
      const v1: Point = { x: midX, y: from.y };
      const v2: Point = { x: midX, y: to.y };
      points = [from, v1, v2, to];
      path   = `M ${from.x} ${from.y} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${to.x} ${to.y}`;
    }

    return { points, path, labelPosition: { x: midX, y: midY } };
  }
}

// ─── Bezier ───────────────────────────────────────────────────────────────────

class BezierRouter implements Router {
  route({ from, to, tension }: RouteRequest): Route {
    const t  = tension ?? 0.4;
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    let cp1: Point;
    let cp2: Point;

    if (Math.abs(dy) >= Math.abs(dx)) {
      // Vertical-dominant: control points extend along Y
      const pull = Math.abs(dy) * t;
      cp1 = { x: from.x, y: from.y + pull };
      cp2 = { x: to.x,   y: to.y   - pull };
    } else {
      // Horizontal-dominant: control points extend along X
      const pull = Math.abs(dx) * t;
      cp1 = { x: from.x + pull, y: from.y };
      cp2 = { x: to.x   - pull, y: to.y };
    }

    return {
      points: [from, cp1, cp2, to],
      path: `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y}`,
      labelPosition: midpoint(from, to),
    };
  }
}

// ─── Polyline ─────────────────────────────────────────────────────────────────
// Placeholder — routes straight until explicit waypoints are in RouteRequest.

class PolylineRouter implements Router {
  route(req: RouteRequest): Route {
    return new StraightRouter().route(req);
  }
}

// ─── Singleton Instances ──────────────────────────────────────────────────────

export const straightRouter: Router   = new StraightRouter();
export const orthogonalRouter: Router  = new OrthogonalRouter();
export const bezierRouter: Router      = new BezierRouter();
export const polylineRouter: Router    = new PolylineRouter();

// ─── Factory & Default ────────────────────────────────────────────────────────

/** Create (or look up) a router by style name. */
export function createRouter(style: RouteStyle): Router {
  switch (style) {
    case 'straight':    return straightRouter;
    case 'orthogonal':  return orthogonalRouter;
    case 'bezier':      return bezierRouter;
    case 'polyline':    return polylineRouter;
  }
}

/** Default router used by layout engines unless overridden. */
export const defaultRouter: Router = orthogonalRouter;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
