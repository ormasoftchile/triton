/**
 * @file diagrams/kanban/layout.ts — Column-of-cards board.
 *
 * Each column is a coloured header (from the categorical hue cycle) above a
 * vertical stack of wrapped card tiles. Columns are laid left→right at a fixed
 * width; the board height follows the tallest column.
 */

import type { KanbanDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { categoricalHue } from '../../palette/categorical.js';
import { wrapText } from '../../text/wrap.js';
import { rhuInt } from '../../util/round.js';

export function layoutKanban(ir: KanbanDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const colW       = 210;
  const colGap     = 18;
  const headerH    = 38;
  const cardPad    = 10;
  const cardGap    = 10;
  const cardFont   = typography.baseFontSize;
  const lineH      = rhuInt(cardFont * 1.3);
  const cardInnerW = colW - cardPad * 2;

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 16 : 0;
  const boardTop = margin + titleH;

  // Pre-wrap cards to compute heights.
  const columns = ir.columns.map(col => ({
    label: col.label,
    cards: col.cards.map(c => {
      const lines = wrapText(c.text, cardFont, cardInnerW - 2, 3).lines;
      const h = cardPad * 2 + lines.length * lineH;
      return { lines, h };
    }),
  }));

  const elements: SceneElement[] = [];

  if (title) {
    elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  let maxColH = 0;
  columns.forEach((col, ci) => {
    const x = margin + ci * (colW + colGap);
    const hue = categoricalHue(ci);

    // Column header
    elements.push(p.rect({ x, y: boardTop, width: colW, height: headerH }, hue, hue, 0, { rx: 6 }));
    elements.push(p.text(`${col.label}  (${col.cards.length})`, rhuInt(x + colW / 2), boardTop + headerH / 2 + cardFont * 0.35, typography.baseFontSize, '#FFFFFF', { weight: 'bold', anchor: 'middle' }));

    // Cards
    let cy = boardTop + headerH + cardGap;
    for (const card of col.cards) {
      elements.push(p.rect({ x, y: cy, width: colW, height: card.h }, palette.surface, hue, 1, { rx: 6 }));
      card.lines.forEach((ln, li) => {
        elements.push(p.text(ln, x + cardPad, cy + cardPad + (li + 1) * lineH - 4, cardFont, palette.text));
      });
      cy += card.h + cardGap;
    }
    maxColH = Math.max(maxColH, cy - boardTop);
  });

  const totalW = rhuInt(margin + columns.length * colW + (columns.length - 1) * colGap + margin);
  const totalH = rhuInt(boardTop + maxColH + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
