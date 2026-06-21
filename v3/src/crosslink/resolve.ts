/**
 * Cross-Link Resolution
 *
 * Resolves declared CrossLinks against a poster's merged NodeAnchorRegistry.
 * For each link, finds both endpoint anchors and selects the optimal port pair
 * (minimising euclidean distance between available ports).
 *
 * Inputs:  CrossLink[] + NodeAnchorRegistry (in poster coordinates)
 * Outputs: ResolvedCrossLink[] (ready for routing)
 *
 * Links with unresolvable addresses (missing cells/nodes) are skipped
 * with a diagnostic message — they never crash the layout.
 */

import type { Point, Rect } from '../contracts/primitives.js';
import type { CardinalSide, NodeAnchor, NodeAnchorRegistry } from '../contracts/anchors.js';
import type { CrossLink, ResolvedCrossLink, NodeAddress } from '../contracts/crosslink.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ResolutionResult {
  readonly resolved: ResolvedCrossLink[];
  readonly diagnostics: ResolutionDiagnostic[];
}

export interface ResolutionDiagnostic {
  readonly linkIndex: number;
  readonly message: string;
}

/**
 * Resolve an array of cross-links against the poster's anchor registry.
 *
 * The registry keys are dot-prefixed paths: "A1.nodeId" for flat posters,
 * "A1.B1.nodeId" for nested. The NodeAddress.cellPath + nodeId must match.
 */
export function resolveCrossLinks(
  links: readonly CrossLink[],
  anchors: NodeAnchorRegistry,
): ResolutionResult {
  const resolved: ResolvedCrossLink[] = [];
  const diagnostics: ResolutionDiagnostic[] = [];

  // Collect all obstacle bounds for port selection.
  const allBounds: Rect[] = Object.values(anchors).map(a => a.bounds);

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!;
    const fromKey = addressToKey(link.from);
    const toKey   = addressToKey(link.to);

    const fromAnchor = anchors[fromKey];
    const toAnchor   = anchors[toKey];

    if (!fromAnchor) {
      diagnostics.push({ linkIndex: i, message: `Cannot resolve source: "${fromKey}" not found in anchor registry` });
      continue;
    }
    if (!toAnchor) {
      diagnostics.push({ linkIndex: i, message: `Cannot resolve target: "${toKey}" not found in anchor registry` });
      continue;
    }

    const { fromPort, toPort, fromSide, toSide } = selectBestPorts(fromAnchor, toAnchor, allBounds);

    resolved.push({ link, fromAnchor, toAnchor, fromPort, toPort, fromSide, toSide });
  }

  // ─── Port spreading: distribute multiple links on the same node+side ─────
  spreadSharedPorts(resolved, anchors);

  return { resolved, diagnostics };
}

// ─── Address → Registry Key ──────────────────────────────────────────────────

/**
 * Convert a NodeAddress to the dot-separated key used in the anchor registry.
 * cellPath: ["A1"] + nodeId: "pay" → "A1.pay"
 * cellPath: ["A1", "B2"] + nodeId: "db" → "A1.B2.db"
 */
function addressToKey(addr: NodeAddress): string {
  return [...addr.cellPath, addr.nodeId].join('.');
}

// ─── Port Selection ──────────────────────────────────────────────────────────

const SIDES: CardinalSide[] = ['N', 'S', 'E', 'W'];

/** Large penalty added per obstacle crossing to prefer clear paths. */
const OBSTACLE_PENALTY = 1_000_000;

/**
 * Select the port pair that minimises distance while avoiding obstacles.
 * Simulates the orthogonal route shape (not just straight line) when
 * counting obstacle crossings, because the actual router produces bends.
 */
function selectBestPorts(from: NodeAnchor, to: NodeAnchor, obstacles: Rect[]): {
  fromPort: Point;
  toPort: Point;
  fromSide: CardinalSide;
  toSide: CardinalSide;
} {
  const fromPorts = availablePorts(from);
  const toPorts   = availablePorts(to);

  let bestScore = Infinity;
  let bestFrom: Point = fromPorts[0]![1];
  let bestTo: Point   = toPorts[0]![1];
  let bestFromSide: CardinalSide = fromPorts[0]![0];
  let bestToSide: CardinalSide   = toPorts[0]![0];

  for (const [fSide, fPt] of fromPorts) {
    for (const [tSide, tPt] of toPorts) {
      const dx = tPt.x - fPt.x;
      const dy = tPt.y - fPt.y;
      const dist = dx * dx + dy * dy;
      const crossings = countOrthogonalRouteCrossings(fPt, tPt, fSide, tSide, obstacles);
      const score = dist + crossings * OBSTACLE_PENALTY;
      if (score < bestScore) {
        bestScore = score;
        bestFrom = fPt;
        bestTo = tPt;
        bestFromSide = fSide;
        bestToSide = tSide;
      }
    }
  }

  return { fromPort: bestFrom, toPort: bestTo, fromSide: bestFromSide, toSide: bestToSide };
}

/**
 * Simulate the orthogonal router's path shape and count obstacle crossings
 * along ALL segments (not just the straight line between ports).
 */
function countOrthogonalRouteCrossings(
  from: Point, to: Point,
  fromSide: CardinalSide, toSide: CardinalSide,
  obstacles: Rect[],
): number {
  // Simulate the orthogonal router's logic to get the actual waypoints
  const segments = simulateOrthogonalRoute(from, to, fromSide, toSide);
  let crossings = 0;
  for (const [p1, p2] of segments) {
    crossings += countSegmentObstacleCrossings(p1, p2, obstacles);
  }
  return crossings;
}

/**
 * Produce the waypoint segments the orthogonal router would generate.
 * Mirrors the logic in router.ts but returns segment pairs.
 */
function simulateOrthogonalRoute(from: Point, to: Point, fromSide: CardinalSide, toSide: CardinalSide): [Point, Point][] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Aligned — single segment
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
    return [[from, to]];
  }

  const exitH  = fromSide === 'E' || fromSide === 'W';
  const entryH = toSide === 'E' || toSide === 'W';

  if (exitH && entryH) {
    // H → V → H (bend at midX)
    const v1: Point = { x: midX, y: from.y };
    const v2: Point = { x: midX, y: to.y };
    return [[from, v1], [v1, v2], [v2, to]];
  } else if (!exitH && !entryH) {
    // V → H → V (bend at midY)
    const v1: Point = { x: from.x, y: midY };
    const v2: Point = { x: to.x,   y: midY };
    return [[from, v1], [v1, v2], [v2, to]];
  } else if (exitH && !entryH) {
    // H then V — single corner
    const corner: Point = { x: to.x, y: from.y };
    return [[from, corner], [corner, to]];
  } else {
    // V then H — single corner
    const corner: Point = { x: from.x, y: to.y };
    return [[from, corner], [corner, to]];
  }
}

/**
 * Count how many obstacle rects the line segment (p1→p2) intersects.
 * Uses axis-aligned bounding box intersection with the segment's AABB,
 * then checks if the segment actually crosses through the rect.
 */
function countSegmentObstacleCrossings(p1: Point, p2: Point, obstacles: Rect[]): number {
  let count = 0;
  const segMinX = Math.min(p1.x, p2.x);
  const segMaxX = Math.max(p1.x, p2.x);
  const segMinY = Math.min(p1.y, p2.y);
  const segMaxY = Math.max(p1.y, p2.y);

  for (const obs of obstacles) {
    const oRight  = obs.x + obs.width;
    const oBottom = obs.y + obs.height;

    // Quick AABB rejection
    if (segMaxX < obs.x || segMinX > oRight) continue;
    if (segMaxY < obs.y || segMinY > oBottom) continue;

    // Segment's AABB overlaps obstacle — check if segment passes through interior
    if (segmentIntersectsRect(p1, p2, obs)) {
      count++;
    }
  }
  return count;
}

/**
 * Test if a line segment intersects the interior of a rect.
 * Uses Liang-Barsky line clipping algorithm.
 */
function segmentIntersectsRect(p1: Point, p2: Point, r: Rect): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const xmin = r.x;
  const xmax = r.x + r.width;
  const ymin = r.y;
  const ymax = r.y + r.height;

  let tmin = 0;
  let tmax = 1;

  const edges = [
    { p: -dx, q: p1.x - xmin },
    { p:  dx, q: xmax - p1.x },
    { p: -dy, q: p1.y - ymin },
    { p:  dy, q: ymax - p1.y },
  ];

  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-10) {
      // Parallel to edge — reject if outside
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        tmin = Math.max(tmin, t);
      } else {
        tmax = Math.min(tmax, t);
      }
      if (tmin > tmax) return false;
    }
  }

  // Strict interior crossing: tmin < tmax means the segment passes through
  // the rect interior. tmin == tmax is just a boundary touch (e.g. departing
  // from or arriving at a port on the rect edge) and should not count.
  return tmin < tmax;
}

/**
 * Get all available ports on an anchor — explicit ports if defined,
 * otherwise derive midpoints from the bounding box.
 */
function availablePorts(anchor: NodeAnchor): [CardinalSide, Point][] {
  const { bounds } = anchor;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const defaults: Record<CardinalSide, Point> = {
    N: { x: cx, y: bounds.y },
    S: { x: cx, y: bounds.y + bounds.height },
    E: { x: bounds.x + bounds.width, y: cy },
    W: { x: bounds.x, y: cy },
  };

  return SIDES.map(side => [
    side,
    anchor.ports?.[side] ?? defaults[side],
  ] as [CardinalSide, Point]);
}

// ─── Port Spreading ──────────────────────────────────────────────────────────

/**
 * When multiple links connect to the same side of the same node, spread
 * their port coordinates evenly along that edge instead of all converging
 * to the midpoint. Mutates the resolved links' fromPort/toPort in place.
 */
function spreadSharedPorts(resolved: ResolvedCrossLink[], anchors: NodeAnchorRegistry): void {
  // Group by (nodeKey, side) — merge both incoming and outgoing on same edge
  const groups = new Map<string, { index: number; isFrom: boolean }[]>();

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i]!;
    const fromKey = addressToKey(r.link.from);
    const toKey   = addressToKey(r.link.to);
    const fGroup = `${fromKey}.${r.fromSide}`;
    const tGroup = `${toKey}.${r.toSide}`;

    if (!groups.has(fGroup)) groups.set(fGroup, []);
    groups.get(fGroup)!.push({ index: i, isFrom: true });

    if (!groups.has(tGroup)) groups.set(tGroup, []);
    groups.get(tGroup)!.push({ index: i, isFrom: false });
  }

  for (const [key, members] of groups) {
    if (members.length < 2) continue;

    // Extract node key and side from group key
    const parts = key.split('.');
    const side = parts[parts.length - 1] as CardinalSide;
    const nodeKey = parts.slice(0, parts.length - 1).join('.');
    const anchor = anchors[nodeKey];
    if (!anchor) continue;

    const { bounds } = anchor;
    const n = members.length;

    // Compute evenly-spaced positions along the edge
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1); // 1/(n+1), 2/(n+1), ... n/(n+1)
      let pt: Point;
      switch (side) {
        case 'N': pt = { x: bounds.x + bounds.width * t, y: bounds.y }; break;
        case 'S': pt = { x: bounds.x + bounds.width * t, y: bounds.y + bounds.height }; break;
        case 'E': pt = { x: bounds.x + bounds.width, y: bounds.y + bounds.height * t }; break;
        case 'W': pt = { x: bounds.x, y: bounds.y + bounds.height * t }; break;
      }

      const { index, isFrom } = members[i]!;
      const r = resolved[index]! as { fromPort: Point; toPort: Point };
      if (isFrom) {
        r.fromPort = pt;
      } else {
        r.toPort = pt;
      }
    }
  }
}
