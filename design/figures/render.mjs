// Renders the specification's example .mmd sources to figures/<name>.png using
// Triton itself (the compiler this document describes). Run: pnpm figures
import { readFileSync, writeFileSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));   // design/figures
const root = join(here, '..', '..');                    // repo root

// tsc does not copy the generated Peggy parsers into dist; sync them.
const diagramsSrc = join(root, 'src', 'diagrams');
for (const d of readdirSync(diagramsSrc)) {
  const sp = join(diagramsSrc, d, 'parser.js');
  const dp = join(root, 'dist', 'diagrams', d, 'parser.js');
  if (existsSync(sp) && existsSync(dirname(dp))) cpSync(sp, dp);
}

const { render } = await import(pathToFileURL(join(root, 'dist/frontend/index.js')).href);
const { Resvg } = await import(pathToFileURL(join(root, 'node_modules/@resvg/resvg-js/index.js')).href);

// figure name -> example source
const figs = {
  flowchart:    'examples/flowchart/flowchart.mmd',
  avl:          'examples/tree/avl.mmd',
  radix:        'examples/tree/radix.mmd',
  array:        'examples/struct/array.mmd',
  memory:       'examples/struct/memory.mmd',
  numa:         'examples/topology/numa-detail.mmd',
  'sql-engine': 'examples/poster/sql-engine.mmd',
  spanning:     'examples/poster/spanning.mmd',
};

let ok = 0, bad = 0;
for (const [name, rel] of Object.entries(figs)) {
  const r = await render(readFileSync(join(root, rel), 'utf8'));
  if (!r.ok) { console.log('FAIL', name, JSON.stringify(r.error).slice(0, 140)); bad++; continue; }
  const png = new Resvg(r.value, { fitTo: { mode: 'width', value: 1500 } }).render().asPng();
  writeFileSync(join(here, name + '.png'), png);
  console.log('wrote figures/' + name + '.png');
  ok++;
}
console.log(`\n${ok} rendered, ${bad} failed`);
if (bad) process.exit(1);
