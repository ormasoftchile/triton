import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg, initWasm, type ResvgRenderOptions } from '@resvg/resvg-wasm';
import UPNG from 'upng-js';
import type { RenderedConnectorAnimation } from '../contracts/animations.js';
import {
  ANIMATION_PERIOD_SECONDS,
  colorCycleStrokeAt,
  drawDashoffsetAt,
  flowStopOffsetAt,
  formatNum,
  glowStrokeOpacityAt,
  marchDashoffsetAt,
  motionFractionAt,
  motionParticleSpecs,
  pathLengthApprox,
  pointAtPathFraction,
  pulseStrokeWidthAt,
} from '../animation/index.js';

export type ExportAnimationPeriod = RenderedConnectorAnimation | number;

export interface LoopPlan {
  readonly loopSeconds: number;
  readonly frameCount: number;
  readonly delayMs: number;
}

export interface RenderToPngOptions {
  readonly width?: number;
  readonly scale?: number;
}

export interface ApngSize {
  readonly width: number;
  readonly height: number;
}

export interface AnimatedPngOptions extends RenderToPngOptions {
  readonly fps?: number;
  readonly speed?: number;
  readonly motionBlurSamples?: number;
  readonly shutter?: number;
}

interface RgbaFrame extends ApngSize {
  readonly rgba: Uint8Array;
}

const DEFAULT_FPS = 60;
const DEFAULT_SPEED = 1;
const DEFAULT_MOTION_BLUR_SAMPLES = 1;
const DEFAULT_SHUTTER = 1;
const DEFAULT_LOOP_SECONDS = 1;
const MS_PER_SECOND = 1000;
const require = createRequire(import.meta.url);
let wasmInitPromise: Promise<void> | undefined;

export function bakeFrame(svg: string, timeSeconds: number): string {
  let baked = bakeAnimatedPaths(svg, timeSeconds);
  baked = bakeFlowStops(baked, timeSeconds);
  baked = bakeMotionCircles(baked, timeSeconds);
  baked = stripAnimationTags(baked);
  return baked;
}

export async function renderToPng(svg: string, opts: RenderToPngOptions = {}): Promise<Uint8Array> {
  const rendered = await renderToRgba(svg, opts);
  return rendered.png;
}

export function encodeApng(frames: readonly Uint8Array[], delaysMs: readonly number[], size: ApngSize): Uint8Array {
  if (frames.length === 0) throw new Error('encodeApng requires at least one frame');
  if (frames.length !== delaysMs.length) throw new Error('encodeApng frame and delay counts must match');
  const expectedLength = size.width * size.height * 4;
  const buffers = frames.map(frame => {
    if (frame.byteLength !== expectedLength) {
      throw new Error(`RGBA frame has ${frame.byteLength} bytes; expected ${expectedLength}`);
    }
    return new Uint8Array(frame).buffer;
  });
  return new Uint8Array(UPNG.encode(buffers, size.width, size.height, 0, [...delaysMs]));
}

export function planLoop(periodsPresent: Iterable<ExportAnimationPeriod>, fps: number): LoopPlan {
  const periodsMs = [...periodsPresent].map(periodToMs).filter(ms => ms > 0);
  const loopMs = periodsMs.length === 0 ? DEFAULT_LOOP_SECONDS * MS_PER_SECOND : periodsMs.reduce(lcm);
  const safeFps = positiveNumber(fps, 'fps');
  const frameCount = Math.max(1, Math.round((loopMs / MS_PER_SECOND) * safeFps));
  return {
    loopSeconds: loopMs / MS_PER_SECOND,
    frameCount,
    delayMs: loopMs / frameCount,
  };
}

export async function exportAnimatedPng(renderedSvg: string, opts: AnimatedPngOptions = {}): Promise<Uint8Array> {
  const fps = positiveNumber(opts.fps ?? DEFAULT_FPS, 'fps');
  const speed = positiveNumber(opts.speed ?? DEFAULT_SPEED, 'speed');
  const motionBlurSamples = positiveInteger(opts.motionBlurSamples ?? DEFAULT_MOTION_BLUR_SAMPLES, 'motionBlurSamples');
  const shutter = shutterValue(opts.shutter ?? DEFAULT_SHUTTER);
  const periods = detectAnimationPeriods(renderedSvg);
  const sourcePlan = planLoop(periods, fps);
  const effectiveLoopSeconds = sourcePlan.loopSeconds / speed;
  const frameCount = Math.max(1, Math.round(effectiveLoopSeconds * fps));
  const frameSeconds = effectiveLoopSeconds / frameCount;
  const delayMs = (frameSeconds * MS_PER_SECOND);
  const frames: Uint8Array[] = [];
  let size: ApngSize | undefined;

  for (let i = 0; i < frameCount; i++) {
    const frame = await renderBlurredFrame(renderedSvg, i, frameSeconds, speed, motionBlurSamples, shutter, opts);
    if (size == null) size = { width: frame.width, height: frame.height };
    if (frame.width !== size.width || frame.height !== size.height) {
      throw new Error('Rendered frame dimensions changed during APNG export');
    }
    frames.push(frame.rgba);
  }

  return encodeApng(frames, Array(frameCount).fill(delayMs), size ?? { width: 0, height: 0 });
}

export async function exportStaticPng(renderedSvg: string, opts: RenderToPngOptions = {}): Promise<Uint8Array> {
  return renderToPng(renderedSvg, opts);
}

export function detectAnimationPeriods(svg: string): RenderedConnectorAnimation[] {
  const present = new Set<RenderedConnectorAnimation>();
  for (const match of svg.matchAll(/<animate\b([^>]*)\/?>/g)) {
    const attrs = parseAttrs(match[1] ?? '');
    const attribute = attrs.get('attributeName');
    if (attribute === 'stroke-dashoffset') {
      if (attrs.has('from') && attrs.has('to')) present.add('march');
      else present.add('draw');
    } else if (attribute === 'stroke-width') present.add('pulse');
    else if (attribute === 'stroke-opacity') present.add('glow');
    else if (attribute === 'stroke') present.add('colorcycle');
    else if (attribute === 'offset') present.add('flow');
  }
  for (const match of svg.matchAll(/<circle\b([^>]*)>\s*<animateMotion\b([^>]*)\/>\s*<\/circle>/g)) {
    const circleAttrs = parseAttrs(match[1] ?? '');
    const motionAttrs = parseAttrs(match[2] ?? '');
    present.add(inferMotionAnimation(circleAttrs, motionAttrs));
  }
  return [...present];
}

async function renderBlurredFrame(
  svg: string,
  frameIndex: number,
  frameSeconds: number,
  speed: number,
  motionBlurSamples: number,
  shutter: number,
  opts: RenderToPngOptions,
): Promise<RgbaFrame> {
  if (motionBlurSamples === 1) {
    const baked = bakeFrame(svg, frameIndex * frameSeconds * speed);
    return renderToRgbaFrame(baked, opts);
  }

  const exposureStart = frameIndex * frameSeconds;
  const exposureSeconds = shutter * frameSeconds;
  const rendered: RgbaFrame[] = [];
  for (let k = 0; k < motionBlurSamples; k++) {
    const outputTime = exposureStart + ((k + 0.5) * exposureSeconds) / motionBlurSamples;
    rendered.push(await renderToRgbaFrame(bakeFrame(svg, outputTime * speed), opts));
  }
  return averageRgbaFrames(rendered);
}

async function renderToRgbaFrame(svg: string, opts: RenderToPngOptions): Promise<RgbaFrame> {
  const rendered = await renderToRgba(svg, opts);
  return { rgba: rendered.rgba, width: rendered.width, height: rendered.height };
}

async function renderToRgba(svg: string, opts: RenderToPngOptions): Promise<RgbaFrame & { readonly png: Uint8Array }> {
  await ensureWasm();
  const resvg = new Resvg(svg, renderOptions(opts));
  try {
    const image = resvg.render();
    try {
      return { rgba: new Uint8Array(image.pixels), png: image.asPng(), width: image.width, height: image.height };
    } finally {
      image.free();
    }
  } finally {
    resvg.free();
  }
}

function renderOptions(opts: RenderToPngOptions): ResvgRenderOptions {
  const fitTo = opts.width != null
    ? { mode: 'width' as const, value: positiveNumber(opts.width, 'width') }
    : opts.scale != null
      ? { mode: 'zoom' as const, value: positiveNumber(opts.scale, 'scale') }
      : undefined;
  return {
    ...(fitTo != null ? { fitTo } : {}),
    font: { loadSystemFonts: true },
  };
}

function ensureWasm(): Promise<void> {
  wasmInitPromise ??= readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')).then(bytes => initWasm(bytes));
  return wasmInitPromise;
}

function bakeAnimatedPaths(svg: string, timeSeconds: number): string {
  return svg.replace(/<path\b([^>]*)>([\s\S]*?)<\/path>/g, (match, rawAttrs: string, inner: string) => {
    if (!/<animate\b/.test(inner)) return match;
    const attrs = parseAttrs(rawAttrs);
    let nextAttrs = rawAttrs;
    for (const animate of inner.matchAll(/<animate\b([^>]*)\/?>/g)) {
      const animateAttrs = parseAttrs(animate[1] ?? '');
      const attribute = animateAttrs.get('attributeName');
      if (attribute === 'stroke-dashoffset') {
        if (animateAttrs.has('from') && animateAttrs.has('to')) {
          nextAttrs = replaceAttr(nextAttrs, 'stroke-dashoffset', formatNum(marchDashoffsetAt(timeSeconds, attrs.get('stroke-dasharray') ?? '')));
        } else {
          const length = pathLengthApprox(attrs.get('d') ?? '');
          nextAttrs = replaceAttr(nextAttrs, 'stroke-dashoffset', formatNum(drawDashoffsetAt(timeSeconds, length)));
        }
      } else if (attribute === 'stroke-width') {
        nextAttrs = replaceAttr(nextAttrs, 'stroke-width', formatNum(pulseStrokeWidthAt(timeSeconds, numberAttr(attrs, 'stroke-width', 1))));
      } else if (attribute === 'stroke-opacity') {
        nextAttrs = replaceAttr(nextAttrs, 'stroke-opacity', formatNum(glowStrokeOpacityAt(timeSeconds)));
      } else if (attribute === 'stroke') {
        nextAttrs = replaceAttr(nextAttrs, 'stroke', colorCycleStrokeAt(timeSeconds));
      }
    }
    const remaining = stripAnimationTags(inner).trim();
    return remaining.length === 0 ? `<path${nextAttrs} />` : `<path${nextAttrs}>${remaining}</path>`;
  });
}

function bakeFlowStops(svg: string, timeSeconds: number): string {
  return svg.replace(/<stop\b([^>]*)>\s*<animate\b([^>]*)\/>\s*<\/stop>/g, (match, rawAttrs: string, rawAnimateAttrs: string) => {
    const animateAttrs = parseAttrs(rawAnimateAttrs);
    if (animateAttrs.get('attributeName') !== 'offset') return match;
    const stopIndex = flowStopIndex(animateAttrs.get('values') ?? '');
    return `<stop${replaceAttr(rawAttrs, 'offset', `${formatNum(flowStopOffsetAt(timeSeconds, stopIndex))}%`)}/>`;
  });
}

function bakeMotionCircles(svg: string, timeSeconds: number): string {
  return svg.replace(/<circle\b([^>]*)>\s*<animateMotion\b([^>]*)\/>\s*<\/circle>/g, (_match, rawCircleAttrs: string, rawMotionAttrs: string) => {
    const circleAttrs = parseAttrs(rawCircleAttrs);
    const motionAttrs = parseAttrs(rawMotionAttrs);
    const path = motionAttrs.get('path');
    if (!path) throw new Error('animateMotion without inline path is not supported');
    const animation = inferMotionAnimation(circleAttrs, motionAttrs);
    const period = ANIMATION_PERIOD_SECONDS[animation];
    const begin = parseSeconds(motionAttrs.get('begin'), 0);
    const phase = -begin / period;
    const point = pointAtPathFraction(path, motionFractionAt(timeSeconds, animation, phase));
    const withCx = replaceAttr(rawCircleAttrs, 'cx', formatNum(point.x));
    return `<circle${replaceAttr(withCx, 'cy', formatNum(point.y))}/>`;
  });
}

function stripAnimationTags(svg: string): string {
  return svg
    .replace(/<animate(?:Motion|Transform)?\b[^>]*\/>/g, '')
    .replace(/<animate(?:Motion|Transform)?\b[^>]*>[\s\S]*?<\/animate(?:Motion|Transform)?>/g, '');
}

function averageRgbaFrames(frames: readonly RgbaFrame[]): RgbaFrame {
  if (frames.length === 0) throw new Error('Cannot average zero frames');
  if (frames.length === 1) return frames[0]!;
  const { width, height, rgba } = frames[0]!;
  const byteLength = rgba.byteLength;
  const accumR = new Float64Array(byteLength / 4);
  const accumG = new Float64Array(byteLength / 4);
  const accumB = new Float64Array(byteLength / 4);
  const accumA = new Float64Array(byteLength / 4);

  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height || frame.rgba.byteLength !== byteLength) {
      throw new Error('Motion blur sub-frame dimensions changed during a frame');
    }
    for (let src = 0, px = 0; src < byteLength; src += 4, px++) {
      const alpha = frame.rgba[src + 3]! / 255;
      accumR[px]! += frame.rgba[src]! * alpha;
      accumG[px]! += frame.rgba[src + 1]! * alpha;
      accumB[px]! += frame.rgba[src + 2]! * alpha;
      accumA[px]! += alpha;
    }
  }

  const out = new Uint8Array(byteLength);
  for (let dst = 0, px = 0; dst < byteLength; dst += 4, px++) {
    const alphaSum = accumA[px]!;
    out[dst + 3] = Math.round((alphaSum / frames.length) * 255);
    if (alphaSum > 0) {
      out[dst] = Math.round(accumR[px]! / alphaSum);
      out[dst + 1] = Math.round(accumG[px]! / alphaSum);
      out[dst + 2] = Math.round(accumB[px]! / alphaSum);
    }
  }
  return { rgba: out, width, height };
}

function inferMotionAnimation(attrs: ReadonlyMap<string, string>, motionAttrs: ReadonlyMap<string, string>): 'particle' | 'comet' | 'stream' {
  const dur = parseSeconds(motionAttrs.get('dur'), ANIMATION_PERIOD_SECONDS.particle);
  if (Math.abs(dur - ANIMATION_PERIOD_SECONDS.stream) < 1e-6) return 'stream';

  const r = Number(attrs.get('r'));
  const opacity = attrs.has('opacity') ? Number(attrs.get('opacity')) : undefined;
  const comet = motionParticleSpecs('comet');
  if (comet.some(spec => Math.abs(spec.radius - r) < 1e-6 && (spec.opacity == null || Math.abs(spec.opacity - (opacity ?? 1)) < 1e-6))) {
    return 'comet';
  }
  return 'particle';
}

function flowStopIndex(values: string): 0 | 1 | 2 {
  const first = Number.parseFloat(values.split(';')[0] ?? '');
  if (first === 10) return 1;
  if (first === 20) return 2;
  return 0;
}

function parseAttrs(attrs: string): Map<string, string> {
  const parsed = new Map<string, string>();
  for (const match of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    parsed.set(match[1]!, unescapeAttr(match[2]!));
  }
  return parsed;
}

function replaceAttr(attrs: string, name: string, value: string | number): string {
  const attr = `${name}="${escapeAttr(String(value))}"`;
  const re = new RegExp(`\\s${escapeRegExp(name)}="[^"]*"`);
  return re.test(attrs) ? attrs.replace(re, ` ${attr}`) : `${attrs} ${attr}`;
}

function numberAttr(attrs: ReadonlyMap<string, string>, name: string, fallback: number): number {
  const value = Number(attrs.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function parseSeconds(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const match = /^([+-]?\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) throw new Error(`Unsupported SMIL time value "${value}"`);
  return Number(match[1]);
}

function periodToMs(period: ExportAnimationPeriod): number {
  const seconds = typeof period === 'number' ? period : ANIMATION_PERIOD_SECONDS[period];
  return Math.round(positiveNumber(seconds, 'period') * MS_PER_SECOND);
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function positiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function shutterValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error('shutter must be in (0,1]');
  return value;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function unescapeAttr(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
