/**
 * @file graph/layered.ts — Sugiyama layered graph placement kernel.
 *
 * Implements the full Sugiyama framework:
 *   1. Longest-path layer assignment
 *   2a. DFS back-edge detection (proper cycle identification)
 *   2b. Dummy node insertion for skip edges (spans > 1 layer)
 *   3. Barycentric crossing minimisation — bi-directional sweeps, MAX_PASSES = 4
 *   4. Full 4-layout Brandes–Köpf coordinate assignment — median of 4 independent
 *      sweeps (TD+LR, TD+RL, BU+LR, BU+RL), per-node variable sizes
 *   5. Dummy node removal + bend point extraction (edgeBends on LayeredResult)
 *
 * Shared by the node-link / UML diagram layouts (class, state, er, c4,
 * architecture, requirement, ds) so they all inherit crossing minimisation
 * and improved coordinate assignment automatically. Edge routing is left to
 * callers (they connect the returned boxes via the routing module).
 *
 * Deterministic: stable insertion order within a layer, no clock, no randomness.
 * Termination guaranteed: crossing-min pass cap = 4; layer-assignment cap = N passes.
 */

import { orthogonalRouter } from '../routing/router.js';
import { borderPoint } from './connect.js';
import type { Rect, PortDirection } from '../contracts/index.js';

export interface GraphNode {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
}

/** Internal dummy node inserted for skip edges (spans > 1 layer). */
interface DummyNode extends GraphNode {
  readonly isDummy: true;
  readonly originalEdgeIndex: number;
  readonly segmentIndex: number;
}

function makeDummy(edgeIdx: number, segIdx: number): DummyNode {
  return { id: `__dummy_${edgeIdx}_${segIdx}`, width: 0, height: 0, isDummy: true, originalEdgeIndex: edgeIdx, segmentIndex: segIdx };
}

export interface NodeBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayeredOptions {
  /** Primary flow direction. 'TB' stacks layers top→bottom; 'LR' left→right. */
  readonly direction?: 'TB' | 'LR';
  /** Gap between consecutive layers (px). */
  readonly layerGap?: number;
  /** Gap between sibling nodes within a layer (px). */
  readonly nodeGap?: number;
  /** Outer margin (px). */
  readonly margin?: number;
}

export interface LayeredResult {
  readonly boxes: Map<string, NodeBox>;
  readonly width: number;
  readonly height: number;
  /** Bend points for original skip edges (those that spanned > 1 layer).
   *  Key = index into the original `edges` array passed to `layeredLayout`.
   *  Value = ordered list of bend points in layout coordinates (no yOff applied). */
  readonly edgeBends: Map<number, Array<{ x: number; y: number }>>;
}

// ─── Phase 1: Layer Assignment ────────────────────────────────────────────────

/** Assign each node a layer via longest-path; cycles are broken by a pass cap. */
function assignLayers(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Map<string, number> {
  const layer = new Map<string, number>();
  for (const n of nodes) layer.set(n.id, 0);
  const present = (id: string): boolean => layer.has(id);
  // Relax edges up to N passes (caps cycles).
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      if (!present(e.from) || !present(e.to)) continue;
      const want = layer.get(e.from)! + 1;
      if (layer.get(e.to)! < want) { layer.set(e.to, want); changed = true; }
    }
    if (!changed) break;
  }
  return layer;
}

// ─── Phase 2a: DFS Back-Edge Detection ───────────────────────────────────────

/**
 * Identify back-edges using DFS: an edge u→v is a back-edge when v is already
 * on the DFS stack (i.e. v is an ancestor of u). This correctly handles cycles
 * regardless of layer assignment, and correctly classifies self-loops (u→u).
 *
 * Uses an iterative DFS to avoid call-stack overflow on deep graphs.
 * Returns a set of indices into `edges`.
 */
function detectBackEdges(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Set<number> {
  // Build adjacency list: node id → [{to, edgeIdx}]
  const adj = new Map<string, Array<{ to: string; edgeIdx: number }>>();
  for (const n of nodes) adj.set(n.id, []);
  edges.forEach((e, i) => {
    const list = adj.get(e.from);
    if (list) list.push({ to: e.to, edgeIdx: i });
  });

  const visited = new Set<string>();
  const onStack = new Set<string>();
  const backEdges = new Set<number>();

  for (const startNode of nodes) {
    if (visited.has(startNode.id)) continue;

    // Iterative DFS: each stack frame tracks [nodeId, neighborIndex].
    const stack: Array<{ id: string; adjIdx: number }> = [];
    visited.add(startNode.id);
    onStack.add(startNode.id);
    stack.push({ id: startNode.id, adjIdx: 0 });

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = adj.get(frame.id) ?? [];

      if (frame.adjIdx >= neighbors.length) {
        onStack.delete(frame.id);
        stack.pop();
      } else {
        const { to, edgeIdx } = neighbors[frame.adjIdx]!;
        frame.adjIdx++;

        if (onStack.has(to)) {
          backEdges.add(edgeIdx); // back edge (cycle or self-loop)
        } else if (!visited.has(to)) {
          visited.add(to);
          onStack.add(to);
          stack.push({ id: to, adjIdx: 0 });
        }
      }
    }
  }

  return backEdges;
}

// ─── Phase 2b: Dummy Node Insertion ──────────────────────────────────────────

/**
 * For every forward edge u→v spanning more than 1 layer, replace it with a
 * chain of virtual edges through dummy nodes inserted at each intermediate layer.
 *
 * Back edges are kept as-is (they are not expanded).
 *
 * Returns:
 *  - newNodes: original nodes + all dummy nodes
 *  - newEdges: replacement edge array (back edges preserved, skip edges replaced
 *    by chains of adjacent-layer segment edges)
 *  - newBackEdgeSet: back-edge indices in the newEdges array
 *  - dummyChains: original edge index → ordered list of dummy node ids
 *
 * The caller-supplied `layer` Map is mutated to include dummy node layer entries.
 */
function insertDummyNodes(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  layer: Map<string, number>,
  backEdgeSet: Set<number>,
): {
  newNodes: GraphNode[];
  newEdges: GraphEdge[];
  newBackEdgeSet: Set<number>;
  dummyChains: Map<number, string[]>;
} {
  const newNodes: GraphNode[] = [...nodes];
  const newEdges: GraphEdge[] = [];
  const newBackEdgeSet = new Set<number>();
  const dummyChains = new Map<number, string[]>();

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;

    if (backEdgeSet.has(i)) {
      // Keep back edges as-is, recording new index.
      newBackEdgeSet.add(newEdges.length);
      newEdges.push(e);
      continue;
    }

    const lu = layer.get(e.from) ?? 0;
    const lv = layer.get(e.to)   ?? 0;
    const span = lv - lu;

    if (span <= 1) {
      // Adjacent-layer or same-layer forward edge: no expansion needed.
      newEdges.push(e);
      continue;
    }

    // Skip edge: create (span-1) dummy nodes at layers lu+1 … lv-1.
    const dummies: string[] = [];
    for (let seg = 0; seg < span - 1; seg++) {
      const d = makeDummy(i, seg);
      newNodes.push(d);
      layer.set(d.id, lu + 1 + seg);
      dummies.push(d.id);
    }
    dummyChains.set(i, dummies);

    // Replace original edge with a chain: u → d0 → d1 → … → v
    const chain = [e.from, ...dummies, e.to];
    for (let s = 0; s < chain.length - 1; s++) {
      newEdges.push({ from: chain[s]!, to: chain[s + 1]! });
    }
  }

  return { newNodes, newEdges, newBackEdgeSet, dummyChains };
}

// ─── Phase 3: Barycentric Crossing Minimisation ───────────────────────────────

/**
 * Reorder nodes within each layer to reduce edge crossings (Sugiyama Phase 3).
 * Uses the barycentric heuristic with bi-directional sweeps.
 *
 * - Back-edges and self-loops are excluded from barycenter computation.
 * - Nodes without neighbours in the reference layer keep their current relative
 *   order (their current position index is used as the barycenter).
 * - Tie-breaking uses the original insertion index — deterministic and stable.
 * - At most MAX_PASSES (4) bi-directional passes — provably terminates.
 */
function minimizeCrossings(
  byLayer: Map<number, GraphNode[]>,
  edges: readonly GraphEdge[],
  backEdgeSet: Set<number>,
): Map<number, GraphNode[]> {
  // Build forward-edge predecessor and successor maps.
  const pred = new Map<string, string[]>();
  const succ = new Map<string, string[]>();
  for (const [, nodes] of byLayer) {
    for (const n of nodes) { pred.set(n.id, []); succ.set(n.id, []); }
  }
  edges.forEach((e, i) => {
    if (backEdgeSet.has(i) || e.from === e.to) return;
    pred.get(e.to)?.push(e.from);
    succ.get(e.from)?.push(e.to);
  });

  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);

  // Original insertion index — stable tie-break preserved across all passes.
  const origOrder = new Map<string, number>();
  for (const [, nodes] of byLayer) nodes.forEach((n, i) => origOrder.set(n.id, i));

  // Working layer arrays starting from insertion order.
  const order = new Map<number, GraphNode[]>();
  for (const k of layerKeys) order.set(k, [...byLayer.get(k)!]);

  // Position of each node in its current layer (rebuilt after every reorder).
  const posInLayer = new Map<string, number>();
  function rebuildPos(): void {
    for (const [, nodes] of order) nodes.forEach((n, i) => posInLayer.set(n.id, i));
  }
  rebuildPos();

  function reorderLayer(layerIdx: number, neighborMap: Map<string, string[]>): void {
    const curr = order.get(layerIdx)!;
    const bary = curr.map((node, i) => {
      const nbrs = neighborMap.get(node.id) ?? [];
      if (nbrs.length === 0) {
        // No anchoring neighbours: preserve current relative order.
        return { node, b: i, orig: origOrder.get(node.id) ?? i };
      }
      const sum = nbrs.reduce((s, nid) => s + (posInLayer.get(nid) ?? 0), 0);
      return { node, b: sum / nbrs.length, orig: origOrder.get(node.id) ?? i };
    });
    // Stable sort: primary = barycenter, secondary = original insertion order.
    bary.sort((a, b) => (a.b !== b.b ? a.b - b.b : a.orig - b.orig));
    order.set(layerIdx, bary.map(e => e.node));
    rebuildPos();
  }

  const MAX_PASSES = 4;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (pass % 2 === 0) {
      // Downward sweep: reorder each layer using predecessor positions.
      for (let li = 1; li < layerKeys.length; li++) reorderLayer(layerKeys[li]!, pred);
    } else {
      // Upward sweep: reorder each layer using successor positions.
      for (let li = layerKeys.length - 2; li >= 0; li--) reorderLayer(layerKeys[li]!, succ);
    }
  }

  return order;
}

// ─── Phase 4: Full 4-Layout Brandes–Köpf Coordinate Assignment ───────────────

/**
 * Assign cross-axis positions using the full 4-layout Brandes–Köpf approach
 * (Sugiyama Phase 4), adapted for variable per-node sizes.
 *
 * Four independent sweeps are computed:
 *   1. Top-down  + Left-to-right  (TD+LR): align to predecessors, left priority
 *   2. Top-down  + Right-to-left  (TD+RL): align to predecessors, right priority
 *   3. Bottom-up + Left-to-right  (BU+LR): align to successors,  left priority
 *   4. Bottom-up + Right-to-left  (BU+RL): align to successors,  right priority
 *
 * For each node, the final cross-axis centre is the **median** of the 4 values
 * (sort the 4, average the middle two). This dramatically reduces the impact
 * of any single sweep's quirks.
 *
 * Back-edges and self-loops are excluded from preference computation.
 * Returns a NodeBox map with all nodes (including dummies) placed.
 */
function assignCoordinatesBK4(
  byLayer: Map<number, GraphNode[]>,
  edges: readonly GraphEdge[],
  backEdgeSet: Set<number>,
  isLR: boolean,
  nodeGap: number,
  layerGap: number,
  margin: number,
): Map<string, NodeBox> {
  // cross(n): size in the cross-axis (width for TB, height for LR).
  // along(n): size in the flow-axis.
  const cross = (n: GraphNode) => isLR ? n.height : n.width;
  const along = (n: GraphNode) => isLR ? n.width  : n.height;

  // Dummy nodes (invisible bend points) get zero spacing; real nodes get nodeGap.
  const DUMMY_GAP = 0;
  const isDummy = (n: GraphNode) => n.id.startsWith('__dummy_');
  const gapAfter = (n: GraphNode) => isDummy(n) ? DUMMY_GAP : nodeGap;

  // Forward-edge predecessor and successor maps.
  const predMap = new Map<string, string[]>();
  const succMap = new Map<string, string[]>();
  for (const [, ns] of byLayer) {
    for (const n of ns) { predMap.set(n.id, []); succMap.set(n.id, []); }
  }
  edges.forEach((e, i) => {
    if (backEdgeSet.has(i) || e.from === e.to) return;
    predMap.get(e.to)?.push(e.from);
    succMap.get(e.from)?.push(e.to);
  });

  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
  const numLayers = layerKeys.length;

  // Precompute total cross span of each layer (sum of cross sizes + gaps).
  const layerSpan = new Map<number, number>();
  for (const lk of layerKeys) {
    const ns = byLayer.get(lk)!;
    layerSpan.set(lk, ns.reduce((s, n, i) => s + cross(n) + (i > 0 ? gapAfter(n) : 0), 0));
  }
  const maxSpan = Math.max(0, ...[...layerSpan.values()]);

  /**
   * Run one sweep and return the cross-axis centre for each node.
   *
   * @param topDown   true → iterate layers top→bottom, use predecessors;
   *                  false → bottom→top, use successors.
   * @param leftToRight  true → within each layer enforce gaps left→right;
   *                     false → right→left.
   */
  function onePass(topDown: boolean, leftToRight: boolean): Map<string, number> {
    const crossCentre = new Map<string, number>();
    const neighborMap = topDown ? predMap : succMap;

    const layerIndices = topDown
      ? Array.from({ length: numLayers }, (_, i) => i)
      : Array.from({ length: numLayers }, (_, i) => numLayers - 1 - i);

    for (const li of layerIndices) {
      const layerIdx = layerKeys[li]!;
      const ns = byLayer.get(layerIdx)!;
      if (ns.length === 0) continue;

      const span = layerSpan.get(layerIdx)!;

      // Centering fallback: centre this layer within the widest layer.
      const centeredStart = margin + (maxSpan - span) / 2;
      let cursor = centeredStart;
      const idealPos = new Map<string, number>();
      for (const n of ns) {
        const nbrs = neighborMap.get(n.id) ?? [];
        const placed = nbrs
          .map(nid => crossCentre.get(nid))
          .filter((c): c is number => c !== undefined);
        idealPos.set(
          n.id,
          placed.length === 0
            ? cursor + cross(n) / 2  // no placed neighbours → centred fallback
            : placed.reduce((s, c) => s + c, 0) / placed.length,
        );
        cursor += cross(n) + gapAfter(n);
      }

      // Place nodes in sweep order, enforcing minimum separation.
      if (leftToRight) {
        let placeCursor = margin;
        for (const n of ns) {
          const half = cross(n) / 2;
          const ideal = idealPos.get(n.id)!;
          const pos = Math.max(placeCursor + half, ideal);
          crossCentre.set(n.id, pos);
          placeCursor = pos + half + gapAfter(n);
        }
      } else {
        let placeCursor = margin + maxSpan;
        for (const n of [...ns].reverse()) {
          const half = cross(n) / 2;
          const ideal = idealPos.get(n.id)!;
          const pos = Math.min(placeCursor - half, ideal);
          crossCentre.set(n.id, pos);
          placeCursor = pos - half - gapAfter(n);
        }
      }
    }

    return crossCentre;
  }

  // Run the 4 independent layouts.
  const p1 = onePass(true,  true);   // TD + LR
  const p2 = onePass(true,  false);  // TD + RL
  const p3 = onePass(false, true);   // BU + LR
  const p4 = onePass(false, false);  // BU + RL

  // Median of 4: sort, average middle two.
  function median4(a: number, b: number, c: number, d: number): number {
    const s = [a, b, c, d].sort((x, y) => x - y);
    return (s[1]! + s[2]!) / 2;
  }

  // Build NodeBox entries using median cross-axis and layer-order flow-axis.
  const nodePos = new Map<string, NodeBox>();
  let alongCursor = margin;

  for (let li = 0; li < numLayers; li++) {
    const layerIdx  = layerKeys[li]!;
    const ns        = byLayer.get(layerIdx)!;
    const layerSize = ns.length > 0 ? Math.max(...ns.map(along)) : 0;

    for (const node of ns) {
      const fallback   = margin + cross(node) / 2;
      const c1         = p1.get(node.id) ?? fallback;
      const c2         = p2.get(node.id) ?? fallback;
      const c3         = p3.get(node.id) ?? fallback;
      const c4         = p4.get(node.id) ?? fallback;
      const crossCentr = median4(c1, c2, c3, c4);
      const crossLeft  = crossCentr - cross(node) / 2;
      const alongPos   = alongCursor + (layerSize - along(node)) / 2;

      nodePos.set(node.id, {
        id:     node.id,
        x:      isLR ? alongPos  : crossLeft,
        y:      isLR ? crossLeft : alongPos,
        width:  node.width,
        height: node.height,
      });
    }
    alongCursor += layerSize + layerGap;
  }

  return nodePos;
}

// ─── Public Entry ─────────────────────────────────────────────────────────────

export function layeredLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  options: LayeredOptions = {},
): LayeredResult {
  const direction  = options.direction ?? 'TB';
  const layerGap   = options.layerGap ?? 70;
  const nodeGap    = options.nodeGap ?? 40;
  const margin     = options.margin ?? 32;
  const isLR       = direction === 'LR';

  if (nodes.length === 0) return { boxes: new Map(), width: margin * 2, height: margin * 2, edgeBends: new Map() };

  // Phase 1: Layer assignment.
  const layer    = assignLayers(nodes, edges);

  // Phase 2a: Back-edge detection (DFS).
  const backEdges = detectBackEdges(nodes, edges);

  // Phase 2b: Dummy node insertion for skip edges (spans > 1 layer).
  // `layer` is mutated to include dummy node layer assignments.
  const { newNodes, newEdges, newBackEdgeSet, dummyChains } =
    insertDummyNodes(nodes, edges, layer, backEdges);

  // Rebuild byLayer with all nodes (real + dummy).
  const newMaxLayer = Math.max(...newNodes.map(n => layer.get(n.id)!));
  const byLayerArr: Map<number, GraphNode[]> = new Map();
  for (let i = 0; i <= newMaxLayer; i++) byLayerArr.set(i, []);
  for (const n of newNodes) byLayerArr.get(layer.get(n.id)!)!.push(n);

  // Phase 3: Crossing minimisation (barycentric, bi-directional sweeps).
  const orderedByLayer = minimizeCrossings(byLayerArr, newEdges, newBackEdgeSet);

  // Phase 4: Full 4-layout B–K coordinate assignment (variable node sizes).
  const allBoxesMap = assignCoordinatesBK4(
    orderedByLayer, newEdges, newBackEdgeSet,
    isLR, nodeGap, layerGap, margin,
  );

  // Phase 5: Extract bend points from dummy node positions.
  const edgeBends = new Map<number, Array<{ x: number; y: number }>>();
  for (const [origEdgeIdx, dummyIds] of dummyChains) {
    const bends = dummyIds.map(id => {
      const b = allBoxesMap.get(id)!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    edgeBends.set(origEdgeIdx, bends);
  }

  // Remove dummy nodes from result boxes (callers only see real nodes).
  const boxes = new Map<string, NodeBox>();
  for (const [id, box] of allBoxesMap) {
    if (!id.startsWith('__dummy_')) boxes.set(id, box);
  }

  // Compute total diagram dimensions from placed real boxes.
  const allBoxes = [...boxes.values()];
  const width  = allBoxes.length > 0
    ? Math.max(...allBoxes.map(b => b.x + b.width))  + margin
    : margin * 2;
  const height = allBoxes.length > 0
    ? Math.max(...allBoxes.map(b => b.y + b.height)) + margin
    : margin * 2;

  return { boxes, width, height, edgeBends };
}

// ─── Straight-line obstacle check ────────────────────────────────────────────

/**
 * Returns true if segment p1→p2 does not pass through the strict interior of
 * any obstacle (with padding). Uses Liang–Barsky clipping.
 */
function straightLineObstacleFree(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  obstacles: ReadonlyArray<Rect>,
  padding: number,
): boolean {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  for (const obs of obstacles) {
    const xmin = obs.x - padding, xmax = obs.x + obs.width  + padding;
    const ymin = obs.y - padding, ymax = obs.y + obs.height + padding;
    let tmin = 0, tmax = 1;
    const clips = [
      { p: -dx, q: p1.x - xmin },
      { p:  dx, q: xmax - p1.x },
      { p: -dy, q: p1.y - ymin },
      { p:  dy, q: ymax - p1.y },
    ];
    let crosses = true;
    for (const { p, q } of clips) {
      if (Math.abs(p) < 1e-10) {
        if (q <= 0) { crosses = false; break; }
      } else {
        const t = q / p;
        if (p < 0) tmin = Math.max(tmin, t);
        else       tmax = Math.min(tmax, t);
        if (tmin >= tmax) { crosses = false; break; }
      }
    }
    if (crosses) return false; // this obstacle blocks the straight line
  }
  return true;
}

// ─── Obstacle-Avoiding Edge Routing ───────────────────────────────────────────

/**
 * Route an edge between two node boxes with obstacle avoidance.
 *
 * If a straight line from `fromPt` to `toPt` is unobstructed, it is used
 * directly. Otherwise the orthogonal router produces a bent path.
 *
 * @param fromBox   Source node box (in laid.boxes coordinates).
 * @param toBox     Target node box (in laid.boxes coordinates).
 * @param allBoxes  All node boxes in the diagram (obstacles are inferred from these).
 * @param yOff      Vertical offset to apply (e.g. title height) when computing world coords.
 * @param fromPt    Optional explicit source attachment point (overrides borderPoint).
 * @param toPt      Optional explicit target attachment point (overrides borderPoint).
 */
export function routeEdge(
  fromBox: NodeBox,
  toBox: NodeBox,
  allBoxes: ReadonlyArray<NodeBox>,
  yOff = 0,
  fromPt?: { x: number; y: number },
  toPt?: { x: number; y: number },
): { path: string; labelMidpoint: { x: number; y: number } } {
  const fromRect: Rect = { x: fromBox.x, y: fromBox.y + yOff, width: fromBox.width, height: fromBox.height };
  const toRect:   Rect = { x: toBox.x,   y: toBox.y   + yOff, width: toBox.width,   height: toBox.height   };

  const fromCx = fromRect.x + fromRect.width  / 2;
  const fromCy = fromRect.y + fromRect.height / 2;
  const toCx   = toRect.x   + toRect.width    / 2;
  const toCy   = toRect.y   + toRect.height   / 2;

  // Infer port directions from geometry (favour dominant axis).
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  let fromDir: PortDirection;
  let toDir:   PortDirection;
  if (Math.abs(dy) >= Math.abs(dx)) {
    fromDir = dy > 0 ? 'S' : 'N';
    toDir   = dy > 0 ? 'N' : 'S';
  } else {
    fromDir = dx > 0 ? 'E' : 'W';
    toDir   = dx > 0 ? 'W' : 'E';
  }

  // Use caller-supplied attachment points when provided; otherwise clip to border.
  const pa = fromPt ?? borderPoint(fromRect, toCx, toCy);
  const pb = toPt   ?? borderPoint(toRect,   fromCx, fromCy);

  // Every box that is neither the source nor the target is an obstacle.
  const fromId = fromBox.id;
  const toId   = toBox.id;
  const obstacles: Rect[] = allBoxes
    .filter(b => b.id !== fromId && b.id !== toId)
    .map(b => ({ x: b.x, y: b.y + yOff, width: b.width, height: b.height }));

  // Fast path: use a straight line when no obstacle blocks it.
  if (obstacles.length === 0 || straightLineObstacleFree(pa, pb, obstacles, 10)) {
    return {
      path: `M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}`,
      labelMidpoint: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
    };
  }

  const route = orthogonalRouter.route({
    from: pa, to: pb,
    style: 'orthogonal',
    obstacles,
    padding: 10,
    fromDir,
    toDir,
  });

  // Fallback: if the router produces an empty path, use a straight line.
  const path = route.path || `M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}`;
  return { path, labelMidpoint: route.labelPosition };
}
