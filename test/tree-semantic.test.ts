import { describe, it, expect } from 'vitest';
import { buildAvl } from '../src/diagrams/triton/ds/tree/avl.js';
import { plan } from '../src/diagrams/triton/ds/tree/plan.js';
import type { TreeDocument } from '../src/diagrams/triton/ds/tree/ir.js';
import { tree } from '../src/diagrams/triton/ds/tree/index.js';
import { layoutTree } from '../src/diagrams/triton/ds/tree/layout.js';
import { defaultTheme } from '../src/theme/preset.js';

/** In-order traversal of the emitted node list (n0 = root, children left,right). */
function inorder(doc: TreeDocument): number[] {
  const byId = new Map(doc.nodes.map(n => [n.id, n]));
  const out: number[] = [];
  const walk = (id: string): void => {
    const n = byId.get(id)!;
    const [l, r] = n.children;
    if (l) walk(l);
    out.push(Number(n.label));
    if (r) walk(r);
  };
  if (doc.nodes.length > 0) walk(doc.nodes[0]!.id);
  return out;
}

describe('avl builder', () => {
  it('emits one node per distinct key', () => {
    const doc = buildAvl('avl insert 50 30 70 20 40 60 80 10 5');
    expect(doc.nodes).toHaveLength(9);
  });

  it('ignores duplicate keys', () => {
    const doc = buildAvl('avl insert 10 10 20 20 30');
    expect(doc.nodes).toHaveLength(3);
  });

  it('maintains the BST ordering (in-order is sorted)', () => {
    const doc = buildAvl('avl insert 50 30 70 20 40 60 80 10 5');
    const seq = inorder(doc);
    expect(seq).toEqual([...seq].sort((a, b) => a - b));
  });

  it('stays balanced — every balance factor is within [-1, 1]', () => {
    const doc = buildAvl('avl insert 10 20 30 40 50 60 70 80 90'); // ascending = worst case
    for (const n of doc.nodes) {
      expect(Math.abs(Number(n.badge))).toBeLessThanOrEqual(1);
    }
  });

  it('rotates a right-leaning chain into a balanced root', () => {
    const doc = buildAvl('avl insert 10 20 30');
    expect(doc.nodes[0]!.label).toBe('20'); // single left rotation lifts 20
  });

  it('produces an empty document for no keys', () => {
    expect(buildAvl('avl').nodes).toHaveLength(0);
  });
});

describe('plan builder', () => {
  it('auto-infers operator colour kinds from labels', () => {
    const src = [
      'plan',
      '  Hash Join {rows: 980}',
      '    Seq Scan orders {rows: 10000}',
      '    Hash',
      '      Index Scan customers {idx: idx_cust}',
      '',
    ].join('\n');
    const doc = plan.parseMermaid(src);
    const kindOf = (label: string) => doc.nodes.find(n => n.label === label)!.kinds;
    expect(kindOf('Hash Join')).toContain('join');
    expect(kindOf('Seq Scan orders')).toContain('scan');
    expect(kindOf('Hash')).toContain('build');
    expect(kindOf('Index Scan customers')).toContain('scan');
  });

  it('keeps explicit tags over inference', () => {
    const doc = plan.parseMermaid('plan\n  Hash Join :build\n');
    expect(doc.nodes[0]!.kinds).toContain('build');
    expect(doc.nodes[0]!.kinds).not.toContain('join');
  });
});

// ── Feature 4: tree path highlight ─────────────────────────────────────────

describe('tree path directive', () => {
  it('extracts path directive and builds activePaths', () => {
    const ir = tree.parseMermaid([
      'tree',
      '  A',
      '    B',
      '      C',
      'path A -> B -> C',
    ].join('\n'));
    expect(ir.activePaths).toBeDefined();
    expect(ir.activePaths).toHaveLength(2);
  });

  it('renders active edges with a thicker path element', () => {
    const ir = tree.parseMermaid([
      'tree',
      '  Root',
      '    Left',
      '    Right',
      'path Root -> Left',
    ].join('\n'));
    const { scene } = layoutTree(ir, defaultTheme);
    const paths = scene.elements.filter((e: any) => e.type === 'path');
    const boldPath = paths.find((p: any) => p.strokeWidth === 2.5);
    expect(boldPath).toBeDefined();
  });

  it('leaves tree intact when no path directive', () => {
    const ir = tree.parseMermaid('tree\n  A\n    B\n');
    expect(ir.activePaths).toBeUndefined();
  });
});
