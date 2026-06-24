/**
 * Build script: compile all grammar.peggy files to parser.js + parser.d.ts.
 *
 * For each src/diagrams/**\/grammar.peggy (any depth — families may be grouped
 * under a parent folder such as src/diagrams/ds/<family>/), generates beside it:
 *   parser.js   (ES module, auto-generated)
 *   parser.d.ts (type declarations)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import peggy from 'peggy';

const __dirname = dirname(fileURLToPath(import.meta.url));
const diagramsDir = join(__dirname, '..', 'src', 'diagrams');

// Recursively collect every directory under src/diagrams/ that holds a
// `grammar.peggy` (any depth). Families regrouped under a parent folder
// (e.g. src/diagrams/ds/tree/) are discovered the same as top-level kinds.
function findGrammarDirs(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = join(dir, entry.name);
    if (existsSync(join(sub, 'grammar.peggy'))) {
      found.push(sub);
    }
    found.push(...findGrammarDirs(sub));
  }
  return found;
}

const grammarDirs = findGrammarDirs(diagramsDir);

let built = 0;

for (const dir of grammarDirs) {
  const grammarPath = join(dir, 'grammar.peggy');
  const label = relative(diagramsDir, dir); // e.g. "ds/tree" or "flowchart"

  const grammar = readFileSync(grammarPath, 'utf-8');

  try {
    const source = peggy.generate(grammar, { output: 'source', format: 'es' });

    writeFileSync(
      join(dir, 'parser.js'),
      `// AUTO-GENERATED from grammar.peggy — do not edit.\n// Regenerate: node scripts/build-grammars.mjs\n\n${source}\n`,
    );

    writeFileSync(
      join(dir, 'parser.d.ts'),
      `// AUTO-GENERATED from grammar.peggy — do not edit.\n\nexport interface ParseOptions {\n  startRule?: string;\n  tracer?: { trace: (event: object) => void };\n  [key: string]: unknown;\n}\n\nexport function parse(input: string, options?: ParseOptions): unknown;\n`,
    );

    console.log(`  ✓ ${label}/grammar.peggy → parser.js + parser.d.ts`);
    built++;
  } catch (err) {
    console.error(`  ✗ ${label}/grammar.peggy\n    ${err.message}`);
    process.exit(1);
  }
}

console.log(`\n${built} grammar(s) compiled.`);
