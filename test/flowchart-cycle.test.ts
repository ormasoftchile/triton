import { describe, it, expect } from 'vitest';
import { renderSync } from '../src/frontend/index.js';
import { layoutFlowchart } from '../src/diagrams/mermaid/flowchart/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { FlowDocument } from '../src/diagrams/mermaid/flowchart/ir.js';

/**
 * Regression: cyclic flowcharts must TERMINATE and render valid SVG.
 *
 * Previously a back-edge that reached a cycle from a root made the flowchart
 * layer-assignment BFS grow layer numbers without bound (infinite loop), so
 * `renderSync` never returned. Cycle breaking (DFS back-edge removal) fixes it.
 *
 * Note: a true hang blocks the event loop, so a regression here will stall the
 * whole suite (a hang IS a failure signal). These cases all return in <1ms.
 */
describe('flowchart cycles terminate and render', () => {
  const cyclic: Array<[string, string]> = [
    ['2-cycle', 'flowchart LR\n  A --> B\n  B --> A'],
    ['3-cycle', 'flowchart TD\n  A --> B\n  B --> C\n  C --> A'],
    ['self-loop', 'flowchart TD\n  A --> A'],
    ['root into cycle', 'flowchart TD\n  S --> A\n  A --> B\n  B --> C\n  C --> A'],
    ['two back-edges', 'flowchart TD\n  A --> B\n  B --> C\n  C --> A\n  C --> B'],
  ];

  for (const [name, src] of cyclic) {
    it(`renders ${name} to valid SVG`, () => {
      const r = renderSync(src);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.startsWith('<svg')).toBe(true);
        expect(r.value.length).toBeGreaterThan(0);
      }
    });
  }

  it('cyclic edges are still drawn (path count >= edge count)', () => {
    // 3-cycle has 3 edges → at least 3 <path> elements (the back-edge is not dropped).
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'rect' },
        { id: 'C', label: 'C', shape: 'rect' },
      ],
      edges: [
        { from: 'A', to: 'B', kind: 'sync', style: 'solid' },
        { from: 'B', to: 'C', kind: 'sync', style: 'solid' },
        { from: 'C', to: 'A', kind: 'sync', style: 'solid' },
      ],
      subgraphs: [],
    };
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const paths = scene.elements.filter(e => e.type === 'path');
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it('acyclic layout is unaffected (distinct layers preserved)', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'rect' },
        { id: 'C', label: 'C', shape: 'rect' },
      ],
      edges: [
        { from: 'A', to: 'B', kind: 'sync', style: 'solid' },
        { from: 'B', to: 'C', kind: 'sync', style: 'solid' },
      ],
      subgraphs: [],
    };
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const groups = scene.elements.filter(e => e.type === 'group' && (e as { id?: string }).id) as Array<{ id: string; children: Array<{ type: string; bounds?: { y: number } }> }>;
    const ys = groups
      .map(g => g.children.find(c => c.type === 'rect')?.bounds?.y)
      .filter((y): y is number => y !== undefined);
    // A, B, C on three distinct rows
    expect(new Set(ys).size).toBe(3);
  });

  it('back-edges are bowed (curved) while forward edges stay straight', () => {
    // A → B is a forward edge; B → A closes the cycle (a back-edge). The forward
    // edge keeps its orthogonal straight-segment route ('M…L…', no curve); the
    // back-edge is rerouted as a cubic Bézier ('C') so it bows around the column.
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect' },
        { id: 'B', label: 'B', shape: 'rect' },
      ],
      edges: [
        { from: 'A', to: 'B', kind: 'sync', style: 'solid' }, // forward
        { from: 'B', to: 'A', kind: 'sync', style: 'solid' }, // back-edge
      ],
      subgraphs: [],
    };
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const paths = scene.elements.filter(e => e.type === 'path') as Array<{ d: string }>;
    expect(paths.length).toBe(2);
    const [forward, back] = paths;
    expect(forward!.d).not.toContain('C'); // straight orthogonal route
    expect(back!.d).toContain('C');        // bowed cubic Bézier (feedback route)
  });

  it('self-loop produces a non-degenerate looped path (not a zero-length line)', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [{ id: 'A', label: 'A', shape: 'rect' }],
      edges: [{ from: 'A', to: 'A', kind: 'sync', style: 'solid' }],
      subgraphs: [],
    };
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const paths = scene.elements.filter(e => e.type === 'path') as Array<{ d: string }>;
    expect(paths.length).toBe(1);
    const d = paths[0]!.d;
    expect(d).toContain('C'); // a small loop, not a straight degenerate segment
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    // The loop has real 2-D extent (non-degenerate in both axes).
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0);
  });
});
