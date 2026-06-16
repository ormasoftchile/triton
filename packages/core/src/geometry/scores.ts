/**
 * @file scores.ts — Normalised geometry-quality scores (geg-metrics style).
 *
 * Each score is normalised to `[0, 1]` where **1 = best** (no defect / ideal)
 * and lower values indicate worse geometry.  Scores are pure functions of the
 * labelled geometry and are deterministic.
 *
 * Implemented (v1):
 *   • edgeCrossings      — fraction of edge-pairs that do NOT cross
 *   • nodeOverlap        — 1 − normalised node∩node overlap area
 *   • nodeEdgeCrossings  — fraction of (edge,node) pairs with no interior stab
 *   • density            — how close element coverage is to a target fill ratio
 *   • whitespaceBalance  — symmetry of the bounding box of content within canvas
 */

import { overlapArea, segmentIntersectsBox, segmentsCross } from './predicates.js';
import { boxArea } from './primitives.js';
import type { LabeledGeometry } from './detectors.js';

export interface QualityScores {
  edgeCrossings: number;
  nodeOverlap: number;
  nodeEdgeCrossings: number;
  density: number;
  whitespaceBalance: number;
  /** Unweighted mean of the five component scores (convenience). */
  overall: number;
}

/** 1 when no two edges cross; degrades with the fraction of crossing edge-pairs. */
export function edgeCrossingsScore(geo: LabeledGeometry): number {
  const edges = geo.edges;
  const n = edges.length;
  if (n < 2) return 1;
  let pairs = 0;
  let crossing = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs++;
      if (edgesCross(edges[i]!.segments, edges[j]!.segments)) crossing++;
    }
  }
  return pairs === 0 ? 1 : 1 - crossing / pairs;
}

/** 1 when no node overlaps another; degrades with total overlap area / node area. */
export function nodeOverlapScore(geo: LabeledGeometry): number {
  const nodes = geo.nodes;
  if (nodes.length < 2) return 1;
  let overlap = 0;
  let totalArea = 0;
  for (const n of nodes) totalArea += boxArea(n);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      overlap += overlapArea(nodes[i]!, nodes[j]!);
    }
  }
  if (totalArea <= 0) return 1;
  return clamp01(1 - overlap / totalArea);
}

/** 1 when no edge stabs a non-endpoint node; degrades with the offending fraction. */
export function nodeEdgeCrossingsScore(geo: LabeledGeometry): number {
  const { edges, nodes } = geo;
  if (edges.length === 0 || nodes.length === 0) return 1;
  let pairs = 0;
  let stabs = 0;
  for (const edge of edges) {
    for (const node of nodes) {
      if (node.id === edge.fromId || node.id === edge.toId) continue;
      pairs++;
      if (edge.segments.some((s) => segmentIntersectsBox(s, node))) stabs++;
    }
  }
  return pairs === 0 ? 1 : 1 - stabs / pairs;
}

/**
 * How close the content fill ratio is to a comfortable target (default 0.30).
 * Returns 1 at the target and falls off linearly toward 0 at empty / full.
 */
export function densityScore(geo: LabeledGeometry, target = 0.3): number {
  const canvasArea = boxArea(geo.canvas);
  if (canvasArea <= 0) return 1;
  let covered = 0;
  for (const n of geo.nodes) covered += boxArea(n);
  for (const l of geo.labels) covered += boxArea(l);
  const ratio = clamp01(covered / canvasArea);
  const span = ratio <= target ? target : 1 - target;
  return clamp01(1 - Math.abs(ratio - target) / (span || 1));
}

/**
 * Symmetry of content placement: 1 when the content bounding box is centred in
 * the canvas, falling off as the margins become lopsided.
 */
export function whitespaceBalanceScore(geo: LabeledGeometry): number {
  const boxes = [...geo.nodes, ...geo.labels];
  if (boxes.length === 0) return 1;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const c = geo.canvas;
  const leftM = minX - c.x;
  const rightM = c.x + c.w - maxX;
  const topM = minY - c.y;
  const bottomM = c.y + c.h - maxY;
  const hBal = balance(leftM, rightM);
  const vBal = balance(topM, bottomM);
  return clamp01((hBal + vBal) / 2);
}

/** Compute all component scores plus their unweighted mean. */
export function computeScores(geo: LabeledGeometry): QualityScores {
  const edgeCrossings = edgeCrossingsScore(geo);
  const nodeOverlap = nodeOverlapScore(geo);
  const nodeEdgeCrossings = nodeEdgeCrossingsScore(geo);
  const density = densityScore(geo);
  const whitespaceBalance = whitespaceBalanceScore(geo);
  const overall =
    (edgeCrossings + nodeOverlap + nodeEdgeCrossings + density + whitespaceBalance) / 5;
  return { edgeCrossings, nodeOverlap, nodeEdgeCrossings, density, whitespaceBalance, overall };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function edgesCross(a: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }>, b: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }>): boolean {
  for (const s1 of a) {
    for (const s2 of b) {
      if (segmentsCross(s1, s2)) return true;
    }
  }
  return false;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function balance(a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi <= 0) return 1; // both margins zero/negative → treat as balanced
  return clamp01(lo / hi < 0 ? 0 : Math.max(0, lo) / hi);
}
