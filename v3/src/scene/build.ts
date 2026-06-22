/**
 * @file scene/build.ts — Scene-element construction helpers.
 *
 * A `Pen` is bound once to a theme and produces SceneElements, removing the
 * `type` discriminant and the repeated `fontFamily: typography.fontFamily`
 * plumbing from every call site. Shapes take explicit colours (which vary per
 * element); only the font family — the one token that is invariant per theme —
 * is defaulted. Output is identical to the equivalent object literals.
 */

import type {
  SceneElement, SceneText, SceneRect, SceneCircle, ScenePath, SceneGroup,
  Rect, Point, Color, FontWeight, TextAnchor, ResolvedTheme,
} from '../contracts/index.js';

export interface TextOpts {
  weight?: FontWeight;
  anchor?: TextAnchor;
  opacity?: number;
}

export interface RectOpts {
  rx?: number;
  opacity?: number;
}

export interface PathOpts {
  fill?: Color;
  dash?: string;
  markerEnd?: string;
  markerStart?: string;
  animated?: 'march' | 'particle';
  opacity?: number;
}

export interface GroupOpts {
  id?: string;
  transform?: string;
  opacity?: number;
}

export interface Pen {
  /** Text at (x, y) with the theme font family; size + fill are explicit. */
  text(content: string, x: number, y: number, size: number, fill: Color, opts?: TextOpts): SceneText;
  rect(bounds: Rect, fill: Color, stroke: Color, strokeWidth: number, opts?: RectOpts): SceneRect;
  circle(center: Point, radius: number, fill: Color, stroke: Color, strokeWidth: number, opts?: { opacity?: number }): SceneCircle;
  path(d: string, stroke: Color, strokeWidth: number, opts?: PathOpts): ScenePath;
  group(children: readonly SceneElement[], opts?: GroupOpts): SceneGroup;
}

/** Create a Pen bound to a theme's font family. */
export function pen(theme: ResolvedTheme): Pen {
  const fontFamily = theme.typography.fontFamily;
  return {
    text(content, x, y, size, fill, opts = {}) {
      return {
        type: 'text', content, position: { x, y }, fontSize: size, fontFamily, fill,
        ...(opts.weight !== undefined  ? { fontWeight: opts.weight } : {}),
        ...(opts.anchor !== undefined  ? { anchor: opts.anchor } : {}),
        ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}),
      };
    },
    rect(bounds, fill, stroke, strokeWidth, opts = {}) {
      return {
        type: 'rect', bounds, fill, stroke, strokeWidth,
        ...(opts.rx !== undefined      ? { rx: opts.rx } : {}),
        ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}),
      };
    },
    circle(center, radius, fill, stroke, strokeWidth, opts = {}) {
      return {
        type: 'circle', center, radius, fill, stroke, strokeWidth,
        ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}),
      };
    },
    path(d, stroke, strokeWidth, opts = {}) {
      return {
        type: 'path', d, stroke, strokeWidth,
        ...(opts.fill !== undefined      ? { fill: opts.fill } : {}),
        ...(opts.dash !== undefined      ? { strokeDasharray: opts.dash } : {}),
        ...(opts.markerEnd !== undefined ? { markerEnd: opts.markerEnd } : {}),
        ...(opts.markerStart !== undefined ? { markerStart: opts.markerStart } : {}),
        ...(opts.animated !== undefined  ? { animated: opts.animated } : {}),
        ...(opts.opacity !== undefined   ? { opacity: opts.opacity } : {}),
      };
    },
    group(children, opts = {}) {
      return {
        type: 'group', children,
        ...(opts.id !== undefined        ? { id: opts.id } : {}),
        ...(opts.transform !== undefined ? { transform: opts.transform } : {}),
        ...(opts.opacity !== undefined   ? { opacity: opts.opacity } : {}),
      };
    },
  };
}
