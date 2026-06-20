/**
 * Poster Layout — Arranges child diagram Scenes in a grid.
 *
 * The key insight: poster doesn't know how to render flowcharts or
 * timelines. It delegates to their modules, gets back a Scene, then
 * scales/positions that Scene into a grid cell.
 *
 * This is what proves the architecture: every diagram produces a Scene,
 * and poster composes Scenes without coupling to diagram internals.
 */

import type { PosterDocument, PosterCell, CellContent } from './ir.js';
import type { Scene, SceneElement, Rect } from '../../scene/types.js';
import type { ResolvedTheme } from '../../theme/types.js';

// Import sibling diagram layout functions
import { layoutFlowchart } from '../flowchart/layout.js';
import { layoutTimeline } from '../timeline/layout.js';

// ─── Public Entry Point ────────────────────────────────────────────────────────

export function layoutPoster(ir: PosterDocument, theme: ResolvedTheme): Scene {
  const { spacing, palette, typography } = theme;
  const { grid, cells } = ir;

  // Step 1: Assign positions to cells that lack explicit row/col
  const positioned = assignPositions(cells, grid.columns);

  // Step 2: Layout each cell's content into an independent Scene
  const cellScenes = positioned.map(cell => ({
    cell,
    scene: layoutCellContent(cell.content, theme),
  }));

  // Step 3: Compute grid dimensions (content-driven)
  const numRows = grid.rows ?? Math.max(...positioned.map(c => (c.row ?? 0) + (c.rowSpan ?? 1)));
  const gap = spacing.nodeGap / 2;
  const padding = spacing.diagramMargin;
  const headerHeight = ir.metadata.title ? 40 : 0;

  // Column widths: max natural width of single-span cells in each column
  const colWidths = new Array(grid.columns).fill(200); // min width
  for (const { cell, scene } of cellScenes) {
    if ((cell.colSpan ?? 1) === 1) {
      const col = cell.col ?? 0;
      colWidths[col] = Math.max(colWidths[col], scene.viewBox.width);
    }
  }

  // Normalize column widths (cap at reasonable max)
  const maxColWidth = 400;
  for (let i = 0; i < colWidths.length; i++) {
    colWidths[i] = Math.min(colWidths[i], maxColWidth);
  }

  // Row heights: max natural height of single-span cells in each row
  const rowHeights = new Array(numRows).fill(150); // min height
  for (const { cell, scene } of cellScenes) {
    if ((cell.rowSpan ?? 1) === 1) {
      const row = cell.row ?? 0;
      // Scale height proportionally to column width
      const colW = colWidths[cell.col ?? 0];
      const scale = Math.min(colW / scene.viewBox.width, 1);
      const fittedH = scene.viewBox.height * scale;
      rowHeights[row] = Math.max(rowHeights[row], fittedH);
    }
  }

  const maxRowHeight = 300;
  for (let i = 0; i < rowHeights.length; i++) {
    rowHeights[i] = Math.min(rowHeights[i], maxRowHeight);
  }

  // Step 4: Compute cell rectangles and embed sub-scenes
  const elements: SceneElement[] = [];

  // Poster title
  if (ir.metadata.title) {
    elements.push({
      type: 'text',
      content: ir.metadata.title,
      position: { x: padding, y: padding + 20 },
      fontSize: typography.titleFontSize + 4,
      fontFamily: typography.fontFamily,
      fontWeight: 'bold',
      fill: palette.text,
    });
  }

  for (const { cell, scene } of cellScenes) {
    const col = cell.col ?? 0;
    const row = cell.row ?? 0;
    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;

    // Cell rectangle
    const cellX = padding + sumWithGaps(colWidths, 0, col, gap);
    const cellY = padding + headerHeight + sumWithGaps(rowHeights, 0, row, gap);
    const cellW = sumWithGaps(colWidths, col, col + colSpan, gap) - gap;
    const cellH = sumWithGaps(rowHeights, row, row + rowSpan, gap) - gap;

    const cellRect: Rect = { x: cellX, y: cellY, width: cellW, height: cellH };

    // Cell chrome: background + border
    elements.push({
      type: 'rect',
      bounds: cellRect,
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
      rx: 6,
      ry: 6,
    });

    // Cell title
    const titleOffset = cell.title ? 20 : 0;
    if (cell.title) {
      elements.push({
        type: 'text',
        content: cell.title,
        position: { x: cellX + 8, y: cellY + 16 },
        fontSize: typography.baseFontSize,
        fontFamily: typography.fontFamily,
        fontWeight: 'bold',
        fill: palette.text,
      });
    }

    // Embed the sub-scene (scale + translate into cell)
    const contentRect: Rect = {
      x: cellX + 4,
      y: cellY + titleOffset + 4,
      width: cellW - 8,
      height: cellH - titleOffset - 8,
    };
    const embedded = embedScene(scene, contentRect);
    elements.push(embedded);
  }

  // Compute total canvas size
  const totalWidth = padding * 2 + sumWithGaps(colWidths, 0, grid.columns, gap) - gap;
  const totalHeight = padding * 2 + headerHeight + sumWithGaps(rowHeights, 0, numRows, gap) - gap;

  return {
    viewBox: { x: 0, y: 0, width: totalWidth, height: totalHeight },
    background: palette.background,
    elements,
  };
}

// ─── Child Content → Scene Dispatch ────────────────────────────────────────────

function layoutCellContent(content: CellContent, theme: ResolvedTheme): Scene {
  switch (content.kind) {
    case 'flow':
      return layoutFlowchart(content.doc, theme);
    case 'timeline':
      return layoutTimeline(content.doc, theme);
    case 'text':
      return textScene(content.text, theme);
    case 'stat':
      return statScene(content.value, content.label, theme);
  }
}

function textScene(text: string, theme: ResolvedTheme): Scene {
  return {
    viewBox: { x: 0, y: 0, width: 200, height: 60 },
    elements: [{
      type: 'text',
      content: text,
      position: { x: 10, y: 30 },
      fontSize: theme.typography.baseFontSize,
      fontFamily: theme.typography.fontFamily,
      fill: theme.palette.text,
    }],
  };
}

function statScene(value: string, label: string | undefined, theme: ResolvedTheme): Scene {
  const elements: SceneElement[] = [
    {
      type: 'text',
      content: value,
      position: { x: 60, y: 35 },
      fontSize: 28,
      fontFamily: theme.typography.fontFamily,
      fontWeight: 'bold',
      fill: theme.palette.primary,
      anchor: 'middle',
    },
  ];
  if (label) {
    elements.push({
      type: 'text',
      content: label,
      position: { x: 60, y: 55 },
      fontSize: theme.typography.smallFontSize,
      fontFamily: theme.typography.fontFamily,
      fill: theme.palette.textMuted,
      anchor: 'middle',
    });
  }
  return { viewBox: { x: 0, y: 0, width: 120, height: 70 }, elements };
}

// ─── Scene Embedding (scale + translate) ───────────────────────────────────────

function embedScene(scene: Scene, target: Rect): SceneElement {
  const { viewBox, elements } = scene;
  const scaleX = target.width / viewBox.width;
  const scaleY = target.height / viewBox.height;
  const scale = Math.min(scaleX, scaleY, 1); // never upscale

  const scaledW = viewBox.width * scale;
  const scaledH = viewBox.height * scale;
  // Center within target
  const dx = target.x + (target.width - scaledW) / 2;
  const dy = target.y + (target.height - scaledH) / 2;

  return {
    type: 'group',
    transform: `translate(${r(dx)}, ${r(dy)}) scale(${r(scale)})`,
    children: elements,
  };
}

// ─── Grid Helpers ──────────────────────────────────────────────────────────────

function assignPositions(cells: PosterCell[], columns: number): PosterCell[] {
  let autoRow = 0;
  let autoCol = 0;

  return cells.map(cell => {
    const row = cell.row ?? autoRow;
    const col = cell.col ?? autoCol;

    // Advance auto-position
    autoCol = col + (cell.colSpan ?? 1);
    if (autoCol >= columns) {
      autoCol = 0;
      autoRow = row + 1;
    }

    return { ...cell, row, col };
  });
}

function sumWithGaps(arr: number[], from: number, to: number, gap: number): number {
  let total = 0;
  for (let i = from; i < to; i++) {
    total += arr[i] + gap;
  }
  return total;
}

function r(n: number): string {
  return Math.round(n * 100) / 100 + '';
}
