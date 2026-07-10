import { describe, it, expect } from 'vitest';
import { trie, buildTrie } from '../src/diagrams/triton/ds/trie/trie.js';
import { graph, layoutGraph } from '../src/diagrams/triton/ds/graph/graph.js';
import { unionfind, buildUnionFind, layoutUnionFind } from '../src/diagrams/triton/ds/unionfind/unionfind.js';
import { layoutTree } from '../src/diagrams/triton/ds/tree/layout.js';
import { render } from '../src/frontend/index.js';
import { detect } from '../src/frontend/detect.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('ds-b2 detection', () => {
  it('routes each header to its own kind', () => {
    expect(detect('trie insert cat car').diagramType).toBe('trie');
    expect(detect('nodegraph\n  A -> B').diagramType).toBe('nodegraph');
    expect(detect('dsgraph\n  A -> B').diagramType).toBe('nodegraph');
    expect(detect('unionfind 5').diagramType).toBe('unionfind');
    expect(detect('dsu 5').diagramType).toBe('unionfind');
  });

  it('does NOT break Mermaid flowchart detection for `graph`', () => {
    expect(detect('graph TD\n  A-->B').diagramType).toBe('flowchart');
    expect(detect('flowchart LR\n  A-->B').diagramType).toBe('flowchart');
  });
});

describe('trie', () => {
  it('shares a common prefix instead of duplicating nodes', () => {
    // cat + car share the prefix "ca": root,c,a,t,r = 5 nodes (not 3+3+1=7).
    const ir = buildTrie('trie cat car');
    expect(ir.nodes).toHaveLength(5);
    // root has exactly one child (the shared 'c').
    const childIds = new Set<string>();
    for (const n of ir.nodes) for (const c of n.children) childIds.add(c);
    const roots = ir.nodes.filter(n => !childIds.has(n.id));
    expect(roots).toHaveLength(1);
    expect(roots[0]!.children).toHaveLength(1);
  });

  it('marks every word-terminal node distinctly and labels it with the word', () => {
    const ir = buildTrie('trie insert cat car card dog do');
    const terminals = ir.nodes.filter(n => n.kinds.includes('active'));
    // five inserted words → five terminal nodes
    expect(terminals).toHaveLength(5);
    const labels = terminals.map(n => n.label).sort();
    expect(labels).toEqual(['car', 'card', 'cat', 'do', 'dog']);
  });

  it('puts the character on the edge from the parent', () => {
    const ir = buildTrie('trie ab');
    const labelled = ir.nodes.filter(n => n.edgeLabel !== undefined).map(n => n.edgeLabel);
    expect(labelled).toEqual(['a', 'b']);
  });

  it('renders to valid SVG', async () => {
    const r = await render('trie insert cat car card dog do');
    expect(r.ok && r.value.startsWith('<svg')).toBe(true);
  });

  it('handles an empty trie', () => {
    expect(() => layoutTree(trie.parseMermaid('trie'), defaultTheme)).not.toThrow();
  });
});

describe('graph', () => {
  it('parses node and edge counts', () => {
    const ir = graph.parseMermaid('nodegraph\n  node A : Start\n  A -> B\n  B -> C\n  C -- A\n');
    expect(ir.nodes.map(n => n.id).sort()).toEqual(['A', 'B', 'C']);
    expect(ir.edges).toHaveLength(3);
    expect(ir.nodes.find(n => n.id === 'A')!.label).toBe('Start');
  });

  it('auto-registers nodes that only appear in edges', () => {
    const ir = graph.parseMermaid('nodegraph\n  X -> Y\n  Y -> Z\n');
    expect(ir.nodes.map(n => n.id).sort()).toEqual(['X', 'Y', 'Z']);
  });

  it('directed mode draws arrowheads; undirected does not', () => {
    const directedIr = graph.parseMermaid('nodegraph\n  directed\n  A -> B\n');
    const undirectedIr = graph.parseMermaid('nodegraph\n  undirected\n  A -- B\n');
    const arrowsIn = (doc: typeof directedIr) =>
      layoutGraph(doc, defaultTheme).scene.elements.filter(
        e => e.type === 'path' && (e as { markerEnd?: string }).markerEnd != null,
      ).length;
    expect(arrowsIn(directedIr)).toBeGreaterThan(0);
    expect(arrowsIn(undirectedIr)).toBe(0);
  });

  it('renders an arrow marker def only in directed mode', () => {
    const directed = layoutGraph(graph.parseMermaid('nodegraph\n  directed\n  A -> B\n'), defaultTheme);
    const undirected = layoutGraph(graph.parseMermaid('nodegraph\n  A -- B\n'), defaultTheme);
    expect(directed.scene.defs?.length ?? 0).toBeGreaterThan(0);
    expect(undirected.scene.defs?.length ?? 0).toBe(0);
  });

  it('exposes one anchor per node and renders to valid SVG', async () => {
    const { anchors } = layoutGraph(graph.parseMermaid('nodegraph\n  A -> B\n  B -> C\n'), defaultTheme);
    expect(Object.keys(anchors).sort()).toEqual(['A', 'B', 'C']);
    const r = await render('nodegraph\n  directed\n  A -> B\n  B -> C\n');
    expect(r.ok && r.value.startsWith('<svg')).toBe(true);
  });
});

describe('unionfind', () => {
  it('parses an explicit parent array into the right number of sets', () => {
    const ir = buildUnionFind('unionfind 7\n  parent 0 0 1 3 3 5 5\n');
    expect(ir.count).toBe(7);
    expect(ir.roots).toEqual([0, 3, 5]);    // three disjoint sets
  });

  it('roots are exactly the elements that are their own parent', () => {
    const ir = buildUnionFind('unionfind 7\n  parent 0 0 1 3 3 5 5\n');
    for (const r of ir.roots) expect(ir.parent[r]).toBe(r);
    // every non-root resolves (via parents) to one of the roots
    for (let i = 0; i < ir.count; i++) {
      let x = i;
      for (let g = 0; g < ir.count && ir.parent[x] !== x; g++) x = ir.parent[x]!;
      expect(ir.roots).toContain(x);
    }
  });

  it('applies union operations to merge sets', () => {
    const ir = buildUnionFind('dsu 4\n  union 1 0\n  union 3 2\n');
    // 1→0 and 3→2 → two sets {0,1} and {2,3}
    expect(ir.roots.sort()).toEqual([0, 2]);
    expect(ir.count).toBe(4);
  });

  it('marks each representative node distinctly (filled/active)', () => {
    const ir = buildUnionFind('unionfind 5\n  parent 0 0 0 3 3\n');
    const actives = ir.nodes.filter(n => n.kinds.includes('active')).map(n => n.label).sort();
    expect(actives).toEqual(['0', '3']);
  });

  it('renders the forest to valid SVG with one anchor per element', async () => {
    const ir = buildUnionFind('unionfind 7\n  parent 0 0 1 3 3 5 5\n');
    const { anchors } = layoutUnionFind(ir, defaultTheme);
    expect(Object.keys(anchors)).toHaveLength(7);
    const r = await render('unionfind 7\n  parent 0 0 1 3 3 5 5\n');
    expect(r.ok && r.value.startsWith('<svg')).toBe(true);
  });
});

// ── Feature 4: nodegraph edge highlight ────────────────────────────────────

describe('nodegraph edge highlight', () => {
  it('parses edge with kind active', () => {
    const ir = graph.parseMermaid([
      'nodegraph',
      '  directed',
      '  A -> B : active',
      '  B -> C',
    ].join('\n'));
    const active = ir.edges.find((e: any) => e.from === 'A' && e.to === 'B');
    expect(active?.kind).toBe('active');
    const plain = ir.edges.find((e: any) => e.from === 'B' && e.to === 'C');
    expect(plain?.kind).toBeUndefined();
  });

  it('parses edge with kind dashed', () => {
    const ir = graph.parseMermaid('nodegraph\n  A -> B : dashed\n');
    expect(ir.edges[0]?.kind).toBe('dashed');
    expect(ir.edges[0]?.label).toBeUndefined();
  });

  it('preserves normal labels when not a kind keyword', () => {
    const ir = graph.parseMermaid('nodegraph\n  A -> B : calls\n');
    expect(ir.edges[0]?.label).toBe('calls');
    expect(ir.edges[0]?.kind).toBeUndefined();
  });

  it('renders active edges with primary color and thicker stroke', () => {
    const ir = graph.parseMermaid([
      'nodegraph',
      '  directed',
      '  node A : parse',
      '  node B : emit',
      '  A -> B : active',
    ].join('\n'));
    const { scene } = layoutGraph(ir, defaultTheme);
    const paths = scene.elements.filter((e: any) => e.type === 'path' && !e.d?.includes('M0'));
    const activePath = paths.find((p: any) => p.strokeWidth === 2.5);
    expect(activePath).toBeDefined();
    expect(activePath?.stroke).toBe(defaultTheme.palette.primary);
  });
});
