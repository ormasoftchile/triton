import { describe, it, expect } from 'vitest';
import { renderSync } from '../src/index.js';
import { buildBPlusTree, layoutBPlusTree } from '../src/diagrams/triton/ds/tree/bplustree.js';
import { defaultTheme } from '../src/theme/preset.js';

const keysOf = (label: string): number[] =>
  label.split('|').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));

describe('bplustree diagram module', () => {
  describe('Copy-up leaf splits and leaf-only data storage', () => {
    it('retains promoted separator keys in leaves during copy-up leaf splits (order 3)', () => {
      // Inserting 10, 20, 30:
      // Leaf [10, 20, 30] splits at mid=1.
      // Left leaf: [10], Right leaf: [20, 30].
      // Separator key 20 is copied up to Root [20]. Key 20 remains in Right leaf!
      const doc = buildBPlusTree('bplustree order 3 insert 10 20 30');
      expect(doc.nodes).toHaveLength(3); // 1 root, 2 leaves

      const root = doc.nodes.find((n) => !n.isLeaf)!;
      const leaves = doc.nodes.filter((n) => n.isLeaf);

      expect(keysOf(root.label)).toEqual([20]);
      expect(leaves).toHaveLength(2);
      expect(keysOf(leaves[0]!.label)).toEqual([10]);
      expect(keysOf(leaves[1]!.label)).toEqual([20, 30]);

      // Note: Key 20 is in both root AND right leaf (B+ Tree copy-up semantics)
      const allLeafKeys = leaves.flatMap((l) => keysOf(l.label));
      expect(allLeafKeys).toEqual([10, 20, 30]);
    });

    it('stores all data entries only in leaf nodes across multiple split levels', () => {
      const doc = buildBPlusTree('bplustree order 3 insert 10 20 30 40 50 60 70 80');
      const leaves = doc.nodes.filter((n) => n.isLeaf);
      const internalNodes = doc.nodes.filter((n) => !n.isLeaf);

      // All 8 keys must be present in sorted order across the leaves
      const allLeafKeys = leaves.flatMap((l) => keysOf(l.label));
      expect(allLeafKeys).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);

      // Internal nodes only hold routing/separator keys
      expect(internalNodes.length).toBeGreaterThan(0);
      for (const inode of internalNodes) {
        for (const k of keysOf(inode.label)) {
          expect(allLeafKeys).toContain(k); // every separator key is present in leaves
        }
      }
    });

    it('performs push-up on internal node splits while leaves copy-up (order 4)', () => {
      const doc = buildBPlusTree('bplustree order 4 insert 5 10 15 20 25 30 35 40 45 50 55 60');
      const leaves = doc.nodes.filter((n) => n.isLeaf);
      const allLeafKeys = leaves.flatMap((l) => keysOf(l.label));
      expect(allLeafKeys).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    });
  });

  describe('Ordered sibling pointers and same-rank alignment', () => {
    it('renders ordered horizontal sibling pointers between consecutive leaves', () => {
      const src = `bplustree
order 3
insert 10 20 30 40 50
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Sibling pointer arrow def
      expect(res.value).toContain('id="bplus-arrow"');
      expect(res.value).toContain('markerUnits="userSpaceOnUse"');

      // Sibling pointer path marker
      expect(res.value).toContain('marker-end="url(#bplus-arrow)"');
    });

    it('aligns all leaves to the exact same vertical rank/baseline', () => {
      const doc = buildBPlusTree('bplustree order 3 insert 10 20 30 40 50 60 70');
      const layout = layoutBPlusTree(doc, defaultTheme);

      const leafIds = doc.nodes.filter((n) => n.isLeaf).map((n) => n.id);
      const leafBoxes = leafIds.map((id) => layout.anchors[id]!.bounds);

      expect(leafBoxes.length).toBeGreaterThan(1);
      const firstY = leafBoxes[0]!.y;
      for (const b of leafBoxes) {
        expect(b.y).toBe(firstY);
      }
    });

    it('supports bidirectional leaf pointers with directive', () => {
      const src = `bplustree
bidirectional
order 3
insert 10 20 30 40
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('id="bplus-arrow-start"');
      expect(res.value).toContain('marker-start="url(#bplus-arrow-start)"');
    });
  });

  describe('Explicit / Manually authored B+ trees', () => {
    it('parses explicit pointer syntax with custom page IDs and keys', () => {
      const src = `bplustree
  title InnoDB Clustered Index
  page root [30] -> p1, p2
  page p1 [20] -> l1, l2
  page p2 [40] -> l3, l4
  leaf l1 [10]
  leaf l2 [20]
  leaf l3 [30]
  leaf l4 [40 | 50]
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('InnoDB Clustered Index');
      expect(res.value).toContain('>40<');
      expect(res.value).toContain('>50<');
      expect(res.value).toContain('root');
      expect(res.value).toContain('leaf');
      expect(res.value).toContain('marker-end="url(#bplus-arrow)"');
    });

    it('parses indented manual hierarchy with page attributes', () => {
      const src = `bplustree
  [30] { page: "P0" }
    [20] { page: "P1" }
      [10] { page: "L1", leaf: true }
      [20] { page: "L2", leaf: true }
    [40] { page: "P2" }
      [30] { page: "L3", leaf: true }
      [40 | 50] { page: "L4", leaf: true }
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('P0');
      expect(res.value).toContain('L1');
      expect(res.value).toContain('L4');
    });

    it('renders textbook B+ tree with internal routing keys and leaf sibling chain (matching reference image)', () => {
      const src = `bplustree
  title "B+ tree"
  page root [75 | 150 | 225] -> l1, l2, l3, l4
  leaf l1 [25 | 50]
  leaf l2 [75 | 100 | 125]
  leaf l3 [150 | 175 | 200]
  leaf l4 [225 | 250 | 275]
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('B+ tree');
      expect(res.value).toContain('>75<');
      expect(res.value).toContain('>150<');
      expect(res.value).toContain('>225<');
      expect(res.value).toContain('>25<');
      expect(res.value).toContain('>50<');
      expect(res.value).toContain('>100<');
      expect(res.value).toContain('>125<');
      expect(res.value).toContain('>175<');
      expect(res.value).toContain('>200<');
      expect(res.value).toContain('>250<');
      expect(res.value).toContain('>275<');
      expect(res.value).toContain('marker-end="url(#bplus-arrow)"');
      expect(res.value).toContain('marker-end="url(#bplus-tree-arrow)"');
    });

    it('exposes node anchors for cross-linking in posters', () => {
      const src = `poster "B+ Tree Integration"
  columns 2

  cell bplus "B+ Tree Index" :: bplustree
    bplustree order 3 insert 10 20 30 40
  end

  cell note "Inspector" :: flowchart
    flowchart TD
      n1["Root Inspector"]
  end

  link note.n1 --> bplus.page_P1 "inspects root"
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value).toContain('B+ Tree Index');
      expect(res.value).toContain('inspects root');
    });
  });

  describe('Diagram keyword detection', () => {
    it('supports b+tree alias', () => {
      const src = `b+tree
order 3
insert 10 20 30
`;
      const res = renderSync(src, {}, 'svg');
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value).toContain('id="bplus-arrow"');
    });
  });
});
