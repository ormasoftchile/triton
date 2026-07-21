/**
 * Triton Deck List Examples — Render Script
 *
 * Renders .mmd source files in this directory to SVG.
 *
 * Usage:  npx tsx examples/triton/deck/list/render.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../../../../src/frontend/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const examples = [
  'bullets.mmd',
  'numbered.mmd',
  'block.mmd',
  'box.mmd',
  'tree.mmd',
  'chevron.mmd',
  'process.mmd',
  'process-ttb.mmd',
  'process-snake.mmd',
  'process-snake-direct.mmd',
  'process-snake-v.mmd',
  'timeline.mmd',
  'pyramid.mmd',
  'columns.mmd',
  'cycle.mmd',
  'matrix.mmd',
  'funnel.mmd',
  'stepup.mmd',
  'venn.mmd',
];

async function main() {
  mkdirSync(__dirname, { recursive: true });
  let failed = false;

  for (const file of examples) {
    const input = readFileSync(join(__dirname, file), 'utf-8');
    const name = basename(file, '.mmd');
    const result = await render(input);

    if (!result.ok) {
      failed = true;
      console.error(`✗ ${file}: ${result.error.message}`);
      continue;
    }

    const outPath = join(__dirname, `${name}.svg`);
    writeFileSync(outPath, result.value, 'utf-8');
    console.log(`✓ ${name}.svg`);
  }

  if (failed) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
