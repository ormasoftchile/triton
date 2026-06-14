/**
 * @file grammars/kanban/layout.ts — Kanban Board layout engine.
 *
 * Produces a Scene IR from a KanbanDocument. Layout strategy:
 *   - Columns side-by-side, each a fixed width.
 *   - Each column: colored header band (title) + stacked rounded card boxes.
 *   - Card text wraps at cardMaxWidth (line-based word-wrap).
 *   - Column height = header + sum of card heights + gaps + bottom padding.
 *   - Total canvas height = tallest column.
 *
 * Fidelity reference: real Mermaid kanban shows colored header bands with
 * column title (white bold text), white rounded card boxes stacked beneath.
 */

import type {
  RectPrimitive,
  Scene,
  ScenePrimitive,
  TextPrimitive,
} from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';

import type { KanbanCard, KanbanColumn, KanbanDocument } from './types.js';
import type { KanbanTheme } from './theme.js';
import { resolveKanbanTheme } from './theme.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

/** Simple word-wrap: split text into lines that fit within maxWidth px. */
function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  if (words.length === 0) return [text];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const w = measureText(candidate, fontSize).width;
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

// ---------------------------------------------------------------------------
// Card measurement
// ---------------------------------------------------------------------------

interface MeasuredCard {
  card: KanbanCard;
  lines: string[];
  height: number;
}

function measureCard(card: KanbanCard, tk: KanbanTheme): MeasuredCard {
  const lines = wrapText(card.label, tk.cardFontSize, tk.cardMaxWidth - 2 * tk.cardPadX);
  const textHeight = lines.length * (tk.cardFontSize * 1.4);
  const hasPriority = card.metadata?.priority !== undefined;
  const extraHeight = hasPriority ? rhuInt(tk.cardFontSize * 1.2) : 0;
  const height = rhuInt(2 * tk.cardPadY + textHeight + extraHeight);
  return { card, lines, height };
}

// ---------------------------------------------------------------------------
// Build column primitives
// ---------------------------------------------------------------------------

function buildColumnPrimitives(
  col: KanbanColumn,
  colIndex: number,
  x: number,
  maxHeight: number,
  measuredCards: MeasuredCard[],
  tk: KanbanTheme,
): ScenePrimitive[] {
  const prims: ScenePrimitive[] = [];
  const headerColor = tk.headerColors[colIndex % tk.headerColors.length] ?? tk.headerColors[0]!;

  // Total column height = maxHeight to keep all columns same height
  const colH = maxHeight;

  // Column background rect
  prims.push({
    kind: 'rect',
    x,
    y: 0,
    width: tk.columnWidth,
    height: colH,
    fill: tk.columnFill,
    stroke: tk.columnStroke,
    strokeWidth: tk.columnStrokeWidth,
    rx: tk.columnRx,
  } satisfies RectPrimitive);

  // Header band
  prims.push({
    kind: 'rect',
    x,
    y: 0,
    width: tk.columnWidth,
    height: tk.headerHeight,
    fill: headerColor,
    stroke: 'none',
    strokeWidth: 0,
    rx: tk.columnRx,
  } satisfies RectPrimitive);

  // Small rect to square off the bottom corners of the header (so only top has rx)
  prims.push({
    kind: 'rect',
    x,
    y: rhuInt(tk.headerHeight - tk.columnRx),
    width: tk.columnWidth,
    height: tk.columnRx,
    fill: headerColor,
    stroke: 'none',
    strokeWidth: 0,
    rx: 0,
  } satisfies RectPrimitive);

  // Header title text
  prims.push({
    kind: 'text',
    x: rhuInt(x + tk.columnWidth / 2),
    y: rhuInt(tk.headerHeight / 2 + tk.headerFontSize * 0.35),
    text: col.label,
    fontFamily: tk.fontFamily,
    fontSize: tk.headerFontSize,
    fontWeight: tk.headerFontWeight,
    fill: tk.headerTextColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  } satisfies TextPrimitive);

  // Cards stacked below header
  let cardY = rhuInt(tk.headerHeight + tk.cardGap);
  for (const mc of measuredCards) {
    const cardX = rhuInt(x + tk.cardPadX - 2); // slight inset
    const cardW  = rhuInt(tk.columnWidth - 2 * (tk.cardPadX - 2));

    prims.push({
      kind: 'rect',
      x: cardX,
      y: cardY,
      width: cardW,
      height: mc.height,
      fill: tk.cardFill,
      stroke: tk.cardStroke,
      strokeWidth: tk.cardStrokeWidth,
      rx: tk.cardRx,
    } satisfies RectPrimitive);

    const lineHeight = tk.cardFontSize * 1.4;
    let textY = rhuInt(cardY + tk.cardPadY + tk.cardFontSize * 0.85);
    for (const line of mc.lines) {
      prims.push({
        kind: 'text',
        x: rhuInt(cardX + tk.cardPadX),
        y: textY,
        text: line,
        fontFamily: tk.fontFamily,
        fontSize: tk.cardFontSize,
        fontWeight: tk.cardFontWeight,
        fill: tk.cardTextColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
      textY = rhuInt(textY + lineHeight);
    }

    // Priority badge (small colored dot + text)
    const priority = mc.card.metadata?.priority?.toLowerCase();
    if (priority) {
      const dotColor =
        priority === 'high' ? tk.priorityHighColor :
        priority === 'medium' ? tk.priorityMedColor :
        priority === 'low' ? tk.priorityLowColor :
        tk.priorityMedColor;
      const badgeFontSize = rhuInt(tk.cardFontSize * 0.85);
      const badgeY = rhuInt(cardY + mc.height - tk.cardPadY - badgeFontSize * 0.3);
      prims.push({
        kind: 'text',
        x: rhuInt(cardX + tk.cardPadX),
        y: badgeY,
        text: `▲ ${priority}`,
        fontFamily: tk.fontFamily,
        fontSize: badgeFontSize,
        fontWeight: 500,
        fill: dotColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }

    cardY = rhuInt(cardY + mc.height + tk.cardGap);
  }

  return prims;
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

export function layoutKanban(doc: KanbanDocument, themeOverride?: KanbanTheme): Scene {
  const tk = themeOverride ?? resolveKanbanTheme(doc.metadata.theme);

  if (doc.columns.length === 0) {
    return {
      width:      rhuInt(tk.marginLeft + tk.marginRight),
      height:     rhuInt(tk.marginTop  + tk.marginBottom),
      background: tk.background,
      primitives: [],
    };
  }

  // Pre-measure all cards per column
  const measuredColumns = doc.columns.map((col) => ({
    col,
    cards: col.cards.map((c) => measureCard(c, tk)),
  }));

  // Compute each column's content height
  const colContentHeights = measuredColumns.map(({ cards }) => {
    if (cards.length === 0) return tk.headerHeight + tk.cardGap + tk.columnBottomPad;
    const cardsH = cards.reduce((sum, mc) => sum + mc.height, 0);
    const gapsH  = (cards.length + 1) * tk.cardGap;
    return rhuInt(tk.headerHeight + gapsH + cardsH + tk.columnBottomPad);
  });

  const maxColHeight = Math.max(...colContentHeights);

  // Build all column primitives, offset by marginLeft + col*(columnWidth+gap) + marginTop (y-offset)
  const allPrims: ScenePrimitive[] = [];
  const numCols   = doc.columns.length;
  const totalW    = rhuInt(tk.marginLeft + numCols * tk.columnWidth + (numCols - 1) * tk.columnGap + tk.marginRight);
  const totalH    = rhuInt(tk.marginTop + maxColHeight + tk.marginBottom);

  for (let ci = 0; ci < measuredColumns.length; ci++) {
    const { col, cards } = measuredColumns[ci]!;
    const colX = rhuInt(tk.marginLeft + ci * (tk.columnWidth + tk.columnGap));

    const colPrims = buildColumnPrimitives(col, ci, colX, maxColHeight, cards, tk);

    // Shift all prims down by marginTop
    for (const p of colPrims) {
      if ('y' in p && typeof p.y === 'number')   (p as { y: number }).y  = rhuInt(p.y + tk.marginTop);
      if ('y1' in p && typeof p.y1 === 'number') (p as { y1: number }).y1 = rhuInt(p.y1 + tk.marginTop);
      if ('y2' in p && typeof p.y2 === 'number') (p as { y2: number }).y2 = rhuInt(p.y2 + tk.marginTop);
    }
    allPrims.push(...colPrims);
  }

  return {
    width:      totalW,
    height:     totalH,
    background: tk.background,
    primitives: allPrims,
  };
}
