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
// Effect model (additive, backend-agnostic, Phase 4)
// ---------------------------------------------------------------------------

/**
 * A declarative art effect attached to a scene primitive.
 *
 * Backends that cannot render a given effect MUST silently omit it (fallback
 * policy: omit).  The SVG backend ignores all effects — output is byte-
 * identical to a primitive with no effects.  The Skia backend renders them.
 *
 * Determinism: effects are serialised by canonicalJSON (key-sorted) so they
 * contribute to the sceneHash.  Two identical effect lists produce the same hash.
 */
export type SceneEffect =
  | { kind: 'glow';   color: string; radius: number }
  | { kind: 'shadow'; dx: number; dy: number; blur: number; color: string };

/**
 * Declarative background specification for the Scene canvas.
 *
 * Replaces / augments `Scene.background` for backends that can honour it.
 * The SVG backend continues to use `Scene.background` (the plain hex string)
 * and ignores `Scene.sceneBackground`.
 */
export type SceneBackground =
  | { kind: 'solid';    color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | { kind: 'cloud';    baseColor: string; accentColor: string; intensity: number };

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
  effects?: SceneEffect[];
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
  effects?: SceneEffect[];
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
  effects?: SceneEffect[];
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
  effects?: SceneEffect[];
}

export interface MultiTextPrimitive {
  kind: 'multitext';
  x: number;
  y: number;
  lines: string[];
  /** Vertical distance between consecutive baselines in px. */
  lineHeight: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fill: string;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'alphabetic' | 'central';
  opacity?: number;
  effects?: SceneEffect[];
}

/**
 * Stroke gradient descriptor for PathPrimitive.
 *
 * When present, the path is stroked with a linear gradient flowing from
 * (x1,y1) to (x2,y2) in scene/user-space coordinates instead of a flat
 * `stroke` colour.  The `stroke` field is ignored when `strokeGradient` is set.
 *
 * Additive & opt-in — existing PathPrimitives without this field are unaffected.
 * The SVG backend emits a `<linearGradient>` in `<defs>` with a deterministic
 * content-derived id and `gradientUnits="userSpaceOnUse"`.  The Skia backend
 * builds a linear gradient shader via `CK.Shader.MakeLinearGradient`.
 */
export interface StrokeGradient {
  /** CSS hex colour at the gradient start point. */
  from: string;
  /** CSS hex colour at the gradient end point. */
  to: string;
  /** X-coordinate of the gradient start point in scene (user) space. */
  x1: number;
  /** Y-coordinate of the gradient start point in scene (user) space. */
  y1: number;
  /** X-coordinate of the gradient end point in scene (user) space. */
  x2: number;
  /** Y-coordinate of the gradient end point in scene (user) space. */
  y2: number;
}

export interface PathPrimitive {
  kind: 'path';
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  /**
   * CSS stroke-dasharray value (e.g. '6,4' for dashes, '2,4' for dots).
   * When set, the path is stroked with a dash pattern.
   * Optional and backward-compatible: existing paths without this field
   * are unaffected (undefined is omitted from serialisation and hash).
   */
  dashArray?: string;
  opacity?: number;
  fillRule?: 'nonzero' | 'evenodd';
  /** Optional SVG transform attribute (e.g. for icon scaling/translation). */
  transform?: string;
  effects?: SceneEffect[];
  /**
   * Optional stroke gradient. When set, the path is stroked with a linear
   * gradient flowing from (x1,y1)→(x2,y2) in scene coordinates.
   * The `stroke` field is ignored when `strokeGradient` is present.
   */
  strokeGradient?: StrokeGradient;
}

export interface GroupPrimitive {
  kind: 'group';
  id?: string;
  opacity?: number;
  primitives: ScenePrimitive[];
  effects?: SceneEffect[];
}

/**
 * An image primitive — an embedded raster or vector image positioned at (x, y).
 *
 * The image data MUST be a `data:` URI with base64-encoded bytes:
 *   `data:image/png;base64,...`
 *
 * This guarantees output byte-determinism (no external file references in
 * the emitted document).  Callers are responsible for embedding the bytes
 * before constructing this primitive (see `loadImageAsset`).
 *
 * Backend support:
 *   SVG  — `<image href="data:..."/>` + optional `<clipPath>` for borderRadius.
 *   Skia — `CK.MakeImageFromEncoded` → `drawImageRect`; raster formats only
 *           (PNG, JPEG, GIF, WEBP); SVG data URIs are silently skipped.
 *   PNG/resvg — pass-through via the SVG intermediate; PNG/JPEG data URIs
 *               work; SVG data URIs may not (resvg limitation).
 */
export interface ImagePrimitive {
  kind: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Embedded data URI: `data:<mimeType>;base64,<bytes>`. */
  data: string;
  mimeType: string;
  /** Optional corner rounding radius (CSS border-radius style). */
  borderRadius?: number;
  opacity?: number;
}

/**
 * Stub descriptor for art effects (Tier 2/3) — superseded by SceneEffect
 * above for Phase 4 but retained for backward compatibility.
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
  | MultiTextPrimitive
  | PathPrimitive
  | GroupPrimitive
  | ImagePrimitive;

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export interface Scene {
  /** Total canvas width in logical pixels. */
  width: number;
  /** Total canvas height in logical pixels (computed, never truncated). */
  height: number;
  /** CSS colour string for the canvas background (SVG backend primary). */
  background: string;
  /** Drawing primitives in painter's-algorithm order (back to front). */
  primitives: ScenePrimitive[];
  /**
   * Optional declarative background for backends that support rich fills
   * (Skia backend: gradient / cloud / solid).  SVG backend ignores this field
   * and uses `background` directly — keeping SVG output byte-identical.
   *
   * When set, the Skia backend renders this INSTEAD OF the first full-canvas
   * background rect primitive (detected by x=0, y=0, w=width, h=height).
   */
  sceneBackground?: SceneBackground;
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
