/**
 * @file test/mermaid-frontend.test.ts — Mermaid front-end tests.
 *
 * Coverage:
 *   1. detectDiagramType — keyword detection, frontmatter stripping, comment skipping
 *   2. parseFlowchart — node shapes, edge types, chains, semicolons, direction, ID sanitization
 *   3. parseMermaid — dispatch + "not yet supported" errors for non-flowchart types
 *   4. renderMermaid — theme resolution, determinism (sceneHash), warning collection
 *   5. Gallery emit — parse mermaid-flowchart.mmd → write .svg and .png to examples/gallery/
 *
 * Existing goldens are unaffected: these tests add new gallery outputs only.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  detectDiagramType,
  parseMermaid,
  renderMermaid,
} from '../src/frontend/mermaid/index.js';
import { parseFlowchart } from '../src/frontend/mermaid/flowchart.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');
const MMD_FILE = join(GALLERY_DIR, 'mermaid-flowchart.mmd');

// ---------------------------------------------------------------------------
// 1. detectDiagramType
// ---------------------------------------------------------------------------

describe('detectDiagramType', () => {
  it('detects flowchart LR', () => {
    expect(detectDiagramType('flowchart LR\n    A --> B')).toBe('flowchart');
  });

  it('detects flowchart TD', () => {
    expect(detectDiagramType('flowchart TD\n    A --> B')).toBe('flowchart');
  });

  it('detects graph LR (legacy keyword)', () => {
    expect(detectDiagramType('graph LR\n    A --> B')).toBe('flowchart');
  });

  it('detects sequenceDiagram', () => {
    expect(detectDiagramType('sequenceDiagram\n    A->>B: msg')).toBe('sequence');
  });

  it('detects gantt', () => {
    expect(detectDiagramType('gantt\n    title Plan')).toBe('gantt');
  });

  it('detects timeline', () => {
    expect(detectDiagramType('timeline\n    title History')).toBe('timeline');
  });

  it('detects mindmap', () => {
    expect(detectDiagramType('mindmap\n    root((Root))')).toBe('mindmap');
  });

  it('returns unknown for unrecognised content', () => {
    expect(detectDiagramType('some random text')).toBe('unknown');
  });

  it('strips YAML frontmatter before detecting', () => {
    const text = `---
title: My Diagram
theme: dark-flow
---
flowchart LR
    A --> B`;
    expect(detectDiagramType(text)).toBe('flowchart');
  });

  it('skips %% comment lines before detecting', () => {
    const text = `%% This is a comment
flowchart LR
    A --> B`;
    expect(detectDiagramType(text)).toBe('flowchart');
  });

  it('handles %%{init}%% directive before detecting', () => {
    const text = `%%{init: {"theme": "dark-flow"}}%%
flowchart LR
    A --> B`;
    expect(detectDiagramType(text)).toBe('flowchart');
  });
});

// ---------------------------------------------------------------------------
// 2. parseFlowchart — nodes
// ---------------------------------------------------------------------------

describe('parseFlowchart — node shapes', () => {
  it('parses rect shape A[Label]', () => {
    const doc = parseFlowchart('flowchart LR\n    A[My Rect]');
    const node = doc.flow.nodes.find((n) => n.id === 'a');
    expect(node).toBeDefined();
    expect(node?.label).toBe('My Rect');
    expect(node?.kind).toBe('rect');
  });

  it('parses rounded-rect shape A(Label)', () => {
    const doc = parseFlowchart('flowchart LR\n    A(My Rounded)');
    const node = doc.flow.nodes.find((n) => n.id === 'a');
    expect(node?.label).toBe('My Rounded');
    expect(node?.kind).toBe('rounded-rect');
  });

  it('parses circle shape A((Label))', () => {
    const doc = parseFlowchart('flowchart LR\n    A((Circle Node))');
    const node = doc.flow.nodes.find((n) => n.id === 'a');
    expect(node?.label).toBe('Circle Node');
    expect(node?.kind).toBe('circle');
  });

  it('parses diamond shape A{Label}', () => {
    const doc = parseFlowchart('flowchart LR\n    A{Decision}');
    const node = doc.flow.nodes.find((n) => n.id === 'a');
    expect(node?.label).toBe('Decision');
    expect(node?.kind).toBe('diamond');
  });

  it('parses stadium shape A([Label])', () => {
    const doc = parseFlowchart('flowchart LR\n    A([Start])');
    const node = doc.flow.nodes.find((n) => n.id === 'a');
    expect(node?.label).toBe('Start');
    expect(node?.kind).toBe('stadium');
  });

  it('parses subroutine shape A[[Label]] as rect', () => {
    const doc = parseFlowchart('flowchart LR\n    A[[Subroutine]]');
    const node = doc.flow.nodes.find((n) => n.id === 'a');
    expect(node?.label).toBe('Subroutine');
    expect(node?.kind).toBe('rect');
  });

  it('auto-creates bare-ID node with default rounded-rect', () => {
    const doc = parseFlowchart('flowchart LR\n    A --> B');
    expect(doc.flow.nodes.find((n) => n.id === 'a')).toBeDefined();
    expect(doc.flow.nodes.find((n) => n.id === 'b')).toBeDefined();
  });

  it('later explicit declaration updates label and shape', () => {
    const doc = parseFlowchart('flowchart LR\n    A --> B\n    B{Decision}');
    const node = doc.flow.nodes.find((n) => n.id === 'b');
    expect(node?.label).toBe('Decision');
    expect(node?.kind).toBe('diamond');
  });

  it('sanitizes camelCase IDs to kebab-case', () => {
    const doc = parseFlowchart('flowchart LR\n    codePush([Start])');
    const node = doc.flow.nodes.find((n) => n.id === 'code-push');
    expect(node).toBeDefined();
    expect(node?.label).toBe('Start');
  });

  it('sanitizes PascalCase IDs to kebab-case', () => {
    const doc = parseFlowchart('flowchart LR\n    DockerBuild[Build]');
    const node = doc.flow.nodes.find((n) => n.id === 'docker-build');
    expect(node).toBeDefined();
  });

  it('sanitizes underscore IDs to kebab-case', () => {
    const doc = parseFlowchart('flowchart LR\n    my_node[Label]');
    const node = doc.flow.nodes.find((n) => n.id === 'my-node');
    expect(node).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. parseFlowchart — edges
// ---------------------------------------------------------------------------

describe('parseFlowchart — edges', () => {
  it('parses --> (sync, solid)', () => {
    const doc = parseFlowchart('flowchart LR\n    A --> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', kind: 'sync', style: 'solid' });
  });

  it('parses --- (undirected → sync, solid)', () => {
    const doc = parseFlowchart('flowchart LR\n    A --- B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', kind: 'sync', style: 'solid' });
  });

  it('parses -.-> (async, dotted)', () => {
    const doc = parseFlowchart('flowchart LR\n    A -.-> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', kind: 'async', style: 'dotted' });
  });

  it('parses ==> (thick → sync, solid)', () => {
    const doc = parseFlowchart('flowchart LR\n    A ==> B');
    expect(doc.flow.edges).toHaveLength(1);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', kind: 'sync', style: 'solid' });
  });

  it('parses pipe label -->|label| B', () => {
    const doc = parseFlowchart('flowchart LR\n    A -->|yes| B');
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', label: 'yes' });
  });

  it('parses dash-space label "A -- label --> B"', () => {
    const doc = parseFlowchart('flowchart LR\n    A -- accepted --> B');
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b', label: 'accepted' });
  });

  it('parses chain A --> B --> C (two edges)', () => {
    const doc = parseFlowchart('flowchart LR\n    A --> B --> C');
    expect(doc.flow.edges).toHaveLength(2);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
    expect(doc.flow.edges[1]).toMatchObject({ from: 'b', to: 'c' });
  });

  it('parses multi-statement line via ;', () => {
    const doc = parseFlowchart('flowchart LR\n    A --> B; B --> C');
    expect(doc.flow.edges).toHaveLength(2);
  });

  it('preserves edge order matching declaration order', () => {
    const doc = parseFlowchart(`flowchart LR
    A --> B
    B --> C
    A --> C`);
    expect(doc.flow.edges[0]).toMatchObject({ from: 'a', to: 'b' });
    expect(doc.flow.edges[1]).toMatchObject({ from: 'b', to: 'c' });
    expect(doc.flow.edges[2]).toMatchObject({ from: 'a', to: 'c' });
  });

  it('parses a complex diagram with multiple shapes and labeled edges', () => {
    const text = `flowchart LR
    start([Start])
    start --> check{Validate}
    check -->|ok| process[Process]
    check -->|err| error[Error]
    process -.-> done([Done])`;

    const doc = parseFlowchart(text);

    // Nodes
    const start = doc.flow.nodes.find((n) => n.id === 'start');
    const check = doc.flow.nodes.find((n) => n.id === 'check');
    const process = doc.flow.nodes.find((n) => n.id === 'process');
    const done = doc.flow.nodes.find((n) => n.id === 'done');

    expect(start?.kind).toBe('stadium');
    expect(check?.kind).toBe('diamond');
    expect(process?.kind).toBe('rect');
    expect(done?.kind).toBe('stadium');

    // Edges
    expect(doc.flow.edges).toHaveLength(4);
    expect(doc.flow.edges[1]).toMatchObject({ label: 'ok' });
    expect(doc.flow.edges[2]).toMatchObject({ label: 'err' });
    expect(doc.flow.edges[3]).toMatchObject({ kind: 'async', style: 'dotted' });
  });
});

// ---------------------------------------------------------------------------
// 4. parseFlowchart — header and metadata
// ---------------------------------------------------------------------------

describe('parseFlowchart — header and metadata', () => {
  it('accepts graph keyword (legacy)', () => {
    const doc = parseFlowchart('graph LR\n    A --> B');
    expect(doc.flow.nodes).toHaveLength(2);
  });

  it('applies frontmatter theme to doc.metadata.theme', () => {
    const text = `---
title: Test Diagram
theme: dark-flow
---
flowchart LR
    A --> B`;
    const doc = parseFlowchart(text);
    expect(doc.metadata.theme).toBe('dark-flow');
    expect(doc.metadata.title).toBe('Test Diagram');
  });

  it('applies %%{init}%% directive theme to doc.metadata.theme', () => {
    const text = `%%{init: {"theme": "dark-flow"}}%%
flowchart LR
    A --> B`;
    const doc = parseFlowchart(text);
    expect(doc.metadata.theme).toBe('dark-flow');
  });

  it('skips %% comment lines in body', () => {
    const text = `flowchart LR
    %% This is a comment
    A --> B`;
    const doc = parseFlowchart(text);
    expect(doc.flow.edges).toHaveLength(1);
  });

  it('defers subgraph lines (does not crash)', () => {
    const text = `flowchart LR
    subgraph Group
      A --> B
    end
    B --> C`;
    // Should not throw; B and C should still be parsed
    expect(() => parseFlowchart(text)).not.toThrow();
    const doc = parseFlowchart(text);
    // B --> C should be parsed (subgraph content is also parsed in Inc-1 "flat" mode)
    expect(doc.flow.edges.some((e) => e.from === 'b' && e.to === 'c')).toBe(true);
  });

  it('defers classDef lines (does not crash)', () => {
    const text = `flowchart LR
    classDef myClass fill:#f9f,stroke:#333
    A --> B`;
    expect(() => parseFlowchart(text)).not.toThrow();
    const doc = parseFlowchart(text);
    expect(doc.flow.edges).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. parseMermaid — dispatch and errors
// ---------------------------------------------------------------------------

describe('parseMermaid — dispatch', () => {
  it('dispatches flowchart to parseFlowchart', () => {
    const result = parseMermaid('flowchart LR\n    A --> B');
    expect(result.kind).toBe('flowchart');
    expect(result.doc.flow.nodes).toHaveLength(2);
  });

  it('dispatches sequenceDiagram to parseSequence (now implemented)', () => {
    const result = parseMermaid('sequenceDiagram\n    A->>B: msg');
    expect(result.kind).toBe('sequence');
    // doc is SequenceDocument — participants and messages present
    const seqDoc = result.doc as import('../src/grammars/sequence/types.js').SequenceDocument;
    expect(seqDoc.sequence.participants.length).toBeGreaterThanOrEqual(2);
    expect(seqDoc.sequence.messages).toHaveLength(1);
  });

  it('dispatches gantt → IRDocument (kind=gantt, doc.version="1.0")', () => {
    const result = parseMermaid('gantt\n    title Plan\n    dateFormat YYYY-MM-DD');
    expect(result.kind).toBe('gantt');
    expect((result.doc as import('../src/types.js').IRDocument).version).toBe('1.0');
  });

  it('dispatches timeline → IRDocument (kind=timeline, doc.version="1.0")', () => {
    const result = parseMermaid('timeline\n    title History\n    2024 : Launch');
    expect(result.kind).toBe('timeline');
    expect((result.doc as import('../src/types.js').IRDocument).version).toBe('1.0');
  });

  it('dispatches mindmap → TreeDocument (kind=mindmap, doc.version="1.0")', () => {
    const result = parseMermaid('mindmap\n  root((Root))\n    A\n    B');
    expect(result.kind).toBe('mindmap');
    expect((result.doc as import('../src/grammars/tree/types.js').TreeDocument).version).toBe('1.0');
  });

  it('throws a clear error for unknown diagram type', () => {
    expect(() => parseMermaid('some random text')).toThrow(/Tier 0/);
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism
// ---------------------------------------------------------------------------

describe('Determinism', () => {
  const SAMPLE = `flowchart LR
    A[Start] --> B{Check}
    B -->|yes| C([Done])
    B -->|no| D[Retry]
    D --> A`;

  it('parse twice → byte-identical FlowDocument (same nodes and edges)', () => {
    const doc1 = parseFlowchart(SAMPLE);
    const doc2 = parseFlowchart(SAMPLE);
    expect(JSON.stringify(doc1)).toBe(JSON.stringify(doc2));
  });

  it('render twice → identical sceneHash', () => {
    const r1 = renderMermaid(SAMPLE, { format: 'svg' });
    const r2 = renderMermaid(SAMPLE, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
    expect(r1.sceneHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// 7. renderMermaid — theme + warnings
// ---------------------------------------------------------------------------

describe('renderMermaid — rendering', () => {
  it('renders flowchart to SVG', () => {
    const result = renderMermaid('flowchart LR\n    A --> B', { format: 'svg' });
    expect(result.svg).toContain('<svg');
    expect(result.kind).toBe('flowchart');
  });

  it('renders flowchart to PNG', () => {
    const result = renderMermaid('flowchart LR\n    A --> B', { format: 'png' });
    expect(result.png).toBeInstanceOf(Uint8Array);
    expect(result.png![0]).toBe(0x89); // PNG signature
  });

  it('applies theme from frontmatter', () => {
    const text = `---
theme: dark-flow
---
flowchart LR
    A --> B`;
    const result = renderMermaid(text, { format: 'svg' });
    // Dark theme has a dark background (#111827)
    expect(result.svg).toContain('#111827');
  });

  it('applies theme override from options (supersedes frontmatter)', () => {
    const text = `---
theme: dark-flow
---
flowchart LR
    A --> B`;
    const resultDefault = renderMermaid(text, { format: 'svg', theme: 'default-flow' });
    // default-flow has white background
    expect(resultDefault.svg).toContain('#ffffff');
  });

  it('collects warnings for deferred features', () => {
    const text = `flowchart LR
    classDef myClass fill:#f9f
    A --> B`;
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.warnings.some((w) => /DEFERRED/.test(w))).toBe(true);
  });

  it('renders sequenceDiagram to SVG (now implemented)', () => {
    const result = renderMermaid('sequenceDiagram\n    A->>B: Hello', { format: 'svg' });
    expect(result.kind).toBe('sequence');
    expect(result.svg).toContain('<svg');
  });
});

// ---------------------------------------------------------------------------
// 8. Gallery emit
// ---------------------------------------------------------------------------

describe('Gallery emit — mermaid-flowchart', () => {
  it('mermaid-flowchart.mmd exists', () => {
    expect(existsSync(MMD_FILE)).toBe(true);
  });

  it('parses mermaid-flowchart.mmd without errors', () => {
    const text = readFileSync(MMD_FILE, 'utf-8');
    expect(() => parseFlowchart(text)).not.toThrow();
    const doc = parseFlowchart(text);
    expect(doc.flow.nodes.length).toBeGreaterThan(3);
    expect(doc.flow.edges.length).toBeGreaterThan(3);
  });

  it('emits mermaid-flowchart.svg to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });

    const text = readFileSync(MMD_FILE, 'utf-8');
    const result = renderMermaid(text, { format: 'svg' });

    expect(result.svg).toContain('<svg');
    // Verify key nodes appear in SVG
    expect(result.svg).toContain('Lint');
    expect(result.svg).toContain('Security');

    const outPath = join(GALLERY_DIR, 'mermaid-flowchart.svg');
    writeFileSync(outPath, result.svg!, 'utf-8');
    console.log('[mermaid] mermaid-flowchart.svg →', outPath);
  });

  it('emits mermaid-flowchart.png to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });

    const text = readFileSync(MMD_FILE, 'utf-8');
    const result = renderMermaid(text, { format: 'png' });

    expect(result.png).toBeInstanceOf(Uint8Array);
    expect(result.png![0]).toBe(0x89); // PNG magic byte

    const outPath = join(GALLERY_DIR, 'mermaid-flowchart.png');
    writeFileSync(outPath, result.png!);
    console.log('[mermaid] mermaid-flowchart.png →', outPath);
  });

  it('gallery SVG and PNG are deterministic (two renders, same hash)', () => {
    const text = readFileSync(MMD_FILE, 'utf-8');
    const r1 = renderMermaid(text, { format: 'svg' });
    const r2 = renderMermaid(text, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });
});
