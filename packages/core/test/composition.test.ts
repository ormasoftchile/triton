/**
 * @file test/composition.test.ts — Composition Grammar + scene-transform tests.
 *
 * Tests:
 *  A. scene-transform — translateAndScale (each primitive kind, paths, groups, scale)
 *     A1. line: coordinates + strokeWidth scaled/translated
 *     A2. rect: x,y,w,h,rx,strokeWidth
 *     A3. circle: cx,cy,r,strokeWidth
 *     A4. text: x,y,fontSize
 *     A5. multitext: x,y,fontSize,lineHeight
 *     A6. path — M L commands (absolute)
 *     A7. path — C and A commands with absolute coords
 *     A8. path — relative commands (m l c) — scale-only, no translate
 *     A9. path — H V commands (absolute and relative)
 *     A10. group — recursive descent
 *     A11. image: x,y,w,h,borderRadius
 *     A12. identity: scale=1, dx=0, dy=0 → coordinates unchanged
 *     A13. dashArray scaling on line and path
 *     A14. strokeGradient coordinate transform
 *     A15. embedSceneInRect — fit (no upscale) and scale-down
 *
 *  B. Composition module
 *     B1. Schema validation — accepts the RAG poster fixture
 *     B2. Schema validation — rejects duplicate cell ids
 *     B3. Schema validation — rejects cells overflowing column count
 *     B4. Determinism — two builds of the same document produce identical sceneHash
 *     B5. Gallery emit — writes poster-rag-architecture.{svg,png} to examples/gallery/
 *     B6. Scene structure — canvas background rect is first primitive
 *     B7. Stat cell synthesises a scene with text primitives
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  translateAndScale,
  embedSceneInRect,
  transformPathD,
} from '../src/scene-transform.js';
import {
  buildCompositionScene,
  renderCompositionDocument,
  compositionDocumentSchema,
} from '../src/composition/index.js';
import { sceneHash } from '../src/scene.js';
import type { CompositionDocument } from '../src/composition/index.js';
import type {
  LinePrimitive,
  RectPrimitive,
  CirclePrimitive,
  TextPrimitive,
  MultiTextPrimitive,
  PathPrimitive,
  GroupPrimitive,
  ImagePrimitive,
  Scene,
} from '../src/scene.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(): CompositionDocument {
  const raw = readFileSync(
    join(GALLERY_DIR, 'poster-rag-architecture.composition.yaml'),
    'utf-8',
  );
  return parseYaml(raw) as CompositionDocument;
}

function minimalComposition(): CompositionDocument {
  return {
    version: '1.0',
    metadata: { title: 'Test Poster' },
    grid: { columns: 2, rows: 1 },
    cells: [
      {
        id: 'stat-a',
        col: 0,
        row: 0,
        title: 'Panel A',
        content: { kind: 'stat', value: '42', label: 'the answer' },
      },
      {
        id: 'text-b',
        col: 1,
        row: 0,
        content: { kind: 'text', text: 'Hello composition' },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// A. translateAndScale unit tests
// ---------------------------------------------------------------------------

describe('scene-transform — translateAndScale', () => {
  // A1. Line
  it('A1: transforms line coordinates and strokeWidth', () => {
    const p: LinePrimitive = {
      kind: 'line', x1: 10, y1: 20, x2: 30, y2: 40, stroke: '#fff', strokeWidth: 2,
    };
    const r = translateAndScale(p, 5, 10, 2) as LinePrimitive;
    expect(r.kind).toBe('line');
    expect(r.x1).toBe(10 * 2 + 5);   // 25
    expect(r.y1).toBe(20 * 2 + 10);  // 50
    expect(r.x2).toBe(30 * 2 + 5);   // 65
    expect(r.y2).toBe(40 * 2 + 10);  // 90
    expect(r.strokeWidth).toBe(4);
    expect(r.stroke).toBe('#fff');    // unchanged
  });

  // A2. Rect
  it('A2: transforms rect fields', () => {
    const p: RectPrimitive = {
      kind: 'rect', x: 0, y: 0, width: 100, height: 50, fill: '#000',
      stroke: '#fff', strokeWidth: 1, rx: 8,
    };
    const r = translateAndScale(p, 10, 20, 0.5) as RectPrimitive;
    expect(r.x).toBe(10);
    expect(r.y).toBe(20);
    expect(r.width).toBe(50);
    expect(r.height).toBe(25);
    expect(r.rx).toBe(4);
    expect(r.strokeWidth).toBe(0.5);
    expect(r.fill).toBe('#000');
  });

  // A3. Circle
  it('A3: transforms circle fields', () => {
    const p: CirclePrimitive = {
      kind: 'circle', cx: 50, cy: 50, r: 20, fill: '#blue', strokeWidth: 2,
    };
    const r = translateAndScale(p, 0, 0, 3) as CirclePrimitive;
    expect(r.cx).toBe(150);
    expect(r.cy).toBe(150);
    expect(r.r).toBe(60);
    expect(r.strokeWidth).toBe(6);
  });

  // A4. Text
  it('A4: transforms text position and fontSize', () => {
    const p: TextPrimitive = {
      kind: 'text', x: 100, y: 200, text: 'Hello',
      fontFamily: 'Arial', fontSize: 16, fontWeight: 400, fill: '#fff',
      textAnchor: 'middle', dominantBaseline: 'central',
    };
    const r = translateAndScale(p, 50, 100, 2) as TextPrimitive;
    expect(r.x).toBe(100 * 2 + 50);   // 250
    expect(r.y).toBe(200 * 2 + 100);  // 500
    expect(r.fontSize).toBe(32);
    expect(r.text).toBe('Hello');
    expect(r.textAnchor).toBe('middle');
    expect(r.dominantBaseline).toBe('central');
  });

  // A5. MultiText
  it('A5: transforms multitext position, fontSize, and lineHeight', () => {
    const p: MultiTextPrimitive = {
      kind: 'multitext', x: 10, y: 20, lines: ['a', 'b'],
      lineHeight: 20, fontFamily: 'Arial', fontSize: 14, fontWeight: 400, fill: '#fff',
    };
    const r = translateAndScale(p, 0, 0, 2) as MultiTextPrimitive;
    expect(r.x).toBe(20);
    expect(r.y).toBe(40);
    expect(r.fontSize).toBe(28);
    expect(r.lineHeight).toBe(40);
    expect(r.lines).toEqual(['a', 'b']); // unchanged
  });

  // A6. Path — M L commands (absolute)
  it('A6: transforms path M and L absolute commands', () => {
    const p: PathPrimitive = {
      kind: 'path', d: 'M10 20 L30 40', fill: 'none', stroke: '#fff',
    };
    const r = translateAndScale(p, 5, 10, 2) as PathPrimitive;
    // M: x=10*2+5=25, y=20*2+10=50; L: x=30*2+5=65, y=40*2+10=90
    expect(r.d).toContain('M25 50');
    expect(r.d).toContain('L65 90');
  });

  // A7. Path — C and A commands (absolute)
  it('A7: transforms path C (cubic bezier) and A (arc) absolute commands', () => {
    const pC: PathPrimitive = {
      kind: 'path', d: 'M0 0 C10 20 30 40 50 60', fill: 'none',
    };
    const rC = translateAndScale(pC, 0, 0, 2) as PathPrimitive;
    // C: all 6 coords doubled (no translation since dx=dy=0): 20 40 60 80 100 120
    expect(rC.d).toContain('C20 40 60 80 100 120');

    // A: rx,ry scaled; rotation,flags unchanged; endpoint translated
    const pA: PathPrimitive = {
      kind: 'path', d: 'M100 200 A50 30 0 0 1 200 300', fill: 'none',
    };
    const rA = translateAndScale(pA, 10, 20, 2) as PathPrimitive;
    // rx=50*2=100, ry=30*2=60, rot=0, flag1=0, flag2=1, x=200*2+10=410, y=300*2+20=620
    expect(rA.d).toContain('A100 60 0 0 1 410 620');
  });

  // A8. Path — relative commands (scale only, no translate)
  it('A8: relative path commands scale but do not translate', () => {
    const p: PathPrimitive = {
      kind: 'path', d: 'm5 10 l20 30 c10 0 10 20 20 20', fill: 'none',
    };
    const r = translateAndScale(p, 100, 200, 2) as PathPrimitive;
    // Relative commands scale only: m → m10 20; l → l40 60; c → c20 0 20 40 40 40
    expect(r.d).toContain('m10 20');
    expect(r.d).toContain('l40 60');
    expect(r.d).toContain('c20 0 20 40 40 40');
  });

  // A9. Path — H V commands (absolute and relative)
  it('A9: transforms H (abs x-only) and V (abs y-only) path commands', () => {
    const p: PathPrimitive = {
      kind: 'path', d: 'M0 0 H100 V200', fill: 'none',
    };
    const r = translateAndScale(p, 5, 10, 2) as PathPrimitive;
    // H: x=100*2+5=205; V: y=200*2+10=410
    expect(r.d).toContain('H205');
    expect(r.d).toContain('V410');
  });

  // A10. Group — recursive descent
  it('A10: recurses into group children', () => {
    const child: RectPrimitive = {
      kind: 'rect', x: 10, y: 20, width: 50, height: 30, fill: '#f00',
    };
    const p: GroupPrimitive = {
      kind: 'group',
      primitives: [child],
    };
    const r = translateAndScale(p, 5, 10, 2) as GroupPrimitive;
    expect(r.kind).toBe('group');
    expect(r.primitives).toHaveLength(1);
    const rChild = r.primitives[0] as RectPrimitive;
    expect(rChild.x).toBe(10 * 2 + 5);   // 25
    expect(rChild.y).toBe(20 * 2 + 10);  // 50
    expect(rChild.width).toBe(100);
    expect(rChild.height).toBe(60);
  });

  // A11. Image
  it('A11: transforms image position and dimensions', () => {
    const p: ImagePrimitive = {
      kind: 'image', x: 0, y: 0, width: 200, height: 100,
      data: 'data:image/png;base64,abc', mimeType: 'image/png', borderRadius: 8,
    };
    const r = translateAndScale(p, 20, 30, 1.5) as ImagePrimitive;
    expect(r.x).toBe(20);
    expect(r.y).toBe(30);
    expect(r.width).toBe(300);
    expect(r.height).toBe(150);
    expect(r.borderRadius).toBe(12);
  });

  // A12. Identity (scale=1, dx=0, dy=0)
  it('A12: identity transform leaves coordinates unchanged', () => {
    const p: LinePrimitive = {
      kind: 'line', x1: 5, y1: 10, x2: 15, y2: 20, stroke: '#000', strokeWidth: 1,
    };
    const r = translateAndScale(p, 0, 0, 1) as LinePrimitive;
    expect(r.x1).toBe(5);
    expect(r.y1).toBe(10);
    expect(r.x2).toBe(15);
    expect(r.y2).toBe(20);
    expect(r.strokeWidth).toBe(1);
  });

  // A13. dashArray scaling
  it('A13: scales dashArray on line and path', () => {
    const line: LinePrimitive = {
      kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, stroke: '#000', strokeWidth: 1,
      dashArray: '6,4',
    };
    const rLine = translateAndScale(line, 0, 0, 2) as LinePrimitive;
    expect(rLine.dashArray).toBe('12,8');

    const path: PathPrimitive = {
      kind: 'path', d: 'M0 0 L10 0', fill: 'none', dashArray: '2,4,1',
    };
    const rPath = translateAndScale(path, 0, 0, 3) as PathPrimitive;
    expect(rPath.dashArray).toBe('6,12,3');
  });

  // A14. strokeGradient coordinate transform
  it('A14: transforms strokeGradient coordinates', () => {
    const p: PathPrimitive = {
      kind: 'path', d: 'M0 0 L100 0', fill: 'none',
      strokeGradient: { from: '#f00', to: '#00f', x1: 0, y1: 0, x2: 100, y2: 0 },
    };
    const r = translateAndScale(p, 10, 20, 2) as PathPrimitive;
    const sg = r.strokeGradient!;
    expect(sg.x1).toBe(10);    // 0*2+10
    expect(sg.y1).toBe(20);    // 0*2+20
    expect(sg.x2).toBe(210);   // 100*2+10
    expect(sg.y2).toBe(20);    // 0*2+20
    expect(sg.from).toBe('#f00');
    expect(sg.to).toBe('#00f');
  });

  // A15. embedSceneInRect
  it('A15: embedSceneInRect fits sub-scene and never upscales', () => {
    const subScene: Scene = {
      width: 200,
      height: 100,
      background: '#fff',
      primitives: [
        { kind: 'rect', x: 0, y: 0, width: 200, height: 100, fill: '#f00' },
      ],
    };

    // Smaller target: should scale down
    const small = embedSceneInRect(subScene, { x: 0, y: 0, width: 100, height: 50 });
    expect(small).toHaveLength(1);
    const smallRect = small[0] as RectPrimitive;
    // Scale = min(100/200, 50/100, 1) = 0.5
    expect(smallRect.width).toBe(100);
    expect(smallRect.height).toBe(50);

    // Larger target: should NOT upscale (scale stays at 1.0)
    const large = embedSceneInRect(subScene, { x: 50, y: 25, width: 400, height: 300 });
    expect(large).toHaveLength(1);
    const largeRect = large[0] as RectPrimitive;
    // scale = min(400/200, 300/100, 1) = 1.0 (capped), centered
    expect(largeRect.width).toBe(200);
    expect(largeRect.height).toBe(100);
    // centered: x = 50 + (400-200)/2 = 150; y = 25 + (300-100)/2 = 125
    expect(largeRect.x).toBe(150);
    expect(largeRect.y).toBe(125);
  });
});

// ---------------------------------------------------------------------------
// B. Composition module tests
// ---------------------------------------------------------------------------

describe('Composition Grammar — schema validation', () => {
  // B1. Accepts RAG fixture
  it('B1: accepts the RAG poster fixture', () => {
    const doc = loadFixture();
    expect(() => compositionDocumentSchema.parse(doc)).not.toThrow();
  });

  // B2. Rejects duplicate cell ids
  it('B2: rejects duplicate cell ids', () => {
    const doc: CompositionDocument = {
      version: '1.0',
      metadata: {},
      grid: { columns: 2, rows: 1 },
      cells: [
        { id: 'same', col: 0, row: 0, content: { kind: 'stat', value: 'A' } },
        { id: 'same', col: 1, row: 0, content: { kind: 'stat', value: 'B' } },
      ],
    };
    const result = compositionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(JSON.stringify((result as { error: unknown }).error)).toContain('Duplicate cell id');
  });

  // B3. Rejects cell overflowing column count
  it('B3: rejects cells that overflow grid.columns', () => {
    const doc: CompositionDocument = {
      version: '1.0',
      metadata: {},
      grid: { columns: 2, rows: 1 },
      cells: [
        {
          id: 'wide',
          col: 0,
          row: 0,
          colSpan: 3, // colSpan=3 with col=0 overflows columns=2
          content: { kind: 'stat', value: '!' },
        },
      ],
    };
    const result = compositionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    expect(JSON.stringify((result as { error: unknown }).error)).toContain('exceeds grid.columns');
  });

  it('B3b: rejects missing version', () => {
    const doc = {
      metadata: {},
      grid: { columns: 1 },
      cells: [{ id: 'a', content: { kind: 'stat', value: 'x' } }],
    };
    const result = compositionDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

describe('Composition Grammar — scene building', () => {
  // B4. Determinism
  it('B4: two builds produce identical sceneHash', () => {
    const doc = minimalComposition();
    const hash1 = sceneHash(buildCompositionScene(doc));
    const hash2 = sceneHash(buildCompositionScene(doc));
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  // B6. Canvas background rect is first primitive
  it('B6: first primitive is the canvas background rect', () => {
    const doc = minimalComposition();
    const scene = buildCompositionScene(doc);
    const first = scene.primitives[0];
    expect(first?.kind).toBe('rect');
    const bg = first as RectPrimitive;
    expect(bg.x).toBe(0);
    expect(bg.y).toBe(0);
    expect(bg.width).toBe(scene.width);
    expect(bg.height).toBe(scene.height);
  });

  // B7. Stat cell produces text primitives
  it('B7: stat cell contributes text primitives to scene', () => {
    const doc: CompositionDocument = {
      version: '1.0',
      metadata: {},
      grid: { columns: 1, rows: 1 },
      cells: [
        {
          id: 's',
          col: 0,
          row: 0,
          content: { kind: 'stat', value: '99%', label: 'uptime' },
        },
      ],
    };
    const scene = buildCompositionScene(doc);
    const texts = scene.primitives.filter((p) => p.kind === 'text');
    expect(texts.length).toBeGreaterThan(0);
    const textContents = (texts as TextPrimitive[]).map((t) => t.text);
    expect(textContents).toContain('99%');
    expect(textContents).toContain('uptime');
  });

  it('B8: full RAG fixture builds a scene with positive dimensions', () => {
    const doc = loadFixture();
    const scene = buildCompositionScene(doc);
    expect(scene.width).toBeGreaterThan(0);
    expect(scene.height).toBeGreaterThan(0);
    expect(scene.primitives.length).toBeGreaterThan(10);
  });
});

describe('Composition Grammar — gallery emit', () => {
  // B5. Gallery emit
  it('B5: emits poster-rag-architecture.svg and .png to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) {
      mkdirSync(GALLERY_DIR, { recursive: true });
    }

    const doc = loadFixture();
    const svgResult = renderCompositionDocument(doc, { format: 'svg' }) as {
      svg: string;
      sceneHash: string;
    };
    expect(typeof svgResult.svg).toBe('string');
    expect(svgResult.svg.length).toBeGreaterThan(100);

    const svgPath = join(GALLERY_DIR, 'poster-rag-architecture.svg');
    writeFileSync(svgPath, svgResult.svg, 'utf-8');
    expect(existsSync(svgPath)).toBe(true);

    const pngResult = renderCompositionDocument(doc, { format: 'png' }) as {
      png: Uint8Array;
    };
    expect(pngResult.png).toBeInstanceOf(Uint8Array);
    expect(pngResult.png.length).toBeGreaterThan(100);

    const pngPath = join(GALLERY_DIR, 'poster-rag-architecture.png');
    writeFileSync(pngPath, pngResult.png);
    expect(existsSync(pngPath)).toBe(true);

    console.log(`[gallery] Poster SVG: ${svgPath} (${svgResult.svg.length} chars)`);
    console.log(`[gallery] Poster PNG: ${pngPath} (${pngResult.png.length} bytes)`);
  });

  it('B5b: determinism across two gallery emits (same sceneHash)', () => {
    const doc = loadFixture();
    const r1 = renderCompositionDocument(doc, { format: 'svg' }) as { sceneHash: string };
    const r2 = renderCompositionDocument(doc, { format: 'svg' }) as { sceneHash: string };
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });
});
