import type { FlowDocument, FlowNode, FlowEdge, FlowDirection } from './ir.js';
import type { Scene, SceneElement, Rect, Point } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { defaultRouter } from '../../routing/router.js';
import { compileOverlays } from '../../overlay/compiler.js';
import { layoutOverlays } from '../../overlay/layout.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 120;
const NODE_H = 40;
const ARROW_MARKER_ID = 'triton-arrow';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export function layoutFlowchart(ir: FlowDocument, theme: ResolvedTheme): Scene {
  const { spacing, palette, typography, edges: edgeTheme } = theme;
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
    elements.push({
      type: 'text',
      content: ir.metadata.title,
      position: { x: margin, y: margin - 8 },
      fontSize: typography.titleFontSize,
      fontFamily: typography.fontFamily,
      fontWeight: 'bold',
      fill: palette.text,
    });
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
    elements.push({ type: 'rect', bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, fill: palette.surface, stroke: palette.border, strokeWidth: 1, rx: 6, opacity: 0.6 });
    elements.push({ type: 'text', content: sg.label, position: { x: minX + 8, y: minY + 14 }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted });
  }

  // Edges (drawn before nodes so nodes appear on top)
  for (const edge of ir.edges) {
    const fromRect = nodePos.get(edge.from);
    const toRect   = nodePos.get(edge.to);
    if (!fromRect || !toRect) continue;

    const from = edgeAnchor(fromRect, ir.direction, 'exit');
    const to   = edgeAnchor(toRect,   ir.direction, 'enter');

    const route = defaultRouter.route({
      from, to,
      style: 'orthogonal',
      obstacles: [],
      padding: 8,
    });

    const dash = edge.style === 'dotted' ? '6 3' : edge.style === 'dashed' ? '8 4' : undefined;

    elements.push({
      type: 'path',
      d: route.path,
      stroke: edge.kind === 'async' ? palette.textMuted : palette.primary,
      strokeWidth: edgeTheme.strokeWidth,
      ...(dash !== undefined ? { strokeDasharray: dash } : {}),
      markerEnd: ARROW_MARKER_ID,
    });

    if (edge.label) {
      const lp = route.labelPosition;
      elements.push({
        type: 'text',
        content: edge.label,
        position: { x: lp.x, y: lp.y - 4 },
        fontSize: edgeTheme.labelFontSize,
        fontFamily: typography.fontFamily,
        fill: palette.textMuted,
        anchor: 'middle',
      });
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
    nodeElements.push({
      type: 'text',
      content: node.label,
      position: { x: r.x + NODE_W / 2, y: r.y + NODE_H / 2 + typography.baseFontSize * 0.35 },
      fontSize: typography.baseFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.text,
      anchor: 'middle',
    });

    elements.push({ type: 'group', id: node.id, children: nodeElements });
  }

  // ── Compute viewBox ────────────────────────────────────────────────────────
  const allRects = [...nodePos.values()];
  const right  = Math.max(...allRects.map(r => r.x + r.width))  + margin;
  const bottom = Math.max(...allRects.map(r => r.y + r.height)) + margin;
  const titleOffset = ir.metadata.title ? typography.titleFontSize + 12 : 0;

  let scene: Scene = {
    viewBox: { x: 0, y: 0, width: right, height: bottom + titleOffset },
    background: palette.background,
    elements,
    defs: [arrowMarkerDef(palette.primary, edgeTheme.arrowSize)],
  };

  // ── Overlays ───────────────────────────────────────────────────────────────
  if (ir.overlays && ir.overlays.length > 0) {
    const compiled = compileOverlays(ir.overlays);
    const { elements: overlayEls, viewBox } = layoutOverlays(compiled, scene, theme);
    scene = { ...scene, elements: [...scene.elements, ...overlayEls], viewBox };
  }

  return scene;
}

// ─── Layer Assignment ─────────────────────────────────────────────────────────

function assignLayers(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): Map<string, number> {
  const predecessors = new Map<string, Set<string>>();
  for (const n of nodes) predecessors.set(n.id, new Set());
  for (const e of edges) predecessors.get(e.to)?.add(e.from);

  const layers = new Map<string, number>();
  const queue: Array<{ id: string; layer: number }> = [];

  // Roots: nodes with no predecessors
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
    for (const e of edges) {
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

function edgeAnchor(r: Rect, dir: FlowDirection, role: 'exit' | 'enter'): Point {
  const isLR = dir === 'LR' || dir === 'RL';
  const cx = r.x + r.width  / 2;
  const cy = r.y + r.height / 2;

  if (isLR) {
    return role === 'exit'
      ? { x: r.x + r.width, y: cy }
      : { x: r.x,           y: cy };
  } else {
    return role === 'exit'
      ? { x: cx, y: r.y + r.height }
      : { x: cx, y: r.y };
  }
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
