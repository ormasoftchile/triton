/**
 * @file scene/strip.ts — Cell-strip construction.
 *
 * A strip is a contiguous (or gapped) run of equal-extent cells: arrays, heap
 * array-backings, ring/queue buffers, packet fields, B-tree key strips, slotted
 * pages. Returns the scene elements plus the bounding `slots` so pointer routing
 * (graph/connect) can clip arrows to individual cells.
 *
 * Deterministic: positions are pure functions of inputs.
 */

import type { SceneElement, Rect, Color, Point, ResolvedTheme } from '../contracts/index.js';
import type { Pen } from './build.js';

export interface StripCell {
  /** Centered cell text. */
  readonly label?: string;
  /** Cell fill; defaults to theme surface. */
  readonly fill?: Color;
  /** Fill opacity override (e.g. 0.22 for a semi-transparent highlight). */
  readonly fillOpacity?: number;
  /** Stroke override; defaults to theme border. */
  readonly stroke?: Color;
  /** Optional label drawn just outside the strip (index / address). */
  readonly index?: string;
}

export interface StripOptions {
  /** Top-left of the strip. */
  readonly origin: Point;
  readonly cellWidth: number;
  readonly cellHeight: number;
  /** 'horizontal' lays cells left→right (default); 'vertical' top→bottom. */
  readonly orientation?: 'horizontal' | 'vertical';
  /** Gap between cells; 0 = contiguous (default). */
  readonly gap?: number;
}

export interface StripResult {
  readonly elements: SceneElement[];
  /** Bounding rect of each cell, in input order — anchors for pointers. */
  readonly slots: Rect[];
  /** Overall bounding box of the strip cells (excludes index labels). */
  readonly bounds: Rect;
}

export function buildStrip(
  pen: Pen,
  theme: ResolvedTheme,
  cells: readonly StripCell[],
  options: StripOptions,
): StripResult {
  const { origin, cellWidth, cellHeight } = options;
  const orientation = options.orientation ?? 'horizontal';
  const gap = options.gap ?? 0;
  const horizontal = orientation === 'horizontal';
  const palette = theme.palette;

  const elements: SceneElement[] = [];
  const slots: Rect[] = [];

  cells.forEach((cell, i) => {
    const step = (horizontal ? cellWidth : cellHeight) + gap;
    const x = origin.x + (horizontal ? i * step : 0);
    const y = origin.y + (horizontal ? 0 : i * step);
    const slot: Rect = { x, y, width: cellWidth, height: cellHeight };
    slots.push(slot);
    elements.push(pen.rect(slot, cell.fill ?? palette.surface, cell.stroke ?? palette.border, 1.5, { rx: 3, ...(cell.fillOpacity !== undefined ? { fillOpacity: cell.fillOpacity } : {}) }));
    if (cell.label !== undefined) {
      elements.push(pen.text(cell.label, x + cellWidth / 2, y + cellHeight / 2 + 5,
        theme.typography.baseFontSize, palette.text, { anchor: 'middle', weight: 'bold' }));
    }
    if (cell.index !== undefined) {
      // index sits just outside the strip on the leading cross edge
      const ix = horizontal ? x + cellWidth / 2 : x - 6;
      const iy = horizontal ? y - 6 : y + cellHeight / 2 + 4;
      elements.push(pen.text(cell.index, ix, iy, theme.typography.smallFontSize, palette.textMuted,
        { anchor: horizontal ? 'middle' : 'end' }));
    }
  });

  const n = cells.length;
  const totalAlong = n === 0 ? 0 : n * (horizontal ? cellWidth : cellHeight) + (n - 1) * gap;
  const bounds: Rect = {
    x: origin.x,
    y: origin.y,
    width:  horizontal ? totalAlong : cellWidth,
    height: horizontal ? cellHeight : totalAlong,
  };

  return { elements, slots, bounds };
}
