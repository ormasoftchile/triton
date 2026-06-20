/**
 * Generate basic SVG examples for each diagram type.
 *
 * Usage:  node --loader ts-node/esm examples/basics/render.mjs
 *    or:  node examples/basics/render.mjs  (after build)
 */

import { render } from '../../src/frontend/index.js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const examples = [
  {
    name: 'flowchart',
    input: `flowchart LR
  start[Start] --> validate{Validate}
  validate -->|valid| process[Process]
  validate -->|invalid| reject[Reject]
  process --> notify(Notify User)
  notify --> done([Done])
`,
  },
  {
    name: 'timeline',
    input: `timeline
  title Product Roadmap 2025
  section Planning
    2025-Q1 : Research
    2025-Q1 : Define requirements
  section Development
    2025-Q2 : Build MVP
    2025-Q3 : Beta launch
  section Release
    2025-Q4 : GA release
`,
  },
  {
    name: 'poster',
    input: `poster "System Dashboard"
  columns 2

  cell "Services" :: flow
    flowchart LR
      api[API] --> db[(Database)]
      api --> cache[Cache]
  end

  cell "Uptime" :: stat
    99.95% | availability
  end

  cell "Roadmap" :: timeline
    timeline
      title Milestones
      2025-Q1 : Alpha
      2025-Q3 : Beta
      2025-Q4 : GA
  end

  cell "Notes" :: text
    All services operating normally.
  end
`,
  },
];

async function main() {
  for (const { name, input } of examples) {
    // Write the source input
    writeFileSync(join(__dirname, `${name}.txt`), input, 'utf-8');

    // Render to SVG
    const result = await render(input);
    if (!result.ok) {
      console.error(`✗ ${name}: ${result.error.message}`);
      if (result.error.cause) console.error('  cause:', String(result.error.cause));
      continue;
    }

    writeFileSync(join(__dirname, `${name}.svg`), result.value, 'utf-8');
    console.log(`✓ ${name}.svg`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
