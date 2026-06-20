import type { PosterDocument, PosterCell, CellContent } from './ir.js';
import type { Scene, SceneElement, Rect, LayoutResult, NodeAnchor, NodeAnchorRegistry } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { getModule } from '../../frontend/registry.js';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export async function layoutPoster(ir: PosterDocument, theme: ResolvedTheme): Promise<LayoutResult> {
  const { spacing, palette, typography } = theme;
  const { grid, cells } = ir;

  const unit       = spacing.unit;
  const gap        = spacing.nodeGap / 2;
  const padding    = spacing.diagramMargin;
  const headerH    = ir.metadata.title ? typography.titleFontSize + unit * 2 : 0;
  const MIN_CELL_W = unit * 20;
  const MIN_CELL_H = unit * 15;
  const MAX_CELL_W = unit * 42;
  const MIN_EMBED_SCALE = 0.65;   // minimum scale — cells expand to ensure readability

  // ── Assign row/col to cells that don't specify them ───────────────────────
  const positioned = assignPositions(cells, grid.columns);

  // ── Layout each child into a LayoutResult ──────────────────────────────────
  const cellResults = await Promise.all(
    positioned.map(async cell => ({
      cell,
      result: await layoutCellContent(cell.content, theme),
    })),
  );

  const numRows = grid.rows ??
    Math.max(...positioned.map(c => (c.row ?? 0) + (c.rowSpan ?? 1)));

  // Column widths: ensure child content is readable at MIN_EMBED_SCALE
  // Readability takes priority over MAX_CELL_W
  const colWidths = new Array<number>(grid.columns).fill(MIN_CELL_W);
  for (const { cell, result } of cellResults) {
    if ((cell.colSpan ?? 1) === 1) {
      const col = cell.col ?? 0;
      const inset = unit / 2;
      // Cell must be wide enough that child fits at MIN_EMBED_SCALE
      const needed = result.scene.viewBox.width * MIN_EMBED_SCALE + inset * 2;
      colWidths[col] = Math.max(colWidths[col]!, needed);
    }
  }

  // Row heights: proportional to column width, respecting MIN_EMBED_SCALE
  const rowHeights = new Array<number>(numRows).fill(MIN_CELL_H);
  for (const { cell, result } of cellResults) {
    if ((cell.rowSpan ?? 1) === 1) {
      const row = cell.row ?? 0;
      const col = cell.col ?? 0;
      const cellTitleH = cell.title ? typography.baseFontSize + unit : 0;
      const inset = unit / 2;
      const colW = colWidths[col] ?? MIN_CELL_W;
      const contentW = colW - inset * 2;
      const scale = Math.min(contentW / Math.max(result.scene.viewBox.width, 1), 1);
      // If scale < MIN_EMBED_SCALE, the column already expanded; recompute
      const effectiveScale = Math.max(scale, MIN_EMBED_SCALE);
      const neededH = result.scene.viewBox.height * effectiveScale + cellTitleH + inset * 2;
      rowHeights[row] = Math.max(rowHeights[row]!, neededH);
    }
  }

  // ── Build elements ────────────────────────────────────────────────────────
  const elements: SceneElement[] = [];

  if (ir.metadata.title) {
    elements.push({ type: 'text', content: ir.metadata.title, position: { x: padding, y: padding + typography.titleFontSize }, fontSize: typography.titleFontSize + 2, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
  }

  // ── Build anchor registry (hierarchical, path-prefixed) ───────────────────
  const mergedAnchors: Record<string, NodeAnchor> = {};

  for (const { cell, result } of cellResults) {
    const col     = cell.col ?? 0;
    const row     = cell.row ?? 0;
    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;
    const cellId  = cell.id ?? cellAddressFromPosition(row, col);

    const cellX = padding + sumWithGaps(colWidths, 0, col, gap);
    const cellY = padding + headerH + sumWithGaps(rowHeights, 0, row, gap);
    const cellW = sumWithGaps(colWidths,  col, col + colSpan, gap) - gap;
    const cellH = sumWithGaps(rowHeights, row, row + rowSpan, gap) - gap;

    // Cell chrome
    elements.push({ type: 'rect', bounds: { x: cellX, y: cellY, width: cellW, height: cellH }, fill: palette.surface, stroke: palette.border, strokeWidth: 1, rx: 6 });

    const cellTitleH = cell.title ? typography.baseFontSize + unit : 0;
    if (cell.title) {
      elements.push({ type: 'text', content: cell.title, position: { x: cellX + unit, y: cellY + typography.baseFontSize + unit / 2 }, fontSize: typography.baseFontSize, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
    }

    // Embed child scene
    const inset = unit / 2;
    const contentRect: Rect = { x: cellX + inset, y: cellY + cellTitleH + inset, width: cellW - inset * 2, height: cellH - cellTitleH - inset * 2 };
    elements.push(embedScene(result.scene, contentRect));

    // Transform child anchors to poster coordinates and merge
    const scaleX = contentRect.width  / Math.max(result.scene.viewBox.width,  1);
    const scaleY = contentRect.height / Math.max(result.scene.viewBox.height, 1);
    const scale  = Math.min(scaleX, scaleY, 1);
    const offsetX = contentRect.x + (contentRect.width  - result.scene.viewBox.width  * scale) / 2;
    const offsetY = contentRect.y + (contentRect.height - result.scene.viewBox.height * scale) / 2;

    for (const [nodeId, anchor] of Object.entries(result.anchors)) {
      const prefixedId = `${cellId}.${nodeId}`;
      const transformed: NodeAnchor = {
        bounds: {
          x:      anchor.bounds.x * scale + offsetX,
          y:      anchor.bounds.y * scale + offsetY,
          width:  anchor.bounds.width * scale,
          height: anchor.bounds.height * scale,
        },
        ...(anchor.ports ? {
          ports: Object.fromEntries(
            Object.entries(anchor.ports).map(([side, pt]) => [
              side,
              { x: pt!.x * scale + offsetX, y: pt!.y * scale + offsetY },
            ]),
          ),
        } : {}),
      };
      mergedAnchors[prefixedId] = transformed;
    }
  }

  const totalW = padding * 2 + sumWithGaps(colWidths,  0, grid.columns, gap) - gap;
  const totalH = padding * 2 + headerH + sumWithGaps(rowHeights, 0, numRows, gap) - gap;

  // Collect defs from all child scenes (e.g. arrow markers)
  const allDefs: string[] = [];
  const seenDefs = new Set<string>();
  for (const { result } of cellResults) {
    if (result.scene.defs) {
      for (const def of result.scene.defs) {
        if (!seenDefs.has(def)) {
          seenDefs.add(def);
          allDefs.push(def);
        }
      }
    }
  }

  return {
    scene: {
      viewBox: { x: 0, y: 0, width: totalW, height: totalH },
      background: palette.background,
      elements,
      ...(allDefs.length > 0 ? { defs: allDefs } : {}),
    },
    anchors: mergedAnchors,
  };
}

// ─── Cell Content Dispatch ────────────────────────────────────────────────────

async function layoutCellContent(content: CellContent, theme: ResolvedTheme): Promise<LayoutResult> {
  const { palette, typography, spacing } = theme;
  const unit = spacing.unit;
  const pad  = spacing.nodePadding;

  switch (content.kind) {
    case 'diagram': {
      const module = getModule(content.diagramKind);
      if (!module) {
        const w = unit * 20;
        const h = typography.baseFontSize + pad * 2;
        return {
          scene: {
            viewBox: { x: 0, y: 0, width: w, height: h },
            elements: [{ type: 'text', content: `[${content.diagramKind}]`, position: { x: pad, y: pad + typography.baseFontSize * 0.8 }, fontSize: typography.baseFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted }],
          },
          anchors: {},
        };
      }
      return module.layout(content.doc, theme);
    }
    case 'text': {
      // Approximate width: ~8px per character at baseFontSize, with min/max
      const estCharW = typography.baseFontSize * 0.6;
      const textW    = Math.max(unit * 10, Math.min(unit * 30, content.text.length * estCharW + pad * 2));
      const textH    = typography.baseFontSize * typography.lineHeight + pad * 2;
      return {
        scene: {
          viewBox: { x: 0, y: 0, width: textW, height: textH },
          elements: [{ type: 'text', content: content.text, position: { x: pad, y: pad + typography.baseFontSize * 0.8 }, fontSize: typography.baseFontSize, fontFamily: typography.fontFamily, fill: palette.text }],
        },
        anchors: {},
      };
    }
    case 'stat': {
      const valueFontSize = typography.titleFontSize * 1.5;
      const cellW = Math.max(unit * 10, valueFontSize * 3);
      const centerX = cellW / 2;

      const valueY = pad + valueFontSize * 0.8;
      const labelGap = unit;
      const labelY = valueY + labelGap + typography.smallFontSize * 0.8;
      const cellH  = content.label
        ? valueY + labelGap + typography.smallFontSize + pad
        : valueY + pad;

      const els: SceneElement[] = [
        { type: 'text', content: content.value, position: { x: centerX, y: valueY }, fontSize: valueFontSize, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.primary, anchor: 'middle' },
      ];
      if (content.label) {
        els.push({ type: 'text', content: content.label, position: { x: centerX, y: labelY }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted, anchor: 'middle' });
      }
      return {
        scene: { viewBox: { x: 0, y: 0, width: cellW, height: cellH }, elements: els },
        anchors: {},
      };
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

/**
 * Generate an Excel-style cell address from row/col indices.
 * col 0 → "A", col 1 → "B", ..., col 25 → "Z", col 26 → "AA"
 * Row is 1-indexed in the output: row 0 → "1".
 */
function cellAddressFromPosition(row: number, col: number): string {
  let addr = '';
  let c = col;
  do {
    addr = String.fromCharCode(65 + (c % 26)) + addr;
    c = Math.floor(c / 26) - 1;
  } while (c >= 0);
  return `${addr}${row + 1}`;
}
