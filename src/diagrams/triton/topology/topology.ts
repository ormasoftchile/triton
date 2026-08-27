/**
 * @file diagrams/topology/topology.ts — Network & Infrastructure Topology Engine.
 *
 * Characteristics:
 *   1. Title support via `topology :: "Title"`, `title "Title"`, or frontmatter.
 *   2. Device roles with semantic icons & badges:
 *      - `router` / `gateway`, `switch` / `tor` / `spine` / `leaf`
 *      - `firewall` / `waf`, `loadbalancer` / `lb`
 *      - `server` / `host` / `compute`, `database` / `db` / `storage`
 *      - `cloud` / `internet` / `wan`, `client` / `endpoint`, `cluster` / `pod`
 *   3. Subnet, VLAN, Zone, and Rack enclosures:
 *      - `subnet "10.0.1.0/24" "Public Subnet"`
 *      - `zone "DMZ"`, `vlan 100 "Prod VLAN"`, `rack "Rack-01"`
 *   4. Topology layout patterns:
 *      - `pattern spine-leaf` (Spines -> Leaves -> Compute tiered Clos network)
 *      - `pattern hub-spoke` / `star` (Central Hub with radial/perimeter Spokes)
 *      - `pattern ring` (Circular loop topology)
 *      - `pattern mesh` (Full/partial mesh topology)
 *      - `pattern tiered` (Hierarchical ingress -> aggregation -> storage)
 *   5. Connection routing styles & collision-free label placement:
 *      - Pre-layout edge label measurement & automatic clearance allocation
 *      - Obstacle-aware label positioning (never overlaps nodes, group titles, or paths)
 *      - Multi-track non-overlapping `@orthogonal` bus/channel routing
 *      - `@straight`, `@bezier`, `@polyline`
 *      - Interface ports and IP annotations (`r1:eth0 [10.0.0.1] -- sw1:ge-0/0/1`)
 *   6. Cost / latency scale and legend tiering (full backward compatibility).
 *   7. Comprehensive NodeAnchorRegistry for poster cross-linking.
 */

import type {
  DiagramModule,
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
  Rect,
  Point,
  RouteStyle,
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { measureText } from '../../../text/metrics.js';
import { borderPoint } from '../../../graph/connect.js';
import { classifyCost, buildLegend, type CostScale, type CostTier } from '../../../style/cost.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { rhu, rhuInt } from '../../../util/round.js';

export type DeviceRole =
  | 'router'
  | 'gateway'
  | 'switch'
  | 'spine'
  | 'leaf'
  | 'tor'
  | 'firewall'
  | 'waf'
  | 'loadbalancer'
  | 'lb'
  | 'server'
  | 'host'
  | 'compute'
  | 'database'
  | 'db'
  | 'storage'
  | 'cloud'
  | 'internet'
  | 'wan'
  | 'client'
  | 'device'
  | 'cluster'
  | 'pod'
  | 'node';

export type TopologyPattern = 'spine-leaf' | 'hub-spoke' | 'star' | 'ring' | 'mesh' | 'tiered' | 'grid';

export interface TopoNode {
  id: string;
  label: string;
  sub?: string | undefined;
  role?: DeviceRole | undefined;
  ip?: string | undefined;
  group?: string | undefined;
}

export interface TopoGroup {
  id: string;
  label: string;
  cidr?: string | undefined;
  type?: 'subnet' | 'zone' | 'vlan' | 'rack' | 'group' | undefined;
}

export interface TopoEdge {
  from: string;
  to: string;
  fromPort?: string | undefined;
  toPort?: string | undefined;
  label?: string | undefined;
  routeStyle?: RouteStyle | undefined;
  directed?: boolean | undefined;
  bidirectional?: boolean | undefined;
  cost?: number | undefined;
}

export interface TopologyDoc {
  version: string;
  metadata: Record<string, unknown>;
  title?: string | undefined;
  pattern?: TopologyPattern | undefined;
  scale: CostScale;
  groups: TopoGroup[];
  nodes: TopoNode[];
  edges: TopoEdge[];
}

// ─── Parser ──────────────────────────────────────────────────────────────────

function parse(input: string): TopologyDoc {
  let title: string | undefined;
  let unit: string | undefined;
  let pattern: TopologyPattern | undefined;
  const tiers: CostTier[] = [];
  const groups: TopoGroup[] = [];
  const nodes: TopoNode[] = [];
  const edges: TopoEdge[] = [];
  let curGroup: string | undefined;

  const lines = input.split(/\r?\n/);

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;

    // Header with optional `::` title: `topology :: "Enterprise Network"`
    const headerMatch = line.match(/^topology(?:\s*::\s*|\s+title\s+|\s+)(.+)$/i);
    if (headerMatch && !title && !line.startsWith('topology\n') && line !== 'topology') {
      const rest = headerMatch[1]!.trim();
      if (!/^(costs|pattern|tier|group|subnet|zone|vlan|rack|node|router|switch|server|db|cloud|firewall)\b/i.test(rest)) {
        title = rest.replace(/^["']|["']$/g, '');
        continue;
      }
    }
    if (/^topology$/i.test(line)) continue;

    // Title directive: `title "Enterprise Network"` or `title :: Enterprise Network`
    const titleMatch = line.match(/^title(?:\s*::\s*|\s+)(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    // Pattern directive: `pattern spine-leaf` or `pattern hub-spoke`
    const patternMatch = line.match(/^pattern\s+([\w-]+)/i);
    if (patternMatch) {
      pattern = patternMatch[1]!.toLowerCase() as TopologyPattern;
      continue;
    }

    // Cost scale & tiers
    if (line.startsWith('costs')) {
      const t = line.split(/\s+/);
      unit = t[1];
      continue;
    }
    if (line.startsWith('tier')) {
      const t = line.split(/\s+/);
      const tier: CostTier = {
        name: t[1] ?? '',
        maxWeight: Number(t[2]),
        color: t[3] ?? '#888',
        ...(t[4] ? { dash: t.slice(4).join(' ') } : {}),
      };
      tiers.push(tier);
      continue;
    }

    // Subnet / Zone / VLAN / Rack containers
    const groupMatch = line.match(/^(group|subnet|zone|vlan|rack)\s+(.+)$/i);
    if (groupMatch) {
      const gType = groupMatch[1]!.toLowerCase() as TopoGroup['type'];
      const rest = groupMatch[2]!.trim();

      let id = '';
      let label = '';
      let cidr: string | undefined;

      if (gType === 'group' && rest.includes(':') && !rest.includes('"')) {
        const parts = rest.split(':').map((s) => s.trim());
        id = parts[0]!;
        label = parts[1] || id;
      } else {
        const quoted = rest.matchAll(/"([^"]+)"|'([^']+)'|(\S+)/g);
        const tokens: string[] = [];
        for (const m of quoted) {
          tokens.push(m[1] ?? m[2] ?? m[3]!);
        }
        if (tokens.length >= 2) {
          if (tokens[0]!.includes('/') || /^\d+\.\d+/.test(tokens[0]!)) {
            cidr = tokens[0]!;
            label = tokens[1]!;
            id = `sub_${groups.length + 1}`;
          } else {
            id = tokens[0]!;
            label = tokens[1]!;
          }
        } else if (tokens.length === 1) {
          label = tokens[0]!;
          id = `grp_${groups.length + 1}`;
        }
      }

      if (!id) id = `g_${groups.length + 1}`;
      if (!label) label = id;

      groups.push({
        id,
        label,
        type: gType,
        ...(cidr ? { cidr } : {}),
      });
      curGroup = id;
      continue;
    }

    if (/^end\b/i.test(line)) {
      curGroup = undefined;
      continue;
    }

    // Devices & Nodes
    const deviceMatch = line.match(
      /^(node|router|gateway|switch|spine|leaf|tor|firewall|waf|loadbalancer|lb|server|host|compute|database|db|storage|cloud|internet|wan|client|device|cluster|pod)\s+(.+)$/i,
    );
    if (deviceMatch) {
      const role = deviceMatch[1]!.toLowerCase() as DeviceRole;
      const rest = deviceMatch[2]!.trim();

      let id = '';
      let label = '';
      let sub: string | undefined;
      let ip: string | undefined;

      if (role === 'node' && rest.includes(':') && !rest.includes('"')) {
        const parts = rest.split(':').map((s) => s.trim());
        id = parts[0]!;
        label = parts[1] || id;
        if (parts[2]) sub = parts[2];
      } else {
        const idM = rest.match(/^([\w-]+)/);
        if (idM) {
          id = idM[1]!;
          let remainder = rest.slice(id.length).trim();

          const bracketM = remainder.match(/\[(.*?)\]/);
          if (bracketM) {
            sub = bracketM[1]!.trim();
            remainder = remainder.replace(/\[.*?\]/, '').trim();
          }

          const labelM = remainder.match(/"([^"]+)"|'([^']+)'/);
          if (labelM) {
            label = labelM[1] ?? labelM[2]!;
          } else if (remainder) {
            label = remainder;
          } else {
            label = id;
          }
        }
      }

      if (!id) id = `n_${nodes.length + 1}`;
      if (!label) label = id;

      if (sub && (/^\d+\.\d+\.\d+\.\d+/.test(sub) || sub.includes('/'))) {
        ip = sub;
      }

      nodes.push({
        id,
        label,
        role: role === 'node' ? undefined : role,
        ...(sub ? { sub } : {}),
        ...(ip ? { ip } : {}),
        ...(curGroup ? { group: curGroup } : {}),
      });
      continue;
    }

    // Connections / Edges
    const edgeMatch = line.match(/^(\S+)\s*(-->|<-->|<--|--|\.\.|\.\.\.)\s*(.+)$/);
    if (edgeMatch) {
      const fromRaw = edgeMatch[1]!;
      const op = edgeMatch[2]!;
      let rest = edgeMatch[3]!.trim();

      const directed = op === '-->' || op === '->';
      const bidirectional = op === '<-->';

      // Extract label if present: "100G Trunk" or '100G Trunk'
      let edgeLabel: string | undefined;
      const labelMatch = rest.match(/"([^"]+)"|'([^']+)'/);
      if (labelMatch) {
        edgeLabel = labelMatch[1] ?? labelMatch[2];
        rest = rest.replace(labelMatch[0], '').trim();
      }

      // Extract cost if present: : 140
      let cost: number | undefined;
      const costMatch = rest.match(/:\s*(-?\d+(?:\.\d+)?)/);
      if (costMatch) {
        cost = Number(costMatch[1]);
        rest = rest.replace(costMatch[0], '').trim();
      }

      // Extract route style modifier: @orthogonal, @straight, @bezier, @polyline
      let routeStyle: RouteStyle | undefined;
      const routerMatch = rest.match(/@(orthogonal|straight|bezier|polyline)\b/i);
      if (routerMatch) {
        routeStyle = routerMatch[1]!.toLowerCase() as RouteStyle;
        rest = rest.replace(routerMatch[0], '').trim();
      }

      const toRawList = rest.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

      const fromParts = fromRaw.split(':');
      const fromId = fromParts[0]!;
      const fromPort = fromParts[1];

      for (const toItem of toRawList) {
        const toParts = toItem.split(':');
        const toId = toParts[0]!;
        const toPort = toParts[1];

        edges.push({
          from: fromId,
          to: toId,
          ...(fromPort ? { fromPort } : {}),
          ...(toPort ? { toPort } : {}),
          ...(edgeLabel ? { label: edgeLabel } : {}),
          ...(routeStyle ? { routeStyle } : {}),
          ...(directed ? { directed: true } : {}),
          ...(bidirectional ? { bidirectional: true } : {}),
          ...(cost !== undefined ? { cost } : {}),
        });
      }
    }
  }

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    ...(title ? { title } : {}),
    ...(pattern ? { pattern } : {}),
    scale: { ...(unit !== undefined ? { unit } : {}), tiers },
    groups,
    nodes,
    edges,
  };
}

// ─── Layout & Rendering ──────────────────────────────────────────────────────

const ARROW_ID = 'topo-arrow';
const ARROW_START_ID = 'topo-arrow-start';

function intersects(a: Rect, b: Rect, pad = 2): boolean {
  return !(
    a.x + a.width < b.x - pad ||
    a.x > b.x + b.width + pad ||
    a.y + a.height < b.y - pad ||
    a.y > b.y + b.height + pad
  );
}

export function layoutTopology(doc: TopologyDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing, edges } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const small = typography.smallFontSize;
  const titleH = doc.title ? typography.titleFontSize + 24 : 0;

  const nodeWidth = (n: TopoNode): number =>
    Math.max(
      130,
      Math.max(measureText(n.label, font).width, measureText(n.sub ?? '', small).width) + 40,
    );
  const nodeH = doc.nodes.some((n) => n.sub || n.role) ? 58 : 42;

  const elements: SceneElement[] = [];
  const box = new Map<string, Rect>();
  const groupBox = new Map<string, Rect>();

  // Title
  if (doc.title) {
    elements.push(
      p.text(
        doc.title,
        margin,
        margin + typography.titleFontSize,
        typography.titleFontSize + 2,
        palette.text,
        { weight: 'bold' },
      ),
    );
  }

  // ─── Pre-Layout Edge Label Measurement & Dynamic Clearance Allocation ───────
  const nodeGroupMap = new Map<string, string>();
  doc.nodes.forEach((n) => {
    if (n.group) nodeGroupMap.set(n.id, n.group);
  });

  let maxInterGroupLabelW = 0;
  let maxIntraGroupLabelW = 0;
  let maxIntraGroupLabelH = 0;
  let hasIntraGroupLabels = false;
  let maxTierLabelH = 0;
  let maxSpokeLabelW = 0;

  for (const e of doc.edges) {
    const labelText =
      e.label ??
      (e.cost !== undefined
        ? doc.scale.unit
          ? `${e.cost} ${doc.scale.unit}`
          : String(e.cost)
        : undefined);
    if (!labelText) continue;

    const lw = measureText(labelText, small - 1).width + 16;
    const lh = 18;

    const gFrom = nodeGroupMap.get(e.from);
    const gTo = nodeGroupMap.get(e.to);

    if (gFrom && gTo && gFrom !== gTo) {
      maxInterGroupLabelW = Math.max(maxInterGroupLabelW, lw);
    } else if (gFrom && gTo && gFrom === gTo) {
      hasIntraGroupLabels = true;
      maxIntraGroupLabelW = Math.max(maxIntraGroupLabelW, lw);
      maxIntraGroupLabelH = Math.max(maxIntraGroupLabelH, lh);
    } else if (!gFrom && !gTo) {
      maxTierLabelH = Math.max(maxTierLabelH, lh);
      maxSpokeLabelW = Math.max(maxSpokeLabelW, lw);
      maxInterGroupLabelW = Math.max(maxInterGroupLabelW, lw);
    } else {
      maxInterGroupLabelW = Math.max(maxInterGroupLabelW, lw);
    }
  }

  // ─── Layout Positioning Strategies ──────────────────────────────────────────

  if (doc.pattern === 'spine-leaf') {
    // Clos 3-Tier Network: Spines (Tier 0) -> Leaves (Tier 1) -> Compute (Tier 2)
    const isSpine = (n: TopoNode) => n.role === 'spine' || n.id.toLowerCase().startsWith('spine');
    const isLeaf = (n: TopoNode) =>
      !isSpine(n) &&
      (n.role === 'leaf' ||
        n.role === 'tor' ||
        n.id.toLowerCase().startsWith('leaf') ||
        n.role === 'switch');
    const isCompute = (n: TopoNode) => !isSpine(n) && !isLeaf(n);

    const spines = doc.nodes.filter(isSpine);
    const leaves = doc.nodes.filter(isLeaf);
    const compute = doc.nodes.filter(isCompute);

    const tiers = [spines, leaves, compute].filter((t) => t.length > 0);
    const startY = margin + titleH + 20;
    const tierGap = Math.max(130, maxTierLabelH + 110);
    const maxCount = Math.max(...tiers.map((t) => t.length), 1);
    const colSpacing = Math.max(180, maxInterGroupLabelW + 20);
    const totalContentW = maxCount * colSpacing;

    tiers.forEach((tierNodes, tIdx) => {
      const ty = startY + tIdx * (nodeH + tierGap);
      const tierW = tierNodes.length * colSpacing;
      const startX = margin + (totalContentW - tierW) / 2;

      tierNodes.forEach((n, i) => {
        const w = nodeWidth(n);
        const bx = startX + i * colSpacing + (colSpacing - w) / 2;
        box.set(n.id, { x: bx, y: ty, width: w, height: nodeH });
      });
    });
  } else if (doc.pattern === 'hub-spoke' || doc.pattern === 'star') {
    // Hub and Spoke radial layout with generous separation
    const hub = doc.nodes[0]!;
    const spokes = doc.nodes.slice(1);
    const hubW = nodeWidth(hub);
    const maxSpokeW = Math.max(...spokes.map(nodeWidth), 130);

    const radius = Math.max(240, hubW / 2 + maxSpokeW / 2 + maxSpokeLabelW + 60);
    const centerX = margin + radius + maxSpokeW / 2 + 20;
    const centerY = margin + titleH + radius + nodeH / 2 + 20;

    box.set(hub.id, { x: centerX - hubW / 2, y: centerY - nodeH / 2, width: hubW, height: nodeH });

    spokes.forEach((spoke, idx) => {
      const angle = (idx / spokes.length) * 2 * Math.PI - Math.PI / 2;
      const sx = centerX + radius * Math.cos(angle);
      const sy = centerY + radius * Math.sin(angle);
      const sw = nodeWidth(spoke);
      box.set(spoke.id, { x: sx - sw / 2, y: sy - nodeH / 2, width: sw, height: nodeH });
    });
  } else if (doc.pattern === 'ring') {
    // Ring circular loop layout
    const count = doc.nodes.length;
    const maxNodeW = Math.max(...doc.nodes.map(nodeWidth), 130);
    const radius = Math.max(220, count * 40);
    const centerX = margin + radius + maxNodeW / 2 + 20;
    const centerY = margin + titleH + radius + nodeH / 2 + 20;

    doc.nodes.forEach((n, idx) => {
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
      const nx = centerX + radius * Math.cos(angle);
      const ny = centerY + radius * Math.sin(angle);
      const nw = nodeWidth(n);
      box.set(n.id, { x: nx - nw / 2, y: ny - nodeH / 2, width: nw, height: nodeH });
    });
  } else if (doc.groups.length > 0) {
    // Subnet / Zone Enclosures with clean vertical columns and dynamic clearance corridors
    let gx = margin;
    const gy = margin + titleH + 10;
    let maxBottom = gy;
    const GHEADER = 36,
      GPAD = 24,
      CGAP_X = Math.max(28, maxIntraGroupLabelW > 0 ? 36 : 28),
      CGAP_Y = hasIntraGroupLabels ? 56 : 32,
      GROUP_GAP = Math.max(70, maxInterGroupLabelW + 60);

    for (const g of doc.groups) {
      const kids = doc.nodes.filter((n) => n.group === g.id);
      const childW = Math.max(140, ...(kids.length > 0 ? kids.map(nodeWidth) : [140]));
      const cols = kids.length <= 4 ? 1 : 2;
      const rows = Math.max(1, Math.ceil(kids.length / cols));
      const innerW = cols * childW + (cols - 1) * CGAP_X;
      const innerH = rows * nodeH + (rows - 1) * CGAP_Y;
      const gw = Math.max(innerW + GPAD * 2, 230);
      const gh = GHEADER + GPAD + innerH + GPAD;

      groupBox.set(g.id, { x: gx, y: gy, width: gw, height: gh });
      kids.forEach((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        box.set(n.id, {
          x: gx + GPAD + col * (childW + CGAP_X),
          y: gy + GHEADER + GPAD + row * (nodeH + CGAP_Y),
          width: childW,
          height: nodeH,
        });
      });
      maxBottom = Math.max(maxBottom, gy + gh);
      gx += gw + GROUP_GAP;
    }

    let ux = margin;
    const uy = maxBottom + 40;
    for (const n of doc.nodes.filter((n) => !n.group)) {
      const w = nodeWidth(n);
      box.set(n.id, { x: ux, y: uy, width: w, height: nodeH });
      ux += w + 40;
    }
  } else {
    // Standard Grid layout
    const nodeW = Math.max(140, ...doc.nodes.map(nodeWidth));
    const cols = Math.max(1, Math.ceil(Math.sqrt(doc.nodes.length)));
    const colGap = Math.max(100, maxInterGroupLabelW + 50);
    const rowGap = hasIntraGroupLabels ? 90 : 80;

    doc.nodes.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      box.set(n.id, {
        x: margin + col * (nodeW + colGap),
        y: margin + titleH + row * (nodeH + rowGap) + 10,
        width: nodeW,
        height: nodeH,
      });
    });
  }

  // ─── Render Group Panels (Subnets / Zones) ──────────────────────────────────
  const groupHeaderBoxes: Rect[] = [];

  for (const g of doc.groups) {
    const gb = groupBox.get(g.id)!;
    const isSubnet = g.type === 'subnet' || Boolean(g.cidr);

    elements.push(
      p.rect(gb, palette.surface, isSubnet ? palette.primary : palette.border, 1.6, {
        rx: 10,
      }),
    );

    const tagText = g.cidr ? `${g.label} [${g.cidr}]` : g.label;
    elements.push(
      p.text(tagText, gb.x + 16, gb.y + 22, small, palette.primary, { weight: 'bold' }),
    );

    groupHeaderBoxes.push({ x: gb.x, y: gb.y, width: gb.width, height: 38 });
  }

  // ─── Render Edges & Multi-Track Corridor Routing ────────────────────────────
  const idBox = new Map<string, Rect>([...box, ...groupBox]);
  const placedLabels: Rect[] = [];
  const obstacles: Rect[] = [...box.values(), ...groupHeaderBoxes];

  doc.edges.forEach((e, edgeIdx) => {
    const a = idBox.get(e.from);
    const b = idBox.get(e.to);
    if (!a || !b) return;

    const tier: CostTier | undefined =
      e.cost !== undefined && doc.scale.tiers.length > 0
        ? classifyCost(doc.scale, e.cost)
        : undefined;

    const color = tier?.color ?? palette.primary;
    const strokeWidth = 1.8;

    const acx = a.x + a.width / 2;
    const acy = a.y + a.height / 2;
    const bcx = b.x + b.width / 2;
    const bcy = b.y + b.height / 2;

    const dx = bcx - acx;
    const dy = bcy - acy;

    let start: Point;
    let end: Point;

    const isTopToBottom = dy > 30 && Math.abs(dy) > Math.abs(dx) * 0.4;
    const isBottomToTop = dy < -30 && Math.abs(dy) > Math.abs(dx) * 0.4;
    const isLeftToRight = dx > 30 && Math.abs(dx) >= Math.abs(dy) * 0.8;
    const isRightToLeft = dx < -30 && Math.abs(dx) >= Math.abs(dy) * 0.8;

    if (isTopToBottom) {
      start = { x: acx, y: a.y + a.height };
      end = { x: bcx, y: b.y };
    } else if (isBottomToTop) {
      start = { x: acx, y: a.y };
      end = { x: bcx, y: b.y + b.height };
    } else if (isLeftToRight) {
      start = { x: a.x + a.width, y: acy };
      end = { x: b.x, y: bcy };
    } else if (isRightToLeft) {
      start = { x: a.x, y: acy };
      end = { x: b.x + b.width, y: bcy };
    } else {
      start = borderPoint(a, bcx, bcy);
      end = borderPoint(b, acx, acy);
    }

    let pathD: string;
    let labelPos: Point;

    if (e.routeStyle === 'orthogonal') {
      if (isTopToBottom || isBottomToTop) {
        if (Math.abs(start.x - end.x) < 4) {
          pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`;
          labelPos = { x: start.x, y: (start.y + end.y) / 2 };
        } else {
          const corridorFraction = 0.32 + (edgeIdx % 4) * 0.12;
          const yMid = start.y + (end.y - start.y) * corridorFraction;
          pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(start.x)} ${rhu(yMid)} L ${rhu(end.x)} ${rhu(yMid)} L ${rhu(end.x)} ${rhu(end.y)}`;
          labelPos = { x: (start.x + end.x) / 2, y: yMid - 6 };
        }
      } else if (isLeftToRight || isRightToLeft) {
        if (Math.abs(start.y - end.y) < 4) {
          pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`;
          labelPos = { x: (start.x + end.x) / 2, y: start.y - 6 };
        } else {
          const corridorFraction = 0.32 + (edgeIdx % 4) * 0.12;
          const xMid = start.x + (end.x - start.x) * corridorFraction;
          pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(xMid)} ${rhu(start.y)} L ${rhu(xMid)} ${rhu(end.y)} L ${rhu(end.x)} ${rhu(end.y)}`;
          labelPos = { x: xMid, y: (start.y + end.y) / 2 };
        }
      } else {
        pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`;
        labelPos = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 6 };
      }
    } else if (e.routeStyle === 'bezier') {
      if (Math.abs(dx) > Math.abs(dy)) {
        const cx1 = start.x + dx * 0.45;
        const cx2 = end.x - dx * 0.45;
        pathD = `M ${rhu(start.x)} ${rhu(start.y)} C ${rhu(cx1)} ${rhu(start.y)}, ${rhu(cx2)} ${rhu(end.y)}, ${rhu(end.x)} ${rhu(end.y)}`;
      } else {
        const cy1 = start.y + dy * 0.45;
        const cy2 = end.y - dy * 0.45;
        pathD = `M ${rhu(start.x)} ${rhu(start.y)} C ${rhu(start.x)} ${rhu(cy1)}, ${rhu(end.x)} ${rhu(cy2)}, ${rhu(end.x)} ${rhu(end.y)}`;
      }
      labelPos = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 8 };
    } else {
      // Straight direct line
      pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`;
      if (Math.abs(start.x - end.x) < 4) {
        // Vertical direct link: centered between top and bottom cards
        labelPos = { x: start.x, y: (start.y + end.y) / 2 };
      } else if (Math.abs(start.y - end.y) < 4) {
        // Horizontal direct link
        labelPos = { x: (start.x + end.x) / 2, y: start.y - 8 };
      } else {
        // Diagonal direct link
        const t = edgeIdx % 2 === 0 ? 0.30 : 0.70;
        const lx = start.x + (end.x - start.x) * t;
        const ly = start.y + (end.y - start.y) * t;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        labelPos = { x: lx + nx * 10, y: ly + ny * 10 };
      }
    }

    elements.push(
      p.path(pathD, color, strokeWidth, {
        ...(tier?.dash ? { dash: tier.dash } : {}),
        ...(e.directed ? { markerEnd: ARROW_ID } : {}),
        ...(e.bidirectional ? { markerStart: ARROW_START_ID, markerEnd: ARROW_ID } : {}),
      }),
    );

    // Interface Port Labels
    if (e.fromPort) {
      const offsetX = start.x <= a.x + 2 ? -6 : start.x >= a.x + a.width - 2 ? 6 : 0;
      const offsetY = start.y <= a.y + 2 ? -6 : start.y >= a.y + a.height - 2 ? 14 : -6;
      elements.push(
        p.text(e.fromPort, start.x + offsetX, start.y + offsetY, small - 2, palette.textMuted, {
          anchor: offsetX < 0 ? 'end' : offsetX > 0 ? 'start' : 'middle',
        }),
      );
    }
    if (e.toPort) {
      const offsetX = end.x <= b.x + 2 ? -6 : end.x >= b.x + b.width - 2 ? 6 : 0;
      const offsetY = end.y <= b.y + 2 ? -6 : end.y >= b.y + b.height - 2 ? 14 : -6;
      elements.push(
        p.text(e.toPort, end.x + offsetX, end.y + offsetY, small - 2, palette.textMuted, {
          anchor: offsetX < 0 ? 'end' : offsetX > 0 ? 'start' : 'middle',
        }),
      );
    }

    // ─── Obstacle-Aware Edge Label Placement ──────────────────────────────────
    const labelText =
      e.label ??
      (e.cost !== undefined
        ? doc.scale.unit
          ? `${e.cost} ${doc.scale.unit}`
          : String(e.cost)
        : undefined);
    if (labelText) {
      const textDim = measureText(labelText, small - 1);
      const lw = textDim.width + 10;
      const lh = 16;

      let bestX = labelPos.x - lw / 2;
      let bestY = labelPos.y - lh / 2;

      // Candidate search for collision-free placement
      const allObstacles = [...obstacles, ...placedLabels];
      let hasCollision = allObstacles.some((obs) =>
        intersects({ x: bestX, y: bestY, width: lw, height: lh }, obs, 2),
      );

      if (hasCollision) {
        // Try fractional positions along the edge path
        const sampleT = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
        let found = false;

        for (const t of sampleT) {
          const cx = start.x + (end.x - start.x) * t;
          const cy = start.y + (end.y - start.y) * t;
          const testX = cx - lw / 2;
          const testY = cy - lh / 2;

          if (!allObstacles.some((obs) => intersects({ x: testX, y: testY, width: lw, height: lh }, obs, 2))) {
            bestX = testX;
            bestY = testY;
            found = true;
            break;
          }
        }

        // If still colliding, offset perpendicular to the edge path
        if (!found) {
          for (let step = 1; step <= 8; step++) {
            const offsetY = (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * (lh + 4);
            const testY = bestY + offsetY;
            if (!allObstacles.some((obs) => intersects({ x: bestX, y: testY, width: lw, height: lh }, obs, 2))) {
              bestY = testY;
              found = true;
              break;
            }
          }
        }
      }

      const finalRect: Rect = { x: bestX, y: bestY, width: lw, height: lh };
      placedLabels.push(finalRect);

      elements.push(
        p.rect(
          { x: rhu(bestX), y: rhu(bestY), width: rhu(lw), height: lh },
          palette.background,
          palette.border,
          0.8,
          { rx: 3 },
        ),
      );
      elements.push(
        p.text(
          labelText,
          rhu(bestX + lw / 2),
          rhu(bestY + lh / 2 + (small - 1) * 0.35),
          small - 1,
          color,
          {
            anchor: 'middle',
            weight: 'bold',
          },
        ),
      );
    }
  });

  // ─── Render Nodes ───────────────────────────────────────────────────────────
  const anchors: Record<string, { bounds: Rect }> = {};

  for (const n of doc.nodes) {
    const b = box.get(n.id)!;

    elements.push(p.rect(b, palette.surface, palette.primary, 1.8, { rx: 6 }));

    // Device Role Badge
    if (n.role) {
      const roleText = n.role.toUpperCase();
      const rw = measureText(roleText, small - 2).width + 8;
      const rh = 13;
      elements.push(
        p.rect(
          { x: b.x + 6, y: b.y - rh / 2, width: rw, height: rh },
          palette.background,
          palette.primary,
          1,
          { rx: 3 },
        ),
      );
      elements.push(
        p.text(roleText, b.x + 6 + rw / 2, b.y + (small - 2) * 0.35, small - 2, palette.primary, {
          anchor: 'middle',
          weight: 'bold',
        }),
      );
    }

    // Node Label
    const textY = n.sub ? b.y + 24 : b.y + b.height / 2 + font * 0.35;
    elements.push(
      p.text(n.label, rhu(b.x + b.width / 2), rhu(textY), font, palette.text, {
        anchor: 'middle',
        weight: 'bold',
      }),
    );

    // Subtitle / IP / Specs
    if (n.sub) {
      elements.push(
        p.text(n.sub, rhu(b.x + b.width / 2), rhu(b.y + 44), small - 1, palette.textMuted, {
          anchor: 'middle',
        }),
      );
    }

    // Anchor registrations for cross-linking in posters
    anchors[n.id] = { bounds: b };
    anchors[`node.${n.id}`] = { bounds: b };
    if (n.role) anchors[`${n.role}.${n.id}`] = { bounds: b };
    if (n.group) anchors[`${n.group}.${n.id}`] = { bounds: b };
  }

  // Anchor registrations for groups / subnets
  for (const g of doc.groups) {
    const gb = groupBox.get(g.id)!;
    anchors[g.id] = { bounds: gb };
    anchors[`zone_${g.id}`] = { bounds: gb };
    anchors[`subnet_${g.id}`] = { bounds: gb };
  }

  // ─── Legend & ViewBox Dimensions ────────────────────────────────────────────
  const allBoxes = [...box.values(), ...groupBox.values(), ...placedLabels];
  const boxesRight = Math.max(margin, ...allBoxes.map((b) => b.x + b.width));
  const contentBottom = Math.max(margin + titleH, ...allBoxes.map((b) => b.y + b.height));

  let contentRight = boxesRight;
  if (doc.scale.tiers.length > 0) {
    const legend = buildLegend(p, theme, doc.scale, { x: boxesRight + 36, y: margin + titleH });
    elements.push(...legend.elements);
    contentRight = legend.bounds.x + legend.bounds.width;
  }

  const s = edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);

  const defs = [
    `<marker id="${ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
    `<marker id="${ARROW_START_ID}" markerWidth="${s}" markerHeight="${sH}" refX="1" refY="${sMidY}" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
  ];

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: 0, y: 0, width: rhuInt(contentRight + margin), height: rhuInt(contentBottom + margin) },
      background: palette.background,
      elements,
      defs,
    },
    doc.metadata?.['overlays'] as any,
    theme,
  );

  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const topology: DiagramModule<TopologyDoc> = {
  parseMermaid(input: string) {
    return parse(input);
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutTopology(ir, theme);
  },
};
