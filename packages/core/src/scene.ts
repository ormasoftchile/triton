/**
 * @file scene.ts — Scene / Render IR
 *
 * The deterministic, backend-agnostic intermediate representation produced by
 * the six-phase layout pipeline (§5). Backends (SVG, PNG, …) consume the Scene
 * and emit their respective formats without feeding back into the pipeline.
 *
 * Coordinates are numbers already rounded to fixed decimal precision (2 dp,
 * round-half-up) as specified by the determinism contract (§5.1 item 3).
 */

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

export interface LinePrimitive {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  dashArray?: string;
}

export interface RectPrimitive {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  opacity?: number;
}

export interface CirclePrimitive {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface TextPrimitive {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fill: string;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'alphabetic' | 'central';
  opacity?: number;
}

export interface PathPrimitive {
  kind: 'path';
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fillRule?: 'nonzero' | 'evenodd';
}

export interface GroupPrimitive {
  kind: 'group';
  id?: string;
  opacity?: number;
  primitives: ScenePrimitive[];
}

/**
 * Stub descriptor for art effects (Tier 2/3) — not used in Phase 1 Tier-1
 * rendering but included so the shape is complete.
 */
export interface EffectDescriptor {
  type: 'drop-shadow' | 'glow' | 'none';
  /** Effect is silently skipped if the backend cannot fulfil it. */
  fallbackPolicy: 'approximate' | 'omit' | 'embed-raster';
}

export type ScenePrimitive =
  | LinePrimitive
  | RectPrimitive
  | CirclePrimitive
  | TextPrimitive
  | PathPrimitive
  | GroupPrimitive;

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export interface Scene {
  /** Total canvas width in logical pixels. */
  width: number;
  /** Total canvas height in logical pixels (computed, never truncated). */
  height: number;
  /** CSS colour string for the canvas background. */
  background: string;
  /** Drawing primitives in painter's-algorithm order (back to front). */
  primitives: ScenePrimitive[];
}

// ---------------------------------------------------------------------------
// Deterministic hash
// ---------------------------------------------------------------------------

/**
 * Produce a stable, canonical JSON serialisation of `value`: object keys are
 * sorted alphabetically at every level; arrays preserve their order.  Numbers
 * are emitted as-is (no extra precision changes); undefined values are omitted
 * just as `JSON.stringify` does.
 */
function canonicalJSON(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJSON).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys
      .filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k]));
    return '{' + pairs.join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * Compute a SHA-256 hash over the canonical JSON of `scene`.
 *
 * This hash is byte-deterministic: identical scenes on any platform produce
 * identical hashes.  It is the value exposed as `RenderResult.sceneHash`.
 */
export function sceneHash(scene: Scene): string {
  const canonical = canonicalJSON(scene);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
