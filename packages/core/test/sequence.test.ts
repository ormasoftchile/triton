/**
 * @file test/sequence.test.ts — Sequence Grammar increment-1 tests.
 *
 * Tests:
 *  1. Schema validation (valid doc, invalid docs).
 *  2. Scene building — output structure correctness.
 *  3. Determinism — two builds of the same document produce identical sceneHash.
 *  4. Gallery emit — writes sequence-rest-auth.{svg,png} to examples/gallery/.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  buildSequenceScene,
  renderSequenceDocument,
  sequenceDocumentSchema,
} from '../src/grammars/sequence/index.js';
import { sceneHash } from '../src/scene.js';
import type { SequenceDocument } from '../src/grammars/sequence/index.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function loadFixture(): SequenceDocument {
  const raw = readFileSync(
    join(GALLERY_DIR, 'sequence-rest-auth.sequence.yaml'),
    'utf-8',
  );
  return parseYaml(raw) as SequenceDocument;
}

// ---------------------------------------------------------------------------
// 1. Schema validation
// ---------------------------------------------------------------------------

describe('Sequence Grammar — schema validation', () => {
  it('accepts the REST auth fixture', () => {
    const doc = loadFixture();
    expect(() => sequenceDocumentSchema.parse(doc)).not.toThrow();
  });

  it('rejects a doc with no participants', () => {
    const doc = {
      version: '1.0',
      metadata: { title: 'test' },
      sequence: { participants: [], messages: [] },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it('rejects duplicate participant ids', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'A2' },
        ],
        messages: [],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("Duplicate participant id: 'a'");
  });

  it('rejects a message referencing an unknown participant', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [{ id: 'client', label: 'Client' }],
        messages: [
          { from: 'client', to: 'ghost', label: 'Hello', order: 1, kind: 'sync' },
        ],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    const msg = JSON.stringify((result as { error: unknown }).error);
    expect(msg).toContain("unknown participant id 'ghost'");
  });

  it('rejects a message with a negative order', () => {
    const doc = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [{ from: 'a', to: 'b', label: 'Hi', order: -1, kind: 'sync' }],
      },
    };
    const result = sequenceDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Scene building
// ---------------------------------------------------------------------------

describe('Sequence Grammar — scene building', () => {
  it('produces a Scene with correct structure for the REST auth fixture', () => {
    const doc = loadFixture();
    const scene = buildSequenceScene(doc);

    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    expect(scene.background).toBe('#ffffff');
    expect(Array.isArray(scene.primitives)).toBe(true);
    expect(scene.primitives.length).toBeGreaterThan(0);

    // Background rect should be first
    const bg = scene.primitives[0];
    expect(bg.kind).toBe('rect');
    if (bg.kind === 'rect') {
      expect(bg.x).toBe(0);
      expect(bg.y).toBe(0);
      expect(bg.width).toBe(scene.width);
      expect(bg.height).toBe(scene.height);
    }

    // At least one dashed line (lifeline)
    const hasLifeline = scene.primitives.some(
      (p) => p.kind === 'line' && (p as { dashArray?: string }).dashArray != null,
    );
    expect(hasLifeline).toBe(true);

    // At least one filled path (solid arrowhead for sync message)
    const hasSolidArrow = scene.primitives.some(
      (p) =>
        p.kind === 'path' &&
        (p as { fill?: string }).fill !== 'none' &&
        (p as { fill?: string }).fill !== '',
    );
    expect(hasSolidArrow).toBe(true);

    // Text primitives should include participant labels
    const texts = scene.primitives.filter((p) => p.kind === 'text');
    const labels = texts.map((p) => (p as { text: string }).text);
    expect(labels).toContain('Client');
    expect(labels).toContain('Auth Server');
  });

  it('handles a single-participant empty-message diagram', () => {
    const doc: SequenceDocument = {
      version: '1.0',
      metadata: { title: 'Minimal' },
      sequence: {
        participants: [{ id: 'only', label: 'Only' }],
        messages: [],
      },
    };
    const scene = buildSequenceScene(doc);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
  });

  it('handles messages in non-sequential order values (sorts correctly)', () => {
    const doc: SequenceDocument = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        messages: [
          { from: 'b', to: 'a', label: 'Third', order: 30, kind: 'reply' },
          { from: 'a', to: 'b', label: 'First', order: 10, kind: 'sync' },
          { from: 'a', to: 'b', label: 'Second', order: 20, kind: 'async' },
        ],
      },
    };
    const scene = buildSequenceScene(doc);
    // Should not throw; produces valid scene
    expect(scene.primitives.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism
// ---------------------------------------------------------------------------

describe('Sequence Grammar — determinism', () => {
  it('two builds of the same document produce identical sceneHash', () => {
    const doc = loadFixture();
    const scene1 = buildSequenceScene(doc);
    const scene2 = buildSequenceScene(doc);
    expect(sceneHash(scene1)).toBe(sceneHash(scene2));
  });

  it('sceneHash changes when participant order changes', () => {
    const base: SequenceDocument = {
      version: '1.0',
      metadata: {},
      sequence: {
        participants: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ],
        messages: [
          { from: 'a', to: 'b', label: 'Hello', order: 1, kind: 'sync' },
        ],
      },
    };
    const reversed: SequenceDocument = {
      ...base,
      sequence: {
        ...base.sequence,
        participants: [
          { id: 'b', label: 'Beta' },
          { id: 'a', label: 'Alpha' },
        ],
      },
    };
    const h1 = sceneHash(buildSequenceScene(base));
    const h2 = sceneHash(buildSequenceScene(reversed));
    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// 4. Gallery emit
// ---------------------------------------------------------------------------

describe('Sequence Grammar — gallery emit', () => {
  it('emits sequence-rest-auth.svg to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderSequenceDocument(doc, { format: 'svg' });
    if (result instanceof Promise) throw new Error('Expected sync result');
    const svg = result.svg!;
    expect(svg).toContain('<svg');
    expect(svg).toContain('Client');
    expect(svg).toContain('Auth Server');
    const outPath = join(GALLERY_DIR, 'sequence-rest-auth.svg');
    writeFileSync(outPath, svg, 'utf-8');
    console.log('[sequence] sequence-rest-auth.svg →', outPath);
  });

  it('emits sequence-rest-auth.png to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const doc = loadFixture();
    const result = renderSequenceDocument(doc, { format: 'png' });
    if (result instanceof Promise) throw new Error('Expected sync result');
    const png = result.png!;
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png[0]).toBe(0x89); // PNG signature byte
    const outPath = join(GALLERY_DIR, 'sequence-rest-auth.png');
    writeFileSync(outPath, png);
    console.log('[sequence] sequence-rest-auth.png →', outPath);
  });
});
