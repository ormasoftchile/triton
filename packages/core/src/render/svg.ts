/**
 * @file render/svg.ts — Deterministic Scene → SVG string serialiser.
 *
 * All attribute values are formatted with fixed decimal precision (2 dp,
 * round-half-up) and in a stable alphabetical order within each element.
 * Element order matches the Scene primitive list (painter's algorithm).
 *
 * CONTRACT: returns a plain `string` — never a Buffer, stream, or promise.
 */

import type { Scene, ScenePrimitive, ImagePrimitive, StrokeGradient, SceneAnimation } from '../scene.js';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Round-half-up to 2 decimal places and format as a compact number string. */
function fmt(v: number): string {
  const r = Math.floor(v * 100 + 0.5) / 100;
  // Suppress trailing ".00" for cleaner output; keep single-decimal ".X0" → ".X"
  if (r % 1 === 0) return String(r);
  const s = r.toFixed(2);
  return s.replace(/\.?0+$/, '');
}

/** Escape XML special characters in attribute values and text content. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Attribute builder — always sorted alphabetically for determinism
// ---------------------------------------------------------------------------

type AttrMap = Record<string, string | number | undefined>;

function attrs(map: AttrMap): string {
  const keys = Object.keys(map).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = map[k];
    if (v === undefined) continue;
    const vs = typeof v === 'number' ? fmt(v) : esc(String(v));
    parts.push(`${k}="${vs}"`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

// ---------------------------------------------------------------------------
// Animation helpers (§14 dashflow — additive, SVG only)
// ---------------------------------------------------------------------------

/**
 * Compute the total period of a CSS stroke-dasharray string.
 * e.g. "8,5" → 13; "6,4" → 10; "2,4,2" → 8.
 * Returns 0 for empty or unparseable strings (animation is silently omitted).
 */
function dashPeriod(dashArray: string): number {
  return dashArray
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => isFinite(n))
    .reduce((sum, n) => sum + n, 0);
}

/**
 * Build a SMIL <animate> element for a dashflow animation hint.
 * Returns the element string (indented) or empty string if the hint cannot
 * produce a valid animation (no dashArray period derivable).
 *
 * The initial stroke-dashoffset on the parent element is 0 (the SVG default)
 * so that static renderers (resvg/Skia) show the resting frame unchanged.
 */
function dashflowAnimate(
  anim: SceneAnimation,
  dashArray: string,
  indent: string,
): string {
  if (anim.kind !== 'dashflow') return '';
  const period = dashPeriod(dashArray);
  if (period <= 0) return '';
  const fromVal = anim.from !== undefined ? anim.from : period;
  const toVal   = anim.to   !== undefined ? anim.to   : 0;
  const animAttrs: AttrMap = {
    attributeName: 'stroke-dashoffset',
    dur:           `${anim.durSec}s`,
    from:          fromVal,
    repeatCount:   'indefinite',
    to:            toVal,
  };
  return `${indent}  <animate${attrs(animAttrs)}/>`;
}

// ---------------------------------------------------------------------------
// Stroke-gradient and fill-gradient helpers (for PathPrimitive)
// ---------------------------------------------------------------------------

/**
 * Derive a deterministic, content-based SVG ID for a stroke gradient.
 *
 * The ID encodes the endpoint coordinates and stop colours so it is stable
 * across re-renders and unique per distinct gradient.  Periods in the
 * coordinate strings are replaced with 'd' to stay within safe XML name chars.
 */
function strokeGradientId(sg: StrokeGradient): string {
  const c = (v: number) => fmt(v).replace('.', 'd');
  const col = (s: string) => s.replace('#', '').toLowerCase();
  return `sg-${c(sg.x1)}-${c(sg.y1)}-${c(sg.x2)}-${c(sg.y2)}-${col(sg.from)}-${col(sg.to)}`;
}

/** Derive a deterministic SVG ID for a fill gradient (prefix `fg-`). */
function fillGradientId(sg: StrokeGradient): string {
  const c = (v: number) => fmt(v).replace('.', 'd');
  const col = (s: string) => s.replace('#', '').toLowerCase();
  return `fg-${c(sg.x1)}-${c(sg.y1)}-${c(sg.x2)}-${c(sg.y2)}-${col(sg.from)}-${col(sg.to)}`;
}

/**
 * Recursively collect `<linearGradient>` defs needed for PathPrimitives
 * that carry a `strokeGradient` or `fillGradient`.  Deduplicates by ID so
 * that identical gradients appearing in multiple paths emit only one def.
 */
function collectGradientDefs(primitives: ScenePrimitive[]): string[] {
  const seen = new Set<string>();
  const defs: string[] = [];

  function emitGradient(sg: StrokeGradient, id: string): void {
    if (seen.has(id)) return;
    seen.add(id);
    const lgAttrs: AttrMap = {
      gradientUnits: 'userSpaceOnUse',
      id,
      x1: sg.x1,
      x2: sg.x2,
      y1: sg.y1,
      y2: sg.y2,
    };
    const stop0 = `    <stop offset="0%" stop-color="${esc(sg.from)}"/>`;
    const stop1 = `    <stop offset="100%" stop-color="${esc(sg.to)}"/>`;
    defs.push(`  <linearGradient${attrs(lgAttrs)}>
${stop0}
${stop1}
  </linearGradient>`);
  }

  function walk(prims: ScenePrimitive[]): void {
    for (const p of prims) {
      if (p.kind === 'path') {
        if (p.strokeGradient) emitGradient(p.strokeGradient, strokeGradientId(p.strokeGradient));
        if (p.fillGradient)   emitGradient(p.fillGradient,   fillGradientId(p.fillGradient));
      }
      if (p.kind === 'group') walk(p.primitives);
    }
  }

  walk(primitives);
  return defs;
}

// ---------------------------------------------------------------------------
// Primitive → SVG element
// ---------------------------------------------------------------------------

function primitiveToSvg(p: ScenePrimitive, depth: number): string {
  const indent = '  '.repeat(depth);

  switch (p.kind) {
    case 'rect': {
      const a: AttrMap = {
        fill:   p.fill,
        height: p.height,
        rx:     p.rx,
        stroke: p.stroke,
        'stroke-width': p.strokeWidth,
        opacity: p.opacity,
        width:  p.width,
        x:      p.x,
        y:      p.y,
      };
      return `${indent}<rect${attrs(a)}/>`;
    }

    case 'circle': {
      const a: AttrMap = {
        cx:      p.cx,
        cy:      p.cy,
        fill:    p.fill,
        opacity: p.opacity,
        r:       p.r,
        stroke:  p.stroke,
        'stroke-width': p.strokeWidth,
      };
      return `${indent}<circle${attrs(a)}/>`;
    }

    case 'line': {
      const a: AttrMap = {
        opacity:        p.opacity,
        stroke:         p.stroke,
        'stroke-dasharray': p.dashArray,
        'stroke-dashoffset': (p.animation && p.dashArray) ? 0 : undefined,
        'stroke-width': p.strokeWidth,
        x1:             p.x1,
        x2:             p.x2,
        y1:             p.y1,
        y2:             p.y2,
      };
      if (p.animation && p.dashArray) {
        const animEl = dashflowAnimate(p.animation, p.dashArray, indent);
        if (animEl) {
          return `${indent}<line${attrs(a)}>\n${animEl}\n${indent}</line>`;
        }
      }
      return `${indent}<line${attrs(a)}/>`;
    }

    case 'text': {
      const a: AttrMap = {
        'dominant-baseline': p.dominantBaseline,
        fill:                p.fill,
        'font-family':       p.fontFamily,
        'font-size':         p.fontSize,
        'font-weight':       p.fontWeight,
        opacity:             p.opacity,
        'text-anchor':       p.textAnchor,
        x:                   p.x,
        y:                   p.y,
      };
      return `${indent}<text${attrs(a)}>${esc(p.text)}</text>`;
    }

    case 'multitext': {
      const a: AttrMap = {
        'dominant-baseline': p.dominantBaseline,
        fill:                p.fill,
        'font-family':       p.fontFamily,
        'font-size':         p.fontSize,
        'font-weight':       p.fontWeight,
        opacity:             p.opacity,
        'text-anchor':       p.textAnchor,
        x:                   p.x,
        y:                   p.y,
      };
      const tspans = p.lines.map((line, i) => {
        const dy = i === 0 ? 0 : p.lineHeight;
        return `${indent}  <tspan dy="${fmt(dy)}" x="${fmt(p.x)}">${esc(line)}</tspan>`;
      }).join('\n');
      if (p.lines.length === 0) return '';
      if (p.lines.length === 1) {
        return `${indent}<text${attrs(a)}>${esc(p.lines[0] ?? '')}</text>`;
      }
      return `${indent}<text${attrs(a)}>\n${tspans}\n${indent}</text>`;
    }

    case 'path': {
      // fillGradient / strokeGradient take precedence over flat solid colours.
      const fillRef   = p.fillGradient   ? `url(#${fillGradientId(p.fillGradient)})`     : p.fill;
      const strokeRef = p.strokeGradient ? `url(#${strokeGradientId(p.strokeGradient)})` : p.stroke;
      const a: AttrMap = {
        d:            p.d,
        fill:         fillRef,
        'fill-rule':  p.fillRule,
        opacity:      p.opacity,
        stroke:       strokeRef,
        'stroke-dasharray': p.dashArray,
        'stroke-dashoffset': (p.animation && p.dashArray) ? 0 : undefined,
        'stroke-linecap': p.strokeLinecap,
        'stroke-width': p.strokeWidth,
        transform:    p.transform,
      };
      if (p.animation && p.dashArray) {
        const animEl = dashflowAnimate(p.animation, p.dashArray, indent);
        if (animEl) {
          return `${indent}<path${attrs(a)}>\n${animEl}\n${indent}</path>`;
        }
      }
      return `${indent}<path${attrs(a)}/>`;
    }

    case 'group': {
      const a: AttrMap = {
        id:      p.id,
        opacity: p.opacity,
      };
      const children = p.primitives.map((c) => primitiveToSvg(c, depth + 1)).join('\n');
      return `${indent}<g${attrs(a)}>\n${children}\n${indent}</g>`;
    }

    case 'image': {
      const a: AttrMap = {
        height:  p.height,
        href:    p.data,
        opacity: p.opacity,
        width:   p.width,
        x:       p.x,
        y:       p.y,
      };
      if (p.borderRadius) {
        // Reference the clip path defined in the <defs> block (see collectImageClipDefs)
        const clipId = imageClipId(p);
        (a as Record<string, string | number | undefined>)['clip-path'] = `url(#${clipId})`;
      }
      return `${indent}<image${attrs(a)}/>`;
    }
  }
}

// ---------------------------------------------------------------------------
// Image clip-path helpers (for borderRadius on ImagePrimitive)
// ---------------------------------------------------------------------------

/** Deterministic clip-path ID derived from image geometry. */
function imageClipId(p: ImagePrimitive): string {
  return `img-clip-${fmt(p.x)}-${fmt(p.y)}-${fmt(p.width)}-${fmt(p.height)}`;
}

/** Recursively collect <clipPath> defs needed for ImagePrimitive.borderRadius. */
function collectImageClipDefs(primitives: ScenePrimitive[]): string[] {
  const defs: string[] = [];
  for (const p of primitives) {
    if (p.kind === 'image' && p.borderRadius) {
      const id = imageClipId(p);
      const rectAttrs: AttrMap = {
        height: p.height,
        rx:     p.borderRadius,
        width:  p.width,
        x:      p.x,
        y:      p.y,
      };
      defs.push(`  <clipPath id="${id}"><rect${attrs(rectAttrs)}/></clipPath>`);
    }
    if (p.kind === 'group') {
      defs.push(...collectImageClipDefs(p.primitives));
    }
  }
  return defs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialise a Scene to an SVG string.
 *
 * The output is a complete, self-contained SVG document with:
 *  - fixed `xmlns` declaration
 *  - stable attribute ordering within every element
 *  - 2-dp round-half-up coordinate precision
 *  - no embedded fonts (the font-family CSS name is used; the PNG backend
 *    handles font injection for rasterisation)
 */
export function sceneToSvg(scene: Scene): string {
  const { width: W, height: H } = scene;

  const rootAttrs: AttrMap = {
    height:  H,
    version: '1.1',
    viewBox: `0 0 ${fmt(W)} ${fmt(H)}`,
    width:   W,
    xmlns:   'http://www.w3.org/2000/svg',
  };

  // Collect clip-path defs for ImagePrimitives with borderRadius (if any)
  const clipDefs = collectImageClipDefs(scene.primitives);
  // Collect linearGradient defs for PathPrimitives with strokeGradient (if any)
  const gradDefs = collectGradientDefs(scene.primitives);
  const allDefs = [...clipDefs, ...gradDefs];
  const defsBlock = allDefs.length > 0
    ? `<defs>\n${allDefs.join('\n')}\n</defs>\n`
    : '';

  const elements = scene.primitives.map((p) => primitiveToSvg(p, 1)).join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg${attrs(rootAttrs)}>`,
    ...(defsBlock ? [defsBlock] : []),
    elements,
    `</svg>`,
  ].join('\n');
}
