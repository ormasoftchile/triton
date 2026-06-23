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
