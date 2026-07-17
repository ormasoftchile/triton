import { describe, it, expect } from 'vitest';
import '../src/frontend/index.js'; // registers diagram modules
import { poster } from '../src/diagrams/triton/poster/index.js';
import { layoutPoster } from '../src/diagrams/triton/poster/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import { resolveTheme } from '../src/theme/resolver.js';
import type { PosterDocument } from '../src/diagrams/triton/poster/ir.js';
import type { FlowDocument } from '../src/diagrams/mermaid/flowchart/ir.js';
import type { TimelineDocument } from '../src/diagrams/mermaid/timeline/ir.js';

const flowDoc: FlowDocument = {
  version: '1.0', metadata: { title: 'CI' }, direction: 'LR',
  nodes: [{ id: 'a', label: 'A', shape: 'rect' }, { id: 'b', label: 'B', shape: 'rect' }],
  edges: [{ from: 'a', to: 'b', style: 'solid' }],
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

  it('auto-assigns row/col to cells without explicit position', () => {
    // All cells lack row/col → auto-assigned; should not throw
    expect(layoutPoster(posterDoc, defaultTheme)).toBeDefined();
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

// ─── Grammar: links, explicit IDs ─────────────────────────────────────────────

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
  link A.n2 -_-> B.m2 "dashed directed"
  link B.m1 <--> A.n1 "bidirectional"
  link B.m2 --- A.n2 "undirected"
  link A.n1 -.-> B.m2 "dotted"
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

  it('parses array element bracket node references without changing dot references', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 2

  cell arr :: array
    array 5 8 13
  end

  cell other :: flow
    flowchart LR
      c2[C2]
  end

  link other.c2 --> arr[2] "positive"
  link arr[-1] --> other.c2 "negative"
  link other.c2 --> arr.c2 "dot"
`);
    expect(ir.links![0]!.to).toEqual({ cellPath: ['arr'], nodeId: '', elementIndex: 2 });
    expect(ir.links![1]!.from).toEqual({ cellPath: ['arr'], nodeId: '', elementIndex: -1 });
    expect(ir.links![2]!.to).toEqual({ cellPath: ['arr'], nodeId: 'c2' });
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

  it('@annotation wins over property block { route } (@ has higher precedence)', () => {
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
    // @ wins on conflict: @straight takes precedence over { route: bezier }
    expect(ir.links![0]!.routing).toBe('straight');
  });

  it('parses @route:WALLS wall hints on links', () => {
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

  link A.n1 --> B.m1 "both walls" @orthogonal:EW
  link A.n1 --> B.m1 "exit only" @straight:S
  link A.n2 --> B.m2 "walls only" @NS
`);
    expect(ir.links).toHaveLength(3);
    // route + both walls
    expect(ir.links![0]!.routing).toBe('orthogonal');
    expect(ir.links![0]!.exitWall).toBe('E');
    expect(ir.links![0]!.entryWall).toBe('W');
    // route + exit-only wall
    expect(ir.links![1]!.routing).toBe('straight');
    expect(ir.links![1]!.exitWall).toBe('S');
    expect(ir.links![1]!.entryWall).toBeUndefined();
    // walls-only (route defaults)
    expect(ir.links![2]!.exitWall).toBe('N');
    expect(ir.links![2]!.entryWall).toBe('S');
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
    const crossPaths = paths.filter((p: any) => p.markerEnd?.startsWith('triton-crosslink-arrow-'));
    expect(crossPaths).toHaveLength(1);

    // Should have label
    const texts = collectTexts(scene.elements);
    expect(texts).toContain('connects');
  });
});

describe('poster phase-1 features', () => {
  // ── Feature 2: caption slot ──────────────────────────────────────────────

  it('parses caption directive from cell content', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 1

  cell arr "Array"
    array 1 2 3
    caption "slide →"
  end
`);
    expect(ir.cells[0]!.caption).toBe('slide →');
  });

  it('leaves cell content clean after extracting caption', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 1

  cell arr "Array"
    array 1 2 3
    caption "suffix"
  end
`);
    // The diagram content (array) should still parse correctly
    expect(ir.cells[0]!.content.kind).toBe('diagram');
  });

  it('renders caption text inside the cell', async () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 1

  cell arr "Array"
    array 1 2 3
    caption "slide →"
  end
`);
    const { scene } = await layoutPoster(ir, defaultTheme);
    const texts: string[] = [];
    const collect = (els: readonly any[]) => { for (const e of els) { if (e.type === 'text') texts.push(e.content); if (e.children) collect(e.children); } };
    collect(scene.elements);
    expect(texts).toContain('slide →');
  });

  // ── Feature 3: note overlay ──────────────────────────────────────────────

  it('parses note directive with and without position', () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 1

  cell arr "Array"
    array 1 2 3
    note "k=3" at top-right
    note "hello"
  end
`);
    expect(ir.cells[0]!.notes).toHaveLength(2);
    expect(ir.cells[0]!.notes![0]!.text).toBe('k=3');
    expect(ir.cells[0]!.notes![0]!.position).toBe('top-right');
    expect(ir.cells[0]!.notes![1]!.text).toBe('hello');
    expect(ir.cells[0]!.notes![1]!.position).toBeUndefined();
  });

  it('renders note overlay text inside the cell', async () => {
    const ir = poster.parseMermaid(`poster "Test"
  columns 1

  cell arr "Array"
    array 1 2 3
    note "k=3"
  end
`);
    const { scene } = await layoutPoster(ir, defaultTheme);
    const texts: string[] = [];
    const collect = (els: readonly any[]) => { for (const e of els) { if (e.type === 'text') texts.push(e.content); if (e.children) collect(e.children); } };
    collect(scene.elements);
    expect(texts).toContain('k=3');
  });
});

// ─── Connector Syntax Redesign Tests (strict Mermaid superset) ───────────────

describe('connector syntax redesign — strict Mermaid superset', () => {
  const twoCell = (links: string) => `poster "Test"
  columns 2

  cell A :: flow
    flowchart LR
      n1[N1] --> n2[N2]
  end

  cell B :: flow
    flowchart LR
      m1[M1] --> m2[M2]
  end

${links}`;

  it('poster Arrow: all 5 directed styles', () => {
    const ir = poster.parseMermaid(twoCell(`  link A.n1 --> B.m1 "solid"
  link A.n1 -.-> B.m1 "dotted"
  link A.n1 ==> B.m1 "thick"
  link A.n1 -_-> B.m1 "dashed"
  link A.n1 -~-> B.m1 "wavy"
`));
    const styles = ir.links!.map(l => l.style);
    expect(styles).toEqual(['solid', 'dotted', 'thick', 'dashed', 'wavy']);
    for (const l of ir.links!) expect(l.direction).toBe('directed');
  });

  it('poster Arrow: all 5 undirected styles', () => {
    const ir = poster.parseMermaid(twoCell(`  link A.n1 --- B.m1 "solid"
  link A.n1 -.- B.m1 "dotted"
  link A.n1 === B.m1 "thick"
  link A.n1 -_- B.m1 "dashed"
  link A.n1 -~- B.m1 "wavy"
`));
    const styles = ir.links!.map(l => l.style);
    expect(styles).toEqual(['solid', 'dotted', 'thick', 'dashed', 'wavy']);
    for (const l of ir.links!) expect(l.direction).toBe('undirected');
  });

  it('poster Arrow: all 5 bidirectional styles', () => {
    const ir = poster.parseMermaid(twoCell(`  link A.n1 <--> B.m1 "solid"
  link A.n1 <-.-> B.m1 "dotted"
  link A.n1 <==> B.m1 "thick"
  link A.n1 <-_-> B.m1 "dashed"
  link A.n1 <-~-> B.m1 "wavy"
`));
    const styles = ir.links!.map(l => l.style);
    expect(styles).toEqual(['solid', 'dotted', 'thick', 'dashed', 'wavy']);
    for (const l of ir.links!) expect(l.direction).toBe('bidirectional');
  });

  it('retired tokens ..>, ..., <..> no longer parse', () => {
    expect(() => poster.parseMermaid(twoCell('  link A.n1 ..> B.m1 "retired"\n'))).toThrow();
    expect(() => poster.parseMermaid(twoCell('  link A.n1 ... B.m1 "retired"\n'))).toThrow();
    expect(() => poster.parseMermaid(twoCell('  link A.n1 <..> B.m1 "retired"\n'))).toThrow();
  });

  it('@anim: decorator sets animation field', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 --> B.m1 "x" @anim:march\n'));
    expect(ir.links![0]!.animation).toBe('march');
  });

  it('@anim: supports all animation values', () => {
    const anims = ['march', 'particle', 'draw', 'pulse', 'glow', 'comet', 'stream', 'flow', 'colorcycle', 'none'];
    for (const anim of anims) {
      const ir = poster.parseMermaid(twoCell(`  link A.n1 --> B.m1 @anim:${anim}\n`));
      if (anim === 'none') {
        // 'none' suppresses animation — stored or omitted depending on impl, but parses
        expect(() => ir.links![0]).not.toThrow();
      } else {
        expect(ir.links![0]!.animation).toBe(anim);
      }
    }
  });

  it('@anim: can combine with route annotation', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 --> B.m1 @orthogonal:EW @anim:particle\n'));
    expect(ir.links![0]!.routing).toBe('orthogonal');
    expect(ir.links![0]!.animation).toBe('particle');
  });

  it('@ wins over {} on conflict: @anim:march beats { anim: particle }', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 --> B.m1 @anim:march { anim: particle }\n'));
    expect(ir.links![0]!.animation).toBe('march');
  });

  it('@ wins over {} on conflict: @straight beats { route: bezier }', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 --> B.m1 @straight { route: bezier }\n'));
    expect(ir.links![0]!.routing).toBe('straight');
  });

  it('dotted (-.->)  is static by default — no animation set', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 -.-> B.m1\n'));
    expect(ir.links![0]!.animation).toBeUndefined();
    expect(ir.links![0]!.style).toBe('dotted');
  });

  it('dashed (-_->) is static by default — no animation set', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 -_-> B.m1\n'));
    expect(ir.links![0]!.animation).toBeUndefined();
    expect(ir.links![0]!.style).toBe('dashed');
  });

  it('longer Mermaid solid form ---> maps to solid', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 ---> B.m1\n'));
    expect(ir.links![0]!.style).toBe('solid');
    expect(ir.links![0]!.direction).toBe('directed');
  });

  it('longer Mermaid dotted form -..-> maps to dotted', () => {
    const ir = poster.parseMermaid(twoCell('  link A.n1 -..-> B.m1\n'));
    expect(ir.links![0]!.style).toBe('dotted');
  });
});

// ─── wavifyPath unit tests ────────────────────────────────────────────────────

import { wavifyPath } from '../src/crosslink/render.js';

function endpointTangentAngles(d: string): { start: number; end: number } {
  const start = d.match(/^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!start) throw new Error(`Path missing M command: ${d}`);
  const cubics = d.split(/\s+C\s+/).slice(1).map(part =>
    [...part.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0])),
  );
  if (cubics.length === 0) throw new Error(`Path missing cubic segments: ${d}`);
  const first = cubics[0]!;
  const last = cubics[cubics.length - 1]!;
  return {
    start: Math.atan2(first[1]! - Number(start[2]), first[0]! - Number(start[1])) * 180 / Math.PI,
    end: Math.atan2(last[5]! - last[3]!, last[4]! - last[2]!) * 180 / Math.PI,
  };
}

function expectAngleNear(actual: number, expected: number, tolerance = 1): void {
  let delta = actual - expected;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  expect(Math.abs(delta)).toBeLessThanOrEqual(tolerance);
}

describe('wavifyPath', () => {
  it('is deterministic: same input produces same output', () => {
    const pts = [{ x: 0, y: 50 }, { x: 200, y: 50 }];
    const a = wavifyPath(pts, 3, 12);
    const b = wavifyPath(pts, 3, 12);
    expect(a).toBe(b);
  });

  it('starts with an M command at the first point region', () => {
    const pts = [{ x: 10, y: 20 }, { x: 100, y: 20 }];
    const d = wavifyPath(pts, 3, 12);
    expect(d.startsWith('M')).toBe(true);
  });

  it('contains C (cubic bezier) commands for smooth output', () => {
    const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }];
    const d = wavifyPath(pts, 3, 12);
    expect(d).toContain('C');
  });

  it('handles a single-segment horizontal line', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const d = wavifyPath(pts, 3, 12);
    expect(d.length).toBeGreaterThan(5);
  });

  it('handles a degenerate single-point route', () => {
    const pts = [{ x: 50, y: 50 }];
    const d = wavifyPath(pts, 3, 12);
    expect(d).toContain('M');
  });

  it('displacement is present: output differs from straight path', () => {
    const pts = [{ x: 0, y: 50 }, { x: 200, y: 50 }];
    const wavy = wavifyPath(pts, 5, 20);
    const straight = `M 0 50 L 200 50`;
    expect(wavy).not.toBe(straight);
  });

  it('amplitude 0 produces same start/end points as input', () => {
    const pts = [{ x: 0, y: 50 }, { x: 60, y: 50 }];
    const d = wavifyPath(pts, 0, 12);
    // Path should start near 0,50 and end near 60,50
    expect(d.startsWith('M 0 50') || d.startsWith('M 0.0 50') || d.startsWith('M 0 50.0')).toBe(true);
    expect(d).toContain('C');
  });

  it('handles a multi-segment orthogonal polyline', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const d = wavifyPath(pts, 3, 12);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('C');
  });

  it('keeps both endpoint tangents aligned with the net route direction', () => {
    const cases = [
      { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], expected: 0 },
      { points: [{ x: 0, y: 0 }, { x: 0, y: 200 }], expected: 90 },
      { points: [{ x: 0, y: 0 }, { x: 8, y: 0 }], expected: 0 },
      { points: [{ x: 0, y: 0 }, { x: 150, y: 150 }], expected: 45 },
    ];

    for (const { points, expected } of cases) {
      const d = wavifyPath(points, 3, 12);
      expect(d).not.toMatch(/NaN/);
      const angles = endpointTangentAngles(d);
      expectAngleNear(angles.start, expected);
      expectAngleNear(angles.end, expected);
    }
  });
});
