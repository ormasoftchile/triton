/**
 * @file diagrams/architecture/gridPlacer.ts — Directional grid placement for
 * architecture-beta diagrams.
 *
 * Implements BFS-based constraint-propagation as per Mermaid's architectureDb.ts
 * (packages/mermaid/src/diagrams/architecture/architectureDb.ts:217–275).
 *
 * Side annotations on edges are PLACEMENT constraints, not just port hints:
 *   db:L -- R:server  →  server is one column WEST of db
 *   disk1:T -- B:svc  →  disk1 is one row SOUTH of svc
 *
 * The BFS produces integer (col, row) coordinates (0-indexed, left-to-right,
 * top-to-bottom). Callers scale to pixels.
 */

export interface GridPlacerResult {
  /** Grid column (0-indexed, left-to-right). */
  readonly col: number;
  /** Grid row (0-indexed, top-to-bottom). */
  readonly row: number;
}

// ─── Direction-pair delta table ───────────────────────────────────────────────
//
// For each direction pair (fromSide + toSide), this gives (Δcol, Δrow) to
// apply to the CURRENT node's position to get the NEIGHBOR node's position.
//
// Derivation:
//   L side → neighbor is west  (Δcol = -1)
//   R side → neighbor is east  (Δcol = +1)
//   T side → neighbor is north (Δrow = -1)  [rows increase downward]
//   B side → neighbor is south (Δrow = +1)
//
// Axis-aligned pairs combine the from-side's offset:
//   RL: (+1, 0)  — curr's right exits east, neighbor is east
//   LR: (-1, 0)  — curr's left exits west, neighbor is west
//   BT: (0, +1)  — curr's bottom exits south, neighbor is south
//   TB: (0, -1)  — curr's top exits north, neighbor is north
//
// Diagonal pairs combine both axes independently:
//   LT: (-1, -1)  RT: (+1, -1)  LB: (-1, +1)  RB: (+1, +1)
//   TL: (-1, -1)  TR: (+1, -1)  BL: (-1, +1)  BR: (+1, +1)
//
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

// ─── Public API ───────────────────────────────────────────────────────────────

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
