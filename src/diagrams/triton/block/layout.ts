/**
 * @file diagrams/block/layout.ts — Block diagram (column grid).
 *
 * Blocks pack left→right into a fixed column grid, honouring per-block column
 * spans and wrapping when a span would overflow the row. Edges connect block
 * centres, clipped to borders, with an arrowhead.
 */

import type { BlockDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult, Rect } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { borderPoint } from '../../../graph/connect.js';
import { rhu, rhuInt } from '../../../util/round.js';
import { wavifyPath } from '../../../crosslink/render.js';
import type { RenderedConnectorAnimation } from '../../../contracts/animations.js';

const ARROW_END_ID = 'block-arrow';
const ARROW_START_ID = 'block-arrow-start';

function edgeDash(style: string | undefined): string | undefined {
  switch (style) {
    case 'dotted': return '6 3';
    case 'dashed': return '8 4';
    default: return undefined;
  }
}

function edgeStrokeWidth(style: string | undefined, base: number): number {
  return style === 'thick' ? base * 2 : base;
}

export function layoutBlock(ir: BlockDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const cols   = Math.max(1, ir.columns);
  const cellW  = 150;
  const gap    = 40;
  const rowH   = 56;
  const titleH = ir.metadata.title ? typography.titleFontSize + 14 : 0;
  const top    = margin + titleH;

  // ── Pack into the grid ─────────────────────────────────────────────────────
  const rects = new Map<string, Rect>();
  let col = 0, row = 0;
  for (const b of ir.blocks) {
    const span = Math.min(b.span, cols);
    if (col + span > cols) { col = 0; row += 1; }
    const x = margin + col * (cellW + gap);
    const w = span * cellW + (span - 1) * gap;
    const y = top + row * (rowH + gap);
    rects.set(b.id, { x, y, width: w, height: rowH });
    col += span;
  }

  const elements: SceneElement[] = [];
  if (ir.metadata.title) elements.push(p.text(ir.metadata.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Edges (under blocks) ───────────────────────────────────────────────────
  for (const e of ir.edges) {
    const a = rects.get(e.from), b = rects.get(e.to);
    if (!a || !b) continue;
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const pa = borderPoint(a, bc.x, bc.y);
    const pb = borderPoint(b, ac.x, ac.y);
    const style = e.style ?? 'solid';
    const pathOpts: Parameters<typeof p.path>[3] = {};
    if ((e.endMarker ?? 'arrow') === 'arrow') pathOpts.markerEnd = ARROW_END_ID;
    if (e.startMarker === 'arrow') pathOpts.markerStart = ARROW_START_ID;
    const dash = edgeDash(style);
    if (dash) pathOpts.dash = dash;
    let anim: RenderedConnectorAnimation | undefined;
    if (e.animation === 'none') anim = undefined;
    else if (e.animation) anim = e.animation;
    else if (style === 'dotted' || style === 'dashed') anim = 'march';
    if (anim) pathOpts.animated = anim;
    const path = style === 'wavy'
      ? wavifyPath([pa, pb], 3, 12)
      : `M ${rhu(pa.x)} ${rhu(pa.y)} L ${rhu(pb.x)} ${rhu(pb.y)}`;
    elements.push(p.path(path, palette.primary, edgeStrokeWidth(style, 1.6), pathOpts));
    if (e.label) elements.push(p.text(e.label, rhuInt((pa.x + pb.x) / 2), rhuInt((pa.y + pb.y) / 2 - 4), typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
  }

  // ── Blocks ─────────────────────────────────────────────────────────────────
  ir.blocks.forEach((b, i) => {
    const r = rects.get(b.id)!;
    const hue = categoricalHue(i);
    elements.push(p.rect({ x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: rhu(r.height) }, palette.surface, hue, 1.6, { rx: 8 }));
    elements.push(p.text(b.label, rhuInt(r.x + r.width / 2), rhuInt(r.y + r.height / 2 + typography.baseFontSize * 0.35), typography.baseFontSize, palette.text, { weight: 'bold', anchor: 'middle' }));
  });

  const maxRight  = Math.max(margin, ...[...rects.values()].map(r => r.x + r.width));
  const maxBottom = Math.max(top, ...[...rects.values()].map(r => r.y + r.height));
  const defs = [
    `<marker id="${ARROW_END_ID}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 4, 0 8" fill="${palette.primary}" /></marker>`,
    `<marker id="${ARROW_START_ID}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points="0 0, 10 4, 0 8" fill="${palette.primary}" /></marker>`,
  ];

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: rhuInt(maxRight + margin), height: rhuInt(maxBottom + margin) },
    background: palette.background,
    elements,
    defs,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
