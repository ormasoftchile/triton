/**
 * Architecture grid placer — unit tests.
 *
 * Verifies the BFS direction-constrained grid placement algorithm:
 *   - canonical 2×2 grid (matches mermaid.live expected positions)
 *   - basic axis-aligned placement
 *   - cycle handling (first-visit wins)
 *   - disconnected components
 *   - no-edge fallback (single row)
 *   - junction nodes (treated identically to services)
 *   - align post-processing (via layout integration)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { directionalGridPlacer, groupAwareDirectionalGridPlacer } from '../src/diagrams/mermaid/architecture/gridPlacer.js';
import type { GridPlacerResult } from '../src/diagrams/mermaid/architecture/gridPlacer.js';
import type { ArchitectureDocument, ArchEdge } from '../src/diagrams/mermaid/architecture/ir.js';
import * as parser from '../src/diagrams/mermaid/architecture/parser.js';
import { layoutArchitecture } from '../src/diagrams/mermaid/architecture/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { Rect, ScenePath, SceneRect } from '../src/contracts/index.js';
import { stripComments } from '../src/frontend/preprocess.js';
import { measureText } from '../src/text/metrics.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function node(id: string) { return { id }; }

function edge(from: string, fromSide: string, to: string, toSide: string) {
  return { from, fromSide, to, toSide };
}

function get(m: Map<string, GridPlacerResult>, id: string): [number, number] {
  const r = m.get(id);
  if (!r) throw new Error(`Node "${id}" not in result`);
  return [r.col, r.row];
}

function parseArchitecture(src: string): ArchitectureDocument {
  return parser.parse(stripComments(src)) as ArchitectureDocument;
}

function archEdge(from: string, fromSide: string, to: string, toSide: string): ArchEdge {
  return {
    from, fromSide, fromGroup: false,
    to, toSide, toGroup: false,
    arrowLeft: false, arrowRight: false,
    style: 'solid',
    startMarker: 'none',
    endMarker: 'none',
  };
}

function archDoc(partial: Partial<ArchitectureDocument>): ArchitectureDocument {
  return {
    metadata: {},
    groups: [],
    services: [],
    junctions: [],
    edges: [],
    aligns: [],
    overlays: [],
    ...partial,
  } as ArchitectureDocument;
}

function cellBounds(cells: GridPlacerResult[]): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  return {
    minCol: Math.min(...cells.map(c => c.col)),
    maxCol: Math.max(...cells.map(c => c.col)),
    minRow: Math.min(...cells.map(c => c.row)),
    maxRow: Math.max(...cells.map(c => c.row)),
  };
}

function cellInsideBounds(cell: GridPlacerResult, b: ReturnType<typeof cellBounds>): boolean {
  return cell.col >= b.minCol && cell.col <= b.maxCol && cell.row >= b.minRow && cell.row <= b.maxRow;
}

function rectContainsRect(a: Rect, b: Rect): boolean {
  return b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
}

function rectIntersectsInterior(a: Rect, b: Rect): boolean {
  return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
}

function cellRectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function unionBounds(rects: readonly Rect[]): Rect {
  const minX = Math.min(...rects.map(r => r.x));
  const minY = Math.min(...rects.map(r => r.y));
  const maxX = Math.max(...rects.map(r => r.x + r.width));
  const maxY = Math.max(...rects.map(r => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function groupsByDepthForTest(ir: ArchitectureDocument) {
  const result: ArchitectureDocument['groups'][number][] = [];
  const added = new Set<string>();
  function add(g: ArchitectureDocument['groups'][number]) {
    if (added.has(g.id)) return;
    if (g.parent) {
      const parent = ir.groups.find(pg => pg.id === g.parent);
      if (parent) add(parent);
    }
    result.push(g);
    added.add(g.id);
  }
  for (const g of ir.groups) add(g);
  return result;
}


const MIN_SERVICE_W = 130;
const MIN_SERVICE_H = 56;
const SERVICE_PAD = 12;
const ICON_LANE_W = 34;
const ICON_SIZE = 24;
const SERVICE_TOP_BAR_H = 8;
const CENTER_ICON_GAP = 8;

function serviceSizeForTest(service: ArchitectureDocument['services'][number]): { width: number; height: number } {
  const align = service.iconAlign ?? 'N';
  const measured = measureText(service.label, defaultTheme.typography.baseFontSize);
  const laneW = align === 'E' || align === 'W' ? ICON_LANE_W : 0;
  return {
    width: Math.ceil(Math.max(MIN_SERVICE_W, laneW + measured.width + SERVICE_PAD * 2)),
    height: align === 'C'
      ? Math.ceil(Math.max(MIN_SERVICE_H, SERVICE_TOP_BAR_H + ICON_SIZE + CENTER_ICON_GAP + measured.height + SERVICE_PAD))
      : MIN_SERVICE_H,
  };
}

function nodeRectsForTest(ir: ArchitectureDocument): Map<string, Rect> {
  const jctW = 16, jctH = 16, colGap = 90, rowGap = 64;
  const margin = defaultTheme.spacing.diagramMargin;
  const titleH = ir.metadata.title ? defaultTheme.typography.titleFontSize + 14 : 0;
  const cells = groupAwareDirectionalGridPlacer(ir);
  const sizes = new Map<string, { width: number; height: number }>();
  for (const service of ir.services) sizes.set(service.id, serviceSizeForTest(service));
  for (const junction of ir.junctions) sizes.set(junction.id, { width: jctW, height: jctH });

  const colWidths = new Map<number, number>();
  const rowHeights = new Map<number, number>();
  for (const [id, cell] of cells) {
    const size = sizes.get(id);
    if (!size) continue;
    colWidths.set(cell.col, Math.max(colWidths.get(cell.col) ?? MIN_SERVICE_W, size.width));
    rowHeights.set(cell.row, Math.max(rowHeights.get(cell.row) ?? MIN_SERVICE_H, size.height));
  }
  const cellList = [...cells.values()];
  const maxCol = Math.max(0, ...cellList.map(c => c.col));
  const maxRow = Math.max(0, ...cellList.map(c => c.row));
  const colX = new Map<number, number>();
  const rowY = new Map<number, number>();
  let x = margin;
  for (let c = 0; c <= maxCol; c++) {
    colX.set(c, x);
    x += (colWidths.get(c) ?? MIN_SERVICE_W) + colGap;
  }
  let y = margin;
  for (let r = 0; r <= maxRow; r++) {
    rowY.set(r, y);
    y += (rowHeights.get(r) ?? MIN_SERVICE_H) + rowGap;
  }

  const nodes = new Map<string, Rect>();
  for (const [id, cell] of cells) {
    const size = sizes.get(id);
    if (size) nodes.set(id, { x: colX.get(cell.col) ?? margin, y: (rowY.get(cell.row) ?? margin) + titleH, width: size.width, height: size.height });
  }
  return nodes;
}

function renderedRects(ir: ArchitectureDocument): { services: Map<string, Rect>; groups: Map<string, Rect> } {
  const scene = layoutArchitecture(ir, defaultTheme).scene;
  const rects = scene.elements.filter((el): el is SceneRect => el.type === 'rect');
  const serviceBoxes = rects
    .filter(r => r.rx === 8 && r.strokeWidth === 1.4)
    .map(r => r.bounds);
  const groupBoxes = rects
    .filter(r => r.rx === 10 && r.strokeWidth === 1.4)
    .map(r => r.bounds);

  const services = new Map<string, Rect>();
  ir.services.forEach((s, i) => services.set(s.id, serviceBoxes[i]!));
  const groups = new Map<string, Rect>();
  groupsByDepthForTest(ir).forEach((g, i) => groups.set(g.id, groupBoxes[i]!));
  return { services, groups };
}

function descendantsOfGroup(ir: ArchitectureDocument, groupId: string): Set<string> {
  const groupById = new Map(ir.groups.map(g => [g.id, g]));
  function ownsGroup(id: string | undefined): boolean {
    while (id) {
      if (id === groupId) return true;
      id = groupById.get(id)?.parent;
    }
    return false;
  }
  return new Set([
    ...ir.services.filter(s => ownsGroup(s.group)).map(s => s.id),
    ...ir.junctions.filter(j => ownsGroup(j.group)).map(j => j.id),
  ]);
}

function layoutRectsForInvariant(ir: ArchitectureDocument): { nodes: Map<string, Rect>; groups: Map<string, Rect> } {
  const nodes = nodeRectsForTest(ir);

  const groups = new Map<string, Rect>();
  function groupRect(gId: string): Rect | undefined {
    if (groups.has(gId)) return groups.get(gId)!;
    const members = [
      ...ir.services.filter(s => s.group === gId).map(s => nodes.get(s.id)).filter((r): r is Rect => !!r),
      ...ir.junctions.filter(j => j.group === gId).map(j => nodes.get(j.id)).filter((r): r is Rect => !!r),
      ...ir.groups.filter(g => g.parent === gId).map(g => groupRect(g.id)).filter((r): r is Rect => !!r),
    ];
    if (members.length === 0) return undefined;
    const u = unionBounds(members);
    const rect = { x: u.x - 20, y: u.y - 34, width: u.width + 40, height: u.height + 54 };
    groups.set(gId, rect);
    return rect;
  }
  for (const g of ir.groups) groupRect(g.id);
  return { nodes, groups };
}

function assertNoForeignNodeInsideGroup(ir: ArchitectureDocument): void {
  const { nodes, groups } = layoutRectsForInvariant(ir);
  for (const g of ir.groups) {
    const gr = groups.get(g.id);
    if (!gr) continue;
    const descendants = descendantsOfGroup(ir, g.id);
    for (const [id, nr] of nodes) {
      if (descendants.has(id)) continue;
      expect(rectContainsRect(gr, nr), `${id} must not be contained by ${g.id}`).toBe(false);
      expect(rectIntersectsInterior(gr, nr), `${id} must not intersect ${g.id}`).toBe(false);
    }
  }
}

function connectorPaths(ir: ArchitectureDocument): ScenePath[] {
  return layoutArchitecture(ir, defaultTheme).scene.elements
    .filter((el): el is ScenePath => el.type === 'path')
    .slice(0, ir.edges.length);
}

function hasAdjacentDuplicatePathPoint(d: string): boolean {
  const points = [...d.matchAll(/[ML]\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    .map(m => `${m[1]},${m[2]}`);
  return points.some((p, i) => i > 0 && p === points[i - 1]);
}

function moveLinePoints(d: string): Array<{ x: number; y: number }> {
  return [...d.matchAll(/[ML]\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    .map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
}

function pathStartPoint(d: string): { x: number; y: number } {
  const m = d.match(/^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`Path has no start point: ${d}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

function pathEndPoint(d: string): { x: number; y: number } {
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
  return { x: nums[nums.length - 2]!, y: nums[nums.length - 1]! };
}

function pathIntersectsRectInterior(points: readonly { x: number; y: number }[], rect: Rect): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    if (segmentIntersectsRectInterior(a, b, rect)) return true;
  }
  return false;
}

function segmentIntersectsRectInterior(a: { x: number; y: number }, b: { x: number; y: number }, rect: Rect): boolean {
  const eps = 1e-6;
  const xmin = rect.x + eps, xmax = rect.x + rect.width - eps;
  const ymin = rect.y + eps, ymax = rect.y + rect.height - eps;
  const dx = b.x - a.x, dy = b.y - a.y;
  let tmin = 0, tmax = 1;
  for (const { p, q } of [
    { p: -dx, q: a.x - xmin },
    { p: dx, q: xmax - a.x },
    { p: -dy, q: a.y - ymin },
    { p: dy, q: ymax - a.y },
  ]) {
    if (Math.abs(p) < 1e-10) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) tmin = Math.max(tmin, t);
      else tmax = Math.min(tmax, t);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

function sampleConnectorPath(d: string): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  let current = { x: 0, y: 0 };
  const commands = [...d.matchAll(/([MLCQ])([^MLCQ]*)/g)];
  for (const [, command, rawArgs] of commands) {
    const nums = [...rawArgs!.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
    if (command === 'M') {
      current = { x: nums[0]!, y: nums[1]! };
      points.push(current);
    } else if (command === 'L') {
      current = { x: nums[0]!, y: nums[1]! };
      points.push(current);
    } else if (command === 'C') {
      const p0 = current;
      const p1 = { x: nums[0]!, y: nums[1]! };
      const p2 = { x: nums[2]!, y: nums[3]! };
      const p3 = { x: nums[4]!, y: nums[5]! };
      for (let i = 1; i <= 64; i++) points.push(sampleCubic(p0, p1, p2, p3, i / 64));
      current = p3;
    } else if (command === 'Q') {
      const p0 = current;
      const p1 = { x: nums[0]!, y: nums[1]! };
      const p2 = { x: nums[2]!, y: nums[3]! };
      for (let i = 1; i <= 32; i++) points.push(sampleQuadratic(p0, p1, p2, i / 32));
      current = p2;
    }
  }
  return points;
}

function sampleCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}

function sampleQuadratic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u*u*p0.x + 2*u*t*p1.x + t*t*p2.x,
    y: u*u*p0.y + 2*u*t*p1.y + t*t*p2.y,
  };
}

// ── Canonical 2×2 grid (mermaid.live validation gate) ─────────────────────────
//
// Diagram fragment:
//   db:L -- R:server
//   disk1:T -- B:server
//   disk2:T -- B:db
//
// Expected (mermaid.live):
//   server (0,0) — top-left
//   db     (1,0) — top-right
//   disk1  (0,1) — bottom-left
//   disk2  (1,1) — bottom-right

describe('canonical 2×2 grid — mermaid.live match', () => {
  const nodes = [node('server'), node('db'), node('disk1'), node('disk2')];
  const edges = [
    edge('db',    'L', 'server', 'R'),
    edge('disk1', 'T', 'server', 'B'),
    edge('disk2', 'T', 'db',    'B'),
  ];

  it('places server at (0,0) — top-left', () => {
    const m = directionalGridPlacer(nodes, edges);
    expect(get(m, 'server')).toEqual([0, 0]);
  });

  it('places db at (1,0) — top-right', () => {
    const m = directionalGridPlacer(nodes, edges);
    expect(get(m, 'db')).toEqual([1, 0]);
  });

  it('places disk1 at (0,1) — bottom-left', () => {
    const m = directionalGridPlacer(nodes, edges);
    expect(get(m, 'disk1')).toEqual([0, 1]);
  });

  it('places disk2 at (1,1) — bottom-right', () => {
    const m = directionalGridPlacer(nodes, edges);
    expect(get(m, 'disk2')).toEqual([1, 1]);
  });
});

// ── Basic axis-aligned placement ─────────────────────────────────────────────

describe('axis-aligned placement', () => {
  it('R:L pair — B is east of A', () => {
    const m = directionalGridPlacer([node('a'), node('b')], [edge('a', 'R', 'b', 'L')]);
    const [ac, ar] = get(m, 'a');
    const [bc, br] = get(m, 'b');
    expect(br).toBe(ar); // same row
    expect(bc).toBe(ac + 1); // b is one column east
  });

  it('L:R pair — B is west of A', () => {
    const m = directionalGridPlacer([node('a'), node('b')], [edge('a', 'L', 'b', 'R')]);
    const [ac, ar] = get(m, 'a');
    const [bc, br] = get(m, 'b');
    expect(br).toBe(ar);
    expect(bc).toBe(ac - 1 - (Math.min(ac, bc) < 0 ? Math.min(ac, bc) : 0));
    // After normalisation, just check relative ordering
    expect(bc).toBeLessThan(ac);
  });

  it('B:T pair — B is south of A (higher row)', () => {
    const m = directionalGridPlacer([node('a'), node('b')], [edge('a', 'B', 'b', 'T')]);
    const [ac, ar] = get(m, 'a');
    const [bc, br] = get(m, 'b');
    expect(bc).toBe(ac); // same col
    expect(br).toBe(ar + 1); // b is one row below
  });

  it('T:B pair — B is north of A (lower row)', () => {
    const m = directionalGridPlacer([node('a'), node('b')], [edge('a', 'T', 'b', 'B')]);
    const [_ac, ar] = get(m, 'a');
    const [_bc, br] = get(m, 'b');
    expect(br).toBeLessThan(ar); // b is above a
  });

  it('normalises to non-negative coordinates', () => {
    const m = directionalGridPlacer([node('a'), node('b')], [edge('a', 'T', 'b', 'B')]);
    for (const [, cell] of m) {
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── 3-node horizontal chain ────────────────────────────────────────────────

describe('3-node horizontal chain A:R--L:B:R--L:C', () => {
  const m = directionalGridPlacer(
    [node('a'), node('b'), node('c')],
    [edge('a', 'R', 'b', 'L'), edge('b', 'R', 'c', 'L')],
  );

  it('all on same row', () => {
    const [, ar] = get(m, 'a');
    const [, br] = get(m, 'b');
    const [, cr] = get(m, 'c');
    expect(ar).toBe(0);
    expect(br).toBe(0);
    expect(cr).toBe(0);
  });

  it('columns are 0, 1, 2 left-to-right', () => {
    const [ac] = get(m, 'a');
    const [bc] = get(m, 'b');
    const [cc] = get(m, 'c');
    expect(ac).toBe(0);
    expect(bc).toBe(1);
    expect(cc).toBe(2);
  });
});

// ── Cycle handling ────────────────────────────────────────────────────────────

describe('cycle handling (3-node cycle)', () => {
  // A:R--L:B, B:R--L:C, C:R--L:A
  const m = directionalGridPlacer(
    [node('a'), node('b'), node('c')],
    [
      edge('a', 'R', 'b', 'L'),
      edge('b', 'R', 'c', 'L'),
      edge('c', 'R', 'a', 'L'),
    ],
  );

  it('all three nodes are placed', () => {
    expect(m.size).toBe(3);
  });

  it('all coordinates are non-negative', () => {
    for (const [, cell] of m) {
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeGreaterThanOrEqual(0);
    }
  });

  it('no two nodes share the same cell', () => {
    const cells = [...m.values()].map(c => `${c.col},${c.row}`);
    expect(new Set(cells).size).toBe(3);
  });
});

// ── Disconnected components ───────────────────────────────────────────────────

describe('disconnected components', () => {
  // A:R--L:B (component 1) and C (isolated)
  const m = directionalGridPlacer(
    [node('a'), node('b'), node('c')],
    [edge('a', 'R', 'b', 'L')],
  );

  it('all three nodes are placed', () => {
    expect(m.size).toBe(3);
  });

  it('isolated node (c) is placed to the right of the first component', () => {
    const [ac] = get(m, 'a');
    const [bc] = get(m, 'b');
    const [cc] = get(m, 'c');
    const compMaxCol = Math.max(ac, bc);
    expect(cc).toBeGreaterThan(compMaxCol);
  });

  it('all coordinates non-negative', () => {
    for (const [, cell] of m) {
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── No edges — single-row fallback ───────────────────────────────────────────

describe('no edges — single row fallback', () => {
  it('places all nodes in one row', () => {
    const m = directionalGridPlacer([node('x'), node('y'), node('z')], []);
    for (const [, cell] of m) expect(cell.row).toBe(0);
  });

  it('places nodes in distinct columns', () => {
    const m = directionalGridPlacer([node('x'), node('y'), node('z')], []);
    const cols = [...m.values()].map(c => c.col);
    expect(new Set(cols).size).toBe(3);
  });
});

// ── Junction nodes treated identically to services ───────────────────────────

describe('junction nodes', () => {
  it('junction participates in BFS placement', () => {
    // service A:R--L:jx (junction):B--T:service B
    const m = directionalGridPlacer(
      [node('a'), node('jx'), node('b')],
      [edge('a', 'R', 'jx', 'L'), edge('jx', 'B', 'b', 'T')],
    );
    const [ac, ar] = get(m, 'a');
    const [jc, jr] = get(m, 'jx');
    const [bc, br] = get(m, 'b');
    expect(jc).toBe(ac + 1);
    expect(jr).toBe(ar);
    expect(bc).toBe(jc);
    expect(br).toBe(jr + 1);
  });
});

// ── Empty input ───────────────────────────────────────────────────────────────

describe('empty input', () => {
  it('returns empty map for no nodes', () => {
    const m = directionalGridPlacer([], []);
    expect(m.size).toBe(0);
  });

  it('returns single entry for a single node', () => {
    const m = directionalGridPlacer([node('solo')], []);
    expect(m.size).toBe(1);
    expect(get(m, 'solo')).toEqual([0, 0]);
  });
});

// ── Lower-case side letters ───────────────────────────────────────────────────

describe('case-insensitive side letters', () => {
  it('accepts lowercase sides (r, l, t, b)', () => {
    const m = directionalGridPlacer(
      [node('a'), node('b')],
      [edge('a', 'r', 'b', 'l')],
    );
    const [ac] = get(m, 'a');
    const [bc] = get(m, 'b');
    expect(bc).toBe(ac + 1); // b is east of a
  });
});

// ── Group-aware clustered placement ──────────────────────────────────────────

describe('group-aware directional cluster placement', () => {
  it('keeps a no-edge group cohesive and excludes an ungrouped service', () => {
    const ir = archDoc({
      groups: [{ id: 'g', label: 'G', icon: 'cloud' }],
      services: [
        { id: 'a', label: 'A', icon: 'server', group: 'g' },
        { id: 'b', label: 'B', icon: 'server', group: 'g' },
        { id: 'c', label: 'C', icon: 'server', group: 'g' },
        { id: 'x', label: 'X', icon: 'server' },
      ],
    });
    const cells = groupAwareDirectionalGridPlacer(ir);
    const group = cellBounds(['a', 'b', 'c'].map(id => cells.get(id)!));
    expect(group.maxRow - group.minRow).toBe(0);
    expect(group.maxCol - group.minCol).toBe(2);
    expect(cellInsideBounds(cells.get('x')!, group)).toBe(false);
  });

  it('collapses a cross-group edge to a cluster-level constraint', () => {
    const ir = archDoc({
      groups: [
        { id: 'A', label: 'A', icon: 'cloud' },
        { id: 'B', label: 'B', icon: 'cloud' },
      ],
      services: [
        { id: 'a1', label: 'A1', icon: 'server', group: 'A' },
        { id: 'a2', label: 'A2', icon: 'server', group: 'A' },
        { id: 'b1', label: 'B1', icon: 'server', group: 'B' },
        { id: 'b2', label: 'B2', icon: 'server', group: 'B' },
      ],
      edges: [archEdge('a1', 'R', 'b1', 'L')],
    });
    const cells = groupAwareDirectionalGridPlacer(ir);
    const aBounds = cellBounds(['a1', 'a2'].map(id => cells.get(id)!));
    const bBounds = cellBounds(['b1', 'b2'].map(id => cells.get(id)!));
    expect(bBounds.minCol).toBeGreaterThan(aBounds.maxCol);
    expect(aBounds.maxRow - aBounds.minRow).toBe(0);
    expect(bBounds.maxRow - bBounds.minRow).toBe(0);
  });

  it('does not scatter group members for conflicting external edges', () => {
    const ir = archDoc({
      groups: [{ id: 'A', label: 'A', icon: 'cloud' }],
      services: [
        { id: 'a1', label: 'A1', icon: 'server', group: 'A' },
        { id: 'a2', label: 'A2', icon: 'server', group: 'A' },
        { id: 'x', label: 'X', icon: 'server' },
        { id: 'y', label: 'Y', icon: 'server' },
      ],
      edges: [archEdge('a1', 'R', 'x', 'L'), archEdge('a2', 'L', 'y', 'R')],
    });
    const cells = groupAwareDirectionalGridPlacer(ir);
    const aBounds = cellBounds(['a1', 'a2'].map(id => cells.get(id)!));
    expect(aBounds.maxCol - aBounds.minCol).toBeLessThanOrEqual(1);
    expect(aBounds.maxRow - aBounds.minRow).toBe(0);
    expect(cellInsideBounds(cells.get('x')!, aBounds)).toBe(false);
    expect(cellInsideBounds(cells.get('y')!, aBounds)).toBe(false);
  });

  it('keeps nested group rectangles contained while excluding direct siblings from the child', () => {
    const ir = archDoc({
      groups: [
        { id: 'outer', label: 'Outer', icon: 'cloud' },
        { id: 'inner', label: 'Inner', icon: 'cloud', parent: 'outer' },
      ],
      services: [
        { id: 'inside', label: 'Inside', icon: 'server', group: 'inner' },
        { id: 'direct', label: 'Direct', icon: 'server', group: 'outer' },
      ],
    });
    const { nodes, groups } = layoutRectsForInvariant(ir);
    expect(rectContainsRect(groups.get('outer')!, groups.get('inner')!)).toBe(true);
    expect(rectContainsRect(groups.get('inner')!, nodes.get('direct')!)).toBe(false);
    expect(rectContainsRect(groups.get('outer')!, nodes.get('direct')!)).toBe(true);
  });

  it('excludes sibling leaves and sibling groups from each group cluster', () => {
    const ir = archDoc({
      groups: [
        { id: 'A', label: 'A', icon: 'cloud' },
        { id: 'B', label: 'B', icon: 'cloud' },
      ],
      services: [
        { id: 'a1', label: 'A1', icon: 'server', group: 'A' },
        { id: 'a2', label: 'A2', icon: 'server', group: 'A' },
        { id: 'b1', label: 'B1', icon: 'server', group: 'B' },
        { id: 'root', label: 'Root', icon: 'server' },
      ],
    });
    const cells = groupAwareDirectionalGridPlacer(ir);
    const aBounds = cellBounds(['a1', 'a2'].map(id => cells.get(id)!));
    const bBounds = cellBounds(['b1'].map(id => cells.get(id)!));
    expect(cellInsideBounds(cells.get('root')!, aBounds)).toBe(false);
    expect(cellRectsOverlap(aBounds.minCol, aBounds.minRow, aBounds.maxCol - aBounds.minCol + 1, aBounds.maxRow - aBounds.minRow + 1, bBounds.minCol, bBounds.minRow, 1, 1)).toBe(false);
  });

  it('keeps cross-boundary align containment-safe', () => {
    const ir = archDoc({
      groups: [{ id: 'platform', label: 'Platform', icon: 'cloud' }],
      services: [
        { id: 'stream', label: 'Stream', icon: 'server', group: 'platform' },
        { id: 'lake', label: 'Lake', icon: 'database', group: 'platform' },
        { id: 'users', label: 'Users', icon: 'internet' },
      ],
      edges: [archEdge('stream', 'B', 'lake', 'T')],
      aligns: [{ axis: 'row', members: ['stream', 'users'] }],
    });
    const { nodes, groups } = layoutRectsForInvariant(ir);
    expect(rectContainsRect(groups.get('platform')!, nodes.get('stream')!)).toBe(true);
    expect(rectContainsRect(groups.get('platform')!, nodes.get('lake')!)).toBe(true);
    expect(rectContainsRect(groups.get('platform')!, nodes.get('users')!)).toBe(false);
    expect(rectIntersectsInterior(groups.get('platform')!, nodes.get('users')!)).toBe(false);
  });

  it('fixes the triton-features platform ballooning repro', () => {
    const ir = parseArchitecture(readFileSync(join(process.cwd(), 'examples/mermaid/architecture/triton-features.mmd'), 'utf8'));
    const { services, groups } = renderedRects(ir);
    const platform = groups.get('platform')!;
    const users = services.get('users')!;
    const members = ['stream', 'lake', 'warehouse'].map(id => services.get(id)!);
    const platformMembers = unionBounds(members);

    expect(rectContainsRect(platform, users)).toBe(false);
    expect(rectIntersectsInterior(platform, users)).toBe(false);
    expect(platform.width).toBeLessThanOrEqual(platformMembers.width + 40 + 1);
    expect(platform.height).toBeLessThanOrEqual(platformMembers.height + 54 + 1);
    for (const nonMember of ['users', 'gateway', 'collector', 'dashboard', 'backup']) {
      expect(rectContainsRect(platform, services.get(nonMember)!)).toBe(false);
    }

    const cells = groupAwareDirectionalGridPlacer(ir);
    const platformCells = ['stream', 'lake', 'warehouse'].map(id => cells.get(id)!);
    const bounds = cellBounds(platformCells);
    expect(bounds.maxCol - bounds.minCol).toBeLessThanOrEqual(1);
    expect(bounds.maxRow - bounds.minRow).toBeLessThanOrEqual(1);
    for (const [id, cell] of cells) {
      if (!['stream', 'lake', 'warehouse'].includes(id)) {
        expect(cellInsideBounds(cell, bounds)).toBe(false);
      }
    }
    expect(cells.get('stream')!.row).toBeLessThan(cells.get('lake')!.row);
    expect(cells.get('warehouse')!.col).toBeGreaterThan(cells.get('lake')!.col);
  });

  it('keeps nested-groups child group rectangles disjoint', () => {
    const ir = parseArchitecture(readFileSync(join(process.cwd(), 'examples/mermaid/architecture/nested-groups.mmd'), 'utf8'));
    const { groups } = renderedRects(ir);
    const backend = groups.get('backend')!;
    const data = groups.get('data')!;
    expect(rectIntersectsInterior(backend, data)).toBe(false);
  });

  it('does not emit adjacent duplicate points on triton-features connector paths', () => {
    const ir = parseArchitecture(readFileSync(join(process.cwd(), 'examples/mermaid/architecture/triton-features.mmd'), 'utf8'));
    for (const path of connectorPaths(ir)) {
      if (path.d.includes(' C ')) continue;
      expect(hasAdjacentDuplicatePathPoint(path.d), path.d).toBe(false);
    }
  });

  it('honors wall hints while fanning real multi-connector triton-features walls', () => {
    const ir = parseArchitecture(readFileSync(join(process.cwd(), 'examples/mermaid/architecture/triton-features.mmd'), 'utf8'));
    const { services } = renderedRects(ir);
    const paths = connectorPaths(ir);
    const dashboard = services.get('dashboard')!;
    const gateway = services.get('gateway')!;
    const stream = services.get('stream')!;
    const lake = services.get('lake')!;
    const warehouse = services.get('warehouse')!;
    const usersToGateway = ir.edges.findIndex(e => e.from === 'users' && e.to === 'gateway');
    const collectorToStream = ir.edges.findIndex(e => e.from === 'collector' && e.to === 'stream');
    const streamToLake = ir.edges.findIndex(e => e.from === 'stream' && e.to === 'lake');
    const lakeToWarehouse = ir.edges.findIndex(e => e.from === 'lake' && e.to === 'warehouse');
    const warehouseToDashboard = ir.edges.findIndex(e => e.from === 'warehouse' && e.to === 'dashboard');
    const dashboardToGateway = ir.edges.findIndex(e => e.from === 'dashboard' && e.to === 'gateway');

    const usersGatewayEnd = pathEndPoint(paths[usersToGateway]!.d);
    const dashboardGatewayStart = pathStartPoint(paths[dashboardToGateway]!.d);
    const dashboardGatewayEnd = pathEndPoint(paths[dashboardToGateway]!.d);
    expect(usersGatewayEnd.x).toBeCloseTo(gateway.x, 6);
    expect(dashboardGatewayEnd.x).toBeCloseTo(gateway.x, 6);
    expect(Math.abs(usersGatewayEnd.y - dashboardGatewayEnd.y)).toBeGreaterThan(10);
    expect((dashboardGatewayEnd.y - gateway.y) / gateway.height).toBeGreaterThan(0.30);
    expect((dashboardGatewayEnd.y - gateway.y) / gateway.height).toBeLessThan(0.40);
    expect((usersGatewayEnd.y - gateway.y) / gateway.height).toBeGreaterThan(0.60);
    expect((usersGatewayEnd.y - gateway.y) / gateway.height).toBeLessThan(0.70);

    const collectorStreamEnd = pathEndPoint(paths[collectorToStream]!.d);
    const streamLakeStart = pathStartPoint(paths[streamToLake]!.d);
    expect(collectorStreamEnd.x).toBeCloseTo(stream.x, 6);
    expect(collectorStreamEnd.y).toBeCloseTo(stream.y + stream.height / 2, 6);
    expect(streamLakeStart.x).toBeCloseTo(stream.x + stream.width / 2, 6);
    expect(streamLakeStart.y).toBeCloseTo(stream.y + stream.height, 6);

    expect(dashboardGatewayStart.x).toBeCloseTo(dashboard.x + dashboard.width / 2, 6);
    expect(dashboardGatewayStart.y).toBeCloseTo(dashboard.y + dashboard.height, 6);

    const lakeWarehouseStart = pathStartPoint(paths[lakeToWarehouse]!.d);
    const lakeWarehouseEnd = pathEndPoint(paths[lakeToWarehouse]!.d);
    expect(lakeWarehouseStart.x).toBeCloseTo(lake.x + lake.width, 6);
    expect(lakeWarehouseStart.y).toBeCloseTo(lake.y + lake.height / 2, 6);
    expect(lakeWarehouseEnd.x).toBeCloseTo(warehouse.x, 6);
    expect(lakeWarehouseEnd.y).toBeCloseTo(warehouse.y + warehouse.height / 2, 6);

    const warehouseDashboardStart = pathStartPoint(paths[warehouseToDashboard]!.d);
    const warehouseDashboardEnd = pathEndPoint(paths[warehouseToDashboard]!.d);
    expect(warehouseDashboardStart.x).toBeCloseTo(warehouse.x + warehouse.width / 2, 6);
    expect(warehouseDashboardEnd.x).toBeCloseTo(dashboard.x + dashboard.width, 6);
  });

  it('routes the architecture client-to-api edge outside unrelated node interiors', () => {
    const ir = parseArchitecture(readFileSync(join(process.cwd(), 'examples/mermaid/architecture/architecture.mmd'), 'utf8'));
    const { services } = renderedRects(ir);
    const points = moveLinePoints(connectorPaths(ir)[0]!.d);
    for (const id of ['client', 'storage']) {
      expect(pathIntersectsRectInterior(points, services.get(id)!), id).toBe(false);
    }
  });

  it('places architecture.mmd mixed-side external client compactly beside storage', () => {
    const ir = parseArchitecture(readFileSync(join(process.cwd(), 'examples/mermaid/architecture/architecture.mmd'), 'utf8'));
    const cells = groupAwareDirectionalGridPlacer(ir);
    expect(get(cells, 'api')).toEqual([1, 0]);
    expect(get(cells, 'db')).toEqual([2, 0]);
    expect(get(cells, 'storage')).toEqual([1, 2]);
    expect(get(cells, 'client')).toEqual([0, 2]);
    expect(cells.get('client')!.row).toBe(cells.get('storage')!.row);
    expect(Math.abs(cells.get('client')!.col - cells.get('storage')!.col)).toBe(1);
    expect(cells.get('storage')!.col).toBe(cells.get('api')!.col);
    expect(cells.get('client')!.col).toBe(cells.get('api')!.col - 1);

    const group = cellBounds(['api', 'db'].map(id => cells.get(id)!));
    const occupied = new Set<string>();
    for (const id of ['api', 'db', 'storage', 'client']) {
      const cell = cells.get(id)!;
      expect(occupied.has(`${cell.col},${cell.row}`), id).toBe(false);
      occupied.add(`${cell.col},${cell.row}`);
    }
    for (const id of ['storage', 'client']) {
      expect(cellInsideBounds(cells.get(id)!, group), id).toBe(false);
    }
  });

  it('keeps mixed-side L→T external placement compact against a two-wide group', () => {
    const ir = archDoc({
      groups: [{ id: 'G', label: 'G', icon: 'cloud' }],
      services: [
        { id: 'a', label: 'A', icon: 'server', group: 'G' },
        { id: 'b', label: 'B', icon: 'server', group: 'G' },
        { id: 'x', label: 'X', icon: 'server' },
      ],
      edges: [
        archEdge('a', 'R', 'b', 'L'),
        archEdge('x', 'L', 'a', 'T'),
      ],
    });
    const cells = groupAwareDirectionalGridPlacer(ir);
    const group = cellBounds(['a', 'b'].map(id => cells.get(id)!));
    expect(group.maxCol - group.minCol).toBe(1);
    expect(cells.get('x')!.col).toBe(group.maxCol);
    expect(cells.get('x')!.row).toBeLessThan(group.minRow);
    expect(cellInsideBounds(cells.get('x')!, group)).toBe(false);
  });

  it('routes every architecture example edge outside non-endpoint node interiors', () => {
    const dir = join(process.cwd(), 'examples/mermaid/architecture');
    for (const file of ['architecture.mmd', 'arrows.mmd', 'align-grid.mmd', 'group-edges.mmd', 'junctions.mmd', 'nested-groups.mmd', 'triton-features.mmd']) {
      const ir = parseArchitecture(readFileSync(join(dir, file), 'utf8'));
      const { nodes: invariantNodes } = layoutRectsForInvariant(ir);
      const { services } = renderedRects(ir);
      const nodes = new Map<string, Rect>([
        ...services,
        ...ir.junctions.map(j => [j.id, invariantNodes.get(j.id)!] as [string, Rect]),
      ]);
      const paths = connectorPaths(ir);
      ir.edges.forEach((edge, i) => {
        const points = sampleConnectorPath(paths[i]!.d);
        for (const [id, rect] of nodes) {
          if (id === edge.from || id === edge.to) continue;
          expect(pathIntersectsRectInterior(points, rect), `${file} edge ${edge.from}->${edge.to} crosses ${id}: ${paths[i]!.d}`).toBe(false);
        }
      });
    }
  });

  it('keeps foreign nodes outside every architecture example group', () => {
    const dir = join(process.cwd(), 'examples/mermaid/architecture');
    for (const file of ['architecture.mmd', 'arrows.mmd', 'align-grid.mmd', 'group-edges.mmd', 'junctions.mmd', 'nested-groups.mmd', 'triton-features.mmd']) {
      const ir = parseArchitecture(readFileSync(join(dir, file), 'utf8'));
      assertNoForeignNodeInsideGroup(ir);
    }
  });
});
