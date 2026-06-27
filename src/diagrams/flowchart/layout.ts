import type { FlowDocument, FlowNode, FlowEdge, FlowDirection } from './ir.js';
import type { Scene, SceneElement, Rect, Point, LayoutResult, NodeAnchorRegistry, NodeAnchor, OccupiedPort, LayoutOptions } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import type { CardinalSide } from '../../contracts/index.js';
import { getRouter } from '../../routing/registry.js';
import { defaultRouter } from '../../routing/router.js';
import { applyOverlays } from '../../overlay/apply.js';
import { pen } from '../../scene/build.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 120;
const NODE_H = 40;
const ARROW_MARKER_ID = 'triton-arrow';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export function layoutFlowchart(ir: FlowDocument, theme: ResolvedTheme, options?: LayoutOptions): LayoutResult {
  const { spacing, palette, typography, edges: edgeTheme } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const isLR = ir.direction === 'LR' || ir.direction === 'RL';
  const isReverse = ir.direction === 'RL' || ir.direction === 'BT';

  // ── Layer assignment ───────────────────────────────────────────────────────
  const layers = assignLayers(ir.nodes, ir.edges);
  const byLayer = groupByLayer(ir.nodes, layers);

  // ── Phase 3: Crossing minimisation ────────────────────────────────────────
  // Back-edges computed once; reused by both layout phases and the edge-drawing
  // loop below (avoids a second DFS).
  const backEdges = findBackEdges(ir.nodes, ir.edges);
  const orderedByLayer = minimizeCrossings(byLayer, ir.edges, backEdges);

  // ── Phase 4: Brandes–Köpf coordinate assignment ───────────────────────────
  const colGap = spacing.nodeGap;
  const rowGap = spacing.nodeGap;

  let maxNodesInLayer = 0;
  for (const [, nodes] of orderedByLayer) maxNodesInLayer = Math.max(maxNodesInLayer, nodes.length);

  const nodePos = assignCoordinatesBK(
    orderedByLayer, ir.edges, backEdges,
    isLR, isReverse, maxNodesInLayer,
    NODE_W, NODE_H, colGap, rowGap, margin,
  );

  // ── Build scene elements ───────────────────────────────────────────────────
  const elements: SceneElement[] = [];

  // Title
  if (ir.metadata.title) {
    elements.push(p.text(ir.metadata.title, margin, margin - 8, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // Subgraph backgrounds (drawn first — behind nodes)
  for (const sg of ir.subgraphs) {
    const sgRects = sg.nodeIds
      .map(id => nodePos.get(id))
      .filter((r): r is Rect => r !== undefined);
    if (sgRects.length === 0) continue;
    const pad = 12;
    const minX = Math.min(...sgRects.map(r => r.x)) - pad;
    const minY = Math.min(...sgRects.map(r => r.y)) - pad - 20;
    const maxX = Math.max(...sgRects.map(r => r.x + r.width))  + pad;
    const maxY = Math.max(...sgRects.map(r => r.y + r.height)) + pad;
    elements.push(p.rect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, palette.surface, palette.border, 1, { rx: 6, opacity: 0.6 }));
    elements.push(p.text(sg.label, minX + 8, minY + 14, typography.smallFontSize, palette.textMuted));
  }

  // Edges (drawn before nodes so nodes appear on top).
  //
  // Back-edges (the cycle-closing edges identified by `findBackEdges`, the same
  // set excluded from layer ranks) and self-loops are routed specially so they
  // read as "feedback" instead of cutting straight back through the node column.
  // Every OTHER (forward / acyclic) edge takes the unchanged orthogonal-router
  // path below, so acyclic diagrams render byte-identically.
  // (backEdges was computed in the layout phase above — reused here.)
  let bowMaxX = -Infinity;
  let bowMaxY = -Infinity;

  for (let ei = 0; ei < ir.edges.length; ei++) {
    const edge = ir.edges[ei]!;
    const fromRect = nodePos.get(edge.from);
    const toRect   = nodePos.get(edge.to);
    if (!fromRect || !toRect) continue;

    const dash = edge.style === 'dotted' ? '6 3' : edge.style === 'dashed' ? '8 4' : undefined;

    // Self-loop (A → A): a small loop off one side, never a zero-length line.
    if (edge.from === edge.to) {
      const loop = selfLoopRoute(fromRect, isLR);
      elements.push(p.path(loop.path, edge.kind === 'async' ? palette.textMuted : palette.primary, edgeTheme.strokeWidth, {
        ...(dash !== undefined ? { dash } : {}),
        markerEnd: ARROW_MARKER_ID,
      }));
      bowMaxX = Math.max(bowMaxX, loop.maxX);
      bowMaxY = Math.max(bowMaxY, loop.maxY);
      if (edge.label) {
        elements.push(p.text(edge.label, loop.labelPos.x, loop.labelPos.y - 4, edgeTheme.labelFontSize, palette.textMuted, { anchor: 'middle' }));
      }
      continue;
    }

    // Back-edge (feedback): bow out to one side around the intervening nodes.
    if (backEdges.has(ei)) {
      const bow = backEdgeRoute(fromRect, toRect, isLR);
      elements.push(p.path(bow.path, edge.kind === 'async' ? palette.textMuted : palette.primary, edgeTheme.strokeWidth, {
        ...(dash !== undefined ? { dash } : {}),
        markerEnd: ARROW_MARKER_ID,
      }));
      bowMaxX = Math.max(bowMaxX, bow.maxX);
      bowMaxY = Math.max(bowMaxY, bow.maxY);
      if (edge.label) {
        elements.push(p.text(edge.label, bow.labelPos.x, bow.labelPos.y - 4, edgeTheme.labelFontSize, palette.textMuted, { anchor: 'middle' }));
      }
      continue;
    }

    // Forward edge — UNCHANGED orthogonal route (preserves byte-identical output).
    const fromAnchor = edgeAnchor(fromRect, ir.direction, 'exit',  toRect);
    const toAnchor   = edgeAnchor(toRect,   ir.direction, 'enter', fromRect);

    const style = 'orthogonal';
    const router = getRouter(style) ?? defaultRouter;
    const route = router.route({
      from: fromAnchor.point,
      to: toAnchor.point,
      style,
      obstacles: [],
      padding: 8,
      fromDir: fromAnchor.portDir,
      toDir: toAnchor.portDir,
    });

    elements.push(p.path(route.path, edge.kind === 'async' ? palette.textMuted : palette.primary, edgeTheme.strokeWidth, {
      ...(dash !== undefined ? { dash } : {}),
      markerEnd: ARROW_MARKER_ID,
    }));

    if (edge.label) {
      const lp = route.labelPosition;
      elements.push(p.text(edge.label, lp.x, lp.y - 4, edgeTheme.labelFontSize, palette.textMuted, { anchor: 'middle' }));
    }
  }

  // Nodes
  for (const node of ir.nodes) {
    const r = nodePos.get(node.id);
    if (!r) continue;

    const nodeElements: SceneElement[] = [];
    const fill   = nodeStatusFill(node, palette);
    const stroke = palette.border;

    nodeElements.push(...renderNodeShape(node, r, fill, stroke, edgeTheme.strokeWidth));
    nodeElements.push(p.text(node.label, r.x + NODE_W / 2, r.y + NODE_H / 2 + typography.baseFontSize * 0.35, typography.baseFontSize, palette.text, { anchor: 'middle' }));

    elements.push(p.group(nodeElements, { id: node.id }));
  }

  // ── Compute viewBox ────────────────────────────────────────────────────────
  const allRects = [...nodePos.values()];
  const nodeRight  = Math.max(...allRects.map(r => r.x + r.width));
  const nodeBottom = Math.max(...allRects.map(r => r.y + r.height));
  // Grow only for back-edge / self-loop bows; with none, this is byte-identical.
  const right  = (Number.isFinite(bowMaxX) ? Math.max(nodeRight,  bowMaxX) : nodeRight)  + margin;
  const bottom = (Number.isFinite(bowMaxY) ? Math.max(nodeBottom, bowMaxY) : nodeBottom) + margin;
  const titleOffset = ir.metadata.title ? typography.titleFontSize + 12 : 0;

  let scene: Scene = {
    viewBox: { x: 0, y: 0, width: right, height: bottom + titleOffset },
    background: palette.background,
    elements,
    defs: [arrowMarkerDef(palette.primary, edgeTheme.arrowSize)],
  };

  // ── Overlays ───────────────────────────────────────────────────────────────
  scene = applyOverlays(scene, ir.overlays, theme);

  // ── Build anchor registry ──────────────────────────────────────────────────
  const anchors: Record<string, NodeAnchor> = {};
  for (const [id, rect] of nodePos) {
    anchors[id] = {
      bounds: rect,
      ports: {
        N: { x: rect.x + rect.width / 2, y: rect.y },
        S: { x: rect.x + rect.width / 2, y: rect.y + rect.height },
        E: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
        W: { x: rect.x, y: rect.y + rect.height / 2 },
      },
    };
  }

  // ── Occupied ports: record which wall each edge exits/enters ──────────────
  const occupiedPorts: OccupiedPort[] = [];
  for (const edge of ir.edges) {
    const fromRect = nodePos.get(edge.from);
    const toRect   = nodePos.get(edge.to);
    if (!fromRect || !toRect) continue;
    const fromAnch = edgeAnchor(fromRect, ir.direction, 'exit',  toRect);
    const toAnch   = edgeAnchor(toRect,   ir.direction, 'enter', fromRect);
    occupiedPorts.push({
      nodeKey: edge.from,
      wall:    fromAnch.portDir as CardinalSide,
      t:       wallT(fromRect, fromAnch.portDir as CardinalSide, fromAnch.point),
      source:  'intra',
    });
    occupiedPorts.push({
      nodeKey: edge.to,
      wall:    toAnch.portDir as CardinalSide,
      t:       wallT(toRect, toAnch.portDir as CardinalSide, toAnch.point),
      source:  'intra',
    });
  }

  return { scene, anchors, occupiedPorts };
}

// ─── Layer Assignment ─────────────────────────────────────────────────────────

/**
 * Identify back-edges (the edges that close a cycle) via an iterative DFS.
 *
 * Removing a DFS's back-edge set always yields a DAG, so the longest-path
 * layering below is guaranteed to terminate on ANY graph. The back-edges are
 * still drawn in their original direction by the edge loop in
 * {@link layoutFlowchart}; they are only excluded from rank assignment.
 *
 * Returns a set of indices into `edges`. Deterministic: nodes and edges are
 * visited in their given order. Iterative (explicit stack) to stay safe on
 * deep graphs.
 */
function findBackEdges(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): Set<number> {
  const adj = new Map<string, Array<{ to: string; idx: number }>>();
  for (const n of nodes) adj.set(n.id, []);
  edges.forEach((e, idx) => { adj.get(e.from)?.push({ to: e.to, idx }); });

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);

  const backEdges = new Set<number>();

  for (const start of nodes) {
    if (color.get(start.id) !== WHITE) continue;
    const stack: Array<{ id: string; i: number }> = [{ id: start.id, i: 0 }];
    color.set(start.id, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = adj.get(frame.id)!;
      if (frame.i < neighbors.length) {
        const { to, idx } = neighbors[frame.i]!;
        frame.i++;
        const c = color.get(to);
        // GRAY target (incl. a self-loop, where target === current) closes a cycle.
        if (c === GRAY) {
          backEdges.add(idx);
        } else if (c === WHITE) {
          color.set(to, GRAY);
          stack.push({ id: to, i: 0 });
        }
        // BLACK target → forward/cross edge: keep it.
      } else {
        color.set(frame.id, BLACK);
        stack.pop();
      }
    }
  }

  return backEdges;
}

function assignLayers(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): Map<string, number> {
  // Cycle breaking: drop back-edges so layering runs on a DAG and terminates.
  // (Back-edges are still rendered by the edge loop — only excluded from ranks.)
  const backEdges = findBackEdges(nodes, edges);
  const forwardEdges = edges.filter((_, i) => !backEdges.has(i));

  const predecessors = new Map<string, Set<string>>();
  for (const n of nodes) predecessors.set(n.id, new Set());
  for (const e of forwardEdges) predecessors.get(e.to)?.add(e.from);

  const layers = new Map<string, number>();
  const queue: Array<{ id: string; layer: number }> = [];

  // Roots: nodes with no predecessors (in the acyclic edge subset)
  for (const n of nodes) {
    if ((predecessors.get(n.id)?.size ?? 0) === 0) {
      queue.push({ id: n.id, layer: 0 });
    }
  }

  while (queue.length > 0) {
    const item = queue.shift()!;
    const current = layers.get(item.id) ?? -1;
    if (item.layer <= current) continue;
    layers.set(item.id, item.layer);
    for (const e of forwardEdges) {
      if (e.from === item.id) queue.push({ id: e.to, layer: item.layer + 1 });
    }
  }

  // Assign disconnected nodes to layer 0
  for (const n of nodes) {
    if (!layers.has(n.id)) layers.set(n.id, 0);
  }

  return layers;
}

function groupByLayer(nodes: readonly FlowNode[], layers: Map<string, number>): Map<number, FlowNode[]> {
  const groups = new Map<number, FlowNode[]>();
  for (const node of nodes) {
    const l = layers.get(node.id) ?? 0;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(node);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a - b));
}

// ─── Phase 3: Barycentric Crossing Minimisation ──────────────────────────────

/**
 * Reorder nodes within each layer to reduce edge crossings using the
 * barycentric heuristic with bi-directional sweeps (Sugiyama Phase 3).
 *
 * - Back-edges and self-loops are excluded from barycenter computation.
 * - Nodes without neighbors in the reference layer keep their current relative
 *   order (their current position index is used as the barycenter).
 * - Tie-breaking uses the original insertion index (deterministic / stable).
 * - At most MAX_PASSES (4) bi-directional passes — provably terminates.
 */
function minimizeCrossings(
  byLayer: Map<number, FlowNode[]>,
  edges: readonly FlowEdge[],
  backEdgeSet: Set<number>,
): Map<number, FlowNode[]> {
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
  const order = new Map<number, FlowNode[]>();
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
        // No anchoring neighbors: use current position so relative order is kept.
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

// ─── Phase 4: Simplified Brandes–Köpf Coordinate Assignment ──────────────────

/**
 * Assign cross-axis coordinates (x for TB, y for LR) using a two-pass
 * simplified Brandes–Köpf style approach (Sugiyama Phase 4).
 *
 * Each pass places every layer as a uniform block:
 *   - Each node's "preference" is the MEAN cross-axis position of its
 *     forward-edge neighbors in the adjacent layer (mean gives a centred
 *     result, matching what dagre does with weighted edges).
 *   - Nodes with no neighbors fall back to the same centering formula the
 *     old code used (keeps root/leaf layers stable when no anchor exists).
 *   - The block's start is max(margin, medianOfPrefs − ½·totalSpan) so the
 *     whole layer is centred on its collective preference, clamped to margin.
 *
 * Pass 1 (top-down) aligns each layer with its predecessors.
 * Pass 2 (bottom-up) aligns each layer with its successors.
 * Final positions = average of the two passes.
 *
 * Both passes independently produce non-overlapping layouts (uniform step
 * ≥ crossSize + gap), and the average of two such arrangements with the same
 * step is also non-overlapping — so no extra collision check is needed.
 *
 * Back-edges and self-loops are excluded from preference computation.
 */
function assignCoordinatesBK(
  byLayer: Map<number, FlowNode[]>,
  edges: readonly FlowEdge[],
  backEdgeSet: Set<number>,
  isLR: boolean,
  isReverse: boolean,
  maxNodesInLayer: number,
  nodeW: number,
  nodeH: number,
  colGap: number,
  rowGap: number,
  margin: number,
): Map<string, Rect> {
  // Forward-edge predecessor and successor maps.
  const predMap = new Map<string, string[]>();
  const succMap = new Map<string, string[]>();
  for (const [, nodes] of byLayer) {
    for (const n of nodes) { predMap.set(n.id, []); succMap.set(n.id, []); }
  }
  edges.forEach((e, i) => {
    if (backEdgeSet.has(i) || e.from === e.to) return;
    predMap.get(e.to)?.push(e.from);
    succMap.get(e.from)?.push(e.to);
  });

  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
  const numLayers = layerKeys.length;

  // Cross-axis = x for TB layout, y for LR layout.
  const crossSize = isLR ? nodeH : nodeW;
  const mainSize  = isLR ? nodeW : nodeH;
  const crossGap  = isLR ? rowGap : colGap;
  const mainGap   = isLR ? colGap : rowGap;
  const crossStep = crossSize + crossGap;
  const mainStep  = mainSize  + mainGap;

  /**
   * Run one coordinate pass (top-down or bottom-up).
   * Returns a map of node id → cross-axis left-edge position.
   */
  function onePass(topDown: boolean): Map<string, number> {
    const crossPos = new Map<string, number>();
    const neighborMap = topDown ? predMap : succMap;
    const indices = topDown
      ? Array.from({ length: numLayers }, (_, i) => i)
      : Array.from({ length: numLayers }, (_, i) => numLayers - 1 - i);

    for (const li of indices) {
      const layerIdx = layerKeys[li]!;
      const nodes    = byLayer.get(layerIdx)!;
      const count    = nodes.length;
      if (count === 0) continue;

      // Default (centering) start — same formula as the old algorithm so that
      // layers with no anchoring neighbors fall back to a centred arrangement.
      const centeredStart = margin + ((maxNodesInLayer - count) * crossStep) / 2;

      // Compute preference for each node: mean of neighbor cross-axis positions.
      const pref: number[] = nodes.map((node, i) => {
        const nbrs = neighborMap.get(node.id) ?? [];
        const nbrPos = nbrs
          .map(nid => crossPos.get(nid))
          .filter((p): p is number => p !== undefined);
        if (nbrPos.length === 0) return centeredStart + i * crossStep;
        return nbrPos.reduce((s, p) => s + p, 0) / nbrPos.length;
      });

      // Block centre = median of individual preferences.
      const sortedPrefs = [...pref].sort((a, b) => a - b);
      const medianPref  = sortedPrefs[Math.floor((sortedPrefs.length - 1) / 2)]!;

      // Centre block on medianPref; clamp so nothing goes left/above margin.
      const blockStart = Math.max(margin, medianPref - ((count - 1) * crossStep) / 2);
      for (let i = 0; i < count; i++) {
        crossPos.set(nodes[i]!.id, blockStart + i * crossStep);
      }
    }
    return crossPos;
  }

  const pass1 = onePass(true);   // predecessor-aligned (top-down)
  const pass2 = onePass(false);  // successor-aligned   (bottom-up)

  // Average the two passes and emit Rect entries.
  const nodePos = new Map<string, Rect>();
  for (let li = 0; li < numLayers; li++) {
    const layerIdx = layerKeys[li]!;
    const layerNum = isReverse ? numLayers - 1 - li : li;
    const nodes    = byLayer.get(layerIdx)!;
    const mainPos  = margin + layerNum * mainStep;

    for (const node of nodes) {
      const c1 = pass1.get(node.id) ?? margin;
      const c2 = pass2.get(node.id) ?? margin;
      const crossP = (c1 + c2) / 2;
      nodePos.set(node.id, {
        x:      isLR ? mainPos : crossP,
        y:      isLR ? crossP  : mainPos,
        width:  nodeW,
        height: nodeH,
      });
    }
  }

  return nodePos;
}

// ─── Node Shape Rendering ─────────────────────────────────────────────────────

function renderNodeShape(node: FlowNode, r: Rect, fill: string, stroke: string, sw: number): SceneElement[] {
  const { x, y, width: w, height: h } = r;

  switch (node.shape) {
    case 'diamond': {
      const cx = x + w / 2, cy = y + h / 2;
      return [{ type: 'path', d: `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`, fill, stroke, strokeWidth: sw }];
    }
    case 'circle':
      return [{ type: 'circle', center: { x: x + w / 2, y: y + h / 2 }, radius: Math.min(w, h) / 2, fill, stroke, strokeWidth: sw }];
    case 'rounded-rect':
    case 'stadium':
      return [{ type: 'rect', bounds: r, fill, stroke, strokeWidth: sw, rx: h / 2 }];
    case 'subroutine':
      return [
        { type: 'rect', bounds: r, fill, stroke, strokeWidth: sw },
        { type: 'rect', bounds: { x: x + 6, y, width: w - 12, height: h }, fill: 'none', stroke, strokeWidth: sw * 0.5 },
      ];
    default:
      return [{ type: 'rect', bounds: r, fill, stroke, strokeWidth: sw, rx: 2 }];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pick the best connection point on a node's boundary.
 *
 * Instead of always using the flow-direction side (right for LR),
 * we compare the relative position of the peer node. If the peer is
 * significantly off-axis (more than half the node height/width away),
 * we exit/enter from the perpendicular side closest to the peer.
 */
type AnchorResult = { point: Point; portDir: import('../../contracts/index.js').PortDirection };

function edgeAnchor(r: Rect, dir: FlowDirection, role: 'exit' | 'enter', peer: Rect): AnchorResult {
  const cx = r.x + r.width  / 2;
  const cy = r.y + r.height / 2;
  const pcx = peer.x + peer.width  / 2;
  const pcy = peer.y + peer.height / 2;

  const dx = pcx - cx;
  const dy = pcy - cy;

  const isLR = dir === 'LR' || dir === 'RL';

  if (isLR) {
    // Primary axis is horizontal
    const offAxis = Math.abs(dy);
    const onAxis  = Math.abs(dx);

    // If the peer is more off-axis than on-axis, use top/bottom port
    if (offAxis > onAxis && offAxis > r.height / 2) {
      return dy > 0
        ? { point: { x: cx, y: r.y + r.height }, portDir: 'S' }
        : { point: { x: cx, y: r.y },             portDir: 'N' };
    }

    // Otherwise use the flow-direction side
    return role === 'exit'
      ? { point: { x: r.x + r.width, y: cy }, portDir: 'E' }
      : { point: { x: r.x,           y: cy }, portDir: 'W' };
  } else {
    // Primary axis is vertical
    const offAxis = Math.abs(dx);
    const onAxis  = Math.abs(dy);

    if (offAxis > onAxis && offAxis > r.width / 2) {
      return dx > 0
        ? { point: { x: r.x + r.width, y: cy }, portDir: 'E' }
        : { point: { x: r.x,           y: cy }, portDir: 'W' };
    }

    return role === 'exit'
      ? { point: { x: cx, y: r.y + r.height }, portDir: 'S' }
      : { point: { x: cx, y: r.y },             portDir: 'N' };
  }
}

/** Feedback / self-loop route result: a path plus its extent and label anchor. */
interface EdgeRoute {
  path: string;
  labelPos: Point;
  maxX: number;
  maxY: number;
}

/**
 * Back-edge ("feedback") route. A back-edge runs against the layer flow (a lower
 * layer back up to an ancestor); drawn like a forward edge it slices straight
 * through the intervening node column. Instead we bow it out to one lateral side
 * with a cubic Bézier: endpoints sit on the side wall (East for vertical flow,
 * South for horizontal flow) and the control points push further out, so the arc
 * stays clear of the centered node column. The arrowhead still lands on the
 * target wall (the tangent at the end points back into the node).
 *
 * This is intentionally a simple offset arc, not an obstacle-avoiding router:
 * the bar is "reads as feedback and doesn't cut through a node".
 */
function backEdgeRoute(from: Rect, to: Rect, isLR: boolean): EdgeRoute {
  if (isLR) {
    // Horizontal flow → bow downward, off the South walls.
    const start: Point = { x: from.x + from.width / 2, y: from.y + from.height };
    const end:   Point = { x: to.x   + to.width   / 2, y: to.y   + to.height };
    const span = Math.abs(end.x - start.x);
    const bow = Math.max(NODE_H * 0.9, span * 0.35);
    const c1: Point = { x: start.x, y: start.y + bow };
    const c2: Point = { x: end.x,   y: end.y   + bow };
    return {
      path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
      labelPos: { x: (start.x + end.x) / 2, y: Math.max(start.y, end.y) + bow * 0.75 },
      maxX: Math.max(start.x, end.x),
      maxY: Math.max(c1.y, c2.y),
    };
  }
  // Vertical flow → bow to the right, off the East walls.
  const start: Point = { x: from.x + from.width, y: from.y + from.height / 2 };
  const end:   Point = { x: to.x   + to.width,   y: to.y   + to.height   / 2 };
  const span = Math.abs(end.y - start.y);
  const bow = Math.max(NODE_W * 0.75, span * 0.35);
  const c1: Point = { x: start.x + bow, y: start.y };
  const c2: Point = { x: end.x   + bow, y: end.y };
  return {
    path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    labelPos: { x: Math.max(start.x, end.x) + bow * 0.75, y: (start.y + end.y) / 2 },
    maxX: Math.max(c1.x, c2.x),
    maxY: Math.max(start.y, end.y),
  };
}

/**
 * Self-loop (A → A) route. A small cubic loop hung off one side of the node
 * (East for vertical flow, South for horizontal flow) so it never degenerates
 * into a zero-length line drawn through the node. The arrowhead re-enters the
 * same wall a little below/right of where it left.
 */
function selfLoopRoute(r: Rect, isLR: boolean): EdgeRoute {
  const loop = 28;
  if (isLR) {
    // Loop hangs below the node (South wall).
    const x1 = r.x + r.width * 0.35;
    const x2 = r.x + r.width * 0.65;
    const sy = r.y + r.height;
    return {
      path: `M ${x1} ${sy} C ${x1 - loop} ${sy + loop}, ${x2 + loop} ${sy + loop}, ${x2} ${sy}`,
      labelPos: { x: r.x + r.width / 2, y: sy + loop + 4 },
      maxX: x2 + loop,
      maxY: sy + loop,
    };
  }
  // Loop sits to the right of the node (East wall).
  const y1 = r.y + r.height * 0.3;
  const y2 = r.y + r.height * 0.7;
  const ex = r.x + r.width;
  return {
    path: `M ${ex} ${y1} C ${ex + loop} ${y1 - loop}, ${ex + loop} ${y2 + loop}, ${ex} ${y2}`,
    labelPos: { x: ex + loop, y: r.y + r.height / 2 },
    maxX: ex + loop,
    maxY: y2 + loop,
  };
}

function nodeStatusFill(node: FlowNode, palette: ResolvedTheme['palette']): string {
  switch (node.status) {
    case 'active':  return palette.primary + '22';
    case 'success': return palette.success + '22';
    case 'warning': return palette.warning + '22';
    case 'error':   return palette.error   + '22';
    case 'muted':   return palette.surface;
    default:        return palette.surface;
  }
}

function arrowMarkerDef(color: string, size: number): string {
  const s = size;
  return `<marker id="${ARROW_MARKER_ID}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="${s - 1}" refY="${s * 0.35}" orient="auto"><polygon points="0 0, ${s} ${s * 0.35}, 0 ${s * 0.7}" fill="${color}" /></marker>`;
}

/**
 * Fractional position of a point along a node wall.
 * N/S walls: fraction of width (0=left, 1=right).
 * E/W walls: fraction of height (0=top, 1=bottom).
 */
function wallT(bounds: Rect, wall: CardinalSide, pt: Point): number {
  switch (wall) {
    case 'N': case 'S':
      return bounds.width  > 0 ? Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))  : 0.5;
    case 'E': case 'W':
      return bounds.height > 0 ? Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height)) : 0.5;
  }
}
