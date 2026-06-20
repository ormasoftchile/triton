/**
 * Cross-Link Examples — Render Script
 *
 * Renders .mmd source files in this directory to SVG.
 *
 * Usage:  npx tsx examples/cross-link/render.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../../src/frontend/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const examples = ['basic.mmd', 'complex.mmd'];

async function main() {
  mkdirSync(__dirname, { recursive: true });

  for (const file of examples) {
    const input = readFileSync(join(__dirname, file), 'utf-8');
    const name = basename(file, '.mmd');
    const result = await render(input);

    if (!result.ok) {
      console.error(`✗ ${file}: ${result.error.message}`);
      continue;
    }

    const outPath = join(__dirname, `${name}.svg`);
    writeFileSync(outPath, result.value, 'utf-8');
    console.log(`✓ ${name}.svg`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
