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

  // Collect all obstacle bounds for port selection
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

    // Obstacles = all bounds EXCEPT the source and target themselves
    const obstacles = allBounds.filter(b => b !== fromAnchor.bounds && b !== toAnchor.bounds);
    const { fromPort, toPort, fromSide, toSide } = selectBestPorts(fromAnchor, toAnchor, obstacles);

    resolved.push({ link, fromAnchor, toAnchor, fromPort, toPort, fromSide, toSide });
  }

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
 * Scores each pair as: euclidean² + OBSTACLE_PENALTY * crossings.
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
      const crossings = countSegmentObstacleCrossings(fPt, tPt, obstacles);
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

  return true;
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
