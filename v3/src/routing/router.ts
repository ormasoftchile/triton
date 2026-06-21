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
        let bendX = clearVerticalBend(midX, from.y, to.y, from.x, to.x, obstacles, pad);
        bendX = clearHorizontalSegments(bendX, from, to, obstacles, pad);
        const v1: Point = { x: bendX, y: from.y };
        const v2: Point = { x: bendX, y: to.y };
        const hhPoints: Point[] = [from, v1, v2, to];

        // Verify the H+H route is clear; if not, try V+V with direction stubs
        if (obstacles && countRouteCollisions(hhPoints, obstacles) > 0) {
          const vvRoute = buildVVRouteWithStubs(from, to, fromDir!, toDir!, obstacles, pad);
          if (countRouteCollisions(vvRoute, obstacles) < countRouteCollisions(hhPoints, obstacles)) {
            points = vvRoute;
          } else {
            points = hhPoints;
          }
        } else {
          points = hhPoints;
        }
        path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      } else if (!exitH && !entryH) {
        // Both vertical — bend at midY, shifted to avoid obstacles
        let bendY = clearHorizontalBend(midY, from.x, to.x, from.y, to.y, obstacles, pad);
        bendY = clearVerticalSegments(bendY, from, to, obstacles, pad);
        const v1: Point = { x: from.x, y: bendY };
        const v2: Point = { x: to.x,   y: bendY };
        const vvPoints: Point[] = [from, v1, v2, to];

        // Verify the V+V route is clear; if not, try H+H with direction stubs
        if (obstacles && countRouteCollisions(vvPoints, obstacles) > 0) {
          const hhRoute = buildHHRouteWithStubs(from, to, fromDir!, toDir!, obstacles, pad);
          if (countRouteCollisions(hhRoute, obstacles) < countRouteCollisions(vvPoints, obstacles)) {
            points = hhRoute;
          } else {
            points = vvPoints;
          }
        } else {
          points = vvPoints;
        }
        path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
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

  // Iteratively shift until clear of all obstacles (max passes to avoid infinite loop)
  let shifted = bendX;
  for (let pass = 0; pass < obstacles.length; pass++) {
    let hit = false;
    for (const obs of obstacles) {
      const oLeft   = obs.x - pad;
      const oRight  = obs.x + obs.width + pad;
      const oTop    = obs.y;
      const oBottom = obs.y + obs.height;

      if (shifted > oLeft && shifted < oRight && yMax > oTop && yMin < oBottom) {
        const leftCandidate  = oLeft;
        const rightCandidate = oRight;
        const minX = Math.min(fromX, toX);
        const maxX = Math.max(fromX, toX);

        const leftValid  = leftCandidate >= minX;
        const rightValid = rightCandidate <= maxX;

        if (leftValid && rightValid) {
          shifted = (shifted - leftCandidate < rightCandidate - shifted)
            ? leftCandidate : rightCandidate;
        } else if (leftValid) {
          shifted = leftCandidate;
        } else if (rightValid) {
          shifted = rightCandidate;
        } else {
          shifted = (shifted - leftCandidate < rightCandidate - shifted)
            ? leftCandidate : rightCandidate;
        }
        hit = true;
        break; // re-check from start with new position
      }
    }
    if (!hit) break;
  }

  return shifted;
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

  // Iteratively shift until clear of all obstacles
  let shifted = bendY;
  for (let pass = 0; pass < obstacles.length; pass++) {
    let hit = false;
    for (const obs of obstacles) {
      const oTop    = obs.y - pad;
      const oBottom = obs.y + obs.height + pad;
      const oLeft   = obs.x;
      const oRight  = obs.x + obs.width;

      if (shifted > oTop && shifted < oBottom && xMax > oLeft && xMin < oRight) {
        const topCandidate    = oTop;
        const bottomCandidate = oBottom;
        const minY = Math.min(fromY, toY);
        const maxY = Math.max(fromY, toY);

        const topValid    = topCandidate >= minY;
        const bottomValid = bottomCandidate <= maxY;

        if (topValid && bottomValid) {
          shifted = (shifted - topCandidate < bottomCandidate - shifted)
            ? topCandidate : bottomCandidate;
        } else if (topValid) {
          shifted = topCandidate;
        } else if (bottomValid) {
          shifted = bottomCandidate;
        } else {
          shifted = (shifted - topCandidate < bottomCandidate - shifted)
            ? topCandidate : bottomCandidate;
        }
        hit = true;
        break; // re-check from start with new position
      }
    }
    if (!hit) break;
  }

  return shifted;
}

/**
 * After placing a vertical bend at bendX for an H→V→H route (from→(bendX, from.y)→(bendX, to.y)→to),
 * verify that the two horizontal segments don't cross obstacles. If they do, shift bendX
 * so it's on the target/source side of the obstacle.
 * If conflicting (fixing one breaks the other), push bendX outside all obstacles.
 */
function clearHorizontalSegments(
  bendX: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect> | undefined,
  pad: number,
): number {
  if (!obstacles || obstacles.length === 0) return bendX;

  let shifted = bendX;
  let prevShifted = NaN;
  for (let pass = 0; pass < obstacles.length * 2; pass++) {
    // Detect oscillation (conflicting constraints)
    if (shifted === prevShifted) break;
    prevShifted = shifted;

    let hit = false;
    for (const obs of obstacles) {
      // Check last horizontal: shifted → to.x at y=to.y
      if (segCrossesInterior({ x: shifted, y: to.y }, { x: to.x, y: to.y }, obs, pad)) {
        shifted = (to.x < obs.x) ? obs.x - pad : obs.x + obs.width + pad;
        hit = true;
        break;
      }

      // Check first horizontal: from.x → shifted at y=from.y
      if (segCrossesInterior({ x: from.x, y: from.y }, { x: shifted, y: from.y }, obs, pad)) {
        shifted = (from.x < obs.x) ? obs.x - pad : obs.x + obs.width + pad;
        hit = true;
        break;
      }
    }
    if (!hit) break;
  }

  // Final verification — if still colliding, push outside all obstacles
  const stillCollides = obstacles.some(obs =>
    segCrossesInterior({ x: shifted, y: to.y }, { x: to.x, y: to.y }, obs, pad) ||
    segCrossesInterior({ x: from.x, y: from.y }, { x: shifted, y: from.y }, obs, pad),
  );
  if (stillCollides) {
    // Compute the leftmost and rightmost obstacle edges
    let globalLeft = Infinity, globalRight = -Infinity;
    for (const obs of obstacles) {
      globalLeft = Math.min(globalLeft, obs.x - pad);
      globalRight = Math.max(globalRight, obs.x + obs.width + pad);
    }
    // Push to whichever side is closer to the target
    const leftDist = Math.abs(to.x - globalLeft) + Math.abs(from.x - globalLeft);
    const rightDist = Math.abs(to.x - globalRight) + Math.abs(from.x - globalRight);
    shifted = leftDist < rightDist ? globalLeft : globalRight;
  }

  return shifted;
}

/**
 * After placing a horizontal bend at bendY for a V→H→V route (from→(from.x, bendY)→(to.x, bendY)→to),
 * verify that the two vertical segments don't cross obstacles. If they do, shift bendY.
 * If conflicting, push outside all obstacles.
 */
function clearVerticalSegments(
  bendY: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect> | undefined,
  pad: number,
): number {
  if (!obstacles || obstacles.length === 0) return bendY;

  let shifted = bendY;
  let prevShifted = NaN;
  for (let pass = 0; pass < obstacles.length * 2; pass++) {
    if (shifted === prevShifted) break;
    prevShifted = shifted;

    let hit = false;
    for (const obs of obstacles) {
      if (segCrossesInterior({ x: to.x, y: shifted }, { x: to.x, y: to.y }, obs, pad)) {
        shifted = (to.y < obs.y) ? obs.y - pad : obs.y + obs.height + pad;
        hit = true;
        break;
      }
      if (segCrossesInterior({ x: from.x, y: from.y }, { x: from.x, y: shifted }, obs, pad)) {
        shifted = (from.y < obs.y) ? obs.y - pad : obs.y + obs.height + pad;
        hit = true;
        break;
      }
    }
    if (!hit) break;
  }

  // Final verification
  const stillCollides = obstacles.some(obs =>
    segCrossesInterior({ x: to.x, y: shifted }, { x: to.x, y: to.y }, obs, pad) ||
    segCrossesInterior({ x: from.x, y: from.y }, { x: from.x, y: shifted }, obs, pad),
  );
  if (stillCollides) {
    let globalTop = Infinity, globalBottom = -Infinity;
    for (const obs of obstacles) {
      globalTop = Math.min(globalTop, obs.y - pad);
      globalBottom = Math.max(globalBottom, obs.y + obs.height + pad);
    }
    const topDist = Math.abs(to.y - globalTop) + Math.abs(from.y - globalTop);
    const bottomDist = Math.abs(to.y - globalBottom) + Math.abs(from.y - globalBottom);
    shifted = topDist < bottomDist ? globalTop : globalBottom;
  }

  return shifted;
}

/** Test if segment p1→p2 crosses the strict interior of obs (boundary touches don't count). */
function segCrossesInterior(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  obs: import('../contracts/index.js').Rect,
  _pad: number,
): boolean {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const xmin = obs.x, xmax = obs.x + obs.width;
  const ymin = obs.y, ymax = obs.y + obs.height;
  let tmin = 0, tmax = 1;
  const edges = [
    { p: -dx, q: p1.x - xmin },
    { p:  dx, q: xmax - p1.x },
    { p: -dy, q: p1.y - ymin },
    { p:  dy, q: ymax - p1.y },
  ];
  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-10) {
      // Parallel: segment must be strictly inside (not on boundary) to count
      if (q <= 0) return false;
    } else {
      const t = q / p;
      if (p < 0) tmin = Math.max(tmin, t);
      else tmax = Math.min(tmax, t);
      if (tmin > tmax) return false;
    }
  }
  return tmin < tmax; // strict interior crossing only
}

/** Count total segment-obstacle collisions along a polyline route. */
function countRouteCollisions(
  points: readonly Point[],
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
): number {
  let count = 0;
  for (let i = 0; i < points.length - 1; i++) {
    for (const obs of obstacles) {
      if (segCrossesInterior(points[i]!, points[i + 1]!, obs, 0)) count++;
    }
  }
  return count;
}

/** Build a V→H→V route (vertical-first) with obstacle avoidance. */
function buildVVRoute(
  from: Point, to: Point,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
): Point[] {
  const midY = (from.y + to.y) / 2;
  let bendY = clearHorizontalBend(midY, from.x, to.x, from.y, to.y, obstacles, pad);
  bendY = clearVerticalSegments(bendY, from, to, obstacles, pad);
  return [from, { x: from.x, y: bendY }, { x: to.x, y: bendY }, to];
}

/** Build an H→V→H route (horizontal-first) with obstacle avoidance. */
function buildHHRoute(
  from: Point, to: Point,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
): Point[] {
  const midX = (from.x + to.x) / 2;
  let bendX = clearVerticalBend(midX, from.y, to.y, from.x, to.x, obstacles, pad);
  bendX = clearHorizontalSegments(bendX, from, to, obstacles, pad);
  return [from, { x: bendX, y: from.y }, { x: bendX, y: to.y }, to];
}

/**
 * Build a V+V fallback route that honours H exit/entry port directions.
 * Adds short horizontal stubs at start/end, then routes V→H→V in between.
 * Route shape: from → stub1 → (stub1.x, bendY) → (stub2.x, bendY) → stub2 → to
 */
function buildVVRouteWithStubs(
  from: Point, to: Point,
  fromDir: PortDirection, toDir: PortDirection,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
): Point[] {
  // Stub must be long enough to look intentional (at least 24px)
  const stubLen = Math.max(pad, 24);
  const stub1: Point = {
    x: from.x + (fromDir === 'W' ? -stubLen : fromDir === 'E' ? stubLen : 0),
    y: from.y + (fromDir === 'N' ? -stubLen : fromDir === 'S' ? stubLen : 0),
  };
  const stub2: Point = {
    x: to.x + (toDir === 'W' ? -stubLen : toDir === 'E' ? stubLen : 0),
    y: to.y + (toDir === 'N' ? -stubLen : toDir === 'S' ? stubLen : 0),
  };

  // Route V+V between the stubs
  const midY = (stub1.y + stub2.y) / 2;
  let bendY = clearHorizontalBend(midY, stub1.x, stub2.x, stub1.y, stub2.y, obstacles, pad);
  bendY = clearVerticalSegments(bendY, stub1, stub2, obstacles, pad);

  return [from, stub1, { x: stub1.x, y: bendY }, { x: stub2.x, y: bendY }, stub2, to];
}

/**
 * Build an H+H fallback route that honours V exit/entry port directions.
 * Adds short vertical stubs at start/end, then routes H→V→H in between.
 */
function buildHHRouteWithStubs(
  from: Point, to: Point,
  fromDir: PortDirection, toDir: PortDirection,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
): Point[] {
  const stubLen = Math.max(pad, 24);
  const stub1: Point = {
    x: from.x + (fromDir === 'W' ? -stubLen : fromDir === 'E' ? stubLen : 0),
    y: from.y + (fromDir === 'N' ? -stubLen : fromDir === 'S' ? stubLen : 0),
  };
  const stub2: Point = {
    x: to.x + (toDir === 'W' ? -stubLen : toDir === 'E' ? stubLen : 0),
    y: to.y + (toDir === 'N' ? -stubLen : toDir === 'S' ? stubLen : 0),
  };

  const midX = (stub1.x + stub2.x) / 2;
  let bendX = clearVerticalBend(midX, stub1.y, stub2.y, stub1.x, stub2.x, obstacles, pad);
  bendX = clearHorizontalSegments(bendX, stub1, stub2, obstacles, pad);

  return [from, stub1, { x: bendX, y: stub1.y }, { x: bendX, y: stub2.y }, stub2, to];
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
