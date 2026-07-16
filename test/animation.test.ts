import { describe, expect, it } from 'vitest';
import {
  ANIMATION_BASE_PERIOD_SECONDS,
  ANIMATION_PERIOD_SECONDS,
  colorCycleStrokeAt,
  colorCycleStrokeValues,
  drawDashoffsetAt,
  flowStopOffsetAt,
  glowStrokeOpacityAt,
  marchDashoffsetAt,
  motionFractionAt,
  motionParticleSpecs,
  parseDasharrayPeriod,
  pointAtPathFraction,
  pulseStrokeWidthAt,
} from '../src/animation/index.js';

describe('animation timing math', () => {
  it('uses a short harmonic period family', () => {
    expect(ANIMATION_BASE_PERIOD_SECONDS).toBe(0.8);
    expect(ANIMATION_PERIOD_SECONDS).toEqual({
      march: 0.8,
      particle: 1.6,
      draw: 2.4,
      pulse: 1.6,
      glow: 1.6,
      comet: 1.6,
      stream: 2.4,
      flow: 1.6,
      colorcycle: 2.4,
    });
    for (const period of Object.values(ANIMATION_PERIOD_SECONDS)) {
      expect(period / ANIMATION_BASE_PERIOD_SECONDS).toBeCloseTo(Math.round(period / ANIMATION_BASE_PERIOD_SECONDS), 8);
    }
  });

  it('computes marching ants dashoffset monotonically within a period and wraps', () => {
    expect(parseDasharrayPeriod('4 2')).toBe(6);
    expect(marchDashoffsetAt(0, '4 2')).toBe(0);
    expect(marchDashoffsetAt(ANIMATION_PERIOD_SECONDS.march / 2, '4 2')).toBeCloseTo(-3);
    expect(marchDashoffsetAt(ANIMATION_PERIOD_SECONDS.march, '4 2')).toBe(0);
    expect(marchDashoffsetAt(0.1, '4 2')).toBeGreaterThan(marchDashoffsetAt(0.2, '4 2'));
  });

  it('computes draw, pulse, glow, and colorcycle key values and wraps', () => {
    expect(drawDashoffsetAt(0, 100)).toBe(0);
    expect(drawDashoffsetAt(ANIMATION_PERIOD_SECONDS.draw / 2, 100)).toBe(100);
    expect(drawDashoffsetAt(ANIMATION_PERIOD_SECONDS.draw, 100)).toBe(0);

    expect(pulseStrokeWidthAt(0, 2)).toBe(2);
    expect(pulseStrokeWidthAt(ANIMATION_PERIOD_SECONDS.pulse / 2, 2)).toBe(4);
    expect(pulseStrokeWidthAt(ANIMATION_PERIOD_SECONDS.pulse, 2)).toBe(2);

    expect(glowStrokeOpacityAt(0)).toBe(1);
    expect(glowStrokeOpacityAt(ANIMATION_PERIOD_SECONDS.glow / 2)).toBeCloseTo(0.3);
    expect(glowStrokeOpacityAt(ANIMATION_PERIOD_SECONDS.glow)).toBe(1);

    expect(colorCycleStrokeAt(0)).toBe(colorCycleStrokeValues()[0]);
    expect(colorCycleStrokeAt(ANIMATION_PERIOD_SECONDS.colorcycle / 2)).toBe(colorCycleStrokeValues()[2]);
    expect(colorCycleStrokeAt(ANIMATION_PERIOD_SECONDS.colorcycle)).toBe(colorCycleStrokeValues()[0]);
  });

  it('computes flow gradient stop offsets from shared keyframes', () => {
    expect(flowStopOffsetAt(0, 0)).toBe(0);
    expect(flowStopOffsetAt(ANIMATION_PERIOD_SECONDS.flow / 2, 0)).toBe(60);
    expect(flowStopOffsetAt(ANIMATION_PERIOD_SECONDS.flow, 0)).toBe(0);
    expect(flowStopOffsetAt(ANIMATION_PERIOD_SECONDS.flow / 2, 1)).toBe(70);
    expect(flowStopOffsetAt(ANIMATION_PERIOD_SECONDS.flow / 2, 2)).toBe(80);
  });

  it('computes motion fractions and path sampler points', () => {
    expect(motionFractionAt(0, 'particle')).toBe(0);
    expect(motionFractionAt(ANIMATION_PERIOD_SECONDS.particle / 2, 'particle')).toBe(0.5);
    expect(motionFractionAt(ANIMATION_PERIOD_SECONDS.particle, 'particle')).toBe(0);

    expect(pointAtPathFraction('M 0 0 L 10 0 L 10 10', 0)).toEqual({ x: 0, y: 0 });
    expect(pointAtPathFraction('M 0 0 L 10 0 L 10 10', 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAtPathFraction('M 0 0 L 10 0 L 10 10', 1)).toEqual({ x: 10, y: 10 });
  });

  it('preserves comet and stream phase spacing while periods change', () => {
    expect(motionParticleSpecs('comet').map(spec => spec.phase)).toEqual([0, 0.1, 0.2]);
    expect(motionParticleSpecs('stream').map(spec => spec.phase)).toEqual([0, 0.25, 0.5, 0.75]);
  });
});
