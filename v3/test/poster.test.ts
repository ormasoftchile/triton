import { describe, it, expect } from 'vitest';
import '../src/frontend/index.js'; // registers diagram modules
import { poster } from '../src/diagrams/poster/index.js';
import { layoutPoster } from '../src/diagrams/poster/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import { resolveTheme } from '../src/theme/resolver.js';
import type { PosterDocument } from '../src/diagrams/poster/ir.js';
import type { FlowDocument } from '../src/diagrams/flowchart/ir.js';
import type { TimelineDocument } from '../src/diagrams/timeline/ir.js';

const flowDoc: FlowDocument = {
  version: '1.0', metadata: { title: 'CI' }, direction: 'LR',
  nodes: [{ id: 'a', label: 'A', shape: 'rect' }, { id: 'b', label: 'B', shape: 'rect' }],
  edges: [{ from: 'a', to: 'b', kind: 'sync', style: 'solid' }],
  subgraphs: [],
};

const timelineDoc: TimelineDocument = {
  version: '1.0', metadata: { title: 'Road' }, layout: 'horizontal',
  tracks: [{ id: 'main', label: 'Main' }],
  activities: [{ id: 'a1', label: 'Phase 1', track: 'main', start: '2025-Q1', end: '2025-Q2' }],
  milestones: [{ id: 'm1', label: 'Launch', date: '2025-06' }],
};

const posterDoc: PosterDocument = {
  version: '1.0',
  metadata: { title: 'Architecture Overview' },
  grid: { columns: 2 },
  cells: [
    { id: 'flow',     title: 'Pipeline', content: { kind: 'diagram', diagramKind: 'flowchart', doc: flowDoc } },
    { id: 'timeline', title: 'Roadmap',  content: { kind: 'diagram', diagramKind: 'timeline', doc: timelineDoc } },
    { id: 'stat',     title: 'Uptime',   content: { kind: 'stat', value: '99.9%', label: 'Availability' } },
    { id: 'note',                         content: { kind: 'text', text: 'All systems nominal.' } },
  ],
};

describe('poster layout', () => {
  it('produces a valid scene', async () => {
    const { scene } = await layoutPoster(posterDoc, defaultTheme);
    expect(scene.viewBox.width).toBeGreaterThan(0);
    expect(scene.viewBox.height).toBeGreaterThan(0);
    expect(scene.elements.length).toBeGreaterThan(0);
  });

  it('title appears in elements', async () => {
    const { scene } = await layoutPoster(posterDoc, defaultTheme);
    const texts = scene.elements.filter(e => e.type === 'text') as any[];
    expect(texts.some(t => t.content === 'Architecture Overview')).toBe(true);
  });

  it('produces cell border rects for all 4 cells', async () => {
    const { scene } = await layoutPoster(posterDoc, defaultTheme);
    const rects = scene.elements.filter(e => e.type === 'rect') as any[];
    // 4 cell borders + possibly more from child scenes
    expect(rects.length).toBeGreaterThanOrEqual(4);
  });

  it('embeds child scenes as groups with transforms', async () => {
    const { scene } = await layoutPoster(posterDoc, defaultTheme);
    const groups = scene.elements.filter(e => e.type === 'group') as any[];
    const withTransform = groups.filter((g: any) => g.transform);
    expect(withTransform.length).toBeGreaterThan(0);
  });

  it('stat cell renders value text', async () => {
    const { scene } = await layoutPoster(posterDoc, defaultTheme);
    const allTexts = collectTexts(scene.elements);
    expect(allTexts.some(t => t === '99.9%')).toBe(true);
  });

  it('text cell renders its content', async () => {
    const { scene } = await layoutPoster(posterDoc, defaultTheme);
    const allTexts = collectTexts(scene.elements);
    expect(allTexts.some(t => t === 'All systems nominal.')).toBe(true);
  });

  it('auto-assigns row/col to cells without explicit position', async () => {
    // All cells lack row/col → auto-assigned; should not throw
    await expect(layoutPoster(posterDoc, defaultTheme)).resolves.toBeDefined();
  });

  it('theme change propagates to all child diagrams', async () => {
    const dark = resolveTheme({ palette: { background: '#1a1a2e', primary: '#FF6B6B' } }, defaultTheme);
    const { scene } = await layoutPoster(posterDoc, dark);
    expect(scene.background).toBe('#1a1a2e');
  });

  it('columns=1 stacks cells vertically', async () => {
    const single: PosterDocument = { ...posterDoc, grid: { columns: 1 } };
    const { scene } = await layoutPoster(single, defaultTheme);
    expect(scene.viewBox.height).toBeGreaterThan(scene.viewBox.width * 0.5);
  });
});

function collectTexts(elements: any[]): string[] {
  const out: string[] = [];
  for (const el of elements) {
    if (el.type === 'text') out.push(el.content);
    if (el.children) out.push(...collectTexts(el.children));
  }
  return out;
}

// ─── Grammar: links, traces, explicit IDs ─────────────────────────────────────

describe('poster grammar — cross-links', () => {
  it('parses explicit cell IDs', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 2

  cell SVC "Services" :: flow
    flowchart LR
      a[A] --> b[B]
  end

  cell DB "Database" :: flow
    flowchart LR
      x[X] --> y[Y]
  end
`);
    expect(ir.cells[0]!.id).toBe('SVC');
    expect(ir.cells[1]!.id).toBe('DB');
  });

  it('parses link declarations with all arrow types', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 2

  cell A :: flow
    flowchart LR
      n1[N1] --> n2[N2]
  end

  cell B :: flow
    flowchart LR
      m1[M1] --> m2[M2]
  end

  link A.n1 --> B.m1 "solid directed"
  link A.n2 -.-> B.m2 "dashed directed"
  link B.m1 <--> A.n1 "bidirectional"
  link B.m2 --- A.n2 "undirected"
  link A.n1 ..> B.m2 "dotted"
`);
    expect(ir.links).toHaveLength(5);
    const [l1, l2, l3, l4, l5] = ir.links!;
    expect(l1!.direction).toBe('directed');
    expect(l1!.style).toBe('solid');
    expect(l1!.label).toBe('solid directed');
    expect(l2!.style).toBe('dashed');
    expect(l3!.direction).toBe('bidirectional');
    expect(l4!.direction).toBe('undirected');
    expect(l5!.style).toBe('dotted');
  });

  it('parses @route annotation on links', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 2

  cell A :: flow
    flowchart LR
      n1[N1] --> n2[N2]
  end

  cell B :: flow
    flowchart LR
      m1[M1] --> m2[M2]
  end

  link A.n1 --> B.m1 "default"
  link A.n1 --> B.m1 "straight" @straight
  link A.n1 -.-> B.m2 "bezier" @bezier
  link A.n2 --> B.m2 "polyline" @polyline
  link A.n2 --> B.m1 "ortho" @orthogonal
`);
    expect(ir.links).toHaveLength(5);
    expect(ir.links![0]!.routing).toBeUndefined();
    expect(ir.links![1]!.routing).toBe('straight');
    expect(ir.links![2]!.routing).toBe('bezier');
    expect(ir.links![3]!.routing).toBe('polyline');
    expect(ir.links![4]!.routing).toBe('orthogonal');
  });

  it('parses { route: ..., key: val } property blocks on links', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 2

  cell A :: flow
    flowchart LR
      n1[N1] --> n2[N2]
  end

  cell B :: flow
    flowchart LR
      m1[M1] --> m2[M2]
  end

  link A.n1 --> B.m1 "with route" { route: bezier, tension: 0.8 }
  link A.n2 --> B.m2 "just props" { tension: 0.5 }
`);
    expect(ir.links).toHaveLength(2);
    expect(ir.links![0]!.routing).toBe('bezier');
    expect(ir.links![0]!.props).toEqual({ tension: 0.8 });
    expect(ir.links![1]!.routing).toBeUndefined();
    expect(ir.links![1]!.props).toEqual({ tension: 0.5 });
  });

  it('property block { route } overrides @annotation', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 2

  cell A :: flow
    flowchart LR
      n1[N1] --> n2[N2]
  end

  cell B :: flow
    flowchart LR
      m1[M1] --> m2[M2]
  end

  link A.n1 --> B.m1 "override" @straight { route: bezier }
`);
    expect(ir.links![0]!.routing).toBe('bezier');
  });

  it('parses trace declarations and desugars to links', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 2

  cell A :: flow
    flowchart LR
      start[Start] --> mid[Mid]
  end

  cell B :: flow
    flowchart LR
      end1[End] --> done[Done]
  end

  trace "Request Flow" : triggers A.start --> A.mid --> B.end1 --> B.done
`);
    expect(ir.traces).toHaveLength(1);
    expect(ir.traces![0]!.name).toBe('Request Flow');
    expect(ir.traces![0]!.type).toBe('triggers');
    expect(ir.traces![0]!.hops).toHaveLength(4);

    // Trace desugars to cross-cell links only (intra-cell hops are skipped)
    // A.start→A.mid and B.end1→B.done are intra-cell; only A.mid→B.end1 crosses cells
    const traceLinks = ir.links!.filter(l => l.traceId === ir.traces![0]!.id);
    expect(traceLinks).toHaveLength(1);
    expect(traceLinks[0]!.from.nodeId).toBe('mid');
    expect(traceLinks[0]!.to.nodeId).toBe('end1');
  });

  it('renders cross-links from parsed source end-to-end', async () => {
    const input = `poster "E2E"
  columns 2

  cell A "Left" :: flow
    flowchart LR
      x[X] --> y[Y]
  end

  cell B "Right" :: flow
    flowchart LR
      p[P] --> q[Q]
  end

  link A.y --> B.p "connects"
`;
    const ir = poster.parseMermaid(input);
    const { scene } = await layoutPoster(ir, defaultTheme);

    // Should have cross-link path elements (stroke-width thicker than internal edges)
    const paths = scene.elements.filter(e => e.type === 'path') as any[];
    const crossPaths = paths.filter((p: any) => p.markerEnd === 'triton-crosslink-arrow');
    expect(crossPaths).toHaveLength(1);

    // Should have label
    const texts = collectTexts(scene.elements);
    expect(texts).toContain('connects');
  });
});
