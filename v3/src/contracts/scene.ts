/**
 * Scene
 *
 * The universal render-ready intermediate representation.
 *
 * Every DiagramLayoutEngine produces a Scene. Every renderer (SVG, PNG,
 * canvas, PDF) consumes a Scene. Neither side knows anything about the other.
 *
 * Design rules:
 *   - Every property must be fully resolved — no "inherit", no "auto",
 *     no unresolved references. The Scene is ready to paint as-is.
 *   - Scene elements are immutable value objects (all readonly).
 *   - Scene carries no semantic information (no diagram type, no grammar
 *     concepts, no overlay specs). It is pure geometry and style.
 *   - Elements are ordered back-to-front (painter's algorithm).
 */

import type { Color, FontFamily, FontWeight, Point, Rect, TextAnchor } from './primitives.js';

// ─── Element Variants ─────────────────────────────────────────────────────────

export interface SceneRect {
  readonly type: 'rect';
  readonly bounds: Rect;
  readonly fill: Color;
  readonly stroke: Color;
  readonly strokeWidth: number;
  readonly rx?: number;
  readonly opacity?: number;
}

export interface SceneCircle {
  readonly type: 'circle';
  readonly center: Point;
  readonly radius: number;
  readonly fill: Color;
  readonly stroke: Color;
  readonly strokeWidth: number;
  readonly opacity?: number;
}

export interface ScenePath {
  readonly type: 'path';
  /** Fully resolved SVG path data string. */
  readonly d: string;
  readonly fill?: Color;
  readonly stroke: Color;
  readonly strokeWidth: number;
  readonly strokeDasharray?: string;
  /**
   * Marker def ID (without the `url(#...)` wrapper) — the renderer adds that.
   * The def itself must appear in Scene.defs.
   */
  readonly markerEnd?: string;
  readonly markerStart?: string;
  readonly opacity?: number;
  /**
   * When true and strokeDasharray is set, the SVG renderer emits a SMIL
   * <animate> child on the <path> that cycles stroke-dashoffset by one full
   * dash+gap period — producing a "marching ants" flow animation.
   * Has no effect when strokeDasharray is absent.
   * Degrades cleanly in rsvg-convert (SMIL ignored → static dashed line).
   */
  readonly animated?: boolean;
}

export interface SceneText {
  readonly type: 'text';
  readonly content: string;
  readonly position: Point;
  readonly fontSize: number;
  readonly fontFamily: FontFamily;
  readonly fontWeight?: FontWeight;
  readonly fill: Color;
  readonly anchor?: TextAnchor;
  readonly opacity?: number;
}

/**
 * SceneGroup — a logical grouping of elements.
 *
 * Groups exist for two purposes:
 *   1. Applying a shared transform (e.g. translate a composed sub-diagram).
 *   2. Providing a stable anchor ID for overlay connectors.
 *
 * Groups must not be used for visual styling — use explicit element properties.
 */
export interface SceneGroup {
  readonly type: 'group';
  /** Stable identifier. Required when this group is an overlay anchor target. */
  readonly id?: string;
  readonly children: readonly SceneElement[];
  readonly transform?: string;
  readonly opacity?: number;
}

/** Discriminated union of everything a renderer knows how to paint. */
export type SceneElement =
  | SceneRect
  | SceneCircle
  | ScenePath
  | SceneText
  | SceneGroup;

// ─── Scene Root ───────────────────────────────────────────────────────────────

/**
 * The complete, self-contained output of a layout pass.
 *
 * Immutable after construction. Renderers must not mutate it.
 * All overlay geometry (annotations, legends) has already been resolved
 * into elements[] before this object is produced.
 */
export interface Scene {
  /** The coordinate viewport. Origin is top-left; y grows downward. */
  readonly viewBox: Rect;
  /** Background fill. Absent means transparent. */
  readonly background?: Color;
  /** Ordered elements, painted back-to-front. */
  readonly elements: readonly SceneElement[];
  /**
   * Raw SVG <defs> content — marker definitions, gradients, clip paths.
   * Renderers emit these verbatim inside a <defs> block.
   */
  readonly defs?: readonly string[];
}
