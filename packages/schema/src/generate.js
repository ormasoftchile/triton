/**
 * Generate v1/timeline.json from @timeline-compiler/core's JSON Schema.
 *
 * Run after building core:
 *   pnpm --filter @timeline-compiler/schema build
 *   (or: pnpm -r build, which respects topological order)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// getSchema() is backed by zod-to-json-schema — pure, synchronous, no I/O.
import { getSchema } from '@timeline-compiler/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'v1');
const outFile = resolve(outDir, 'timeline.json');

mkdirSync(outDir, { recursive: true });

const schema = getSchema();
const json = JSON.stringify(schema, null, 2) + '\n';

writeFileSync(outFile, json, 'utf-8');

console.log(`✅  Written ${outFile}`);
