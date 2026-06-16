/**
 * @file aesthetics.ts — Continuous aesthetic quality metrics (normalised 0..1, 1 = best).
 *
 * These metrics target the "feels horrible" class of layout problems — not
 * egregious binary defects (no overlapping nodes, no stabs) but the subtler
 * issues that make a diagram look bad: one large dead-whitespace region on the
 * right, all edges piling into one gutter, nodes scattered with no alignment
 * guide, irregular spacing between siblings.
 *
 * Every function is PURE + DETERMINISTIC: same LabeledGeometry → same scores.
 * Coordinates are in poster (scene) space; y-axis points DOWN.
 *
 * Metrics (1 = best):
 *   • gridBalance    — occupancy symmetry over a coarse 16×16 grid (no big empty hub)
 *   • congestion     — inverse peak segment density per grid cell (no busy gutter)
 *   • alignment      — fraction of boxes sharing axis-aligned guides (tidy grid feel)
 *   • spacingUniform — uniformity of gaps between adjacent sibling elements
 *   • edgeCrossings  — fraction of edge-pairs that do NOT cross
 */

import { segmentLength } from './primitives.js';
import type { Box, BoxWithId, Segment } from './primitives.js';
import type { LabeledGeometry } from './detectors.js';
import { edgeCrossingsScore as crossingsScore } from './scores.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AestheticScores {
  /** Occupancy symmetry — penalises large dead-whitespace regions + lopsided quadrant fill. */
  gridBalance: number;
  /** Inverse peak congestion — penalises many edges piling into a single gutter cell. */
  congestion: number;
  /** Alignment guide density — rewards boxes that share left/center/right/top/bottom guides. */
  alignment: number;
  /** Spacing uniformity — rewards equal gaps between adjacent sibling elements. */
  spacingUniform: number;
  /** Edge-pair non-crossing fraction. */
  edgeCrossings: number;
  /** Unweighted mean of the five aesthetic scores. */
  overall: number;
}

export interface AestheticThresholds {
  gridBalance?: number;
  congestion?: number;
  alignment?: number;
  spacingUniform?: number;
  edgeCrossings?: number;
  overall?: number;
}

// ---------------------------------------------------------------------------
// 1. Grid Balance — occupancy symmetry
// ---------------------------------------------------------------------------

const GRID_COLS = 16;
const GRID_ROWS = 16;

/**
 * Coarse occupancy-grid balance score.
 *
 * Overlays a 16×16 grid on the canvas.  A cell is "covered" when any node
 * box, label box, or edge segment has ink in it.  Two penalties are combined:
 *
 *   (a) Largest contiguous EMPTY region as a fraction of total cells.
 *       A diagram with a third of its canvas completely blank scores low here
 *       — this is the "empty hub third" pattern the user dislikes.
 *
 *   (b) Imbalance of occupancy across the four quadrants (normalised variance
 *       of per-quadrant fill ratios).  A lopsided diagram with all content in
 *       one corner scores low here.
 *
 * score = 1 − 0.5 × emptyFraction − 0.5 × quadrantImbalance
 *
 * Both penalty terms are in [0, 1]; result clamped to [0, 1].
 */
export function gridBalanceScore(geo: LabeledGeometry): number {
  const { canvas } = geo;
  if (canvas.w <= 0 || canvas.h <= 0) return 1;

  const grid = buildOccupancyGrid(geo, GRID_COLS, GRID_ROWS);
  const totalCells = GRID_COLS * GRID_ROWS;

  // (a) Largest contiguous empty region.
  const largestEmpty = bfsLargestEmptyRegion(grid, GRID_COLS, GRID_ROWS);
  const emptyFraction = largestEmpty / totalCells;

  // (b) Quadrant imbalance — variance of fill ratios across four quadrants.
  const midC = GRID_COLS / 2;
  const midR = GRID_ROWS / 2;
  const qFills: [number, number, number, number] = [0, 0, 0, 0]; // TL, TR, BL, BR
  const qSize = midC * midR;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const q = (r < midR ? 0 : 2) + (c < midC ? 0 : 1) as 0 | 1 | 2 | 3;
      if (grid[r * GRID_COLS + c]) qFills[q]++;
    }
  }
  const ratios = qFills.map((f) => f / (qSize || 1));
  const mean = (ratios[0]! + ratios[1]! + ratios[2]! + ratios[3]!) / 4;
  const variance =
    ((ratios[0]! - mean) ** 2 +
      (ratios[1]! - mean) ** 2 +
      (ratios[2]! - mean) ** 2 +
      (ratios[3]! - mean) ** 2) /
    4;
  // Maximum possible variance of a [0,1] uniform variable is 0.25.
  const quadrantImbalance = clamp01(variance / 0.25);

  return clamp01(1 - 0.5 * emptyFraction - 0.5 * quadrantImbalance);
}

/** Rasterise nodes, labels, and edge segments into a flat occupancy grid (1 = covered). */
function buildOccupancyGrid(geo: LabeledGeometry, cols: number, rows: number): Uint8Array {
  const { canvas } = geo;
  const grid = new Uint8Array(cols * rows);
  const cellW = canvas.w / cols;
  const cellH = canvas.h / rows;

  const markBox = (b: Box) => {
    const c0 = clampInt(Math.floor((b.x - canvas.x) / cellW), 0, cols - 1);
    const c1 = clampInt(Math.floor((b.x + b.w - canvas.x - 1e-9) / cellW), 0, cols - 1);
    const r0 = clampInt(Math.floor((b.y - canvas.y) / cellH), 0, rows - 1);
    const r1 = clampInt(Math.floor((b.y + b.h - canvas.y - 1e-9) / cellH), 0, rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        grid[r * cols + c] = 1;
      }
    }
  };

  const markSegment = (s: Segment) => {
    // DDA rasterisation: sample the segment at 2× grid resolution.
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const steps = Math.max(cols, rows) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = s.x1 + t * dx;
      const y = s.y1 + t * dy;
      const c = clampInt(Math.floor((x - canvas.x) / cellW), 0, cols - 1);
      const r = clampInt(Math.floor((y - canvas.y) / cellH), 0, rows - 1);
      grid[r * cols + c] = 1;
    }
  };

  for (const node of geo.nodes) markBox(node);
  for (const label of geo.labels) markBox(label);
  for (const edge of geo.edges) {
    for (const seg of edge.segments) markSegment(seg);
  }
  return grid;
}

/** BFS flood-fill to find the largest connected component of empty cells. */
function bfsLargestEmptyRegion(grid: Uint8Array, cols: number, rows: number): number {
  const visited = new Uint8Array(cols * rows);
  let largest = 0;
  for (let start = 0; start < cols * rows; start++) {
    if (grid[start] || visited[start]) continue;
    let size = 0;
    const queue = [start];
    visited[start] = 1;
    while (queue.length > 0) {
      const idx = queue.pop()!;
      size++;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const neighbours: [number, number][] = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [nr, nc] of neighbours) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const ni = nr * cols + nc;
        if (grid[ni] || visited[ni]) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }
    if (size > largest) largest = size;
  }
  return largest;
}

// ---------------------------------------------------------------------------
// 2. Congestion — inverse peak segment density
// ---------------------------------------------------------------------------

/** Number of distinct edge segments per grid cell above which a cell feels "busy". */
const CONGESTION_THRESHOLD = 3;

/**
 * Inverse peak segment-density score.
 *
 * Counts how many DISTINCT edge segments pass through each cell of the 16×16
 * grid.  The "congestion level" of a cell is `segmentCount / THRESHOLD`; once
 * a cell exceeds the threshold it reads as a busy gutter — the "busy gutter"
 * anti-pattern the user dislikes.
 *
 * score = 1 / (1 + max(0, peakLevel − 1))
 *
 * A cell with 1–3 segments scores 1.0; 6 segments → 0.5; 9 segments → 0.33.
 */
export function congestionScore(geo: LabeledGeometry): number {
  const { canvas } = geo;
  if (canvas.w <= 0 || canvas.h <= 0) return 1;
  if (geo.edges.length === 0) return 1;

  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  const counts = new Float32Array(cols * rows);
  const cellW = canvas.w / cols;
  const cellH = canvas.h / rows;

  for (const edge of geo.edges) {
    for (const seg of edge.segments) {
      if (segmentLength(seg) < 1e-9) continue;
      const seen = new Set<number>();
      const steps = Math.max(cols, rows) * 2;
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = seg.x1 + t * dx;
        const y = seg.y1 + t * dy;
        const c = clampInt(Math.floor((x - canvas.x) / cellW), 0, cols - 1);
        const r = clampInt(Math.floor((y - canvas.y) / cellH), 0, rows - 1);
        const idx = r * cols + c;
        if (!seen.has(idx)) {
          seen.add(idx);
          counts[idx] = (counts[idx] ?? 0) + 1;
        }
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < cols * rows; i++) {
    if (counts[i]! > peak) peak = counts[i]!;
  }

  const peakLevel = peak / CONGESTION_THRESHOLD;
  return clamp01(1 / (1 + Math.max(0, peakLevel - 1)));
}

// ---------------------------------------------------------------------------
// 3. Alignment — shared axis-aligned guides
// ---------------------------------------------------------------------------

/** Pixel tolerance within which two coordinates are considered "aligned". */
const ALIGN_TOL = 5;

/**
 * Fraction of node boxes that participate in at least one shared alignment guide.
 *
 * Guides are the six axis-aligned coordinates derivable from each box:
 *   x (left), x + w/2 (center-x), x + w (right),
 *   y (top),  y + h/2 (center-y), y + h (bottom).
 *
 * A guide is "shared" when ≥ 2 boxes align to it within `ALIGN_TOL` pixels.
 * The score is the fraction of all boxes that participate in at least one
 * shared guide.
 *
 *   1.0 = every box aligns to at least one other box (tidy grid)
 *   0.0 = all boxes placed randomly with no alignment
 *
 * Labels are excluded — only node boxes participate, as nodes drive the
 * structural skeleton of a diagram.
 */
export function alignmentScore(geo: LabeledGeometry): number {
  const boxes = geo.nodes;
  if (boxes.length < 2) return 1; // trivially aligned

  const xVals: number[] = [];
  const yVals: number[] = [];
  for (const b of boxes) {
    xVals.push(b.x, b.x + b.w / 2, b.x + b.w);
    yVals.push(b.y, b.y + b.h / 2, b.y + b.h);
  }

  const sharedX = sharedClusters(xVals, ALIGN_TOL);
  const sharedY = sharedClusters(yVals, ALIGN_TOL);

  const participating = new Set<number>();
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    const xCands = [b.x, b.x + b.w / 2, b.x + b.w];
    if (xCands.some((v) => sharedX.has(quantize(v, ALIGN_TOL)))) {
      participating.add(i);
      continue;
    }
    const yCands = [b.y, b.y + b.h / 2, b.y + b.h];
    if (yCands.some((v) => sharedY.has(quantize(v, ALIGN_TOL)))) {
      participating.add(i);
    }
  }

  return clamp01(participating.size / boxes.length);
}

/** Returns the set of quantized guide values that ≥ 2 raw values map to. */
function sharedClusters(values: number[], tol: number): Set<number> {
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = quantize(v, tol);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const shared = new Set<number>();
  for (const [key, count] of counts) {
    if (count >= 2) shared.add(key);
  }
  return shared;
}

function quantize(v: number, tol: number): number {
  return Math.round(v / tol);
}

// ---------------------------------------------------------------------------
// 4. Spacing uniformity — coefficient of variation of sibling gaps
// ---------------------------------------------------------------------------

/** Cross-axis tolerance to consider two boxes "on the same row / column". */
const SIBLING_TOL = 24;

/**
 * Uniformity of gaps between adjacent sibling elements.
 *
 * "Siblings" are pairs of node boxes that lie on the same approximate row
 * (similar y-center) or column (similar x-center) within `SIBLING_TOL` pixels.
 * The "gap" between each pair is the distance between their nearest edges.
 *
 * score = 1 − coefficient_of_variation(gaps)
 *
 *   1.0 = all gaps equal (perfectly uniform spacing)
 *   0.0 = gap widths vary as much as their mean (wildly irregular)
 *
 * Returns 1 when fewer than 2 gap measurements exist (trivially uniform).
 */
export function spacingUniformScore(geo: LabeledGeometry): number {
  const boxes = geo.nodes;
  if (boxes.length < 2) return 1;

  const hGaps = axisGaps(boxes, 'x', 'y'); // horizontal neighbours → gaps in x
  const vGaps = axisGaps(boxes, 'y', 'x'); // vertical neighbours   → gaps in y

  const gaps = [...hGaps, ...vGaps];
  if (gaps.length < 2) return 1;

  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean <= 0) return 1; // boxes touch or overlap — gap uniformity undefined

  const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
  const cv = Math.sqrt(variance) / Math.abs(mean); // coefficient of variation
  return clamp01(1 - Math.min(1, cv));
}

/**
 * For each group of boxes sharing a similar cross-axis centre, sort by the
 * main axis and return the edge-to-edge gaps between consecutive pairs.
 */
function axisGaps(
  boxes: ReadonlyArray<BoxWithId>,
  mainAxis: 'x' | 'y',
  crossAxis: 'x' | 'y',
): number[] {
  const groups = new Map<number, (typeof boxes)[0][]>();
  for (const b of boxes) {
    const crossCenter = crossAxis === 'x' ? b.x + b.w / 2 : b.y + b.h / 2;
    const key = Math.round(crossCenter / SIBLING_TOL);
    let g = groups.get(key);
    if (!g) { g = []; groups.set(key, g); }
    g.push(b);
  }

  const gaps: number[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) =>
      mainAxis === 'x' ? a.x - b.x : a.y - b.y,
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const gap =
        mainAxis === 'x'
          ? curr.x - (prev.x + prev.w) // gap in x between consecutive horizontal neighbours
          : curr.y - (prev.y + prev.h); // gap in y between consecutive vertical neighbours
      gaps.push(gap);
    }
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// 5. Edge crossings (re-uses the existing scores.ts implementation)
// ---------------------------------------------------------------------------

export { edgeCrossingsScore as edgeCrossingsAestheticScore } from './scores.js';

// ---------------------------------------------------------------------------
// Aggregate scorecard
// ---------------------------------------------------------------------------

/**
 * Compute all five aesthetic scores + their unweighted mean.
 * Pure + deterministic: same geometry → same result every time.
 */
export function computeAestheticScores(geo: LabeledGeometry): AestheticScores {
  const gridBalance = gridBalanceScore(geo);
  const congestion = congestionScore(geo);
  const alignment = alignmentScore(geo);
  const spacingUniform = spacingUniformScore(geo);
  const edgeCrossings = crossingsScore(geo);
  const overall = (gridBalance + congestion + alignment + spacingUniform + edgeCrossings) / 5;
  return { gridBalance, congestion, alignment, spacingUniform, edgeCrossings, overall };
}

/**
 * Format a human-readable aesthetic scorecard for a diagram.
 *
 * Prints per-metric scores, the overall score, and a qualitative verdict.
 * An optional `thresholds` argument causes values below their threshold to be
 * flagged with ⚠ — useful for highlighting calibrated outliers in test output.
 */
export function formatAestheticScorecard(
  geo: LabeledGeometry,
  name = 'diagram',
  thresholds?: AestheticThresholds,
): string {
  const s = computeAestheticScores(geo);
  const fmt = (v: number) => v.toFixed(3);
  const flag = (v: number, t: number | undefined) => (t !== undefined && v < t ? ' ⚠' : '');

  const lines: string[] = [
    `── Aesthetic scorecard: ${name} ──`,
    `  gridBalance    ${fmt(s.gridBalance)}${flag(s.gridBalance, thresholds?.gridBalance)}  (occupancy symmetry; 1=balanced, 0=dead third)`,
    `  congestion     ${fmt(s.congestion)}${flag(s.congestion, thresholds?.congestion)}  (inverse peak gutter density; 1=spread, 0=jammed)`,
    `  alignment      ${fmt(s.alignment)}${flag(s.alignment, thresholds?.alignment)}  (shared guide participation; 1=all aligned)`,
    `  spacingUniform ${fmt(s.spacingUniform)}${flag(s.spacingUniform, thresholds?.spacingUniform)}  (gap uniformity; 1=equal gaps)`,
    `  edgeCrossings  ${fmt(s.edgeCrossings)}${flag(s.edgeCrossings, thresholds?.edgeCrossings)}  (non-crossing edge pairs; 1=no crossings)`,
    `  ─────────────────────────────────────────────────────────────────`,
    `  overall        ${fmt(s.overall)}  ${aestheticVerdict(s.overall)}`,
  ];
  return lines.join('\n');
}

function aestheticVerdict(overall: number): string {
  if (overall >= 0.85) return '✓ GOOD — comfortable layout';
  if (overall >= 0.70) return '~ ACCEPTABLE — minor aesthetic issues';
  if (overall >= 0.55) return '! MEDIOCRE — noticeable layout problems';
  return '✗ POOR — layout feels uncomfortable';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
