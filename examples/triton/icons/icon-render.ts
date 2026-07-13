/**
 * examples/triton/icons/icon-render.ts
 *
 * Visual verification example for P2 icon render.
 *
 * Produces a 300×200 SVG containing:
 *   - A monochrome icon (currentColor path) tinted in slate-blue
 *   - A brand icon (hardcoded fill #0078D4 rect)
 *   - A brand icon with a linearGradient (ID-namespaced to avoid collisions)
 *   - A monochrome icon rotated 90° (demonstrates transform wrapping)
 *
 * Run:
 *   npx tsx examples/triton/icons/icon-render.ts > examples/triton/icons/icon-render.svg
 *   rsvg-convert -w 600 examples/triton/icons/icon-render.svg > examples/triton/icons/icon-render.png
 *
 * Visual check (expected):
 *   Four icons side-by-side on a light-grey background:
 *   1. A filled square path in slate (#334155) — monochrome tint
 *   2. An Azure-blue (#0078D4) filled square — brand verbatim
 *   3. A square with a blue gradient (deep→mid blue) — namespaced gradient
 *   4. The same mono path rotated 90° (tall diamond orientation)
 *   Labels below each icon identify the render mode.
 */

import { renderSVG } from '../../../src/render/svg.js';
import type { Scene, SceneIcon, SceneText, SceneRect } from '../../../src/contracts/index.js';
import type { ResolvedIcon } from '../../../src/contracts/icons.js';

// ─── Icon fixtures ────────────────────────────────────────────────────────────

const MONO: ResolvedIcon = {
  body: '<rect fill="currentColor" x="2" y="2" width="20" height="20" rx="3"/>',
  viewBox: { width: 24, height: 24, left: 0, top: 0 },
  transforms: { rotate: 0, hFlip: false, vFlip: false },
  colorMode: 'monochrome',
};

const BRAND: ResolvedIcon = {
  body: '<rect fill="#0078D4" x="1" y="1" width="22" height="22" rx="3"/>',
  viewBox: { width: 24, height: 24, left: 0, top: 0 },
  transforms: { rotate: 0, hFlip: false, vFlip: false },
  colorMode: 'brand',
};

const GRAD: ResolvedIcon = {
  body: [
    '<defs>',
    '  <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">',
    '    <stop offset="0%" stop-color="#0078D4"/>',
    '    <stop offset="100%" stop-color="#003A70"/>',
    '  </linearGradient>',
    '</defs>',
    '<rect fill="url(#a)" x="1" y="1" width="22" height="22" rx="3"/>',
  ].join(''),
  viewBox: { width: 24, height: 24, left: 0, top: 0 },
  transforms: { rotate: 0, hFlip: false, vFlip: false },
  colorMode: 'brand',
};

const MONO_ROT: ResolvedIcon = {
  ...MONO,
  transforms: { rotate: 1, hFlip: false, vFlip: false },
};

// ─── Scene assembly ───────────────────────────────────────────────────────────

const PAD  = 20;
const SIZE = 48;
const GAP  = 20;
const W    = PAD * 2 + SIZE * 4 + GAP * 3;
const H    = PAD * 2 + SIZE + 24;

function icon(ri: ResolvedIcon, col: number, color?: string): SceneIcon {
  return {
    type: 'icon',
    icon: ri,
    x: PAD + col * (SIZE + GAP),
    y: PAD,
    size: SIZE,
    ...(color !== undefined ? { color } : {}),
  };
}

function label(text: string, col: number): SceneText {
  return {
    type: 'text',
    content: text,
    position: { x: PAD + col * (SIZE + GAP) + SIZE / 2, y: PAD + SIZE + 16 },
    fontSize: 10,
    fontFamily: 'monospace',
    fill: '#555',
    anchor: 'middle',
  };
}

const bg: SceneRect = {
  type: 'rect',
  bounds: { x: 0, y: 0, width: W, height: H },
  fill: '#f8fafc',
  stroke: 'none',
  strokeWidth: 0,
};

const scene: Scene = {
  viewBox: { x: 0, y: 0, width: W, height: H },
  background: '#f8fafc',
  elements: [
    bg,
    icon(MONO,     0, '#334155'),
    icon(BRAND,    1),
    icon(GRAD,     2),
    icon(MONO_ROT, 3, '#7c3aed'),
    label('mono',    0),
    label('brand',   1),
    label('gradient',2),
    label('rotate90',3),
  ],
};

process.stdout.write(renderSVG(scene));
