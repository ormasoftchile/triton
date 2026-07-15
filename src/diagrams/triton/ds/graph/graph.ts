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
import { borderPoint } from '../../../../graph/connect.js';
import { orthogonalRouter } from '../../../../routing/router.js';
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
  type Pt = { x: number; y: number };
  type PortDir = 'N' | 'S' | 'E' | 'W';
  const pathData = (points: readonly Pt[]): string =>
    points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${rhu(pt.x)} ${rhu(pt.y)}`).join(' ');
  const pathMidpoint = (points: readonly Pt[]): Pt => {
    if (points.length === 0) return { x: 0, y: 0 };
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    }
    if (total === 0) return points[0]!;
    let walked = 0;
    const target = total / 2;
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]!;
      const to = points[i]!;
      const segment = Math.hypot(to.x - from.x, to.y - from.y);
      if (walked + segment >= target && segment > 0) {
        const t = (target - walked) / segment;
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      }
      walked += segment;
    }
    return points[points.length - 1]!;
  };
  type Wall = 'top' | 'bottom' | 'left' | 'right';
  const dirForWall = (wall: Wall): PortDir => {
    switch (wall) {
      case 'top': return 'N';
      case 'bottom': return 'S';
      case 'left': return 'W';
      case 'right': return 'E';
    }
  };
  const targetWall = (from: Rect, to: Rect): Wall => {
    if (from.y + from.height <= to.y) return 'top';
    if (to.y + to.height <= from.y) return 'bottom';
    const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
    const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
    if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'top' : 'bottom';
    return dx >= 0 ? 'left' : 'right';
  };
  const sourceWall = (from: Rect, to: Rect): Wall => targetWall(to, from);
  const wallPoint = (r: Rect, wall: Wall, axis: number): Pt => {
    switch (wall) {
      case 'top': return { x: axis, y: r.y };
      case 'bottom': return { x: axis, y: r.y + r.height };
      case 'left': return { x: r.x, y: axis };
      case 'right': return { x: r.x + r.width, y: axis };
    }
  };

  const MIN_PORT_GAP = 28;
  const WALL_MARGIN = 16;
  const SKIP_LANE_CLEARANCE = 40;
  const SKIP_LANE_GAP = 28;
  const SKIP_STUB = 16;

  const cascadePorts = (ideals: number[], lo: number, hi: number): number[] => {
    const n = ideals.length;
    if (n === 0) return [];
    if (hi <= lo) return Array.from({ length: n }, () => (lo + hi) / 2);
    if (n === 1) return [Math.max(lo, Math.min(hi, ideals[0]!))];
    if ((n - 1) * MIN_PORT_GAP > hi - lo) {
      const step = (hi - lo) / (n + 1);
      return Array.from({ length: n }, (_, i) => lo + step * (i + 1));
    }
    const pos = ideals.map(v => Math.max(lo, Math.min(hi, v)));
    for (let iter = 0; iter < 5; iter++) {
      let changed = false;
      for (let i = 1; i < n; i++) {
        const minI = pos[i - 1]! + MIN_PORT_GAP;
        if (pos[i]! < minI) { pos[i] = minI; changed = true; }
      }
      for (let i = n - 1; i >= 0; i--) {
        const maxI = i === n - 1 ? hi : pos[i + 1]! - MIN_PORT_GAP;
        if (pos[i]! > maxI) { pos[i] = maxI; changed = true; }
      }
      if (pos[0]! < lo) { pos[0] = lo; changed = true; }
      if (!changed) break;
    }
    return pos;
  };

  const assignPorts = (
    rect: Rect,
    wall: Wall,
    group: Array<{ edgeIndex: number; ideal: number }>,
  ): Map<number, Pt> => {
    const result = new Map<number, Pt>();
    if (group.length === 0) return result;
    const sorted = [...group].sort((a, b) => a.ideal - b.ideal || a.edgeIndex - b.edgeIndex);
    const horizontal = wall === 'top' || wall === 'bottom';
    const base = horizontal ? rect.x : rect.y;
    const len = horizontal ? rect.width : rect.height;
    const lo = base + Math.min(WALL_MARGIN, len / 3);
    const hi = base + len - Math.min(WALL_MARGIN, len / 3);
    const positions = cascadePorts(sorted.map(e => e.ideal), lo, hi);
    for (let i = 0; i < sorted.length; i++) {
      result.set(sorted[i]!.edgeIndex, wallPoint(rect, wall, positions[i]!));
    }
    return result;
  };

  const simplifyPoints = (raw: readonly Pt[]): Pt[] => {
    const points: Pt[] = [];
    for (const pt of raw) {
      const prev = points[points.length - 1];
      if (!prev || Math.abs(prev.x - pt.x) > 1e-6 || Math.abs(prev.y - pt.y) > 1e-6) {
        points.push(pt);
      }
    }
    for (let i = 1; i < points.length - 1;) {
      const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
      const collinearX = Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - c.x) < 1e-6;
      const collinearY = Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - c.y) < 1e-6;
      if (collinearX || collinearY) points.splice(i, 1);
      else i++;
    }
    return points;
  };

  const realBoxes = [...placed.boxes.values()];
  const skipLaneX = new Map<number, number>();
  let skipLaneOrdinal = 0;
  for (const [i, e] of doc.edges.entries()) {
    const bends = placed.edgeBends.get(i);
    if (!bends || bends.length === 0) continue;
    const a = placed.boxes.get(e.from);
    const b = placed.boxes.get(e.to);
    if (!a || !b) continue;
    const minCy = Math.min(a.y + a.height / 2, b.y + b.height / 2);
    const maxCy = Math.max(a.y + a.height / 2, b.y + b.height / 2);
    const spanBoxes = realBoxes.filter(ob => {
      const cy = ob.y + ob.height / 2;
      return cy >= minCy && cy <= maxCy;
    });
    const right = Math.max(...spanBoxes.map(ob => ob.x + ob.width));
    skipLaneX.set(i, right + SKIP_LANE_CLEARANCE + skipLaneOrdinal * SKIP_LANE_GAP);
    skipLaneOrdinal++;
  }

  const fromGroups = new Map<string, Array<{ edgeIndex: number; ideal: number }>>();
  const toGroups = new Map<string, Array<{ edgeIndex: number; ideal: number }>>();
  const fromWallByEdge = new Map<number, Wall>();
  const toWallByEdge = new Map<number, Wall>();
  const groupKey = (id: string, wall: Wall): string => `${id}\0${wall}`;
  const axisIdeal = (wall: Wall, other: Rect, edgeIndex: number): number => {
    const lane = skipLaneX.get(edgeIndex);
    if (lane !== undefined && (wall === 'top' || wall === 'bottom')) return lane;
    return (wall === 'top' || wall === 'bottom')
      ? other.x + other.width / 2
      : other.y + other.height / 2;
  };
  for (const [i, e] of doc.edges.entries()) {
    const a = placed.boxes.has(e.from) ? box(e.from) : undefined;
    const b = placed.boxes.has(e.to) ? box(e.to) : undefined;
    if (!a || !b) continue;
    const fw = sourceWall(a, b);
    const tw = targetWall(a, b);
    fromWallByEdge.set(i, fw);
    toWallByEdge.set(i, tw);
    const fk = groupKey(e.from, fw);
    const tk = groupKey(e.to, tw);
    if (!fromGroups.has(fk)) fromGroups.set(fk, []);
    if (!toGroups.has(tk)) toGroups.set(tk, []);
    fromGroups.get(fk)!.push({ edgeIndex: i, ideal: axisIdeal(fw, b, i) });
    toGroups.get(tk)!.push({ edgeIndex: i, ideal: axisIdeal(tw, a, i) });
  }

  const fromPorts = new Map<string, Map<number, Pt>>();
  const toPorts = new Map<string, Map<number, Pt>>();
  for (const [key, group] of fromGroups) {
    const [id, wall] = key.split('\0') as [string, Wall];
    fromPorts.set(key, assignPorts(box(id), wall, group));
  }
  for (const [key, group] of toGroups) {
    const [id, wall] = key.split('\0') as [string, Wall];
    toPorts.set(key, assignPorts(box(id), wall, group));
  }

  const elements: SceneElement[] = [];
  const labelElements: SceneElement[] = [];
  let maxRouteX = placed.width - margin;
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // Edges first (under the nodes).
  for (const [i, e] of doc.edges.entries()) {
    const a = placed.boxes.has(e.from) ? box(e.from) : undefined;
    const b = placed.boxes.has(e.to) ? box(e.to) : undefined;
    if (!a || !b) continue;
    const bends = placed.edgeBends.get(i);
    const fw = fromWallByEdge.get(i) ?? sourceWall(a, b);
    const tw = toWallByEdge.get(i) ?? targetWall(a, b);
    const fromPt = fromPorts.get(groupKey(e.from, fw))?.get(i) ?? borderPoint(a, b.x + b.width / 2, b.y + b.height / 2);
    const toPt = toPorts.get(groupKey(e.to, tw))?.get(i) ?? borderPoint(b, a.x + a.width / 2, a.y + a.height / 2);
    const points: readonly Pt[] = bends && bends.length > 0 && skipLaneX.has(i) && (fw === 'top' || fw === 'bottom') && (tw === 'top' || tw === 'bottom')
      ? (() => {
          const sign = toPt.y >= fromPt.y ? 1 : -1;
          const span = Math.abs(toPt.y - fromPt.y);
          const stub = Math.min(SKIP_STUB, Math.max(8, (span - 24) / 2));
          const sourceStubY = fromPt.y + sign * stub;
          const targetStubY = toPt.y - sign * stub;
          const laneX = skipLaneX.get(i)!;
          return simplifyPoints([
            fromPt,
            { x: fromPt.x, y: sourceStubY },
            { x: laneX, y: sourceStubY },
            { x: laneX, y: targetStubY },
            { x: toPt.x, y: targetStubY },
            toPt,
          ]);
        })()
      : bends && bends.length > 0
      ? (() => {
          const obstacles = [...placed.boxes.values()]
            .filter(ob => ob.id !== e.from && ob.id !== e.to)
            .map(ob => ({ x: ob.x, y: ob.y + titleH, width: ob.width, height: ob.height }));
          return orthogonalRouter.route({
            from: fromPt,
            to: toPt,
            style: 'orthogonal',
            obstacles,
            padding: 10,
            fromDir: dirForWall(fw),
            toDir: dirForWall(tw),
          }).points;
        })()
      : (() => {
          const obstacles = [...placed.boxes.values()]
            .filter(ob => ob.id !== e.from && ob.id !== e.to)
            .map(ob => ({ x: ob.x, y: ob.y + titleH, width: ob.width, height: ob.height }));
          return orthogonalRouter.route({
            from: fromPt,
            to: toPt,
            style: 'orthogonal',
            obstacles,
            padding: 10,
            fromDir: dirForWall(fw),
            toDir: dirForWall(tw),
          }).points;
        })();
    maxRouteX = Math.max(maxRouteX, ...points.map(pt => pt.x));
    const isActive = e.kind === 'active';
    const edgeColor = isActive ? palette.primary : palette.textMuted;
    const edgeWidth = isActive ? 2.5 : 1.5;
    const pathOpts: Parameters<typeof p.path>[3] = {
      ...(doc.directed ? { markerEnd: ARROW_ID } : {}),
      ...(e.kind === 'dashed' ? { dash: '6 3' } : {}),
    };
    elements.push(p.path(pathData(points), edgeColor, edgeWidth, pathOpts));
    if (e.label) {
      const { x: mx, y: my } = pathMidpoint(points);
      const w = measureText(e.label, small).width + 8;
      maxRouteX = Math.max(maxRouteX, mx + w / 2);
      labelElements.push(p.rect({ x: mx - w / 2, y: my - 9, width: w, height: 16 }, palette.background, palette.background, 0, { rx: 3 }));
      labelElements.push(p.text(e.label, mx, my + 3, small, isActive ? palette.primary : palette.textMuted, { anchor: 'middle', weight: 'bold' }));
    }
  }
  elements.push(...labelElements);

  // Nodes.
  const anchors: Record<string, { bounds: Rect }> = {};
  for (const n of doc.nodes) {
    const b = box(n.id);
    elements.push(p.rect(b, palette.surface, palette.primary, 2, { rx: 8 }));
    elements.push(p.text(n.label, b.x + b.width / 2, b.y + b.height / 2 + font * 0.35, font, palette.text, { anchor: 'middle', weight: 'bold' }));
    anchors[n.id] = { bounds: b };
  }

  const titleWidth = doc.title ? measureText(doc.title, typography.titleFontSize).width : 0;
  const viewWidth = Math.max(
    placed.width + margin,
    maxRouteX + margin,
    doc.title ? margin + titleWidth + margin : 0,
  );
  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: viewWidth, height: placed.height + titleH + margin },
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
