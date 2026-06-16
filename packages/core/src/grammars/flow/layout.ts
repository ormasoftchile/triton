/**
 * @file grammars/flow/layout.ts — Flow Grammar layout engine.
 *
 * `layoutFlow(doc, themeOverride?)` produces a DETERMINISTIC Scene from a
 * validated FlowDocument using a Sugiyama-family layered layout (increment-1
 * scope: linear chain + simple branching DAG).
 *
 * Algorithm (increment-1):
 *   1. CYCLE REMOVAL — DFS coloring detects back-edges deterministically.
 *      Back-edges (including self-loops) are extracted and rendered separately
 *      as arcs below the main flow. Layout terminates for any cyclic graph.
 *   2. RANK ASSIGNMENT — Longest-path ranks from source nodes (in-degree 0
 *      in the acyclic residual). Source nodes → rank 0. Each successor gets
 *      max(predecessor rank + 1). Topological order via DFS post-order reverse.
 *   3. LAYER ORDERING — Nodes within each rank sorted by declaration order
 *      (first-appearance).
 *   3.5. CROSSING MINIMIZATION — Barycenter heuristic, CROSSING_MIN_SWEEPS
 *      alternating forward/backward sweeps, lexicographic tie-breaking.
 *   4. COORDINATE ASSIGNMENT — Uniform column width (global max node width).
 *      Nodes centered vertically within each column relative to the tallest
 *      column. All arithmetic uses rhuInt() (round-half-up integer) per the
 *      determinism contract (§5.1 item 3).
 *   5. SCENE EMISSION — Existing kernel primitives only (no new types needed):
 *      RectPrimitive (node box), CirclePrimitive (circle nodes), TextPrimitive
 *      (labels), PathPrimitive (edges + arrowheads), LinePrimitive (not used
 *      currently — all edges are PathPrimitive for uniform curve support).
 *
 * Deferred (increment-2+):
 *   - 'TB' orientation (top-to-bottom)
 *   - Group/lane containers
 *
 * Determinism: pure function over (FlowDocument, FlowTheme). No randomness,
 * no iteration count, no convergence criterion. Identical input → byte-identical
 * Scene → byte-identical SVG/PNG.
 */

import type { Scene, ScenePrimitive, SceneAnimation } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';
import { getIcon } from '../../icons.js';
import { splitLabelLines } from '../../util/label-lines.js';
import type { NodeAnchorRegistry, RenderWithAnchors } from '../../anchors.js';

import type { FlowDocument, FlowNode, FlowEdge } from './types.js';
import type { FlowTheme } from './theme.js';
import { resolveFlowTheme } from './theme.js';

// ---------------------------------------------------------------------------
// Rounding helper — round-half-up to integer (§5.1 item 3)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Internal positioned-node record
// ---------------------------------------------------------------------------

interface PlacedNode {
  node: FlowNode;
  /** Top-left x of the node box. */
  x: number;
  /** Top-left y of the node box. */
  y: number;
  /** Box width (px). */
  w: number;
  /** Box height (px). */
  h: number;
  /** Center x (for edge attachment). */
  cx: number;
  /** Center y (for edge attachment). */
  cy: number;
  /** Right edge x (forward edge source port). */
  rx: number;
  /** Bottom edge y (back-edge source/target port). */
  by: number;
  /** Left edge x (forward edge target port). */
  lx: number;
}

// ---------------------------------------------------------------------------
// Phase 1: Cycle detection via DFS coloring
// ---------------------------------------------------------------------------

/**
 * Detect back-edges using DFS gray-path coloring.
 * Returns a Set of edge indices that are back-edges (or self-loops).
 * Determinism: DFS iterates over nodeIds in declaration order.
 */
function detectBackEdges(nodeIds: string[], edges: FlowEdge[]): Set<number> {
  const backEdges = new Set<number>();
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  for (const id of nodeIds) color.set(id, WHITE);

  // Build adjacency list with edge indices (excluding self-loops upfront)
  const adj = new Map<string, Array<{ to: string; idx: number }>>();
  for (const id of nodeIds) adj.set(id, []);

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (e.from === e.to) {
      // Self-loop: always a back-edge
      backEdges.add(i);
      continue;
    }
    // Only add if both endpoints are known (schema should enforce, but be defensive)
    if (adj.has(e.from)) {
      adj.get(e.from)!.push({ to: e.to, idx: i });
    }
  }

  // Iterative DFS to avoid stack overflow on large graphs
  for (const startId of nodeIds) {
    if (color.get(startId) !== WHITE) continue;

    // Stack holds (nodeId, neighborIteratorIndex)
    const stack: Array<{ id: string; nextNeighbor: number }> = [
      { id: startId, nextNeighbor: 0 },
    ];
    color.set(startId, GRAY);

    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const neighbors = adj.get(top.id) ?? [];

      if (top.nextNeighbor >= neighbors.length) {
        // All neighbors processed: backtrack
        color.set(top.id, BLACK);
        stack.pop();
      } else {
        const { to, idx } = neighbors[top.nextNeighbor]!;
        top.nextNeighbor += 1;

        const c = color.get(to);
        if (c === GRAY) {
          // Back-edge: 'to' is on the current DFS path
          backEdges.add(idx);
        } else if (c === WHITE) {
          color.set(to, GRAY);
          stack.push({ id: to, nextNeighbor: 0 });
        }
        // BLACK: already fully visited, skip
      }
    }
  }

  return backEdges;
}

// ---------------------------------------------------------------------------
// Phase 2: Rank assignment (longest-path from sources)
// ---------------------------------------------------------------------------

/**
 * Compute longest-path ranks for all nodes, ignoring back-edges.
 * Source nodes (in-degree 0 in the residual DAG) receive rank 0.
 * Each other node receives max(predecessor rank) + 1.
 *
 * Determinism: topological sort via DFS iterates over nodeIds in
 * declaration order, so tie-breaking is purely positional.
 */
function assignRanks(
  nodeIds: string[],
  edges: FlowEdge[],
  backEdgeSet: Set<number>,
): Map<string, number> {
  // Build forward adjacency (excluding back-edges and self-loops)
  const outAdj = new Map<string, string[]>();
  for (const id of nodeIds) outAdj.set(id, []);

  for (let i = 0; i < edges.length; i++) {
    if (backEdgeSet.has(i)) continue;
    const e = edges[i]!;
    if (e.from === e.to) continue;
    if (outAdj.has(e.from) && outAdj.has(e.to)) {
      outAdj.get(e.from)!.push(e.to);
    }
  }

  // Topological sort via iterative DFS post-order
  const visited = new Set<string>();
  const topo: string[] = [];

  for (const startId of nodeIds) {
    if (visited.has(startId)) continue;
    // Iterative post-order DFS
    const stack: Array<{ id: string; nextNeighbor: number }> = [
      { id: startId, nextNeighbor: 0 },
    ];
    visited.add(startId);

    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const succs = outAdj.get(top.id) ?? [];

      if (top.nextNeighbor >= succs.length) {
        topo.push(top.id);
        stack.pop();
      } else {
        const s = succs[top.nextNeighbor]!;
        top.nextNeighbor += 1;
        if (!visited.has(s)) {
          visited.add(s);
          stack.push({ id: s, nextNeighbor: 0 });
        }
      }
    }
  }

  topo.reverse(); // reverse post-order = topological order

  // Assign ranks: propagate longest-path forward
  const rank = new Map<string, number>();
  for (const id of nodeIds) rank.set(id, 0);

  for (const u of topo) {
    const r = rank.get(u) ?? 0;
    for (const v of outAdj.get(u) ?? []) {
      const newR = r + 1;
      if (newR > (rank.get(v) ?? 0)) {
        rank.set(v, newR);
      }
    }
  }

  return rank;
}

// ---------------------------------------------------------------------------
// Phase 3: Layer assignment
// ---------------------------------------------------------------------------

/**
 * Group nodeIds by rank, preserving declaration order within each rank.
 */
function buildLayers(
  nodeIds: string[],
  rankMap: Map<string, number>,
): Map<number, string[]> {
  const layers = new Map<number, string[]>();
  for (const id of nodeIds) {
    const r = rankMap.get(id) ?? 0;
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r)!.push(id);
  }
  return layers;
}

// ---------------------------------------------------------------------------
// Phase 3.5: Crossing minimization (barycenter/median heuristic)
// ---------------------------------------------------------------------------

const CROSSING_MIN_SWEEPS = 4;

/**
 * Compute barycenter (mean position of neighbors in reference layer) for each
 * node in `layer`. Nodes with no neighbors in the reference layer retain their
 * current position (stable fallback).
 *
 * @param layer   The layer to compute barycenters for (mutable order).
 * @param adjMap  Adjacency map (node → list of neighbors).
 * @param refPos  Position map for the reference layer (neighbor → index).
 * @returns       Map from node id → barycenter value.
 */
function computeBarycenter(
  layer: string[],
  adjMap: Map<string, string[]>,
  refPos: Map<string, number>,
): Map<string, number> {
  const curPos = new Map<string, number>();
  for (let i = 0; i < layer.length; i++) curPos.set(layer[i]!, i);

  const bc = new Map<string, number>();
  for (const id of layer) {
    const neighbors = adjMap.get(id) ?? [];
    const positions: number[] = [];
    for (const n of neighbors) {
      const p = refPos.get(n);
      if (p !== undefined) positions.push(p);
    }
    bc.set(id, positions.length === 0 ? curPos.get(id)! : positions.reduce((s, p) => s + p, 0) / positions.length);
  }
  return bc;
}

/**
 * Deterministic crossing-minimization using the barycenter heuristic.
 *
 * Runs CROSSING_MIN_SWEEPS alternating forward (left-to-right) and backward
 * (right-to-left) sweeps. Within each sweep, nodes in each layer are sorted
 * by barycenter; ties broken lexicographically by node id for stability.
 *
 * Modifies `layers` in-place.
 * Determinism: fixed sweep count, lexicographic tie-breaking — same input
 * always produces the same output.
 */
function minimizeCrossings(
  layers: Map<number, string[]>,
  edges: FlowEdge[],
  backEdgeSet: Set<number>,
  maxRank: number,
): void {
  // Build forward/backward adjacency maps (skip back-edges and self-loops)
  const predMap = new Map<string, string[]>();
  const succMap = new Map<string, string[]>();
  for (const layer of layers.values()) {
    for (const id of layer) {
      if (!predMap.has(id)) predMap.set(id, []);
      if (!succMap.has(id)) succMap.set(id, []);
    }
  }
  for (let i = 0; i < edges.length; i++) {
    if (backEdgeSet.has(i)) continue;
    const e = edges[i]!;
    if (e.from === e.to) continue;
    succMap.get(e.from)?.push(e.to);
    predMap.get(e.to)?.push(e.from);
  }

  for (let sweep = 0; sweep < CROSSING_MIN_SWEEPS; sweep++) {
    const forward = sweep % 2 === 0;

    if (forward) {
      // Forward sweep: order each layer by barycenter of predecessors
      for (let r = 1; r <= maxRank; r++) {
        const layer = layers.get(r);
        if (!layer || layer.length <= 1) continue;
        const prevLayer = layers.get(r - 1) ?? [];
        const prevPos = new Map<string, number>();
        for (let i = 0; i < prevLayer.length; i++) prevPos.set(prevLayer[i]!, i);
        const bc = computeBarycenter(layer, predMap, prevPos);
        layer.sort((a, b) => (bc.get(a)! - bc.get(b)!) || a.localeCompare(b));
      }
    } else {
      // Backward sweep: order each layer by barycenter of successors
      for (let r = maxRank - 1; r >= 0; r--) {
        const layer = layers.get(r);
        if (!layer || layer.length <= 1) continue;
        const nextLayer = layers.get(r + 1) ?? [];
        const nextPos = new Map<string, number>();
        for (let i = 0; i < nextLayer.length; i++) nextPos.set(nextLayer[i]!, i);
        const bc = computeBarycenter(layer, succMap, nextPos);
        layer.sort((a, b) => (bc.get(a)! - bc.get(b)!) || a.localeCompare(b));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Node size computation
// ---------------------------------------------------------------------------

function computeNodeSize(
  node: FlowNode,
  tk: FlowTheme,
): { w: number; h: number } {
  const lines = splitLabelLines(node.label);
  const iconW =
    tk.showIcons && node.icon && getIcon(node.icon)
      ? tk.iconSize + tk.iconLabelGap
      : 0;
  // Width: widest line among all label lines
  const textW = lines.reduce(
    (max, line) => Math.max(max, Math.ceil(measureText(line, tk.nodeFontSize).width)),
    0,
  );
  // Diamond nodes use double padding so the label fits inside the inscribed area.
  const isDiamond = node.kind === 'diamond';
  const padX = isDiamond ? tk.nodePadX * 2 : tk.nodePadX;
  const padY = isDiamond ? tk.nodePadY * 2 : tk.nodePadY;
  const lineHeight = rhuInt(tk.nodeFontSize * 1.4);
  const w = Math.max(textW + iconW + 2 * padX, tk.minNodeWidth);
  const h = rhuInt(lineHeight * lines.length + 2 * padY);
  return { w, h };
}

// ---------------------------------------------------------------------------
// Arrowhead helpers
// ---------------------------------------------------------------------------

/**
 * Right-pointing filled arrowhead (→) with tip at (tipX, tipY).
 * Used for forward edges in LR orientation.
 */
function rightArrowhead(
  tipX: number,
  tipY: number,
  sz: number,
  fill: string,
): ScenePrimitive {
  const half = rhuInt(sz * 0.6);
  const d = [
    `M ${tipX} ${tipY}`,
    `L ${rhuInt(tipX - sz)} ${rhuInt(tipY - half)}`,
    `L ${rhuInt(tipX - sz)} ${rhuInt(tipY + half)}`,
    'Z',
  ].join(' ');
  return { kind: 'path', d, fill, stroke: 'none', strokeWidth: 0 };
}

/**
 * Upward-pointing filled arrowhead (↑) with tip at (tipX, tipY).
 * Used for back-edges that enter node bottom ports from below.
 */
function upArrowhead(
  tipX: number,
  tipY: number,
  sz: number,
  fill: string,
): ScenePrimitive {
  const half = rhuInt(sz * 0.6);
  const d = [
    `M ${tipX} ${tipY}`,
    `L ${rhuInt(tipX - half)} ${rhuInt(tipY + sz)}`,
    `L ${rhuInt(tipX + half)} ${rhuInt(tipY + sz)}`,
    'Z',
  ].join(' ');
  return { kind: 'path', d, fill, stroke: 'none', strokeWidth: 0 };
}

// ---------------------------------------------------------------------------
// Edge dash pattern resolution
// ---------------------------------------------------------------------------

function resolveEdgeDash(edge: FlowEdge, tk: FlowTheme): string | undefined {
  // Explicit style override takes precedence
  if (edge.style === 'dashed') return tk.edgeDash;
  if (edge.style === 'dotted') return tk.edgeDotted;
  if (edge.style === 'solid') return undefined;
  // Kind-based defaults
  if (edge.kind === 'async') return tk.edgeDash;
  // Animated = dashed resting frame
  if (edge.animated) return tk.animatedEdgeDash;
  return undefined;
}

function resolveEdgeStroke(edge: FlowEdge, tk: FlowTheme): string {
  if (edge.animated) return tk.animatedEdgeStroke;
  return tk.edgeStroke;
}

// ---------------------------------------------------------------------------
// Node primitive emission
// ---------------------------------------------------------------------------

function emitNode(
  placed: PlacedNode,
  tk: FlowTheme,
  primitives: ScenePrimitive[],
): void {
  const { node, x, y, w, h, cx, cy } = placed;

  // Resolve fill and text color: status > kind > default
  const statusFill = node.status ? (tk.statusFills[node.status] ?? null) : null;
  const kindFill = node.kind ? (tk.kindFills[node.kind] ?? null) : null;
  const fill = statusFill ?? kindFill ?? tk.nodeFill;

  const statusTextColor = node.status
    ? (tk.statusTextColors[node.status] ?? null)
    : null;
  const kindTextColor = node.kind
    ? (tk.kindTextColors[node.kind] ?? null)
    : null;
  const textColor = statusTextColor ?? kindTextColor ?? tk.nodeTextColor;

  // Resolve shape kind
  const shapeKind = node.kind ?? 'rounded-rect';

  if (shapeKind === 'circle') {
    // Circle: use the larger of w/h for diameter
    const r = rhuInt(Math.max(w, h) / 2);
    primitives.push({
      kind: 'circle',
      cx,
      cy,
      r,
      fill,
      stroke: tk.nodeStroke,
      strokeWidth: tk.nodeStrokeWidth,
    });
  } else if (shapeKind === 'diamond') {
    // Diamond: rhombus with tips at the four cardinal edge midpoints of the bounding box.
    // The bounding box is (x, y, w, h); tips: top=(cx,y), right=(x+w,cy), bottom=(cx,y+h), left=(x,cy).
    // Edges attach at the right tip (rx) and left tip (lx) — identical to normal port positions.
    const d = [
      `M ${cx} ${y}`,
      `L ${rhuInt(x + w)} ${cy}`,
      `L ${cx} ${rhuInt(y + h)}`,
      `L ${x} ${cy}`,
      'Z',
    ].join(' ');
    primitives.push({
      kind: 'path',
      d,
      fill,
      stroke: tk.nodeStroke,
      strokeWidth: tk.nodeStrokeWidth,
    });
  } else {
    // All rect variants (rect, rounded-rect, stadium)
    const rx =
      shapeKind === 'stadium'
        ? rhuInt(h / 2)
        : shapeKind === 'rect'
          ? 0
          : tk.nodeRx;

    primitives.push({
      kind: 'rect',
      x,
      y,
      width: w,
      height: h,
      fill,
      stroke: tk.nodeStroke,
      strokeWidth: tk.nodeStrokeWidth,
      rx,
    });
  }

  // Icon (if enabled and available)
  let labelX = cx;
  if (tk.showIcons && node.icon) {
    const iconDef = getIcon(node.icon);
    if (iconDef) {
      const iconLeft = rhuInt(x + tk.nodePadX);
      const iconTop = rhuInt(cy - tk.iconSize / 2);
      const scale = tk.iconSize / 24;
      for (const pathDef of iconDef.paths) {
        primitives.push({
          kind: 'path',
          d: pathDef.d,
          fill: pathDef.fill ? textColor : 'none',
          stroke: pathDef.stroke !== false ? textColor : undefined,
          strokeWidth: pathDef.stroke !== false ? 1 : undefined,
          transform: `translate(${iconLeft},${iconTop}) scale(${scale.toFixed(4)})`,
          opacity: 0.85,
        });
      }
      // Shift label right to make room for icon
      const iconTotal = tk.iconSize + tk.iconLabelGap;
      const textAreaW = w - iconTotal - 2 * tk.nodePadX;
      labelX = rhuInt(iconLeft + iconTotal + textAreaW / 2);
    }
  }

  // Label text — single or multi-line depending on break markers in the label
  const labelLines = splitLabelLines(node.label);
  if (labelLines.length > 1) {
    const lineHeight = rhuInt(tk.nodeFontSize * 1.4);
    primitives.push({
      kind: 'multitext',
      x: labelX,
      y: rhuInt(cy - (labelLines.length - 1) * lineHeight / 2),
      lines: labelLines,
      lineHeight,
      fontFamily: tk.fontFamily,
      fontSize: tk.nodeFontSize,
      fontWeight: tk.nodeFontWeight,
      fill: textColor,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
  } else {
    primitives.push({
      kind: 'text',
      x: labelX,
      y: cy,
      text: node.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.nodeFontSize,
      fontWeight: tk.nodeFontWeight,
      fill: textColor,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
  }
}

// ---------------------------------------------------------------------------
// Edge emission (forward edges — cubic Bézier)
// ---------------------------------------------------------------------------

function emitForwardEdge(
  srcPlaced: PlacedNode,
  tgtPlaced: PlacedNode,
  edge: FlowEdge,
  tk: FlowTheme,
  edgePrimitives: ScenePrimitive[],
  arrowPrimitives: ScenePrimitive[],
  labelPrimitives: ScenePrimitive[],
): void {
  const stroke = resolveEdgeStroke(edge, tk);
  const dash = resolveEdgeDash(edge, tk);
  const sw = tk.edgeStrokeWidth;
  const sz = tk.arrowSize;
  const arrowFill = edge.animated ? tk.animatedEdgeStroke : tk.arrowFill;

  // Animation hint for animated edges (SVG only; raster ignores)
  const animHint: SceneAnimation | undefined = edge.animated && dash
    ? { kind: 'dashflow', durSec: tk.animationDurSec }
    : undefined;

  // Port positions (right-center of source, left-center of target)
  const x1 = srcPlaced.rx;
  const y1 = srcPlaced.cy;
  const x2 = tgtPlaced.lx;
  const y2 = tgtPlaced.cy;

  // Arrowhead tip is at (x2, y2); line ends slightly before
  const tipX = x2;
  const tipY = y2;
  const lineEndX = rhuInt(x2 - sz);

  if (tk.edgeStyle === 'straight') {
    // Single straight line
    const d = `M ${rhuInt(x1)} ${rhuInt(y1)} L ${lineEndX} ${rhuInt(y2)}`;
    edgePrimitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke,
      strokeWidth: sw,
      ...(dash ? { dashArray: dash } : {}),
      ...(animHint ? { animation: animHint } : {}),
    });
  } else if (tk.edgeStyle === 'elbow') {
    // Orthogonal elbow: H → V → H
    const midX = rhuInt((x1 + x2) / 2);
    const d = [
      `M ${rhuInt(x1)} ${rhuInt(y1)}`,
      `L ${midX} ${rhuInt(y1)}`,
      `L ${midX} ${rhuInt(y2)}`,
      `L ${lineEndX} ${rhuInt(y2)}`,
    ].join(' ');
    edgePrimitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke,
      strokeWidth: sw,
      ...(dash ? { dashArray: dash } : {}),
      ...(animHint ? { animation: animHint } : {}),
    });
  } else {
    // Default: cubic Bézier (smooth curve)
    const span = x2 - x1;
    const offset = rhuInt(Math.max(span / 3, 20));
    const cp1x = rhuInt(x1 + offset);
    const cp2x = rhuInt(x2 - offset);
    const d = `M ${rhuInt(x1)} ${rhuInt(y1)} C ${cp1x} ${rhuInt(y1)} ${cp2x} ${rhuInt(y2)} ${lineEndX} ${rhuInt(y2)}`;
    edgePrimitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke,
      strokeWidth: sw,
      ...(dash ? { dashArray: dash } : {}),
      ...(animHint ? { animation: animHint } : {}),
    });
  }

  // Arrowhead (right-pointing)
  arrowPrimitives.push(rightArrowhead(tipX, tipY, sz, arrowFill));

  // Edge label (if present): centered at arithmetic midpoint
  if (edge.label) {
    const labelX = rhuInt((x1 + x2) / 2);
    const labelY = rhuInt((y1 + y2) / 2) - 8;  // 8px above midpoint
    labelPrimitives.push({
      kind: 'text',
      x: labelX,
      y: labelY,
      text: edge.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.edgeLabelFontSize,
      fontWeight: tk.edgeLabelFontWeight,
      fill: tk.edgeLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'auto',
    });
  }
}

// ---------------------------------------------------------------------------
// Back-edge emission (cubic Bézier arcing below the diagram)
// ---------------------------------------------------------------------------

function emitBackEdge(
  srcPlaced: PlacedNode,
  tgtPlaced: PlacedNode,
  edge: FlowEdge,
  tk: FlowTheme,
  edgePrimitives: ScenePrimitive[],
  arrowPrimitives: ScenePrimitive[],
  labelPrimitives: ScenePrimitive[],
): void {
  const stroke = tk.backEdgeStroke;
  const dash = tk.backEdgeDash || undefined;
  const sw = tk.edgeStrokeWidth;
  const sz = tk.arrowSize;
  const arrowFill = tk.backEdgeStroke;
  const curvature = tk.backEdgeCurvature;

  // Handle self-loop: small loop off the right side of the node
  if (edge.from === edge.to) {
    const loopX = rhuInt(srcPlaced.rx + 10);
    const loopTopY = rhuInt(srcPlaced.cy - 14);
    const loopBotY = rhuInt(srcPlaced.cy + 14);
    const loopRX = rhuInt(loopX + 30);
    const d = `M ${srcPlaced.rx} ${loopTopY} C ${loopRX} ${loopTopY} ${loopRX} ${loopBotY} ${srcPlaced.rx} ${loopBotY}`;
    edgePrimitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke,
      strokeWidth: sw,
      ...(dash ? { dashArray: dash } : {}),
    });
    arrowPrimitives.push(
      upArrowhead(srcPlaced.rx, loopBotY, sz, arrowFill),
    );
    return;
  }

  // Standard back-edge: arc below the diagram
  const srcBX = srcPlaced.cx;
  const srcBY = srcPlaced.by;
  const tgtBX = tgtPlaced.cx;
  const tgtBY = rhuInt(tgtPlaced.by + sz);  // leave room for arrowhead tip

  const cp1Y = rhuInt(srcBY + curvature);
  const cp2Y = rhuInt(tgtBY + curvature);

  const d = `M ${srcBX} ${srcBY} C ${srcBX} ${cp1Y} ${tgtBX} ${cp2Y} ${tgtBX} ${tgtBY}`;
  edgePrimitives.push({
    kind: 'path',
    d,
    fill: 'none',
    stroke,
    strokeWidth: sw,
    ...(dash ? { dashArray: dash } : {}),
  });

  // Arrowhead: upward-pointing at tgt bottom, shifted up by sz so tip is at node bottom
  arrowPrimitives.push(upArrowhead(tgtBX, tgtPlaced.by, sz, arrowFill));

  // Edge label below the arc midpoint
  if (edge.label) {
    const labelX = rhuInt((srcBX + tgtBX) / 2);
    const labelY = rhuInt(Math.max(srcBY, tgtBY) + curvature + 6);
    labelPrimitives.push({
      kind: 'text',
      x: labelX,
      y: labelY,
      text: edge.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.edgeLabelFontSize,
      fontWeight: tk.edgeLabelFontWeight,
      fill: tk.edgeLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'hanging',
    });
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Lay out `doc` using a deterministic layered (Sugiyama-family) algorithm
 * and produce a Scene with all nodes, labels, and edges.
 *
 * @param doc - Validated FlowDocument.
 * @param themeOverride - Optional theme (overrides metadata.theme lookup).
 * @returns Scene + NodeAnchorRegistry (anchors in local cell coordinates).
 */
export function layoutFlow(
  doc: FlowDocument,
  themeOverride?: FlowTheme,
): RenderWithAnchors<Scene> {
  const tk = themeOverride ?? resolveFlowTheme(doc.metadata?.theme);
  const nodes = doc.flow.nodes;
  const edges = doc.flow.edges;
  const nodeIds = nodes.map((n) => n.id);

  // Node lookup map (by id)
  const nodeMap = new Map<string, FlowNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // ── Phase 1: Cycle detection ──────────────────────────────────────────────
  const backEdgeSet = detectBackEdges(nodeIds, edges);

  // ── Phase 2: Rank assignment ──────────────────────────────────────────────
  const rankMap = assignRanks(nodeIds, edges, backEdgeSet);

  // ── Phase 3: Layer assignment ─────────────────────────────────────────────
  const layers = buildLayers(nodeIds, rankMap);
  const maxRank = nodeIds.length === 0 ? 0 : Math.max(...rankMap.values());

  // ── Phase 3.5: Crossing minimization ─────────────────────────────────────
  if (maxRank > 0) {
    minimizeCrossings(layers, edges, backEdgeSet, maxRank);
  }

  // ── Phase 4: Coordinate assignment ───────────────────────────────────────
  // Compute node sizes
  const nodeSizes = new Map<string, { w: number; h: number }>();
  for (const n of nodes) {
    nodeSizes.set(n.id, computeNodeSize(n, tk));
  }

  // Uniform column width = global max node width
  let globalColW = tk.minNodeWidth;
  for (const { w } of nodeSizes.values()) {
    globalColW = Math.max(globalColW, w);
  }

  // All nodes have the same height (uniform row height)
  let nodeH = rhuInt(tk.nodeFontSize * 1.4 + 2 * tk.nodePadY);
  for (const { h } of nodeSizes.values()) {
    nodeH = Math.max(nodeH, h);
  }

  // Column left-x positions: colX[r] = marginLeft + r * (globalColW + layerGap)
  const colX = (r: number): number =>
    rhuInt(tk.marginLeft + r * (globalColW + tk.layerGap));

  // Compute vertical extents per column to center shorter columns
  const colNodeCounts: number[] = [];
  for (let r = 0; r <= maxRank; r++) {
    colNodeCounts.push(layers.get(r)?.length ?? 0);
  }
  const maxNodesInCol = Math.max(...colNodeCounts, 1);
  const contentH = rhuInt(
    maxNodesInCol * nodeH + (maxNodesInCol - 1) * tk.nodeGap,
  );

  // Place all nodes
  const placed = new Map<string, PlacedNode>();
  for (let r = 0; r <= maxRank; r++) {
    const colNodes = layers.get(r) ?? [];
    const n = colNodes.length;
    const colH = rhuInt(n * nodeH + (n - 1) * tk.nodeGap);
    const startY = rhuInt(tk.marginTop + (contentH - colH) / 2);
    const cx0 = rhuInt(colX(r) + globalColW / 2);

    for (let i = 0; i < n; i++) {
      const id = colNodes[i]!;
      const { w } = nodeSizes.get(id) ?? { w: globalColW };
      const nodeY = rhuInt(startY + i * (nodeH + tk.nodeGap));
      const nodeX = rhuInt(cx0 - w / 2);  // center within column
      const cy = rhuInt(nodeY + nodeH / 2);
      placed.set(id, {
        node: nodeMap.get(id)!,
        x: nodeX,
        y: nodeY,
        w,
        h: nodeH,
        cx: cx0,
        cy,
        rx: rhuInt(nodeX + w),
        by: rhuInt(nodeY + nodeH),
        lx: nodeX,
      });
    }
  }

  // ── Phase 5: Canvas dimensions ────────────────────────────────────────────
  const canvasW = rhuInt(
    colX(maxRank) + globalColW + tk.marginRight,
  );
  const canvasH = rhuInt(
    tk.marginTop + contentH + tk.marginBottom,
  );

  // ── Phase 6: Scene primitive emission ─────────────────────────────────────
  // Painter order: background → back-edges → forward edges → nodes → arrowheads → labels

  const backgroundRect: ScenePrimitive = {
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvasW,
    height: canvasH,
    fill: tk.background,
  };

  const backEdgePaths: ScenePrimitive[] = [];
  const backArrows: ScenePrimitive[] = [];
  const backLabels: ScenePrimitive[] = [];
  const fwdEdgePaths: ScenePrimitive[] = [];
  const fwdArrows: ScenePrimitive[] = [];
  const fwdLabels: ScenePrimitive[] = [];
  const nodePrimitives: ScenePrimitive[] = [];

  // Emit edges
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    const src = placed.get(e.from);
    const tgt = placed.get(e.to);
    if (!src || !tgt) continue;

    if (backEdgeSet.has(i)) {
      emitBackEdge(src, tgt, e, tk, backEdgePaths, backArrows, backLabels);
    } else {
      emitForwardEdge(src, tgt, e, tk, fwdEdgePaths, fwdArrows, fwdLabels);
    }
  }

  // Emit nodes
  for (const p of placed.values()) {
    emitNode(p, tk, nodePrimitives);
  }

  // ── Build node-anchor registry (sidecar — §30b Phase A) ──────────────────
  const anchors: NodeAnchorRegistry = {};
  for (const [id, p] of placed) {
    anchors[id] = { id, x: p.x, y: p.y, w: p.w, h: p.h };
  }

  const scene: Scene = {
    width: canvasW,
    height: canvasH,
    background: tk.background,
    primitives: [
      backgroundRect,
      ...backEdgePaths,
      ...fwdEdgePaths,
      ...nodePrimitives,
      ...backArrows,
      ...fwdArrows,
      ...backLabels,
      ...fwdLabels,
    ],
  };

  return { scene, anchors };
}
