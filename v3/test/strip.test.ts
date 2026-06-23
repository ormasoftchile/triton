import { describe, it, expect } from 'vitest';
import { buildStrip } from '../src/scene/strip.js';
import { pen } from '../src/scene/build.js';
import { defaultTheme } from '../src/theme/preset.js';

const p = pen(defaultTheme);

describe('buildStrip', () => {
  it('produces one slot per cell, in order', () => {
    const r = buildStrip(p, defaultTheme, [{ label: '5' }, { label: '8' }, { label: '13' }],
      { origin: { x: 0, y: 0 }, cellWidth: 40, cellHeight: 30 });
    expect(r.slots).toHaveLength(3);
    expect(r.slots.map(s => s.x)).toEqual([0, 40, 80]);
  });

  it('lays contiguous cells with no gap by default', () => {
    const r = buildStrip(p, defaultTheme, [{}, {}], { origin: { x: 10, y: 5 }, cellWidth: 50, cellHeight: 20 });
    expect(r.slots[1]!.x).toBe(r.slots[0]!.x + 50);
    expect(r.bounds).toEqual({ x: 10, y: 5, width: 100, height: 20 });
  });

  it('honours gap and vertical orientation', () => {
    const r = buildStrip(p, defaultTheme, [{}, {}, {}],
      { origin: { x: 0, y: 0 }, cellWidth: 30, cellHeight: 24, orientation: 'vertical', gap: 6 });
    expect(r.slots.map(s => s.y)).toEqual([0, 30, 60]);
    expect(r.bounds).toEqual({ x: 0, y: 0, width: 30, height: 84 });
  });

  it('emits a rect per cell plus labels and index labels', () => {
    const r = buildStrip(p, defaultTheme, [{ label: 'a', index: '0' }],
      { origin: { x: 0, y: 0 }, cellWidth: 40, cellHeight: 30 });
    const rects = r.elements.filter(e => e.type === 'rect');
    const texts = r.elements.filter(e => e.type === 'text');
    expect(rects).toHaveLength(1);
    expect(texts).toHaveLength(2); // label + index
  });

  it('handles empty input', () => {
    const r = buildStrip(p, defaultTheme, [], { origin: { x: 4, y: 4 }, cellWidth: 40, cellHeight: 30 });
    expect(r.slots).toHaveLength(0);
    expect(r.bounds.width).toBe(0);
  });
});
