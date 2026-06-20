/**
 * Build script: compile all .peggy grammars into TypeScript parser modules.
 *
 * For each `src/diagrams/<type>/grammar.peggy`, generates
 * `src/diagrams/<type>/parser.ts` with a typed `parse()` export.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import peggy from 'peggy';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src', 'diagrams');

const diagramDirs = readdirSync(srcDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

let built = 0;

for (const diagramType of diagramDirs) {
  const grammarPath = join(srcDir, diagramType, 'grammar.peggy');
  if (!existsSync(grammarPath)) continue;

  const grammar = readFileSync(grammarPath, 'utf-8');

  try {
    const parserSource = peggy.generate(grammar, {
      output: 'source',
      format: 'es',
    });

    const wrapper = `// AUTO-GENERATED from grammar.peggy — do not edit manually.
// Regenerate with: pnpm build:grammars

${parserSource}
`;

    const outPath = join(srcDir, diagramType, 'parser.js');
    writeFileSync(outPath, wrapper);

    // Generate .d.ts alongside .js
    const dts = `// AUTO-GENERATED from grammar.peggy — do not edit manually.

export interface ParseOptions {
  startRule?: string;
  tracer?: { trace: (event: object) => void };
  [key: string]: unknown;
}

export function parse(input: string, options?: ParseOptions): any;
`;
    writeFileSync(join(srcDir, diagramType, 'parser.d.ts'), dts);

    console.log(`  ✓ ${diagramType}/grammar.peggy → parser.js + parser.d.ts`);
    built++;
  } catch (e) {
    console.error(`  ✗ ${diagramType}/grammar.peggy — ${e.message}`);
    process.exit(1);
  }
}

console.log(`\n${built} grammar(s) compiled.`);
