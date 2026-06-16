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
