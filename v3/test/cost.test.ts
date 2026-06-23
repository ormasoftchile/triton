import { describe, it, expect } from 'vitest';
import { classifyCost, tierByName, buildLegend, type CostScale } from '../src/style/cost.js';
import { pen } from '../src/scene/build.js';
import { defaultTheme } from '../src/theme/preset.js';

const scale: CostScale = {
  unit: 'ns',
  tiers: [
    { name: 'local', maxWeight: 90, color: '#27ae60' },
    { name: 'hop1', maxWeight: 140, color: '#2f80ed' },
    { name: 'hop2', maxWeight: 200, color: '#e2574c', dash: '5 4' },
  ],
};

describe('classifyCost', () => {
  it('buckets a weight into the first tier whose bound it fits', () => {
    expect(classifyCost(scale, 80).name).toBe('local');
    expect(classifyCost(scale, 90).name).toBe('local');   // inclusive
    expect(classifyCost(scale, 120).name).toBe('hop1');
    expect(classifyCost(scale, 200).name).toBe('hop2');
  });

  it('clamps over-max weights to the last tier', () => {
    expect(classifyCost(scale, 9999).name).toBe('hop2');
  });
});

describe('tierByName', () => {
  it('finds a tier by name', () => {
    expect(tierByName(scale, 'hop1')?.color).toBe('#2f80ed');
  });
  it('returns undefined for an unknown tier', () => {
    expect(tierByName(scale, 'nope')).toBeUndefined();
  });
});

describe('buildLegend', () => {
  it('emits a frame plus a swatch and labels per tier', () => {
    const { elements, bounds } = buildLegend(pen(defaultTheme), defaultTheme, scale, { x: 0, y: 0 });
    const rects = elements.filter(e => e.type === 'rect');
    expect(rects).toHaveLength(1 + scale.tiers.length); // frame + 1 swatch each
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });
});
