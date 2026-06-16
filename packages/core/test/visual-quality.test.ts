/**
 * @file test/visual-quality.test.ts — Post-render geometry-quality gate.
 *
 * Every test that EMITS a poster or diagram via the render pipeline also
 * re-verifies the committed overlay geometry with the pure geometry kernel.
 * A poster with an edge that stabs through a non-endpoint node box, a label
 * sitting on top of an unrelated node, or any element clipped by the canvas
 * FAILS this gate.
 *
 * Coverage:
 *
 *   A. Acid tests — kernel trustworthiness (synthetic bad geometry)
 *      A1. edgeThroughNode: kernel flags an edge that clearly passes through
 *          a non-endpoint node box.
 *      A2. labelOverNode: kernel flags a label box overlapping a non-owner node.
 *      A3. clean geometry: kernel reports CLEAN when nothing overlaps.
 *
 *   B. Gallery poster gate
 *      B1. poster-crosslink.mmd — 2×1 grid, two cross-cell links
 *      B2. poster-trace.mmd     — 2×2 grid, two multi-hop traces
 *
 *   C. Design-figure poster gate
 *      C1. link-poster.mmd      — 3×1 grid, three link types
 *      C2. crosslink-poster.mmd — 2×2 merged, two traces
 *      C3. trace-poster.mmd     — 2×2 merged, two traces (same as gallery trace)
 *
 *   D. Defect-report helper
 *      D1. printDefectReport — prints a formatted report for a named poster
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { renderMermaid } from '../src/frontend/mermaid/index.js';
import {
  detectDefects,
  formatDefectReport,
  edgeThroughNode,
  labelOverNode,
} from '../src/geometry/index.js';
import type { LabeledGeometry, BoxWithId } from '../src/geometry/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT   = join(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');
const FIGURES_DIR = join(REPO_ROOT, 'design', 'figures', 'src');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render a poster .mmd source, extract the overlay `qualityGeometry`, and
 * return a formatted report string.  Throws if the poster produced no
 * qualityGeometry (i.e. had no overlay links at all — that is a test-setup
 * error, not a quality error).
 */
function renderAndReport(src: string, label: string): { geo: LabeledGeometry; report: string } {
  const result = renderMermaid(src, { format: 'svg' });
  if (!result.qualityGeometry) {
    throw new Error(
      `visual-quality: "${label}" produced no qualityGeometry — does it have any overlay links?`,
    );
  }
  const report = formatDefectReport(result.qualityGeometry, label);
  return { geo: result.qualityGeometry, report };
}

function readPoster(path: string): string {
  return readFileSync(path, 'utf-8');
}

// ---------------------------------------------------------------------------
// A. Acid tests — kernel trustworthiness
// ---------------------------------------------------------------------------

describe('A. Kernel acid tests (synthetic geometry)', () => {

  it('A1: edgeThroughNode — kernel flags edge that stabs a non-endpoint node', () => {
    //   nodeA (0,40,80,40)          nodeC (90,40,80,40)          nodeB (200,40,80,40)
    //   [A]                         [C]  ←— edge from A to B passes through C
    //        ──────────────────────────────────────────────────────
    const nodeA: BoxWithId = { id: 'A', x: 0,   y: 40, w: 80, h: 40 };
    const nodeB: BoxWithId = { id: 'B', x: 200, y: 40, w: 80, h: 40 };
    const nodeC: BoxWithId = { id: 'C', x: 90,  y: 40, w: 80, h: 40 }; // squarely in between

    const geo: LabeledGeometry = {
      nodes: [nodeA, nodeB, nodeC],
      labels: [],
      edges: [
        {
          id: 'A->B',
          fromId: 'A',
          toId: 'B',
          segments: [
            { x1: nodeA.x + nodeA.w, y1: 60, x2: nodeB.x, y2: 60 }, // straight through C
          ],
        },
      ],
      canvas: { x: 0, y: 0, w: 400, h: 120 },
    };

    const defects = edgeThroughNode(geo);
    expect(defects.length).toBeGreaterThan(0);
    expect(defects[0]!.kind).toBe('edgeThroughNode');
    expect(defects[0]!.objectId).toBe('C');
    console.log('[acid-A1]', formatDefectReport(geo, 'synthetic-through-node'));
  });

  it('A2: labelOverNode — kernel flags a label overlapping a non-owner node', () => {
    const node: BoxWithId = { id: 'node1', x: 100, y: 50, w: 80, h: 40 };
    const label: BoxWithId = { id: 'edge1:label', x: 110, y: 55, w: 60, h: 20 }; // inside node1

    const geo: LabeledGeometry = {
      nodes: [node],
      labels: [label],
      edges: [],
      canvas: { x: 0, y: 0, w: 400, h: 200 },
    };

    const defects = labelOverNode(geo);
    expect(defects.length).toBeGreaterThan(0);
    expect(defects[0]!.kind).toBe('labelOverNode');
    expect(defects[0]!.objectId).toBe('node1');
    console.log('[acid-A2]', formatDefectReport(geo, 'synthetic-label-over-node'));
  });

  it('A3: clean geometry — kernel reports CLEAN when nothing overlaps', () => {
    const geo: LabeledGeometry = {
      nodes: [
        { id: 'A', x: 0,   y: 50, w: 80, h: 40 },
        { id: 'B', x: 200, y: 50, w: 80, h: 40 },
      ],
      labels: [
        { id: 'edge0:label', x: 120, y: 55, w: 60, h: 20 }, // midpoint, gap between A and B
      ],
      edges: [
        {
          id: 'edge0',
          fromId: 'A',
          toId: 'B',
          segments: [
            { x1: 80, y1: 70, x2: 120, y2: 70 }, // A right→label left
            { x1: 120, y1: 70, x2: 200, y2: 70 }, // label right→B left
          ],
        },
      ],
      canvas: { x: 0, y: 0, w: 400, h: 200 },
    };

    const report = detectDefects(geo);
    expect(report.clean).toBe(true);
    console.log('[acid-A3]', formatDefectReport(geo, 'synthetic-clean'));
  });

});

// ---------------------------------------------------------------------------
// B. Gallery poster gate
// ---------------------------------------------------------------------------

describe('B. Gallery poster gate', () => {

  it('B1: poster-crosslink.mmd — overlay is defect-free', () => {
    const src = readPoster(join(GALLERY_DIR, 'poster-crosslink.mmd'));
    const { geo, report } = renderAndReport(src, 'poster-crosslink');
    console.log('[B1]', report);
    const result = detectDefects(geo);
    expect(result.clean).toBe(true);
    expect(result.counts.edgeThroughNode).toBe(0);
    expect(result.counts.labelOverNode).toBe(0);
  });

  it('B2: poster-trace.mmd — overlay is defect-free', () => {
    const src = readPoster(join(GALLERY_DIR, 'poster-trace.mmd'));
    const { geo, report } = renderAndReport(src, 'poster-trace');
    console.log('[B2]', report);
    const result = detectDefects(geo);
    expect(result.clean).toBe(true);
    expect(result.counts.edgeThroughNode).toBe(0);
    expect(result.counts.labelOverNode).toBe(0);
  });

});

// ---------------------------------------------------------------------------
// C. Design-figure poster gate
// ---------------------------------------------------------------------------

describe('C. Design-figure poster gate', () => {

  it('C1: link-poster.mmd — overlay is defect-free', () => {
    const src = readPoster(join(FIGURES_DIR, 'link-poster.mmd'));
    const { geo, report } = renderAndReport(src, 'link-poster');
    console.log('[C1]', report);
    const result = detectDefects(geo);
    expect(result.clean).toBe(true);
    expect(result.counts.edgeThroughNode).toBe(0);
    expect(result.counts.labelOverNode).toBe(0);
  });

  it('C2: crosslink-poster.mmd — overlay is defect-free', () => {
    const src = readPoster(join(FIGURES_DIR, 'crosslink-poster.mmd'));
    const { geo, report } = renderAndReport(src, 'crosslink-poster');
    console.log('[C2]', report);
    const result = detectDefects(geo);
    expect(result.clean).toBe(true);
    expect(result.counts.edgeThroughNode).toBe(0);
    expect(result.counts.labelOverNode).toBe(0);
  });

  it('C3: trace-poster.mmd — overlay is defect-free', () => {
    const src = readPoster(join(FIGURES_DIR, 'trace-poster.mmd'));
    const { geo, report } = renderAndReport(src, 'trace-poster');
    console.log('[C3]', report);
    const result = detectDefects(geo);
    expect(result.clean).toBe(true);
    expect(result.counts.edgeThroughNode).toBe(0);
    expect(result.counts.labelOverNode).toBe(0);
  });

});

// ---------------------------------------------------------------------------
// D. Defect-report helper — human-readable report for any named poster
// ---------------------------------------------------------------------------

describe('D. Defect-report helper', () => {

  it('D1: printDefectReport — prints geometry report for each poster', () => {
    const posters = [
      { name: 'poster-crosslink', path: join(GALLERY_DIR, 'poster-crosslink.mmd') },
      { name: 'poster-trace',     path: join(GALLERY_DIR, 'poster-trace.mmd')     },
      { name: 'link-poster',      path: join(FIGURES_DIR, 'link-poster.mmd')      },
      { name: 'crosslink-poster', path: join(FIGURES_DIR, 'crosslink-poster.mmd') },
      { name: 'trace-poster',     path: join(FIGURES_DIR, 'trace-poster.mmd')     },
    ];

    const reports: string[] = [];
    for (const p of posters) {
      const src = readPoster(p.path);
      const result = renderMermaid(src, { format: 'svg' });
      if (result.qualityGeometry) {
        reports.push(formatDefectReport(result.qualityGeometry, p.name));
      } else {
        reports.push(`── ${p.name} — no qualityGeometry (no overlay links) ──`);
      }
    }

    console.log('\n=== GEOMETRY DEFECT REPORT (all posters) ===');
    for (const r of reports) console.log(r);
    console.log('=== END REPORT ===\n');

    // D1 itself just asserts the helper runs without error.
    expect(reports).toHaveLength(posters.length);
  });

});
