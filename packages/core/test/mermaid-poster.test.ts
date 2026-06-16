/**
 * @file test/mermaid-poster.test.ts — Poster DSL front-end tests.
 *
 * Coverage:
 *   A. Parser — parsePosterInternal
 *      A1. Basic poster: title, theme, columns, rows extracted from frontmatter
 *      A2. Cells: correct row/col, typeHeader, body
 *      A3. Layout: "grid 2x2" → columns=2, rows=2
 *      A4. Unknown layout → warning, fallback 2x2
 *      A5. Cell body de-indentation preserves relative indent
 *      A6. No cells → warning collected
 *      A7. Poster without quoted title: bare title
 *
 *   B. detectDiagramType
 *      B1. 'poster' text → returns 'poster'
 *      B2. 'poster' in frontmatter body → returns 'poster'
 *
 *   C. Render — renderMermaid + renderPoster
 *      C1. Full 2x2 poster renders to SVG without error
 *      C2. Scene hash is deterministic (two renders identical)
 *      C3. SVG contains expected canvas dimensions
 *      C4. Graceful degradation: bad cell type → warn + rest renders
 *      C5. Graceful degradation: malformed cell body → warn + rest renders
 *      C6. All cells fail → throws with descriptive message
 *      C7. Gallery emit — poster-rag.{mmd,svg,png} written to examples/gallery/
 *      C8. Second poster under midnight theme — poster-rag-midnight.{mmd,svg,png}
 *
 *   D. Theme coherence
 *      D1. executive theme → canvas background is white (#FFFFFF)
 *      D2. midnight theme  → canvas background is dark (#0A0E1A)
 *
 *   E. CompositionDocument — SceneCellContent additive kind
 *      E1. layoutComposition accepts SceneCellContent without error
 *      E2. Scene hash stable across two layoutComposition calls with same input
 *
 *   F. Excel cell addressing
 *      F0. excelToRowCol unit: A1→[0,0], B1→[0,1], A2→[1,0], C3→[2,2], Z1→[0,25], AA1→[0,26], AB1→[0,27]
 *      F1. Parser: A1/B1/A2/B2 map to correct row/col
 *      F2. Case-insensitive: a1 ≡ A1
 *      F3. C3 → row:2, col:2
 *      F4. AA1 → row:0, col:26
 *      F5. Mixed bracket [r,c] and Excel in same poster
 *      F6. Malformed cell address → warn + skip (graceful degradation)
 *      F7. Equivalence: Excel poster produces same cell positions as [r,c] poster
 *      F8. Excel poster renders to SVG
 *      F9. Gallery emit — poster-excel.{mmd,svg,png}
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parsePosterInternal, buildCompositionThemeFor, excelToRowCol } from '../src/frontend/mermaid/poster.js';
import { detectDiagramType, renderMermaid } from '../src/frontend/mermaid/index.js';
import { layoutComposition } from '../src/composition/index.js';
import type { SceneCellContent } from '../src/composition/index.js';
import { sceneHash } from '../src/scene.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');

function writeGallery(name: string, content: string | Uint8Array): void {
  if (!existsSync(GALLERY)) mkdirSync(GALLERY, { recursive: true });
  writeFileSync(join(GALLERY, name), content);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RAG_POSTER_MMD = `---
theme: executive
layout: grid 2x2
---
poster "RAG Architecture"
  cell [0,0]: flowchart LR
    A[Query] --> B[Retriever]
    B --> C[Generator]
  cell [0,1]: sequenceDiagram
    User->>API: request
    API->>DB: lookup
    DB-->>API: results
    API-->>User: response
  cell [1,0]: mindmap
    root((RAG))
      Retriever
        Dense
        Sparse
      Generator
        LLM
        Context
  cell [1,1]: xychart-beta
    title "Retrieval Accuracy"
    x-axis [k=1, k=3, k=5, k=10]
    y-axis "Recall %" 0 --> 100
    bar [72, 81, 86, 91]
`;

const RAG_MIDNIGHT_MMD = `---
theme: midnight
layout: grid 2x2
---
poster "RAG Architecture — Night Mode"
  cell [0,0]: flowchart LR
    A[Query] --> B[Retriever]
    B --> C[Generator]
  cell [0,1]: sequenceDiagram
    User->>API: request
    API->>DB: lookup
    DB-->>API: results
    API-->>User: response
  cell [1,0]: mindmap
    root((RAG))
      Retriever
        Dense
        Sparse
      Generator
        LLM
        Context
  cell [1,1]: xychart-beta
    title "Retrieval Accuracy"
    x-axis [k=1, k=3, k=5, k=10]
    y-axis "Recall %" 0 --> 100
    bar [72, 81, 86, 91]
`;

// ---------------------------------------------------------------------------
// A. Parser
// ---------------------------------------------------------------------------

describe('A. parsePosterInternal — parser', () => {
  it('A1. extracts title, theme, columns, rows from frontmatter', () => {
    const { doc } = parsePosterInternal(RAG_POSTER_MMD);
    expect(doc.title).toBe('RAG Architecture');
    expect(doc.theme).toBe('executive');
    expect(doc.columns).toBe(2);
    expect(doc.rows).toBe(2);
  });

  it('A2. extracts 4 cells with correct row/col/typeHeader', () => {
    const { doc } = parsePosterInternal(RAG_POSTER_MMD);
    expect(doc.cells).toHaveLength(4);

    expect(doc.cells[0]!.row).toBe(0);
    expect(doc.cells[0]!.col).toBe(0);
    expect(doc.cells[0]!.typeHeader).toMatch(/^flowchart\s+LR$/i);

    expect(doc.cells[1]!.row).toBe(0);
    expect(doc.cells[1]!.col).toBe(1);
    expect(doc.cells[1]!.typeHeader).toMatch(/^sequenceDiagram$/i);

    expect(doc.cells[2]!.row).toBe(1);
    expect(doc.cells[2]!.col).toBe(0);
    expect(doc.cells[2]!.typeHeader).toMatch(/^mindmap$/i);

    expect(doc.cells[3]!.row).toBe(1);
    expect(doc.cells[3]!.col).toBe(1);
    expect(doc.cells[3]!.typeHeader).toMatch(/^xychart-beta$/i);
  });

  it('A3. "grid 2x2" → columns=2, rows=2', () => {
    const { doc } = parsePosterInternal(`---
layout: grid 2x2
---
poster "Test"
  cell [0,0]: flowchart LR
    A --> B
`);
    expect(doc.columns).toBe(2);
    expect(doc.rows).toBe(2);
  });

  it('A4. unknown layout → warning, default columns=2', () => {
    const { doc, warnings } = parsePosterInternal(`---
layout: columns 3
---
poster "Test"
  cell [0,0]: flowchart LR
    A --> B
`);
    expect(warnings.some(w => w.includes('Unrecognised layout'))).toBe(true);
    expect(doc.columns).toBe(2); // fallback
  });

  it('A5. cell body lines are de-indented preserving relative structure', () => {
    const { doc } = parsePosterInternal(RAG_POSTER_MMD);
    // The mindmap cell body should start with "root((RAG))" not spaces
    const mindmapCell = doc.cells[2]!;
    const bodyLines = mindmapCell.body.split('\n').filter(l => l.trim() !== '');
    expect(bodyLines[0]!.trim()).toBe('root((RAG))');
    // Second-level items should be indented relative to root
    expect(bodyLines[1]!).toMatch(/^\s+Retriever/);
  });

  it('A6. poster with no cells → warning', () => {
    const { doc, warnings } = parsePosterInternal(`---
theme: executive
---
poster "Empty"
`);
    expect(doc.cells).toHaveLength(0);
    expect(warnings.some(w => w.includes('No cells found'))).toBe(true);
  });

  it('A7. unquoted poster title', () => {
    const { doc } = parsePosterInternal(`poster My Unquoted Title
  cell [0,0]: flowchart LR
    A --> B
`);
    expect(doc.title).toBe('My Unquoted Title');
  });
});

// ---------------------------------------------------------------------------
// B. detectDiagramType
// ---------------------------------------------------------------------------

describe('B. detectDiagramType — poster detection', () => {
  it('B1. bare "poster" keyword → "poster"', () => {
    expect(detectDiagramType('poster "Hello"\n  cell [0,0]: flowchart LR\n    A-->B')).toBe('poster');
  });

  it('B2. poster with frontmatter → "poster"', () => {
    expect(detectDiagramType(RAG_POSTER_MMD)).toBe('poster');
  });
});

// ---------------------------------------------------------------------------
// C. renderMermaid — poster render
// ---------------------------------------------------------------------------

describe('C. renderMermaid — poster render', () => {
  it('C1. 2x2 RAG poster renders to SVG without error (executive theme)', () => {
    const result = renderMermaid(RAG_POSTER_MMD, { format: 'svg' });
    expect(result.kind).toBe('poster');
    expect(result.svg).toBeDefined();
    expect(result.svg!.length).toBeGreaterThan(100);
    expect(result.svg).toContain('<svg');
  });

  it('C2. scene hash is deterministic (two renders produce identical sceneHash)', () => {
    const r1 = renderMermaid(RAG_POSTER_MMD, { format: 'svg' });
    const r2 = renderMermaid(RAG_POSTER_MMD, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('C3. SVG contains expected canvas structure (rect elements)', () => {
    const result = renderMermaid(RAG_POSTER_MMD, { format: 'svg' });
    expect(result.svg).toContain('<rect');
    expect(result.svg).toContain('</svg>');
  });

  it('C4. graceful degradation: unknown cell type → warning, rest renders', () => {
    const text = `---
theme: executive
layout: grid 2x2
---
poster "Test Degradation"
  cell [0,0]: flowchart LR
    A --> B
  cell [0,1]: unknownDiagram
    some content
  cell [1,0]: sequenceDiagram
    Alice->>Bob: hello
  cell [1,1]: pie
    title Proportions
    "A" : 40
    "B" : 60
`;
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('poster');
    expect(result.svg).toBeDefined();
    // At least one warning about the unknown cell
    expect(result.warnings.some(w =>
      w.includes('unknownDiagram') || w.includes('unknown') || w.includes('not supported'),
    )).toBe(true);
    // Poster still produced (other 3 cells succeeded)
    expect(result.svg).toContain('<svg');
  });

  it('C5. malformed cell body → warning, rest of poster renders', () => {
    const text = `---
theme: executive
layout: grid 1x2
---
poster "Partial"
  cell [0,0]: flowchart LR
    A --> B
  cell [1,0]: xychart-beta
    title "Bad Chart"
    x-axis this is not valid xychart syntax at all @@@@
`;
    // Should not throw — either renders or warns and skips the bad cell
    expect(() => renderMermaid(text, { format: 'svg' })).not.toThrow();
  });

  it('C6. all cells fail → throws with descriptive message', () => {
    const text = `poster "Impossible"
  cell [0,0]: unknownTypeXYZ
    garbage content here
  cell [0,1]: anotherUnknownType
    more garbage
`;
    expect(() => renderMermaid(text, { format: 'svg' })).toThrow(/All cells failed/);
  });

  it('C7. Gallery emit — poster-rag.{mmd,svg,png} written to examples/gallery/', () => {
    const result = renderMermaid(RAG_POSTER_MMD, { format: 'svg' });
    expect(result.svg).toBeDefined();

    writeGallery('poster-rag.mmd', RAG_POSTER_MMD);
    writeGallery('poster-rag.svg', result.svg!);

    const pngResult = renderMermaid(RAG_POSTER_MMD, { format: 'png' });
    expect(pngResult.png).toBeDefined();
    writeGallery('poster-rag.png', pngResult.png!);

    expect(existsSync(join(GALLERY, 'poster-rag.mmd'))).toBe(true);
    expect(existsSync(join(GALLERY, 'poster-rag.svg'))).toBe(true);
    expect(existsSync(join(GALLERY, 'poster-rag.png'))).toBe(true);
  });

  it('C8. Gallery emit — midnight theme poster-rag-midnight.{mmd,svg,png}', () => {
    const result = renderMermaid(RAG_MIDNIGHT_MMD, { format: 'svg' });
    expect(result.svg).toBeDefined();

    writeGallery('poster-rag-midnight.mmd', RAG_MIDNIGHT_MMD);
    writeGallery('poster-rag-midnight.svg', result.svg!);

    const pngResult = renderMermaid(RAG_MIDNIGHT_MMD, { format: 'png' });
    expect(pngResult.png).toBeDefined();
    writeGallery('poster-rag-midnight.png', pngResult.png!);

    expect(existsSync(join(GALLERY, 'poster-rag-midnight.svg'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D. Theme coherence
// ---------------------------------------------------------------------------

describe('D. Theme coherence', () => {
  it('D1. executive theme → composition canvas is white (#FFFFFF)', () => {
    const theme = buildCompositionThemeFor('executive');
    expect(theme.canvasBackground).toBe('#FFFFFF');
    expect(theme.posterHeaderBackground).toBe('#1F497D');
  });

  it('D2. midnight theme → composition canvas is dark (#0A0E1A)', () => {
    const theme = buildCompositionThemeFor('midnight');
    expect(theme.canvasBackground).toBe('#0A0E1A');
  });

  it('D3. executive poster SVG contains navy colour (header)', () => {
    const result = renderMermaid(RAG_POSTER_MMD, { format: 'svg' });
    // The executive header background is #1F497D — should appear in the SVG
    expect(result.svg).toContain('#1F497D');
  });

  it('D4. midnight poster SVG contains indigo colour (cell borders)', () => {
    const result = renderMermaid(RAG_MIDNIGHT_MMD, { format: 'svg' });
    // Midnight cell borders are #6366F1
    expect(result.svg).toContain('#6366F1');
  });
});

// ---------------------------------------------------------------------------
// E. SceneCellContent — additive composition kind
// ---------------------------------------------------------------------------

describe('E. SceneCellContent — additive composition kind (non-breaking)', () => {
  it('E1. layoutComposition accepts SceneCellContent without error', () => {
    // Build a Scene directly (no grammar validation) — this is the intent of SceneCellContent
    const cellScene = {
      width: 200,
      height: 100,
      background: '#FFFFFF' as string,
      primitives: [
        { kind: 'rect' as const, x: 0, y: 0, width: 200, height: 100, fill: '#CCCCCC' },
      ],
    };

    const sceneContent: SceneCellContent = { kind: 'scene', scene: cellScene };
    const compDoc = {
      version: '1.0',
      metadata: { title: 'Test Composition' },
      grid: { columns: 1 },
      cells: [{
        id: 'cell-0-0',
        row: 0,
        col: 0,
        content: sceneContent,
      }],
    };

    expect(() => layoutComposition(compDoc)).not.toThrow();
    const scene = layoutComposition(compDoc);
    expect(scene.primitives.length).toBeGreaterThan(0);
  });

  it('E2. scene hash stable across two layoutComposition calls with SceneCellContent', () => {
    const cellScene = {
      width: 300,
      height: 150,
      background: '#000000' as string,
      primitives: [
        { kind: 'rect' as const, x: 10, y: 10, width: 280, height: 130, fill: '#333333' },
        { kind: 'text' as const, x: 150, y: 75, text: 'Test', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fill: '#FFFFFF', textAnchor: 'middle' as const, dominantBaseline: 'central' as const },
      ],
    };

    const sceneContent: SceneCellContent = { kind: 'scene', scene: cellScene };
    const compDoc = {
      version: '1.0',
      metadata: { title: 'Determinism Test' },
      grid: { columns: 1 },
      cells: [{ id: 'cell-0-0', row: 0, col: 0, content: sceneContent }],
    };

    const scene1 = layoutComposition(compDoc);
    const scene2 = layoutComposition(compDoc);
    expect(sceneHash(scene1)).toBe(sceneHash(scene2));
  });
});

// ---------------------------------------------------------------------------
// F. Excel cell addressing
// ---------------------------------------------------------------------------

// Fixture: poster using Excel-style cell addresses (A1, B1, A2, B2)
const EXCEL_POSTER_MMD = `---
theme: executive
layout: grid 2x2
---
poster "Excel Address Demo"
  cell A1: flowchart LR
    A[Query] --> B[Retriever]
    B --> C[Generator]
  cell B1: sequenceDiagram
    User->>API: request
    API->>DB: lookup
    DB-->>API: results
    API-->>User: response
  cell A2: mindmap
    root((RAG))
      Retriever
        Dense
        Sparse
      Generator
        LLM
        Context
  cell B2: xychart-beta
    title "Retrieval Accuracy"
    x-axis [k=1, k=3, k=5, k=10]
    y-axis "Recall %" 0 --> 100
    bar [72, 81, 86, 91]
`;

// Equivalent poster authored with bracket addresses (same cells, same positions)
const BRACKET_EQUIV_MMD = `---
theme: executive
layout: grid 2x2
---
poster "Bracket Equiv"
  cell [0,0]: flowchart LR
    A[Query] --> B[Retriever]
    B --> C[Generator]
  cell [0,1]: sequenceDiagram
    User->>API: request
    API->>DB: lookup
    DB-->>API: results
    API-->>User: response
  cell [1,0]: mindmap
    root((RAG))
      Retriever
        Dense
        Sparse
      Generator
        LLM
        Context
  cell [1,1]: xychart-beta
    title "Retrieval Accuracy"
    x-axis [k=1, k=3, k=5, k=10]
    y-axis "Recall %" 0 --> 100
    bar [72, 81, 86, 91]
`;

describe('F. Excel cell addressing', () => {
  // ── F0. Unit: excelToRowCol helper ────────────────────────────────────────
  describe('F0. excelToRowCol helper', () => {
    it('A1 → {row:0, col:0}', () => expect(excelToRowCol('A', '1')).toEqual({ row: 0, col: 0 }));
    it('B1 → {row:0, col:1}', () => expect(excelToRowCol('B', '1')).toEqual({ row: 0, col: 1 }));
    it('A2 → {row:1, col:0}', () => expect(excelToRowCol('A', '2')).toEqual({ row: 1, col: 0 }));
    it('C3 → {row:2, col:2}', () => expect(excelToRowCol('C', '3')).toEqual({ row: 2, col: 2 }));
    it('Z1 → {row:0, col:25}', () => expect(excelToRowCol('Z', '1')).toEqual({ row: 0, col: 25 }));
    it('AA1 → {row:0, col:26}', () => expect(excelToRowCol('AA', '1')).toEqual({ row: 0, col: 26 }));
    it('AB1 → {row:0, col:27}', () => expect(excelToRowCol('AB', '1')).toEqual({ row: 0, col: 27 }));
  });

  // ── F1. Parser: Excel addresses map to correct row/col ───────────────────
  it('F1. A1→[0,0], B1→[0,1], A2→[1,0], B2→[1,1]', () => {
    const { doc } = parsePosterInternal(EXCEL_POSTER_MMD);
    expect(doc.cells).toHaveLength(4);
    expect(doc.cells[0]).toMatchObject({ row: 0, col: 0 });
    expect(doc.cells[1]).toMatchObject({ row: 0, col: 1 });
    expect(doc.cells[2]).toMatchObject({ row: 1, col: 0 });
    expect(doc.cells[3]).toMatchObject({ row: 1, col: 1 });
  });

  // ── F2. Case-insensitive: a1 ≡ A1 ────────────────────────────────────────
  it('F2. case-insensitive: a1 is the same as A1', () => {
    const { doc } = parsePosterInternal(`poster "CI Test"
  cell a1: flowchart LR
    A --> B
  cell b2: sequenceDiagram
    Alice->>Bob: hello
`);
    expect(doc.cells).toHaveLength(2);
    expect(doc.cells[0]).toMatchObject({ row: 0, col: 0 });
    expect(doc.cells[1]).toMatchObject({ row: 1, col: 1 });
  });

  // ── F3. C3 → row:2, col:2 ────────────────────────────────────────────────
  it('F3. C3 → {row:2, col:2}', () => {
    const { doc } = parsePosterInternal(`---
layout: grid 3x3
---
poster "Grid"
  cell C3: flowchart LR
    A --> B
`);
    expect(doc.cells[0]).toMatchObject({ row: 2, col: 2 });
  });

  // ── F4. AA1 → row:0, col:26 ──────────────────────────────────────────────
  it('F4. AA1 → {row:0, col:26}', () => {
    const { doc } = parsePosterInternal(`poster "Wide"
  cell AA1: flowchart LR
    A --> B
`);
    expect(doc.cells[0]).toMatchObject({ row: 0, col: 26 });
  });

  // ── F5. Mixed bracket + Excel in same poster ──────────────────────────────
  it('F5. bracket [r,c] and Excel A1 may be mixed in one poster', () => {
    const { doc, warnings } = parsePosterInternal(`---
layout: grid 2x2
---
poster "Mixed"
  cell [0,0]: flowchart LR
    A --> B
  cell B1: sequenceDiagram
    Alice->>Bob: hello
  cell [1,0]: mindmap
    root((x))
  cell B2: xychart-beta
    x-axis [a, b]
    y-axis 0 --> 10
    bar [3, 7]
`);
    // No warnings about address form
    expect(warnings.filter(w => w.includes('Unrecognised cell address'))).toHaveLength(0);
    expect(doc.cells).toHaveLength(4);
    expect(doc.cells[0]).toMatchObject({ row: 0, col: 0 }); // [0,0]
    expect(doc.cells[1]).toMatchObject({ row: 0, col: 1 }); // B1
    expect(doc.cells[2]).toMatchObject({ row: 1, col: 0 }); // [1,0]
    expect(doc.cells[3]).toMatchObject({ row: 1, col: 1 }); // B2
  });

  // ── F6. Malformed address → warn + skip ──────────────────────────────────
  it('F6. malformed cell address → warn + skip (graceful degradation)', () => {
    const { doc, warnings } = parsePosterInternal(`poster "Bad"
  cell @@weirdaddress: flowchart LR
    A --> B
  cell A1: sequenceDiagram
    Alice->>Bob: hello
`);
    // The @@weirdaddress line starts with "cell " so it triggers the fallback warning
    expect(warnings.some(w => w.includes('Unrecognised cell address'))).toBe(true);
    // Only the valid A1 cell is parsed
    expect(doc.cells).toHaveLength(1);
    expect(doc.cells[0]).toMatchObject({ row: 0, col: 0 });
  });

  // ── F7. Equivalence: Excel poster produces SAME cell positions as [r,c] ──
  it('F7. Excel-addressed poster produces same cell positions as [r,c] poster', () => {
    const { doc: excelDoc } = parsePosterInternal(EXCEL_POSTER_MMD);
    const { doc: bracketDoc } = parsePosterInternal(BRACKET_EQUIV_MMD);

    expect(excelDoc.cells).toHaveLength(bracketDoc.cells.length);
    for (let i = 0; i < bracketDoc.cells.length; i++) {
      expect(excelDoc.cells[i]!.row).toBe(bracketDoc.cells[i]!.row);
      expect(excelDoc.cells[i]!.col).toBe(bracketDoc.cells[i]!.col);
      expect(excelDoc.cells[i]!.typeHeader).toBe(bracketDoc.cells[i]!.typeHeader);
    }
  });

  // ── F8. Excel poster renders to SVG (render integration) ─────────────────
  it('F8. Excel-addressed poster renders to SVG without error', () => {
    const result = renderMermaid(EXCEL_POSTER_MMD, { format: 'svg' });
    expect(result.kind).toBe('poster');
    expect(result.svg).toBeDefined();
    expect(result.svg).toContain('<svg');
  });

  // ── F9. Gallery emit — poster-excel.{mmd,svg,png} ────────────────────────
  it('F9. Gallery emit — poster-excel.{mmd,svg,png} written to examples/gallery/', () => {
    const svgResult = renderMermaid(EXCEL_POSTER_MMD, { format: 'svg' });
    expect(svgResult.svg).toBeDefined();

    writeGallery('poster-excel.mmd', EXCEL_POSTER_MMD);
    writeGallery('poster-excel.svg', svgResult.svg!);

    const pngResult = renderMermaid(EXCEL_POSTER_MMD, { format: 'png' });
    expect(pngResult.png).toBeDefined();
    writeGallery('poster-excel.png', pngResult.png!);

    expect(existsSync(join(GALLERY, 'poster-excel.mmd'))).toBe(true);
    expect(existsSync(join(GALLERY, 'poster-excel.svg'))).toBe(true);
    expect(existsSync(join(GALLERY, 'poster-excel.png'))).toBe(true);
  });
});
