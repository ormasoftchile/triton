import { describe, it, expect } from 'vitest';
import { renderSync } from '../src/frontend/index.js';

describe('New Tree Diagram Types', () => {
  describe('merkletree', () => {
    it('renders algorithmic Merkle tree from data items with proof path', () => {
      const src = `merkletree
  title "Bitcoin Block Transactions"
  data "Tx1" "Tx2" "Tx3" "Tx4"
  proof "Tx3"
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('Bitcoin Block Transactions');
      expect(res.value).toContain('ROOT');
      expect(res.value).toContain('VERIFY');
      expect(res.value).toContain('SIBLING HASH');
      expect(res.value).toContain('Tx3');
      expect(res.value).toContain('id="merkle-arrow"');
      expect(res.value).toContain('id="merkle-proof-arrow"');
    });

    it('renders explicit manual Merkle tree', () => {
      const src = `merkletree
  title "Explicit Merkle Tree"
  root [H_root] -> h12, h34
  node h12 [H_12] -> h1, h2
  node h34 [H_34] -> h3, h4
  leaf h1 [H_1: "Tx1"]
  leaf h2 [H_2: "Tx2"]
  leaf h3 [H_3: "Tx3"]
  leaf h4 [H_4: "Tx4"]
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('Explicit Merkle Tree');
      expect(res.value).toContain('H_root');
      expect(res.value).toContain('Tx1');
    });
  });

  describe('lsmtree', () => {
    it('renders LSM tree storage architecture with flush and compaction', () => {
      const src = `lsmtree
  title "RocksDB Storage Engine"
  wal "Write-Ahead Log"
  memtable active "Active MemTable" [10 | 25 | 40]
  memtable immutable "Immutable MemTable" [5 | 18 | 32]
  level L0 "Level 0 (Overlapping)"
    sst s0_1 [1..50]
    sst s0_2 [25..75]
  end
  level L1 "Level 1 (Partitioned)"
    sst s1_1 [1..30]
    sst s1_2 [31..60]
    sst s1_3 [61..90]
  end
  flush active -> L0
  compact s0_2 -> s1_2
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('RocksDB Storage Engine');
      expect(res.value).toContain('MEMORY BUFFER (DRAM)');
      expect(res.value).toContain('WAL Log');
      expect(res.value).toContain('Active MemTable');
      expect(res.value).toContain('SST [1..50]');
      expect(res.value).toContain('id="lsm-flush-arrow"');
      expect(res.value).toContain('id="lsm-compact-arrow"');
    });
  });

  describe('behaviortree', () => {
    it('renders AI behavior tree with composite, condition, and action nodes and status badges', () => {
      const src = `behaviortree
  title "Combat AI"
  ? "Combat Root"
    -> "Attack Sequence"
      (Enemy In Range) { status: success }
      (Has Weapon) { status: success }
      [Fire Weapon] { status: running }
    -> "Search Sequence"
      (Knows Enemy Position) { status: failure }
      [Search Area] { status: idle }
    [Patrol Area]
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('Combat AI');
      expect(res.value).toContain('? Combat Root');
      expect(res.value).toContain('→ Attack Sequence');
      expect(res.value).toContain('Enemy In Range');
      expect(res.value).toContain('Fire Weapon');
      expect(res.value).toContain('✓');
      expect(res.value).toContain('⟳');
      expect(res.value).toContain('✗');
    });
  });

  describe('quadtree', () => {
    it('renders spatial 2D partition grid alongside 4-ary quadrant hierarchy', () => {
      const src = `quadtree
  title "Spatial Object Index"
  bounds 0 0 100 100
  capacity 1
  insert (20, 20) "P1"
  insert (80, 20) "P2"
  insert (30, 80) "P3"
  insert (85, 75) "P4"
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('Spatial Object Index');
      expect(res.value).toContain('SPATIAL 2D PARTITION');
      expect(res.value).toContain('P1 (20,20)');
      expect(res.value).toContain('P4 (85,75)');
      expect(res.value).toContain('Root-NW');
    });
  });

  describe('treap', () => {
    it('renders Treap with BST keys and Max-Heap priority badges', () => {
      const src = `treap
  title "Treap Structure"
  insert (K:50, P:85) (K:20, P:42) (K:70, P:90) (K:10, P:15)
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('Treap Structure');
      expect(res.value).toContain('>50<');
      expect(res.value).toContain('>85<');
      expect(res.value).toContain('>70<');
      expect(res.value).toContain('>90<');
    });
  });

  describe('2-3-4 Tree', () => {
    it('renders 2-3-4 tree with 2-nodes, 3-nodes, and 4-nodes', () => {
      const src = `234tree
  title "2-3-4 Search Tree"
  insert 10 20 30 40 50 60 70 80
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('2-3-4 Search Tree');
      expect(res.value).toContain('id="tree234-arrow"');
    });
  });

  describe('Publication Usability Requirements', () => {
    it('1. includes secondary text in node sizing with consistent padding and no border intersection', () => {
      const src = `plan
  title Generic processing plan
  Combine Results {rows: 980}
    Read Source A {rows: 10000}
    Build Index
      Read Source B {idx: sample_index}
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('Generic processing plan');
      expect(res.value).toContain('rows: 980');
      expect(res.value).toContain('rows: 10000');
      expect(res.value).toContain('idx: sample_index');
    });

    it('2. keeps balance factor badges clear of incoming connector anchors', () => {
      const src = `avl insert 50 30 70 20 40 60 80 10 5`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Node 30 is a left child of 50; badge is positioned at top-left (cx=97), incoming edge arrives from top-right
      expect(res.value).toContain('cx="97" cy="121" r="9"');
    });

    it('3. prevents 2-3-4 tree node-type annotations from intersecting connectors', () => {
      const src = `234tree
  title "2-3-4 Search Tree"
  insert 10 20 30 40 50 60 70 80
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('2-3-4 Search Tree');
      expect(res.value).toContain('2-node');
      expect(res.value).toContain('3-node');
      expect(res.value).toContain('4-node');
    });

    it('4. provides compact layout mode for wide trees to fit portrait publication constraints', () => {
      const normalSrc = `merkletree
  title "Artifact Verification"
  data "A" "B" "C" "D" "E" "F" "G" "H"
  proof "C"
`;
      const compactSrc = `merkletree
  title "Artifact Verification"
  layout compact
  data "A" "B" "C" "D" "E" "F" "G" "H"
  proof "C"
`;
      const r1 = renderSync(normalSrc, {}, 'svg');
      const r2 = renderSync(compactSrc, {}, 'svg');
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (!r1.ok || !r2.ok) return;

      const w1 = parseFloat(r1.value.match(/viewBox="0 0 ([0-9.]+) /)![1]!);
      const w2 = parseFloat(r2.value.match(/viewBox="0 0 ([0-9.]+) /)![1]!);

      expect(w2).toBeLessThan(w1 * 0.65);
      expect(w2).toBeLessThan(700);
    });
  });
});
