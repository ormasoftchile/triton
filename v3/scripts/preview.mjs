#!/usr/bin/env node
/**
 * preview.mjs — full build + render pipeline for visual verification.
 *
 * Usage:
 *   node scripts/preview.mjs                    # renders examples/cross-link/
 *   node scripts/preview.mjs examples/basics/   # renders a different dir
 *
 * After running, reload the open SVG tabs in the browser to see the result.
 */

import { execSync }                                          from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync,
         readFileSync, writeFileSync }                       from 'node:fs';
import { join, dirname, basename }                           from 'node:path';
import { fileURLToPath }                                     from 'node:url';
import { createRequire }                                     from 'node:module';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const root       = join(__dirname, '..');

// ─── Step 1: Build grammars ───────────────────────────────────────────────────

console.log('▸ Building grammars…');
execSync('node scripts/build-grammars.mjs', { cwd: root, stdio: 'inherit' });

// ─── Step 2: Compile TypeScript ───────────────────────────────────────────────

console.log('▸ Compiling TypeScript…');
execSync('npx tsc --noEmit false', { cwd: root, stdio: 'inherit' });

// ─── Step 3: Copy generated parsers into dist ─────────────────────────────────

const diagramDirs = ['flowchart', 'timeline', 'poster'];
for (const dir of diagramDirs) {
  const src = join(root, 'src/diagrams', dir, 'parser.js');
  const dst = join(root, 'dist/diagrams', dir, 'parser.js');
  if (existsSync(src)) {
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    console.log(`  ✓ parser copied: ${dir}`);
  }
}

// ─── Step 4: Render examples ──────────────────────────────────────────────────

// Dynamic import from dist so we get the freshly compiled code.
// Cache-bust with a timestamp query param to force Node to re-load after recompile.
const bust = `?t=${Date.now()}`;
const { render } = await import(`../dist/frontend/index.js${bust}`);

const targetDir = join(root, process.argv[2] ?? 'examples/cross-link');
const mmdFiles  = readdirSync(targetDir).filter(f => f.endsWith('.mmd'));

if (mmdFiles.length === 0) {
  console.warn(`No .mmd files found in ${targetDir}`);
  process.exit(0);
}

console.log(`\n▸ Rendering ${mmdFiles.length} example(s) in ${targetDir}…`);
let errors = 0;

for (const file of mmdFiles) {
  const input   = readFileSync(join(targetDir, file), 'utf-8');
  const name    = basename(file, '.mmd');
  const outPath = join(targetDir, `${name}.svg`);

  const result = await render(input);
  if (!result.ok) {
    console.error(`  ✗ ${file}: [${result.error.code}] ${result.error.message}`);
    errors++;
    continue;
  }

  writeFileSync(outPath, result.value, 'utf-8');
  console.log(`  ✓ ${name}.svg`);
}

if (errors > 0) {
  console.error(`\n${errors} error(s). Reload browser tabs to see partial results.`);
  process.exit(1);
} else {
  console.log('\nDone. Reload browser tabs to see the updated SVGs.');
}
