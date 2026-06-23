/**
 * @file style/cost.ts — Cost / latency tier styling.
 *
 * Maps a numeric edge weight (latency, bandwidth-inverse, hop distance, plan
 * cost) onto a discrete visual tier — colour + dash pattern — and builds a
 * legend block. Shared by any diagram with weighted edges (architecture/NUMA,
 * topology, query plans). Pure styling: no layout.
 */

import type { SceneElement, Color, Point, Rect, ResolvedTheme } from '../contracts/index.js';
import type { Pen } from '../scene/build.js';

export interface CostTier {
  readonly name: string;
  /** Inclusive upper bound for bucketing a weight into this tier. */
  readonly maxWeight: number;
  readonly color: Color;
  /** Optional SVG stroke-dasharray (e.g. '5 4'). */
  readonly dash?: string;
}

export interface CostScale {
  /** Unit label shown in the legend (e.g. 'ns', 'Gbps'). */
  readonly unit?: string;
  /** Tiers, ascending by maxWeight. */
  readonly tiers: readonly CostTier[];
}

/** Bucket a weight into the first tier whose maxWeight ≥ weight (else the last). */
export function classifyCost(scale: CostScale, weight: number): CostTier {
  for (const t of scale.tiers) if (weight <= t.maxWeight) return t;
  return scale.tiers[scale.tiers.length - 1]!;
}

/** Look up a tier by name (for explicit `-- tier -->` edges). */
export function tierByName(scale: CostScale, name: string): CostTier | undefined {
  return scale.tiers.find(t => t.name === name);
}

export interface LegendResult {
  readonly elements: SceneElement[];
  readonly bounds: Rect;
}

/** A small legend: one swatch + tier name + threshold per tier. */
export function buildLegend(pen: Pen, theme: ResolvedTheme, scale: CostScale, origin: Point): LegendResult {
  const palette = theme.palette;
  const pad = 14, rowH = 22, swatch = 16;
  const rows = scale.tiers.length + 1;
  const width = 220;
  const height = pad + rows * rowH;
  const elements: SceneElement[] = [];

  elements.push(pen.rect({ x: origin.x, y: origin.y, width, height }, palette.background, palette.border, 1.5, { rx: 8 }));
  const title = scale.unit ? `Cost (${scale.unit})` : 'Cost';
  elements.push(pen.text(title, origin.x + pad, origin.y + pad + 8, theme.typography.baseFontSize, palette.text, { weight: 'bold' }));

  scale.tiers.forEach((t, i) => {
    const y = origin.y + pad + (i + 1) * rowH;
    elements.push(pen.rect({ x: origin.x + pad, y: y - swatch + 4, width: swatch, height: swatch - 4 }, t.color, t.color, 1, { rx: 2 }));
    elements.push(pen.text(t.name, origin.x + pad + swatch + 8, y, theme.typography.smallFontSize, palette.text));
    elements.push(pen.text(`≤ ${t.maxWeight}`, origin.x + width - pad, y, theme.typography.smallFontSize, palette.textMuted, { anchor: 'end', weight: 'bold' }));
  });

  return { elements, bounds: { x: origin.x, y: origin.y, width, height } };
}
