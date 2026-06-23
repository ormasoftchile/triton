/**
 * @file graph/connect.ts — Edge endpoint helpers for node-link layouts.
 */

export interface BoxLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The point on a box's border along the ray from its centre toward (tx, ty).
 * Used to clip connector lines to node boundaries.
 */
export function borderPoint(box: BoxLike, tx: number, ty: number): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = box.width / 2;
  const hh = box.height / 2;
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** The midpoint of one side of a box — an explicit anchor for slot pointers. */
export function slotAnchor(box: BoxLike, side: Side): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  switch (side) {
    case 'left':   return { x: box.x, y: cy };
    case 'right':  return { x: box.x + box.width, y: cy };
    case 'top':    return { x: cx, y: box.y };
    case 'bottom': return { x: cx, y: box.y + box.height };
  }
}

/**
 * A slot-aware connector: clips both ends to the box borders along the line
 * joining their centres. Works for cells in a strip, nodes in a tree, or
 * panels in a poster (the same router the cross-link feature uses).
 */
export function connectSlots(from: BoxLike, to: BoxLike): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const fc = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const tc = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  return {
    start: borderPoint(from, tc.x, tc.y),
    end:   borderPoint(to, fc.x, fc.y),
  };
}
