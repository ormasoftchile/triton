/**
 * Build script: compile all grammar.peggy files to parser.js + parser.d.ts.
 *
 * For each src/diagrams/<type>/grammar.peggy, generates:
 *   src/diagrams/<type>/parser.js   (ES module, auto-generated)
 *   src/diagrams/<type>/parser.d.ts (type declarations)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import peggy from 'peggy';

const __dirname = dirname(fileURLToPath(import.meta.url));
const diagramsDir = join(__dirname, '..', 'src', 'diagrams');

const types = readdirSync(diagramsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

let built = 0;

for (const type of types) {
  const grammarPath = join(diagramsDir, type, 'grammar.peggy');
  if (!existsSync(grammarPath)) continue;

  const grammar = readFileSync(grammarPath, 'utf-8');

  try {
    const source = peggy.generate(grammar, { output: 'source', format: 'es' });

    writeFileSync(
      join(diagramsDir, type, 'parser.js'),
      `// AUTO-GENERATED from grammar.peggy — do not edit.\n// Regenerate: node scripts/build-grammars.mjs\n\n${source}\n`,
    );

    writeFileSync(
      join(diagramsDir, type, 'parser.d.ts'),
      `// AUTO-GENERATED from grammar.peggy — do not edit.\n\nexport interface ParseOptions {\n  startRule?: string;\n  tracer?: { trace: (event: object) => void };\n  [key: string]: unknown;\n}\n\nexport function parse(input: string, options?: ParseOptions): unknown;\n`,
    );

    console.log(`  ✓ ${type}/grammar.peggy → parser.js + parser.d.ts`);
    built++;
  } catch (err) {
    console.error(`  ✗ ${type}/grammar.peggy\n    ${err.message}`);
    process.exit(1);
  }
}

console.log(`\n${built} grammar(s) compiled.`);
