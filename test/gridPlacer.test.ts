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

import { describe, it, expect } from 'vitest';
import { directionalGridPlacer } from '../src/diagrams/mermaid/architecture/gridPlacer.js';
import type { GridPlacerResult } from '../src/diagrams/mermaid/architecture/gridPlacer.js';

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
