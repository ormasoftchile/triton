/**
 * @file test/flow.test.ts — Flow Grammar tests.
 *
 * Tests:
 *  1. Schema validation (valid doc, invalid docs — duplicate ids, unknown edge refs).
 *  2. Scene building — output structure correctness (rects, paths, texts).
 *  3. Determinism — two builds of the same document produce identical sceneHash.
 *  4. Fixture validation — the RAG pipeline fixture validates and builds cleanly.
 *  5. Gallery emit — writes flow-rag-pipeline.{svg,png} to examples/gallery/.
 *  6. Cycle handling — a cyclic doc lays out without infinite loop or crash.
 *  7. No-overlap assertion — node boxes do not intersect in the fixture scene.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  buildFlowScene,
  renderFlowDocument,
  flowDocumentSchema,
} from '../src/grammars/flow/index.js';
import { sceneHash } from '../src/scene.js';
import type { FlowDocument } from '../src/grammars/flow/index.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function loadFixture(): FlowDocument {
  const raw = readFileSync(
    join(GALLERY_DIR, 'flow-rag-pipeline.flow.yaml'),
    'utf-8',
  );
  return parseYaml(raw) as FlowDocument;
}

function minimalDoc(override?: Partial<FlowDocument['flow']>): FlowDocument {
  return {
    version: '1.0',
    metadata: {},
    flow: {
      nodes: [
        { id: 'a', label: 'Step A' },
        { id: 'b', label: 'Step B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      ...override,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Schema validation
// ---------------------------------------------------------------------------

describe('Flow Grammar — schema validation', () => {
  it('accepts the RAG pipeline fixture', () => {
    const doc = loadFixture();
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a minimal valid document (two nodes, one edge)', () => {
    const doc = minimalDoc();
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a document with no edges (isolated nodes)', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'a', label: 'Alone' }],
        edges: [],
      },
    };
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  it('accepts a document with no nodes and no edges (empty flow)', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: { nodes: [], edges: [] },
    };
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  it('rejects a document with missing version', () => {
    const doc = {
      metadata: {},
      flow: { nodes: [{ id: 'a', label: 'A' }], edges: [] },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it('rejects a node with an empty label', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: { nodes: [{ id: 'a', label: '' }], edges: [] },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain('must not be empty');
  });

  it('rejects duplicate node ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'dup', label: 'First' },
          { id: 'dup', label: 'Second' },
        ],
        edges: [],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("Duplicate node id: 'dup'");
  });

  it('rejects an edge referencing an unknown source node', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'a', label: 'A' }],
        edges: [{ from: 'unknown', to: 'a' }],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("unknown node id 'unknown' in field 'from'");
  });

  it('rejects an edge referencing an unknown target node', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'a', label: 'A' }],
        edges: [{ from: 'a', to: 'ghost' }],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("unknown node id 'ghost' in field 'to'");
  });

  it('accepts a self-loop (from == to) — cycles are valid in flow grammar', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'a', label: 'A' }],
        edges: [{ from: 'a', to: 'a' }],
      },
    };
    expect(() => flowDocumentSchema.parse(doc)).not.toThrow();
  });

  it('rejects a non-kebab-case node id', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'Bad_ID', label: 'Bad' }],
        edges: [],
      },
    };
    const result = flowDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Scene structure
// ---------------------------------------------------------------------------

describe('Flow Grammar — scene structure', () => {
  it('produces a Scene with positive dimensions', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
  });

  it('scene has at least one primitive (background)', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    expect(scene.primitives.length).toBeGreaterThan(0);
  });

  it('scene has node rect primitives', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    const rects = scene.primitives.filter((p) => p.kind === 'rect');
    // background + 5 rounded-rect nodes + 2 stadium nodes = at least 7
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it('scene has text primitives (node labels)', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    const texts = scene.primitives.filter((p) => p.kind === 'text');
    expect(texts.length).toBeGreaterThan(0);
    // Should contain node labels
    const textContents = texts.map((p) => (p as { text: string }).text);
    expect(textContents).toContain('User Question');
    expect(textContents).toContain('Grounded Answer');
  });

  it('scene has path primitives (edges + arrowheads)', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    const paths = scene.primitives.filter((p) => p.kind === 'path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('scene background matches the default theme (#ffffff)', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    expect(scene.background).toBe('#ffffff');
  });

  it('scene background rect is the first primitive', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    expect(scene.primitives[0]!.kind).toBe('rect');
    const bg = scene.primitives[0] as { x: number; y: number; fill: string };
    expect(bg.x).toBe(0);
    expect(bg.y).toBe(0);
    expect(bg.fill).toBe('#ffffff');
  });

  it('single-node flow produces a valid scene', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: { nodes: [{ id: 'a', label: 'Solo' }], edges: [] },
    };
    const scene = buildFlowScene(doc);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    // background + 1 node rect + 1 label text = at least 3
    expect(scene.primitives.length).toBeGreaterThanOrEqual(3);
  });

  it('empty flow produces a valid (small) scene', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: { nodes: [], edges: [] },
    };
    const scene = buildFlowScene(doc);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
  });

  it('linear chain produces nodes at increasing x positions', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
    };
    const scene = buildFlowScene(doc);
    // Collect node rects (skip background = fill '#ffffff')
    const rects = scene.primitives.filter(
      (p) => p.kind === 'rect' && (p as { fill: string }).fill !== '#ffffff',
    ) as Array<{ x: number; width: number }>;
    expect(rects.length).toBe(3);
    // Each consecutive rect must start further right
    expect(rects[0]!.x).toBeLessThan(rects[1]!.x);
    expect(rects[1]!.x).toBeLessThan(rects[2]!.x);
  });

  it('status:success node gets a non-default fill (green-ish)', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'ok', label: 'Done', status: 'success' }],
        edges: [],
      },
    };
    const scene = buildFlowScene(doc);
    const rects = scene.primitives.filter(
      (p) => p.kind === 'rect' && (p as { fill: string }).fill !== '#ffffff',
    ) as Array<{ fill: string }>;
    expect(rects.length).toBeGreaterThan(0);
    const successFill = rects[0]!.fill;
    // defaultFlowTheme.statusFills.success = '#d1fae5'
    expect(successFill).toBe('#d1fae5');
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism
// ---------------------------------------------------------------------------

describe('Flow Grammar — determinism', () => {
  it('two builds of the same document produce identical sceneHash', () => {
    const doc = loadFixture();
    const h1 = sceneHash(buildFlowScene(doc));
    const h2 = sceneHash(buildFlowScene(doc));
    expect(h1).toBe(h2);
  });

  it('hash changes when a node label changes', () => {
    const doc = loadFixture();
    const h1 = sceneHash(buildFlowScene(doc));
    const modified: FlowDocument = {
      ...doc,
      flow: {
        ...doc.flow,
        nodes: doc.flow.nodes.map((n) =>
          n.id === 'question' ? { ...n, label: 'MODIFIED' } : n,
        ),
      },
    };
    const h2 = sceneHash(buildFlowScene(modified));
    expect(h1).not.toBe(h2);
  });

  it('hash changes when an edge is added', () => {
    const doc = loadFixture();
    const h1 = sceneHash(buildFlowScene(doc));
    const modified: FlowDocument = {
      ...doc,
      flow: {
        ...doc.flow,
        nodes: [
          ...doc.flow.nodes,
          { id: 'extra', label: 'Extra' },
        ],
        edges: [
          ...doc.flow.edges,
          { from: 'answer', to: 'extra' },
        ],
      },
    };
    const h2 = sceneHash(buildFlowScene(modified));
    expect(h1).not.toBe(h2);
  });

  it('minimal two-build hash is stable', () => {
    const doc = minimalDoc();
    expect(sceneHash(buildFlowScene(doc))).toBe(sceneHash(buildFlowScene(doc)));
  });
});

// ---------------------------------------------------------------------------
// 4. Cycle handling
// ---------------------------------------------------------------------------

describe('Flow Grammar — cycle handling', () => {
  it('handles a simple A→B→A cycle without crashing', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label: 'Step A' },
          { id: 'b', label: 'Step B' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a', label: 'retry' },
        ],
      },
    };
    expect(() => {
      const scene = buildFlowScene(doc);
      expect(scene.width).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it('handles a three-node cycle (A→B→C→A) without crashing', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'a' },
        ],
      },
    };
    expect(() => buildFlowScene(doc)).not.toThrow();
    const scene = buildFlowScene(doc);
    // Cycle produces back-edge paths — scene still has primitives
    expect(scene.primitives.length).toBeGreaterThan(0);
  });

  it('handles a self-loop without crashing', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [{ id: 'a', label: 'Loop' }],
        edges: [{ from: 'a', to: 'a' }],
      },
    };
    expect(() => buildFlowScene(doc)).not.toThrow();
  });

  it('cycle layout is deterministic', () => {
    const doc: FlowDocument = {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'x', label: 'X' },
          { id: 'y', label: 'Y' },
        ],
        edges: [
          { from: 'x', to: 'y' },
          { from: 'y', to: 'x' },
        ],
      },
    };
    const h1 = sceneHash(buildFlowScene(doc));
    const h2 = sceneHash(buildFlowScene(doc));
    expect(h1).toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// 5. Node non-overlap
// ---------------------------------------------------------------------------

describe('Flow Grammar — node non-overlap', () => {
  it('fixture: no two node boxes overlap', () => {
    const doc = loadFixture();
    const scene = buildFlowScene(doc);
    // Node rects exclude background (#ffffff)
    const rects = (
      scene.primitives.filter((p) => p.kind === 'rect') as Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        fill: string;
      }>
    ).filter((r) => r.fill !== '#ffffff');

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const noOverlap =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(noOverlap).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Gallery emit — SVG
// ---------------------------------------------------------------------------

describe('Flow Grammar — gallery SVG emit', () => {
  it('emits flow-rag-pipeline.svg to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderFlowDocument(doc, { format: 'svg' });
    if (result instanceof Promise) throw new Error('Expected sync result');
    const svg = result.svg!;
    expect(svg).toContain('<svg');
    expect(svg).toContain('User Question');
    expect(svg).toContain('Grounded Answer');
    expect(svg).toContain('LLM Generate');
    const outPath = join(GALLERY_DIR, 'flow-rag-pipeline.svg');
    writeFileSync(outPath, svg, 'utf-8');
    console.log('[flow] flow-rag-pipeline.svg →', outPath);
  });
});

// ---------------------------------------------------------------------------
// 7. Gallery emit — PNG
// ---------------------------------------------------------------------------

describe('Flow Grammar — gallery PNG emit', () => {
  it('emits flow-rag-pipeline.png to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderFlowDocument(doc, { format: 'png' });
    if (result instanceof Promise) throw new Error('Expected sync result');
    const png = result.png!;
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png[0]).toBe(0x89); // PNG signature byte
    const outPath = join(GALLERY_DIR, 'flow-rag-pipeline.png');
    writeFileSync(outPath, png);
    console.log('[flow] flow-rag-pipeline.png →', outPath);
  });
});
