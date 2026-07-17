import type { Point } from '../contracts/primitives.js';
import type { RenderedConnectorAnimation } from '../contracts/animations.js';

export const ANIMATION_BASE_PERIOD_SECONDS = 0.8;

export const ANIMATION_PERIOD_SECONDS = {
  march: 0.8,
  particle: 1.6,
  draw: 2.4,
  pulse: 1.6,
  glow: 1.6,
  comet: 1.6,
  stream: 2.4,
  flow: 1.6,
  colorcycle: 2.4,
} as const satisfies Record<RenderedConnectorAnimation, number>;

export const COLOR_CYCLE_STROKES = ['#4A90D9', '#9b51e0', '#e54444', '#2ecc71', '#4A90D9'] as const;
export const FLOW_STOP_OFFSETS = [
  [0, 60, 100],
  [10, 70, 100],
  [20, 80, 100],
] as const;

export interface MotionParticleSpec {
  readonly radius: number;
  readonly opacity?: number;
  readonly phase: number;
}

export function animationPeriodSeconds(animation: RenderedConnectorAnimation): number {
  return ANIMATION_PERIOD_SECONDS[animation];
}

export function animationDuration(animation: RenderedConnectorAnimation): string {
  return `${formatNum(animationPeriodSeconds(animation))}s`;
}

export function marchDashoffsetAt(timeSeconds: number, dasharray: string): number {
  const offset = -parseDasharrayPeriod(dasharray) * normalizedTime(timeSeconds, ANIMATION_PERIOD_SECONDS.march);
  return Object.is(offset, -0) ? 0 : offset;
}

export function marchDashoffsetValues(dasharray: string): { readonly from: number; readonly to: number } {
  return { from: 0, to: -parseDasharrayPeriod(dasharray) };
}

export function drawDashoffsetAt(timeSeconds: number, pathLength: number): number {
  return triangularValue(timeSeconds, ANIMATION_PERIOD_SECONDS.draw, 0, pathLength);
}

export function drawDashoffsetValues(pathLength: number): readonly [number, number, number] {
  return [0, pathLength, 0];
}

export function pulseStrokeWidthAt(timeSeconds: number, strokeWidth: number): number {
  return triangularValue(timeSeconds, ANIMATION_PERIOD_SECONDS.pulse, strokeWidth, strokeWidth * 2);
}

export function pulseStrokeWidthValues(strokeWidth: number): readonly [number, number, number] {
  return [strokeWidth, Number(formatNum(strokeWidth * 2)), strokeWidth];
}

export function glowStrokeOpacityAt(timeSeconds: number): number {
  return triangularValue(timeSeconds, ANIMATION_PERIOD_SECONDS.glow, 1, 0.3);
}

export function glowStrokeOpacityValues(): readonly [number, number, number] {
  return [1, 0.3, 1];
}

export function colorCycleStrokeAt(timeSeconds: number): string {
  return interpolatedHex(COLOR_CYCLE_STROKES, normalizedTime(timeSeconds, ANIMATION_PERIOD_SECONDS.colorcycle));
}

export function colorCycleStrokeValues(): typeof COLOR_CYCLE_STROKES {
  return COLOR_CYCLE_STROKES;
}

export function flowStopOffsetAt(timeSeconds: number, stopIndex: 0 | 1 | 2): number {
  return keyframedNumber(FLOW_STOP_OFFSETS[stopIndex], normalizedTime(timeSeconds, ANIMATION_PERIOD_SECONDS.flow));
}

export function flowStopOffsetValues(stopIndex: 0 | 1 | 2): readonly [number, number, number] {
  return FLOW_STOP_OFFSETS[stopIndex];
}

export function motionFractionAt(timeSeconds: number, animation: 'particle' | 'comet' | 'stream', phase = 0): number {
  return wrap01(normalizedTime(timeSeconds, ANIMATION_PERIOD_SECONDS[animation]) + phase);
}

export function motionParticleSpecs(animation: 'particle' | 'comet' | 'stream'): readonly MotionParticleSpec[] {
  if (animation === 'particle') return [{ radius: 4, phase: 0 }];
  if (animation === 'comet') {
    return [
      { radius: 4.2, opacity: 0.95, phase: 0 },
      { radius: 3.1, opacity: 0.45, phase: 0.1 },
      { radius: 2.2, opacity: 0.22, phase: 0.2 },
    ];
  }
  return [
    { radius: 3.2, opacity: 0.9, phase: 0 },
    { radius: 3.2, opacity: 0.9, phase: 0.25 },
    { radius: 3.2, opacity: 0.9, phase: 0.5 },
    { radius: 3.2, opacity: 0.9, phase: 0.75 },
  ];
}

export function motionBeginSeconds(animation: 'particle' | 'comet' | 'stream', phase: number): number {
  return -phase * ANIMATION_PERIOD_SECONDS[animation];
}

export function pointAtPathFraction(path: string, fraction: number): Point {
  const pts = pathPoints(path);
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;

  const clamped = Math.min(1, Math.max(0, fraction));
  const target = pathLengthApprox(path) * clamped;
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (segmentLength === 0) continue;
    if (walked + segmentLength >= target) {
      const t = (target - walked) / segmentLength;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    walked += segmentLength;
  }
  return pts[pts.length - 1]!;
}

export function pathLengthApprox(path: string): number {
  const pts = pathPoints(path);
  if (pts.length < 2) return 1000;
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  }
  return Math.max(1, Number(formatNum(length)));
}

export function pathPoints(path: string): Point[] {
  const nums = [...path.matchAll(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)].map(m => Number(m[0]));
  const pts: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!;
    const y = nums[i + 1]!;
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
  }
  return pts;
}

export function parseDasharrayPeriod(dasharray: string): number {
  return dasharray
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(n => !isNaN(n) && n > 0)
    .reduce((sum, n) => sum + n, 0);
}

export function formatNum(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '0';
}

function normalizedTime(timeSeconds: number, periodSeconds: number): number {
  return wrap01(timeSeconds / periodSeconds);
}

function triangularValue(timeSeconds: number, periodSeconds: number, start: number, mid: number): number {
  const p = normalizedTime(timeSeconds, periodSeconds);
  const local = p <= 0.5 ? p * 2 : (1 - p) * 2;
  return start + (mid - start) * local;
}

function keyframedNumber(values: readonly number[], progress: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!;
  const scaled = progress * (values.length - 1);
  const index = Math.min(values.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return values[index]! + (values[index + 1]! - values[index]!) * local;
}

function interpolatedHex(values: readonly string[], progress: number): string {
  if (values.length === 0) return '#000000';
  if (values.length === 1) return values[0]!;
  const scaled = progress * (values.length - 1);
  const index = Math.min(values.length - 2, Math.floor(scaled));
  const local = scaled - index;
  if (local === 0) return values[index]!;
  return mixHex(values[index]!, values[index + 1]!, local);
}

function mixHex(a: string, b: string, t: number): string {
  const left = parseHex(a);
  const right = parseHex(b);
  return `#${[0, 1, 2].map(i => formatHex(left[i]! + (right[i]! - left[i]!) * t)).join('')}`;
}

function parseHex(value: string): readonly [number, number, number] {
  const hex = value.replace(/^#/, '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function formatHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

function wrap01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}
