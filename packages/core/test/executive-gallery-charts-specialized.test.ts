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

function tintColor(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tr = Math.round(r + (255 - r) * t);
  const tg = Math.round(g + (255 - g) * t);
  const tb = Math.round(b + (255 - b) * t);
  return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

const cases = [
  { slug: 'pie', source: 'mermaid-pie.mmd', kind: 'pie', expectedColor: '#1f497d' },
  { slug: 'quadrant', source: 'mermaid-quadrant.mmd', kind: 'quadrantChart', expectedColor: '#1f497d' },
  { slug: 'radar', source: 'mermaid-radar.mmd', kind: 'radar-beta', expectedColor: '#1f497d' },
  { slug: 'sankey', source: 'mermaid-sankey.mmd', kind: 'sankey-beta', expectedColor: '#1f497d' },
  { slug: 'gitgraph', source: 'mermaid-gitgraph.mmd', kind: 'gitGraph', expectedColor: '#1f497d' },
  { slug: 'journey', source: 'mermaid-journey.mmd', kind: 'journey', expectedColor: '#1f497d' },
  { slug: 'kanban', source: 'mermaid-kanban.mmd', kind: 'kanban', expectedColor: '#1f497d' },
  { slug: 'mindmap', source: 'mermaid-mindmap.mmd', kind: 'mindmap', expectedColor: '#1f497d' },
  { slug: 'packet', source: 'mermaid-packet.mmd', kind: 'packet-beta', expectedColor: tintColor('#1F497D', 0.80).toLowerCase() },
] as const;

describe('Executive gallery — charts + specialized family emit (executive theme, NEW files only)', () => {
  for (const { slug, source, kind, expectedColor } of cases) {
    it(`emits executive-${slug}.svg for ${kind}`, () => {
      const src = readMmd(source);
      const result = renderMermaid(src, { theme: 'executive', format: 'svg' });
      expect(result.svg).toBeTruthy();
      expect(result.svg!).toContain('<svg');
      expect(result.scene.background.toLowerCase()).toBe('#ffffff');
      expect(result.svg!.toLowerCase()).toContain(expectedColor);
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
