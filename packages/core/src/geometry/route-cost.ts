/**
 * @file route-cost.ts — Closed-form cost model for ranking candidate routes.
 *
 * This is the kernel's "score" entry point used DURING layout (point (1) of the
 * architecture): the engine enumerates a FIXED set of candidate routes for a
 * hop, scores each with `scoreRoute`, and commits the lowest-cost candidate via
 * `pickBestRoute` using a STABLE deterministic tie-break.  No randomness, no
 * stochastic search — the same candidate list always yields the same winner.
 *
 * Cost is a weighted sum; lower is better.  The dominant terms are the hard
 * geometry defects (an edge stabbing a non-endpoint node, a label sitting on a
 * node, a route leaving the canvas) so a route that introduces a visible defect
 * can never be chosen when a clean alternative exists — by construction.
 */

import { boxesOverlap, pointInBox, segmentIntersectsBox, segmentsCross } from './predicates.js';
import {
  countBends,
  polylineLength,
  polylineToSegments,
} from './primitives.js';
import type { Box, BoxWithId, Point, Segment } from './primitives.js';

/** A candidate route produced by the router's enumeration step. */
export interface RouteCandidate {
  /** Ordered polyline vertices (poster space). */
  points: Point[];
  /** Where the route's label would sit, if any (used for label-collision cost). */
  labelBox?: Box;
  /** Endpoint node ids — excluded from through-node penalties. */
  fromId: string;
  toId: string;
  /** Stable enumeration rank used as the final tie-break (lower wins). */
  rank: number;
}

/** Context the candidates are scored against (everything fixed for the hop). */
export interface RouteContext {
  /** All node boxes in the poster (endpoints excluded per-candidate by id). */
  nodes: BoxWithId[];
  /** Already-committed edges (as segment lists) — for crossing cost. */
  committedEdges: Segment[][];
  /** Already-placed label boxes — for label∩label cost. */
  committedLabels: Box[];
  /** Canvas bounds — routes/labels leaving it are penalised. */
  canvas: Box;
  /** Reference length to normalise the length term (e.g. canvas diagonal). */
  lengthScale: number;
}

/** Cost weights — hard defects dominate length / bend aesthetics by orders of magnitude. */
export const ROUTE_WEIGHTS = {
  throughNode: 1000,
  labelOverNode: 600,
  outOfBounds: 800,
  edgeCrossing: 40,
  /** Congestion: penalises routes that share a gutter corridor with an already-committed edge.
   *  Encourages the router to spread routes across the canvas rather than pile them into a single
   *  inter-cell gap.  Weight sits between edgeCrossing (40) and bend (4) — enough to steer away
   *  from congested gutters but never overriding hard defect avoidance. */
  congestion: 20,
  bend: 4,
  length: 10,
} as const;

export interface RouteCost {
  total: number;
  throughNodeCount: number;
  labelOverNodeCount: number;
  outOfBounds: boolean;
  crossingCount: number;
  /** Number of already-committed edges that share a gutter corridor with this route. */
  congestionCount: number;
  bends: number;
  normalizedLength: number;
}

/**
 * Score a single candidate route.  Pure + deterministic: the returned cost is a
 * fixed function of the candidate and context.
 */
export function scoreRoute(candidate: RouteCandidate, ctx: RouteContext): RouteCost {
  const segments = polylineToSegments(candidate.points);

  // 1) Edge stabs a non-endpoint node (the dominant defect).
  let throughNodeCount = 0;
  for (const node of ctx.nodes) {
    if (node.id === candidate.fromId || node.id === candidate.toId) continue;
    if (segments.some((s) => segmentIntersectsBox(s, node))) throughNodeCount++;
  }

  // 2) Label collides with a non-owner node, an existing label, or leaves canvas.
  let labelOverNodeCount = 0;
  let labelOut = false;
  if (candidate.labelBox) {
    for (const node of ctx.nodes) {
      if (node.id === candidate.fromId || node.id === candidate.toId) continue;
      if (boxesOverlap(candidate.labelBox, node)) labelOverNodeCount++;
    }
    for (const other of ctx.committedLabels) {
      if (boxesOverlap(candidate.labelBox, other)) labelOverNodeCount++;
    }
    if (!boxInside(ctx.canvas, candidate.labelBox)) labelOut = true;
  }

  // 3) Route segment leaves the canvas.
  let routeOut = false;
  for (const p of candidate.points) {
    if (!pointInBox(p, ctx.canvas, false)) {
      routeOut = true;
      break;
    }
  }
  const outOfBounds = routeOut || labelOut;

  // 4) Crossings with already-committed edges.
  let crossingCount = 0;
  for (const other of ctx.committedEdges) {
    if (edgesCross(segments, other)) crossingCount++;
  }

  // 5) Congestion: how many committed edges share a gutter corridor with this route.
  //    Two polylines "share a corridor" when they have parallel co-aligned axis-aligned
  //    segments within CORRIDOR_TOL pixels of each other (same vertical or horizontal band).
  //    Penalising this steers the router to spread routes across the canvas rather than
  //    piling multiple edges into the same inter-cell gap.
  const CORRIDOR_TOL = 24; // pixels — within this distance two segments share a gutter
  let congestionCount = 0;
  for (const other of ctx.committedEdges) {
    if (sharesGutterCorridor(segments, other, CORRIDOR_TOL)) congestionCount++;
  }

  // 6) Aesthetics: bends + normalised length.
  const bends = countBends(candidate.points);
  const len = polylineLength(candidate.points);
  const normalizedLength = ctx.lengthScale > 0 ? len / ctx.lengthScale : len;

  const total =
    ROUTE_WEIGHTS.throughNode * throughNodeCount +
    ROUTE_WEIGHTS.labelOverNode * labelOverNodeCount +
    (outOfBounds ? ROUTE_WEIGHTS.outOfBounds : 0) +
    ROUTE_WEIGHTS.edgeCrossing * crossingCount +
    ROUTE_WEIGHTS.congestion * congestionCount +
    ROUTE_WEIGHTS.bend * bends +
    ROUTE_WEIGHTS.length * normalizedLength;

  return {
    total,
    throughNodeCount,
    labelOverNodeCount,
    outOfBounds,
    crossingCount,
    congestionCount,
    bends,
    normalizedLength,
  };
}

/**
 * Pick the lowest-cost candidate.  Ties (equal total cost within a tiny
 * tolerance) are broken by the candidate's `rank`, then by enumeration index —
 * a fully deterministic, stable choice.
 */
export function pickBestRoute(
  candidates: RouteCandidate[],
  ctx: RouteContext,
): { index: number; candidate: RouteCandidate; cost: RouteCost } {
  if (candidates.length === 0) {
    throw new Error('pickBestRoute: no candidates supplied');
  }
  let bestIdx = 0;
  let bestCost = scoreRoute(candidates[0]!, ctx);
  for (let i = 1; i < candidates.length; i++) {
    const cost = scoreRoute(candidates[i]!, ctx);
    if (isBetter(cost, candidates[i]!, bestCost, candidates[bestIdx]!, i, bestIdx)) {
      bestIdx = i;
      bestCost = cost;
    }
  }
  return { index: bestIdx, candidate: candidates[bestIdx]!, cost: bestCost };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COST_TIE_TOL = 1e-6;

function isBetter(
  cost: RouteCost,
  cand: RouteCandidate,
  bestCost: RouteCost,
  bestCand: RouteCandidate,
  idx: number,
  bestIdx: number,
): boolean {
  if (cost.total < bestCost.total - COST_TIE_TOL) return true;
  if (cost.total > bestCost.total + COST_TIE_TOL) return false;
  // Tie on cost → lower rank wins, then lower enumeration index.
  if (cand.rank !== bestCand.rank) return cand.rank < bestCand.rank;
  return idx < bestIdx;
}

function edgesCross(a: ReadonlyArray<Segment>, b: ReadonlyArray<Segment>): boolean {
  for (const s1 of a) {
    for (const s2 of b) {
      if (segmentsCross(s1, s2)) return true;
    }
  }
  return false;
}

/**
 * Return true when the two polylines share a parallel axis-aligned gutter corridor
 * — i.e. they each have a nearly-vertical (or nearly-horizontal) segment whose
 * perpendicular distance is less than `tol` pixels AND the two segments overlap
 * along their shared axis.  Two routes "sharing a corridor" in this sense both
 * compete for the same visual column/row of the inter-cell gap, making that gap
 * feel congested.
 */
function sharesGutterCorridor(
  a: ReadonlyArray<Segment>,
  b: ReadonlyArray<Segment>,
  tol: number,
): boolean {
  for (const sa of a) {
    const isVa = Math.abs(sa.x2 - sa.x1) < 2; // nearly vertical
    const isHa = Math.abs(sa.y2 - sa.y1) < 2; // nearly horizontal
    if (!isVa && !isHa) continue;
    for (const sb of b) {
      const isVb = Math.abs(sb.x2 - sb.x1) < 2;
      const isHb = Math.abs(sb.y2 - sb.y1) < 2;
      if (isVa && isVb && Math.abs(sa.x1 - sb.x1) < tol) {
        // Both vertical: check they overlap in Y.
        const aYlo = Math.min(sa.y1, sa.y2), aYhi = Math.max(sa.y1, sa.y2);
        const bYlo = Math.min(sb.y1, sb.y2), bYhi = Math.max(sb.y1, sb.y2);
        if (aYlo < bYhi && bYlo < aYhi) return true;
      }
      if (isHa && isHb && Math.abs(sa.y1 - sb.y1) < tol) {
        // Both horizontal: check they overlap in X.
        const aXlo = Math.min(sa.x1, sa.x2), aXhi = Math.max(sa.x1, sa.x2);
        const bXlo = Math.min(sb.x1, sb.x2), bXhi = Math.max(sb.x1, sb.x2);
        if (aXlo < bXhi && bXlo < aXhi) return true;
      }
    }
  }
  return false;
}

function boxInside(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}
