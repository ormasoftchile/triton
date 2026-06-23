import { describe, it, expect } from 'vitest';
import { borderPoint, slotAnchor, connectSlots } from '../src/graph/connect.js';

const box = { x: 0, y: 0, width: 40, height: 20 };

describe('slotAnchor', () => {
  it('returns the midpoint of each side', () => {
    expect(slotAnchor(box, 'left')).toEqual({ x: 0, y: 10 });
    expect(slotAnchor(box, 'right')).toEqual({ x: 40, y: 10 });
    expect(slotAnchor(box, 'top')).toEqual({ x: 20, y: 0 });
    expect(slotAnchor(box, 'bottom')).toEqual({ x: 20, y: 20 });
  });
});

describe('connectSlots', () => {
  it('clips both endpoints to their box borders', () => {
    const a = { x: 0, y: 0, width: 20, height: 20 };
    const b = { x: 100, y: 0, width: 20, height: 20 };
    const { start, end } = connectSlots(a, b);
    // a is left of b: start exits a's right edge, end enters b's left edge
    expect(start.x).toBe(20);
    expect(start.y).toBe(10);
    expect(end.x).toBe(100);
    expect(end.y).toBe(10);
  });

  it('start lies on the from-box border (borderPoint consistency)', () => {
    const a = { x: 0, y: 0, width: 40, height: 20 };
    const b = { x: 0, y: 100, width: 40, height: 20 };
    const { start, end } = connectSlots(a, b);
    expect(start).toEqual(borderPoint(a, b.x + b.width / 2, b.y + b.height / 2));
    expect(end.y).toBe(100); // enters b's top edge
  });
});
