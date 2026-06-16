/**
 * @file spatial-index.ts — rbush-backed broad-phase index for box queries.
 *
 * Wraps an R-tree so callers can index labelled boxes once and run fast
 * "which boxes overlap this region / box / segment-bbox" broad-phase queries.
 * The kernel uses this to keep defect detection near-linear on large posters
 * (broad-phase candidates from rbush → exact predicate as narrow-phase).
 *
 * Determinism: rbush insertion order is preserved deterministically here — we
 * always `load()` the items in the caller's array order and return query hits
 * sorted by their original insertion index, so results never depend on tree
 * balancing internals.
 */

import RBush from 'rbush';

import type { Box, BoxWithId, Segment } from './primitives.js';

interface IndexedEntry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Insertion index — used to return query hits in stable order. */
  order: number;
  box: BoxWithId;
}

/** A deterministic spatial index over labelled boxes. */
export class BoxIndex {
  private tree: RBush<IndexedEntry>;
  private entries: IndexedEntry[] = [];

  constructor(boxes: ReadonlyArray<BoxWithId> = []) {
    this.tree = new RBush<IndexedEntry>();
    this.load(boxes);
  }

  /** Replace the index contents with `boxes` (preserves their array order). */
  load(boxes: ReadonlyArray<BoxWithId>): void {
    this.entries = boxes.map((box, order) => ({
      minX: box.x,
      minY: box.y,
      maxX: box.x + box.w,
      maxY: box.y + box.h,
      order,
      box,
    }));
    this.tree.clear();
    this.tree.load(this.entries);
  }

  /** All labelled boxes that overlap the query box's bounding region. */
  searchBox(q: Box): BoxWithId[] {
    return this.searchBBox(q.x, q.y, q.x + q.w, q.y + q.h);
  }

  /** All labelled boxes whose bbox overlaps the bounding box of `seg`. */
  searchSegment(seg: Segment): BoxWithId[] {
    return this.searchBBox(
      Math.min(seg.x1, seg.x2),
      Math.min(seg.y1, seg.y2),
      Math.max(seg.x1, seg.x2),
      Math.max(seg.y1, seg.y2),
    );
  }

  private searchBBox(minX: number, minY: number, maxX: number, maxY: number): BoxWithId[] {
    const hits = this.tree.search({ minX, minY, maxX, maxY });
    hits.sort((a, b) => a.order - b.order);
    return hits.map((h) => h.box);
  }
}
