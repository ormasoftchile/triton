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
  bend: 4,
  length: 10,
} as const;

export interface RouteCost {
  total: number;
  throughNodeCount: number;
  labelOverNodeCount: number;
  outOfBounds: boolean;
  crossingCount: number;
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

  // 5) Aesthetics: bends + normalised length.
  const bends = countBends(candidate.points);
  const len = polylineLength(candidate.points);
  const normalizedLength = ctx.lengthScale > 0 ? len / ctx.lengthScale : len;

  const total =
    ROUTE_WEIGHTS.throughNode * throughNodeCount +
    ROUTE_WEIGHTS.labelOverNode * labelOverNodeCount +
    (outOfBounds ? ROUTE_WEIGHTS.outOfBounds : 0) +
    ROUTE_WEIGHTS.edgeCrossing * crossingCount +
    ROUTE_WEIGHTS.bend * bends +
    ROUTE_WEIGHTS.length * normalizedLength;

  return {
    total,
    throughNodeCount,
    labelOverNodeCount,
    outOfBounds,
    crossingCount,
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

function boxInside(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}
