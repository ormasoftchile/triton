import type { Router, RouteRequest, Route, RouteStyle, PortDirection } from '../contracts/index.js';
import type { Point, Rect } from '../contracts/index.js';

// ─── Straight ─────────────────────────────────────────────────────────────────

class StraightRouter implements Router {
  route({ from, to, obstacles, padding }: RouteRequest): Route {
    const pad = padding ?? 12;

    // If no obstacles or no crossing, use a direct line
    if (!obstacles || obstacles.length === 0 ||
        !straightHitsObstacles(from, to, obstacles, pad)) {
      return {
        points: [from, to],
        path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
        labelPosition: midpoint(from, to),
      };
    }

    // Deflect: find a waypoint that avoids all obstacles.
    // Try perpendicular offsets of increasing magnitude in both directions.
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      return { points: [from, to], path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`, labelPosition: from };
    }

    const perpX = -dy / len, perpY = dx / len;
    const mid = midpoint(from, to);

    for (let offset = len * 0.1; offset <= len * 0.6; offset += len * 0.1) {
      for (const sign of [1, -1]) {
        const wp: Point = { x: mid.x + perpX * offset * sign, y: mid.y + perpY * offset * sign };
        if (!straightHitsObstacles(from, wp, obstacles, pad) &&
            !straightHitsObstacles(wp, to, obstacles, pad)) {
          return {
            points: [from, wp, to],
            path: `M ${from.x} ${from.y} L ${wp.x} ${wp.y} L ${to.x} ${to.y}`,
            labelPosition: wp,
          };
        }
      }
    }

    // Fallback: direct line (best effort)
    return {
      points: [from, to],
      path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      labelPosition: midpoint(from, to),
    };
  }
}

/** Check if a straight line from→to passes through any obstacle interior. */
function straightHitsObstacles(
  from: Point, to: Point,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
): boolean {
  for (const obs of obstacles) {
    if (segCrossesInterior(from, to, {
      x: obs.x - pad, y: obs.y - pad,
      width: obs.width + 2 * pad, height: obs.height + 2 * pad,
    }, 0)) {
      return true;
    }
  }
  return false;
}

// ─── Orthogonal ───────────────────────────────────────────────────────────────

class OrthogonalRouter implements Router {
  route({ from, to, fromDir, toDir, obstacles, padding }: RouteRequest): Route {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const pad = padding ?? 12;
    // Minimum straight "landing" run before an arrowhead / after an exit port,
    // so a same-wall detour never places the arrowhead directly on a bend.
    const STUB = Math.max(pad, 20);

    // Already aligned on one axis — straight line. But only shortcut when the
    // segment actually leaves the source along its wall normal, approaches the
    // target from that wall's outboard side, and crosses no obstacles.
    const straightH = Math.abs(dy) < 1;   // horizontal straight line
    const straightV = Math.abs(dx) < 1;   // vertical straight line
    if (straightH || straightV) {
      const dirsOk = straightDirsOk(from, to, straightH, straightV, fromDir, toDir);
      const clear = !obstacles || countRouteCollisions([from, to], obstacles) === 0;
      if (dirsOk && clear) {
        return {
          points: [from, to],
          path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
          labelPosition: { x: midX, y: midY },
        };
      }
    }

    // With port direction hints, route so the first segment leaves in
    // fromDir and the last segment arrives along toDir.
    if (fromDir && toDir) {
      const exitH = fromDir === 'E' || fromDir === 'W';
      const entryH = toDir === 'E' || toDir === 'W';

      let points: Point[];
      let path: string;

      if (exitH && entryH) {
        // Both horizontal — bend at midX, shifted to avoid obstacles.
        // For a same-wall pair (both E or both W) the two stubs point the same
        // way, so the connecting segment must sit OUTSIDE both ports, otherwise
        // the route collapses back onto the wall.
        const sameWall = fromDir === toDir;
        const baseX =
          sameWall
            ? fromDir === 'E'
              ? Math.max(from.x, to.x) + STUB
              : Math.min(from.x, to.x) - STUB
            : midX;
        let bendX: number;
        if (sameWall) {
          // The connecting channel must stay OUTBOARD of the shared wall. The
          // generic avoidance keeps the bend within the port x-range, which for
          // a same-wall pair pulls it to the INBOARD side — driving the landing
          // segment straight through the target box to reach the far wall
          // ("behind the target"). Only ever shift the channel further outboard.
          bendX = clearBendXOutboard(baseX, from, to, obstacles, pad, fromDir === 'E' ? 1 : -1);
        } else {
          bendX = clearVerticalBend(baseX, from.y, to.y, from.x, to.x, obstacles, pad);
          bendX = clearHorizontalSegments(bendX, from, to, obstacles, pad);
        }
        const v1: Point = { x: bendX, y: from.y };
        const v2: Point = { x: bendX, y: to.y };
        let hhPoints: Point[] = [from, v1, v2, to];
        if (sameWall && obstacles && routeHitsEndpointObstacle(hhPoints, from, to, obstacles)) {
          hhPoints = buildSameHorizontalWallRoute(from, to, fromDir, obstacles, pad, STUB);
        }

        // Verify the H+H route is clear; if not, try V+V with direction stubs.
        // Skip the fallback for same-wall pairs: the outboard H+H route is the
        // one that honours the wall hint without crossing the target, so we keep
        // it even if it grazes other cells.
        if (!sameWall && obstacles && countRouteCollisions(hhPoints, obstacles) > 0) {
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
        // Both vertical — bend at midY, shifted to avoid obstacles.
        // For a same-wall pair (both N or both S) push the connecting segment
        // OUTSIDE both ports so the route arcs over/under the nodes.
        const sameWall = fromDir === toDir;
        const baseY =
          sameWall
            ? fromDir === 'S'
              ? Math.max(from.y, to.y) + STUB
              : Math.min(from.y, to.y) - STUB
            : midY;
        let bendY: number;
        if (sameWall) {
          // Same reasoning as the horizontal case: keep the connecting channel
          // outboard of the shared wall so the landing segment never passes
          // through the target box.
          bendY = clearBendYOutboard(baseY, from, to, obstacles, pad, fromDir === 'S' ? 1 : -1);
        } else {
          bendY = clearHorizontalBend(baseY, from.x, to.x, from.y, to.y, obstacles, pad);
          bendY = clearVerticalSegments(bendY, from, to, obstacles, pad);
        }
        const v1: Point = { x: from.x, y: bendY };
        const v2: Point = { x: to.x,   y: bendY };
        let vvPoints: Point[] = [from, v1, v2, to];
        if (sameWall && obstacles && routeHitsEndpointObstacle(vvPoints, from, to, obstacles)) {
          vvPoints = buildSameVerticalWallRoute(from, to, fromDir, obstacles, pad, STUB);
        }

        // Verify the V+V route is clear; if not, try H+H with direction stubs.
        // Same-wall pairs keep their outboard V+V route (see horizontal case).
        if (!sameWall && obstacles && countRouteCollisions(vvPoints, obstacles) > 0) {
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
 * Clear a same-wall vertical bend channel by shifting it ONLY further outboard
 * (in `dir`: -1 = west, +1 = east). Unlike clearVerticalBend, this never pulls
 * the channel back toward the ports — for a same-wall pair the inboard side is
 * across the target box, so an inboard shift would route the landing segment
 * "behind the target". The channel and both horizontal stubs are checked; on a
 * hit the channel jumps past the obstacle's outboard edge.
 */
function clearBendXOutboard(
  baseX: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect> | undefined,
  pad: number,
  dir: number,
): number {
  if (!obstacles || obstacles.length === 0) return baseX;
  let x = baseX;
  const yMin = Math.min(from.y, to.y);
  const yMax = Math.max(from.y, to.y);
  for (let pass = 0; pass < obstacles.length * 2 + 2; pass++) {
    let moved = false;
    for (const obs of obstacles) {
      const oLeft   = obs.x - pad;
      const oRight  = obs.x + obs.width + pad;
      const oTop    = obs.y;
      const oBottom = obs.y + obs.height;
      const vHits = x > oLeft && x < oRight && yMax > oTop && yMin < oBottom;
      const hHitTo   = segCrossesInterior({ x, y: to.y },   { x: to.x,   y: to.y   }, obs, pad);
      const hHitFrom = segCrossesInterior({ x: from.x, y: from.y }, { x, y: from.y }, obs, pad);
      if (vHits || hHitTo || hHitFrom) {
        const edge = dir < 0 ? oLeft : oRight;
        if ((dir < 0 && edge < x) || (dir > 0 && edge > x)) {
          x = edge;
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }
  return x;
}

/**
 * Vertical-wall analogue of clearBendXOutboard: shift a same-wall horizontal
 * bend line only further outboard (dir: -1 = north, +1 = south).
 */
function clearBendYOutboard(
  baseY: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect> | undefined,
  pad: number,
  dir: number,
): number {
  if (!obstacles || obstacles.length === 0) return baseY;
  let y = baseY;
  const xMin = Math.min(from.x, to.x);
  const xMax = Math.max(from.x, to.x);
  for (let pass = 0; pass < obstacles.length * 2 + 2; pass++) {
    let moved = false;
    for (const obs of obstacles) {
      const oTop    = obs.y - pad;
      const oBottom = obs.y + obs.height + pad;
      const oLeft   = obs.x;
      const oRight  = obs.x + obs.width;
      const hHits = y > oTop && y < oBottom && xMax > oLeft && xMin < oRight;
      const vHitTo   = segCrossesInterior({ x: to.x,   y },        { x: to.x,   y: to.y   }, obs, pad);
      const vHitFrom = segCrossesInterior({ x: from.x, y: from.y }, { x: from.x, y },        obs, pad);
      if (hHits || vHitTo || vHitFrom) {
        const edge = dir < 0 ? oTop : oBottom;
        if ((dir < 0 && edge < y) || (dir > 0 && edge > y)) {
          y = edge;
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }
  return y;
}

function straightDirsOk(
  from: Point,
  to: Point,
  straightH: boolean,
  straightV: boolean,
  fromDir?: PortDirection,
  toDir?: PortDirection,
): boolean {
  if (!fromDir && !toDir) return true;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (straightH && Math.abs(dx) < 1) return true;

  let requiredFrom: PortDirection;
  let requiredTo: PortDirection;
  if (straightH) {
    requiredFrom = dx > 0 ? 'E' : 'W';
    requiredTo = dx > 0 ? 'W' : 'E';
  } else if (straightV) {
    requiredFrom = dy > 0 ? 'S' : 'N';
    requiredTo = dy > 0 ? 'N' : 'S';
  } else {
    return false;
  }

  return (!fromDir || fromDir === requiredFrom) && (!toDir || toDir === requiredTo);
}

function buildSameVerticalWallRoute(
  from: Point,
  to: Point,
  wall: PortDirection,
  obstacles: ReadonlyArray<Rect>,
  pad: number,
  stub: number,
): Point[] {
  const dir = wall === 'S' ? 1 : -1;
  const fromOut: Point = { x: from.x, y: from.y + dir * stub };
  const toOut: Point = { x: to.x, y: to.y + dir * stub };
  const colliders = collidingObstacles([from, fromOut, { x: to.x, y: fromOut.y }, to], obstacles);
  const relevant = colliders.length > 0 ? colliders : obstacles;
  const leftX = Math.min(...relevant.map(o => o.x - pad));
  const rightX = Math.max(...relevant.map(o => o.x + o.width + pad));
  return bestSameVerticalCandidate(from, to, fromOut, toOut, [leftX, rightX], obstacles);
}

function buildSameHorizontalWallRoute(
  from: Point,
  to: Point,
  wall: PortDirection,
  obstacles: ReadonlyArray<Rect>,
  pad: number,
  stub: number,
): Point[] {
  const dir = wall === 'E' ? 1 : -1;
  const fromOut: Point = { x: from.x + dir * stub, y: from.y };
  const toOut: Point = { x: to.x + dir * stub, y: to.y };
  const colliders = collidingObstacles([from, fromOut, { x: fromOut.x, y: to.y }, to], obstacles);
  const relevant = colliders.length > 0 ? colliders : obstacles;
  const topY = Math.min(...relevant.map(o => o.y - pad));
  const bottomY = Math.max(...relevant.map(o => o.y + o.height + pad));
  return bestSameHorizontalCandidate(from, to, fromOut, toOut, [topY, bottomY], obstacles);
}

function bestSameVerticalCandidate(
  from: Point,
  to: Point,
  fromOut: Point,
  toOut: Point,
  escapeXs: readonly number[],
  obstacles: ReadonlyArray<Rect>,
): Point[] {
  let best: Point[] | undefined;
  let bestCost = Infinity;
  for (const escapeX of escapeXs) {
    const candidate = [
      from,
      fromOut,
      { x: escapeX, y: fromOut.y },
      { x: escapeX, y: toOut.y },
      toOut,
      to,
    ];
    const cost = countRouteCollisions(candidate, obstacles) * 1_000_000 + polylineLength(candidate);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
    }
  }
  return best!;
}

function bestSameHorizontalCandidate(
  from: Point,
  to: Point,
  fromOut: Point,
  toOut: Point,
  escapeYs: readonly number[],
  obstacles: ReadonlyArray<Rect>,
): Point[] {
  let best: Point[] | undefined;
  let bestCost = Infinity;
  for (const escapeY of escapeYs) {
    const candidate = [
      from,
      fromOut,
      { x: fromOut.x, y: escapeY },
      { x: toOut.x, y: escapeY },
      toOut,
      to,
    ];
    const cost = countRouteCollisions(candidate, obstacles) * 1_000_000 + polylineLength(candidate);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
    }
  }
  return best!;
}

function collidingObstacles(points: readonly Point[], obstacles: ReadonlyArray<Rect>): Rect[] {
  return obstacles.filter(obs => {
    for (let i = 0; i < points.length - 1; i++) {
      if (segCrossesInterior(points[i]!, points[i + 1]!, obs, 0)) return true;
    }
    return false;
  });
}

function routeHitsEndpointObstacle(
  points: readonly Point[],
  from: Point,
  to: Point,
  obstacles: ReadonlyArray<Rect>,
): boolean {
  return collidingObstacles(points, obstacles).some(obs =>
    pointOnRectBoundary(from, obs) || pointOnRectBoundary(to, obs),
  );
}

function pointOnRectBoundary(p: Point, r: Rect): boolean {
  const eps = 1e-6;
  const onVertical = (Math.abs(p.x - r.x) < eps || Math.abs(p.x - (r.x + r.width)) < eps) &&
    p.y >= r.y - eps && p.y <= r.y + r.height + eps;
  const onHorizontal = (Math.abs(p.y - r.y) < eps || Math.abs(p.y - (r.y + r.height)) < eps) &&
    p.x >= r.x - eps && p.x <= r.x + r.width + eps;
  return onVertical || onHorizontal;
}

function polylineLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }
  return len;
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
export function countRouteCollisions(
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
  route({ from, to, tension, obstacles, padding }: RouteRequest): Route {
    const t  = tension ?? 0.4;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const pad = padding ?? 12;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Cap the control point pull to avoid exaggerated arcs on long routes.
    // Pull scales with distance but is clamped to a sensible maximum.
    const MAX_PULL = 150;

    let cp1: Point;
    let cp2: Point;

    if (Math.abs(dy) >= Math.abs(dx)) {
      const pull = Math.min(Math.abs(dy) * t, MAX_PULL);
      cp1 = { x: from.x, y: from.y + (dy >= 0 ? pull : -pull) };
      cp2 = { x: to.x,   y: to.y   + (dy >= 0 ? -pull : pull) };
    } else {
      const pull = Math.min(Math.abs(dx) * t, MAX_PULL);
      cp1 = { x: from.x + (dx >= 0 ? pull : -pull), y: from.y };
      cp2 = { x: to.x   + (dx >= 0 ? -pull : pull), y: to.y };
    }

    // Check for obstacle collisions and adjust control points if needed
    if (obstacles && obstacles.length > 0) {
      const adjusted = avoidObstaclesBezier(from, to, cp1, cp2, obstacles, pad, t);
      cp1 = adjusted.cp1;
      cp2 = adjusted.cp2;
    }

    return {
      points: [from, cp1, cp2, to],
      path: `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y}`,
      labelPosition: midpoint(from, to),
    };
  }
}

/**
 * Adjust bezier control points to avoid obstacles.
 *
 * Strategy: sample the curve and check for obstacle hits.
 * If the default curve collides, try offsetting control points
 * perpendicular to the from→to axis in both directions.
 * Pick the direction with fewer collisions. If both still collide,
 * increase the perpendicular offset until clear (up to a limit).
 */
function avoidObstaclesBezier(
  from: Point, to: Point,
  cp1: Point, cp2: Point,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number,
  tension: number,
): { cp1: Point; cp2: Point } {
  const SAMPLES = 16;

  // Check if default curve hits any obstacle
  if (!bezierHitsObstacles(from, cp1, cp2, to, obstacles, pad, SAMPLES)) {
    return { cp1, cp2 };
  }

  // Perpendicular to from→to
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { cp1, cp2 };
  const perpX = -dy / len;
  const perpY = dx / len;

  // The from→to midpoint — prefer curves that stay close to this
  const mid = midpoint(from, to);

  // Try increasing perpendicular offsets; at each step, try BOTH directions
  // and prefer the one whose curve stays closer to the from→to midpoint (inner arc).
  // Cap maximum offset to avoid pushing curves far outside the content area.
  const MAX_OFFSET = Math.min(len * 0.5, 80);
  for (let offset = len * 0.1; offset <= MAX_OFFSET; offset += len * 0.1) {
    const cp1p: Point = { x: cp1.x + perpX * offset, y: cp1.y + perpY * offset };
    const cp2p: Point = { x: cp2.x + perpX * offset, y: cp2.y + perpY * offset };
    const clearP = !bezierHitsObstacles(from, cp1p, cp2p, to, obstacles, pad, SAMPLES);

    const cp1n: Point = { x: cp1.x - perpX * offset, y: cp1.y - perpY * offset };
    const cp2n: Point = { x: cp2.x - perpX * offset, y: cp2.y - perpY * offset };
    const clearN = !bezierHitsObstacles(from, cp1n, cp2n, to, obstacles, pad, SAMPLES);

    if (clearP && clearN) {
      // Both clear — pick the one whose curve midpoint is closer to from→to midpoint
      const midP = sampleBezier(from, cp1p, cp2p, to, 0.5);
      const midN = sampleBezier(from, cp1n, cp2n, to, 0.5);
      const distP = (midP.x - mid.x) ** 2 + (midP.y - mid.y) ** 2;
      const distN = (midN.x - mid.x) ** 2 + (midN.y - mid.y) ** 2;
      return distP <= distN ? { cp1: cp1p, cp2: cp2p } : { cp1: cp1n, cp2: cp2n };
    }
    if (clearP) return { cp1: cp1p, cp2: cp2p };
    if (clearN) return { cp1: cp1n, cp2: cp2n };
  }

  // Fallback: return the least-colliding direction at capped offset, preferring inner
  const maxOff = MAX_OFFSET;
  const cp1p: Point = { x: cp1.x + perpX * maxOff, y: cp1.y + perpY * maxOff };
  const cp2p: Point = { x: cp2.x + perpX * maxOff, y: cp2.y + perpY * maxOff };
  const cp1n: Point = { x: cp1.x - perpX * maxOff, y: cp1.y - perpY * maxOff };
  const cp2n: Point = { x: cp2.x - perpX * maxOff, y: cp2.y - perpY * maxOff };

  const hitsP = countBezierHits(from, cp1p, cp2p, to, obstacles, pad, SAMPLES);
  const hitsN = countBezierHits(from, cp1n, cp2n, to, obstacles, pad, SAMPLES);
  if (hitsP === hitsN) {
    const midP = sampleBezier(from, cp1p, cp2p, to, 0.5);
    const midN = sampleBezier(from, cp1n, cp2n, to, 0.5);
    const distP = (midP.x - mid.x) ** 2 + (midP.y - mid.y) ** 2;
    const distN = (midN.x - mid.x) ** 2 + (midN.y - mid.y) ** 2;
    return distP <= distN ? { cp1: cp1p, cp2: cp2p } : { cp1: cp1n, cp2: cp2n };
  }
  return hitsP < hitsN ? { cp1: cp1p, cp2: cp2p } : { cp1: cp1n, cp2: cp2n };
}

/** Sample a cubic bezier and check if any sample is inside an obstacle. */
function bezierHitsObstacles(
  p0: Point, p1: Point, p2: Point, p3: Point,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number, samples: number,
): boolean {
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const pt = sampleBezier(p0, p1, p2, p3, t);
    for (const obs of obstacles) {
      if (
        pt.x > obs.x - pad && pt.x < obs.x + obs.width + pad &&
        pt.y > obs.y - pad && pt.y < obs.y + obs.height + pad
      ) return true;
    }
  }
  return false;
}

/** Count obstacle hits along a bezier curve. */
function countBezierHits(
  p0: Point, p1: Point, p2: Point, p3: Point,
  obstacles: ReadonlyArray<import('../contracts/index.js').Rect>,
  pad: number, samples: number,
): number {
  let count = 0;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const pt = sampleBezier(p0, p1, p2, p3, t);
    for (const obs of obstacles) {
      if (
        pt.x > obs.x - pad && pt.x < obs.x + obs.width + pad &&
        pt.y > obs.y - pad && pt.y < obs.y + obs.height + pad
      ) count++;
    }
  }
  return count;
}

/** Evaluate a cubic bezier at parameter t ∈ [0, 1]. */
function sampleBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
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
