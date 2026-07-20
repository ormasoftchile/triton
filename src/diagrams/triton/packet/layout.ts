/**
 * @file diagrams/packet/layout.ts — Network packet / bit-field diagram.
 *
 * Bits lay out in rows of 32; each field spans its bit range (split across rows
 * when needed) as a labeled cell. Start/end bit numbers sit above row edges.
 * Field fills are theme-derived tints (a semantic token mixed toward the
 * background); labels pick the most readable neutral token via readableText.
 */

import type { PacketDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult, Color } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { readableText } from '../../../theme/contrast.js';
import { truncateText } from '../../../text/wrap.js';
import { measureText } from '../../../text/metrics.js';
import { rhu, rhuInt } from '../../../util/round.js';

const BITS_PER_ROW = 32;

export function layoutPacket(ir: PacketDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const fields = [...ir.fields].sort((a, b) => a.start - b.start);
  const maxBit = Math.max(0, ...fields.map(f => f.end));
  const numRows = Math.floor(maxBit / BITS_PER_ROW) + 1;

  const bitW   = 26;
  const rowH   = 46;
  const rowGap = 26;                    // room for bit-number labels above each row
  const bitFont = typography.smallFontSize;
  const labelFont = typography.smallFontSize;

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 16 : 0;
  const gridLeft = margin;
  const gridTop  = margin + titleH + rowGap;

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // Field cells cycle the theme's semantic accents (never a hardcoded palette).
  const fieldTokens: readonly Color[] = [palette.primary, palette.secondary, palette.success, palette.warning, palette.error];

  const rowTop = (r: number): number => gridTop + r * (rowH + rowGap);

  // Per-row bit ticks (0 and 31 on each row plus multiples of 8).
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c <= BITS_PER_ROW; c += 8) {
      const bit = r * BITS_PER_ROW + c;
      const x = gridLeft + c * bitW;
      if (c < BITS_PER_ROW) elements.push(p.text(String(bit), rhu(x + 2), rhu(rowTop(r) - 6), bitFont, palette.textMuted));
    }
  }

  // Field cells (split across row boundaries).
  fields.forEach((f, i) => {
    const accent = fieldTokens[i % fieldTokens.length]!;
    const fill = mixHex(accent, palette.background, 0.8);   // soft theme-derived tint
    const labelColor = readableText(fill, theme);
    for (let r = Math.floor(f.start / BITS_PER_ROW); r <= Math.floor(f.end / BITS_PER_ROW); r++) {
      const rowStartBit = r * BITS_PER_ROW;
      const cStart = Math.max(f.start, rowStartBit) - rowStartBit;
      const cEnd   = Math.min(f.end, rowStartBit + BITS_PER_ROW - 1) - rowStartBit;
      const x = gridLeft + cStart * bitW;
      const w = (cEnd - cStart + 1) * bitW;
      const y = rowTop(r);
      elements.push(p.rect({ x: rhu(x), y: rhu(y), width: rhu(w), height: rowH }, fill, accent, 1.4, { rx: 3 }));
      // Label: horizontal when it fits; rotate 90° in narrow (≤2-bit) cells so
      // flag labels (URG/ACK/PSH…) stay readable; shrink→truncate as a last resort.
      placeFieldLabel(p, elements, x, y, w, rowH, f.label, labelFont, labelColor, bitFont + 3, bitW * 2);
      // start bit number inside top-left of the cell
      elements.push(p.text(String(f.start), rhu(x + 3), rhu(y + bitFont + 1), bitFont, palette.textMuted));
    }
  });

  const totalW = rhuInt(gridLeft + BITS_PER_ROW * bitW + margin);
  const totalH = rhuInt(rowTop(numRows - 1) + rowH + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}

// ─── Field label placement ───────────────────────────────────────────────────
// Horizontal when the label fits the cell width. For narrow cells (≤ narrowW,
// i.e. 1–2 bit flag fields) the label is rotated 90° (reads bottom-to-top) and
// centered below the start-bit number. Font shrinks toward MIN_LABEL_FONT before
// any truncation, so text is only clipped as an absolute last resort.

const MIN_LABEL_FONT = 7;

function placeFieldLabel(
  p: ReturnType<typeof pen>,
  elements: SceneElement[],
  x: number, y: number, w: number, cellH: number,
  text: string, baseFont: number, color: Color,
  topReserve: number, narrowW: number,
): void {
  const cx = x + w / 2;
  const padX = 6;

  // 1. Horizontal fit at full size — the common case for multi-bit fields.
  if (measureText(text, baseFont).width <= w - padX) {
    elements.push(p.text(text, rhuInt(cx), rhu(y + cellH / 2 + baseFont * 0.35), baseFont, color, { weight: 'bold', anchor: 'middle' }));
    return;
  }

  // 2. Narrow cell → rotate the label into the vertical space below the number.
  if (w <= narrowW) {
    const availV = cellH - topReserve - 4;
    const cy = y + topReserve + availV / 2;
    let f = baseFont;
    while (f > MIN_LABEL_FONT && measureText(text, f).width > availV) f -= 0.5;
    const label = measureText(text, f).width > availV ? truncateText(text, f, availV) : text;
    const px = rhuInt(cx), py = rhu(cy);
    elements.push(p.group(
      [p.text(label, px, rhu(cy + f * 0.35), f, color, { weight: 'bold', anchor: 'middle' })],
      { transform: `rotate(-90 ${px} ${py})` },
    ));
    return;
  }

  // 3. Wide cell, long label → shrink horizontally, then truncate.
  let f = baseFont;
  while (f > MIN_LABEL_FONT && measureText(text, f).width > w - padX) f -= 0.5;
  const label = measureText(text, f).width > w - padX ? truncateText(text, f, w - padX) : text;
  elements.push(p.text(label, rhuInt(cx), rhu(y + cellH / 2 + f * 0.35), f, color, { weight: 'bold', anchor: 'middle' }));
}

// ─── Local colour helpers ───────────────────────────────────────────────────
// mixHex(a, b, t): t=0 → a, t=1 → b. Used to derive a soft tint of a theme
// token toward the theme background so field fills track the active theme.

function parseHex(c: Color): [number, number, number] | null {
  const s = c.trim();
  const m3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m3) return [parseInt(m3[1]! + m3[1]!, 16), parseInt(m3[2]! + m3[2]!, 16), parseInt(m3[3]! + m3[3]!, 16)];
  const m6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m6) return [parseInt(m6[1]!, 16), parseInt(m6[2]!, 16), parseInt(m6[3]!, 16)];
  return null;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function mixHex(a: Color, b: Color, t: number): Color {
  const ca = parseHex(a), cb = parseHex(b);
  if (!ca || !cb) return a;
  return `#${toHex(ca[0] + (cb[0] - ca[0]) * t)}${toHex(ca[1] + (cb[1] - ca[1]) * t)}${toHex(ca[2] + (cb[2] - ca[2]) * t)}`;
}
