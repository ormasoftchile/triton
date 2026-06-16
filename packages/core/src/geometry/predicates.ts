/**
 * @file predicates.ts — Pure geometric predicates for the quality kernel.
 *
 * Exact-math operations build on `@flatten-js/core` (segment/point relations);
 * axis-aligned box tests use direct interval arithmetic (deterministic, no
 * floating-point search).  Every function here is pure and side-effect free.
 *
 * KEY SEMANTIC (per the kernel contract):
 *   `segmentIntersectsBox` returns TRUE *only* when the segment passes through
 *   the box INTERIOR.  Merely touching a boundary or sharing an endpoint on the
 *   box edge does NOT count — this is what lets an edge attach to its endpoint
 *   node's boundary port without registering as a "through-node" defect.
 */

import Flatten from '@flatten-js/core';

import type { Box, Point, Segment } from './primitives.js';

const { point, segment } = Flatten;

// ---------------------------------------------------------------------------
// Box ⇄ Box
// ---------------------------------------------------------------------------

/**
 * True when two boxes share POSITIVE-area interior overlap.  Boxes that merely
 * touch along an edge or corner (zero shared area) return false.  Uses strict
 * interval inequalities — fully deterministic, no epsilon.
 */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Area of the intersection of two boxes (0 when they do not overlap). */
export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

/** True when `inner` is fully contained within `outer` (boundary inclusive). */
export function boxContains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

// ---------------------------------------------------------------------------
// Point ⇄ Box
// ---------------------------------------------------------------------------

/**
 * Point-in-box test.  `strict` (default) requires the point to lie in the open
 * interior; otherwise the closed box (boundary inclusive) is used.
 */
export function pointInBox(p: Point, b: Box, strict = true): boolean {
  if (strict) {
    return p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
  }
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

// ---------------------------------------------------------------------------
// Segment ⇄ Box (interior passage)
// ---------------------------------------------------------------------------

/**
 * TRUE only when `seg` passes through the INTERIOR of `box`.
 *
 * Implementation: Liang–Barsky clips the segment to the closed box, yielding
 * the parameter sub-interval `[t0, t1]` of the portion inside the box.  The
 * segment passes through the interior iff that clipped sub-segment has positive
 * length AND its midpoint lies strictly inside the box.  This single test
 * correctly rejects every boundary-only case:
 *   • an endpoint resting on the box edge (zero-length clip),
 *   • a segment running ALONG a box edge (midpoint on the boundary),
 *   • a segment grazing a single corner (zero-length clip).
 *
 * Liang–Barsky is closed-form and deterministic.
 */
export function segmentIntersectsBox(seg: Segment, box: Box): boolean {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;

  // Degenerate (point) segment: counts only if strictly inside.
  if (dx === 0 && dy === 0) {
    return pointInBox({ x: seg.x1, y: seg.y1 }, box, true);
  }

  const xmin = box.x;
  const xmax = box.x + box.w;
  const ymin = box.y;
  const ymax = box.y + box.h;

  const p = [-dx, dx, -dy, dy];
  const q = [seg.x1 - xmin, xmax - seg.x1, seg.y1 - ymin, ymax - seg.y1];

  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      // Segment parallel to this boundary pair and outside it → no overlap.
      if (qi < 0) return false;
    } else {
      const r = qi / pi;
      if (pi < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }

  if (t1 <= t0) return false; // clipped portion is empty or a single point

  const tm = (t0 + t1) / 2;
  const mx = seg.x1 + tm * dx;
  const my = seg.y1 + tm * dy;
  return pointInBox({ x: mx, y: my }, box, true);
}

// ---------------------------------------------------------------------------
// Segment ⇄ Segment (proper crossing)
// ---------------------------------------------------------------------------

const SHARED_ENDPOINT_TOL = 1e-6;

function samePoint(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) < SHARED_ENDPOINT_TOL && Math.abs(ay - by) < SHARED_ENDPOINT_TOL;
}

/**
 * TRUE when two segments PROPERLY cross — i.e. they intersect at a point that
 * is not merely a shared endpoint of the two segments.  Two edges that meet
 * only because they share a common node port do NOT count as a crossing.
 *
 * Uses `@flatten-js/core` segment intersection for exact-math robustness.
 */
export function segmentsCross(s1: Segment, s2: Segment): boolean {
  const a = segment(s1.x1, s1.y1, s1.x2, s1.y2);
  const b = segment(s2.x1, s2.y1, s2.x2, s2.y2);
  const hits = a.intersect(b);
  if (hits.length === 0) return false;

  for (const h of hits) {
    const sharesEndpoint =
      samePoint(h.x, h.y, s1.x1, s1.y1) ||
      samePoint(h.x, h.y, s1.x2, s1.y2) ||
      samePoint(h.x, h.y, s2.x1, s2.y1) ||
      samePoint(h.x, h.y, s2.x2, s2.y2);
    if (!sharesEndpoint) return true;
  }
  return false;
}

/** Build a flatten-js point (exposed for callers needing exact-math helpers). */
export function flattenPoint(p: Point): Flatten.Point {
  return point(p.x, p.y);
}
