import { describe, it, expect } from 'vitest';
import { topology, layoutTopology } from '../src/diagrams/triton/topology/topology.js';
import { classifyCost } from '../src/style/cost.js';
import { defaultTheme } from '../src/theme/preset.js';

const SRC = [
  'topology',
  '  title NUMA interconnect',
  '  costs ns',
  '    tier local 90 #27ae60',
  '    tier hop1 140 #2f80ed',
  '    tier hop2 200 #e2574c 5 4',
  '  node N0 : Node 0 : CPU+RAM',
  '  node N1 : Node 1 : CPU+RAM',
  '  node N2 : Node 2',
  '  node N3 : Node 3',
  '  N0 -- N1 : 140',
  '  N0 -- N2 : 140',
  '  N1 -- N3 : 140',
  '  N2 -- N3 : 140',
  '  N0 -- N3 : 200',
  '  N1 -- N2 : 200',
  '',
].join('\n');

describe('topology', () => {
  const ir = topology.parseMermaid(SRC);

  it('parses tiers, nodes and weighted edges', () => {
    expect(ir.scale.unit).toBe('ns');
    expect(ir.scale.tiers).toHaveLength(3);
    expect(ir.scale.tiers[2]).toMatchObject({ name: 'hop2', maxWeight: 200, color: '#e2574c', dash: '5 4' });
    expect(ir.nodes).toHaveLength(4);
    expect(ir.nodes[0]).toEqual({ id: 'N0', label: 'Node 0', sub: 'CPU+RAM' });
    expect(ir.edges).toHaveLength(6);
    expect(ir.edges[0]).toEqual({ from: 'N0', to: 'N1', cost: 140 });
  });

  it('classifies edge weights into the right tier', () => {
    expect(classifyCost(ir.scale, 140).name).toBe('hop1');
    expect(classifyCost(ir.scale, 200).name).toBe('hop2');
    expect(classifyCost(ir.scale, 50).name).toBe('local');
  });

  it('renders an anchor per node, an edge path per link, and a legend', () => {
    const { scene, anchors } = layoutTopology(ir, defaultTheme);
    expect(Object.keys(anchors).sort()).toEqual(['N0', 'N1', 'N2', 'N3']);
    const paths = scene.elements.filter(e => e.type === 'path');
    expect(paths).toHaveLength(6); // one per edge
    // legend frame + 3 swatches = 4 rects beyond the node boxes
    const rects = scene.elements.filter(e => e.type === 'rect');
    expect(rects.length).toBeGreaterThanOrEqual(4 + 4);
  });

  it('handles a costs-free topology', () => {
    const ir2 = topology.parseMermaid('topology\n  node A\n  node B\n  A -- B\n');
    expect(() => layoutTopology(ir2, defaultTheme)).not.toThrow();
  });
});

describe('topology with nested groups', () => {
  const SRC = [
    'topology',
    '  title NUMA',
    '  costs ns',
    '    tier local 90 #27ae60',
    '    tier remote 200 #e2574c 5 4',
    '  group N0 : NUMA Node 0',
    '    node C0 : Core 0',
    '    node MC0 : Mem Ctrl',
    '    node RAM0 : Local DRAM : 64 GB',
    '  group N1 : NUMA Node 1',
    '    node C1 : Core 1',
    '  MC0 -- RAM0 : 90',
    '  N0 -- N1 : 140',
    '',
  ].join('\n');

  it('parses groups and assigns node membership', () => {
    const ir = topology.parseMermaid(SRC);
    expect(ir.groups.map(g => g.id)).toEqual(['N0', 'N1']);
    expect(ir.nodes.find(n => n.id === 'C0')!.group).toBe('N0');
    expect(ir.nodes.find(n => n.id === 'C1')!.group).toBe('N1');
  });

  it('nests child boxes inside their group and resolves group-level edges', () => {
    const ir = topology.parseMermaid(SRC);
    const { scene, anchors } = layoutTopology(ir, defaultTheme);
    expect(anchors['N0']).toBeDefined();   // group is anchorable
    expect(anchors['C0']).toBeDefined();
    const g = anchors['N0']!.bounds, c = anchors['C0']!.bounds;
    expect(c.x).toBeGreaterThanOrEqual(g.x);
    expect(c.x + c.width).toBeLessThanOrEqual(g.x + g.width);
    // 2 edges drawn (one intra-group, one group-to-group)
    expect(scene.elements.filter(e => e.type === 'path')).toHaveLength(2);
  });
});
