/**
 * @file graph/layered.ts — Minimal layered (Sugiyama-lite) graph placement.
 *
 * Longest-path layering + size-aware coordinate assignment. Shared by the
 * node-link / UML diagram layouts (class, state, er; later c4/block/requirement)
 * so they don't each reinvent rank assignment. Edge routing is left to callers
 * (they connect the returned boxes via the routing module).
 *
 * Deterministic: stable insertion order within a layer, no clock, no randomness.
 */

export interface GraphNode {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
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
}

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

export function layeredLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  options: LayeredOptions = {},
): LayeredResult {
  const direction = options.direction ?? 'TB';
  const layerGap  = options.layerGap ?? 70;
  const nodeGap   = options.nodeGap ?? 40;
  const margin    = options.margin ?? 32;
  const horizontal = direction === 'LR';

  if (nodes.length === 0) return { boxes: new Map(), width: margin * 2, height: margin * 2 };

  const layer = assignLayers(nodes, edges);
  const maxLayer = Math.max(...nodes.map(n => layer.get(n.id)!));

  // Group nodes by layer, preserving insertion order.
  const byLayer: GraphNode[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of nodes) byLayer[layer.get(n.id)!]!.push(n);

  // Cross-axis extent of each node (the dimension laid out within a layer).
  const cross = (n: GraphNode): number => (horizontal ? n.height : n.width);
  const along = (n: GraphNode): number => (horizontal ? n.width : n.height);

  // Layer extent along the flow axis = max along() in that layer.
  const layerExtent = byLayer.map(layerNodes => Math.max(0, ...layerNodes.map(along)));
  // Cross size of each layer row/column.
  const layerCross = byLayer.map(layerNodes =>
    layerNodes.reduce((sum, n, i) => sum + cross(n) + (i > 0 ? nodeGap : 0), 0));
  const maxCross = Math.max(...layerCross);

  const boxes = new Map<string, NodeBox>();
  let alongCursor = margin;
  byLayer.forEach((layerNodes, li) => {
    const rowExtent = layerExtent[li]!;
    let crossCursor = margin + (maxCross - layerCross[li]!) / 2; // center the layer
    for (const n of layerNodes) {
      const alongPos = alongCursor + (rowExtent - along(n)) / 2; // center within layer band
      const x = horizontal ? alongPos : crossCursor;
      const y = horizontal ? crossCursor : alongPos;
      boxes.set(n.id, { id: n.id, x, y, width: n.width, height: n.height });
      crossCursor += cross(n) + nodeGap;
    }
    alongCursor += rowExtent + layerGap;
  });

  const alongTotal = alongCursor - layerGap + margin;
  const crossTotal = margin + maxCross + margin;
  return {
    boxes,
    width:  horizontal ? alongTotal : crossTotal,
    height: horizontal ? crossTotal : alongTotal,
  };
}
