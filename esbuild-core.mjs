/**
 * esbuild bundle for @triton/core.
 *
 * Bundles `src/index.ts` plus the entire Triton compiler graph into a single
 * ESM file at `packages/core/dist/index.js`. This ensures generated Peggy
 * parsers are inlined and consumers get a single-file import.
 *
 * Type declarations are emitted separately via `tsc --emitDeclarationOnly`.
 */

import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // repo root
const watch = process.argv.includes('--watch');

// ── Precondition: generate the Peggy parsers (incrementally) ────────────────────
function ensureGrammars() {
  const diagramsDir = join(here, 'src', 'diagrams');

  function findGrammarDirs(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = join(dir, entry.name);
      if (existsSync(join(sub, 'grammar.peggy'))) out.push(sub);
      out.push(...findGrammarDirs(sub));
    }
    return out;
  }

  const stale = [];
  for (const dir of findGrammarDirs(diagramsDir)) {
    const grammar = join(dir, 'grammar.peggy');
    const parser = join(dir, 'parser.js');
    if (!existsSync(parser) || statSync(parser).mtimeMs < statSync(grammar).mtimeMs) {
      stale.push(relative(diagramsDir, dir));
    }
  }

  if (stale.length === 0) {
    console.log('› parsers up to date — skipping build:grammars');
    return;
  }

  console.log(`› build:grammars (${stale.length} stale: ${stale.join(', ')})…`);
  const r = spawnSync(process.execPath, [join(here, 'scripts', 'build-grammars.mjs')], {
    cwd: here,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('\n✗ build-grammars.mjs failed. Run `pnpm build:grammars` first.');
    process.exit(1);
  }
}

// ── Plugin: rewrite NodeNext `*.js` specifiers to the real `*.ts` source ────────
const resolveTsJsPlugin = {
  name: 'resolve-ts-from-js',
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.kind === 'entry-point') return undefined;
      if (!args.path.startsWith('.')) return undefined;

      const abs = resolve(args.resolveDir, args.path);
      const tsCandidate = abs.replace(/\.js$/, '.ts');
      if (existsSync(tsCandidate)) return { path: tsCandidate };
      const tsxCandidate = abs.replace(/\.js$/, '.tsx');
      if (existsSync(tsxCandidate)) return { path: tsxCandidate };
      return undefined;
    });
  },
};

ensureGrammars();

await build({
  entryPoints: [join(here, 'src', 'index.ts')],
  outfile: join(here, 'packages', 'core', 'dist', 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  plugins: [resolveTsJsPlugin],
});

// Emit declaration files via tsc (declarations only)
console.log('› emitting type declarations…');
const tsc = spawnSync(
  process.execPath,
  [
    join(here, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    '--project', join(here, 'tsconfig.json'),
    '--emitDeclarationOnly',
  ],
  { cwd: here, stdio: 'inherit' },
);
if (tsc.status !== 0) {
  console.error('✗ tsc --emitDeclarationOnly failed');
  process.exit(1);
}

console.log('✓ @triton/core built');
