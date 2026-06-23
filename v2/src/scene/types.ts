/**
 * Scene — Universal render-ready intermediate representation.
 *
 * Every diagram type's layout() function produces a Scene.
 * Renderers (SVG, PNG, PDF) consume Scenes without knowing
 * which diagram type produced them.
 */

// ─── Primitives ────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Scene Elements ────────────────────────────────────────────────────────────

export interface SceneText {
  type: 'text';
  content: string;
  position: Point;
  fontSize: number;
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
}

export interface SceneRect {
  type: 'rect';
  bounds: Rect;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rx?: number;
  ry?: number;
}

export interface SceneCircle {
  type: 'circle';
  center: Point;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface ScenePath {
  type: 'path';
  d: string; // SVG path data
  fill?: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  markerEnd?: string;
  markerStart?: string;
}

export interface SceneGroup {
  type: 'group';
  id?: string;
  children: SceneElement[];
  transform?: string;
}

export type SceneElement = SceneText | SceneRect | SceneCircle | ScenePath | SceneGroup;

// ─── Overlays — Shared components for any diagram ──────────────────────────────

/**
 * Annotation — A comment/note block attached to a diagram element.
 *
 * Renders as a styled callout with a dashed connector line to the anchor point.
 * Can reference an element by ID or anchor to an arbitrary position.
 */
export interface Annotation {
  /** Unique identifier */
  id: string;
  /** Comment text (multi-line supported) */
  text: string;
  /** Where to place the annotation box */
  position: Point;
  /** Connection target — either an element ID or a specific point */
  anchor: { elementId: string } | { point: Point };
  /** Optional width override (auto-sized to text if omitted) */
  width?: number;
}

/** Corner positions for placing legends */
export type LegendCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Legend — A structured title/metadata block in a diagram corner.
 *
 * Renders as a bordered table-like block. Think architectural drawing cartouches
 * or UML diagram metadata blocks.
 */
export interface Legend {
  /** Block title (displayed in bold) */
  title?: string;
  /** Key-value rows displayed in the legend */
  entries: LegendEntry[];
  /** Which corner to place the legend (default: bottom-right) */
  corner: LegendCorner;
  /** Optional width override */
  width?: number;
}

export interface LegendEntry {
  key: string;
  value: string;
}

// ─── Scene Root ────────────────────────────────────────────────────────────────

export interface Scene {
  viewBox: Rect;
  background?: string;
  elements: SceneElement[];
  defs?: string[]; // SVG <defs> content (markers, gradients, etc.)
  /** Comment blocks attached to diagram elements */
  annotations?: Annotation[];
  /** Title/metadata legend block in a corner */
  legend?: Legend;
}
