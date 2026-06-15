/**
 * @file test/named-themes-gallery.test.ts — Gallery emit for midnight, blueprint, editorial.
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

const THEMES = ['midnight', 'blueprint', 'editorial'] as const;

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
  midnight:  '#0f1620',
  blueprint: '#1a2b47',
  editorial: '#faf6ef',
};

const ACCENT: Record<string, string> = {
  midnight:  '#00d4ff',
  blueprint: '#00bfff',
  editorial: '#8b2635',
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

    // ── Coherence: all 6 renders in this theme share the same background ────
    //
    // We check scene.background (the authoritative field) rather than searching
    // SVG text, because not all renderers emit a background rect primitive.
    // (e.g. sankey omits the background rect from the primitive list.)
    it(`all 6 ${theme} renders share the contract surface color (scene.background)`, () => {
      const expected = SURFACE[theme]!;
      for (const { src, slug } of COMPONENTS) {
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
