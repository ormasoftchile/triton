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
import {
  measureFormattedText,
  renderFormattedText,
  type FormattedTextLines,
} from '../../../text/formatted.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { borderPoint } from '../../../graph/connect.js';
import { rhu, rhuInt } from '../../../util/round.js';
import { wavifyPath } from '../../../crosslink/render.js';
import type { RenderedConnectorAnimation } from '../../../contracts/animations.js';

const ARROW_END_ID = 'block-arrow';
const ARROW_START_ID = 'block-arrow-start';

function edgeDash(style: string | undefined): string | undefined {
  switch (style) {
    case 'dotted':
      return '6 3';
    case 'dashed':
      return '8 4';
    default:
      return undefined;
  }
}

function edgeStrokeWidth(style: string | undefined, base: number): number {
  return style === 'thick' ? base * 2 : base;
}

export function layoutBlock(ir: BlockDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;

  const cols = Math.max(1, ir.columns);
  const cellW = 150;
  const gap = 40;
  const defaultRowH = 56;
  const titleH = ir.metadata.title ? typography.titleFontSize + 14 : 0;
  const top = margin + titleH;

  // ── Measure blocks ────────────────────────────────────────────────────────
  const blockInfos = new Map<string, FormattedTextLines>();
  for (const b of ir.blocks) {
    const span = Math.min(b.span, cols);
    const w = span * cellW + (span - 1) * gap;
    const info = measureFormattedText(b.label, font, smallFont, w - 24, 4);
    blockInfos.set(b.id, info);
  }

  // ── Pack into the grid with dynamic row heights ───────────────────────────
  const rects = new Map<string, Rect>();
  let col = 0,
    row = 0;
  const rowItems: { b: (typeof ir.blocks)[number]; span: number; col: number; row: number }[] = [];
  const rowMaxLines = new Map<number, number>();

  for (const b of ir.blocks) {
    const span = Math.min(b.span, cols);
    if (col + span > cols) {
      col = 0;
      row += 1;
    }
    const info = blockInfos.get(b.id)!;
    rowMaxLines.set(row, Math.max(rowMaxLines.get(row) ?? 1, info.lineCount));
    rowItems.push({ b, span, col, row });
    col += span;
  }

  // Calculate top y for each row
  const rowY = new Map<number, number>();
  const rowHeightMap = new Map<number, number>();
  let curY = top;
  for (let r = 0; r <= row; r++) {
    const maxL = rowMaxLines.get(r) ?? 1;
    const h = maxL > 1 ? rhu(maxL * (font * 1.25) + 20) : defaultRowH;
    rowY.set(r, curY);
    rowHeightMap.set(r, h);
    curY += h + gap;
  }

  for (const item of rowItems) {
    const x = margin + item.col * (cellW + gap);
    const w = item.span * cellW + (item.span - 1) * gap;
    const y = rowY.get(item.row)!;
    const h = rowHeightMap.get(item.row)!;
    rects.set(item.b.id, { x, y, width: w, height: h });
  }

  const elements: SceneElement[] = [];
  if (ir.metadata.title)
    elements.push(
      p.text(
        ir.metadata.title,
        margin,
        margin + typography.titleFontSize,
        typography.titleFontSize,
        palette.text,
        { weight: 'bold' },
      ),
    );

  // ── Edges (under blocks) ───────────────────────────────────────────────────
  for (const e of ir.edges) {
    const a = rects.get(e.from),
      b = rects.get(e.to);
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
    const path =
      style === 'wavy'
        ? wavifyPath([pa, pb], 3, 12)
        : `M ${rhu(pa.x)} ${rhu(pa.y)} L ${rhu(pb.x)} ${rhu(pb.y)}`;
    elements.push(p.path(path, palette.primary, edgeStrokeWidth(style, 1.6), pathOpts));
    if (e.label)
      elements.push(
        p.text(
          e.label,
          rhuInt((pa.x + pb.x) / 2),
          rhuInt((pa.y + pb.y) / 2 - 4),
          typography.smallFontSize,
          palette.textMuted,
          { anchor: 'middle' },
        ),
      );
  }

  // ── Blocks ─────────────────────────────────────────────────────────────────
  ir.blocks.forEach((b, i) => {
    const r = rects.get(b.id)!;
    const hue = categoricalHue(i, theme);
    const info = blockInfos.get(b.id);
    elements.push(
      p.rect(
        { x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: rhu(r.height) },
        palette.surface,
        hue,
        1.6,
        { rx: 8 },
      ),
    );
    if (info) {
      elements.push(
        ...renderFormattedText(
          p,
          info,
          r.x,
          r.y,
          r.width,
          r.height,
          font,
          smallFont,
          palette.text,
          palette.textMuted,
          { align: 'middle', defaultBold: true },
        ),
      );
    }
  });

  const maxRight = Math.max(margin, ...[...rects.values()].map((r) => r.x + r.width));
  const maxBottom = Math.max(top, ...[...rects.values()].map((r) => r.y + r.height));
  const s = theme.edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);
  const defs = [
    `<marker id="${ARROW_END_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
    `<marker id="${ARROW_START_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
  ];

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: 0, y: 0, width: rhuInt(maxRight + margin), height: rhuInt(maxBottom + margin) },
      background: palette.background,
      elements,
      defs,
    },
    ir.overlays,
    theme,
  );

  return { scene, anchors: {} };
}
