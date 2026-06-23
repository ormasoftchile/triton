import { describe, it, expect } from 'vitest';
import { createRouter, defaultRouter } from '../src/routing/router.js';

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
