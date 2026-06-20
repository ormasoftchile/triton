import type { Router, RouteRequest, Route, RouteStyle, PortDirection } from '../contracts/index.js';
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
  route({ from, to, fromDir, toDir, obstacles, padding }: RouteRequest): Route {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const pad = padding ?? 12;

    // Already aligned on one axis — straight line
    if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
      return {
        points: [from, to],
        path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
        labelPosition: { x: midX, y: midY },
      };
    }

    // With port direction hints, route so the first segment leaves in
    // fromDir and the last segment arrives along toDir.
    if (fromDir && toDir) {
      const exitH = fromDir === 'E' || fromDir === 'W';
      const entryH = toDir === 'E' || toDir === 'W';

      let points: Point[];
      let path: string;

      if (exitH && entryH) {
        // Both horizontal — bend at midX, shifted to avoid obstacles
        const bendX = clearVerticalBend(midX, from.y, to.y, from.x, to.x, obstacles, pad);
        const v1: Point = { x: bendX, y: from.y };
        const v2: Point = { x: bendX, y: to.y };
        points = [from, v1, v2, to];
        path = `M ${from.x} ${from.y} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${to.x} ${to.y}`;
      } else if (!exitH && !entryH) {
        // Both vertical — bend at midY, shifted to avoid obstacles
        const bendY = clearHorizontalBend(midY, from.x, to.x, from.y, to.y, obstacles, pad);
        const v1: Point = { x: from.x, y: bendY };
        const v2: Point = { x: to.x,   y: bendY };
        points = [from, v1, v2, to];
        path = `M ${from.x} ${from.y} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${to.x} ${to.y}`;
      } else if (exitH && !entryH) {
        // Exit horizontal, enter vertical — single bend
        const corner: Point = { x: to.x, y: from.y };
        points = [from, corner, to];
        path = `M ${from.x} ${from.y} L ${corner.x} ${corner.y} L ${to.x} ${to.y}`;
      } else {
        // Exit vertical, enter horizontal — single bend
        const corner: Point = { x: from.x, y: to.y };
        points = [from, corner, to];
        path = `M ${from.x} ${from.y} L ${corner.x} ${corner.y} L ${to.x} ${to.y}`;
      }

      return { points, path, labelPosition: { x: midX, y: midY } };
    }

    // Fallback: no direction hints — heuristic based on geometry
    let points: Point[];
    let path: string;

    if (Math.abs(dy) >= Math.abs(dx)) {
      // Mainly vertical — bend at mid-Y
      const bendY = clearHorizontalBend(midY, from.x, to.x, from.y, to.y, obstacles, pad);
      const v1: Point = { x: from.x, y: bendY };
      const v2: Point = { x: to.x,   y: bendY };
      points = [from, v1, v2, to];
      path   = `M ${from.x} ${from.y} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${to.x} ${to.y}`;
    } else {
      // Mainly horizontal — bend at mid-X
      const bendX = clearVerticalBend(midX, from.y, to.y, from.x, to.x, obstacles, pad);
      const v1: Point = { x: bendX, y: from.y };
      const v2: Point = { x: bendX, y: to.y };
      points = [from, v1, v2, to];
      path   = `M ${from.x} ${from.y} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${to.x} ${to.y}`;
    }

    return { points, path, labelPosition: { x: midX, y: midY } };
  }
}

/**
 * Shift a vertical bend line (at x=bendX, spanning yMin–yMax) to avoid obstacles.
 * Returns the original bendX if it doesn't intersect anything, otherwise shifts
 * to the nearest clear side of all intersecting obstacles.
 */
function clearVerticalBend(
  bendX: number, y1: number, y2: number,
  fromX: number, toX: number,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
): number {
  if (!obstacles || obstacles.length === 0) return bendX;

  const yMin = Math.min(y1, y2);
  const yMax = Math.max(y1, y2);

  for (const obs of obstacles) {
    const oLeft   = obs.x - pad;
    const oRight  = obs.x + obs.width + pad;
    const oTop    = obs.y;
    const oBottom = obs.y + obs.height;

    // Does the vertical segment at bendX intersect this obstacle?
    if (bendX > oLeft && bendX < oRight && yMax > oTop && yMin < oBottom) {
      // Shift to the nearest clear side, staying between from and to
      const leftCandidate  = oLeft;
      const rightCandidate = oRight;
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);

      // Prefer the side that stays between the endpoints
      const leftValid  = leftCandidate >= minX;
      const rightValid = rightCandidate <= maxX;

      if (leftValid && rightValid) {
        // Both valid — pick the closer one
        return (bendX - leftCandidate < rightCandidate - bendX)
          ? leftCandidate : rightCandidate;
      }
      if (leftValid) return leftCandidate;
      if (rightValid) return rightCandidate;
      // Neither stays between endpoints — pick the closer one anyway
      return (bendX - leftCandidate < rightCandidate - bendX)
        ? leftCandidate : rightCandidate;
    }
  }

  return bendX;
}

/**
 * Shift a horizontal bend line (at y=bendY, spanning xMin–xMax) to avoid obstacles.
 */
function clearHorizontalBend(
  bendY: number, x1: number, x2: number,
  fromY: number, toY: number,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
): number {
  if (!obstacles || obstacles.length === 0) return bendY;

  const xMin = Math.min(x1, x2);
  const xMax = Math.max(x1, x2);

  for (const obs of obstacles) {
    const oTop    = obs.y - pad;
    const oBottom = obs.y + obs.height + pad;
    const oLeft   = obs.x;
    const oRight  = obs.x + obs.width;

    // Does the horizontal segment at bendY intersect this obstacle?
    if (bendY > oTop && bendY < oBottom && xMax > oLeft && xMin < oRight) {
      const topCandidate    = oTop;
      const bottomCandidate = oBottom;
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);

      const topValid    = topCandidate >= minY;
      const bottomValid = bottomCandidate <= maxY;

      if (topValid && bottomValid) {
        return (bendY - topCandidate < bottomCandidate - bendY)
          ? topCandidate : bottomCandidate;
      }
      if (topValid) return topCandidate;
      if (bottomValid) return bottomCandidate;
      return (bendY - topCandidate < bottomCandidate - bendY)
        ? topCandidate : bottomCandidate;
    }
  }

  return bendY;
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
