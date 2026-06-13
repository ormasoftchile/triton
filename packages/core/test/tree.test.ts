/**
 * @file test/tree.test.ts — Tree Grammar tests.
 *
 * Tests:
 *  1. Schema validation (valid doc, invalid docs — duplicate ids, empty label).
 *  2. Scene building — output structure correctness (rects, paths, texts).
 *  3. Determinism — two builds of the same document produce identical sceneHash.
 *  4. Gallery emit — writes tree-document.{svg,png} to examples/gallery/.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  buildTreeScene,
  renderTreeDocument,
  treeDocumentSchema,
  treeDarkTheme,
} from '../src/grammars/tree/index.js';
import { sceneHash } from '../src/scene.js';
import type { TreeDocument } from '../src/grammars/tree/index.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function loadFixture(): TreeDocument {
  const raw = readFileSync(
    join(GALLERY_DIR, 'tree-document.tree.yaml'),
    'utf-8',
  );
  return parseYaml(raw) as TreeDocument;
}

// ---------------------------------------------------------------------------
// 1. Schema validation
// ---------------------------------------------------------------------------

describe('Tree Grammar — schema validation', () => {
  it('accepts the document hierarchy fixture', () => {
    const doc = loadFixture();
    expect(() => treeDocumentSchema.parse(doc)).not.toThrow();
  });

  it('rejects a doc with missing version', () => {
    const doc = {
      metadata: { title: 'test' },
      tree: { root: { id: 'root', label: 'Root' } },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it('rejects a node with an empty label', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: { root: { id: 'root', label: '' } },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain('must not be empty');
  });

  it('rejects duplicate node ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: {
        root: {
          id: 'root',
          label: 'Root',
          children: [
            { id: 'dup', label: 'A' },
            { id: 'dup', label: 'B' },
          ],
        },
      },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("Duplicate node id 'dup'");
  });

  it('rejects a node id that is not kebab-case', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: { root: { id: 'Root_Node', label: 'Root' } },
    };
    const result = treeDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it('accepts a single-node tree (minimal valid)', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      tree: { root: { id: 'root', label: 'Root' } },
    };
    expect(() => treeDocumentSchema.parse(doc)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Scene structure
// ---------------------------------------------------------------------------

describe('Tree Grammar — scene structure', () => {
  it('produces a Scene with correct primitive types', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    expect(scene.primitives.length).toBeGreaterThan(0);
    // Should have rects (nodes + background)
    const rects = scene.primitives.filter((p) => p.kind === 'rect');
    expect(rects.length).toBeGreaterThan(0);
    // Should have text primitives (labels)
    const texts = scene.primitives.filter((p) => p.kind === 'text');
    expect(texts.length).toBeGreaterThan(0);
    // Should have path primitives (edges)
    const paths = scene.primitives.filter((p) => p.kind === 'path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('has 10 node rects + 1 background rect for the 10-node fixture', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc);
    // 10 nodes (doc + 3 chapters + 6 sections) + 1 background = 11 rects
    const rects = scene.primitives.filter((p) => p.kind === 'rect');
    expect(rects.length).toBe(11);
  });

  it('has 9 edge paths for the 10-node fixture (one per parent-child pair)', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc);
    // 9 edges: doc→ch1, doc→ch2, doc→ch3, ch1→s1-1, ch1→s1-2,
    //           ch2→s2-1, ch2→s2-2, ch2→s2-3, ch3→s3-1
    const paths = scene.primitives.filter(
      (p) => p.kind === 'path' && (p as { fill: string }).fill === 'none',
    );
    expect(paths.length).toBe(9);
  });

  it('has 10 text labels for the 10-node fixture', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc);
    const texts = scene.primitives.filter((p) => p.kind === 'text');
    expect(texts.length).toBe(10);
  });

  it('applies default-tree theme background', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc);
    expect(scene.background).toBe('#ffffff');
  });

  it('root node gets kind fill color (root → #3949ab)', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc);
    // First node rect after background is root
    const rects = scene.primitives.filter((p) => p.kind === 'rect') as Array<{
      fill: string;
    }>;
    // Background is #ffffff; root should be #3949ab
    const rootRect = rects.find((r) => r.fill === '#3949ab');
    expect(rootRect).toBeDefined();
  });

  it('nodes do not overlap (no two node boxes intersect)', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc);
    // Collect non-background rects
    const rects = (
      scene.primitives.filter((p) => p.kind === 'rect') as Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        fill: string;
      }>
    ).filter((r) => r.fill !== '#ffffff'); // exclude background

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
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
// 3. Determinism
// ---------------------------------------------------------------------------

describe('Tree Grammar — determinism', () => {
  it('two builds of the same document produce identical sceneHash', () => {
    const doc = loadFixture();
    const h1 = sceneHash(buildTreeScene(doc));
    const h2 = sceneHash(buildTreeScene(doc));
    expect(h1).toBe(h2);
  });

  it('hash changes when a node label changes', () => {
    const doc = loadFixture();
    const h1 = sceneHash(buildTreeScene(doc));
    const modified: TreeDocument = {
      ...doc,
      tree: {
        root: {
          ...doc.tree.root,
          label: 'MODIFIED Root',
        },
      },
    };
    const h2 = sceneHash(buildTreeScene(modified));
    expect(h1).not.toBe(h2);
  });

  it('hash changes when sibling order changes', () => {
    const doc = loadFixture();
    const h1 = sceneHash(buildTreeScene(doc));
    // Reverse children order
    const reversed: TreeDocument = {
      ...doc,
      tree: {
        root: {
          ...doc.tree.root,
          children: [...(doc.tree.root.children ?? [])].reverse(),
        },
      },
    };
    const h2 = sceneHash(buildTreeScene(reversed));
    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// 4. Single-node tree
// ---------------------------------------------------------------------------

describe('Tree Grammar — single-node tree', () => {
  it('renders a single root node without errors', () => {
    const doc: TreeDocument = {
      version: '1.0',
      metadata: { title: 'Minimal' },
      tree: { root: { id: 'root', label: 'Root' } },
    };
    const scene = buildTreeScene(doc);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    const rects = scene.primitives.filter((p) => p.kind === 'rect');
    expect(rects.length).toBe(2); // background + 1 node
  });
});

// ---------------------------------------------------------------------------
// 5. Gallery emit — SVG
// ---------------------------------------------------------------------------

describe('Tree Grammar — gallery SVG emit', () => {
  it('emits tree-document.svg to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderTreeDocument(doc, { format: 'svg' });
    if (result instanceof Promise) throw new Error('Expected sync result');
    const svg = result.svg!;
    expect(svg).toContain('<svg');
    expect(svg).toContain('Document');
    expect(svg).toContain('Chapter 1');
    expect(svg).toContain('1.1 Background');
    const outPath = join(GALLERY_DIR, 'tree-document.svg');
    writeFileSync(outPath, svg, 'utf-8');
    console.log('[tree] tree-document.svg →', outPath);
  });
});

// ---------------------------------------------------------------------------
// 6. Gallery emit — PNG
// ---------------------------------------------------------------------------

describe('Tree Grammar — gallery PNG emit', () => {
  it('emits tree-document.png to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderTreeDocument(doc, { format: 'png' });
    if (result instanceof Promise) throw new Error('Expected sync result');
    const png = result.png!;
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png[0]).toBe(0x89); // PNG signature byte
    const outPath = join(GALLERY_DIR, 'tree-document.png');
    writeFileSync(outPath, png);
    console.log('[tree] tree-document.png →', outPath);
  });
});

// ---------------------------------------------------------------------------
// 7. Dark theme — determinism
// ---------------------------------------------------------------------------

describe('Tree Grammar — dark theme determinism', () => {
  it('two dark-theme builds of the same document produce identical sceneHash', () => {
    const doc = loadFixture();
    const h1 = sceneHash(buildTreeScene(doc, treeDarkTheme));
    const h2 = sceneHash(buildTreeScene(doc, treeDarkTheme));
    expect(h1).toBe(h2);
  });

  it('dark-theme hash differs from default-theme hash (same IR, different look)', () => {
    const doc = loadFixture();
    const hDefault = sceneHash(buildTreeScene(doc));
    const hDark    = sceneHash(buildTreeScene(doc, treeDarkTheme));
    expect(hDefault).not.toBe(hDark);
  });

  it('dark theme applies dark canvas background', () => {
    const doc = loadFixture();
    const scene = buildTreeScene(doc, treeDarkTheme);
    expect(scene.background).toBe('#111827');
  });

  it('dark theme uses straight edge style (SVG output has L commands, not M…V…H)', () => {
    const doc = loadFixture();
    const result = renderTreeDocument(doc, { format: 'svg' }, treeDarkTheme);
    if (result instanceof Promise) throw new Error('Expected sync result');
    const svg = result.svg!;
    // Straight edges emit path "M … L …"; elbow paths emit M … V … H …
    // Both use 'L' moves but elbow uses vertical + horizontal segments (V/H).
    // Straight edges go directly from parent bottom to child top with one L.
    expect(svg).toContain('#111827'); // dark bg in SVG
    expect(svg).toContain('#0d9488'); // root kind fill
    expect(svg).toContain('#2dd4bf'); // edge stroke teal
  });
});

// ---------------------------------------------------------------------------
// 8. Dark theme gallery emit — SVG
// ---------------------------------------------------------------------------

describe('Tree Grammar — dark theme gallery SVG emit', () => {
  it('emits tree-document-dark.svg to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderTreeDocument(doc, { format: 'svg' }, treeDarkTheme);
    if (result instanceof Promise) throw new Error('Expected sync result');
    const svg = result.svg!;
    expect(svg).toContain('<svg');
    expect(svg).toContain('Document');
    expect(svg).toContain('#111827'); // dark background
    const outPath = join(GALLERY_DIR, 'tree-document-dark.svg');
    writeFileSync(outPath, svg, 'utf-8');
    console.log('[tree] tree-document-dark.svg →', outPath);
  });
});

// ---------------------------------------------------------------------------
// 9. Dark theme gallery emit — PNG
// ---------------------------------------------------------------------------

describe('Tree Grammar — dark theme gallery PNG emit', () => {
  it('emits tree-document-dark.png to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderTreeDocument(doc, { format: 'png' }, treeDarkTheme);
    if (result instanceof Promise) throw new Error('Expected sync result');
    const png = result.png!;
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png[0]).toBe(0x89); // PNG signature byte
    const outPath = join(GALLERY_DIR, 'tree-document-dark.png');
    writeFileSync(outPath, png);
    console.log('[tree] tree-document-dark.png →', outPath);
  });
});
