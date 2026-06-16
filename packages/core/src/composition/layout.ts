/**
 * @file composition/layout.ts — Composition layout engine.
 *
 * `layoutComposition(doc, themeOverride?)` produces a deterministic Scene
 * from a validated CompositionDocument.
 *
 * Algorithm (deterministic, no iteration):
 *   1. Resolve row/col for each cell in row-major order (if not explicit).
 *   2. Compile each cell's content to a sub-Scene:
 *        - grammar cells → buildFlowScene / buildTreeScene / buildSequenceScene
 *        - stat/text/title cells → synthesised minimal Scene
 *   3. Compute column widths (max content width in each col, single-span only;
 *      then proportionally scale if sum exceeds available width).
 *   4. Recompute row heights from WIDTH-FITTED cell heights (two-pass): for
 *      each cell, fitScale = min(finalColWidth/naturalW, 1.0); fittedH =
 *      naturalH * fitScale; rowHeights[row] = max fittedH.  Eliminates dead
 *      vertical space left by the old one-pass approach.
 *   5. Compute each cell's rectangle (x,y,W,H) from cumulative col/row sizes + gaps.
 *   6. For each cell: scale = min(cellW/subW, cellH/subH, 1.0); center inside cell.
 *      Call embedSceneInRect(subScene, cellRect) to get transformed primitives.
 *      Add panel chrome (background rect + border rect + title text).
 *   7. Add poster-title header at top.
 *   8. Merge all primitives into a single Scene with the total canvas size.
 *
 * Determinism guarantee:
 *   - Each sub-scene is deterministic (grammar contract).
 *   - Cell iteration is row-major (fixed order).
 *   - Grid arithmetic is pure: max, sum, proportional-scale, no randomness.
 *   - translateAndScale (via embedSceneInRect) rounds with rhu(2dp).
 *   - Chrome rendering is theme-deterministic.
 */

import type { Scene, ScenePrimitive } from '../scene.js';
import { translateAndScale } from '../scene-transform.js';
import { measureText } from '../fonts/metrics.js';

import { buildFlowScene }     from '../grammars/flow/index.js';
import { buildTreeScene }     from '../grammars/tree/index.js';
import { buildSequenceScene } from '../grammars/sequence/index.js';
import { buildScene as buildTimelineScene } from '../render/index.js';

import type { CompositionDocument, Cell, CellContent } from './types.js';
import type { CompositionTheme } from './theme.js';
import { resolveCompositionTheme } from './theme.js';

// ---------------------------------------------------------------------------
// Rounding helper — round-half-up to integer (§5.1 item 3)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Simple Scene synthesiser for stat / text / title cells
// ---------------------------------------------------------------------------

/**
 * Synthesise a minimal Scene for a stat cell (large value + label).
 * The scene is sized to a canonical width/height; the composition engine
 * will scale it to fit.
 */
function buildStatScene(
  value: string,
  label: string | undefined,
  theme: CompositionTheme,
): Scene {
  const W = 240;
  const valueFontSize = theme.statValueFont.size;
  const labelFontSize = theme.statLabelFont.size;
  const centerX = W / 2;

  const valueH = rhuInt(valueFontSize * 1.2);
  const labelH = label ? rhuInt(labelFontSize * 1.4) : 0;
  const totalH = rhuInt(valueH + labelH + 24);

  const primitives: ScenePrimitive[] = [
    {
      kind: 'text',
      x: centerX,
      y: rhuInt(totalH / 2 - labelH / 2),
      text: value,
      fontFamily: theme.statValueFont.family,
      fontSize: valueFontSize,
      fontWeight: theme.statValueFont.weight,
      fill: theme.statValueFont.color,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    },
  ];

  if (label) {
    primitives.push({
      kind: 'text',
      x: centerX,
      y: rhuInt(totalH / 2 - labelH / 2 + valueH + 8),
      text: label,
      fontFamily: theme.statLabelFont.family,
      fontSize: labelFontSize,
      fontWeight: theme.statLabelFont.weight,
      fill: theme.statLabelFont.color,
      textAnchor: 'middle',
      dominantBaseline: 'hanging',
    });
  }

  return { width: W, height: totalH, background: 'transparent', primitives };
}

function buildTextScene(text: string, theme: CompositionTheme): Scene {
  const W = 240;
  const fontSize = theme.textFont.size;
  const H = rhuInt(fontSize * 2.4);

  return {
    width: W,
    height: H,
    background: 'transparent',
    primitives: [
      {
        kind: 'text',
        x: 12,
        y: H / 2,
        text,
        fontFamily: theme.textFont.family,
        fontSize,
        fontWeight: theme.textFont.weight,
        fill: theme.textFont.color,
        textAnchor: 'start',
        dominantBaseline: 'central',
      },
    ],
  };
}

function buildTitleScene(text: string, theme: CompositionTheme): Scene {
  const W = 320;
  const fontSize = theme.titleFont.size;
  const H = rhuInt(fontSize * 2.0);

  return {
    width: W,
    height: H,
    background: 'transparent',
    primitives: [
      {
        kind: 'text',
        x: W / 2,
        y: H / 2,
        text,
        fontFamily: theme.titleFont.family,
        fontSize,
        fontWeight: theme.titleFont.weight,
        fill: theme.titleFont.color,
        textAnchor: 'middle',
        dominantBaseline: 'central',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Compile a single cell's content to a sub-Scene
// ---------------------------------------------------------------------------

function compileCellContent(content: CellContent, theme: CompositionTheme): Scene {
  switch (content.kind) {
    case 'flow':     return buildFlowScene(content.doc);
    case 'tree':     return buildTreeScene(content.doc);
    case 'sequence': return buildSequenceScene(content.doc);
    case 'timeline': return buildTimelineScene(content.doc);
    case 'scene':    return content.scene;
    case 'stat':     return buildStatScene(content.value, content.label, theme);
    case 'text':     return buildTextScene(content.text, theme);
    case 'title':    return buildTitleScene(content.text, theme);
    case 'ref':
      // RefCellContent must be resolved by resolveCompositionRefs before layout.
      throw new Error(
        `Cell content kind 'ref' (ir_file: "${content.ir_file}") must be resolved ` +
        `before calling buildCompositionScene. Call resolveCompositionRefs(doc, baseDir) first.`,
      );
  }
}

// ---------------------------------------------------------------------------
// PlacedCell: resolved grid position + sub-scene
// ---------------------------------------------------------------------------

interface PlacedCell {
  cell: Cell;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  subScene: Scene;
}

// ---------------------------------------------------------------------------
// Grid layout computation
// ---------------------------------------------------------------------------

/**
 * Compute the canvas width to use.
 * We use a default of 1200px when no explicit width is specified.
 */
const DEFAULT_CANVAS_WIDTH = 1200;

/**
 * Deterministic grid sizing — two-pass algorithm.
 *
 * Pass 1: Compute natural column widths from single-span cell content widths.
 *   Apply minimum column clamp (80 px), then proportionally scale columns to
 *   fit the available canvas width.
 *
 * Pass 2: Recompute row heights from WIDTH-FITTED cell heights.
 *   When wide cells are proportionally scaled down to fit their (narrowed)
 *   columns, they also render shorter.  Using the natural height (before
 *   column scaling) leaves dead vertical space.  The second pass computes:
 *     fitScale = min(finalColWidth / naturalCellW, 1.0)
 *     fittedCellH = naturalCellH * fitScale
 *   and sets rowHeight = max fittedCellH over single-span cells in that row.
 *
 * The `rowSizing:'equal'` branch normalises to the global max AFTER the
 * two-pass so it still produces uniform row heights based on fitted sizes.
 */
function computeGridLayout(
  placed: PlacedCell[],
  columns: number,
  rows: number,
  theme: CompositionTheme,
  canvasWidth: number,
): {
  colWidths: number[];
  rowHeights: number[];
} {
  const { gap, padding, cellPadding, cellTitleHeight, cellBorder } = theme;
  const chromePadding = cellPadding * 2 + cellBorder.width * 2;
  const chromeHeightExtra = cellTitleHeight + chromePadding;
  const chromeWidthExtra = chromePadding;

  // ── Pass 1a: natural column widths ────────────────────────────────────────
  const colWidths: number[] = new Array(columns).fill(0) as number[];

  for (const pc of placed) {
    if (pc.colSpan === 1) {
      const naturalW = pc.subScene.width + chromeWidthExtra;
      if (naturalW > colWidths[pc.col]!) {
        colWidths[pc.col] = naturalW;
      }
    }
  }

  // Ensure minimum column widths (at least 80px).
  for (let c = 0; c < columns; c++) {
    if (colWidths[c]! < 80) colWidths[c] = 80;
  }

  // ── Pass 1b: proportionally scale columns to fit available width ──────────
  const availableWidth = canvasWidth - 2 * padding - (columns - 1) * gap;
  const totalColW = colWidths.reduce((s, w) => s + w, 0);
  if (totalColW > availableWidth && availableWidth > 0) {
    const ratio = availableWidth / totalColW;
    for (let c = 0; c < columns; c++) {
      colWidths[c] = rhuInt(colWidths[c]! * ratio);
    }
  }

  // ── Pass 2: recompute row heights from WIDTH-FITTED cell heights ──────────
  // For each single-span cell: fitScale = min(finalColWidth / naturalCellW, 1.0)
  // fittedCellH = naturalCellH * fitScale
  // rowHeights[row] = max fittedCellH; then clamp to min 60px.
  const rowHeights: number[] = new Array(rows).fill(0) as number[];

  for (const pc of placed) {
    if (pc.rowSpan === 1) {
      const naturalW = pc.subScene.width + chromeWidthExtra;
      const naturalH = pc.subScene.height + chromeHeightExtra;
      const fitScale = naturalW > 0 ? Math.min(colWidths[pc.col]! / naturalW, 1.0) : 1.0;
      const fittedH = naturalH * fitScale;
      if (fittedH > rowHeights[pc.row]!) {
        rowHeights[pc.row] = fittedH;
      }
    }
  }

  // Ensure minimum row heights (at least 60px).
  for (let r = 0; r < rows; r++) {
    rowHeights[r] = Math.max(rhuInt(rowHeights[r]!), 60);
  }

  // rowSizing: 'equal' normalizes all rows to the global max height AFTER the
  // two-pass so every panel has the same vertical extent based on fitted sizes.
  if (theme.rowSizing === 'equal') {
    const maxRowH = Math.max(...rowHeights);
    for (let r = 0; r < rows; r++) {
      rowHeights[r] = maxRowH;
    }
  }

  return { colWidths, rowHeights };
}

// ---------------------------------------------------------------------------
// Chrome primitives
// ---------------------------------------------------------------------------

function renderCellBackground(
  x: number,
  y: number,
  W: number,
  H: number,
  theme: CompositionTheme,
): ScenePrimitive {
  return {
    kind: 'rect',
    x,
    y,
    width: W,
    height: H,
    fill: theme.cellBackground,
    stroke: theme.cellBorder.color,
    strokeWidth: theme.cellBorder.width,
    rx: theme.cellBorder.radius,
  };
}

function renderCellTitleBar(
  x: number,
  y: number,
  W: number,
  title: string,
  theme: CompositionTheme,
): ScenePrimitive[] {
  const titleH = theme.cellTitleHeight;
  const primitives: ScenePrimitive[] = [];

  // Title bar background
  primitives.push({
    kind: 'rect',
    x: x + theme.cellBorder.width,
    y: y + theme.cellBorder.width,
    width: W - 2 * theme.cellBorder.width,
    height: titleH,
    fill: theme.cellTitleBackground,
    rx: theme.cellBorder.radius,
  });

  // Title text
  primitives.push({
    kind: 'text',
    x: rhuInt(x + theme.cellPadding + theme.cellBorder.width + 8),
    y: rhuInt(y + theme.cellBorder.width + titleH / 2),
    text: title,
    fontFamily: theme.cellTitleFont.family,
    fontSize: theme.cellTitleFont.size,
    fontWeight: theme.cellTitleFont.weight,
    fill: theme.cellTitleFont.color,
    textAnchor: 'start',
    dominantBaseline: 'central',
  });

  return primitives;
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

export function layoutComposition(
  doc: CompositionDocument,
  themeOverride?: CompositionTheme,
): Scene {
  const theme = themeOverride ?? resolveCompositionTheme(doc.metadata.theme);
  const { gap, padding } = theme;
  const columns = doc.grid.columns;

  // ── Step 1: Compile each cell's content to a sub-Scene ───────────────────
  const placed: PlacedCell[] = [];
  let cursor = 0;

  for (const cell of doc.cells) {
    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;

    let col: number;
    let row: number;
    if (cell.col !== undefined && cell.row !== undefined) {
      col = cell.col;
      row = cell.row;
    } else {
      col = cursor % columns;
      row = Math.floor(cursor / columns);
      cursor += colSpan;
    }

    const subScene = compileCellContent(cell.content, theme);
    placed.push({ cell, col, row, colSpan, rowSpan, subScene });
  }

  // Compute effective row count
  const explicitRows = doc.grid.rows;
  const maxRowFromCells = placed.reduce(
    (m, pc) => Math.max(m, pc.row + pc.rowSpan),
    0,
  );
  const rows = explicitRows ?? maxRowFromCells;

  // ── Step 2: Grid layout ───────────────────────────────────────────────────
  const canvasWidth = DEFAULT_CANVAS_WIDTH;
  const { colWidths, rowHeights } = computeGridLayout(
    placed,
    columns,
    rows,
    theme,
    canvasWidth,
  );

  // Header height (poster title)
  const hasTitle = !!doc.metadata.title;
  const headerH = hasTitle ? theme.posterHeaderHeight : 0;

  // Total canvas height
  const totalRowH = rowHeights.reduce((s, h) => s + h, 0);
  const canvasHeight =
    2 * padding + headerH + totalRowH + Math.max(0, rows - 1) * gap;

  // ── Step 3: Build all primitives ──────────────────────────────────────────
  const allPrimitives: ScenePrimitive[] = [];

  // Canvas background
  allPrimitives.push({
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    fill: theme.canvasBackground,
  });

  // Poster header
  if (hasTitle) {
    allPrimitives.push({
      kind: 'rect',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: headerH,
      fill: theme.posterHeaderBackground,
    });
    allPrimitives.push({
      kind: 'text',
      x: canvasWidth / 2,
      y: headerH / 2,
      text: doc.metadata.title!,
      fontFamily: theme.posterTitleFont.family,
      fontSize: theme.posterTitleFont.size,
      fontWeight: theme.posterTitleFont.weight,
      fill: theme.posterTitleFont.color,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
  }

  // Compute cumulative column X offsets
  const colX: number[] = [];
  let cx = padding;
  for (let c = 0; c < columns; c++) {
    colX.push(cx);
    cx += colWidths[c]! + gap;
  }

  // Compute cumulative row Y offsets (below header)
  const rowY: number[] = [];
  let ry = padding + headerH;
  for (let r = 0; r < rows; r++) {
    rowY.push(ry);
    ry += rowHeights[r]! + gap;
  }

  // Per-cell: chrome + sub-scene embed
  for (const pc of placed) {
    // Cell rectangle (including spans)
    const cellX = colX[pc.col]!;
    const cellY = rowY[pc.row]!;
    const cellW =
      colWidths
        .slice(pc.col, pc.col + pc.colSpan)
        .reduce((s, w) => s + w, 0) +
      (pc.colSpan - 1) * gap;
    const cellH =
      rowHeights
        .slice(pc.row, pc.row + pc.rowSpan)
        .reduce((s, h) => s + h, 0) +
      (pc.rowSpan - 1) * gap;

    // Background + border
    allPrimitives.push(
      renderCellBackground(cellX, cellY, cellW, cellH, theme),
    );

    // Title bar (if cell has a title)
    const hasCaption = !!pc.cell.title;
    if (hasCaption) {
      allPrimitives.push(
        ...renderCellTitleBar(cellX, cellY, cellW, pc.cell.title!, theme),
      );
    }

    // Sub-scene embed rect (inset by border + padding + title bar)
    const chromePad = theme.cellPadding + theme.cellBorder.width;
    const titleBarH = hasCaption ? theme.cellTitleHeight : 0;
    const embedX = cellX + chromePad;
    const embedY = cellY + chromePad + titleBarH;
    const embedW = cellW - 2 * chromePad;
    const embedH = cellH - 2 * chromePad - titleBarH;

    if (embedW > 0 && embedH > 0 && pc.subScene.primitives.length > 0) {
      const sub = pc.subScene;
      if (sub.width > 0 && sub.height > 0) {
        const scaleW = embedW / sub.width;
        const scaleH = embedH / sub.height;
        const scale = Math.min(scaleW, scaleH, 1.0);
        const scaledW = sub.width * scale;
        const scaledH = sub.height * scale;

        // Horizontal alignment
        const alignDx =
          theme.cellHAlign === 'center'
            ? embedX + (embedW - scaledW) / 2
            : embedX; // 'left'

        // Vertical alignment
        const alignDy =
          theme.cellVAlign === 'top'
            ? embedY
            : embedY + (embedH - scaledH) / 2; // 'center' or 'fill'

        allPrimitives.push(
          ...sub.primitives.map((prim) =>
            translateAndScale(prim, alignDx, alignDy, scale),
          ),
        );
      }
    }
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
    background: theme.canvasBackground,
    primitives: allPrimitives,
  };
}

// ---------------------------------------------------------------------------
// CellTransform + layoutCompositionFull — for anchor-to-poster transforms (§30b)
// ---------------------------------------------------------------------------

/**
 * The translate+scale transform applied to one cell's sub-scene during
 * composition layout.  Used by the poster link layer to transform local-space
 * node anchors to poster coordinates:
 *
 *   x_poster = x_local * scale + dx
 *   y_poster = y_local * scale + dy
 *   w_poster = w_local * scale
 *   h_poster = h_local * scale
 */
export interface CellTransform {
  row: number;
  col: number;
  /** X translation applied to sub-scene primitives (poster coordinate space). */
  dx: number;
  /** Y translation applied to sub-scene primitives (poster coordinate space). */
  dy: number;
  /** Uniform scale factor applied to sub-scene (≤ 1.0 — no upscale). */
  scale: number;
}

/**
 * Like `layoutComposition` but also returns the per-cell `CellTransform` array.
 *
 * The Scene is byte-identical to `layoutComposition` output.  `cellTransforms`
 * allows the poster link layer to convert local-cell anchor coordinates to
 * poster-level coordinates without repeating the grid arithmetic.
 */
export function layoutCompositionFull(
  doc: CompositionDocument,
  themeOverride?: CompositionTheme,
): { scene: Scene; cellTransforms: CellTransform[] } {
  const theme = themeOverride ?? resolveCompositionTheme(doc.metadata.theme);
  const { gap, padding } = theme;
  const columns = doc.grid.columns;

  const placed: PlacedCell[] = [];
  let cursor = 0;

  for (const cell of doc.cells) {
    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;

    let col: number;
    let row: number;
    if (cell.col !== undefined && cell.row !== undefined) {
      col = cell.col;
      row = cell.row;
    } else {
      col = cursor % columns;
      row = Math.floor(cursor / columns);
      cursor += colSpan;
    }

    const subScene = compileCellContent(cell.content, theme);
    placed.push({ cell, col, row, colSpan, rowSpan, subScene });
  }

  const explicitRows = doc.grid.rows;
  const maxRowFromCells = placed.reduce(
    (m, pc) => Math.max(m, pc.row + pc.rowSpan),
    0,
  );
  const rows = explicitRows ?? maxRowFromCells;

  const canvasWidth = DEFAULT_CANVAS_WIDTH;
  const { colWidths, rowHeights } = computeGridLayout(placed, columns, rows, theme, canvasWidth);

  const hasTitle = !!doc.metadata.title;
  const headerH = hasTitle ? theme.posterHeaderHeight : 0;
  const totalRowH = rowHeights.reduce((s, h) => s + h, 0);
  const canvasHeight =
    2 * padding + headerH + totalRowH + Math.max(0, rows - 1) * gap;

  const allPrimitives: ScenePrimitive[] = [];
  allPrimitives.push({
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    fill: theme.canvasBackground,
  });

  if (hasTitle) {
    allPrimitives.push({
      kind: 'rect',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: headerH,
      fill: theme.posterHeaderBackground,
    });
    allPrimitives.push({
      kind: 'text',
      x: canvasWidth / 2,
      y: headerH / 2,
      text: doc.metadata.title!,
      fontFamily: theme.posterTitleFont.family,
      fontSize: theme.posterTitleFont.size,
      fontWeight: theme.posterTitleFont.weight,
      fill: theme.posterTitleFont.color,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
  }

  const colX: number[] = [];
  let cx2 = padding;
  for (let c = 0; c < columns; c++) {
    colX.push(cx2);
    cx2 += colWidths[c]! + gap;
  }

  const rowY: number[] = [];
  let ry = padding + headerH;
  for (let r = 0; r < rows; r++) {
    rowY.push(ry);
    ry += rowHeights[r]! + gap;
  }

  const cellTransforms: CellTransform[] = [];

  for (const pc of placed) {
    const cellX = colX[pc.col]!;
    const cellY = rowY[pc.row]!;
    const cellW =
      colWidths.slice(pc.col, pc.col + pc.colSpan).reduce((s, w) => s + w, 0) +
      (pc.colSpan - 1) * gap;
    const cellH =
      rowHeights.slice(pc.row, pc.row + pc.rowSpan).reduce((s, h) => s + h, 0) +
      (pc.rowSpan - 1) * gap;

    allPrimitives.push(renderCellBackground(cellX, cellY, cellW, cellH, theme));

    const hasCaption = !!pc.cell.title;
    if (hasCaption) {
      allPrimitives.push(...renderCellTitleBar(cellX, cellY, cellW, pc.cell.title!, theme));
    }

    const chromePad = theme.cellPadding + theme.cellBorder.width;
    const titleBarH = hasCaption ? theme.cellTitleHeight : 0;
    const embedX = cellX + chromePad;
    const embedY = cellY + chromePad + titleBarH;
    const embedW = cellW - 2 * chromePad;
    const embedH = cellH - 2 * chromePad - titleBarH;

    let dx = embedX;
    let dy = embedY;
    let scale = 1.0;

    if (embedW > 0 && embedH > 0 && pc.subScene.primitives.length > 0) {
      const sub = pc.subScene;
      if (sub.width > 0 && sub.height > 0) {
        const scaleW = embedW / sub.width;
        const scaleH = embedH / sub.height;
        scale = Math.min(scaleW, scaleH, 1.0);
        const scaledW = sub.width * scale;
        const scaledH = sub.height * scale;

        dx =
          theme.cellHAlign === 'center'
            ? embedX + (embedW - scaledW) / 2
            : embedX;

        dy =
          theme.cellVAlign === 'top'
            ? embedY
            : embedY + (embedH - scaledH) / 2;

        allPrimitives.push(
          ...sub.primitives.map((prim) => translateAndScale(prim, dx, dy, scale)),
        );
      }
    }

    cellTransforms.push({ row: pc.row, col: pc.col, dx, dy, scale });
  }

  return {
    scene: {
      width: canvasWidth,
      height: canvasHeight,
      background: theme.canvasBackground,
      primitives: allPrimitives,
    },
    cellTransforms,
  };
}
