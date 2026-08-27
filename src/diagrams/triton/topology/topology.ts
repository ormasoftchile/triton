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
 *   5. Connection routing styles:
 *      - `@orthogonal`, `@straight`, `@bezier`, `@polyline`
 *      - Interface ports and IP annotations (`r1:eth0 [10.0.0.1] -- sw1:ge-0/0/1`)
 *      - Bandwidth & protocol labels (`"10 Gbps"`, `"BGP"`)
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
    // `subnet "10.0.1.0/24" "Public Subnet"` or `zone "DMZ"` or `group N0 : NUMA Node 0`
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
    // `router r1 "Edge Gateway" [10.0.0.1]` or `node N0 : Node 0 : CPU+RAM`
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
        // Legacy syntax: `node N0 : Node 0 : CPU+RAM`
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

      // Extract IP address from sub if present
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
    // `r1:eth0 -- sw1:ge-0/0/1 @orthogonal "10G" : 140`
    // `spine1 -- leaf1, leaf2 @orthogonal "100G Trunk"`
    // `a <--> b`, `a --> b`, `a -- b`, `a .. b`
    const edgeMatch = line.match(/^(\S+)\s*(-->|<-->|<--|--|\.\.|\.\.\.)\s*([^:@]+)(.*)$/);
    if (edgeMatch) {
      const fromRaw = edgeMatch[1]!;
      const op = edgeMatch[2]!;
      const toRawList = edgeMatch[3]!.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
      const rest = edgeMatch[4]!.trim();

      const directed = op === '-->' || op === '->';
      const bidirectional = op === '<-->';

      // Parse router style modifier: `@orthogonal`, `@straight`, `@bezier`, `@polyline`
      const routerMatch = rest.match(/@(orthogonal|straight|bezier|polyline)\b/i);
      const routeStyle = routerMatch ? (routerMatch[1]!.toLowerCase() as RouteStyle) : undefined;

      // Parse cost weight: `: 140`
      const costMatch = rest.match(/:\s*(-?\d+(?:\.\d+)?)/);
      const cost = costMatch ? Number(costMatch[1]) : undefined;

      // Parse edge label: `"10 Gbps"`
      const labelMatch = rest.match(/"([^"]+)"|'([^']+)'/);
      const edgeLabel = labelMatch ? labelMatch[1] ?? labelMatch[2] : undefined;

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

export function layoutTopology(doc: TopologyDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing, edges } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const small = typography.smallFontSize;
  const titleH = doc.title ? typography.titleFontSize + 24 : 0;

  const nodeWidth = (n: TopoNode): number =>
    Math.max(
      120,
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

  // ─── Layout Positioning Strategies ──────────────────────────────────────────

  if (doc.pattern === 'spine-leaf') {
    // 3-Tier Spine-Leaf Clos Network Layout
    const isSpine = (n: TopoNode) => n.role === 'spine' || n.id.toLowerCase().startsWith('spine');
    const isLeaf = (n: TopoNode) =>
      !isSpine(n) && (n.role === 'leaf' || n.role === 'tor' || n.id.toLowerCase().startsWith('leaf') || n.role === 'switch');
    const isCompute = (n: TopoNode) => !isSpine(n) && !isLeaf(n);

    const spines = doc.nodes.filter(isSpine);
    const leaves = doc.nodes.filter(isLeaf);
    const compute = doc.nodes.filter(isCompute);

    const tiers = [spines, leaves, compute].filter((t) => t.length > 0);
    const startY = margin + titleH + 20;
    const tierGap = 110;
    const maxCount = Math.max(...tiers.map((t) => t.length), 1);
    const colSpacing = 170;
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
    // Hub and Spoke radial layout with generous radius to prevent card collisions
    const hub = doc.nodes[0]!;
    const spokes = doc.nodes.slice(1);
    const hubW = nodeWidth(hub);
    const maxSpokeW = Math.max(...spokes.map(nodeWidth), 120);

    const radius = Math.max(230, hubW / 2 + maxSpokeW / 2 + 70);
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
    const maxNodeW = Math.max(...doc.nodes.map(nodeWidth), 120);
    const radius = Math.max(210, count * 35);
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
    // Subnet / Zone Enclosures with clean vertical-column or side-by-side flow
    let gx = margin;
    const gy = margin + titleH + 10;
    let maxBottom = gy;
    const GHEADER = 36,
      GPAD = 20,
      CGAP = 28,
      GROUP_GAP = 60;

    for (const g of doc.groups) {
      const kids = doc.nodes.filter((n) => n.group === g.id);
      const childW = Math.max(130, ...(kids.length > 0 ? kids.map(nodeWidth) : [130]));
      // Use 1 column if <= 4 items for neat vertical stack, or 2 columns if larger
      const cols = kids.length <= 4 ? 1 : 2;
      const rows = Math.max(1, Math.ceil(kids.length / cols));
      const innerW = cols * childW + (cols - 1) * CGAP;
      const innerH = rows * nodeH + (rows - 1) * CGAP;
      const gw = Math.max(innerW + GPAD * 2, 220);
      const gh = GHEADER + GPAD + innerH + GPAD;

      groupBox.set(g.id, { x: gx, y: gy, width: gw, height: gh });
      kids.forEach((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        box.set(n.id, {
          x: gx + GPAD + col * (childW + CGAP),
          y: gy + GHEADER + GPAD + row * (nodeH + CGAP),
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
    const nodeW = Math.max(130, ...doc.nodes.map(nodeWidth));
    const cols = Math.max(1, Math.ceil(Math.sqrt(doc.nodes.length)));
    const colGap = 90,
      rowGap = 70;

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
  for (const g of doc.groups) {
    const gb = groupBox.get(g.id)!;
    const isSubnet = g.type === 'subnet' || Boolean(g.cidr);

    // Enclosure card
    elements.push(
      p.rect(gb, palette.surface, isSubnet ? palette.primary : palette.border, 1.6, {
        rx: 10,
      }),
    );

    // Group Title Badge
    const tagText = g.cidr ? `${g.label} [${g.cidr}]` : g.label;
    elements.push(
      p.text(tagText, gb.x + 16, gb.y + 22, small, palette.primary, { weight: 'bold' }),
    );
  }

  // ─── Render Edges & Connectors ──────────────────────────────────────────────
  const idBox = new Map<string, Rect>([...box, ...groupBox]);

  for (const e of doc.edges) {
    const a = idBox.get(e.from);
    const b = idBox.get(e.to);
    if (!a || !b) continue;

    const tier: CostTier | undefined =
      e.cost !== undefined && doc.scale.tiers.length > 0
        ? classifyCost(doc.scale, e.cost)
        : undefined;

    const color = tier?.color ?? palette.primary;
    const strokeWidth = 1.8;

    // Determine exit/entry attachment points
    const acx = a.x + a.width / 2;
    const acy = a.y + a.height / 2;
    const bcx = b.x + b.width / 2;
    const bcy = b.y + b.height / 2;

    const dx = bcx - acx;
    const dy = bcy - acy;

    let start: Point;
    let end: Point;

    if (Math.abs(dx) > Math.abs(dy) * 1.3) {
      // Dominantly horizontal layout
      start = dx > 0 ? { x: a.x + a.width, y: acy } : { x: a.x, y: acy };
      end = dx > 0 ? { x: b.x, y: bcy } : { x: b.x + b.width, y: bcy };
    } else if (Math.abs(dy) > Math.abs(dx) * 1.3) {
      // Dominantly vertical layout
      start = dy > 0 ? { x: acx, y: a.y + a.height } : { x: acx, y: a.y };
      end = dy > 0 ? { x: bcx, y: b.y } : { x: bcx, y: b.y + b.height };
    } else {
      // General ray border connection
      start = borderPoint(a, bcx, bcy);
      end = borderPoint(b, acx, acy);
    }

    let pathD: string;
    let midPoint: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

    if (e.routeStyle === 'orthogonal') {
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal step-over
        const midX = (start.x + end.x) / 2;
        pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(midX)} ${rhu(start.y)} L ${rhu(midX)} ${rhu(end.y)} L ${rhu(end.x)} ${rhu(end.y)}`;
        midPoint = { x: midX, y: (start.y + end.y) / 2 };
      } else {
        // Vertical step-down
        const midY = (start.y + end.y) / 2;
        pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(start.x)} ${rhu(midY)} L ${rhu(end.x)} ${rhu(midY)} L ${rhu(end.x)} ${rhu(end.y)}`;
        midPoint = { x: (start.x + end.x) / 2, y: midY };
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
      midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    } else {
      // Straight direct link
      pathD = `M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`;
    }

    elements.push(
      p.path(pathD, color, strokeWidth, {
        ...(tier?.dash ? { dash: tier.dash } : {}),
        ...(e.directed ? { markerEnd: ARROW_ID } : {}),
        ...(e.bidirectional ? { markerStart: ARROW_START_ID, markerEnd: ARROW_ID } : {}),
      }),
    );

    // Interface Port Labels (with offset avoiding arrow overlap)
    if (e.fromPort) {
      const offsetX = start.x === a.x ? -6 : start.x === a.x + a.width ? 6 : 0;
      const offsetY = start.y === a.y ? -6 : start.y === a.y + a.height ? 12 : -6;
      elements.push(
        p.text(e.fromPort, start.x + offsetX, start.y + offsetY, small - 2, palette.textMuted, {
          anchor: offsetX < 0 ? 'end' : offsetX > 0 ? 'start' : 'middle',
        }),
      );
    }
    if (e.toPort) {
      const offsetX = end.x === b.x ? -6 : end.x === b.x + b.width ? 6 : 0;
      const offsetY = end.y === b.y ? -6 : end.y === b.y + b.height ? 12 : -6;
      elements.push(
        p.text(e.toPort, end.x + offsetX, end.y + offsetY, small - 2, palette.textMuted, {
          anchor: offsetX < 0 ? 'end' : offsetX > 0 ? 'start' : 'middle',
        }),
      );
    }

    // Edge Label / Cost Tag (in center)
    const labelText = e.label ?? (e.cost !== undefined ? (doc.scale.unit ? `${e.cost} ${doc.scale.unit}` : String(e.cost)) : undefined);
    if (labelText) {
      const lw = measureText(labelText, small - 1).width + 14;
      const lh = 19;
      elements.push(
        p.rect(
          { x: rhu(midPoint.x - lw / 2), y: rhu(midPoint.y - lh / 2), width: rhu(lw), height: lh },
          palette.background,
          color,
          1,
          { rx: 4 },
        ),
      );
      elements.push(
        p.text(labelText, rhu(midPoint.x), rhu(midPoint.y + (small - 1) * 0.35), small - 1, color, {
          anchor: 'middle',
          weight: 'bold',
        }),
      );
    }
  }

  // ─── Render Nodes ───────────────────────────────────────────────────────────
  const anchors: Record<string, { bounds: Rect }> = {};

  for (const n of doc.nodes) {
    const b = box.get(n.id)!;

    // Outer card
    elements.push(p.rect(b, palette.surface, palette.primary, 1.8, { rx: 6 }));

    // Device Role Badge (e.g. `ROUTER`, `SWITCH`, `FIREWALL`, `SERVER`)
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
  const allBoxes = [...box.values(), ...groupBox.values()];
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
