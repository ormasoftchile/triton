/**
 * @file test/executive-gallery-nodelink.test.ts — Executive node-link gallery emit.
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

const cases = [
  { slug: 'class', source: 'mermaid-class.mmd', kind: 'classDiagram' },
  { slug: 'state', source: 'mermaid-state.mmd', kind: 'stateDiagram' },
  { slug: 'er', source: 'mermaid-er.mmd', kind: 'erDiagram' },
  { slug: 'c4', source: 'mermaid-c4.mmd', kind: 'C4Context' },
  { slug: 'requirement', source: 'mermaid-requirement.mmd', kind: 'requirementDiagram' },
  { slug: 'block', source: 'mermaid-block.mmd', kind: 'block-beta' },
  { slug: 'architecture', source: 'mermaid-architecture.mmd', kind: 'architecture-beta' },
] as const;

describe('Executive gallery — node-link family emit (executive theme, NEW files only)', () => {
  for (const { slug, source, kind } of cases) {
    it(`emits executive-${slug}.svg for ${kind}`, () => {
      const src = readMmd(source);
      const result = renderMermaid(src, { theme: 'executive', format: 'svg' });
      expect(result.svg).toBeTruthy();
      expect(result.svg!).toContain('<svg');
      // All executive node-link renders must use the contract accent color as an anchor
      expect(result.svg!.toLowerCase()).toContain('#1f497d');
      writeGallery(`executive-${slug}.svg`, result.svg!);
      console.log(`[executive] executive-${slug}.svg written.`);
    });

    it(`emits executive-${slug}.png for ${kind}`, () => {
      const src = readMmd(source);
      const result = renderMermaid(src, { theme: 'executive', format: 'png' });
      expect(result.png).toBeTruthy();
      expect(result.png![0]).toBe(0x89);
      writeGallery(`executive-${slug}.png`, result.png!);
      console.log(`[executive] executive-${slug}.png written.`);
    });

    it(`executive-${slug} renders are deterministic`, () => {
      const src = readMmd(source);
      const a = renderMermaid(src, { theme: 'executive', format: 'svg' });
      const b = renderMermaid(src, { theme: 'executive', format: 'svg' });
      expect(a.sceneHash).toBe(b.sceneHash);
      expect(a.svg).toBe(b.svg);
    });
  }
});
