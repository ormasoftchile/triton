/**
 * @file astar-routing.ts — A* pathfinding for edge routing in poster compositions.
 *
 * Replaces the fixed 8-candidate enumeration with a pathfinding-based search
 * through the obstacle space when the enumerated candidates are all defective
 * or when A* can find a significantly better route.
 *
 * Key properties:
 *   • PURE + DETERMINISTIC — same inputs → same path every time
 *   • Orthogonal routing only (no diagonal segments)
 *   • Manhattan distance heuristic
 *   • Grid-based obstacles (boxes rasterized to grid cells)
 *   • Path simplification to remove collinear segments
 *
 * Public API:
 *   routeWithAStar(start, end, obstacles, gridSize) → Point[] | null
 */

import PF from 'pathfinding';
import type { Point, Box, Segment } from './primitives.js';

/**
 * Route from start to end using A* pathfinding, avoiding obstacles.
 *
 * @param start - Start point in poster space
 * @param end - End point in poster space
 * @param obstacles - Obstacle boxes to avoid (node boxes)
 * @param canvas - Canvas bounds for the grid
 * @param gridSize - Grid cell size in pixels (smaller = finer resolution, slower)
 * @returns Simplified polyline path (array of points), or null if unreachable
 */
export function routeWithAStar(
  start: Point,
  end: Point,
  obstacles: Box[],
  canvas: Box,
  gridSize: number,
): Point[] | null {
  // Convert canvas to grid dimensions.
  const cols = Math.ceil(canvas.w / gridSize);
  const rows = Math.ceil(canvas.h / gridSize);

  // Build obstacle grid: 0 = walkable, 1 = blocked.
  const grid = buildObstacleGrid(obstacles, canvas, cols, rows, gridSize);

  // Convert start/end to grid coordinates.
  const startCol = Math.floor((start.x - canvas.x) / gridSize);
  const startRow = Math.floor((start.y - canvas.y) / gridSize);
  const endCol = Math.floor((end.x - canvas.x) / gridSize);
  const endRow = Math.floor((end.y - canvas.y) / gridSize);

  // Clamp to grid bounds.
  const clampCol = (c: number) => Math.max(0, Math.min(cols - 1, c));
  const clampRow = (r: number) => Math.max(0, Math.min(rows - 1, r));

  const sCol = clampCol(startCol);
  const sRow = clampRow(startRow);
  const eCol = clampCol(endCol);
  const eRow = clampRow(endRow);

  // Mark start/end as walkable (even if inside an obstacle — we're routing from
  // anchor centers which may be inside the node box).
  grid[sRow]![sCol] = 0;
  grid[eRow]![eCol] = 0;

  // Create pathfinding grid.
  const pfGrid = new PF.Grid(cols, rows, grid);

  // Run A* with Manhattan heuristic (orthogonal routing only).
  const finder = new PF.AStarFinder({
    allowDiagonal: false,
    dontCrossCorners: true,
  });

  const gridPath = finder.findPath(sCol, sRow, eCol, eRow, pfGrid);

  if (gridPath.length === 0) {
    // Unreachable — return null (caller will fall back to enumerated candidates).
    return null;
  }

  // Convert grid path to world coordinates.
  const worldPath: Point[] = gridPath.map(([col, row]: [number, number]) => ({
    x: canvas.x + col * gridSize + gridSize / 2,
    y: canvas.y + row * gridSize + gridSize / 2,
  }));

  // Snap start/end to exact anchor positions (grid center is an approximation).
  if (worldPath.length > 0) {
    worldPath[0] = start;
    worldPath[worldPath.length - 1] = end;
  }

  // Simplify path to remove collinear segments.
  const simplified = simplifyPath(worldPath);

  return simplified;
}

/**
 * Build a 2D grid where 0 = walkable, 1 = blocked.
 * Each obstacle box is rasterized into the grid.
 */
function buildObstacleGrid(
  obstacles: Box[],
  canvas: Box,
  cols: number,
  rows: number,
  gridSize: number,
): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    grid.push(new Array(cols).fill(0));
  }

  for (const box of obstacles) {
    // Compute grid cells the box overlaps.
    const c0 = Math.max(0, Math.floor((box.x - canvas.x) / gridSize));
    const c1 = Math.min(cols - 1, Math.floor((box.x + box.w - canvas.x) / gridSize));
    const r0 = Math.max(0, Math.floor((box.y - canvas.y) / gridSize));
    const r1 = Math.min(rows - 1, Math.floor((box.y + box.h - canvas.y) / gridSize));

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        grid[r]![c] = 1;
      }
    }
  }

  return grid;
}

/**
 * Simplify a polyline path by removing collinear points.
 * A point P is collinear if the segments [A→P] and [P→B] have the same direction.
 */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  const simplified: Point[] = [path[0]!];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    const next = path[i + 1]!;

    // Check if curr is collinear with prev and next.
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // If directions differ (not parallel), keep the point.
    // Use cross-product to detect collinearity: dx1*dy2 - dy1*dx2 === 0.
    const cross = dx1 * dy2 - dy1 * dx2;
    const EPS = 1e-6;
    if (Math.abs(cross) > EPS) {
      simplified.push(curr);
    }
  }

  simplified.push(path[path.length - 1]!);
  return simplified;
}

/**
 * Compute the total length of a polyline path.
 */
export function pathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i]!.x - path[i - 1]!.x;
    const dy = path[i]!.y - path[i - 1]!.y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

/**
 * Count bends in a polyline path (number of direction changes).
 */
export function pathBends(path: Point[]): number {
  if (path.length <= 2) return 0;

  let bends = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    const next = path[i + 1]!;

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // If direction changes (not collinear), count a bend.
    const cross = dx1 * dy2 - dy1 * dx2;
    const EPS = 1e-6;
    if (Math.abs(cross) > EPS) {
      bends++;
    }
  }
  return bends;
}
