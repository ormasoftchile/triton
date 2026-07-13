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
import type { RenderedConnectorAnimation } from './animations.js';
import type { ResolvedIcon } from './icons.js';

// ─── Element Variants ─────────────────────────────────────────────────────────

export interface SceneRect {
  readonly type: 'rect';
  readonly bounds: Rect;
  readonly fill: Color;
  readonly stroke: Color;
  readonly strokeWidth: number;
  readonly rx?: number;
  readonly fillOpacity?: number;
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
   * When set, the SVG renderer emits a SMIL animation on this path.
   *
   * 'march'    — animates stroke-dashoffset by one full dash+gap period,
   *              producing "marching ants" flow. Requires strokeDasharray;
   *              silently ignored on solid paths.
   * 'particle' — emits a sibling <circle> with <animateMotion> that travels
   *              along the path. Works on any edge style.
   * Other connector animations emit SMIL either inside the path or as sibling
   * motion/gradient elements, while retaining a visible static stroke.
   *
   * Both degrade cleanly in rsvg-convert (SMIL ignored → static line/dot).
   */
  readonly animated?: RenderedConnectorAnimation;
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
 * SceneIcon — render a resolved icon into SVG at a target position and size.
 *
 * This is the P2 render primitive: "given a ResolvedIcon at (x, y) fitting
 * into a `size × size` box, draw it as pure SVG."
 *
 * **P6 seam** — Bjarne's grammar/layout (P6) produces SceneIcon by:
 *   1. Resolving the icon token from a node IR (FlowNode.icon, MindNode.icon,
 *      SeqParticipant.icon, etc.) via resolveIcon().
 *   2. Setting x/y to the icon box top-left within the node's layout rect
 *      (e.g. centered above the label at `nodeX + (nodeW - iconSize)/2`).
 *   3. Setting size to the reserved icon dimension from theme spacing
 *      (e.g. theme.spacing.iconSize or a fixed 32 px default).
 *   4. Optionally setting color to a palette CSS color token for monochrome
 *      tint (e.g. theme.palette.text or "#1e293b"); omit for inherit.
 *
 * Coordinate convention: x/y is the TOP-LEFT of the icon's target bounding
 * box. The SVG renderer centers the icon's content (preserving aspect ratio)
 * inside that box.
 *
 * colorMode contract (enforced by SVG renderer):
 *   'monochrome' → sets `style="color:{color}"` on the SVG wrapper so
 *                  currentColor fills in the body tint to the theme color.
 *   'brand'      → emits body verbatim with no color override; gradient and
 *                  clip IDs are namespaced per instance to prevent collisions.
 */
export interface SceneIcon {
  readonly type: 'icon';
  /** Fully resolved icon — body, viewBox, transforms, colorMode. */
  readonly icon: ResolvedIcon;
  /** Top-left x of the target bounding box (scene units). */
  readonly x: number;
  /** Top-left y of the target bounding box (scene units). */
  readonly y: number;
  /** Side length of the square target bounding box (scene units). */
  readonly size: number;
  /**
   * CSS color value for monochrome tint (e.g. "#1e293b", "var(--color-text)").
   * Applied as `style="color:{color}"` on the nested SVG wrapper so that
   * `currentColor` in the body inherits this tint. Ignored for brand icons.
   * When absent the renderer omits the style attribute (inherits from context).
   */
  readonly color?: string;
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
  | SceneGroup
  | SceneIcon;

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
