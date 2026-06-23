import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../src/frontend/index.js';

const examplesDir = fileURLToPath(new URL('../examples', import.meta.url));

/** Recursively collect every .mmd example path. */
function collectMmd(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectMmd(full, out);
    else if (entry.endsWith('.mmd')) out.push(full);
  }
  return out;
}

const files = collectMmd(examplesDir).sort();

describe('examples render', () => {
  it('found example files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const name = relative(examplesDir, file);
    it(`renders ${name} to valid SVG`, async () => {
      const src = readFileSync(file, 'utf8');
      const result = await render(src);
      if (!result.ok) throw new Error(`${name}: ${result.error.code} — ${result.error.message}`);
      expect(result.value.startsWith('<svg')).toBe(true);
      expect(result.value).toContain('</svg>');
    });
  }
});
