/**
 * Primitives
 *
 * Foundational geometric and visual value types.
 * These are the atoms of the rendering coordinate system.
 *
 * Rules for this file:
 *   - No imports from anywhere in the project.
 *   - No functions, classes, or values — types only.
 *   - Every other contract file may import from here; nothing here imports upward.
 */

// ─── Geometry ─────────────────────────────────────────────────────────────────

/** A 2D point in SVG coordinate space (origin top-left, y grows downward). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A width × height pair. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * An axis-aligned bounding box — position + size combined.
 * Extends both Point and Size so callers can destructure either way.
 */
export interface Rect extends Point, Size {}

// ─── Visual Values ────────────────────────────────────────────────────────────

/**
 * A CSS color string — hex, rgb(), hsl(), named color, etc.
 * Opaque alias: the type system trusts the caller to provide a valid value.
 */
export type Color = string;

/**
 * A CSS font-family string (may include fallback stack).
 * Opaque alias: conveys intent without runtime validation overhead.
 */
export type FontFamily = string;

/** Horizontal text alignment in SVG terms. */
export type TextAnchor = 'start' | 'middle' | 'end';

/** Font weight values supported by the renderer. */
export type FontWeight = 'normal' | 'bold';
