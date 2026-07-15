/**
 * @file diagrams/architecture/gridPlacer.ts — Directional grid placement for
 * architecture-beta diagrams.
 *
 * The legacy `directionalGridPlacer` keeps the original flat Mermaid-compatible
 * BFS behavior. `groupAwareDirectionalGridPlacer` adds recursive cluster
 * placement for architecture groups so containment is preserved before pixel
 * group rectangles are measured in layout.ts.
 */

import type { ArchAlign, ArchitectureDocument } from './ir.js';

export interface GridPlacerResult {
  /** Grid column (0-indexed, left-to-right). */
  readonly col: number;
  /** Grid row (0-indexed, top-to-bottom). */
  readonly row: number;
}

type Side = 'L' | 'R' | 'T' | 'B';
type ContainerId = string | '__root__';
type ItemKind = 'leaf' | 'group';

type ItemId = `node:${string}` | `group:${string}`;

interface MutableCell { col: number; row: number }
interface Size { width: number; height: number }

interface Item {
  id: ItemId;
  kind: ItemKind;
  sourceId: string;
  width: number;
  height: number;
  order: number;
  cluster?: Cluster;
}

interface Constraint {
  from: ItemId;
  to: ItemId;
  fromSide: Side;
  toSide: Side;
  edgeOrder: number;
}

interface AdjConstraint {
  to: ItemId;
  fromSide: Side;
  toSide: Side;
  edgeOrder: number;
}

interface RectCell {
  id: ItemId;
  col: number;
  row: number;
  width: number;
  height: number;
}

interface Cluster {
  containerId: ContainerId;
  items: Item[];
  itemPos: Map<ItemId, MutableCell>;
  nodePos: Map<string, MutableCell>;
  width: number;
  height: number;
}

const CLUSTER_ROUTING_LANE_GAP = 1;

// ─── Direction-pair delta table ───────────────────────────────────────────────
//
// For each direction pair (fromSide + toSide), this gives (Δcol, Δrow) to
// apply to the CURRENT node's position to get the NEIGHBOR node's position.
// Rows increase downward.
const DELTA: Readonly<Record<string, readonly [number, number]>> = {
  LR: [-1,  0],
  RL: [+1,  0],
  TB: [ 0, -1],
  BT: [ 0, +1],
  LT: [-1, -1],
  LB: [-1, +1],
  RT: [+1, -1],
  RB: [+1, +1],
  TL: [-1, -1],
  TR: [+1, -1],
  BL: [-1, +1],
  BR: [+1, +1],
};

function upperSide(side: string): Side | undefined {
  const s = side.toUpperCase();
  return s === 'L' || s === 'R' || s === 'T' || s === 'B' ? s : undefined;
}

// ─── Public API: legacy flat placer ───────────────────────────────────────────

/**
 * Compute integer grid-cell positions from directional edge constraints.
 *
 * @param nodes  All services and junctions (any object with an `id`).
 * @param edges  All edges with `from`, `fromSide`, `to`, `toSide`.
 * @returns      Map from node ID to {col, row} (0-indexed, non-negative).
 */
export function directionalGridPlacer(
  nodes:  ReadonlyArray<{ readonly id: string }>,
  edges:  ReadonlyArray<{
    readonly from:     string;
    readonly fromSide: string;
    readonly to:       string;
    readonly toSide:   string;
  }>,
): Map<string, GridPlacerResult> {
  if (nodes.length === 0) return new Map();

  // ── 1. Build bidirectional adjacency list ──────────────────────────────────
  // adjList[nodeId][dirPair] = neighborId
  const adjList = new Map<string, Map<string, string>>();
  for (const n of nodes) adjList.set(n.id, new Map());

  for (const e of edges) {
    const fs  = e.fromSide.toUpperCase();
    const ts  = e.toSide.toUpperCase();
    const fwd = fs + ts;
    const rev = ts + fs;

    const fromAdj = adjList.get(e.from);
    const toAdj   = adjList.get(e.to);
    if (!fromAdj || !toAdj) continue; // unknown node — skip

    // Contradiction detection: same pair pointing to a DIFFERENT neighbor.
    if (fromAdj.has(fwd) && fromAdj.get(fwd) !== e.to) {
      console.warn(`[gridPlacer] Contradictory constraint on "${e.from}" direction ${fwd} — first-wins`);
    } else {
      fromAdj.set(fwd, e.to);
    }

    if (toAdj.has(rev) && toAdj.get(rev) !== e.from) {
      console.warn(`[gridPlacer] Contradictory constraint on "${e.to}" direction ${rev} — first-wins`);
    } else {
      toAdj.set(rev, e.from);
    }
  }

  // ── 2. BFS ─────────────────────────────────────────────────────────────────
  const position = new Map<string, { col: number; row: number }>();
  /** Reverse map for collision detection: "col,row" → nodeId */
  const occupied = new Map<string, string>();

  function bfs(seed: string, seedCol: number, seedRow: number): void {
    position.set(seed, { col: seedCol, row: seedRow });
    occupied.set(`${seedCol},${seedRow}`, seed);
    const queue: string[] = [seed];

    while (queue.length > 0) {
      const curr     = queue.shift()!;
      const currPos  = position.get(curr)!;
      const adj      = adjList.get(curr);
      if (!adj) continue;

      for (const [pair, neighbor] of adj) {
        if (position.has(neighbor)) continue; // already placed (cycle or revisit)

        const d = DELTA[pair];
        if (!d) continue; // unrecognised pair — skip

        let col = currPos.col + d[0];
        let row = currPos.row + d[1];

        // Collision: bump to the next free row in the same column.
        const key = `${col},${row}`;
        if (occupied.has(key) && occupied.get(key) !== neighbor) {
          console.warn(`[gridPlacer] Cell collision at (${col},${row}), bumping "${neighbor}"`);
          let bump = row + 1;
          while (occupied.has(`${col},${bump}`)) bump++;
          row = bump;
        }

        position.set(neighbor, { col, row });
        occupied.set(`${col},${row}`, neighbor);
        queue.push(neighbor);
      }
    }
  }

  // Seed: prefer a node that has at least one edge, for a more centred layout.
  const connected = new Set([...edges.map(e => e.from), ...edges.map(e => e.to)]);
  const seed = nodes.find(n => connected.has(n.id)) ?? nodes[0]!;
  bfs(seed.id, 0, 0);

  // ── 3. Handle disconnected components ─────────────────────────────────────
  for (const n of nodes) {
    if (!position.has(n.id)) {
      const maxCol = position.size > 0
        ? Math.max(...[...position.values()].map(p => p.col)) + 2
        : 0;
      bfs(n.id, maxCol, 0);
    }
  }

  // ── 4. Nodes with NO edges at all → fall back: single row ─────────────────
  if (position.size === 0) {
    nodes.forEach((n, i) => position.set(n.id, { col: i, row: 0 }));
  }

  // ── 5. Normalise to non-negative ───────────────────────────────────────────
  const vals    = [...position.values()];
  const minCol  = Math.min(...vals.map(p => p.col));
  const minRow  = Math.min(...vals.map(p => p.row));

  const result = new Map<string, GridPlacerResult>();
  for (const [id, pos] of position) {
    result.set(id, { col: pos.col - minCol, row: pos.row - minRow });
  }
  return result;
}

// ─── Public API: group-aware cluster placer ──────────────────────────────────

export function groupAwareDirectionalGridPlacer(ir: ArchitectureDocument): Map<string, GridPlacerResult> {
  const nodeIds = new Set<string>([
    ...ir.services.map(s => s.id),
    ...ir.junctions.map(j => j.id),
  ]);
  if (nodeIds.size === 0) return new Map();

  const groupIds = new Set(ir.groups.map(g => g.id));
  const parentOfGroup = new Map<string, ContainerId>();
  for (const g of ir.groups) {
    parentOfGroup.set(g.id, g.parent && groupIds.has(g.parent) ? g.parent : '__root__');
  }

  const ownerOfNode = new Map<string, ContainerId>();
  for (const s of ir.services) ownerOfNode.set(s.id, s.group && groupIds.has(s.group) ? s.group : '__root__');
  for (const j of ir.junctions) ownerOfNode.set(j.id, j.group && groupIds.has(j.group) ? j.group : '__root__');

  const groupOrder = new Map<string, number>();
  ir.groups.forEach((g, i) => groupOrder.set(g.id, i));
  const serviceOrder = new Map<string, number>();
  ir.services.forEach((s, i) => serviceOrder.set(s.id, i));
  const junctionOrder = new Map<string, number>();
  ir.junctions.forEach((j, i) => junctionOrder.set(j.id, i));

  const clusterByContainer = new Map<ContainerId, Cluster>();

  function isDescendantNode(nodeId: string, container: ContainerId): boolean {
    if (!nodeIds.has(nodeId)) return false;
    if (container === '__root__') return true;
    let owner = ownerOfNode.get(nodeId);
    while (owner && owner !== '__root__') {
      if (owner === container) return true;
      owner = parentOfGroup.get(owner);
    }
    return false;
  }

  function directChildItem(container: ContainerId, nodeId: string): ItemId | undefined {
    if (!nodeIds.has(nodeId)) return undefined;
    const owner = ownerOfNode.get(nodeId) ?? '__root__';
    if (owner === container) return `node:${nodeId}`;
    if (owner === '__root__') return undefined;

    let childGroup = owner;
    let parent = parentOfGroup.get(childGroup) ?? '__root__';
    while (parent !== container) {
      if (parent === '__root__') return undefined;
      childGroup = parent;
      parent = parentOfGroup.get(childGroup) ?? '__root__';
    }
    return `group:${childGroup}`;
  }

  function ancestorContainers(nodeId: string): ContainerId[] {
    const ancestors: ContainerId[] = ['__root__'];
    const chain: string[] = [];
    let owner = ownerOfNode.get(nodeId);
    while (owner && owner !== '__root__') {
      chain.push(owner);
      owner = parentOfGroup.get(owner);
    }
    ancestors.push(...chain.reverse());
    return ancestors;
  }

  function leastCommonContainer(memberIds: readonly string[]): ContainerId | undefined {
    const known = memberIds.filter(id => nodeIds.has(id));
    if (known.length < 2) return undefined;
    const chains = known.map(ancestorContainers);
    let lca: ContainerId = '__root__';
    const minLen = Math.min(...chains.map(c => c.length));
    for (let i = 0; i < minLen; i++) {
      const candidate = chains[0]![i]!;
      if (chains.every(c => c[i] === candidate)) lca = candidate;
      else break;
    }
    return lca;
  }

  function buildCluster(container: ContainerId): Cluster {
    const cached = clusterByContainer.get(container);
    if (cached) return cached;

    const items: Item[] = [];
    for (const g of ir.groups) {
      if ((parentOfGroup.get(g.id) ?? '__root__') !== container) continue;
      const child = buildCluster(g.id);
      if (child.width === 0 || child.height === 0) continue;
      items.push({
        id: `group:${g.id}`,
        kind: 'group',
        sourceId: g.id,
        width: child.width,
        height: child.height,
        order: groupOrder.get(g.id) ?? 0,
        cluster: child,
      });
    }
    for (const s of ir.services) {
      if ((ownerOfNode.get(s.id) ?? '__root__') === container) {
        items.push({ id: `node:${s.id}`, kind: 'leaf', sourceId: s.id, width: 1, height: 1, order: serviceOrder.get(s.id) ?? 0 });
      }
    }
    for (const j of ir.junctions) {
      if ((ownerOfNode.get(j.id) ?? '__root__') === container) {
        items.push({ id: `node:${j.id}`, kind: 'leaf', sourceId: j.id, width: 1, height: 1, order: junctionOrder.get(j.id) ?? 0 });
      }
    }

    const constraints: Constraint[] = [];
    ir.edges.forEach((e, edgeOrder) => {
      if (!isDescendantNode(e.from, container) || !isDescendantNode(e.to, container)) return;
      const fromSide = upperSide(e.fromSide);
      const toSide = upperSide(e.toSide);
      if (!fromSide || !toSide) return;
      const from = directChildItem(container, e.from);
      const to = directChildItem(container, e.to);
      if (!from || !to || from === to) return;
      constraints.push({ from, to, fromSide, toSide, edgeOrder });
    });

    const itemPos = placeItemsAsRectangles(items, constraints);
    applyContainerAligns(container, items, itemPos, ir.aligns, leastCommonContainer, directChildItem);

    const nodePos = new Map<string, MutableCell>();
    for (const item of items) {
      const base = itemPos.get(item.id);
      if (!base) continue;
      if (item.kind === 'leaf') {
        nodePos.set(item.sourceId, { col: base.col, row: base.row });
      } else {
        for (const [nodeId, local] of item.cluster!.nodePos) {
          nodePos.set(nodeId, { col: base.col + local.col, row: base.row + local.row });
        }
      }
    }

    normalizePositions(itemPos, nodePos);
    const bounds = boundsForItems(items, itemPos);
    const cluster: Cluster = {
      containerId: container,
      items,
      itemPos,
      nodePos,
      width: bounds.width,
      height: bounds.height,
    };
    clusterByContainer.set(container, cluster);
    return cluster;
  }

  const root = buildCluster('__root__');
  return new Map([...root.nodePos].map(([id, cell]) => [id, { col: cell.col, row: cell.row }]));
}

// ─── Rectangle item placement ────────────────────────────────────────────────

function placeItemsAsRectangles(items: readonly Item[], constraints: readonly Constraint[]): Map<ItemId, MutableCell> {
  const pos = new Map<ItemId, MutableCell>();
  if (items.length === 0) return pos;

  const itemById = new Map(items.map(i => [i.id, i]));
  const adj = buildAdjacency(items, constraints);
  const occupied: RectCell[] = [];

  const connected = new Set<ItemId>();
  for (const c of constraints) {
    if (itemById.has(c.from) && itemById.has(c.to)) {
      connected.add(c.from);
      connected.add(c.to);
    }
  }
  const connectedSeeds = items.filter(i => connected.has(i.id));
  const seeds = connectedSeeds.length > 0 ? [...connectedSeeds, ...items.filter(i => !connected.has(i.id))] : [...items];

  function place(item: Item, cell: MutableCell): void {
    pos.set(item.id, { col: cell.col, row: cell.row });
    occupied.push({ id: item.id, col: cell.col, row: cell.row, width: item.width, height: item.height });
  }

  for (const seed of seeds) {
    if (!pos.has(seed.id)) {
      const hasPlacedGroup = occupied.some(r => itemById.get(r.id)?.kind === 'group');
      const laneGap = seed.kind === 'group' || hasPlacedGroup ? CLUSTER_ROUTING_LANE_GAP : 0;
      const seedCell = occupied.length === 0 ? { col: 0, row: 0 } : { col: maxRight(occupied) + laneGap, row: 0 };
      place(seed, firstFreeRect(seedCell, seed, occupied),);
    }

    const queue: Item[] = [seed];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currPos = pos.get(curr.id);
      if (!currPos) continue;
      for (const c of adj.get(curr.id) ?? []) {
        const next = itemById.get(c.to);
        if (!next || pos.has(next.id)) continue;
        const candidate = candidateFromSidePair(curr, currPos, next, c.fromSide, c.toSide);
        const free = firstNonOverlappingCandidate(candidate, curr, next, c, occupied);
        place(next, free);
        queue.push(next);
      }
    }
  }

  normalizeItemPositions(pos);
  return pos;
}

function buildAdjacency(items: readonly Item[], constraints: readonly Constraint[]): Map<ItemId, AdjConstraint[]> {
  const itemIds = new Set(items.map(i => i.id));
  const firstWins = new Map<ItemId, Map<string, AdjConstraint>>();
  for (const item of items) firstWins.set(item.id, new Map());

  for (const c of [...constraints].sort((a, b) => a.edgeOrder - b.edgeOrder)) {
    if (!itemIds.has(c.from) || !itemIds.has(c.to)) continue;
    addAdj(firstWins, c.from, c.fromSide + c.toSide, { to: c.to, fromSide: c.fromSide, toSide: c.toSide, edgeOrder: c.edgeOrder });
    addAdj(firstWins, c.to, c.toSide + c.fromSide, { to: c.from, fromSide: c.toSide, toSide: c.fromSide, edgeOrder: c.edgeOrder });
  }

  return new Map([...firstWins].map(([id, byPair]) => [id, [...byPair.values()].sort((a, b) => a.edgeOrder - b.edgeOrder)]));
}

function addAdj(adj: Map<ItemId, Map<string, AdjConstraint>>, from: ItemId, pair: string, c: AdjConstraint): void {
  const byPair = adj.get(from);
  if (!byPair) return;
  if (byPair.has(pair) && byPair.get(pair)!.to !== c.to) {
    console.warn(`[gridPlacer] Contradictory constraint on "${from}" direction ${pair} — first-wins`);
    return;
  }
  if (!byPair.has(pair)) byPair.set(pair, c);
}

function candidateFromSidePair(curr: Item, currPos: MutableCell, next: Item, fromSide: Side, toSide: Side): MutableCell {
  const d = DELTA[fromSide + toSide];
  if (!d) return { col: currPos.col, row: currPos.row };
  const laneGap = curr.kind === 'group' || next.kind === 'group' ? CLUSTER_ROUTING_LANE_GAP : 0;
  let col = currPos.col;
  let row = currPos.row;
  if (d[0] < 0) col = currPos.col - next.width - laneGap;
  else if (d[0] > 0) col = currPos.col + curr.width + laneGap;
  if (d[1] < 0) row = currPos.row - next.height - laneGap;
  else if (d[1] > 0) row = currPos.row + curr.height + laneGap;
  return { col, row };
}

function firstNonOverlappingCandidate(
  candidate: MutableCell,
  curr: Item,
  next: Item,
  c: AdjConstraint,
  occupied: readonly RectCell[],
): MutableCell {
  if (!overlapsAny(candidate, next, occupied)) return candidate;

  const d = DELTA[c.fromSide + c.toSide] ?? [0, 0];
  const currRect = occupied.find(r => r.id === curr.id);
  const limit = Math.max(12, occupied.length * 4 + maxRight(occupied) + maxBottom(occupied) + next.width + next.height);

  const offsets = orderedOffsets(limit);
  if (d[0] !== 0 && d[1] === 0) {
    for (const off of offsets) {
      const cell = { col: candidate.col, row: candidate.row + off };
      if (preservesHalfPlane(cell, next, currRect, d) && !overlapsAny(cell, next, occupied)) return cell;
    }
  } else if (d[0] === 0 && d[1] !== 0) {
    for (const off of offsets) {
      const cell = { col: candidate.col + off, row: candidate.row };
      if (preservesHalfPlane(cell, next, currRect, d) && !overlapsAny(cell, next, occupied)) return cell;
    }
  } else {
    for (let radius = 0; radius <= limit; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dyAbs = radius - Math.abs(dx);
        for (const dy of dyAbs === 0 ? [0] : [-dyAbs, dyAbs]) {
          const cell = { col: candidate.col + dx, row: candidate.row + dy };
          if (preservesHalfPlane(cell, next, currRect, d) && !overlapsAny(cell, next, occupied)) return cell;
        }
      }
    }
  }

  console.warn(`[gridPlacer] Rectangle collision near (${candidate.col},${candidate.row}), placing "${next.id}" after occupied extent`);
  return firstFreeRect({ col: maxRight(occupied), row: 0 }, next, occupied);
}

function orderedOffsets(limit: number): number[] {
  const out = [0];
  for (let i = 1; i <= limit; i++) out.push(i, -i);
  return out;
}

function preservesHalfPlane(cell: MutableCell, item: Size, curr: RectCell | undefined, d: readonly number[]): boolean {
  if (!curr) return true;
  const dx = d[0] ?? 0;
  const dy = d[1] ?? 0;
  if (dx < 0 && cell.col + item.width > curr.col) return false;
  if (dx > 0 && cell.col < curr.col + curr.width) return false;
  if (dy < 0 && cell.row + item.height > curr.row) return false;
  if (dy > 0 && cell.row < curr.row + curr.height) return false;
  return true;
}

function firstFreeRect(start: MutableCell, item: Size, occupied: readonly RectCell[]): MutableCell {
  let row = start.row;
  const widthLimit = Math.max(start.col + 1, maxRight(occupied) + item.width + occupied.length + 2);
  for (;;) {
    for (let col = start.col; col <= widthLimit; col++) {
      const cell = { col, row };
      if (!overlapsAny(cell, item, occupied)) return cell;
    }
    row++;
  }
}

function overlapsAny(cell: MutableCell, item: Size, occupied: readonly RectCell[], ignore: ReadonlySet<ItemId> = new Set()): boolean {
  return occupied.some(r => !ignore.has(r.id) && rectsOverlap(cell.col, cell.row, item.width, item.height, r.col, r.row, r.width, r.height));
}

function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function maxRight(rects: readonly RectCell[]): number {
  return rects.length === 0 ? 0 : Math.max(...rects.map(r => r.col + r.width));
}

function maxBottom(rects: readonly RectCell[]): number {
  return rects.length === 0 ? 0 : Math.max(...rects.map(r => r.row + r.height));
}

function normalizeItemPositions(pos: Map<ItemId, MutableCell>): void {
  if (pos.size === 0) return;
  const minCol = Math.min(...[...pos.values()].map(p => p.col));
  const minRow = Math.min(...[...pos.values()].map(p => p.row));
  for (const p of pos.values()) {
    p.col -= minCol;
    p.row -= minRow;
  }
}

function normalizePositions(itemPos: Map<ItemId, MutableCell>, nodePos: Map<string, MutableCell>): void {
  if (itemPos.size === 0 && nodePos.size === 0) return;
  const vals = [...itemPos.values(), ...nodePos.values()];
  const minCol = Math.min(...vals.map(p => p.col));
  const minRow = Math.min(...vals.map(p => p.row));
  for (const p of itemPos.values()) {
    p.col -= minCol;
    p.row -= minRow;
  }
  for (const p of nodePos.values()) {
    p.col -= minCol;
    p.row -= minRow;
  }
}

function boundsForItems(items: readonly Item[], itemPos: ReadonlyMap<ItemId, MutableCell>): Size {
  if (items.length === 0) return { width: 0, height: 0 };
  let width = 0;
  let height = 0;
  for (const item of items) {
    const p = itemPos.get(item.id);
    if (!p) continue;
    width = Math.max(width, p.col + item.width);
    height = Math.max(height, p.row + item.height);
  }
  return { width, height };
}

// ─── Containment-safe align ──────────────────────────────────────────────────

function applyContainerAligns(
  container: ContainerId,
  items: readonly Item[],
  itemPos: Map<ItemId, MutableCell>,
  aligns: readonly ArchAlign[],
  leastCommonContainer: (memberIds: readonly string[]) => ContainerId | undefined,
  directChildItem: (container: ContainerId, nodeId: string) => ItemId | undefined,
): void {
  const itemById = new Map(items.map(i => [i.id, i]));
  for (const align of aligns) {
    if (leastCommonContainer(align.members) !== container) continue;
    const itemIds = [...new Set(align.members.map(id => directChildItem(container, id)).filter((id): id is ItemId => !!id))];
    if (itemIds.length < 2) continue;
    if (!itemIds.every(id => itemById.has(id) && itemPos.has(id))) continue;

    const coords = itemIds.map(id => itemPos.get(id)![align.axis === 'row' ? 'row' : 'col']).sort((a, b) => a - b);
    const target = coords[Math.floor(coords.length / 2)]!;
    const proposed = new Map<ItemId, MutableCell>([...itemPos].map(([id, p]) => [id, { col: p.col, row: p.row }]));
    for (const id of itemIds) {
      const p = proposed.get(id)!;
      if (align.axis === 'row') p.row = target;
      else p.col = target;
    }

    if (positionsOverlap(items, proposed)) {
      console.warn(`[gridPlacer] Skipping align ${align.axis} [${align.members.join(', ')}] to preserve containment`);
      continue;
    }
    for (const [id, p] of proposed) itemPos.set(id, p);
  }
  normalizeItemPositions(itemPos);
}

function positionsOverlap(items: readonly Item[], pos: ReadonlyMap<ItemId, MutableCell>): boolean {
  const rects: RectCell[] = [];
  for (const item of items) {
    const p = pos.get(item.id);
    if (!p) continue;
    if (overlapsAny(p, item, rects)) return true;
    rects.push({ id: item.id, col: p.col, row: p.row, width: item.width, height: item.height });
  }
  return false;
}
