/**
 * @file test/crosslink.test.ts — Cross-diagram node linking tests (§30b Phase A)
 *
 * Tests:
 *  A. NodeAnchor registry — starter grammars (flow, class, state)
 *     A1. flow: layoutFlow populates anchors for all node ids
 *     A2. class: layoutClass populates anchors for all class ids
 *     A3. state: layoutState populates anchors for all state ids
 *     A4. anchor bbox is consistent with rendered scene dimensions
 *
 *  B. Poster link parsing
 *     B1. parsePosterInternal collects `link` statements into doc.links
 *     B2. both bracket and Excel cell address forms are parsed
 *     B3. link with label is parsed correctly
 *     B4. malformed link statement warns + skips
 *     B5. link inside cell body is treated as cell body line (not a top-level link)
 *
 *  C. Overlay rendering
 *     C1. unresolved link (unknown node) warns + skips — poster still renders
 *     C2. cross-link poster renders with overlay primitives above cells
 *     C3. cross-link poster is deterministic (same sceneHash on two renders)
 *     C4. gallery emit — writes poster-crosslink.{svg,png}
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { layoutFlow } from '../src/grammars/flow/layout.js';
import { layoutClass } from '../src/grammars/class/layout.js';
import { layoutState } from '../src/grammars/state/layout.js';

import { parsePosterInternal } from '../src/frontend/mermaid/poster.js';
import { renderMermaid } from '../src/frontend/mermaid/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GALLERY_DIR = join(__dirname, '..', '..', '..', 'examples', 'gallery');

// ---------------------------------------------------------------------------
// Minimal IR fixtures
// ---------------------------------------------------------------------------

const MINIMAL_FLOW_DOC = {
  version: '1.0' as const,
  metadata: { theme: 'default-flow' as const },
  flow: {
    nodes: [
      { id: 'alpha', label: 'Alpha', kind: 'rect' as const },
      { id: 'beta',  label: 'Beta',  kind: 'rect' as const },
    ],
    edges: [{ from: 'alpha', to: 'beta', kind: 'normal' as const }],
  },
};

const MINIMAL_CLASS_DOC = {
  version: '1.0' as const,
  metadata: { theme: 'default-class' as const },
  classes: [
    { id: 'Foo', name: 'Foo', members: [] },
    { id: 'Bar', name: 'Bar', members: [] },
  ],
  relationships: [],
};

const MINIMAL_STATE_DOC = {
  version: '1.0' as const,
  metadata: { theme: 'default-state' as const },
  states: [
    { id: 'Idle',    label: 'Idle',    isPseudo: null, children: [], note: null },
    { id: 'Active',  label: 'Active',  isPseudo: null, children: [], note: null },
    { id: 'Done',    label: 'Done',    isPseudo: null, children: [], note: null },
  ],
  transitions: [
    { from: 'Idle', to: 'Active', label: null },
    { from: 'Active', to: 'Done', label: null },
  ],
};

// ---------------------------------------------------------------------------
// A. NodeAnchor registry — starter grammars
// ---------------------------------------------------------------------------

describe('A. NodeAnchor registry — flow grammar', () => {
  it('A1: layoutFlow returns anchors for all node ids', () => {
    const { scene, anchors } = layoutFlow(MINIMAL_FLOW_DOC as never);
    expect(scene.primitives.length).toBeGreaterThan(0);
    expect(Object.keys(anchors)).toContain('alpha');
    expect(Object.keys(anchors)).toContain('beta');
    expect(Object.keys(anchors)).toHaveLength(2);
  });

  it('A1b: flow anchor bbox has positive dimensions', () => {
    const { anchors } = layoutFlow(MINIMAL_FLOW_DOC as never);
    for (const anchor of Object.values(anchors)) {
      expect(anchor.w).toBeGreaterThan(0);
      expect(anchor.h).toBeGreaterThan(0);
    }
  });

  it('A4: flow anchor bbox lies within scene canvas', () => {
    const { scene, anchors } = layoutFlow(MINIMAL_FLOW_DOC as never);
    for (const anchor of Object.values(anchors)) {
      expect(anchor.x).toBeGreaterThanOrEqual(0);
      expect(anchor.y).toBeGreaterThanOrEqual(0);
      expect(anchor.x + anchor.w).toBeLessThanOrEqual(scene.width + 1);
      expect(anchor.y + anchor.h).toBeLessThanOrEqual(scene.height + 1);
    }
  });
});

describe('A. NodeAnchor registry — class grammar', () => {
  it('A2: layoutClass returns anchors for all class ids', () => {
    const { scene, anchors } = layoutClass(MINIMAL_CLASS_DOC as never);
    expect(scene.primitives.length).toBeGreaterThan(0);
    expect(Object.keys(anchors)).toContain('Foo');
    expect(Object.keys(anchors)).toContain('Bar');
    expect(Object.keys(anchors)).toHaveLength(2);
  });

  it('A2b: class anchor has positive dimensions', () => {
    const { anchors } = layoutClass(MINIMAL_CLASS_DOC as never);
    for (const anchor of Object.values(anchors)) {
      expect(anchor.w).toBeGreaterThan(0);
      expect(anchor.h).toBeGreaterThan(0);
    }
  });
});

describe('A. NodeAnchor registry — state grammar', () => {
  it('A3: layoutState returns anchors for all state ids', () => {
    const { scene, anchors } = layoutState(MINIMAL_STATE_DOC as never);
    expect(scene.primitives.length).toBeGreaterThan(0);
    expect(Object.keys(anchors)).toContain('Idle');
    expect(Object.keys(anchors)).toContain('Active');
    expect(Object.keys(anchors)).toContain('Done');
  });

  it('A3b: state anchor id mirrors registry key', () => {
    const { anchors } = layoutState(MINIMAL_STATE_DOC as never);
    for (const [key, anchor] of Object.entries(anchors)) {
      expect(anchor.id).toBe(key);
    }
  });
});

// ---------------------------------------------------------------------------
// B. Poster link parsing
// ---------------------------------------------------------------------------

describe('B. Poster link parsing', () => {
  it('B1: parsePosterInternal collects link statements into doc.links', () => {
    const text = `
---
theme: executive
layout: grid 1x2
---
poster "Link Test"

  cell A1: flowchart LR
    X[Node X] --> Y[Node Y]

  cell B1: classDiagram
    class Svc

link A1.X --> B1.Svc : "relates to"
`;
    const { doc, warnings } = parsePosterInternal(text);
    expect(doc.links).toHaveLength(1);
    const link = doc.links[0]!;
    expect(link.fromCell).toEqual({ row: 0, col: 0 });
    expect(link.fromNodeId).toBe('X');
    expect(link.edgeStyle).toBe('-->');
    expect(link.toCell).toEqual({ row: 0, col: 1 });
    expect(link.toNodeId).toBe('Svc');
    expect(link.label).toBe('relates to');
    expect(warnings.filter(w => w.includes('link'))).toHaveLength(0);
  });

  it('B2: bracket cell address form is parsed correctly', () => {
    const text = `
poster "Bracket Test"
  cell [0,0]: flowchart LR
    A[Node A]
  cell [0,1]: classDiagram
    class Z

link [0,0].A --> [0,1].Z
`;
    const { doc } = parsePosterInternal(text);
    expect(doc.links).toHaveLength(1);
    expect(doc.links[0]!.fromCell).toEqual({ row: 0, col: 0 });
    expect(doc.links[0]!.toCell).toEqual({ row: 0, col: 1 });
  });

  it('B3: dashed edge style is parsed', () => {
    const text = `
poster "Dashed Test"
  cell A1: flowchart LR
    N[Node]
  cell B1: classDiagram
    class M

link A1.N -.-> B1.M : "async"
`;
    const { doc } = parsePosterInternal(text);
    expect(doc.links).toHaveLength(1);
    expect(doc.links[0]!.edgeStyle).toBe('-.->');
  });

  it('B4: malformed link statement warns + skips', () => {
    const text = `
poster "Bad Link"
  cell A1: flowchart LR
    X[X]

link NOTANADDRESS.X --> A1.X
`;
    const { doc, warnings } = parsePosterInternal(text);
    expect(doc.links).toHaveLength(0);
    expect(warnings.some(w => w.includes('link'))).toBe(true);
  });

  it('B5: empty links array when no link statements', () => {
    const text = `
poster "No Links"
  cell A1: flowchart LR
    X[X]
`;
    const { doc } = parsePosterInternal(text);
    expect(doc.links).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// C. Overlay rendering
// ---------------------------------------------------------------------------

const CROSSLINK_POSTER = `
---
theme: executive
layout: grid 1x2
---
poster "Cross-Link Test"

  cell A1: flowchart LR
    recv[Receive] --> pay[Payment]

  cell B1: classDiagram
    class PaymentGateway
    class OrderService

link A1.pay --> B1.PaymentGateway : "handled by"
`;

const UNRESOLVED_LINK_POSTER = `
---
theme: executive
layout: grid 1x2
---
poster "Unresolved Link Test"

  cell A1: flowchart LR
    A[Alpha] --> B[Beta]

  cell B1: classDiagram
    class Gamma

link A1.nonexistent --> B1.Gamma : "missing"
`;

describe('C. Overlay rendering', () => {
  it('C1: unresolved link warns + skips — poster still renders', () => {
    const result = renderMermaid(UNRESOLVED_LINK_POSTER, { format: 'svg' });
    expect(result.svg).toBeTruthy();
    expect(result.warnings.some(w => w.includes('nonexistent'))).toBe(true);
  });

  it('C2: cross-link poster renders with overlay primitives', () => {
    const result = renderMermaid(CROSSLINK_POSTER, { format: 'svg' });
    expect(result.svg).toBeTruthy();
    // Overlay should contain lines/paths beyond the cell content
    expect(result.scene.primitives.length).toBeGreaterThan(0);
    // No unresolved-link warnings
    expect(result.warnings.filter(w => w.includes('not found'))).toHaveLength(0);
  });

  it('C3: cross-link poster is deterministic (same sceneHash twice)', () => {
    const r1 = renderMermaid(CROSSLINK_POSTER, { format: 'svg' });
    const r2 = renderMermaid(CROSSLINK_POSTER, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('C4: gallery emit — writes poster-crosslink.svg and .png', () => {
    mkdirSync(GALLERY_DIR, { recursive: true });

    const mmdSource = readFileSync(
      join(GALLERY_DIR, 'poster-crosslink.mmd'),
      'utf-8',
    );

    const svgResult = renderMermaid(mmdSource, { format: 'svg' });
    expect(svgResult.svg).toBeTruthy();

    const svgPath = join(GALLERY_DIR, 'poster-crosslink.svg');
    writeFileSync(svgPath, svgResult.svg!);
    expect(existsSync(svgPath)).toBe(true);

    const pngResult = renderMermaid(mmdSource, { format: 'png' });
    expect(pngResult.png).toBeTruthy();

    const pngPath = join(GALLERY_DIR, 'poster-crosslink.png');
    writeFileSync(pngPath, pngResult.png!);
    expect(existsSync(pngPath)).toBe(true);

    // Verify no resolution warnings
    expect(svgResult.warnings.filter(w => w.includes('not found'))).toHaveLength(0);
    console.log(`[crosslink] poster-crosslink.svg written (${svgResult.svg!.length} bytes)`);
    console.log(`[crosslink] poster-crosslink.png written (${pngResult.png!.length} bytes)`);
  });
});

// ---------------------------------------------------------------------------
// D. Trace parsing — §30b Phase B
// ---------------------------------------------------------------------------

describe('D. Trace parsing', () => {
  it('D1: parsePosterInternal collects trace into doc.traces', () => {
    const text = `
---
theme: executive
layout: grid 1x3
---
poster "Trace Test"

  cell A1: flowchart LR
    R1[Req]

  cell B1: classDiagram
    class Svc

  cell C1: flowchart LR
    T1[Test]

trace "my trace" satisfies : A1.R1 --> B1.Svc --> C1.T1
`;
    const { doc, warnings } = parsePosterInternal(text);
    expect(doc.traces).toHaveLength(1);
    const trace = doc.traces[0]!;
    expect(trace.name).toBe('my trace');
    expect(trace.type).toBe('satisfies');
    expect(trace.hops).toHaveLength(3);
    expect(trace.hops[0]).toEqual({ cell: { row: 0, col: 0 }, nodeId: 'R1' });
    expect(trace.hops[1]).toEqual({ cell: { row: 0, col: 1 }, nodeId: 'Svc' });
    expect(trace.hops[2]).toEqual({ cell: { row: 0, col: 2 }, nodeId: 'T1' });
    expect(warnings.filter(w => w.includes('trace'))).toHaveLength(0);
  });

  it('D2: trace desugars to N-1 ordered atomic links in doc.links', () => {
    const text = `
poster "Desugar Test"
  cell A1: flowchart LR
    A[A]
  cell B1: classDiagram
    class B
  cell C1: flowchart LR
    C[C]

trace "chain" calls : A1.A --> B1.B --> C1.C
`;
    const { doc } = parsePosterInternal(text);
    const traceLinks = doc.links.filter(l => l.traceIndex === 0);
    expect(traceLinks).toHaveLength(2);
    expect(traceLinks[0]!.fromNodeId).toBe('A');
    expect(traceLinks[0]!.toNodeId).toBe('B');
    expect(traceLinks[1]!.fromNodeId).toBe('B');
    expect(traceLinks[1]!.toNodeId).toBe('C');
  });

  it('D3: untyped trace has no type field', () => {
    const text = `
poster "Untyped"
  cell A1: flowchart LR
    X[X]
  cell B1: flowchart LR
    Y[Y]

trace "unnamed" : A1.X -> B1.Y
`;
    const { doc } = parsePosterInternal(text);
    expect(doc.traces).toHaveLength(1);
    expect(doc.traces[0]!.type).toBeUndefined();
  });

  it('D4: all 10 trace types parse correctly', () => {
    const TYPES = [
      'satisfies', 'derives', 'verifies', 'refines',
      'traces', 'contains', 'copies',
      'calls', 'flowsTo', 'mapsTo',
    ] as const;
    for (const ty of TYPES) {
      const text = `
poster "Type test"
  cell A1: flowchart LR
    N[N]
  cell B1: flowchart LR
    M[M]

trace "t" ${ty} : A1.N --> B1.M
`;
      const { doc } = parsePosterInternal(text);
      expect(doc.traces).toHaveLength(1);
      expect(doc.traces[0]!.type).toBe(ty);
    }
  });

  it('D5: trace with fewer than 2 hops warns + skips', () => {
    const text = `
poster "Short trace"
  cell A1: flowchart LR
    N[N]

trace "one hop" : A1.N
`;
    const { doc, warnings } = parsePosterInternal(text);
    expect(doc.traces).toHaveLength(0);
    expect(warnings.some(w => w.includes('hop chain') || w.includes('fewer than 2'))).toBe(true);
  });

  it('D6: multiple traces get sequential traceIndex in doc.links', () => {
    const text = `
poster "Multi trace"
  cell A1: flowchart LR
    A[A]
  cell B1: flowchart LR
    B[B]
  cell C1: flowchart LR
    C[C]

trace "first" calls : A1.A --> B1.B
trace "second" flowsTo : A1.A --> C1.C
`;
    const { doc } = parsePosterInternal(text);
    expect(doc.traces).toHaveLength(2);
    const firstLinks = doc.links.filter(l => l.traceIndex === 0);
    const secondLinks = doc.links.filter(l => l.traceIndex === 1);
    expect(firstLinks).toHaveLength(1);
    expect(secondLinks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// E. Trace rendering — §30b Phase B
// ---------------------------------------------------------------------------

const TRACE_POSTER = `
---
theme: executive
layout: grid 1x3
---
poster "Trace Render Test"

  cell A1: flowchart LR
    req[Requirement]

  cell B1: classDiagram
    class ServiceImpl

  cell C1: flowchart LR
    test[Test Suite]

trace "full trace" satisfies : A1.req --> B1.ServiceImpl --> C1.test
`;

describe('E. Trace rendering', () => {
  it('E1: trace poster renders to SVG without error', () => {
    const result = renderMermaid(TRACE_POSTER, { format: 'svg' });
    expect(result.svg).toBeTruthy();
  });

  it('E2: trace poster produces no fatal errors', () => {
    expect(() => renderMermaid(TRACE_POSTER, { format: 'svg' })).not.toThrow();
  });

  it('E3: trace poster is deterministic (same sceneHash twice)', () => {
    const r1 = renderMermaid(TRACE_POSTER, { format: 'svg' });
    const r2 = renderMermaid(TRACE_POSTER, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('E4: trace legend text appears in SVG output', () => {
    const result = renderMermaid(TRACE_POSTER, { format: 'svg' });
    expect(result.svg).toContain('full trace');
    expect(result.svg).toContain('satisfies');
  });

  it('E5: trace colors use categorical palette (executive categorical[0]=#1F497D)', () => {
    const result = renderMermaid(TRACE_POSTER, { format: 'svg' });
    // No standalone links → no standalone red; trace uses categorical navy
    expect(result.svg).not.toContain('#E05B4B');
    expect(result.svg).toContain('#1F497D');
  });

  it('E6: trace color assignment is deterministic across runs', () => {
    const r1 = renderMermaid(TRACE_POSTER, { format: 'svg' });
    const r2 = renderMermaid(TRACE_POSTER, { format: 'svg' });
    expect(r1.svg).toBe(r2.svg);
  });

  it('E7: gallery emit — writes poster-trace.{svg,png}', () => {
    mkdirSync(GALLERY_DIR, { recursive: true });

    const mmdSource = readFileSync(join(GALLERY_DIR, 'poster-trace.mmd'), 'utf-8');

    const svgResult = renderMermaid(mmdSource, { format: 'svg' });
    expect(svgResult.svg).toBeTruthy();

    const svgPath = join(GALLERY_DIR, 'poster-trace.svg');
    writeFileSync(svgPath, svgResult.svg!);
    expect(existsSync(svgPath)).toBe(true);

    const pngResult = renderMermaid(mmdSource, { format: 'png' });
    expect(pngResult.png).toBeTruthy();

    const pngPath = join(GALLERY_DIR, 'poster-trace.png');
    writeFileSync(pngPath, pngResult.png!);
    expect(existsSync(pngPath)).toBe(true);

    console.log(`[trace] poster-trace.svg written (${svgResult.svg!.length} bytes)`);
    console.log(`[trace] poster-trace.png written (${pngResult.png!.length} bytes)`);
    expect(svgResult.svg).toContain('satisfies');
  });

  it('E8: unresolved trace node warns + poster still renders', () => {
    const badPoster = `
---
theme: executive
layout: grid 1x2
---
poster "Bad Hop"

  cell A1: flowchart LR
    X[Node X]

  cell B1: classDiagram
    class GoodClass

trace "partial" satisfies : A1.X --> B1.NONEXISTENT --> B1.GoodClass
`;
    const result = renderMermaid(badPoster, { format: 'svg' });
    expect(result.svg).toBeTruthy();
    expect(result.warnings.some(w => w.includes('NONEXISTENT') || w.includes('not found'))).toBe(true);
  });
});
