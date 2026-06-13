/**
 * @file test/schema-validation.test.ts — Hardened schema validation tests.
 *
 * Covers every new invariant enforced by Mark's validation-hardening pass
 * (2026-06-13). For each grammar + composition + axis_breaks:
 *   - one VALID instance that must pass
 *   - representative INVALID instances that must be rejected with targeted messages
 *
 * Does NOT re-test layout, rendering, or golden image output.
 */

import { describe, expect, it } from 'vitest';

import { sequenceDocumentSchema } from '../src/grammars/sequence/schema.js';
import { treeDocumentSchema }     from '../src/grammars/tree/schema.js';
import { flowDocumentSchema }     from '../src/grammars/flow/schema.js';
import { compositionDocumentSchema } from '../src/composition/schema.js';
import { irDocumentSchema }       from '../src/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errors(result: ReturnType<(typeof sequenceDocumentSchema)['safeParse']>): string {
  if (result.success) return '';
  return JSON.stringify(result.error.issues.map((i) => i.message));
}

// ---------------------------------------------------------------------------
// SEQUENCE
// ---------------------------------------------------------------------------

describe('Sequence schema — hardened invariants', () => {

  // ── Valid baseline ────────────────────────────────────────────────────────

  it('accepts a minimal valid sequence (no activations, no fragments)', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'ping', order: 1 },
          { from: 'b', to: 'a', label: 'pong', order: 2, kind: 'reply' },
        ],
      },
    };
    expect(() => sequenceDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a valid sequence with activations and fragment within range', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'client', label: 'Client' },
          { id: 'server', label: 'Server' },
        ],
        messages: [
          { from: 'client', to: 'server', label: 'req', order: 1 },
          { from: 'server', to: 'client', label: 'ok', order: 2, kind: 'reply' },
        ],
        activations: [{ participant: 'server', from_order: 1, to_order: 2 }],
        fragments: [
          { kind: 'opt', label: '[optional]', from_order: 1, to_order: 2 },
        ],
      },
    };
    expect(() => sequenceDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a valid alt fragment with sorted sections within bounds', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'req', order: 1 },
          { from: 'b', to: 'a', label: 'ok', order: 2, kind: 'reply' },
          { from: 'b', to: 'a', label: 'err', order: 3, kind: 'reply' },
        ],
        fragments: [
          {
            kind: 'alt',
            label: '[alt]',
            from_order: 2,
            to_order: 3,
            sections: [
              { guard: '[ok]',  fromOrder: 2, toOrder: 2 },
              { guard: '[err]', fromOrder: 3, toOrder: 3 },
            ],
          },
        ],
      },
    };
    expect(() => sequenceDocumentSchema.parse(doc)).not.toThrow();
  });

  // ── Duplicate participant ids ─────────────────────────────────────────────

  it('rejects duplicate participant ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'A2' },
        ],
        messages: [{ from: 'a', to: 'a', label: 'self', order: 1 }],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("Duplicate participant id: 'a'");
  });

  // ── Duplicate message orders ──────────────────────────────────────────────

  it('rejects duplicate message orders', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'first',  order: 1 },
          { from: 'b', to: 'a', label: 'second', order: 1 },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('Duplicate message order: 1');
  });

  // ── Unknown participant refs ──────────────────────────────────────────────

  it('rejects a message referencing an unknown from participant', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'a', label: 'A' }],
        messages: [{ from: 'ghost', to: 'a', label: 'ping', order: 1 }],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("unknown participant id 'ghost'");
  });

  // ── Activation bounds within message range ────────────────────────────────

  it('rejects an activation whose from_order is below the minimum message order', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'req', order: 3 },
          { from: 'b', to: 'a', label: 'ok',  order: 5, kind: 'reply' },
        ],
        activations: [{ participant: 'b', from_order: 1, to_order: 5 }],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('below the minimum message order (3)');
  });

  it('rejects an activation whose to_order is above the maximum message order', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'req', order: 1 },
          { from: 'b', to: 'a', label: 'ok',  order: 2, kind: 'reply' },
        ],
        activations: [{ participant: 'b', from_order: 1, to_order: 99 }],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('above the maximum message order (2)');
  });

  // ── Fragment bounds within message range ──────────────────────────────────

  it('rejects a fragment whose from_order is below the minimum message order', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        messages: [
          { from: 'a', to: 'b', label: 'req', order: 5 },
          { from: 'b', to: 'a', label: 'ok',  order: 6, kind: 'reply' },
        ],
        fragments: [
          { kind: 'loop', label: '[loop]', from_order: 1, to_order: 6 },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('below the minimum message order (5)');
  });

  it('rejects a fragment whose to_order is above the maximum message order', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        messages: [
          { from: 'a', to: 'b', label: 'req', order: 1 },
          { from: 'b', to: 'a', label: 'ok',  order: 2, kind: 'reply' },
        ],
        fragments: [
          { kind: 'loop', label: '[loop]', from_order: 1, to_order: 10 },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('above the maximum message order (2)');
  });

  // ── Fragment sections invariants ──────────────────────────────────────────

  it('rejects a section whose fromOrder > toOrder', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        messages: [
          { from: 'a', to: 'b', label: 'r', order: 1 },
          { from: 'b', to: 'a', label: 'ok', order: 2, kind: 'reply' },
        ],
        fragments: [
          {
            kind: 'alt',
            label: '[alt]',
            from_order: 1,
            to_order: 2,
            sections: [{ guard: '[x]', fromOrder: 2, toOrder: 1 }],
          },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('fromOrder must be ≤ toOrder');
  });

  it('rejects a section whose fromOrder is below the fragment from_order', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        messages: [
          { from: 'a', to: 'b', label: 'r', order: 1 },
          { from: 'b', to: 'a', label: 'ok', order: 3, kind: 'reply' },
        ],
        fragments: [
          {
            kind: 'alt',
            label: '[alt]',
            from_order: 2,
            to_order: 3,
            sections: [{ guard: '[x]', fromOrder: 1, toOrder: 2 }],
          },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('section[0] fromOrder (1) is below fragment from_order (2)');
  });

  it('rejects a section whose toOrder is above the fragment to_order', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        messages: [
          { from: 'a', to: 'b', label: 'r', order: 1 },
          { from: 'b', to: 'a', label: 'ok', order: 2, kind: 'reply' },
          { from: 'b', to: 'a', label: 'x', order: 3, kind: 'reply' },
        ],
        fragments: [
          {
            kind: 'alt',
            label: '[alt]',
            from_order: 1,
            to_order: 2,
            sections: [{ guard: '[x]', fromOrder: 1, toOrder: 3 }],
          },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('section[0] toOrder (3) is above fragment to_order (2)');
  });

  it('rejects sections that are not sorted by fromOrder', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        messages: [
          { from: 'a', to: 'b', label: 'r', order: 1 },
          { from: 'b', to: 'a', label: 's1', order: 2, kind: 'reply' },
          { from: 'b', to: 'a', label: 's2', order: 3, kind: 'reply' },
        ],
        fragments: [
          {
            kind: 'alt',
            label: '[alt]',
            from_order: 1,
            to_order: 3,
            sections: [
              { guard: '[b]', fromOrder: 3, toOrder: 3 },
              { guard: '[a]', fromOrder: 1, toOrder: 2 },
            ],
          },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('sections must be sorted by fromOrder');
  });
});

// ---------------------------------------------------------------------------
// TREE
// ---------------------------------------------------------------------------

describe('Tree schema — hardened invariants', () => {

  // ── Valid baseline ────────────────────────────────────────────────────────

  it('accepts a valid single-node tree', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: { root: { id: 'root', label: 'Root' } },
    };
    expect(() => treeDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a valid nested tree with globally-unique ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: {
        root: {
          id: 'root',
          label: 'Root',
          children: [
            { id: 'child-a', label: 'A' },
            { id: 'child-b', label: 'B', children: [{ id: 'leaf-b1', label: 'B1' }] },
          ],
        },
      },
    };
    expect(() => treeDocumentSchema.parse(doc)).not.toThrow();
  });

  // ── Missing root ──────────────────────────────────────────────────────────

  it('rejects a tree with missing root — clear message', () => {
    const doc = { version: '1.0', metadata: {}, tree: {} };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it('rejects a root node with an empty label', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: { root: { id: 'root', label: '' } },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('must not be empty');
  });

  // ── Globally-unique node ids ──────────────────────────────────────────────

  it('rejects globally-duplicate node ids across nesting levels', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: {
        root: {
          id: 'root',
          label: 'Root',
          children: [
            { id: 'dup', label: 'First' },
            { id: 'dup', label: 'Second' },
          ],
        },
      },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("Duplicate node id 'dup'");
  });

  it('rejects a duplicate id deep in the tree', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: {
        root: {
          id: 'root',
          label: 'Root',
          children: [
            {
              id: 'mid',
              label: 'Mid',
              children: [{ id: 'root', label: 'Sneaky' }],
            },
          ],
        },
      },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("Duplicate node id 'root'");
  });

  it('rejects a non-kebab-case node id', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: { root: { id: 'Root_Node', label: 'Root' } },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FLOW
// ---------------------------------------------------------------------------

describe('Flow schema — hardened invariants', () => {

  // ── Valid baseline ────────────────────────────────────────────────────────

  it('accepts a minimal valid flow (two nodes, one edge)', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        edges: [{ from: 'a', to: 'b', label: 'link' }],
      },
    };
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a self-loop (from == to) — cycles are legal', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'loop', label: 'Loop' }],
        edges: [{ from: 'loop', to: 'loop', label: 'self' }],
      },
    };
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts edges with unique ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        edges: [
          { id: 'e1', from: 'a', to: 'b' },
          { id: 'e2', from: 'b', to: 'a' },
        ],
      },
    };
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  // ── Duplicate node ids ────────────────────────────────────────────────────

  it('rejects duplicate node ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'dup', label: 'First' },
          { id: 'dup', label: 'Second' },
        ],
        edges: [],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("Duplicate node id: 'dup'");
  });

  // ── Duplicate edge ids ────────────────────────────────────────────────────

  it('rejects duplicate edge ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        edges: [
          { id: 'edge-1', from: 'a', to: 'b' },
          { id: 'edge-1', from: 'b', to: 'c' },
        ],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("Duplicate edge id: 'edge-1'");
  });

  it('allows edges without ids alongside edges with ids (mixed)', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        edges: [
          { id: 'edge-1', from: 'a', to: 'b' },
          { from: 'b', to: 'c' },          // no id — fine
        ],
      },
    };
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  // ── Unknown edge refs ─────────────────────────────────────────────────────

  it('rejects an edge referencing an unknown source node', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'a', label: 'A' }],
        edges: [{ from: 'ghost', to: 'a' }],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("unknown node id 'ghost'");
  });

  it('rejects an edge referencing an unknown target node', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'a', label: 'A' }],
        edges: [{ from: 'a', to: 'ghost' }],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("unknown node id 'ghost'");
  });
});

// ---------------------------------------------------------------------------
// COMPOSITION
// ---------------------------------------------------------------------------

describe('Composition schema — hardened invariants', () => {

  /** Minimal stat cell helper */
  function statCell(id: string, col: number, row: number) {
    return { id, col, row, content: { kind: 'stat' as const, value: '42', label: 'items' } };
  }

  // ── Valid baseline ────────────────────────────────────────────────────────

  it('accepts a valid 1×1 grid with one stat cell', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 1, rows: 1 },
      cells: [statCell('c1', 0, 0)],
    };
    expect(() => compositionDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a 2×2 grid with four cells', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 2, rows: 2 },
      cells: [
        statCell('c1', 0, 0),
        statCell('c2', 1, 0),
        statCell('c3', 0, 1),
        statCell('c4', 1, 1),
      ],
    };
    expect(() => compositionDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a cell spanning two columns', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 2, rows: 1 },
      cells: [{ ...statCell('wide', 0, 0), colSpan: 2 }],
    };
    expect(() => compositionDocumentSchema.parse(doc)).not.toThrow();
  });

  // ── Duplicate cell ids ────────────────────────────────────────────────────

  it('rejects duplicate cell ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 2 },
      cells: [statCell('dup', 0, 0), statCell('dup', 1, 0)],
    };
    const result = compositionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain("Duplicate cell id: 'dup'");
  });

  // ── Column overflow ───────────────────────────────────────────────────────

  it('rejects a cell whose col + colSpan exceeds grid.columns', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 2 },
      cells: [{ ...statCell('c1', 0, 0), colSpan: 3 }],
    };
    const result = compositionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('exceeds grid.columns(2)');
  });

  // ── Row overflow (when grid.rows declared) ────────────────────────────────

  it('rejects a cell whose row + rowSpan exceeds declared grid.rows', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 1, rows: 1 },
      cells: [{ ...statCell('c1', 0, 0), rowSpan: 2 }],
    };
    const result = compositionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('exceeds grid.rows(1)');
  });

  it('allows row + rowSpan to exceed implied rows when grid.rows is not declared', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 1 },  // no rows declared
      cells: [{ ...statCell('c1', 0, 0), rowSpan: 5 }],
    };
    expect(() => compositionDocumentSchema.parse(doc)).not.toThrow();
  });

  // ── Cell overlap ──────────────────────────────────────────────────────────

  it('rejects two cells that overlap on the same grid slot', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      grid: { columns: 2 },
      cells: [
        { ...statCell('c1', 0, 0), colSpan: 2 },   // occupies (0,0) and (0,1)
        statCell('c2', 1, 0),                        // also occupies (0,1)
      ],
    };
    const result = compositionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(errors(result)).toContain('overlaps');
  });
});

// ---------------------------------------------------------------------------
// axis_breaks (timeline schema)
// ---------------------------------------------------------------------------

describe('Timeline schema — axis_breaks hardened invariants', () => {

  /** Minimal valid timeline doc factory */
  function makeTimeline(overrides: Record<string, unknown> = {}) {
    return {
      version: '1.0',
      metadata: {
        title: 'Test',
        time_range: { start: '2026-01-01', end: '2026-12-31' },
        ...overrides,
      },
      tracks: [{ id: 'main', label: 'Main' }],
      activities: [],
    };
  }

  // ── Valid instances ───────────────────────────────────────────────────────

  it('accepts a timeline without axis_breaks', () => {
    const doc = makeTimeline();
    expect(() => irDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a timeline with one valid axis_break (from < to, within range)', () => {
    const doc = makeTimeline({
      axis_breaks: [{ from: '2026-03-01', to: '2026-06-01' }],
    });
    expect(() => irDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts multiple non-overlapping breaks in any authored order (sort-tolerant)', () => {
    const doc = makeTimeline({
      axis_breaks: [
        { from: '2026-09-01', to: '2026-10-01' },
        { from: '2026-03-01', to: '2026-04-01' },
      ],
    });
    expect(() => irDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts breaks using quarter notation (comparable format)', () => {
    const doc = makeTimeline({
      time_range: { start: '2026-Q1', end: '2026-Q4' },
      axis_breaks: [{ from: '2026-Q2', to: '2026-Q3' }],
    });
    expect(() => irDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts breaks with symbolic dates (non-comparable → skip bounds check)', () => {
    // 'tbd' is non-comparable — validation skips bounds check for that break
    const doc = makeTimeline({
      axis_breaks: [{ from: 'tbd', to: 'tbd' }],
    });
    expect(() => irDocumentSchema.parse(doc)).not.toThrow();
  });

  // ── from < to ─────────────────────────────────────────────────────────────

  it('rejects a break where from == to', () => {
    const doc = makeTimeline({
      axis_breaks: [{ from: '2026-06-01', to: '2026-06-01' }],
    });
    const result = irDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("must be strictly before");
  });

  it('rejects a break where from is after to', () => {
    const doc = makeTimeline({
      axis_breaks: [{ from: '2026-09-01', to: '2026-06-01' }],
    });
    const result = irDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("must be strictly before");
  });

  // ── Bounds within time_range ──────────────────────────────────────────────

  it('rejects a break whose from is before time_range.start', () => {
    const doc = makeTimeline({
      axis_breaks: [{ from: '2025-06-01', to: '2025-09-01' }],
    });
    const result = irDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("before time_range.start");
  });

  it('rejects a break whose to is after time_range.end', () => {
    const doc = makeTimeline({
      axis_breaks: [{ from: '2026-11-01', to: '2027-03-01' }],
    });
    const result = irDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("after time_range.end");
  });

  // ── Non-overlapping ───────────────────────────────────────────────────────

  it('rejects two breaks that overlap', () => {
    const doc = makeTimeline({
      axis_breaks: [
        { from: '2026-03-01', to: '2026-07-01' },
        { from: '2026-06-01', to: '2026-09-01' },
      ],
    });
    const result = irDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain('overlap');
  });

  it('rejects overlapping breaks regardless of authored order', () => {
    const doc = makeTimeline({
      // authored in reverse order — sort-tolerant detection
      axis_breaks: [
        { from: '2026-06-01', to: '2026-09-01' },
        { from: '2026-03-01', to: '2026-07-01' },
      ],
    });
    const result = irDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain('overlap');
  });

  // ── Existing gallery fixture still validates ──────────────────────────────

  it('timeline-goals fixture with axis_breaks still validates', () => {
    // Reproduces the axis_breaks from timeline-goals.timeline.yaml:
    //   time_range: start: 2025-11-01, end: 2026-11-30
    //   axis_breaks: [{ from: 2026-01-15, to: 2026-04-01 }]
    const doc = {
      version: '1.0',
      metadata: {
        title: 'Timeline & Goals',
        time_range: { start: '2025-11-01', end: '2026-11-30' },
        axis_unit: 'quarter',
        theme: 'roadmap',
        layout: 'roadmap',
        axis_breaks: [{ from: '2026-01-15', to: '2026-04-01' }],
      },
      tracks: [
        { id: 'phases', label: 'Phases', index: 0 },
        { id: 'markers', label: 'Milestones', index: 1 },
      ],
      activities: [],
    };
    expect(() => irDocumentSchema.parse(doc)).not.toThrow();
  });
});
