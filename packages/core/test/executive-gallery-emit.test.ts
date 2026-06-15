/**
 * @file test/executive-gallery-emit.test.ts — Executive theme gallery emit.
 *
 * Renders the existing gallery source files under the `executive` contract
 * theme and writes NEW files (executive-*.svg/png). Existing goldens are
 * NOT touched — this test only writes new files.
 *
 * Files produced:
 *   examples/gallery/executive-flowchart.svg/.png
 *   examples/gallery/executive-sequence.svg/.png
 *   examples/gallery/executive-xychart.svg/.png
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { renderMermaid } from '../src/frontend/mermaid/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');

function readMmd(name: string): string {
  return readFileSync(join(GALLERY, name), 'utf-8');
}

function writeGallery(name: string, content: string | Buffer): void {
  if (!existsSync(GALLERY)) mkdirSync(GALLERY, { recursive: true });
  writeFileSync(join(GALLERY, name), content);
}

// Strip the frontmatter theme from a mmd string and inject `executive` via options.
// (We override via renderMermaid options.theme — safer than editing source.)

describe('Executive gallery — emit (executive theme, NEW files only)', () => {
  // ── flowchart ─────────────────────────────────────────────────────────

  it('emits executive-flowchart.svg', () => {
    const src = readMmd('mermaid-flowchart.mmd');
    const result = renderMermaid(src, { theme: 'executive', format: 'svg' });
    expect(result.svg).toBeTruthy();
    expect(result.svg!).toContain('<svg');
    writeGallery('executive-flowchart.svg', result.svg!);
    console.log('[executive] executive-flowchart.svg written.');
  });

  it('emits executive-flowchart.png', () => {
    const src = readMmd('mermaid-flowchart.mmd');
    const result = renderMermaid(src, { theme: 'executive', format: 'png' });
    expect(result.png).toBeTruthy();
    expect(result.png![0]).toBe(0x89); // PNG magic byte
    writeGallery('executive-flowchart.png', result.png!);
    console.log('[executive] executive-flowchart.png written.');
  });

  it('executive-flowchart renders are deterministic', () => {
    const src = readMmd('mermaid-flowchart.mmd');
    const a = renderMermaid(src, { theme: 'executive', format: 'svg' });
    const b = renderMermaid(src, { theme: 'executive', format: 'svg' });
    expect(a.sceneHash).toBe(b.sceneHash);
    expect(a.svg).toBe(b.svg);
  });

  // ── sequence ──────────────────────────────────────────────────────────

  it('emits executive-sequence.svg', () => {
    const src = readMmd('mermaid-sequence.mmd');
    // Override theme via options (source has bytebytego-sequence in frontmatter).
    const result = renderMermaid(src, { theme: 'executive', format: 'svg' });
    expect(result.svg).toBeTruthy();
    expect(result.svg!).toContain('<svg');
    writeGallery('executive-sequence.svg', result.svg!);
    console.log('[executive] executive-sequence.svg written.');
  });

  it('emits executive-sequence.png', () => {
    const src = readMmd('mermaid-sequence.mmd');
    const result = renderMermaid(src, { theme: 'executive', format: 'png' });
    expect(result.png).toBeTruthy();
    expect(result.png![0]).toBe(0x89);
    writeGallery('executive-sequence.png', result.png!);
    console.log('[executive] executive-sequence.png written.');
  });

  it('executive-sequence renders are deterministic', () => {
    const src = readMmd('mermaid-sequence.mmd');
    const a = renderMermaid(src, { theme: 'executive', format: 'svg' });
    const b = renderMermaid(src, { theme: 'executive', format: 'svg' });
    expect(a.sceneHash).toBe(b.sceneHash);
    expect(a.svg).toBe(b.svg);
  });

  // ── xychart ───────────────────────────────────────────────────────────

  it('emits executive-xychart.svg', () => {
    const src = readMmd('mermaid-xychart.mmd');
    const result = renderMermaid(src, { theme: 'executive', format: 'svg' });
    expect(result.svg).toBeTruthy();
    expect(result.svg!).toContain('<svg');
    writeGallery('executive-xychart.svg', result.svg!);
    console.log('[executive] executive-xychart.svg written.');
  });

  it('emits executive-xychart.png', () => {
    const src = readMmd('mermaid-xychart.mmd');
    const result = renderMermaid(src, { theme: 'executive', format: 'png' });
    expect(result.png).toBeTruthy();
    expect(result.png![0]).toBe(0x89);
    writeGallery('executive-xychart.png', result.png!);
    console.log('[executive] executive-xychart.png written.');
  });

  it('executive-xychart renders are deterministic', () => {
    const src = readMmd('mermaid-xychart.mmd');
    const a = renderMermaid(src, { theme: 'executive', format: 'svg' });
    const b = renderMermaid(src, { theme: 'executive', format: 'svg' });
    expect(a.sceneHash).toBe(b.sceneHash);
    expect(a.svg).toBe(b.svg);
  });

  // ── Coherence meta-test ────────────────────────────────────────────────

  it('all three executive SVGs share the same background color', () => {
    const flowSvg  = readFileSync(join(GALLERY, 'executive-flowchart.svg'), 'utf-8');
    const seqSvg   = readFileSync(join(GALLERY, 'executive-sequence.svg'), 'utf-8');
    const chartSvg = readFileSync(join(GALLERY, 'executive-xychart.svg'), 'utf-8');

    // Background rect fill must be the contract surface color #ffffff
    expect(flowSvg.toLowerCase()).toContain('#ffffff');
    expect(seqSvg.toLowerCase()).toContain('#ffffff');
    expect(chartSvg.toLowerCase()).toContain('#ffffff');
  });

  it('all three executive SVGs use the contract accent color #1f497d', () => {
    const flowSvg  = readFileSync(join(GALLERY, 'executive-flowchart.svg'), 'utf-8');
    const seqSvg   = readFileSync(join(GALLERY, 'executive-sequence.svg'), 'utf-8');
    const chartSvg = readFileSync(join(GALLERY, 'executive-xychart.svg'), 'utf-8');

    expect(flowSvg.toLowerCase()).toContain('#1f497d');
    expect(seqSvg.toLowerCase()).toContain('#1f497d');
    expect(chartSvg.toLowerCase()).toContain('#1f497d');
  });
});
