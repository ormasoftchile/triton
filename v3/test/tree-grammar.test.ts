import { describe, it, expect } from 'vitest';
import { tree } from '../src/diagrams/tree/index.js';
import { layoutTree } from '../src/diagrams/tree/layout.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('tree grammar', () => {
  it('builds parent/child structure from indentation', () => {
    const src = [
      'tree TD',
      '  title Decision',
      '  x1 < 0.5 ? :box',
      '    |yes| A :leaf',
      '    |no| x2 < 0.3 ? :box',
      '      |yes| B :leaf',
      '      |no| C :leaf',
      '',
    ].join('\n');
    const doc = tree.parseMermaid(src);
    expect(doc.direction).toBe('TB');
    expect(doc.metadata['title']).toBe('Decision');
    expect(doc.nodes).toHaveLength(5);
    const [root, a, x2, b, c] = doc.nodes;
    expect(root!.label).toBe('x1 < 0.5 ?');
    expect(root!.kinds).toContain('box');
    expect(root!.children).toEqual([a!.id, x2!.id]);
    expect(a!.edgeLabel).toBe('yes');
    expect(a!.kinds).toContain('leaf');
    expect(x2!.children).toEqual([b!.id, c!.id]);
  });

  it('reads attributes into info and badge', () => {
    const doc = tree.parseMermaid('tree\n  HashJoin :join {rows: 980}\n    SeqScan :scan\n');
    expect(doc.nodes[0]!.info).toBe('rows: 980');
    expect(doc.nodes[0]!.kinds).toContain('join');
    const badged = tree.parseMermaid('tree\n  30 :circle {badge: 0}\n');
    expect(badged.nodes[0]!.badge).toBe('0');
  });

  it('treats bare flags as kinds', () => {
    const doc = tree.parseMermaid('tree\n  1 :black {nil}\n');
    expect(doc.nodes[0]!.kinds).toContain('nil');
    expect(doc.nodes[0]!.info).toBeUndefined();
  });

  it('defaults direction to TB', () => {
    expect(tree.parseMermaid('tree\n  a\n').direction).toBe('TB');
    expect(tree.parseMermaid('tree LR\n  a\n').direction).toBe('LR');
  });
});

describe('tree layout', () => {
  it('renders a scene with anchors for every node', () => {
    const doc = tree.parseMermaid('tree\n  root\n    l\n    r\n');
    const { scene, anchors } = layoutTree(doc, defaultTheme);
    expect(scene.elements.length).toBeGreaterThan(0);
    expect(Object.keys(anchors)).toEqual(['n0', 'n1', 'n2']);
    expect(scene.viewBox.width).toBeGreaterThan(0);
  });

  it('handles an empty tree', () => {
    const { scene } = layoutTree(
      { version: '1.0', metadata: {}, direction: 'TB', nodes: [] }, defaultTheme);
    expect(scene.elements).toHaveLength(0);
  });
});
