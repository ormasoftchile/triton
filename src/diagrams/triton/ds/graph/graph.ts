/**
 * @file diagrams/ds/graph/graph.ts — Generic node/edge graph.
 *
 * A clean, themeable node-link graph (directed or undirected) built on the
 * shared layered placement kernel (graph/layered). Nodes are rounded boxes,
 * edges are straight connectors clipped to node borders; in directed mode each
 * edge carries an arrowhead, in undirected mode it does not.
 *
 * ⚠️ Header keyword is `nodegraph` (alias `dsgraph`) — NOT `graph`, because
 * Mermaid's flowchart already owns `graph` (`graph TD`). Using a distinct token
 * keeps flowchart detection intact.
 *
 * Value-driven mini-syntax:
 *   nodegraph
 *     directed                 // or `undirected` (the default)
 *     title Dependency graph
 *     node A : Parser          // optional explicit label
 *     A -> B : calls           // edge with optional `: label`
 *     B -- C                   // edges may use -> or --
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry, Rect, BaseIR,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { layeredLayout, type GraphNode, type GraphEdge } from '../../../../graph/layered.js';
import { connectSlots } from '../../../../graph/connect.js';
import { rhu } from '../../../../util/round.js';
import { ARROW_ID, arrowDef } from '../struct/shared.js';

export interface GNode { id: string; label: string; }
export interface GEdge { from: string; to: string; label?: string; kind?: 'active' | 'dashed'; }

export interface GraphDoc extends BaseIR {
  title?: string;
  directed: boolean;
  nodes: GNode[];
  edges: GEdge[];
}

const EDGE_RE = /^(\S+)\s*(<->|->|--)\s*(\S+)(?:\s*:\s*(.+))?$/;

function parse(input: string): Omit<GraphDoc, keyof BaseIR> {
  let title: string | undefined;
  let directed = false;
  const order: string[] = [];
  const labels = new Map<string, string>();
  const edges: GEdge[] = [];
  const ensure = (id: string): void => { if (!labels.has(id)) { labels.set(id, id); order.push(id); } };

  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const t = line.split(/\s+/);
    if (t[0] === 'nodegraph' || t[0] === 'dsgraph') continue;
    if (t[0] === 'directed') { directed = true; continue; }
    if (t[0] === 'undirected') { directed = false; continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'node') {
      const parts = line.slice(4).split(':').map(s => s.trim());
      const id = parts[0] ?? '';
      if (id) { ensure(id); labels.set(id, parts[1] || id); }
      continue;
    }
    const m = line.match(EDGE_RE);
    if (m) {
      const from = m[1]!, to = m[3]!;
      const rawLabel = m[4]?.trim();
      let label: string | undefined;
      let kind: GEdge['kind'] | undefined;
      if (rawLabel === 'active') kind = 'active';
      else if (rawLabel === 'dashed') kind = 'dashed';
      else label = rawLabel;
      ensure(from); ensure(to);
      edges.push({ from, to, ...(label ? { label } : {}), ...(kind ? { kind } : {}) });
    }
  }

  const nodes: GNode[] = order.map(id => ({ id, label: labels.get(id)! }));
  return { ...(title !== undefined ? { title } : {}), directed, nodes, edges };
}

export function layoutGraph(doc: GraphDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const small = typography.smallFontSize;
  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const nodeH = 40;

  const sizeOf = (n: GNode): number => Math.max(64, measureText(n.label, font).width + 28);
  const gNodes: GraphNode[] = doc.nodes.map(n => ({ id: n.id, width: sizeOf(n), height: nodeH }));
  const gEdges: GraphEdge[] = doc.edges.map(e => ({ from: e.from, to: e.to }));
  const placed = layeredLayout(gNodes, gEdges, { direction: 'TB', layerGap: 64, nodeGap: 44, margin });

  const box = (id: string): Rect => {
    const b = placed.boxes.get(id)!;
    return { x: b.x, y: b.y + titleH, width: b.width, height: b.height };
  };

  const elements: SceneElement[] = [];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // Edges first (under the nodes).
  for (const e of doc.edges) {
    const a = placed.boxes.has(e.from) ? box(e.from) : undefined;
    const b = placed.boxes.has(e.to) ? box(e.to) : undefined;
    if (!a || !b) continue;
    const { start, end } = connectSlots(a, b);
    const isActive = e.kind === 'active';
    const edgeColor = isActive ? palette.primary : palette.textMuted;
    const edgeWidth = isActive ? 2.5 : 1.5;
    const pathOpts: Parameters<typeof p.path>[3] = {
      ...(doc.directed ? { markerEnd: ARROW_ID } : {}),
      ...(e.kind === 'dashed' ? { dash: '6 3' } : {}),
    };
    elements.push(p.path(`M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`, edgeColor, edgeWidth, pathOpts));
    if (e.label) {
      const mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2;
      const w = measureText(e.label, small).width + 8;
      elements.push(p.rect({ x: mx - w / 2, y: my - 9, width: w, height: 16 }, palette.background, palette.background, 0, { rx: 3 }));
      elements.push(p.text(e.label, mx, my + 3, small, isActive ? palette.primary : palette.textMuted, { anchor: 'middle', weight: 'bold' }));
    }
  }

  // Nodes.
  const anchors: Record<string, { bounds: Rect }> = {};
  for (const n of doc.nodes) {
    const b = box(n.id);
    elements.push(p.rect(b, palette.surface, palette.primary, 2, { rx: 8 }));
    elements.push(p.text(n.label, b.x + b.width / 2, b.y + b.height / 2 + font * 0.35, font, palette.text, { anchor: 'middle', weight: 'bold' }));
    anchors[n.id] = { bounds: b };
  }

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: placed.width + margin, height: placed.height + titleH + margin },
    background: palette.background,
    elements,
    ...(doc.directed ? { defs: [arrowDef(palette.textMuted)] } : {}),
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const graph: DiagramModule<GraphDoc> = {
  parseMermaid(input: string): GraphDoc {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string): GraphDoc {
    return JSON.parse(input) as GraphDoc;
  },
  layout(ir: GraphDoc, theme: ResolvedTheme): LayoutResult {
    return layoutGraph(ir, theme);
  },
};
