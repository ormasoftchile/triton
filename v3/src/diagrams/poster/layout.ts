import type { PosterDocument, PosterCell, CellContent } from './ir.js';
import type { Scene, SceneElement, Rect } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutFlowchart } from '../flowchart/layout.js';
import { layoutTimeline }  from '../timeline/layout.js';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export function layoutPoster(ir: PosterDocument, theme: ResolvedTheme): Scene {
  const { spacing, palette, typography } = theme;
  const { grid, cells } = ir;

  const gap        = spacing.nodeGap / 2;
  const padding    = spacing.diagramMargin;
  const headerH    = ir.metadata.title ? typography.titleFontSize + 20 : 0;
  const MIN_CELL_W = 200;
  const MIN_CELL_H = 150;
  const MAX_CELL_W = 420;
  const MAX_CELL_H = 320;

  // ── Assign row/col to cells that don't specify them ───────────────────────
  const positioned = assignPositions(cells, grid.columns);

  // ── Layout each child into a Scene ────────────────────────────────────────
  const cellScenes = positioned.map(cell => ({
    cell,
    scene: layoutCellContent(cell.content, theme),
  }));

  const numRows = grid.rows ??
    Math.max(...positioned.map(c => (c.row ?? 0) + (c.rowSpan ?? 1)));

  // Column widths: driven by single-span cells
  const colWidths = new Array<number>(grid.columns).fill(MIN_CELL_W);
  for (const { cell, scene } of cellScenes) {
    if ((cell.colSpan ?? 1) === 1) {
      const col = cell.col ?? 0;
      colWidths[col] = Math.min(MAX_CELL_W, Math.max(colWidths[col]!, scene.viewBox.width));
    }
  }

  // Row heights: driven by single-span cells (scaled proportionally to column width)
  const rowHeights = new Array<number>(numRows).fill(MIN_CELL_H);
  for (const { cell, scene } of cellScenes) {
    if ((cell.rowSpan ?? 1) === 1) {
      const row = cell.row ?? 0;
      const col = cell.col ?? 0;
      const colW  = colWidths[col] ?? MIN_CELL_W;
      const scale = Math.min(colW / Math.max(scene.viewBox.width, 1), 1);
      const fittedH = scene.viewBox.height * scale;
      rowHeights[row] = Math.min(MAX_CELL_H, Math.max(rowHeights[row]!, fittedH));
    }
  }

  // ── Build elements ────────────────────────────────────────────────────────
  const elements: SceneElement[] = [];

  if (ir.metadata.title) {
    elements.push({ type: 'text', content: ir.metadata.title, position: { x: padding, y: padding + typography.titleFontSize }, fontSize: typography.titleFontSize + 2, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
  }

  for (const { cell, scene } of cellScenes) {
    const col     = cell.col ?? 0;
    const row     = cell.row ?? 0;
    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;

    const cellX = padding + sumWithGaps(colWidths, 0, col, gap);
    const cellY = padding + headerH + sumWithGaps(rowHeights, 0, row, gap);
    const cellW = sumWithGaps(colWidths,  col, col + colSpan, gap) - gap;
    const cellH = sumWithGaps(rowHeights, row, row + rowSpan, gap) - gap;

    // Cell chrome
    elements.push({ type: 'rect', bounds: { x: cellX, y: cellY, width: cellW, height: cellH }, fill: palette.surface, stroke: palette.border, strokeWidth: 1, rx: 6 });

    const titleH = cell.title ? 22 : 0;
    if (cell.title) {
      elements.push({ type: 'text', content: cell.title, position: { x: cellX + 8, y: cellY + 16 }, fontSize: typography.baseFontSize, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
    }

    // Embed child scene
    const contentRect: Rect = { x: cellX + 4, y: cellY + titleH + 4, width: cellW - 8, height: cellH - titleH - 8 };
    elements.push(embedScene(scene, contentRect));
  }

  const totalW = padding * 2 + sumWithGaps(colWidths,  0, grid.columns, gap) - gap;
  const totalH = padding * 2 + headerH + sumWithGaps(rowHeights, 0, numRows, gap) - gap;

  return {
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  };
}

// ─── Cell Content Dispatch ────────────────────────────────────────────────────

function layoutCellContent(content: CellContent, theme: ResolvedTheme): Scene {
  const { palette, typography } = theme;

  switch (content.kind) {
    case 'flow':
      return layoutFlowchart(content.doc, theme);
    case 'timeline':
      return layoutTimeline(content.doc, theme);
    case 'text': {
      return {
        viewBox: { x: 0, y: 0, width: 200, height: 60 },
        elements: [{ type: 'text', content: content.text, position: { x: 10, y: 30 }, fontSize: typography.baseFontSize, fontFamily: typography.fontFamily, fill: palette.text }],
      };
    }
    case 'stat': {
      const els: SceneElement[] = [
        { type: 'text', content: content.value, position: { x: 60, y: 38 }, fontSize: 28, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.primary, anchor: 'middle' },
      ];
      if (content.label) {
        els.push({ type: 'text', content: content.label, position: { x: 60, y: 56 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted, anchor: 'middle' });
      }
      return { viewBox: { x: 0, y: 0, width: 120, height: 70 }, elements: els };
    }
  }
}

// ─── Scene Embedding ─────────────────────────────────────────────────────────

function embedScene(scene: Scene, into: Rect): SceneElement {
  const scaleX = into.width  / Math.max(scene.viewBox.width,  1);
  const scaleY = into.height / Math.max(scene.viewBox.height, 1);
  const scale  = Math.min(scaleX, scaleY, 1);

  // Centre within the cell
  const offsetX = into.x + (into.width  - scene.viewBox.width  * scale) / 2;
  const offsetY = into.y + (into.height - scene.viewBox.height * scale) / 2;

  return {
    type:      'group',
    transform: `translate(${offsetX}, ${offsetY}) scale(${scale})`,
    children:  scene.elements as SceneElement[],
  };
}

// ─── Grid Helpers ─────────────────────────────────────────────────────────────

function assignPositions(cells: readonly PosterCell[], columns: number): PosterCell[] {
  let col = 0;
  let row = 0;
  return cells.map(cell => {
    if (cell.row !== undefined && cell.col !== undefined) return cell;
    const assigned = { ...cell, row, col };
    col += cell.colSpan ?? 1;
    if (col >= columns) { col = 0; row++; }
    return assigned;
  });
}

/** Sum widths/heights from index `start` (inclusive) to `end` (exclusive) with gaps. */
function sumWithGaps(sizes: number[], start: number, end: number, gap: number): number {
  let total = 0;
  for (let i = start; i < end; i++) total += (sizes[i] ?? 0) + gap;
  return total;
}
