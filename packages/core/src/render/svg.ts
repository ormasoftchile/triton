/**
 * @file render/svg.ts — Deterministic Scene → SVG string serialiser.
 *
 * All attribute values are formatted with fixed decimal precision (2 dp,
 * round-half-up) and in a stable alphabetical order within each element.
 * Element order matches the Scene primitive list (painter's algorithm).
 *
 * CONTRACT: returns a plain `string` — never a Buffer, stream, or promise.
 */

import type { Scene, ScenePrimitive } from '../scene.js';

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
        'stroke-width': p.strokeWidth,
        x1:             p.x1,
        x2:             p.x2,
        y1:             p.y1,
        y2:             p.y2,
      };
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
      const a: AttrMap = {
        d:            p.d,
        fill:         p.fill,
        'fill-rule':  p.fillRule,
        opacity:      p.opacity,
        stroke:       p.stroke,
        'stroke-linecap': p.strokeLinecap,
        'stroke-width': p.strokeWidth,
        transform:    p.transform,
      };
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
  }
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

  const elements = scene.primitives.map((p) => primitiveToSvg(p, 1)).join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg${attrs(rootAttrs)}>`,
    elements,
    `</svg>`,
  ].join('\n');
}
