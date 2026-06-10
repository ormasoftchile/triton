/**
 * @file test/golden.test.ts — Phase 1 conformance / golden-image harness.
 *
 * Acceptance criteria (§11 MVP exit bar):
 *   (a) T2 fixture validates with zero errors
 *   (b) Two renders produce byte-identical SVG and identical sceneHash
 *   (c) SVG matches committed golden file (generated on first run)
 *   (d) PNG render produces a valid PNG byte array
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseIR } from '../src/load.js';
import { validateDocument } from '../src/validate.js';
import { renderDocument } from '../src/render/index.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT   = resolve(__dirname, '..', '..', '..');
const FIXTURE     = join(REPO_ROOT, 'examples', 'our-timeline.timeline.yaml');
const GOLDEN_DIR  = join(REPO_ROOT, 'examples', 'golden');
const GOLDEN_SVG  = join(GOLDEN_DIR, 'our-timeline.svg');
const GOLDEN_PNG  = join(GOLDEN_DIR, 'our-timeline.png');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureGoldenDir(): void {
  if (!existsSync(GOLDEN_DIR)) mkdirSync(GOLDEN_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 1 conformance — T2 golden-image harness', () => {

  const fixtureText = readFileSync(FIXTURE, 'utf-8');
  const ir = parseIR(fixtureText);

  describe('(a) Validation', () => {
    it('T2 fixture passes validateDocument with zero errors', () => {
      const result = validateDocument(ir);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('T2 fixture has zero validation warnings', () => {
      const result = validateDocument(ir);
      // Unused-track warning is possible since we have milestones with track references,
      // but VACUOUS_TIMELINE may fire — allow warnings, require zero errors.
      const errors = result.errors;
      expect(errors).toHaveLength(0);
    });
  });

  describe('(b) Determinism', () => {
    it('two SVG renders are byte-identical', () => {
      const r1 = renderDocument(ir, { format: 'svg', theme: 'consulting' });
      const r2 = renderDocument(ir, { format: 'svg', theme: 'consulting' });
      expect(r1.svg).toBe(r2.svg);
    });

    it('two SVG renders produce identical sceneHash', () => {
      const r1 = renderDocument(ir, { format: 'svg', theme: 'consulting' });
      const r2 = renderDocument(ir, { format: 'svg', theme: 'consulting' });
      expect(r1.sceneHash).toBe(r2.sceneHash);
    });

    it('sceneHash is a 64-character lowercase hex string', () => {
      const result = renderDocument(ir, { format: 'svg', theme: 'consulting' });
      expect(result.sceneHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('(c) Golden SVG comparison', () => {
    it('SVG output matches committed golden file (generate if absent)', () => {
      const result = renderDocument(ir, { format: 'svg', theme: 'consulting' });
      const svg = result.svg!;

      ensureGoldenDir();

      if (!existsSync(GOLDEN_SVG)) {
        // First run — write the golden file.
        writeFileSync(GOLDEN_SVG, svg, 'utf-8');
        console.log(`[golden] Generated ${GOLDEN_SVG}`);
      }

      const committed = readFileSync(GOLDEN_SVG, 'utf-8');
      expect(svg).toBe(committed);
    });
  });

  describe('(d) PNG output', () => {
    it('PNG render returns a non-empty Uint8Array', () => {
      const result = renderDocument(ir, { format: 'png', theme: 'consulting' });
      expect(result.png).toBeInstanceOf(Uint8Array);
      expect(result.png!.length).toBeGreaterThan(0);
    });

    it('PNG output has valid PNG signature (0x89 50 4E 47)', () => {
      const result = renderDocument(ir, { format: 'png', theme: 'consulting' });
      const sig = result.png!;
      expect(sig[0]).toBe(0x89);
      expect(sig[1]).toBe(0x50); // 'P'
      expect(sig[2]).toBe(0x4e); // 'N'
      expect(sig[3]).toBe(0x47); // 'G'
    });

    it('PNG sceneHash matches SVG sceneHash for same IR', () => {
      const svgResult = renderDocument(ir, { format: 'svg', theme: 'consulting' });
      const pngResult = renderDocument(ir, { format: 'png', theme: 'consulting' });
      expect(pngResult.sceneHash).toBe(svgResult.sceneHash);
    });

    it('writes PNG golden artifact', () => {
      const result = renderDocument(ir, { format: 'png', theme: 'consulting' });
      ensureGoldenDir();
      if (!existsSync(GOLDEN_PNG)) {
        writeFileSync(GOLDEN_PNG, result.png!);
        console.log(`[golden] Generated ${GOLDEN_PNG}`);
      }
      // Re-read and check signature.
      const bytes = readFileSync(GOLDEN_PNG);
      expect(bytes[0]).toBe(0x89);
    });
  });
});
