/**
 * @file diagrams/packet/layout.ts — Network packet / bit-field diagram.
 *
 * Bits lay out in rows of 32; each field spans its bit range (split across rows
 * when needed) as a labeled cell. Start/end bit numbers sit above row edges.
 * Field fills come from the categorical hue cycle.
 */

import type { PacketDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { truncateText } from '../../../text/wrap.js';
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
    const hue = categoricalHue(i);
    for (let r = Math.floor(f.start / BITS_PER_ROW); r <= Math.floor(f.end / BITS_PER_ROW); r++) {
      const rowStartBit = r * BITS_PER_ROW;
      const cStart = Math.max(f.start, rowStartBit) - rowStartBit;
      const cEnd   = Math.min(f.end, rowStartBit + BITS_PER_ROW - 1) - rowStartBit;
      const x = gridLeft + cStart * bitW;
      const w = (cEnd - cStart + 1) * bitW;
      const y = rowTop(r);
      elements.push(p.rect({ x: rhu(x), y: rhu(y), width: rhu(w), height: rowH }, hue + '33', hue, 1.4, { rx: 3 }));
      const label = truncateText(f.label, labelFont, w - 6);
      elements.push(p.text(label, rhuInt(x + w / 2), rhu(y + rowH / 2 + labelFont * 0.35), labelFont, palette.text, { weight: 'bold', anchor: 'middle' }));
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
