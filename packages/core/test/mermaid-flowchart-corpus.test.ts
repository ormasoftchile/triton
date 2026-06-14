/**
 * @file test/mermaid-flowchart-corpus.test.ts — Real-Mermaid corpus validation.
 *
 * These are the crawl-derived acceptance tests. Each case exercises a real
 * Mermaid pattern from the official docs or community examples. All seven
 * acceptance criteria from the hardening spec are covered here.
 *
 * Acceptance criteria:
 *   AC1  Whitespace-independent edges: A-->B, A-->C etc. with NO spaces.
 *   AC2  Full edge operators + inline label forms (== text ==>, -. text .->).
 *   AC3  Extended node shapes with CLEAN labels (no delimiter mangling).
 *   AC4  Graceful degradation: unsupported constructs warn, never drop nodes.
 *   AC5  Public warnings: parseMermaid returns warnings: string[].
 *   AC6  Direction: TD/TB/LR/RL/BT all parsed; TB/TD warns about deferred layout.
 *   AC7  Deferrals (subgraph, classDef, style, click) warn but do not corrupt.
 */

import { describe, expect, it } from 'vitest';

import { parseMermaid } from '../src/frontend/mermaid/index.js';
import { parseFlowchart } from '../src/frontend/mermaid/flowchart.js';
import { parseFlowchartInternal } from '../src/frontend/mermaid/flowchart.js';

// ---------------------------------------------------------------------------
// AC1 — Whitespace-independent edges (THE #1 FIX)
// ---------------------------------------------------------------------------

describe('AC1 — whitespace-independent edges', () => {
  it('parses compact diamond: A-->B (no spaces)', () => {
    const doc = parseFlowchart('flowchart LR\n A-->B');
    expect(doc.flow.nodes).toHaveLength(2);
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('parses the canonical 4-node 4-edge compact diagram (official Mermaid docs pattern)', () => {
    const text = `graph TD
 A-->B
 A-->C
 B-->D
 C-->D`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(4);
    expect(doc.flow.edges).toHaveLength(4);
    expect(doc.flow.edges.map((e) => `${e.from}->${e.to}`)).toEqual([
      'a->b',
      'a->c',
      'b->d',
      'c->d',
    ]);
  });

  it('parses compact with labeled pipe: A-->|x|B (no outer spaces)', () => {
    const doc = parseFlowchart('flowchart LR\n A-->|done|B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', label: 'done' });
  });

  it('parses compact dotted: A-.->B', () => {
    const doc = parseFlowchart('flowchart LR\n A-.->B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'async', style: 'dotted' });
  });

  it('parses compact thick: A==>B', () => {
    const doc = parseFlowchart('flowchart LR\n A==>B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'sync', style: 'solid' });
  });

  it('parses compact cross terminus: A--xB', () => {
    const doc = parseFlowchart('flowchart LR\n A--xB');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('parses compact undirected: A---B', () => {
    const doc = parseFlowchart('flowchart LR\n A---B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('parses compact chain: A-->B-->C-->D (no spaces)', () => {
    const doc = parseFlowchart('flowchart LR\n A-->B-->C-->D');
    expect(doc.flow.nodes).toHaveLength(4);
    expect(doc.flow.edges).toHaveLength(3);
  });

  it('mixes spaced and unspaced edges in same diagram', () => {
    const text = `flowchart LR
 A-->B
 B --> C
 C-->D
 D --> E`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(5);
    expect(doc.flow.edges).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Full edge operator set + inline label forms
// ---------------------------------------------------------------------------

describe('AC2 — full edge operators', () => {
  it('== yes ==> (inline thick label) → 2 nodes, 1 edge labeled "yes"', () => {
    const doc = parseFlowchart('flowchart LR\n A == yes ==> B');
    expect(doc.flow.nodes).toHaveLength(2);
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', label: 'yes' });
  });

  it('-. text .-> (inline dotted label) → 1 edge labeled "processing"', () => {
    const doc = parseFlowchart('flowchart LR\n A -. processing .-> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({
      kind: 'async',
      style: 'dotted',
      label: 'processing',
    });
  });

  it('-- label --> (inline directed label) → 1 edge labeled "ok"', () => {
    const doc = parseFlowchart('flowchart LR\n A -- ok --> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ label: 'ok' });
  });

  it('==> (thick unlabeled) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A ==> B');
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'sync', style: 'solid' });
  });

  it('==>|label| (thick pipe label) → labeled sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A ==>|approved| B');
    expect(doc.flow.edges[0]).toMatchObject({ label: 'approved', kind: 'sync' });
  });

  it('--- (undirected) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A --- B');
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'sync', style: 'solid' });
  });

  it('-.- (undirected dotted) → async/dotted', () => {
    const doc = parseFlowchart('flowchart LR\n A -.- B');
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'async', style: 'dotted' });
  });

  it('-. text .-> pipe label → labeled async/dotted', () => {
    const doc = parseFlowchart('flowchart LR\n A -.->|queued| B');
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'async', style: 'dotted', label: 'queued' });
  });

  it('<--> (bidirectional) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A <--> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', kind: 'sync' });
  });

  it('o--o (circle-circle) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A o--o B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('--x (cross terminus) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A --x B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('--o (circle terminus) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A --o B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('<==> (thick bidirectional) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A <==> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'sync', style: 'solid' });
  });

  it('=== (thick undirected) → sync/solid', () => {
    const doc = parseFlowchart('flowchart LR\n A === B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'sync', style: 'solid' });
  });

  it('<-.-> (dotted bidirectional) → async/dotted', () => {
    const doc = parseFlowchart('flowchart LR\n A <-.-> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'async', style: 'dotted' });
  });

  it('multi-edge chain with all four major operators', () => {
    const text = `flowchart LR
 A --> B
 B -.-> C
 C ==> D
 D --- E`;
    const doc = parseFlowchart(text);
    expect(doc.flow.edges).toHaveLength(4);
    expect(doc.flow.edges[1]).toMatchObject({ kind: 'async', style: 'dotted' });
    expect(doc.flow.edges[2]).toMatchObject({ kind: 'sync', style: 'solid' });
  });
});

// ---------------------------------------------------------------------------
// AC3 — Extended node shapes with CLEAN labels
// ---------------------------------------------------------------------------

describe('AC3 — extended node shapes with clean labels', () => {
  it('{{Hexagon}} → diamond, label "Hexagon" (no "{Hex" mangling)', () => {
    const doc = parseFlowchart('flowchart LR\n A{{Hexagon}}');
    const n = doc.flow.nodes.find((n) => n.id === 'a');
    expect(n).toBeDefined();
    expect(n?.kind).toBe('diamond');
    expect(n?.label).toBe('Hexagon');
    // Verify no delimiter leaks
    expect(n?.label).not.toMatch(/[{}]/);
  });

  it('[/Para/] → rect, label "Para" (no "/Para/" mangling)', () => {
    const doc = parseFlowchart('flowchart LR\n A[/Para/]');
    const n = doc.flow.nodes.find((n) => n.id === 'a');
    expect(n).toBeDefined();
    expect(n?.kind).toBe('rect');
    expect(n?.label).toBe('Para');
    expect(n?.label).not.toMatch(/\//);
  });

  it('[\\Trap\\] → rect, label "Trap" (no backslash mangling)', () => {
    const doc = parseFlowchart('flowchart LR\n A[\\Trap\\]');
    const n = doc.flow.nodes.find((n) => n.id === 'a');
    expect(n).toBeDefined();
    expect(n?.kind).toBe('rect');
    expect(n?.label).toBe('Trap');
    expect(n?.label).not.toMatch(/\\/);
  });

  it('[(Database)] → rect, label "Database" (cylinder clean)', () => {
    const doc = parseFlowchart('flowchart LR\n A[(Database)]');
    const n = doc.flow.nodes.find((n) => n.id === 'a');
    expect(n).toBeDefined();
    expect(n?.kind).toBe('rect');
    expect(n?.label).toBe('Database');
  });

  it('>Asymmetric] → rect, label "Asymmetric" (asymmetric clean)', () => {
    const doc = parseFlowchart('flowchart LR\n A>Asymmetric]');
    const n = doc.flow.nodes.find((n) => n.id === 'a');
    expect(n).toBeDefined();
    expect(n?.kind).toBe('rect');
    expect(n?.label).toBe('Asymmetric');
    expect(n?.label).not.toMatch(/[>\]]/);
  });

  it('existing shapes remain unaffected: rect, circle, diamond, stadium', () => {
    const text = `flowchart LR
 R[Rect]
 C((Circle))
 D{Diamond}
 S([Stadium])`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes.find((n) => n.id === 'r')?.kind).toBe('rect');
    expect(doc.flow.nodes.find((n) => n.id === 'c')?.kind).toBe('circle');
    expect(doc.flow.nodes.find((n) => n.id === 'd')?.kind).toBe('diamond');
    expect(doc.flow.nodes.find((n) => n.id === 's')?.kind).toBe('stadium');
  });

  it('extended shapes appear in edges without dropping nodes', () => {
    const text = `flowchart LR
 A{{Start}} --> B[/Process/] --> C[(Store)]`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(3);
    expect(doc.flow.edges).toHaveLength(2);
    expect(doc.flow.nodes.find((n) => n.id === 'a')?.label).toBe('Start');
    expect(doc.flow.nodes.find((n) => n.id === 'b')?.label).toBe('Process');
    expect(doc.flow.nodes.find((n) => n.id === 'c')?.label).toBe('Store');
  });
});

// ---------------------------------------------------------------------------
// AC4 — Graceful degradation: no nodes/edges dropped, warnings emitted
// ---------------------------------------------------------------------------

describe('AC4 — graceful degradation', () => {
  it('unknown edge-like text does not crash and warns', () => {
    const { doc, warnings } = parseFlowchartInternal('flowchart LR\n A ~~ B\n C --> D');
    expect(() => doc).not.toThrow();
    // C --> D must still be parsed
    expect(doc.flow.edges.some((e) => e.from === 'c' && e.to === 'd')).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('subgraph inside diagram: outer edges still parsed', () => {
    const text = `flowchart LR
 subgraph Group
   A --> B
 end
 B --> C`;
    const { doc, warnings } = parseFlowchartInternal(text);
    expect(doc.flow.edges.some((e) => e.from === 'b' && e.to === 'c')).toBe(true);
    expect(warnings.some((w) => /subgraph/i.test(w))).toBe(true);
  });

  it('classDef skipped with warning, edges intact', () => {
    const { doc, warnings } = parseFlowchartInternal(
      'flowchart LR\n classDef red fill:#f00\n A --> B',
    );
    expect(doc.flow.edges).toHaveLength(1);
    expect(warnings.some((w) => /classDef/i.test(w))).toBe(true);
  });

  it('degraded shapes emit shapeWarning but nodes are present with clean labels', () => {
    const { doc, warnings } = parseFlowchartInternal('flowchart LR\n A{{Hex}} --> B[/Para/]');
    expect(doc.flow.nodes).toHaveLength(2);
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.nodes.find((n) => n.id === 'a')?.label).toBe('Hex');
    expect(doc.flow.nodes.find((n) => n.id === 'b')?.label).toBe('Para');
    // Both degraded shapes should emit a warning
    expect(warnings.filter((w) => /DEFERRED/.test(w)).length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// AC5 — Public warnings via parseMermaid
// ---------------------------------------------------------------------------

describe('AC5 — public warnings via parseMermaid', () => {
  it('parseMermaid returns warnings: string[] (field is always present)', () => {
    const result = parseMermaid('flowchart LR\n A --> B');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('clean diagram returns empty warnings array', () => {
    const result = parseMermaid('flowchart LR\n A --> B');
    expect(result.warnings).toHaveLength(0);
  });

  it('diagram with classDef exposes warning via parseMermaid', () => {
    const result = parseMermaid('flowchart LR\n classDef red fill:#f00\n A --> B');
    expect(result.warnings.some((w) => /classDef/i.test(w))).toBe(true);
  });

  it('degraded hexagon shape surfaces warning via parseMermaid', () => {
    const result = parseMermaid('flowchart LR\n A{{Hex}}');
    expect(result.warnings.some((w) => /hexagon/i.test(w))).toBe(true);
  });

  it('result.doc and result.warnings are consistent', () => {
    const text = `flowchart LR
 classDef red fill:#f00
 A{{Start}} --> B[/Process/] --> C`;
    const result = parseMermaid(text);
    expect(result.doc.flow.nodes).toHaveLength(3);
    expect(result.doc.flow.edges).toHaveLength(2);
    // classDef warning + 2 shape degradation warnings
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// AC6 — Direction: TD/TB/LR/RL/BT all parsed; TB/TD warns layout deferral
// ---------------------------------------------------------------------------

describe('AC6 — direction keywords', () => {
  it('flowchart LR — parses cleanly, no layout warning', () => {
    const { direction, warnings } = parseFlowchartInternal('flowchart LR\n A --> B');
    expect(direction).toBe('LR');
    expect(warnings.filter((w) => /layout/i.test(w))).toHaveLength(0);
  });

  it('flowchart TD — parses, emits DEFERRED layout warning', () => {
    const { direction, warnings } = parseFlowchartInternal('flowchart TD\n A --> B');
    expect(direction).toBe('TD');
    expect(warnings.some((w) => /DEFERRED.*TB\/TD/i.test(w))).toBe(true);
  });

  it('flowchart TB — parses, emits DEFERRED layout warning', () => {
    const { direction, warnings } = parseFlowchartInternal('flowchart TB\n A --> B');
    expect(direction).toBe('TB');
    expect(warnings.some((w) => /DEFERRED.*TB\/TD/i.test(w))).toBe(true);
  });

  it('graph TD — legacy keyword, direction parsed', () => {
    const { direction } = parseFlowchartInternal('graph TD\n A --> B');
    expect(direction).toBe('TD');
  });

  it('flowchart RL — direction parsed, deferred warning', () => {
    const { direction, warnings } = parseFlowchartInternal('flowchart RL\n A --> B');
    expect(direction).toBe('RL');
    expect(warnings.some((w) => /DEFERRED.*RL/.test(w))).toBe(true);
  });

  it('flowchart BT — direction parsed, deferred warning', () => {
    const { direction, warnings } = parseFlowchartInternal('flowchart BT\n A --> B');
    expect(direction).toBe('BT');
    expect(warnings.some((w) => /DEFERRED.*BT/.test(w))).toBe(true);
  });

  it('TD diagram produces correct nodes + edges', () => {
    const doc = parseFlowchart('graph TD\n A-->B\n A-->C\n B-->D\n C-->D');
    expect(doc.flow.nodes).toHaveLength(4);
    expect(doc.flow.edges).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// AC7 — Deferrals: subgraph/classDef/style/click warn, do not corrupt
// ---------------------------------------------------------------------------

describe('AC7 — deferrals warn and do not corrupt', () => {
  it('subgraph deferred, edges outside subgraph intact', () => {
    const text = `flowchart LR
 subgraph Prep
   A --> B
 end
 C --> D`;
    const { doc, warnings } = parseFlowchartInternal(text);
    expect(doc.flow.edges.some((e) => e.from === 'c' && e.to === 'd')).toBe(true);
    expect(warnings.some((w) => /DEFERRED.*subgraph/i.test(w))).toBe(true);
  });

  it('classDef deferred, edges intact', () => {
    const text = `flowchart LR
 classDef myClass fill:#f9f,stroke:#333
 A[Node A] --> B[Node B]`;
    const { doc, warnings } = parseFlowchartInternal(text);
    expect(doc.flow.nodes).toHaveLength(2);
    expect(doc.flow.edges).toHaveLength(1);
    expect(warnings.some((w) => /classDef/.test(w))).toBe(true);
  });

  it('style directive deferred, diagram otherwise complete', () => {
    const text = `flowchart LR
 A --> B
 style A fill:#f96`;
    const { doc, warnings } = parseFlowchartInternal(text);
    expect(doc.flow.edges).toHaveLength(1);
    expect(warnings.some((w) => /style/.test(w))).toBe(true);
  });

  it('click directive deferred, diagram otherwise complete', () => {
    const text = `flowchart LR
 A --> B
 click A href "http://example.com"`;
    const { doc, warnings } = parseFlowchartInternal(text);
    expect(doc.flow.edges).toHaveLength(1);
    expect(warnings.some((w) => /click/.test(w))).toBe(true);
  });

  it('multiple deferrals in one diagram: all edges survive', () => {
    const text = `flowchart LR
 classDef myClass fill:#0f0
 subgraph Group
   A --> B
 end
 style A fill:#f00
 click B href "http://b.com"
 C --> D
 B --> C`;
    const { doc, warnings } = parseFlowchartInternal(text);
    expect(doc.flow.edges.some((e) => e.from === 'c' && e.to === 'd')).toBe(true);
    expect(doc.flow.edges.some((e) => e.from === 'b' && e.to === 'c')).toBe(true);
    expect(warnings.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Real-Mermaid corpus — complete diagram patterns
// ---------------------------------------------------------------------------

describe('Real-Mermaid corpus — complete patterns', () => {
  it('CI pipeline pattern (compact + spaced mixed)', () => {
    const text = `graph LR
 Checkout-->Lint
 Lint-->Test
 Test-->Build
 Build --> Deploy`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(5);
    expect(doc.flow.edges).toHaveLength(4);
  });

  it('decision flow with shapes and labels', () => {
    const text = `flowchart TD
 start([Start])
 start --> check{Valid?}
 check -->|yes| process[Process]
 check -->|no| error[Error]
 process --> done([Done])
 error --> done`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(5);
    expect(doc.flow.edges).toHaveLength(5);
    expect(doc.flow.nodes.find((n) => n.id === 'check')?.kind).toBe('diamond');
    expect(doc.flow.edges.find((e) => e.label === 'yes')).toBeDefined();
    expect(doc.flow.edges.find((e) => e.label === 'no')).toBeDefined();
  });

  it('async pipeline with dotted edges', () => {
    const text = `flowchart LR
 A[Request] -.-> B[(Queue)]
 B -.-> C[Worker]
 C --> D[Response]`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(4);
    expect(doc.flow.edges).toHaveLength(3);
    expect(doc.flow.edges[0]).toMatchObject({ kind: 'async', style: 'dotted' });
    expect(doc.flow.edges[1]).toMatchObject({ kind: 'async', style: 'dotted' });
    expect(doc.flow.edges[2]).toMatchObject({ kind: 'sync', style: 'solid' });
  });

  it('thick-edge approval workflow', () => {
    const text = `flowchart LR
 Submit ==> Review
 Review == approved ==> Merge
 Review == rejected ==> Revise
 Revise --> Submit`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(4);
    expect(doc.flow.edges).toHaveLength(4);
    expect(doc.flow.edges.find((e) => e.label === 'approved')).toBeDefined();
    expect(doc.flow.edges.find((e) => e.label === 'rejected')).toBeDefined();
  });

  it('mixed operator graph (all operator families represented)', () => {
    const text = `flowchart LR
 A --> B
 B -.-> C
 C === D
 D <--> E
 E --x F
 F --o G
 G o--o H`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(8);
    expect(doc.flow.edges).toHaveLength(7);
  });

  it('graph + graph keyword (legacy) with all node shapes', () => {
    const text = `graph LR
 A[Rect]
 B(Rounded)
 C((Circle))
 D{Diamond}
 E([Stadium])
 F[[Sub]]
 G{{Hex}}
 H[/Para/]
 I[(Cylinder)]`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(9);
    expect(doc.flow.nodes.find((n) => n.id === 'a')?.kind).toBe('rect');
    expect(doc.flow.nodes.find((n) => n.id === 'b')?.kind).toBe('rounded-rect');
    expect(doc.flow.nodes.find((n) => n.id === 'c')?.kind).toBe('circle');
    expect(doc.flow.nodes.find((n) => n.id === 'd')?.kind).toBe('diamond');
    expect(doc.flow.nodes.find((n) => n.id === 'e')?.kind).toBe('stadium');
    // extended shapes degrade but labels are clean
    expect(doc.flow.nodes.find((n) => n.id === 'g')?.label).toBe('Hex');
    expect(doc.flow.nodes.find((n) => n.id === 'h')?.label).toBe('Para');
    expect(doc.flow.nodes.find((n) => n.id === 'i')?.label).toBe('Cylinder');
  });

  it('inline label normalization: all three forms in one diagram', () => {
    const text = `flowchart LR
 A -- solid label --> B
 B == thick label ==> C
 C -. dotted label .-> D`;
    const doc = parseFlowchart(text);
    expect(doc.flow.edges).toHaveLength(3);
    expect(doc.flow.edges[0]).toMatchObject({ label: 'solid label' });
    expect(doc.flow.edges[1]).toMatchObject({ label: 'thick label' });
    expect(doc.flow.edges[2]).toMatchObject({ label: 'dotted label', kind: 'async' });
  });

  it('compact no-space chain from Mermaid docs', () => {
    // Classic Mermaid docs example uses no spaces around arrows
    const text = `graph TD
 A[Christmas] -->|Get money| B(Go shopping)
 B --> C{Let me think}
 C -->|One| D[Laptop]
 C -->|Two| E[iPhone]
 C -->|Three| F[fa:fa-car Car]`;
    const doc = parseFlowchart(text);
    // A, B, C, D, E, F — 6 nodes
    expect(doc.flow.nodes).toHaveLength(6);
    // 5 edges
    expect(doc.flow.edges).toHaveLength(5);
    expect(doc.flow.nodes.find((n) => n.id === 'c')?.kind).toBe('diamond');
  });

  it('frontmatter + compact edges', () => {
    const text = `---
title: My Pipeline
theme: dark-flow
---
graph LR
 Build-->Test-->Deploy`;
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes).toHaveLength(3);
    expect(doc.flow.edges).toHaveLength(2);
    expect(doc.metadata.title).toBe('My Pipeline');
    expect(doc.metadata.theme).toBe('dark-flow');
  });
});
