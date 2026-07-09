import { describe, it, expect } from 'vitest';
import { createRouter, countRouteCollisions, defaultRouter } from '../src/routing/router.js';

const from = { x: 0,   y: 0 };
const to   = { x: 100, y: 100 };

const base = { obstacles: [], padding: 8 };

describe('straight router', () => {
  const router = createRouter('straight');

  it('path starts at from and ends at to', () => {
    const r = router.route({ from, to, style: 'straight', ...base });
    expect(r.path).toContain(`M ${from.x} ${from.y}`);
    expect(r.path).toContain(`L ${to.x} ${to.y}`);
  });

  it('has exactly two points', () => {
    const r = router.route({ from, to, style: 'straight', ...base });
    expect(r.points).toHaveLength(2);
  });

  it('labelPosition is midpoint', () => {
    const r = router.route({ from, to, style: 'straight', ...base });
    expect(r.labelPosition).toEqual({ x: 50, y: 50 });
  });
});

describe('orthogonal router', () => {
  const router = createRouter('orthogonal');
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

  it('path starts at from and ends at to', () => {
    const r = router.route({ from, to, style: 'orthogonal', ...base });
    expect(r.path).toContain(`M ${from.x} ${from.y}`);
    expect(r.path).toContain(`L ${to.x} ${to.y}`);
  });

  it('has exactly four points (L-shape)', () => {
    const r = router.route({ from, to, style: 'orthogonal', ...base });
    expect(r.points).toHaveLength(4);
  });

  it('routes mainly-horizontal connection via mid-X', () => {
    // from=(0,0) to=(200,10) → mainly horizontal
    const r = router.route({ from: { x: 0, y: 0 }, to: { x: 200, y: 10 }, style: 'orthogonal', ...base });
    // Via points should share x=100 (midX)
    expect(r.points[1]!.x).toBe(100);
    expect(r.points[2]!.x).toBe(100);
  });

  it('routes mainly-vertical connection via mid-Y', () => {
    // from=(0,0) to=(10,200) → mainly vertical
    const r = router.route({ from: { x: 0, y: 0 }, to: { x: 10, y: 200 }, style: 'orthogonal', ...base });
    expect(r.points[1]!.y).toBe(100);
    expect(r.points[2]!.y).toBe(100);
  });

  it('same-wall W→W keeps the bend outboard — never routes behind the target', () => {
    // Source exits its west wall (x=300); target is entered on ITS west wall
    // (x=50) down and to the left. An obstacle straddles the exit run, which
    // used to push the connecting channel INBOARD (east of the target), driving
    // the landing segment straight through the target box to reach the far wall.
    const obstacles = [{ x: 20, y: -60, width: 260, height: 120 }];
    const r = router.route({
      from: { x: 300, y: 0 }, to: { x: 50, y: 200 },
      style: 'orthogonal', fromDir: 'W', toDir: 'W', obstacles, padding: 8,
    });
    // The bend channel must stay outboard (west) of the target's west entry
    // wall so the arrowhead approaches from the left, never crossing the box.
    expect(r.points[1]!.x).toBeLessThanOrEqual(50);
    expect(r.points[2]!.x).toBeLessThanOrEqual(50);
  });

  it('same-wall N→N keeps the bend outboard above both ports', () => {
    // Both ports on north walls; the connecting channel must sit ABOVE both,
    // never dipping between them where it would cross a box to reach the wall.
    const r = router.route({
      from: { x: 0, y: 200 }, to: { x: 200, y: 60 },
      style: 'orthogonal', fromDir: 'N', toDir: 'N', obstacles: [], padding: 8,
    });
    expect(r.points[1]!.y).toBeLessThanOrEqual(60);
    expect(r.points[2]!.y).toBeLessThanOrEqual(60);
  });

  it('same-wall N→N between vertically stacked boxes detours around endpoint interiors', () => {
    const obstacles = [box(0, 0, 100, 40), box(0, 200, 100, 40)];
    const r = router.route({
      from: { x: 50, y: 0 }, to: { x: 50, y: 200 },
      style: 'orthogonal', fromDir: 'N', toDir: 'N', obstacles, padding: 8,
    });
    expect(r.points.some(p => p.y < 0)).toBe(true);
    expect(r.points.some(p => p.x < 0 || p.x > 100)).toBe(true);
    expect(countRouteCollisions(r.points, obstacles)).toBe(0);
  });

  it('same-wall S→S between vertically stacked boxes detours symmetrically', () => {
    const obstacles = [box(0, 200, 100, 40), box(0, 0, 100, 40)];
    const r = router.route({
      from: { x: 50, y: 240 }, to: { x: 50, y: 40 },
      style: 'orthogonal', fromDir: 'S', toDir: 'S', obstacles, padding: 8,
    });
    expect(r.points.some(p => p.y > 240)).toBe(true);
    expect(r.points.some(p => p.x < 0 || p.x > 100)).toBe(true);
    expect(countRouteCollisions(r.points, obstacles)).toBe(0);
  });

  it('same-wall E→E between horizontally stacked boxes detours symmetrically', () => {
    const obstacles = [box(200, 0, 40, 100), box(0, 0, 40, 100)];
    const r = router.route({
      from: { x: 240, y: 50 }, to: { x: 40, y: 50 },
      style: 'orthogonal', fromDir: 'E', toDir: 'E', obstacles, padding: 8,
    });
    expect(r.points.some(p => p.x > 240)).toBe(true);
    expect(r.points.some(p => p.y < 0 || p.y > 100)).toBe(true);
    expect(countRouteCollisions(r.points, obstacles)).toBe(0);
  });

  it('same-wall W→W between horizontally stacked boxes detours symmetrically', () => {
    const obstacles = [box(0, 0, 40, 100), box(200, 0, 40, 100)];
    const r = router.route({
      from: { x: 0, y: 50 }, to: { x: 200, y: 50 },
      style: 'orthogonal', fromDir: 'W', toDir: 'W', obstacles, padding: 8,
    });
    expect(r.points.some(p => p.x < 0)).toBe(true);
    expect(r.points.some(p => p.y < 0 || p.y > 100)).toBe(true);
    expect(countRouteCollisions(r.points, obstacles)).toBe(0);
  });

  it('same-wall N→N side-by-side wrap still uses the compact over-top route', () => {
    const obstacles = [box(0, 0, 100, 40), box(200, 0, 100, 40)];
    const r = router.route({
      from: { x: 50, y: 0 }, to: { x: 250, y: 0 },
      style: 'orthogonal', fromDir: 'N', toDir: 'N', obstacles, padding: 8,
    });
    expect(r.points).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: -20 },
      { x: 250, y: -20 },
      { x: 250, y: 0 },
    ]);
    expect(countRouteCollisions(r.points, obstacles)).toBe(0);
  });

  it('wall-facing-toward vertical S→N link keeps the direct route', () => {
    const obstacles = [box(0, 0, 100, 40), box(0, 200, 100, 40)];
    const r = router.route({
      from: { x: 50, y: 40 }, to: { x: 50, y: 200 },
      style: 'orthogonal', fromDir: 'S', toDir: 'N', obstacles, padding: 8,
    });
    expect(r.points).toEqual([{ x: 50, y: 40 }, { x: 50, y: 200 }]);
    expect(countRouteCollisions(r.points, obstacles)).toBe(0);
  });
});

describe('bezier router', () => {
  const router = createRouter('bezier');

  it('path uses cubic bezier command (C)', () => {
    const r = router.route({ from, to, style: 'bezier', ...base });
    expect(r.path).toContain('C ');
  });

  it('has exactly four points (from, cp1, cp2, to)', () => {
    const r = router.route({ from, to, style: 'bezier', ...base });
    expect(r.points).toHaveLength(4);
  });

  it('tension=0 still produces a path', () => {
    const r = router.route({ from, to, style: 'bezier', tension: 0, ...base });
    expect(r.path.length).toBeGreaterThan(0);
  });
});

describe('polyline router', () => {
  it('produces a path', () => {
    const router = createRouter('polyline');
    const r = router.route({ from, to, style: 'polyline', ...base });
    expect(r.path.length).toBeGreaterThan(0);
  });
});

describe('defaultRouter', () => {
  it('is orthogonal', () => {
    const r = defaultRouter.route({ from, to, style: 'orthogonal', ...base });
    expect(r.points).toHaveLength(4);
  });
});
