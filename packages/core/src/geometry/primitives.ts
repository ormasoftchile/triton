/**
 * @file primitives.ts — Lightweight geometry primitives for the quality kernel.
 *
 * The geometry-quality kernel operates on these plain, immutable value types —
 * NOT full Scenes.  Everything here is pure and deterministic: no randomness,
 * no I/O, no rendering dependencies.  Coordinates are plain numbers in poster
 * (scene) space; the y-axis points DOWN (screen convention).
 *
 * Box convention: top-left origin `(x, y)` plus `(w, h)` dimensions, matching
 * `NodeAnchor` in `anchors.ts`.  A box is "well-formed" when `w >= 0 && h >= 0`.
 */

/** A 2-D point in poster (scene) space. */
export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned box: top-left `(x, y)` and dimensions `(w, h)`. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A box carrying a stable identity (a node id, label id, …). */
export interface BoxWithId extends Box {
  id: string;
}

/** A straight line segment between two endpoints. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ---------------------------------------------------------------------------
// Box helpers
// ---------------------------------------------------------------------------

/** Right edge x-coordinate (`x + w`). */
export function boxRight(b: Box): number {
  return b.x + b.w;
}

/** Bottom edge y-coordinate (`y + h`). */
export function boxBottom(b: Box): number {
  return b.y + b.h;
}

/** Geometric centre of a box. */
export function boxCenter(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Area of a box (0 for degenerate boxes). */
export function boxArea(b: Box): number {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

/**
 * Normalise a box so width and height are non-negative.  Boxes built from two
 * arbitrary corners may have negative dimensions; downstream predicates assume
 * the normalised form.
 */
export function normalizeBox(b: Box): Box {
  const x = b.w < 0 ? b.x + b.w : b.x;
  const y = b.h < 0 ? b.y + b.h : b.y;
  return { x, y, w: Math.abs(b.w), h: Math.abs(b.h) };
}

/** Construct a box from two opposite corners (any ordering). */
export function boxFromCorners(ax: number, ay: number, bx: number, by: number): Box {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  };
}

/** Grow (or shrink, with a negative amount) a box uniformly on all sides. */
export function insetBox(b: Box, amount: number): Box {
  return { x: b.x + amount, y: b.y + amount, w: b.w - 2 * amount, h: b.h - 2 * amount };
}

/** The four corner points of a box (TL, TR, BR, BL). */
export function boxCorners(b: Box): [Point, Point, Point, Point] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
}

/** The four boundary segments of a box (top, right, bottom, left). */
export function boxEdges(b: Box): [Segment, Segment, Segment, Segment] {
  const [tl, tr, br, bl] = boxCorners(b);
  return [
    { x1: tl.x, y1: tl.y, x2: tr.x, y2: tr.y },
    { x1: tr.x, y1: tr.y, x2: br.x, y2: br.y },
    { x1: br.x, y1: br.y, x2: bl.x, y2: bl.y },
    { x1: bl.x, y1: bl.y, x2: tl.x, y2: tl.y },
  ];
}

/** Euclidean length of a segment. */
export function segmentLength(s: Segment): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
}

/** Sum of segment lengths in a polyline (consecutive points). */
export function polylineLength(points: ReadonlyArray<Point>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

/** Convert a consecutive-point polyline into its segment list. */
export function polylineToSegments(points: ReadonlyArray<Point>): Segment[] {
  const segs: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.x === b.x && a.y === b.y) continue; // drop zero-length segments
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  return segs;
}

/**
 * Count the bends (direction changes) in a polyline.  Two consecutive
 * non-collinear segments form one bend.  Used as a secondary route-cost term.
 */
export function countBends(points: ReadonlyArray<Point>): number {
  let bends = 0;
  for (let i = 1; i + 1 < points.length; i++) {
    const ax = points[i]!.x - points[i - 1]!.x;
    const ay = points[i]!.y - points[i - 1]!.y;
    const bx = points[i + 1]!.x - points[i]!.x;
    const by = points[i + 1]!.y - points[i]!.y;
    // cross product != 0 → direction change
    if (Math.abs(ax * by - ay * bx) > 1e-9) bends++;
  }
  return bends;
}
