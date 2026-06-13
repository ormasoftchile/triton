/**
 * @file composition/resolve.ts — External ir_file reference resolver.
 *
 * `resolveCompositionRefs` is the ONLY place in the composition pipeline that
 * performs file I/O.  It walks a CompositionDocument's cells and, for every
 * cell whose content is `{ kind: 'ref' }`, reads the referenced file, parses
 * it (YAML or JSON), validates it against that grammar's Zod schema, and
 * replaces the cell content with the appropriate inline variant:
 *
 *   { kind: 'ref', grammar: 'flow',     ir_file: '...' }  →  { kind: 'flow',     doc: FlowDocument }
 *   { kind: 'ref', grammar: 'tree',     ir_file: '...' }  →  { kind: 'tree',     doc: TreeDocument }
 *   { kind: 'ref', grammar: 'sequence', ir_file: '...' }  →  { kind: 'sequence', doc: SequenceDocument }
 *   { kind: 'ref', grammar: 'timeline', ir_file: '...' }  →  { kind: 'timeline', doc: IRDocument }
 *
 * The returned document is a fully-inlined CompositionDocument that can be
 * passed directly to `buildCompositionScene` (which remains pure — no I/O).
 *
 * Architectural constraint: this module is the integration seam between the
 * file system and the pure layout pipeline.  Nothing in layout.ts or schema.ts
 * reads files.
 */

import { readFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { flowDocumentSchema }     from '../grammars/flow/schema.js';
import { treeDocumentSchema }     from '../grammars/tree/schema.js';
import { sequenceDocumentSchema } from '../grammars/sequence/schema.js';
import { irDocumentSchema }       from '../schema.js';

import type { CompositionDocument, CellContent, RefCellContent } from './types.js';

// ---------------------------------------------------------------------------
// Grammar-specific schema map
// ---------------------------------------------------------------------------

const GRAMMAR_SCHEMAS = {
  flow:     flowDocumentSchema,
  tree:     treeDocumentSchema,
  sequence: sequenceDocumentSchema,
  timeline: irDocumentSchema,
} as const;

// ---------------------------------------------------------------------------
// Single-ref resolver
// ---------------------------------------------------------------------------

/**
 * Resolve one RefCellContent to its inline equivalent.
 *
 * @throws {Error} if the file cannot be read, cannot be parsed, or fails
 *   its grammar's schema validation.
 */
function resolveRef(ref: RefCellContent, baseDir: string): CellContent {
  const absolutePath = resolvePath(join(baseDir, ref.ir_file));

  // ── Read ──────────────────────────────────────────────────────────────────
  let rawText: string;
  try {
    rawText = readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `resolveCompositionRefs: cannot read ir_file "${ref.ir_file}" ` +
      `(resolved: "${absolutePath}"): ${msg}`,
    );
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  let parsed: unknown;
  const isJson = rawText.trimStart().startsWith('{');
  try {
    parsed = isJson ? (JSON.parse(rawText) as unknown) : parseYaml(rawText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const fmt = isJson ? 'JSON' : 'YAML';
    throw new Error(
      `resolveCompositionRefs: ${fmt} parse error in "${ref.ir_file}": ${msg}`,
    );
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const schema = GRAMMAR_SCHEMAS[ref.grammar];
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `resolveCompositionRefs: "${ref.ir_file}" failed ${ref.grammar} schema validation:\n${issues}`,
    );
  }

  // ── Return inline variant ─────────────────────────────────────────────────
  switch (ref.grammar) {
    case 'flow':
      return { kind: 'flow',     doc: result.data as import('../grammars/flow/types.js').FlowDocument };
    case 'tree':
      return { kind: 'tree',     doc: result.data as import('../grammars/tree/types.js').TreeDocument };
    case 'sequence':
      return { kind: 'sequence', doc: result.data as import('../grammars/sequence/types.js').SequenceDocument };
    case 'timeline':
      return { kind: 'timeline', doc: result.data as import('../types.js').IRDocument };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Walk every cell in `doc`; replace any `kind:'ref'` content with the
 * corresponding inline grammar content loaded from `baseDir`.
 *
 * Cells whose content is already inline (flow / tree / sequence / timeline /
 * stat / text / title) are returned unchanged (structural copy).
 *
 * @param doc     - A CompositionDocument (may contain ref cells).
 * @param baseDir - Directory used to resolve relative `ir_file` paths.
 *                  Typically the directory of the composition YAML file.
 * @returns A new CompositionDocument with all ref cells replaced by their
 *          inline equivalents.  The original `doc` is not mutated.
 *
 * @throws {Error} if any referenced file is missing, unparseable, or fails
 *   its grammar's schema.
 */
export function resolveCompositionRefs(
  doc: CompositionDocument,
  baseDir: string,
): CompositionDocument {
  const resolvedCells = doc.cells.map((cell) => {
    if (cell.content.kind !== 'ref') {
      return cell;
    }
    const inlined = resolveRef(cell.content, baseDir);
    return { ...cell, content: inlined };
  });

  return { ...doc, cells: resolvedCells };
}
