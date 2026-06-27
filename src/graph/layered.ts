/**
 * @file graph/layered.ts — Sugiyama layered graph placement kernel.
 *
 * Implements the full Sugiyama framework:
 *   1. Longest-path layer assignment
 *   2a. DFS back-edge detection (proper cycle identification)
 *   2b. Dummy node insertion for skip edges (spans > 1 layer)
 *   3. Barycentric crossing minimisation — bi-directional sweeps with BIT-based
 *      cross-count feedback loop (Barth et al.); keeps best ordering seen
 *   4. Full Brandes–Köpf coordinate assignment — type-1 conflict detection,
 *      vertical alignment (block chains), horizontal compaction (block graph,
 *      two-pass), 4 sweep directions, smallest-width selection, balance
 *   5. Dummy node removal + bend point extraction (edgeBends on LayeredResult)
 *
 * Shared by the node-link / UML diagram layouts (class, state, er, c4,
 * architecture, requirement, ds) so they all inherit crossing minimisation
 * and improved coordinate assignment automatically. Edge routing is left to
 * callers (they connect the returned boxes via the routing module).
 *
 * Deterministic: stable insertion order within a layer, no clock, no randomness.
 * Termination guaranteed: crossing-min loop exits after 4 non-improving sweeps.
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

// ─── Phase 3 Helper: BIT-Based Crossing Count ────────────────────────────────

/**
 * Count weighted edge crossings across all adjacent layer pairs.
 * Uses the O(E log N) BIT algorithm from Barth et al., "Bilayer Cross Counting."
 * All edge weights are uniform (1). Back-edges and self-loops are excluded.
 */
function crossCount(
  byLayer: Map<number, GraphNode[]>,
  edges: readonly GraphEdge[],
  backEdgeSet: Set<number>,
): number {
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);

  const succList = new Map<string, string[]>();
  for (const [, ns] of byLayer) for (const n of ns) succList.set(n.id, []);
  edges.forEach((e, i) => {
    if (backEdgeSet.has(i) || e.from === e.to) return;
    succList.get(e.from)?.push(e.to);
  });

  let cc = 0;
  for (let i = 1; i < layerKeys.length; i++) {
    cc += bilayerCrossCount(
      byLayer.get(layerKeys[i - 1]!)!,
      byLayer.get(layerKeys[i]!)!,
      succList,
    );
  }
  return cc;
}

function bilayerCrossCount(
  northLayer: GraphNode[],
  southLayer: GraphNode[],
  succList: Map<string, string[]>,
): number {
  if (southLayer.length === 0) return 0;

  const southPos = new Map<string, number>();
  southLayer.forEach((n, i) => southPos.set(n.id, i));

  const positions: number[] = northLayer.flatMap(n =>
    (succList.get(n.id) ?? [])
      .filter(sid => southPos.has(sid))
      .map(sid => southPos.get(sid)!)
      .sort((a, b) => a - b),
  );
  if (positions.length === 0) return 0;

  let firstIndex = 1;
  while (firstIndex < southLayer.length) firstIndex <<= 1;
  const treeSize = 2 * firstIndex - 1;
  firstIndex    -= 1;
  const tree = new Array<number>(treeSize).fill(0);

  let cc = 0;
  for (const pos of positions) {
    let idx = pos + firstIndex;
    tree[idx] = (tree[idx] ?? 0) + 1;
    let weightSum = 0;
    while (idx > 0) {
      if (idx % 2 === 1) weightSum += tree[idx + 1]!;
      idx = (idx - 1) >> 1;
      tree[idx] = (tree[idx] ?? 0) + 1;
    }
    cc += weightSum;
  }
  return cc;
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
 * - Sweeps continue until no strict improvement for 4 consecutive passes
 *   (measured via BIT-based cross-count); best ordering is returned.
 */
function minimizeCrossings(
  byLayer: Map<number, GraphNode[]>,
  edges: readonly GraphEdge[],
  backEdgeSet: Set<number>,
): Map<number, GraphNode[]> {
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

  const origOrder = new Map<string, number>();
  for (const [, nodes] of byLayer) nodes.forEach((n, i) => origOrder.set(n.id, i));

  const order = new Map<number, GraphNode[]>();
  for (const k of layerKeys) order.set(k, [...byLayer.get(k)!]);

  const posInLayer = new Map<string, number>();
  function rebuildPos(): void {
    for (const [, nodes] of order) nodes.forEach((n, i) => posInLayer.set(n.id, i));
  }
  rebuildPos();

  function reorderLayer(layerIdx: number, neighborMap: Map<string, string[]>, biasRight: boolean): void {
    const curr = order.get(layerIdx)!;
    const bary = curr.map((node, i) => {
      const nbrs = neighborMap.get(node.id) ?? [];
      if (nbrs.length === 0) {
        return { node, b: i, orig: origOrder.get(node.id) ?? i };
      }
      const sum = nbrs.reduce((s, nid) => s + (posInLayer.get(nid) ?? 0), 0);
      return { node, b: sum / nbrs.length, orig: origOrder.get(node.id) ?? i };
    });
    bary.sort((a, b) => a.b !== b.b ? a.b - b.b : biasRight ? b.orig - a.orig : a.orig - b.orig);
    order.set(layerIdx, bary.map(e => e.node));
    rebuildPos();
  }

  let bestCC = crossCount(order, edges, backEdgeSet);
  const best = new Map<number, GraphNode[]>();
  for (const [k, v] of order) best.set(k, [...v]);

  // Sweep until no strict improvement for 4 consecutive passes.
  for (let pass = 0, lastBest = 0; lastBest < 4; pass++, lastBest++) {
    const biasRight = pass % 4 >= 2;
    if (pass % 2 === 0) {
      for (let li = 1; li < layerKeys.length; li++) reorderLayer(layerKeys[li]!, pred, biasRight);
    } else {
      for (let li = layerKeys.length - 2; li >= 0; li--) reorderLayer(layerKeys[li]!, succ, biasRight);
    }
    const cc = crossCount(order, edges, backEdgeSet);
    if (cc < bestCC) {
      lastBest = 0;
      bestCC = cc;
      for (const [k, v] of order) best.set(k, [...v]);
    } else if (cc === bestCC) {
      for (const [k, v] of order) best.set(k, [...v]);
    }
  }

  return best;
}

// ─── Phase 4: Full Brandes–Köpf Coordinate Assignment ────────────────────────

/**
 * Assign cross-axis positions using the full Brandes–Köpf algorithm adapted for
 * Triton's data structures (Map<number, GraphNode[]>, no Graph object).
 *
 * Steps: (1) type-1 conflict detection, (2) vertical alignment (block chains),
 * (3) horizontal compaction (block graph, two-pass min then compact) — run for
 * 4 sweep directions (ul, ur, dl, dr). Then (4) pick tightest layout, (5) align
 * all 4 to share its min/max, (6) balance each node as median of 4 aligned values.
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
  const cross   = (n: GraphNode) => isLR ? n.height : n.width;
  const along   = (n: GraphNode) => isLR ? n.width  : n.height;
  const isDummy = (id: string)   => id.startsWith('__dummy_');

  const nodeById = new Map<string, GraphNode>();
  for (const [, ns] of byLayer) for (const n of ns) nodeById.set(n.id, n);

  // Minimum centre-to-centre separation between adjacent nodes in a layer.
  function sep(a: string, b: string): number {
    const an = nodeById.get(a)!;
    const bn = nodeById.get(b)!;
    return cross(an) / 2
      + (isDummy(a) ? 0 : nodeGap / 2)
      + (isDummy(b) ? 0 : nodeGap / 2)
      + cross(bn) / 2;
  }

  const layerKeys  = [...byLayer.keys()].sort((a, b) => a - b);
  const numLayers  = layerKeys.length;
  const baseLayers: string[][] = layerKeys.map(lk => byLayer.get(lk)!.map(n => n.id));

  const predMap = new Map<string, string[]>();
  const succMap = new Map<string, string[]>();
  for (const [, ns] of byLayer) for (const n of ns) {
    predMap.set(n.id, []);
    succMap.set(n.id, []);
  }
  edges.forEach((e, i) => {
    if (backEdgeSet.has(i) || e.from === e.to) return;
    predMap.get(e.to)?.push(e.from);
    succMap.get(e.from)?.push(e.to);
  });

  // ── BK Step 1: Type-1 Conflict Detection ─────────────────────────────────────
  // A type-1 conflict: a non-inner edge crosses an inner segment (dummy→dummy).
  const conflicts = new Set<string>();
  const ck          = (u: string, v: string) => u < v ? `${u}\0${v}` : `${v}\0${u}`;
  const addConflict = (u: string, v: string) => conflicts.add(ck(u, v));
  const hasConflict = (u: string, v: string) => conflicts.has(ck(u, v));

  for (let li = 1; li < numLayers; li++) {
    const prevLayer = baseLayers[li - 1]!;
    const layer     = baseLayers[li]!;

    const prevPos = new Map<string, number>();
    prevLayer.forEach((id, i) => prevPos.set(id, i));

    let k0      = 0;
    let scanPos = 0;
    const lastNode = layer[layer.length - 1];

    layer.forEach((v, i) => {
      let innerPredPos: number | undefined;
      if (isDummy(v)) {
        for (const u of (predMap.get(v) ?? [])) {
          if (isDummy(u) && prevPos.has(u)) { innerPredPos = prevPos.get(u)!; break; }
        }
      }
      const k1 = innerPredPos !== undefined ? innerPredPos : prevLayer.length;

      if (innerPredPos !== undefined || v === lastNode) {
        for (let si = scanPos; si <= i; si++) {
          const sn = layer[si]!;
          for (const u of (predMap.get(sn) ?? [])) {
            if (!prevPos.has(u)) continue;
            const uPos = prevPos.get(u)!;
            if ((uPos < k0 || uPos > k1) && !(isDummy(u) && isDummy(sn))) {
              addConflict(u, sn);
            }
          }
        }
        scanPos = i + 1;
        k0      = k1;
      }
    });
  }

  // ── BK Step 2: Vertical Alignment ────────────────────────────────────────────
  function verticalAlignment(
    sweepLayers: readonly string[][],
    neighborFn:  (v: string) => string[],
  ): { root: Map<string, string>; align: Map<string, string> } {
    const root  = new Map<string, string>();
    const align = new Map<string, string>();
    const pos   = new Map<string, number>();

    for (const layer of sweepLayers) {
      layer.forEach((v, i) => { root.set(v, v); align.set(v, v); pos.set(v, i); });
    }

    for (const layer of sweepLayers) {
      let prevIdx = -1;
      for (const v of layer) {
        const nbrs = neighborFn(v).filter(w => pos.has(w));
        if (nbrs.length === 0) continue;

        nbrs.sort((a, b) => pos.get(a)! - pos.get(b)!);

        const mp = (nbrs.length - 1) / 2;
        for (let mi = Math.floor(mp); mi <= Math.ceil(mp); mi++) {
          const w    = nbrs[mi]!;
          const wPos = pos.get(w)!;
          if (align.get(v) === v && prevIdx < wPos && !hasConflict(v, w)) {
            align.set(w, v);
            const rw = root.get(w)!;
            root.set(v, rw);
            align.set(v, rw);
            prevIdx = wPos;
          }
        }
      }
    }
    return { root, align };
  }

  // ── BK Step 3: Horizontal Compaction ─────────────────────────────────────────
  function horizontalCompaction(
    sweepLayers: readonly string[][],
    root:        Map<string, string>,
  ): Map<string, number> {
    const blockSucc = new Map<string, Map<string, number>>();
    const blockPred = new Map<string, Map<string, number>>();

    function ensureBlock(r: string): void {
      if (!blockSucc.has(r)) { blockSucc.set(r, new Map()); blockPred.set(r, new Map()); }
    }

    for (const layer of sweepLayers) {
      let prevId: string | undefined;
      for (const v of layer) {
        const rv = root.get(v)!;
        ensureBlock(rv);
        if (prevId !== undefined) {
          const rp = root.get(prevId)!;
          if (rp !== rv) {
            const w    = sep(prevId, v);
            const curW = blockSucc.get(rp)!.get(rv) ?? 0;
            if (w > curW) {
              blockSucc.get(rp)!.set(rv, w);
              blockPred.get(rv)!.set(rp, w);
            }
          }
        }
        prevId = v;
      }
    }

    const xs = new Map<string, number>();

    function iterate(
      applyFn: (elem: string) => void,
      nextFn:  (elem: string) => Iterable<string>,
    ): void {
      const stack   = [...blockSucc.keys()];
      const visited = new Set<string>();
      while (stack.length > 0) {
        const elem = stack[stack.length - 1]!;
        if (visited.has(elem)) {
          stack.pop();
          applyFn(elem);
        } else {
          visited.add(elem);
          for (const nxt of nextFn(elem)) stack.push(nxt);
        }
      }
    }

    // Pass 1: assign minimum coordinates.
    iterate(
      elem => {
        let max = 0;
        for (const [from, w] of (blockPred.get(elem) ?? new Map()))
          max = Math.max(max, (xs.get(from) ?? 0) + w);
        xs.set(elem, max);
      },
      elem => blockPred.get(elem)?.keys() ?? [],
    );

    // Pass 2: compact rightward (remove slack).
    iterate(
      elem => {
        const succs = blockSucc.get(elem);
        if (succs && succs.size > 0) {
          let min = Infinity;
          for (const [to, w] of succs) min = Math.min(min, (xs.get(to) ?? 0) - w);
          if (min !== Infinity) xs.set(elem, Math.max(xs.get(elem) ?? 0, min));
        }
      },
      elem => blockSucc.get(elem)?.keys() ?? [],
    );

    // Propagate block-root coordinates to all member nodes.
    for (const layer of sweepLayers) {
      for (const v of layer) xs.set(v, xs.get(root.get(v)!)!);
    }
    return xs;
  }

  // ── BK Step 4: Run 4 independent sweeps ──────────────────────────────────────
  const xss = new Map<string, Map<string, number>>();

  for (const vert of ['u', 'd'] as const) {
    const vertLayers = vert === 'u' ? baseLayers : [...baseLayers].reverse();
    for (const horiz of ['l', 'r'] as const) {
      const sweepLayers = horiz === 'r'
        ? vertLayers.map(layer => [...layer].reverse())
        : vertLayers;
      const neighborFn = vert === 'u'
        ? (v: string) => predMap.get(v) ?? []
        : (v: string) => succMap.get(v) ?? [];

      const { root } = verticalAlignment(sweepLayers, neighborFn);
      let xs = horizontalCompaction(sweepLayers, root);

      if (horiz === 'r') {
        // RL compaction works in a reversed coordinate space; negate to restore.
        const neg = new Map<string, number>();
        for (const [k, v] of xs) neg.set(k, -v);
        xs = neg;
      }
      xss.set(vert + horiz, xs);
    }
  }

  // ── BK Step 5: Find smallest-width alignment ──────────────────────────────────
  let minSpan    = Infinity;
  let smallestXs = xss.get('ul')!;
  for (const [, xs] of xss) {
    let lo = Infinity, hi = -Infinity;
    for (const [id, x] of xs) {
      const n = nodeById.get(id);
      if (!n) continue;
      const half = cross(n) / 2;
      lo = Math.min(lo, x - half);
      hi = Math.max(hi, x + half);
    }
    if (hi - lo < minSpan) { minSpan = hi - lo; smallestXs = xs; }
  }

  // ── BK Step 6: Align all 4 layouts to the smallest-width one ─────────────────
  const refVals = [...smallestXs.values()];
  const refMin  = Math.min(...refVals);
  const refMax  = Math.max(...refVals);

  for (const [key, xs] of xss) {
    if (xs === smallestXs) continue;
    const vals    = [...xs.values()];
    const isRight = key.endsWith('r');
    const delta   = isRight
      ? refMax - Math.max(...vals)
      : refMin - Math.min(...vals);
    if (delta !== 0) {
      const shifted = new Map<string, number>();
      for (const [id, x] of xs) shifted.set(id, x + delta);
      xss.set(key, shifted);
    }
  }

  // ── BK Step 7: Balance — per-node median of the 4 aligned values ─────────────
  const balanced = new Map<string, number>();
  for (const [id] of xss.get('ul')!) {
    const vals = ([...xss.values()].map(xs => xs.get(id) ?? 0)).sort((a, b) => a - b);
    balanced.set(id, ((vals[1] ?? 0) + (vals[2] ?? 0)) / 2);
  }

  // Shift so the leftmost node's left edge sits at `margin`.
  let minLeft = Infinity;
  for (const [id, cx] of balanced) {
    const n = nodeById.get(id);
    if (n) minLeft = Math.min(minLeft, cx - cross(n) / 2);
  }
  const shift = margin - (isFinite(minLeft) ? minLeft : 0);

  // ── Build NodeBox results ─────────────────────────────────────────────────────
  const nodePos   = new Map<string, NodeBox>();
  let alongCursor = margin;

  for (let li = 0; li < numLayers; li++) {
    const layerIdx  = layerKeys[li]!;
    const ns        = byLayer.get(layerIdx)!;
    const layerSize = ns.length > 0 ? Math.max(...ns.map(along)) : 0;

    for (const node of ns) {
      const cx        = (balanced.get(node.id) ?? 0) + shift;
      const crossLeft = cx - cross(node) / 2;
      const alongPos = (isDummy(node.id) && li > 0)
        ? alongCursor - layerGap / 2
        : alongCursor + (layerSize - along(node)) / 2;

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

  // Phase 6: Compact gaps between disconnected subgraphs.
  if (boxes.size > 1) {
    const uf = new Map<string, string>(nodes.map(n => [n.id, n.id]));
    const find = (x: string): string => {
      while (uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x)!)!); x = uf.get(x)!; }
      return x;
    };
    for (const e of edges) {
      if (boxes.has(e.from) && boxes.has(e.to)) {
        const ra = find(e.from), rb = find(e.to);
        if (ra !== rb) uf.set(ra, rb);
      }
    }
    const comps = new Map<string, string[]>();
    for (const id of boxes.keys()) {
      const r = find(id);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r)!.push(id);
    }
    if (comps.size > 1) {
      const compInfos = [...comps.values()].map(ids => ({
        ids,
        left:  Math.min(...ids.map(id => boxes.get(id)!.x)),
        right: Math.max(...ids.map(id => boxes.get(id)!.x + boxes.get(id)!.width)),
      })).sort((a, b) => a.left - b.left);

      let cursor = compInfos[0]!.right;
      for (let ci = 1; ci < compInfos.length; ci++) {
        const comp = compInfos[ci]!;
        const gap = comp.left - cursor;
        const targetGap = nodeGap * 2;
        if (gap > targetGap) {
          const dx = -(gap - targetGap);
          for (const id of comp.ids) {
            const b = boxes.get(id)!;
            boxes.set(id, { id: b.id, x: b.x + dx, y: b.y, width: b.width, height: b.height });
          }
          comp.left  += dx;
          comp.right += dx;
        }
        cursor = comp.right;
      }
    }
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
  forceOrthogonal = false,
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
  // Skipped when forceOrthogonal=true (e.g. class diagrams require rectilinear routing).
  if (!forceOrthogonal &&
      (obstacles.length === 0 || straightLineObstacleFree(pa, pb, obstacles, 10))) {
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
  // When forceOrthogonal is set, prefer a degenerate orthogonal path (V+H) over diagonal.
  const path = route.path
    || (forceOrthogonal
        ? `M ${pa.x} ${pa.y} L ${pa.x} ${pb.y} L ${pb.x} ${pb.y}`
        : `M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}`);
  return { path, labelMidpoint: route.labelPosition };
}
