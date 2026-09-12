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
  DiagramModule,
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
  Rect,
  BaseIR,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { layeredLayout, type GraphNode, type GraphEdge } from '../../../../graph/layered.js';
import { borderPoint, connectSlots } from '../../../../graph/connect.js';
import { orthogonalRouter, countRouteCollisions } from '../../../../routing/router.js';
import { rhu } from '../../../../util/round.js';

const ARROW_ID = 'dsgraph-arrow';
const ARROW_ACTIVE_ID = 'dsgraph-arrow-active';

import { readableText } from '../../../../theme/contrast.js';

function graphArrowDef(color: string, id: string, size = 8): string {
  const s = size;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);
  return `<marker id="${id}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${color}" /></marker>`;
}

export interface GNode {
  id: string;
  label: string;
  kind?: 'active' | undefined;
}
export interface GEdge {
  from: string;
  to: string;
  label?: string;
  kind?: 'active' | 'dashed';
}

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
  const nodeKinds = new Map<string, GNode['kind']>();
  const edges: GEdge[] = [];
  const ensure = (id: string): void => {
    if (!labels.has(id)) {
      labels.set(id, id);
      order.push(id);
    }
  };

  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const t = line.split(/\s+/);
    if (t[0] === 'nodegraph' || t[0] === 'dsgraph') continue;
    if (t[0] === 'directed') {
      directed = true;
      continue;
    }
    if (t[0] === 'undirected') {
      directed = false;
      continue;
    }
    if (t[0] === 'title') {
      title = line.slice(5).trim();
      continue;
    }
    if (t[0] === 'node') {
      const parts = line
        .slice(4)
        .split(':')
        .map((s) => s.trim());
      const id = parts[0] ?? '';
      if (id) {
        ensure(id);
        if (parts.length === 2) {
          labels.set(id, parts[1] || id);
        } else if (parts.length >= 3) {
          labels.set(id, parts[1] || id);
          if (parts[2] === 'active') {
            nodeKinds.set(id, 'active');
          }
        }
      }
      continue;
    }
    const m = line.match(EDGE_RE);
    if (m) {
      const from = m[1]!,
        to = m[3]!;
      const rawLabel = m[4]?.trim();
      let label: string | undefined;
      let kind: GEdge['kind'] | undefined;
      if (rawLabel === 'active') kind = 'active';
      else if (rawLabel === 'dashed') kind = 'dashed';
      else label = rawLabel;
      ensure(from);
      ensure(to);
      edges.push({ from, to, ...(label ? { label } : {}), ...(kind ? { kind } : {}) });
    }
  }

  const nodes: GNode[] = order.map((id) => ({
    id,
    label: labels.get(id)!,
    ...(nodeKinds.has(id) ? { kind: nodeKinds.get(id) } : {}),
  }));
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
  const gNodes: GraphNode[] = doc.nodes.map((n) => ({ id: n.id, width: sizeOf(n), height: nodeH }));
  const gEdges: GraphEdge[] = doc.edges.map((e) => ({ from: e.from, to: e.to }));
  const hasOpposingEdges = doc.edges.some((e, i) =>
    doc.edges.some((other, j) => i !== j && e.from === other.to && e.to === other.from),
  );
  const layerGap = hasOpposingEdges ? 88 : doc.edges.some((e) => e.label) ? 72 : 64;
  const placed = layeredLayout(gNodes, gEdges, {
    direction: 'TB',
    layerGap,
    nodeGap: 44,
    margin,
  });

  const box = (id: string): Rect => {
    const b = placed.boxes.get(id)!;
    return { x: b.x, y: b.y + titleH, width: b.width, height: b.height };
  };
  type Pt = { x: number; y: number };
  type PortDir = 'N' | 'S' | 'E' | 'W';
  const pathData = (points: readonly Pt[]): string =>
    points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${rhu(pt.x)} ${rhu(pt.y)}`).join(' ');
  const pathPointAtFraction = (points: readonly Pt[], frac = 0.5): { pt: Pt; normal: Pt } => {
    if (points.length === 0) return { pt: { x: 0, y: 0 }, normal: { x: 0, y: 0 } };
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    }
    if (total === 0) return { pt: points[0]!, normal: { x: 0, y: 0 } };
    let walked = 0;
    const target = total * frac;
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]!;
      const to = points[i]!;
      const segment = Math.hypot(to.x - from.x, to.y - from.y);
      if (walked + segment >= target && segment > 0) {
        const t = (target - walked) / segment;
        const dx = (to.x - from.x) / segment;
        const dy = (to.y - from.y) / segment;
        return {
          pt: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
          normal: { x: dy, y: -dx }, // right-hand normal
        };
      }
      walked += segment;
    }
    const last = points[points.length - 1]!;
    return { pt: last, normal: { x: 0, y: 0 } };
  };
  type Wall = 'top' | 'bottom' | 'left' | 'right';
  const dirForWall = (wall: Wall): PortDir => {
    switch (wall) {
      case 'top':
        return 'N';
      case 'bottom':
        return 'S';
      case 'left':
        return 'W';
      case 'right':
        return 'E';
    }
  };
  const targetWall = (from: Rect, to: Rect): Wall => {
    if (from.y + from.height <= to.y) return 'top';
    if (to.y + to.height <= from.y) return 'bottom';
    const dx = to.x + to.width / 2 - (from.x + from.width / 2);
    const dy = to.y + to.height / 2 - (from.y + from.height / 2);
    if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'top' : 'bottom';
    return dx >= 0 ? 'left' : 'right';
  };
  const sourceWall = (from: Rect, to: Rect): Wall => targetWall(to, from);
  const wallPoint = (r: Rect, wall: Wall, axis: number): Pt => {
    switch (wall) {
      case 'top':
        return { x: axis, y: r.y };
      case 'bottom':
        return { x: axis, y: r.y + r.height };
      case 'left':
        return { x: r.x, y: axis };
      case 'right':
        return { x: r.x + r.width, y: axis };
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
    const pos = ideals.map((v) => Math.max(lo, Math.min(hi, v)));
    for (let iter = 0; iter < 5; iter++) {
      let changed = false;
      for (let i = 1; i < n; i++) {
        const minI = pos[i - 1]! + MIN_PORT_GAP;
        if (pos[i]! < minI) {
          pos[i] = minI;
          changed = true;
        }
      }
      for (let i = n - 1; i >= 0; i--) {
        const maxI = i === n - 1 ? hi : pos[i + 1]! - MIN_PORT_GAP;
        if (pos[i]! > maxI) {
          pos[i] = maxI;
          changed = true;
        }
      }
      if (pos[0]! < lo) {
        pos[0] = lo;
        changed = true;
      }
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
    const positions = cascadePorts(
      sorted.map((e) => e.ideal),
      lo,
      hi,
    );
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
    for (let i = 1; i < points.length - 1; ) {
      const a = points[i - 1]!,
        b = points[i]!,
        c = points[i + 1]!;
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
    const spanBoxes = realBoxes.filter((ob) => {
      const cy = ob.y + ob.height / 2;
      return cy >= minCy && cy <= maxCy;
    });
    const right = Math.max(...spanBoxes.map((ob) => ob.x + ob.width));
    skipLaneX.set(i, right + SKIP_LANE_CLEARANCE + skipLaneOrdinal * SKIP_LANE_GAP);
    skipLaneOrdinal++;
  }

  // Detect opposing edge pairs (antiparallel edges)
  const opposingEdges = new Map<number, number>();
  for (let i = 0; i < doc.edges.length; i++) {
    for (let j = i + 1; j < doc.edges.length; j++) {
      const e1 = doc.edges[i]!,
        e2 = doc.edges[j]!;
      if (e1.from === e2.to && e1.to === e2.from) {
        opposingEdges.set(i, j);
        opposingEdges.set(j, i);
      }
    }
  }

  const wallGroups = new Map<string, Array<{ edgeIndex: number; ideal: number }>>();
  const fromWallByEdge = new Map<number, Wall>();
  const toWallByEdge = new Map<number, Wall>();
  const groupKey = (id: string, wall: Wall): string => `${id}\0${wall}`;
  const axisIdeal = (
    wall: Wall,
    self: Rect,
    other: Rect,
    edgeIndex: number,
    isSource: boolean,
  ): number => {
    const lane = skipLaneX.get(edgeIndex);
    if (lane !== undefined && (wall === 'top' || wall === 'bottom')) return lane;
    const isOpposing = opposingEdges.has(edgeIndex);
    if (wall === 'top' || wall === 'bottom') {
      const mid = other.x + other.width / 2;
      if (!isOpposing) return mid;
      const dy = other.y + other.height / 2 - (self.y + self.height / 2);
      // Traffic drives on the right: outgoing goes +X if dy > 0, -X if dy < 0
      const sign = isSource ? (dy >= 0 ? 1 : -1) : dy >= 0 ? -1 : 1;
      return mid + sign * 14;
    } else {
      const mid = other.y + other.height / 2;
      if (!isOpposing) return mid;
      const dx = other.x + other.width / 2 - (self.x + self.width / 2);
      const sign = isSource ? (dx >= 0 ? -1 : 1) : dx >= 0 ? 1 : -1;
      return mid + sign * 14;
    }
  };
  for (const [i, e] of doc.edges.entries()) {
    const a = placed.boxes.has(e.from) ? box(e.from) : undefined;
    const b = placed.boxes.has(e.to) ? box(e.to) : undefined;
    if (!a || !b) continue;
    const lane = skipLaneX.get(i);
    const fw =
      lane !== undefined ? (lane > a.x + a.width / 2 ? 'right' : 'left') : sourceWall(a, b);
    const tw =
      lane !== undefined ? (lane > b.x + b.width / 2 ? 'right' : 'left') : targetWall(a, b);
    fromWallByEdge.set(i, fw);
    toWallByEdge.set(i, tw);
    const fk = groupKey(e.from, fw);
    const tk = groupKey(e.to, tw);
    if (!wallGroups.has(fk)) wallGroups.set(fk, []);
    if (!wallGroups.has(tk)) wallGroups.set(tk, []);
    wallGroups.get(fk)!.push({ edgeIndex: i, ideal: axisIdeal(fw, a, b, i, true) });
    wallGroups.get(tk)!.push({ edgeIndex: i, ideal: axisIdeal(tw, b, a, i, false) });
  }

  const fromPorts = new Map<string, Map<number, Pt>>();
  const toPorts = new Map<string, Map<number, Pt>>();
  for (const [key, group] of wallGroups) {
    const [id, wall] = key.split('\0') as [string, Wall];
    const ports = assignPorts(box(id), wall, group);
    fromPorts.set(key, ports);
    toPorts.set(key, ports);
  }

  const elements: SceneElement[] = [];
  const labelElements: SceneElement[] = [];
  let maxRouteX = placed.width - margin;
  if (doc.title) {
    elements.push(
      p.text(
        doc.title,
        margin,
        margin + typography.titleFontSize,
        typography.titleFontSize,
        palette.text,
        { weight: 'bold' },
      ),
    );
  }

  // Edges first (under the nodes).
  for (const [i, e] of doc.edges.entries()) {
    const a = placed.boxes.has(e.from) ? box(e.from) : undefined;
    const b = placed.boxes.has(e.to) ? box(e.to) : undefined;
    if (!a || !b) continue;
    const bends = placed.edgeBends.get(i);
    const fw = fromWallByEdge.get(i) ?? sourceWall(a, b);
    const tw = toWallByEdge.get(i) ?? targetWall(a, b);
    const fromPt =
      fromPorts.get(groupKey(e.from, fw))?.get(i) ??
      borderPoint(a, b.x + b.width / 2, b.y + b.height / 2);
    const toPt =
      toPorts.get(groupKey(e.to, tw))?.get(i) ??
      borderPoint(b, a.x + a.width / 2, a.y + a.height / 2);
    const hasBends = bends && bends.length > 0;
    const points: readonly Pt[] =
      hasBends && skipLaneX.has(i)
        ? (() => {
            const laneX = skipLaneX.get(i)!;
            return simplifyPoints([
              fromPt,
              { x: laneX, y: fromPt.y },
              { x: laneX, y: toPt.y },
              toPt,
            ]);
          })()
        : hasBends
          ? (() => {
              const obstacles = [...placed.boxes.values()]
                .filter((ob) => ob.id !== e.from && ob.id !== e.to)
                .map((ob) => ({ x: ob.x, y: ob.y + titleH, width: ob.width, height: ob.height }));
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
              if (fromPt && toPt) {
                return [fromPt, toPt];
              }
              const { start, end } = connectSlots(a, b);
              return [start, end];
            })();
    const obstacles = [...placed.boxes.values()]
      .filter((ob) => ob.id !== e.from && ob.id !== e.to)
      .map((ob) => ({ x: ob.x, y: ob.y + titleH, width: ob.width, height: ob.height }));
    if (countRouteCollisions(points, obstacles) > 0) {
      console.warn(
        `[routing] No clear route between ${e.from} and ${e.to}: route intersects obstacles.`,
      );
    }
    maxRouteX = Math.max(maxRouteX, ...points.map((pt) => pt.x));
    const isActive = e.kind === 'active';
    const edgeColor = isActive ? palette.primary : palette.textMuted;
    const edgeWidth = isActive ? 2.5 : 1.5;
    const pathOpts: Parameters<typeof p.path>[3] = {
      ...(doc.directed ? { markerEnd: isActive ? ARROW_ACTIVE_ID : ARROW_ID } : {}),
      ...(e.kind === 'dashed' ? { dash: '6 3' } : {}),
    };
    elements.push(p.path(pathData(points), edgeColor, edgeWidth, pathOpts));
    if (e.label) {
      const isOpposing = opposingEdges.has(i);
      const frac = isOpposing ? 0.28 : 0.5;
      const { pt, normal } = pathPointAtFraction(points, frac);
      const lateralShift = isOpposing ? 16 : 0;
      const mx = pt.x + normal.x * lateralShift;
      const my = pt.y + normal.y * lateralShift;
      const edgeFont = theme.edges?.labelFontSize ?? 12;
      const w = measureText(e.label, edgeFont).width + 8;
      maxRouteX = Math.max(maxRouteX, mx + w / 2);
      labelElements.push(
        p.rect(
          { x: mx - w / 2, y: my - 9, width: w, height: 18 },
          palette.background,
          palette.background,
          0,
          { rx: 3 },
        ),
      );
      labelElements.push(
        p.text(e.label, mx, my + 4, edgeFont, isActive ? palette.primary : palette.textMuted, {
          anchor: 'middle',
        }),
      );
    }
  }
  elements.push(...labelElements);

  // Nodes.
  const anchors: Record<string, { bounds: Rect }> = {};
  for (const n of doc.nodes) {
    const b = box(n.id);
    const isActive = n.kind === 'active';
    const fill = isActive ? palette.primary : palette.surface;
    const stroke = isActive ? palette.primary : palette.border;
    const sw = isActive ? 2 : (theme.nodes?.standard.borderWidth ?? 1.5);
    const rx = theme.nodes?.standard.cornerRadius ?? 6;
    const textColor = isActive ? readableText(fill, theme) : palette.text;
    elements.push(p.rect(b, fill, stroke, sw, { rx }));
    elements.push(
      p.text(n.label, b.x + b.width / 2, b.y + b.height / 2 + font * 0.35, font, textColor, {
        anchor: 'middle',
        weight: 'bold',
      }),
    );
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
    ...(doc.directed
      ? {
          defs: [
            graphArrowDef(palette.textMuted, ARROW_ID, theme.edges?.arrowSize ?? 8),
            graphArrowDef(palette.primary, ARROW_ACTIVE_ID, theme.edges?.arrowSize ?? 8),
          ],
        }
      : {}),
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
