/**
 * @file grammars/chart/scales.ts — Deterministic closed-form chart scales.
 */

export type ScaleValue = string | number;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / magnitude;
  if (norm <= 1) return magnitude;
  if (norm <= 2) return 2 * magnitude;
  if (norm <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export class LinearScale {
  readonly domain: [number, number];
  readonly range: [number, number];

  constructor(domain: [number, number], range: [number, number]) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    this.domain = d0 <= d1 ? [d0, d1] : [d1, d0];
    this.range = [r0, r1];
  }

  scale(value: number): number {
    const [d0, d1] = this.domain;
    const [r0, r1] = this.range;
    if (d0 === d1) return (r0 + r1) / 2;
    const t = (value - d0) / (d1 - d0);
    return r0 + t * (r1 - r0);
  }

  invert(value: number): number {
    const [d0, d1] = this.domain;
    const [r0, r1] = this.range;
    if (r0 === r1) return d0;
    const t = (value - r0) / (r1 - r0);
    return d0 + t * (d1 - d0);
  }

  ticks(count = 5): number[] {
    const [lo, hi] = this.domain;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
    if (lo === hi) return [lo];

    const maxIntervals = Math.max(1, Math.floor(count));
    const span = hi - lo;
    const step = niceStep(span / maxIntervals);
    const start = Math.ceil(lo / step) * step;
    const ticks: number[] = [];

    for (let value = start; value <= hi + step * 1e-9 && ticks.length < maxIntervals + 1; value += step) {
      ticks.push(Number(value.toFixed(6)));
    }

    const firstTick = ticks[0];
    if (ticks.length === 0 || (firstTick !== undefined && firstTick > lo + 1e-9)) {
      ticks.unshift(Number(lo.toFixed(6)));
    }
    const lastTick = ticks[ticks.length - 1];
    if (lastTick !== undefined && lastTick < hi - 1e-9 && ticks.length < maxIntervals + 1) {
      ticks.push(Number(hi.toFixed(6)));
    }

    return ticks;
  }

  static nice(domain: [number, number], tickCount = 5): [number, number] {
    let [lo, hi] = domain;
    if (lo > hi) [lo, hi] = [hi, lo];
    const span = hi - lo;
    if (!Number.isFinite(span)) return [0, 1];
    if (span === 0) return [lo - 1, hi + 1];

    const magnitude = Math.pow(10, Math.floor(Math.log10(span)));
    const ratio = span / magnitude;
    let step = magnitude;
    if (tickCount > 0) {
      const candidate = niceStep(span / tickCount);
      if (candidate > step) step = candidate;
    }
    if (ratio > 5) step = Math.max(step, magnitude * 2);

    return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
  }
}

export class BandScale {
  readonly domain: ScaleValue[];
  readonly range: [number, number];
  readonly padding: number;
  readonly paddingOuter: number;
  private readonly index = new Map<ScaleValue, number>();
  private readonly bandStep: number;
  private readonly bandWidth: number;

  constructor(domain: ScaleValue[], range: [number, number], padding = 0.1) {
    this.domain = [...domain];
    this.range = range;
    this.padding = clamp(padding, 0, 0.95);
    this.paddingOuter = this.padding / 2;

    for (let i = 0; i < this.domain.length; i++) {
      this.index.set(this.domain[i]!, i);
    }

    const span = range[1] - range[0];
    this.bandStep = this.domain.length > 0 ? span / this.domain.length : 0;
    this.bandWidth = this.bandStep * (1 - this.padding);
  }

  scale(value: ScaleValue): number {
    return this.bandStart(value) + this.bandwidth() / 2;
  }

  bandStart(value: ScaleValue): number {
    const idx = this.index.get(value) ?? 0;
    const offset = (this.bandStep - this.bandWidth) / 2;
    return this.range[0] + idx * this.bandStep + offset;
  }

  bandwidth(): number {
    return this.bandWidth;
  }

  step(): number {
    return this.bandStep;
  }
}

export class RadialScale {
  readonly domain: [number, number];
  readonly range: [number, number];

  constructor(domain: [number, number], range: [number, number]) {
    this.domain = domain[0] <= domain[1] ? [domain[0], domain[1]] : [domain[1], domain[0]];
    this.range = range;
  }

  scale(value: number): number {
    const [d0, d1] = this.domain;
    const [r0, r1] = this.range;
    if (d0 === d1) return (r0 + r1) / 2;
    const t = (value - d0) / (d1 - d0);
    return r0 + t * (r1 - r0);
  }

  clampedScale(value: number): number {
    const [d0, d1] = this.domain;
    const clamped = Math.max(d0, Math.min(d1, value));
    return this.scale(clamped);
  }
}
