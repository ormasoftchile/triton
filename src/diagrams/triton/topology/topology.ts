/**
 * @file diagrams/topology/topology.ts — Cost-weighted node graph (NUMA / network).
 *
 * Value-driven mini-syntax:
 *   topology
 *     title NUMA interconnect
 *     costs ns
 *       tier local 90 #27ae60
 *       tier hop1 140 #2f80ed
 *       tier hop2 200 #e2574c 5 4
 *     node N0 : Node 0 : CPU+RAM
 *     N0 -- N1 : 140
 *
 * Edges are coloured/dashed by the tier their weight falls into; a legend is
 * rendered from the `costs` block. Demonstrates style/cost end to end.
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry, Rect,
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { measureText } from '../../../text/metrics.js';
import { connectSlots } from '../../../graph/connect.js';
import { classifyCost, buildLegend, type CostScale, type CostTier } from '../../../style/cost.js';
import { rhu } from '../../../util/round.js';

interface TopoNode { id: string; label: string; sub?: string; group?: string; }
interface TopoGroup { id: string; label: string; }
interface TopoEdge { from: string; to: string; cost?: number; }
interface TopologyDoc { title?: string; scale: CostScale; groups: TopoGroup[]; nodes: TopoNode[]; edges: TopoEdge[]; }

function parse(input: string): TopologyDoc {
  let title: string | undefined;
  let unit: string | undefined;
  const tiers: CostTier[] = [];
  const groups: TopoGroup[] = [];
  const nodes: TopoNode[] = [];
  const edges: TopoEdge[] = [];
  let curGroup: string | undefined;

  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const t = line.split(/\s+/);
    if (t[0] === 'topology') continue;
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'costs') { unit = t[1]; continue; }
    if (t[0] === 'tier') {
      const tier: CostTier = {
        name: t[1] ?? '', maxWeight: Number(t[2]), color: t[3] ?? '#888',
        ...(t[4] ? { dash: t.slice(4).join(' ') } : {}),
      };
      tiers.push(tier);
      continue;
    }
    if (t[0] === 'group') {
      const parts = line.slice(5).split(':').map(s => s.trim());
      const id = parts[0] ?? '';
      groups.push({ id, label: parts[1] || id });
      curGroup = id;
      continue;
    }
    if (t[0] === 'node') {
      const parts = line.slice(4).split(':').map(s => s.trim());
      const id = parts[0] ?? '';
      nodes.push({ id, label: parts[1] || id, ...(parts[2] ? { sub: parts[2] } : {}), ...(curGroup ? { group: curGroup } : {}) });
      continue;
    }
    if (line.includes('--')) {
      const m = line.match(/^(\S+)\s*--\s*(\S+)(?:\s*:\s*(-?\d+(?:\.\d+)?))?/);
      if (m) edges.push({ from: m[1]!, to: m[2]!, ...(m[3] !== undefined ? { cost: Number(m[3]) } : {}) });
    }
  }
  return {
    ...(title !== undefined ? { title } : {}),
    scale: { ...(unit !== undefined ? { unit } : {}), tiers },
    groups, nodes, edges,
  };
}

export function layoutTopology(doc: TopologyDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const small = typography.smallFontSize;
  const titleH = doc.title ? typography.titleFontSize + 14 : 0;

  const nodeWidth = (n: TopoNode): number => Math.max(96, Math.max(measureText(n.label, font).width, measureText(n.sub ?? '', small).width) + 28);
  const nodeH = doc.nodes.some(n => n.sub) ? 52 : 40;

  const elements: SceneElement[] = [];
  if (doc.title) elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  const box = new Map<string, Rect>();
  const groupBox = new Map<string, Rect>();
  const GHEADER = 26, GPAD = 14, CGAP = 18, GROUP_GAP = 70;

  if (doc.groups.length > 0) {
    let gx = margin;
    const gy = margin + titleH;
    let maxBottom = gy;
    for (const g of doc.groups) {
      const kids = doc.nodes.filter(n => n.group === g.id);
      const childW = Math.max(96, ...kids.map(nodeWidth));
      const cols = Math.max(1, Math.ceil(Math.sqrt(kids.length)));
      const rows = Math.max(1, Math.ceil(kids.length / cols));
      const innerW = cols * childW + (cols - 1) * CGAP;
      const innerH = rows * nodeH + (rows - 1) * CGAP;
      const gw = innerW + GPAD * 2;
      const gh = GHEADER + GPAD + innerH + GPAD;
      groupBox.set(g.id, { x: gx, y: gy, width: gw, height: gh });
      kids.forEach((n, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        box.set(n.id, { x: gx + GPAD + col * (childW + CGAP), y: gy + GHEADER + GPAD + row * (nodeH + CGAP), width: childW, height: nodeH });
      });
      maxBottom = Math.max(maxBottom, gy + gh);
      gx += gw + GROUP_GAP;
    }
    let ux = margin;
    const uy = maxBottom + 40;
    for (const n of doc.nodes.filter(n => !n.group)) {
      const w = nodeWidth(n);
      box.set(n.id, { x: ux, y: uy, width: w, height: nodeH });
      ux += w + 40;
    }
  } else {
    const nodeW = Math.max(96, ...doc.nodes.map(nodeWidth));
    const cols = Math.max(1, Math.ceil(Math.sqrt(doc.nodes.length)));
    const colGap = 96, rowGap = 80;
    doc.nodes.forEach((n, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      box.set(n.id, { x: margin + col * (nodeW + colGap), y: margin + titleH + row * (nodeH + rowGap), width: nodeW, height: nodeH });
    });
  }

  // group panels (under everything)
  for (const g of doc.groups) {
    const gb = groupBox.get(g.id)!;
    elements.push(p.rect(gb, '#fbfbfd', palette.primary, 2, { rx: 10 }));
    elements.push(p.text(g.label, gb.x + 12, gb.y + 17, small, palette.primary, { weight: 'bold' }));
  }

  // edges (over panels, under nodes); endpoints may be nodes or groups
  const idBox = new Map<string, Rect>([...box, ...groupBox]);
  for (const e of doc.edges) {
    const a = idBox.get(e.from), b = idBox.get(e.to);
    if (!a || !b) continue;
    const tier: CostTier | undefined = e.cost !== undefined && doc.scale.tiers.length > 0 ? classifyCost(doc.scale, e.cost) : undefined;
    const color = tier?.color ?? palette.textMuted;
    const { start, end } = connectSlots(a, b);
    elements.push(p.path(`M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`, color, 2, tier?.dash ? { dash: tier.dash } : {}));
    if (e.cost !== undefined) {
      const mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2;
      const label = doc.scale.unit ? `${e.cost} ${doc.scale.unit}` : String(e.cost);
      const w = measureText(label, small).width + 8;
      elements.push(p.rect({ x: mx - w / 2, y: my - 9, width: w, height: 16 }, palette.background, palette.background, 0, { rx: 3 }));
      elements.push(p.text(label, mx, my + 3, small, color, { anchor: 'middle', weight: 'bold' }));
    }
  }

  // nodes
  const anchors: Record<string, { bounds: Rect }> = {};
  for (const n of doc.nodes) {
    const b = box.get(n.id)!;
    elements.push(p.rect(b, palette.surface, palette.primary, 2, { rx: 8 }));
    if (n.sub) {
      elements.push(p.text(n.label, b.x + b.width / 2, b.y + 20, font, palette.text, { anchor: 'middle', weight: 'bold' }));
      elements.push(p.text(n.sub, b.x + b.width / 2, b.y + 38, small, palette.textMuted, { anchor: 'middle' }));
    } else {
      elements.push(p.text(n.label, b.x + b.width / 2, b.y + b.height / 2 + font * 0.35, font, palette.text, { anchor: 'middle', weight: 'bold' }));
    }
    anchors[n.id] = { bounds: b };
  }
  for (const g of doc.groups) anchors[g.id] = { bounds: groupBox.get(g.id)! };

  const allBoxes = [...box.values(), ...groupBox.values()];
  const boxesRight = Math.max(margin, ...allBoxes.map(b => b.x + b.width));
  const contentBottom = Math.max(margin + titleH, ...allBoxes.map(b => b.y + b.height));

  let contentRight = boxesRight;
  if (doc.scale.tiers.length > 0) {
    const legend = buildLegend(p, theme, doc.scale, { x: boxesRight + 40, y: margin + titleH });
    elements.push(...legend.elements);
    contentRight = legend.bounds.x + legend.bounds.width;
  }

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: contentRight + margin, height: contentBottom + margin },
    background: palette.background,
    elements,
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const topology: DiagramModule<TopologyDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutTopology(ir, theme);
  },
};
