/**
 * @file scene-transform.ts — Kernel helper: translateAndScale.
 *
 * Pure function that offsets and uniformly scales every coordinate field of a
 * ScenePrimitive (and, recursively, GroupPrimitive children).  This is the
 * mathematical heart of the composition embed mechanism (§30, translateAndScale).
 *
 * Transform contract:
 *   Absolute coordinate (x, y)  →  (x*scale + dx, y*scale + dy)
 *   Dimension  (w, h)           →  (w*scale, h*scale)
 *   Radius / fontSize / strokeWidth → value*scale
 *   Relative-command path deltas →  delta*scale  (no translation)
 *
 * Determinism: all output numbers are rounded with rhu(2dp) — the same
 * round-half-up helper used across every layout engine in this package.
 * This file is used ONLY by the composition layer; existing grammar outputs
 * (goldens) are never routed through this helper.
 */

import type {
  ScenePrimitive,
  LinePrimitive,
  RectPrimitive,
  CirclePrimitive,
  TextPrimitive,
  MultiTextPrimitive,
  PathPrimitive,
  GroupPrimitive,
  ImagePrimitive,
  Scene,
  SceneEffect,
  StrokeGradient,
} from './scene.js';

// ---------------------------------------------------------------------------
// Rounding helper — round-half-up, 2 decimal places (§5.1 item 3)
// ---------------------------------------------------------------------------

/** Round-half-up to 2 decimal places.  Matches the layout engine convention. */
function rhu(v: number): number {
  return Math.floor(v * 100 + 0.5) / 100;
}

// ---------------------------------------------------------------------------
// Effect scaling
// ---------------------------------------------------------------------------

function scaleEffect(effect: SceneEffect, scale: number): SceneEffect {
  if (effect.kind === 'glow') {
    return { kind: 'glow', color: effect.color, radius: rhu(effect.radius * scale) };
  }
  // shadow
  return {
    kind: 'shadow',
    dx: rhu(effect.dx * scale),
    dy: rhu(effect.dy * scale),
    blur: rhu(effect.blur * scale),
    color: effect.color,
  };
}

// ---------------------------------------------------------------------------
// StrokeGradient coordinate transform
// ---------------------------------------------------------------------------

function scaleGradient(
  sg: StrokeGradient,
  dx: number,
  dy: number,
  scale: number,
): StrokeGradient {
  return {
    from: sg.from,
    to: sg.to,
    x1: rhu(sg.x1 * scale + dx),
    y1: rhu(sg.y1 * scale + dy),
    x2: rhu(sg.x2 * scale + dx),
    y2: rhu(sg.y2 * scale + dy),
  };
}

// ---------------------------------------------------------------------------
// dashArray scaling
// ---------------------------------------------------------------------------

function scaleDashArray(dashArray: string, scale: number): string {
  return dashArray
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map((s) => rhu(Number(s) * scale).toString())
    .join(',');
}

// ---------------------------------------------------------------------------
// SVG path `d` string transformation
// ---------------------------------------------------------------------------

/**
 * Parse and transform an SVG path `d` string.
 *
 * Handles all standard commands: M L H V C S Q T A Z (absolute) and their
 * lowercase relative equivalents (m l h v c s q t a z).
 *
 * Transformation rules:
 *   Absolute command coordinates: x' = x*scale + dx,  y' = y*scale + dy
 *   Relative command deltas:      x' = x*scale         (no translation)
 *   H (absolute) x:               x' = x*scale + dx
 *   h (relative) dx:              dx' = dx*scale
 *   V (absolute) y:               y' = y*scale + dy
 *   v (relative) dy:              dy' = dy*scale
 *   A/a arc rx,ry: scale only; x-rotation: unchanged; flags: unchanged
 *   A endpoint: absolute transform; a endpoint: scale only
 */
export function transformPathD(
  d: string,
  dx: number,
  dy: number,
  scale: number,
): string {
  // Tokenise: split on command letters, keeping the letter.
  // Each token = { cmd, args }
  const cmdRe = /([MmLlHhVvCcSsQqTtAaZz])((?:[^MmLlHhVvCcSsQqTtAaZz])*)/g;
  const parts: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = cmdRe.exec(d)) !== null) {
    const cmd = match[1]!;
    const argStr = (match[2] ?? '').trim();
    // Extract numbers including negatives and scientific notation.
    const nums =
      argStr.match(/-?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];

    const upper = cmd.toUpperCase();
    const isRelative = cmd !== cmd.toUpperCase(); // lowercase = relative

    if (upper === 'Z') {
      parts.push(cmd);
      continue;
    }

    // Helpers: transform a single coord value.
    const txX = (v: number): number =>
      isRelative ? rhu(v * scale) : rhu(v * scale + dx);
    const txY = (v: number): number =>
      isRelative ? rhu(v * scale) : rhu(v * scale + dy);

    const newNums: number[] = [];

    switch (upper) {
      case 'M':
      case 'L':
      case 'T': {
        // pairs (x, y)
        for (let i = 0; i + 1 < nums.length; i += 2) {
          newNums.push(txX(nums[i]!), txY(nums[i + 1]!));
        }
        break;
      }
      case 'H': {
        // single x
        for (const v of nums) newNums.push(txX(v));
        break;
      }
      case 'V': {
        // single y
        for (const v of nums) newNums.push(txY(v));
        break;
      }
      case 'C': {
        // 6-number chunks: x1 y1 x2 y2 x y
        for (let i = 0; i + 5 < nums.length; i += 6) {
          newNums.push(
            txX(nums[i]!),     txY(nums[i + 1]!),
            txX(nums[i + 2]!), txY(nums[i + 3]!),
            txX(nums[i + 4]!), txY(nums[i + 5]!),
          );
        }
        break;
      }
      case 'S':
      case 'Q': {
        // 4-number chunks: x1 y1 x y
        for (let i = 0; i + 3 < nums.length; i += 4) {
          newNums.push(
            txX(nums[i]!),     txY(nums[i + 1]!),
            txX(nums[i + 2]!), txY(nums[i + 3]!),
          );
        }
        break;
      }
      case 'A': {
        // 7-number chunks: rx ry x-rot large-arc-flag sweep-flag x y
        for (let i = 0; i + 6 < nums.length; i += 7) {
          newNums.push(
            rhu(nums[i]!     * scale), // rx — scale only
            rhu(nums[i + 1]! * scale), // ry — scale only
            nums[i + 2]!,              // x-rotation — unchanged
            nums[i + 3]!,              // large-arc-flag — unchanged
            nums[i + 4]!,              // sweep-flag — unchanged
            txX(nums[i + 5]!),         // endpoint x
            txY(nums[i + 6]!),         // endpoint y
          );
        }
        break;
      }
      default: {
        // Unknown command: pass args through unchanged
        newNums.push(...nums);
        break;
      }
    }

    parts.push(cmd + (newNums.length > 0 ? newNums.join(' ') : ''));
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Per-primitive transform implementations
// ---------------------------------------------------------------------------

function transformLine(
  p: LinePrimitive,
  dx: number,
  dy: number,
  scale: number,
): LinePrimitive {
  return {
    ...p,
    x1: rhu(p.x1 * scale + dx),
    y1: rhu(p.y1 * scale + dy),
    x2: rhu(p.x2 * scale + dx),
    y2: rhu(p.y2 * scale + dy),
    strokeWidth: rhu(p.strokeWidth * scale),
    ...(p.dashArray !== undefined
      ? { dashArray: scaleDashArray(p.dashArray, scale) }
      : {}),
    ...(p.effects
      ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
      : {}),
  };
}

function transformRect(
  p: RectPrimitive,
  dx: number,
  dy: number,
  scale: number,
): RectPrimitive {
  return {
    ...p,
    x: rhu(p.x * scale + dx),
    y: rhu(p.y * scale + dy),
    width: rhu(p.width * scale),
    height: rhu(p.height * scale),
    ...(p.rx !== undefined ? { rx: rhu(p.rx * scale) } : {}),
    ...(p.strokeWidth !== undefined
      ? { strokeWidth: rhu(p.strokeWidth * scale) }
      : {}),
    ...(p.effects
      ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
      : {}),
  };
}

function transformCircle(
  p: CirclePrimitive,
  dx: number,
  dy: number,
  scale: number,
): CirclePrimitive {
  return {
    ...p,
    cx: rhu(p.cx * scale + dx),
    cy: rhu(p.cy * scale + dy),
    r: rhu(p.r * scale),
    ...(p.strokeWidth !== undefined
      ? { strokeWidth: rhu(p.strokeWidth * scale) }
      : {}),
    ...(p.effects
      ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
      : {}),
  };
}

function transformText(
  p: TextPrimitive,
  dx: number,
  dy: number,
  scale: number,
): TextPrimitive {
  return {
    ...p,
    x: rhu(p.x * scale + dx),
    y: rhu(p.y * scale + dy),
    fontSize: rhu(p.fontSize * scale),
    ...(p.effects
      ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
      : {}),
  };
}

function transformMultiText(
  p: MultiTextPrimitive,
  dx: number,
  dy: number,
  scale: number,
): MultiTextPrimitive {
  return {
    ...p,
    x: rhu(p.x * scale + dx),
    y: rhu(p.y * scale + dy),
    fontSize: rhu(p.fontSize * scale),
    lineHeight: rhu(p.lineHeight * scale),
    ...(p.effects
      ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
      : {}),
  };
}

/**
 * Parse a simple `transform="translate(tx,ty) scale(s)"` attribute.
 * Returns null for any other form.
 */
function parseSimpleTransform(
  transform: string,
): { tx: number; ty: number; s: number } | null {
  const m = transform.match(
    /^\s*translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*scale\(\s*([-\d.]+)\s*\)\s*$/,
  );
  if (!m) return null;
  return { tx: parseFloat(m[1]!), ty: parseFloat(m[2]!), s: parseFloat(m[3]!) };
}

function transformPath(
  p: PathPrimitive,
  dx: number,
  dy: number,
  scale: number,
): PathPrimitive {
  // Icon paths use `transform="translate(tx,ty) scale(s)"` to place 0–24 icon
  // coordinates into canvas space.  When a sub-scene containing such paths is
  // embedded by the composition engine (which calls translateAndScale), we must
  // COMPOSE the icon transform with the composition transform rather than
  // applying the outer transform to the raw 0–24 icon coordinates.
  // Composition: final = compose(outer) ∘ compose(icon)
  //   composed scale:     s_out = icon_s * outer_scale
  //   composed translate: tx_out = icon_tx * outer_scale + dx
  //                       ty_out = icon_ty * outer_scale + dy
  // The transform attribute is then removed (baked into d).
  if (p.transform) {
    const parsed = parseSimpleTransform(p.transform);
    if (parsed) {
      const { tx, ty, s } = parsed;
      const composedS  = rhu(s * scale);
      const composedTx = rhu(tx * scale + dx);
      const composedTy = rhu(ty * scale + dy);
      // strokeWidth in the icon path is pre-divided by iconScale so that SVG's
      // scale(s) restores it to the target rendered width.  After baking,
      // composed strokeWidth = original_sw * s (rendered width) * outer_scale.
      const composedSW = p.strokeWidth !== undefined
        ? rhu(p.strokeWidth * s * scale)
        : undefined;
      return {
        ...p,
        d: transformPathD(p.d, composedTx, composedTy, composedS),
        transform: undefined,
        ...(composedSW !== undefined ? { strokeWidth: composedSW } : {}),
        ...(p.dashArray !== undefined
          ? { dashArray: scaleDashArray(p.dashArray, scale) }
          : {}),
        ...(p.strokeGradient !== undefined
          ? { strokeGradient: scaleGradient(p.strokeGradient, dx, dy, scale) }
          : {}),
        ...(p.effects
          ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
          : {}),
      };
    }
  }

  return {
    ...p,
    d: transformPathD(p.d, dx, dy, scale),
    ...(p.strokeWidth !== undefined
      ? { strokeWidth: rhu(p.strokeWidth * scale) }
      : {}),
    ...(p.dashArray !== undefined
      ? { dashArray: scaleDashArray(p.dashArray, scale) }
      : {}),
    ...(p.strokeGradient !== undefined
      ? { strokeGradient: scaleGradient(p.strokeGradient, dx, dy, scale) }
      : {}),
    ...(p.effects
      ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
      : {}),
  };
}

function transformGroup(
  p: GroupPrimitive,
  dx: number,
  dy: number,
  scale: number,
): GroupPrimitive {
  return {
    ...p,
    primitives: p.primitives.map((child) =>
      translateAndScale(child, dx, dy, scale),
    ),
    ...(p.effects
      ? { effects: p.effects.map((e) => scaleEffect(e, scale)) }
      : {}),
  };
}

function transformImage(
  p: ImagePrimitive,
  dx: number,
  dy: number,
  scale: number,
): ImagePrimitive {
  return {
    ...p,
    x: rhu(p.x * scale + dx),
    y: rhu(p.y * scale + dy),
    width: rhu(p.width * scale),
    height: rhu(p.height * scale),
    ...(p.borderRadius !== undefined
      ? { borderRadius: rhu(p.borderRadius * scale) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure function: offsets and uniformly scales all coordinate fields of a
 * ScenePrimitive (and recursively, GroupPrimitive children).
 *
 * Coordinates: (x,y) → (x*scale + dx, y*scale + dy)
 * Dimensions:  (w,h) → (w*scale, h*scale)
 * Font sizes / stroke widths / radii: value*scale
 * Path `d` strings: all coordinates transformed per the rules above.
 * Relative-command deltas: scaled only (not translated).
 * StrokeGradient x1,y1,x2,y2: absolute transform.
 * dashArray values: scaled.
 *
 * Determinism: output rounded via rhu(2dp).
 */
export function translateAndScale(
  p: ScenePrimitive,
  dx: number,
  dy: number,
  scale: number,
): ScenePrimitive {
  switch (p.kind) {
    case 'line':      return transformLine(p, dx, dy, scale);
    case 'rect':      return transformRect(p, dx, dy, scale);
    case 'circle':    return transformCircle(p, dx, dy, scale);
    case 'text':      return transformText(p, dx, dy, scale);
    case 'multitext': return transformMultiText(p, dx, dy, scale);
    case 'path':      return transformPath(p, dx, dy, scale);
    case 'group':     return transformGroup(p, dx, dy, scale);
    case 'image':     return transformImage(p, dx, dy, scale);
  }
}

/**
 * Convenience: embed a sub-scene inside a target rectangle.
 *
 * Computes a uniform scale factor (aspect-preserving, never upscale) and
 * centering offsets so that the sub-scene fits within `targetRect`, then
 * transforms every primitive and returns the resulting array.
 *
 * The sub-scene background color is NOT embedded — the caller is responsible
 * for rendering the cell background before calling this function.
 */
export function embedSceneInRect(
  scene: Scene,
  targetRect: { x: number; y: number; width: number; height: number },
): ScenePrimitive[] {
  if (scene.width <= 0 || scene.height <= 0) return [];

  // Uniform scale factor — never upscale beyond 1.0.
  const scaleW = targetRect.width / scene.width;
  const scaleH = targetRect.height / scene.height;
  const scale = Math.min(scaleW, scaleH, 1.0);

  // Centering offsets.
  const scaledW = scene.width * scale;
  const scaledH = scene.height * scale;
  const offsetDx = targetRect.x + (targetRect.width - scaledW) / 2;
  const offsetDy = targetRect.y + (targetRect.height - scaledH) / 2;

  return scene.primitives.map((prim) =>
    translateAndScale(prim, offsetDx, offsetDy, scale),
  );
}
