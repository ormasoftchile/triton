/**
 * @file grammars/architecture/layout.ts — Architecture Diagram layout engine.
 */

import { measureText } from '../../fonts/metrics.js';

import type {
  ArchitectureDocument,
  ArchitectureMetadata,
  ArchEdge,
  ArchGroup,
  ArchJunction,
  ArchService,
  PortSide,
} from './types.js';
import type { ArchitectureTheme } from './theme.js';
import { resolveArchitectureTheme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

function countIndent(rawLine: string): number {
  let width = 0;
  for (const ch of rawLine) {
    if (ch === ' ') width += 1;
    else if (ch === '\t') width += 2;
    else break;
  }
  return width;
}

function wrapText(text: string, fontSize: number, maxWidth: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureText(candidate, fontSize).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  const remainingStart = lines.length === maxLines - 1
    ? words.slice(lines.join(' ').split(/\s+/).filter(Boolean).length).join(' ')
    : current;
  if (lines.length >= maxLines - 1) {
    if (remainingStart) lines.push(remainingStart);
  } else if (current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

export interface ArchPoint {
  x: number;
  y: number;
}

export interface ArchPlacedService {
  kind: 'service';
  id: string;
  icon: string;
  title: string;
  parentGroup?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
}

export interface ArchPlacedJunction {
  kind: 'junction';
  id: string;
  parentGroup?: string;
  cx: number;
  cy: number;
  r: number;
}

export type ArchPlacedNode = ArchPlacedService | ArchPlacedJunction;

export interface ArchPlacedGroup {
  id: string;
  icon: string;
  title: string;
  parentGroup?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArchPlacedEdge {
  edge: ArchEdge;
  points: ArchPoint[];
}

export interface ArchitectureLayout {
  width: number;
  height: number;
  title?: string;
  nodes: ArchPlacedNode[];
  groups: ArchPlacedGroup[];
  edges: ArchPlacedEdge[];
  metadata: ArchitectureMetadata;
}

interface GridPlacement {
  col: number;
  row: number;
}

interface LeafNodeInfo {
  id: string;
  kind: 'service' | 'junction' | 'group-placeholder';
  parentGroup?: string;
  title?: string;
  icon?: string;
  order: number;
  width: number;
  height: number;
  lines?: string[];
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeServiceMetrics(service: ArchService, tk: ArchitectureTheme): { width: number; height: number; lines: string[] } {
  const lineHeight = tk.serviceTitleFontSize * 1.15;
  const maxTextWidth = Math.max(40, tk.serviceMinWidth - tk.servicePadX * 2);
  const lines = wrapText(service.title, tk.serviceTitleFontSize, maxTextWidth, 3);
  const widest = lines.reduce((max, line) => Math.max(max, measureText(line, tk.serviceTitleFontSize).width), 0);
  const width = Math.max(tk.serviceMinWidth, rhuInt(widest + tk.servicePadX * 2));
  const height = rhuInt(tk.servicePadTop + tk.serviceIconSize + 10 + lines.length * lineHeight + tk.servicePadBottom);
  return { width, height, lines };
}

function relationDelta(edge: ArchEdge): { dc: number; dr: number; axis: 'horizontal' | 'vertical' } {
  if (edge.fromSide === 'R') return { dc: 1, dr: 0, axis: 'horizontal' };
  if (edge.fromSide === 'L') return { dc: -1, dr: 0, axis: 'horizontal' };
  if (edge.fromSide === 'B') return { dc: 0, dr: 1, axis: 'vertical' };
  return { dc: 0, dr: -1, axis: 'vertical' };
}

function boundsFromNode(node: ArchPlacedNode): Bounds {
  if (node.kind === 'service') {
    return { x: node.x, y: node.y, width: node.width, height: node.height };
  }
  return { x: node.cx - node.r, y: node.cy - node.r, width: node.r * 2, height: node.r * 2 };
}

function portPoint(bounds: Bounds, side: PortSide): ArchPoint {
  switch (side) {
    case 'L':
      return { x: bounds.x, y: rhuInt(bounds.y + bounds.height / 2) };
    case 'R':
      return { x: rhuInt(bounds.x + bounds.width), y: rhuInt(bounds.y + bounds.height / 2) };
    case 'T':
      return { x: rhuInt(bounds.x + bounds.width / 2), y: bounds.y };
    case 'B':
    default:
      return { x: rhuInt(bounds.x + bounds.width / 2), y: rhuInt(bounds.y + bounds.height) };
  }
}

function offsetPoint(point: ArchPoint, side: PortSide, distance: number): ArchPoint {
  switch (side) {
    case 'L':
      return { x: point.x - distance, y: point.y };
    case 'R':
      return { x: point.x + distance, y: point.y };
    case 'T':
      return { x: point.x, y: point.y - distance };
    case 'B':
    default:
      return { x: point.x, y: point.y + distance };
  }
}

function compressPoints(points: ArchPoint[]): ArchPoint[] {
  const result: ArchPoint[] = [];
  for (const point of points) {
    const prev = result[result.length - 1];
    if (prev && prev.x === point.x && prev.y === point.y) continue;
    result.push(point);
  }
  return result;
}

function routeOrthogonal(fromBounds: Bounds, toBounds: Bounds, edge: ArchEdge, tk: ArchitectureTheme): ArchPoint[] {
  const start = portPoint(fromBounds, edge.fromSide);
  const end = portPoint(toBounds, edge.toSide);
  const startStub = offsetPoint(start, edge.fromSide, tk.edgeStub);
  const endStub = offsetPoint(end, edge.toSide, tk.edgeStub);

  let middle: ArchPoint[] = [];
  const fromHorizontal = edge.fromSide === 'L' || edge.fromSide === 'R';
  const toHorizontal = edge.toSide === 'L' || edge.toSide === 'R';

  if (fromHorizontal && toHorizontal) {
    const midX = rhuInt((startStub.x + endStub.x) / 2);
    middle = [
      { x: midX, y: startStub.y },
      { x: midX, y: endStub.y },
    ];
  } else if (!fromHorizontal && !toHorizontal) {
    const midY = rhuInt((startStub.y + endStub.y) / 2);
    middle = [
      { x: startStub.x, y: midY },
      { x: endStub.x, y: midY },
    ];
  } else if (fromHorizontal) {
    middle = [{ x: endStub.x, y: startStub.y }];
  } else {
    middle = [{ x: startStub.x, y: endStub.y }];
  }

  return compressPoints([start, startStub, ...middle, endStub, end]);
}

export function layoutArchitecture(doc: ArchitectureDocument, themeOverride?: ArchitectureTheme): ArchitectureLayout {
  const tk = themeOverride ?? resolveArchitectureTheme(doc.metadata.theme);
  const serviceMetrics = new Map<string, { width: number; height: number; lines: string[] }>();
  const groupChildren = new Map<string, string[]>();
  const groupById = new Map(doc.groups.map((group) => [group.id, group]));
  const leafNodes: LeafNodeInfo[] = [];
  const leafNodeIds = new Set<string>();

  const descendantsCache = new Map<string, boolean>();
  const hasDescendants = (groupId: string): boolean => {
    const cached = descendantsCache.get(groupId);
    if (cached !== undefined) return cached;
    const hasDirect = doc.services.some((service) => service.parentGroup === groupId)
      || doc.junctions.some((junction) => junction.parentGroup === groupId)
      || doc.groups.some((group) => group.parentGroup === groupId);
    descendantsCache.set(groupId, hasDirect);
    return hasDirect;
  };

  const registerGroupChild = (parentGroup: string | undefined, childId: string): void => {
    if (!parentGroup) return;
    const children = groupChildren.get(parentGroup) ?? [];
    children.push(childId);
    groupChildren.set(parentGroup, children);
  };

  doc.services.forEach((service, index) => {
    const metrics = computeServiceMetrics(service, tk);
    serviceMetrics.set(service.id, metrics);
    leafNodes.push({
      id: service.id,
      kind: 'service',
      parentGroup: service.parentGroup,
      title: service.title,
      icon: service.icon,
      order: index,
      width: metrics.width,
      height: metrics.height,
      lines: metrics.lines,
    });
    leafNodeIds.add(service.id);
    registerGroupChild(service.parentGroup, service.id);
  });

  const junctionOrderOffset = leafNodes.length;
  doc.junctions.forEach((junction, index) => {
    leafNodes.push({
      id: junction.id,
      kind: 'junction',
      parentGroup: junction.parentGroup,
      order: junctionOrderOffset + index,
      width: tk.junctionRadius * 2,
      height: tk.junctionRadius * 2,
    });
    leafNodeIds.add(junction.id);
    registerGroupChild(junction.parentGroup, junction.id);
  });

  doc.groups.forEach((group) => registerGroupChild(group.parentGroup, group.id));

  const emptyGroupOrderOffset = leafNodes.length;
  doc.groups.forEach((group, index) => {
    if (!hasDescendants(group.id)) {
      leafNodes.push({
        id: group.id,
        kind: 'group-placeholder',
        parentGroup: group.parentGroup,
        title: group.title,
        icon: group.icon,
        order: emptyGroupOrderOffset + index,
        width: tk.serviceMinWidth,
        height: tk.gridCellHeight - 24,
      });
      leafNodeIds.add(group.id);
    }
  });

  const adjacency = new Map<string, Array<{ to: string; dc: number; dr: number; axis: 'horizontal' | 'vertical' }>>();
  const ensureAdjacency = (id: string): void => {
    if (!adjacency.has(id)) adjacency.set(id, []);
  };
  leafNodes.forEach((node) => ensureAdjacency(node.id));
  for (const edge of doc.edges) {
    if (!leafNodeIds.has(edge.fromId) || !leafNodeIds.has(edge.toId)) continue;
    const delta = relationDelta(edge);
    ensureAdjacency(edge.fromId);
    ensureAdjacency(edge.toId);
    adjacency.get(edge.fromId)!.push({ to: edge.toId, ...delta });
    adjacency.get(edge.toId)!.push({ to: edge.fromId, dc: -delta.dc, dr: -delta.dr, axis: delta.axis });
  }

  const placements = new Map<string, GridPlacement>();
  const occupied = new Map<string, string>();
  let nextComponentCol = 0;

  const occupancyKey = (col: number, row: number): string => `${col},${row}`;

  const placedSiblings = (parentGroup: string | undefined): GridPlacement[] => {
    if (!parentGroup) return [];
    const siblings = groupChildren.get(parentGroup) ?? [];
    return siblings
      .map((id) => placements.get(id))
      .filter((placement): placement is GridPlacement => placement !== undefined);
  };

  const findFreeCell = (desiredCol: number, desiredRow: number, axis: 'horizontal' | 'vertical' | 'free'): GridPlacement => {
    const candidates: GridPlacement[] = [];
    if (axis === 'horizontal') {
      for (let offset = 0; offset < 32; offset++) {
        if (offset === 0) candidates.push({ col: desiredCol, row: desiredRow });
        else {
          candidates.push({ col: desiredCol, row: desiredRow + offset });
          candidates.push({ col: desiredCol, row: desiredRow - offset });
        }
      }
    } else if (axis === 'vertical') {
      for (let offset = 0; offset < 32; offset++) {
        if (offset === 0) candidates.push({ col: desiredCol, row: desiredRow });
        else {
          candidates.push({ col: desiredCol + offset, row: desiredRow });
          candidates.push({ col: desiredCol - offset, row: desiredRow });
        }
      }
    } else {
      for (let radius = 0; radius < 32; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const dx = radius - Math.abs(dy);
          candidates.push({ col: desiredCol + dx, row: desiredRow + dy });
          candidates.push({ col: desiredCol - dx, row: desiredRow + dy });
        }
      }
    }

    for (const candidate of candidates) {
      const key = occupancyKey(candidate.col, candidate.row);
      if (!occupied.has(key)) return candidate;
    }
    return { col: desiredCol, row: desiredRow };
  };

  const placeNode = (id: string, desiredCol: number, desiredRow: number, axis: 'horizontal' | 'vertical' | 'free'): GridPlacement => {
    const existing = placements.get(id);
    if (existing) return existing;
    const free = findFreeCell(desiredCol, desiredRow, axis);
    placements.set(id, free);
    occupied.set(occupancyKey(free.col, free.row), id);
    return free;
  };

  const preferredAnchor = (node: LeafNodeInfo): GridPlacement => {
    const siblings = placedSiblings(node.parentGroup);
    if (siblings.length > 0) {
      const maxCol = Math.max(...siblings.map((s) => s.col));
      const avgRow = rhuInt(siblings.reduce((sum, s) => sum + s.row, 0) / siblings.length);
      return { col: maxCol + 1, row: avgRow };
    }
    return { col: nextComponentCol, row: 0 };
  };

  const orderedLeafNodes = [...leafNodes].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  for (const node of orderedLeafNodes) {
    if (placements.has(node.id)) continue;
    const anchor = preferredAnchor(node);
    placeNode(node.id, anchor.col, anchor.row, 'free');
    const queue = [node.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentPlacement = placements.get(currentId)!;
      const edges = adjacency.get(currentId) ?? [];
      for (const relation of edges) {
        if (placements.has(relation.to)) continue;
        const placed = placeNode(
          relation.to,
          currentPlacement.col + relation.dc,
          currentPlacement.row + relation.dr,
          relation.axis,
        );
        queue.push(relation.to);
        nextComponentCol = Math.max(nextComponentCol, placed.col + tk.componentGapCols);
      }
    }
    const componentCols = [...placements.values()].map((placement) => placement.col);
    nextComponentCol = Math.max(nextComponentCol, Math.max(...componentCols, 0) + tk.componentGapCols);
  }

  const minCol = Math.min(...[...placements.values()].map((placement) => placement.col), 0);
  const minRow = Math.min(...[...placements.values()].map((placement) => placement.row), 0);

  const normalized = new Map<string, GridPlacement>();
  for (const [id, placement] of placements.entries()) {
    normalized.set(id, { col: placement.col - minCol, row: placement.row - minRow });
  }

  const placedNodes: ArchPlacedNode[] = [];
  const nodeBounds = new Map<string, Bounds>();
  const placeholderBounds = new Map<string, Bounds>();

  for (const node of orderedLeafNodes) {
    const grid = normalized.get(node.id);
    if (!grid) continue;
    const cellX = tk.marginLeft + grid.col * tk.gridCellWidth;
    const cellY = tk.marginTop + grid.row * tk.gridCellHeight;
    if (node.kind === 'service') {
      const metrics = serviceMetrics.get(node.id)!;
      const x = rhuInt(cellX + (tk.gridCellWidth - metrics.width) / 2);
      const y = rhuInt(cellY + (tk.gridCellHeight - metrics.height) / 2);
      const service = doc.services.find((entry) => entry.id === node.id)!;
      const placed: ArchPlacedService = {
        kind: 'service',
        id: service.id,
        icon: service.icon,
        title: service.title,
        parentGroup: service.parentGroup,
        x,
        y,
        width: metrics.width,
        height: metrics.height,
        lines: metrics.lines,
      };
      placedNodes.push(placed);
      nodeBounds.set(node.id, { x, y, width: metrics.width, height: metrics.height });
    } else if (node.kind === 'junction') {
      const cx = rhuInt(cellX + tk.gridCellWidth / 2);
      const cy = rhuInt(cellY + tk.gridCellHeight / 2);
      const junction = doc.junctions.find((entry) => entry.id === node.id)!;
      const placed: ArchPlacedJunction = {
        kind: 'junction',
        id: junction.id,
        parentGroup: junction.parentGroup,
        cx,
        cy,
        r: tk.junctionRadius,
      };
      placedNodes.push(placed);
      nodeBounds.set(node.id, { x: cx - tk.junctionRadius, y: cy - tk.junctionRadius, width: tk.junctionRadius * 2, height: tk.junctionRadius * 2 });
    } else {
      const width = tk.serviceMinWidth;
      const height = tk.gridCellHeight - 36;
      const x = rhuInt(cellX + (tk.gridCellWidth - width) / 2);
      const y = rhuInt(cellY + (tk.gridCellHeight - height) / 2);
      placeholderBounds.set(node.id, { x, y, width, height });
    }
  }

  const groupCache = new Map<string, ArchPlacedGroup>();

  const computeGroupBox = (group: ArchGroup): ArchPlacedGroup => {
    const cached = groupCache.get(group.id);
    if (cached) return cached;
    const members: Bounds[] = [];

    for (const service of doc.services) {
      if (service.parentGroup === group.id) {
        const bounds = nodeBounds.get(service.id);
        if (bounds) members.push(bounds);
      }
    }
    for (const junction of doc.junctions) {
      if (junction.parentGroup === group.id) {
        const bounds = nodeBounds.get(junction.id);
        if (bounds) members.push(bounds);
      }
    }
    for (const childGroup of doc.groups) {
      if (childGroup.parentGroup === group.id) {
        members.push(computeGroupBox(childGroup));
      }
    }

    const placeholder = placeholderBounds.get(group.id);
    if (members.length === 0 && placeholder) members.push(placeholder);

    const minX = Math.min(...members.map((member) => member.x));
    const minY = Math.min(...members.map((member) => member.y));
    const maxX = Math.max(...members.map((member) => member.x + member.width));
    const maxY = Math.max(...members.map((member) => member.y + member.height));

    const x = rhuInt(minX - tk.groupPaddingX);
    const y = rhuInt(minY - tk.groupPaddingY - tk.groupHeaderHeight);
    const width = rhuInt(maxX - minX + tk.groupPaddingX * 2);
    const height = rhuInt(maxY - minY + tk.groupPaddingY * 2 + tk.groupHeaderHeight);

    const placed: ArchPlacedGroup = {
      id: group.id,
      icon: group.icon,
      title: group.title,
      parentGroup: group.parentGroup,
      x,
      y,
      width,
      height,
    };
    groupCache.set(group.id, placed);
    nodeBounds.set(group.id, placed);
    return placed;
  };

  const groups = doc.groups.map((group) => computeGroupBox(group));
  const edges: ArchPlacedEdge[] = [];
  for (const edge of doc.edges) {
    const fromBounds = nodeBounds.get(edge.fromId);
    const toBounds = nodeBounds.get(edge.toId);
    if (!fromBounds || !toBounds) continue;
    edges.push({ edge, points: routeOrthogonal(fromBounds, toBounds, edge, tk) });
  }

  const titleHeight = doc.metadata.title ? tk.titleFontSize + 18 : 0;
  if (titleHeight > 0) {
    placedNodes.forEach((node) => {
      if (node.kind === 'service') node.y += titleHeight;
      else node.cy += titleHeight;
    });
    groups.forEach((group) => {
      group.y += titleHeight;
    });
    edges.forEach((edge) => {
      edge.points = edge.points.map((point) => ({ x: point.x, y: point.y + titleHeight }));
    });
  }

  const allBounds: Bounds[] = [
    ...placedNodes.map((node) => boundsFromNode(node)),
    ...groups,
  ];
  const maxX = Math.max(...allBounds.map((bound) => bound.x + bound.width), tk.marginLeft + tk.gridCellWidth);
  const maxY = Math.max(...allBounds.map((bound) => bound.y + bound.height), tk.marginTop + tk.gridCellHeight);

  return {
    width: rhuInt(maxX + tk.marginRight),
    height: rhuInt(maxY + tk.marginBottom),
    title: doc.metadata.title,
    nodes: placedNodes,
    groups: groups.sort((a, b) => (a.width * a.height) - (b.width * b.height)),
    edges,
    metadata: doc.metadata,
  };
}
