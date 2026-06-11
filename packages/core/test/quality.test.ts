/**
 * @file test/quality.test.ts — Layout-quality conformance gate.
 *
 * Enumerates every example IR file across all supported layout families and
 * all built-in themes.  For each (file × layout × theme) combination it:
 *
 *   1. Parses the IR with `parseIR`
 *   2. Builds the Scene with `buildScene`
 *   3. Lints the Scene with `lintScene`
 *   4. Asserts zero ERROR-severity issues
 *
 * Warnings are allowed and printed but do not fail the gate.
 *
 * This gate makes regenerating examples auto-fail on superposition, overlap,
 * axis-overwrite, or out-of-bounds.
 *
 * It also includes hand-crafted unit tests that feed deliberately broken Scenes
 * to `lintScene` and confirm the expected issue codes are reported.
 *
 * Gallery emit section: generates examples/gallery/ai-timeline.{svg,png} using
 * even spacing so the committed gallery images are always compact.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseIR } from '../src/load.js';
import { buildScene, renderDocument } from '../src/render/index.js';
import { lintScene } from '../src/lint.js';
import type { QualityIssue } from '../src/lint.js';
import type { Scene } from '../src/scene.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname  = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '..', '..', '..');
const EXAMPLES_ROOT = join(REPO_ROOT, 'examples');

// ---------------------------------------------------------------------------
// Enumerate example files
// ---------------------------------------------------------------------------

function findExamples(): string[] {
  const files: string[] = [];

  // examples/*.timeline.yaml
  for (const f of readdirSync(EXAMPLES_ROOT)) {
    if (f.endsWith('.timeline.yaml')) {
      files.push(join(EXAMPLES_ROOT, f));
    }
  }

  // examples/gallery/*.timeline.yaml
  const galleryDir = join(EXAMPLES_ROOT, 'gallery');
  for (const f of readdirSync(galleryDir)) {
    if (f.endsWith('.timeline.yaml')) {
      files.push(join(galleryDir, f));
    }
  }

  return files.sort();
}

const EXAMPLE_FILES   = findExamples();
const LAYOUTS         = ['horizontal', 'vertical-spine'] as const;
const THEMES          = ['consulting', 'product', 'minimal', 'executive', 'release'] as const;

// ---------------------------------------------------------------------------
// Conformance gate
// ---------------------------------------------------------------------------

/**
 * Format a list of QualityIssue objects for a readable test failure message.
 */
function formatIssues(issues: QualityIssue[]): string {
  return issues
    .map((q) => {
      const loc = q.where
        ? ` @ [${q.where.map((p) => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(', ')}]`
        : '';
      return `  ${q.severity.toUpperCase()} ${q.code}: ${q.message}${loc}`;
    })
    .join('\n');
}

describe('Layout-quality conformance gate', () => {
  const combinations = EXAMPLE_FILES.flatMap((file) =>
    LAYOUTS.flatMap((layout) =>
      THEMES.map((theme) => ({ file, layout, theme })),
    ),
  );

  // Log total coverage
  it(`covers ${combinations.length} (file × layout × theme) combinations`, () => {
    expect(combinations.length).toBeGreaterThan(0);
    // Expected: 13 files × 2 layouts × 5 themes = 130 combinations
  });

  for (const { file, layout, theme } of combinations) {
    const label = `${file.replace(REPO_ROOT + '/', '')} / ${layout} / ${theme}`;

    it(`zero ERROR issues: ${label}`, () => {
      const text = readFileSync(file, 'utf-8');
      const ir   = parseIR(text);
      const scene = buildScene(ir, { theme, layout });
      const issues = lintScene(scene);

      const errors   = issues.filter((q) => q.severity === 'error');
      const warnings = issues.filter((q) => q.severity === 'warning');

      if (warnings.length > 0) {
        // Warnings are allowed — print them for visibility but don't fail
        console.info(`[WARN] ${label}\n${formatIssues(warnings)}`);
      }

      if (errors.length > 0) {
        throw new Error(
          `Layout quality errors in ${label}:\n${formatIssues(errors)}`,
        );
      }

      expect(errors).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Unit tests: deliberately broken Scenes
// ---------------------------------------------------------------------------

describe('lintScene — deliberate overlap unit tests', () => {
  /**
   * Build a minimal valid Scene with the given primitives.
   */
  function makeScene(overrides: Partial<Scene> = {}): Scene {
    return {
      width:      400,
      height:     300,
      background: '#ffffff',
      primitives: [],
      ...overrides,
    };
  }

  it('detects LABEL_OVERLAP for two overlapping text labels from different entries', () => {
    const scene = makeScene({
      primitives: [
        {
          kind:             'text',
          x:                 50,
          y:                 100,
          text:              'First label long enough',
          fontSize:          12,
          fontFamily:        'DejaVu Sans',
          fontWeight:        400,
          fill:              '#000',
          textAnchor:        'start',
          dominantBaseline:  'alphabetic',
        },
        {
          kind:             'text',
          // Different x anchor (different group) but bbox overlaps first label
          x:                 100,
          y:                 103,
          text:              'Overlapping text here',
          fontSize:          12,
          fontFamily:        'DejaVu Sans',
          fontWeight:        400,
          fill:              '#000',
          textAnchor:        'start',
          dominantBaseline:  'alphabetic',
        },
      ],
    });

    const issues = lintScene(scene);
    const overlaps = issues.filter((q) => q.code === 'LABEL_OVERLAP' && q.severity === 'error');
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it('does NOT flag co-located labels (same label block: title + date stacked vertically)', () => {
    const scene = makeScene({
      primitives: [
        {
          kind: 'text', x: 200, y: 100,
          text: 'Milestone Title', fontSize: 11,
          fontFamily: 'DejaVu Sans', fontWeight: 600, fill: '#000',
          textAnchor: 'middle', dominantBaseline: 'alphabetic',
        },
        {
          kind: 'text', x: 200, y: 116,
          text: 'Jan 2024', fontSize: 9,
          fontFamily: 'DejaVu Sans', fontWeight: 400, fill: '#555',
          textAnchor: 'middle', dominantBaseline: 'alphabetic',
        },
      ],
    });

    const issues = lintScene(scene);
    const overlaps = issues.filter((q) => q.code === 'LABEL_OVERLAP' && q.severity === 'error');
    // Same x anchor (200) → same group → no LABEL_OVERLAP despite vertical proximity
    expect(overlaps).toHaveLength(0);
  });

  it('detects NODE_OVERLAP for two milestone circles that overlap', () => {
    const scene = makeScene({
      primitives: [
        { kind: 'circle', cx: 100, cy: 100, r: 12, fill: '#1F497D', stroke: '#fff', strokeWidth: 2 },
        { kind: 'circle', cx: 116, cy: 100, r: 12, fill: '#1F497D', stroke: '#fff', strokeWidth: 2 },
      ],
    });

    const issues = lintScene(scene);
    const overlaps = issues.filter((q) => q.code === 'NODE_OVERLAP' && q.severity === 'error');
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it('does NOT flag well-separated node circles', () => {
    const scene = makeScene({
      primitives: [
        { kind: 'circle', cx: 100, cy: 100, r: 12, fill: '#1F497D', stroke: '#fff', strokeWidth: 2 },
        { kind: 'circle', cx: 160, cy: 100, r: 12, fill: '#1F497D', stroke: '#fff', strokeWidth: 2 },
      ],
    });

    const issues = lintScene(scene);
    const overlaps = issues.filter((q) => q.code === 'NODE_OVERLAP');
    expect(overlaps).toHaveLength(0);
  });

  it('detects OUT_OF_BOUNDS for a text label that extends left of the canvas', () => {
    const scene = makeScene({
      primitives: [
        {
          kind: 'text', x: 5, y: 50,
          text: 'A very wide text label that overflows the left canvas edge significantly',
          fontSize: 14, fontFamily: 'DejaVu Sans', fontWeight: 400, fill: '#000',
          // textAnchor: 'end' — right-aligns to x:5, so bbox extends far left into negative territory
          textAnchor: 'end', dominantBaseline: 'alphabetic',
        },
      ],
    });

    const issues = lintScene(scene);
    const oob = issues.filter((q) => q.code === 'OUT_OF_BOUNDS' && q.severity === 'error');
    expect(oob.length).toBeGreaterThan(0);
  });

  it('detects OUT_OF_BOUNDS for a rectangle that extends below the canvas', () => {
    const scene = makeScene({
      primitives: [
        { kind: 'rect', x: 10, y: 290, width: 100, height: 30, fill: '#ccc' },
      ],
    });

    const issues = lintScene(scene);
    const oob = issues.filter((q) => q.code === 'OUT_OF_BOUNDS' && q.severity === 'error');
    expect(oob.length).toBeGreaterThan(0);
  });

  it('detects LABEL_AXIS_OVERLAP when a label creeps up into the horizontal axis band', () => {
    // Scene simulating an axis line + a label that sits above the axis, overwriting tick labels
    const canvasW = 800;
    const axisY   = 100; // axis line at y=100
    const scene = makeScene({
      width:  canvasW,
      height: 500,
      primitives: [
        // Horizontal axis line spanning the canvas (detectable as "the axis")
        {
          kind: 'line', x1: 100, y1: axisY, x2: canvasW - 40, y2: axisY,
          stroke: '#333', strokeWidth: 1,
        },
        // A label BELOW the axis (anchorY > axisY) whose bbox top creeps up into tick-label band
        {
          kind: 'text',
          // anchorY = axisY + 8 (just below axis, but bbox top = 8 - 9.6 = -1.6 relative = axisY - 1.6)
          x: 300, y: axisY + 8,
          text: 'Crowded label',
          fontSize: 12, fontFamily: 'DejaVu Sans', fontWeight: 400, fill: '#000',
          textAnchor: 'start', dominantBaseline: 'alphabetic',
        },
      ],
    });

    const issues = lintScene(scene);
    const axisIssues = issues.filter((q) => q.code === 'LABEL_AXIS_OVERLAP' && q.severity === 'error');
    expect(axisIssues.length).toBeGreaterThan(0);
  });

  it('reports TIGHT_SPACING warning for nearly-touching labels', () => {
    const scene = makeScene({
      primitives: [
        {
          kind: 'text', x: 50, y: 100,
          text: 'Label A', fontSize: 11,
          fontFamily: 'DejaVu Sans', fontWeight: 400, fill: '#000',
          textAnchor: 'start', dominantBaseline: 'alphabetic',
        },
        {
          kind: 'text',
          // 'Label A' width ≈ L+a+b+e+l+' '+A ≈ 3.57em × 11px ≈ 39px → right edge ≈ 89.
          // Place the second label at x:92 — gap ≈ 3px (< TIGHT_GAP=5).
          x: 92, y: 100,
          text: 'Label B', fontSize: 11,
          fontFamily: 'DejaVu Sans', fontWeight: 400, fill: '#000',
          textAnchor: 'start', dominantBaseline: 'alphabetic',
        },
      ],
    });

    const issues = lintScene(scene);
    const tight = issues.filter((q) => q.code === 'TIGHT_SPACING' && q.severity === 'warning');
    expect(tight.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Gallery emit — ai-timeline.svg / ai-timeline.png
//
// Regenerates the two canonical gallery images for the ai-timeline fixture
// using even spacing (spineSpacing: 'even') so the committed gallery files
// are always compact regardless of theme choice.
// ---------------------------------------------------------------------------

describe('Gallery emit — ai-timeline SVG + PNG', () => {
  const GALLERY_DIR    = join(REPO_ROOT, 'examples', 'gallery');
  const AI_FIXTURE     = join(GALLERY_DIR, 'ai-timeline.timeline.yaml');
  const OUT_SVG        = join(GALLERY_DIR, 'ai-timeline.svg');
  const OUT_PNG        = join(GALLERY_DIR, 'ai-timeline.png');

  it('emits a compact ai-timeline.svg (consulting theme, even spacing)', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const text = readFileSync(AI_FIXTURE, 'utf-8');
    const ir   = parseIR(text);
    const result = renderDocument(ir, {
      format: 'svg',
      theme: 'consulting',
      layout: 'vertical-spine',
      spineSpacing: 'even',
    });
    const svg = result.svg!;
    expect(svg).toContain('<svg');
    writeFileSync(OUT_SVG, svg, 'utf-8');
    console.log('[gallery-emit] ai-timeline.svg written →', OUT_SVG);
  });

  it('emits a compact ai-timeline.png (consulting theme, even spacing)', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });
    const text = readFileSync(AI_FIXTURE, 'utf-8');
    const ir   = parseIR(text);
    const result = renderDocument(ir, {
      format: 'png',
      theme: 'consulting',
      layout: 'vertical-spine',
      spineSpacing: 'even',
    });
    const png = result.png!;
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png[0]).toBe(0x89); // PNG signature
    writeFileSync(OUT_PNG, png);
    console.log('[gallery-emit] ai-timeline.png written →', OUT_PNG);
  });
});
