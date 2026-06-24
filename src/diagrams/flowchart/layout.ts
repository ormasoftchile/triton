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
  const numLayers = byLayer.size;

  // ── Coordinate assignment ──────────────────────────────────────────────────
  const colGap = spacing.nodeGap;
  const rowGap = spacing.nodeGap;

  // Compute how wide/tall the layout is to center nodes within layers
  let maxNodesInLayer = 0;
  for (const [, nodes] of byLayer) maxNodesInLayer = Math.max(maxNodesInLayer, nodes.length);

  const nodePos = new Map<string, Rect>();

  for (const [layerIdx, layerNodes] of byLayer) {
    const layer = isReverse ? numLayers - 1 - layerIdx : layerIdx;
    const count = layerNodes.length;

    for (let i = 0; i < count; i++) {
      const node = layerNodes[i]!;
      let x: number;
      let y: number;

      if (isLR) {
        x = margin + layer * (NODE_W + colGap);
        y = margin + i * (NODE_H + rowGap) + ((maxNodesInLayer - count) * (NODE_H + rowGap)) / 2;
      } else {
        x = margin + i * (NODE_W + colGap) + ((maxNodesInLayer - count) * (NODE_W + colGap)) / 2;
        y = margin + layer * (NODE_H + rowGap);
      }

      nodePos.set(node.id, { x, y, width: NODE_W, height: NODE_H });
    }
  }

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
  const backEdges = findBackEdges(ir.nodes, ir.edges);
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
