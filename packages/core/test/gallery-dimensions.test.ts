/**
 * @file test/gallery-dimensions.test.ts — Gallery SVG dimension guard.
 *
 * Scans EVERY rendered SVG under examples/gallery/ (recursively) and asserts
 * sane bounds so pathological renders can never silently ship.
 *
 * Thresholds (chosen to pass all legitimate renders, fail pathological ones):
 *   HEIGHT_MAX   5000 px  — above tallest legitimate vertical/ golden (2280 px),
 *                            well below the pathological config-layout that prompted
 *                            this guard (7357 px before the fix).
 *   HW_RATIO_MAX 4.0      — height/width ratio; above tallest legitimate class
 *                            diagram (pastel-class: H/W ≈ 1.92), below pathological
 *                            vertical-spine over a 46-year span (H/W ≈ 6.1).
 *
 * Wide diagrams (LR flowcharts with W/H up to 8×) are legitimately wide and are
 * NOT guarded here — the concern is pathological HEIGHT, not width.
 *
 * Added: 2026-06-15 (Barbara, Semantics & Rendering) — closes systemic detection
 * gap for vertical-spine height explosion over long time spans.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Maximum acceptable SVG height in logical pixels. */
const HEIGHT_MAX = 5000;

/**
 * Maximum acceptable height-to-width ratio.
 * Catches pathological tall renders; does not flag legitimately wide diagrams.
 */
const HW_RATIO_MAX = 4.0;

// ---------------------------------------------------------------------------
// SVG viewBox parser
// ---------------------------------------------------------------------------

interface SvgDims {
  width: number;
  height: number;
}

/**
 * Parse the viewBox attribute of an SVG file.
 * Returns null if no viewBox is found (e.g. non-diagram SVGs like icons).
 */
function parseSvgDims(filePath: string): SvgDims | null {
  const content = readFileSync(filePath, 'utf-8').slice(0, 4096);
  const m = /viewBox=["']\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)["']/.exec(content);
  if (!m) return null;
  return { width: parseFloat(m[3]!), height: parseFloat(m[4]!) };
}

// ---------------------------------------------------------------------------
// Gallery SVG walker
// ---------------------------------------------------------------------------

function walkSvgs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkSvgs(full));
    } else if (entry.endsWith('.svg')) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gallery SVG dimension guard', () => {
  const svgFiles = walkSvgs(GALLERY);

  it('finds at least one SVG in examples/gallery/', () => {
    expect(svgFiles.length).toBeGreaterThan(0);
  });

  for (const filePath of svgFiles) {
    const relName = relative(GALLERY, filePath);

    it(`${relName} — height ≤ ${HEIGHT_MAX}px and H/W ≤ ${HW_RATIO_MAX}`, () => {
      const dims = parseSvgDims(filePath);
      if (!dims) {
        // SVG has no viewBox (e.g. brand-logo icon) — skip dimension check.
        return;
      }

      const { width, height } = dims;
      const hwRatio = height / width;

      expect(
        height,
        `${relName}: height ${height}px exceeds ${HEIGHT_MAX}px cap. ` +
        `This SVG is pathologically tall. ` +
        `For vertical-spine over long time spans, use spineSpacing:'even' ` +
        `or switch to layout:'timeline-columns'.`,
      ).toBeLessThanOrEqual(HEIGHT_MAX);

      expect(
        hwRatio,
        `${relName}: H/W ratio ${hwRatio.toFixed(2)} exceeds ${HW_RATIO_MAX} cap ` +
        `(${height}×${width}px). ` +
        `This SVG is pathologically tall relative to its width. ` +
        `For vertical-spine over long time spans, use spineSpacing:'even' ` +
        `or switch to layout:'timeline-columns'.`,
      ).toBeLessThanOrEqual(HW_RATIO_MAX);
    });
  }
});
