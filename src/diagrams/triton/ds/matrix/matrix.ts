/**
 * @file diagrams/ds/matrix/matrix.ts — 2D grid (rows × cols) with indices.
 *
 * A grid of equal cells built by stacking horizontal cell strips — one per
 * row — and labelling the column indices across the top and the row indices
 * down the left. Ragged rows are padded with blanks so the grid stays
 * rectangular.
 *
 * Value-driven mini-syntax:
 *   matrix
 *     title weights
 *     row 1 2 3 4
 *     row 5 6 7 8
 *     row 9 10 11 12
 *
 *   matrix 3x4              // empty 3-row, 4-column grid
 *   matrix                  // `noindex` hides the row/column index labels
 *     noindex
 *     row a b
 *     row c d
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../../scene/strip.js';
import { measureText } from '../../../../text/metrics.js';

export interface MatrixDoc {
  title?: string;
  rows: string[][];
  showIndex: boolean;
  /** Highlighted cell positions as [row, col] pairs (0-indexed). */
  highlights?: [number, number][];
}

function parse(input: string): MatrixDoc {
  let title: string | undefined;
  const rows: string[][] = [];
  let showIndex = true;

  const highlights: [number, number][] = [];

  for (const line of input.split(/\r?\n/).map(l => l.trimEnd())) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const t = trimmed.split(/\s+/);
    if (t[0] === 'matrix') {
      const dim = t[1]?.match(/^(\d+)x(\d+)$/i);
      if (dim) {
        const r = Number(dim[1]), c = Number(dim[2]);
        for (let i = 0; i < r; i++) rows.push(Array.from({ length: c }, () => ''));
      }
      continue;
    }
    if (t[0] === 'title') { title = trimmed.slice(5).trim(); continue; }
    if (t[0] === 'noindex') { showIndex = false; continue; }
    if (t[0] === 'row') { rows.push(t.slice(1)); continue; }
    if (t[0] === 'highlight') {
      // Accepts space-separated r,c pairs: highlight 0,1 1,2 2,0
      for (const tok of t.slice(1)) {
        const m = tok.match(/^(\d+),(\d+)$/);
        if (m) highlights.push([Number(m[1]), Number(m[2])]);
      }
      continue;
    }
  }
  return { ...(title !== undefined ? { title } : {}), rows, showIndex, ...(highlights.length > 0 ? { highlights } : {}) };
}

export function layoutMatrix(doc: MatrixDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 38;

  const nRows = doc.rows.length;
  const nCols = doc.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const grid = doc.rows.map(r => Array.from({ length: nCols }, (_, j) => r[j] ?? ''));
  const cellW = Math.max(40, ...grid.flat().map(v => measureText(v, font).width + 20));

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const colIdxH = doc.showIndex ? typography.smallFontSize + 8 : 0;
  const rowIdxW = doc.showIndex ? 22 : 0;
  const origin = { x: margin + rowIdxW, y: margin + titleH + colIdxH };

  const elements: SceneElement[] = [];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  grid.forEach((row, r) => {
    const rowOrigin = { x: origin.x, y: origin.y + r * cellH };
    const cellInputs: StripCell[] = row.map((v, c) => {
      const isHighlit = doc.highlights?.some(([hr, hc]) => hr === r && hc === c) ?? false;
      return isHighlit
        ? { label: v, fill: palette.primary, fillOpacity: 0.22, stroke: palette.primary }
        : { label: v };
    });
    const strip = buildStrip(p, theme, cellInputs, { origin: rowOrigin, cellWidth: cellW, cellHeight: cellH });
    elements.push(...strip.elements);
    strip.slots.forEach((slot, c) => { anchors[`r${r}c${c}`] = { bounds: slot }; });
    if (doc.showIndex) {
      elements.push(p.text(String(r), origin.x - 7, rowOrigin.y + cellH / 2 + font * 0.35, typography.smallFontSize, palette.textMuted, { anchor: 'end' }));
    }
  });

  if (doc.showIndex) {
    for (let c = 0; c < nCols; c++) {
      const cx = origin.x + c * cellW + cellW / 2;
      elements.push(p.text(String(c), cx, origin.y - 6, typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
    }
  }

  const width = origin.x + nCols * cellW + margin;
  const height = origin.y + nRows * cellH + margin;
  const scene: Scene = {
    viewBox: { x: 0, y: 0, width, height },
    background: palette.background,
    elements,
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const matrix: DiagramModule<MatrixDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutMatrix(ir, theme);
  },
};
