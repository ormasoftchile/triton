/**
 * @file test/terminal-pastel-mono-gallery.test.ts — Gallery emit for terminal, pastel, mono.
 *
 * Renders the same 6 diverse representative components under each of the 3
 * new contract themes and writes gallery files:
 *   examples/gallery/<theme>-<component>.{svg,png}
 *
 * 6 components chosen for maximum diagram-family diversity:
 *   flowchart    — node-link (flow family)
 *   class        — node-link (structural / UML)
 *   xychart      — chart family
 *   sankey       — chart family (flow/energy)
 *   gitgraph     — specialised
 *   timeline     — specialised (the IR diagram family)
 *
 * 3 themes × 6 components × 2 formats = 36 new gallery files.
 * ZERO existing gallery files are touched.
 *
 * Matrix promise verified: all 3 themes are registered in CONTRACT_THEMES;
 * the existing contract-theme-matrix.test.ts automatically covers them
 * across all 21 component types. This file handles only gallery emit.
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

// ── Theme × component matrix ──────────────────────────────────────────────────

const THEMES = ['terminal', 'pastel', 'mono'] as const;

/** The 6 representative components — same order for all themes (comparability). */
const COMPONENTS = [
  { slug: 'flowchart', src: 'mermaid-flowchart.mmd' },
  { slug: 'class',     src: 'mermaid-class.mmd'     },
  { slug: 'xychart',   src: 'mermaid-xychart.mmd'   },
  { slug: 'sankey',    src: 'mermaid-sankey.mmd'     },
  { slug: 'gitgraph',  src: 'mermaid-gitgraph.mmd'   },
  { slug: 'timeline',  src: 'mermaid-timeline.mmd'   },
] as const;

// ── Surface color per theme (for coherence assertions) ──────────────────────

const SURFACE: Record<string, string> = {
  terminal: '#0c0c0c',
  pastel:   '#fff8f6',
  mono:     '#ffffff',
};

const ACCENT: Record<string, string> = {
  terminal: '#33ff00',
  pastel:   '#8b7ed8',
  mono:     '#595959',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const theme of THEMES) {
  describe(`Theme: ${theme} — gallery emit (6 components)`, () => {
    for (const { slug, src } of COMPONENTS) {
      const base = `${theme}-${slug}`;

      it(`emits ${base}.svg`, () => {
        const mmd = readMmd(src);
        const result = renderMermaid(mmd, { theme, format: 'svg' });
        expect(result.svg).toBeTruthy();
        expect(result.svg!).toContain('<svg');
        writeGallery(`${base}.svg`, result.svg!);
        console.log(`[${theme}] ${base}.svg written.`);
      });

      it(`emits ${base}.png`, () => {
        const mmd = readMmd(src);
        const result = renderMermaid(mmd, { theme, format: 'png' });
        expect(result.png).toBeTruthy();
        expect(result.png![0]).toBe(0x89); // PNG magic byte
        writeGallery(`${base}.png`, result.png!);
        console.log(`[${theme}] ${base}.png written.`);
      });

      it(`${base} is deterministic`, () => {
        const mmd = readMmd(src);
        const a = renderMermaid(mmd, { theme, format: 'svg' });
        const b = renderMermaid(mmd, { theme, format: 'svg' });
        expect(a.sceneHash).toBe(b.sceneHash);
        expect(a.svg).toBe(b.svg);
      });
    }

    // ── Coherence: all 6 renders share the contract surface color ───────────
    it(`all 6 ${theme} renders share the contract surface color (scene.background)`, () => {
      const expected = SURFACE[theme]!;
      for (const { src } of COMPONENTS) {
        const mmd = readMmd(src);
        const result = renderMermaid(mmd, { theme, format: 'svg' });
        expect(result.scene.background.toLowerCase()).toBe(expected);
      }
    });

    it(`all 6 ${theme} SVGs include the contract accent color`, () => {
      const expected = ACCENT[theme]!;
      for (const { slug } of COMPONENTS) {
        const svg = readFileSync(join(GALLERY, `${theme}-${slug}.svg`), 'utf-8');
        expect(svg.toLowerCase()).toContain(expected);
      }
    });
  });
}
