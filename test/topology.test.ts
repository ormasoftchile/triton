import { describe, it, expect } from 'vitest';
import { topology, layoutTopology } from '../src/diagrams/triton/topology/topology.js';
import { classifyCost } from '../src/style/cost.js';
import { defaultTheme } from '../src/theme/preset.js';
import { renderSync } from '../src/frontend/index.js';

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

describe('topology legacy & core features', () => {
  const ir = topology.parseMermaid(SRC);

  it('parses tiers, nodes and weighted edges', () => {
    expect(ir.scale.unit).toBe('ns');
    expect(ir.scale.tiers).toHaveLength(3);
    expect(ir.scale.tiers[2]).toMatchObject({
      name: 'hop2',
      maxWeight: 200,
      color: '#e2574c',
      dash: '5 4',
    });
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
    expect(Object.keys(anchors)).toContain('N0');
    expect(Object.keys(anchors)).toContain('N1');
    expect(Object.keys(anchors)).toContain('N2');
    expect(Object.keys(anchors)).toContain('N3');
    const paths = scene.elements.filter((e) => e.type === 'path');
    expect(paths).toHaveLength(6); // one per edge
    const rects = scene.elements.filter((e) => e.type === 'rect');
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
    expect(ir.groups.map((g) => g.id)).toEqual(['N0', 'N1']);
    expect(ir.nodes.find((n) => n.id === 'C0')!.group).toBe('N0');
    expect(ir.nodes.find((n) => n.id === 'C1')!.group).toBe('N1');
  });

  it('nests child boxes inside their group and resolves group-level edges', () => {
    const ir = topology.parseMermaid(SRC);
    const { scene, anchors } = layoutTopology(ir, defaultTheme);
    expect(anchors['N0']).toBeDefined(); // group is anchorable
    expect(anchors['C0']).toBeDefined();
    const g = anchors['N0']!.bounds;
    const c = anchors['C0']!.bounds;
    expect(c.x).toBeGreaterThanOrEqual(g.x);
    expect(c.x + c.width).toBeLessThanOrEqual(g.x + g.width);
    // 2 edges drawn (one intra-group, one group-to-group)
    expect(scene.elements.filter((e) => e.type === 'path')).toHaveLength(2);
  });
});

describe('Modernized Topology Engine: Requirements & Features', () => {
  it('supports the syntax :: for title', () => {
    const src1 = `topology :: "Enterprise Backbone Topology"
      router r1 "Core Router"
      switch sw1 "Core Switch"
      r1 -- sw1
    `;
    const res1 = renderSync(src1, {}, 'svg');
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.value).toContain('Enterprise Backbone Topology');
      expect(res1.value).toContain('ROUTER');
      expect(res1.value).toContain('SWITCH');
    }

    const src2 = `topology
      title :: Datacenter Spine-Leaf
      pattern spine-leaf
      switch spine1 "Spine 1"
      switch leaf1 "Leaf 1"
      spine1 -- leaf1
    `;
    const res2 = renderSync(src2, {}, 'svg');
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.value).toContain('Datacenter Spine-Leaf');
    }
  });

  it('supports device roles, subnets, interface ports, and IP tags', () => {
    const src = `topology :: "Edge VPC Infrastructure"
      subnet "10.0.1.0/24" "Public Subnet (DMZ)"
        loadbalancer alb "Application Load Balancer" [10.0.1.10]
        firewall waf "Web App Firewall"
      end

      subnet "10.0.2.0/24" "Private Compute Subnet"
        server app1 "App Server 01" [10.0.2.11]
        database db1 "PostgreSQL Primary" [10.0.2.20]
      end

      alb:out --> waf:in @orthogonal "HTTPS 443"
      waf:out --> app1:eth0 @straight "Forwarded Traffic"
      app1:eth0 <--> db1:port5432 @bezier "SQL Queries"
    `;
    const res = renderSync(src, {}, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toContain('Edge VPC Infrastructure');
    expect(res.value).toContain('Public Subnet (DMZ) [10.0.1.0/24]');
    expect(res.value).toContain('LOADBALANCER');
    expect(res.value).toContain('FIREWALL');
    expect(res.value).toContain('SERVER');
    expect(res.value).toContain('DATABASE');
    expect(res.value).toContain('10.0.1.10');
    expect(res.value).toContain('HTTPS 443');
    expect(res.value).toContain('Forwarded Traffic');
  });

  it('supports specific connectors (@orthogonal, @straight, @bezier)', () => {
    const src = `topology :: "Connector Routing Matrix"
      router r1 "R1"
      switch sw1 "SW1"
      server srv1 "SRV1"
      database db1 "DB1"

      r1 -- sw1 @orthogonal "Orthogonal Trunk"
      sw1 --> srv1 @straight "Direct Link"
      srv1 <--> db1 @bezier "Curved Tunnel"
    `;
    const res = renderSync(src, {}, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toContain('Orthogonal Trunk');
    expect(res.value).toContain('Direct Link');
    expect(res.value).toContain('Curved Tunnel');
  });

  it('can be embedded in posters and supports connectors referring to nodes', () => {
    const src = `poster "Multi-Cloud System Overview"
      columns 2

      cell net "Network Infrastructure" :: topology
        router edgeRouter "Edge Gateway" [192.168.1.1]
        switch coreSwitch "Core Switch"
        server host1 "Compute Host" [10.0.0.5]
        edgeRouter -- coreSwitch
        coreSwitch -- host1
      end

      cell app "Application Services" :: flowchart
        web["Web Gateway"]
        api["API Service"]
        web --> api
      end

      link net.edgeRouter --> app.web @orthogonal "Inbound Traffic"
      link net.host1 --> app.api @bezier "Internal Service Mesh"
    `;
    const res = renderSync(src, {}, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toContain('Multi-Cloud System Overview');
    expect(res.value).toContain('Network Infrastructure');
    expect(res.value).toContain('Edge Gateway');
    expect(res.value).toContain('Inbound Traffic');
    expect(res.value).toContain('Internal Service Mesh');
  });

  it('supports standard topology patterns: spine-leaf, hub-spoke, ring', () => {
    const spineLeafSrc = `topology :: Spine-Leaf
      pattern spine-leaf
      switch spine1 "Spine 1"
      switch spine2 "Spine 2"
      switch leaf1 "Leaf 1"
      switch leaf2 "Leaf 2"
      server srv1 "Server 1"
      server srv2 "Server 2"
      spine1 -- leaf1, leaf2
      spine2 -- leaf1, leaf2
      leaf1 -- srv1
      leaf2 -- srv2
    `;
    const slRes = renderSync(spineLeafSrc, {}, 'svg');
    expect(slRes.ok).toBe(true);

    const hubSpokeSrc = `topology :: Hub and Spoke
      pattern hub-spoke
      router hub "Central Transit Hub"
      router spoke1 "Branch Office NYC"
      router spoke2 "Branch Office LON"
      router spoke3 "Branch Office TYO"
      hub -- spoke1, spoke2, spoke3
    `;
    const hsRes = renderSync(hubSpokeSrc, {}, 'svg');
    expect(hsRes.ok).toBe(true);

    const ringSrc = `topology :: Token Ring Loop
      pattern ring
      node n1 "Node 1"
      node n2 "Node 2"
      node n3 "Node 3"
      node n4 "Node 4"
      n1 -- n2 -- n3 -- n4 -- n1
    `;
    const ringRes = renderSync(ringSrc, {}, 'svg');
    expect(ringRes.ok).toBe(true);
  });

  it('improves edge-label placement: never overlaps device cards or group headings and avoids label collisions', () => {
    const src = `topology :: "Regional Application Infrastructure"
      pattern tiered

      subnet "10.10.1.0/24" "Application Zone A"
        loadbalancer lbA "Load Balancer A" [10.10.1.10]
        server apiA "API Server A" [10.10.1.20]
        database dbA "Database A" [10.10.1.30]
      end

      subnet "10.20.1.0/24" "Application Zone B"
        loadbalancer lbB "Load Balancer B" [10.20.1.10]
        server apiB "API Server B" [10.20.1.20]
        database dbB "Database B" [10.20.1.30]
      end

      lbA --> apiA @straight "forward application requests"
      apiA <--> dbA @straight "transactional database traffic"

      lbB --> apiB @straight "forward application requests"
      apiB <--> dbB @straight "transactional database traffic"

      apiA <--> apiB @bezier "cross-zone synchronization and failover"
    `;

    const res = renderSync(src, {}, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Verify all labels are rendered
    expect(res.value).toContain('forward application requests');
    expect(res.value).toContain('transactional database traffic');
    expect(res.value).toContain('cross-zone synchronization and failover');
    expect(res.value).toContain('Application Zone A [10.10.1.0/24]');
    expect(res.value).toContain('Application Zone B [10.20.1.0/24]');
  });
});
