/**
 * @file load.ts — IR document parser (syntactic + schema layer).
 *
 * `parseIR` accepts a YAML or JSON string, auto-detects the format when not
 * specified, parses the document, and validates it against the Zod schema.  On
 * any failure it throws `IRParseError` carrying a `Diagnostic[]` with
 * JSON-Pointer paths.  Source line/column is preserved best-effort from the
 * YAML parser's error metadata.
 *
 * This module performs ONLY syntactic / schema-level validation.  Cross-entity
 * well-formedness checks (reference resolution, cycle detection, temporal
 * invariants, etc.) live in validate.ts.
 */

import * as YAML from 'yaml';
import type { ZodIssue } from 'zod';
import { irDocumentSchema } from './schema.js';
import type { Diagnostic, DiagnosticRange, IRDocument } from './types.js';

// ---------------------------------------------------------------------------
// IRParseError
// ---------------------------------------------------------------------------

/**
 * Thrown by `parseIR` when the input cannot be parsed or fails schema
 * validation.  Carries a `diagnostics` array with JSON-Pointer paths and
 * machine-readable codes.
 */
export class IRParseError extends Error {
  /** Diagnostics for all schema / parse failures. */
  readonly diagnostics: readonly Diagnostic[];

  constructor(message: string, diagnostics: Diagnostic[]) {
    super(message);
    this.name = 'IRParseError';
    this.diagnostics = diagnostics;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Zod path (e.g. ['activities', 2, 'track']) to a JSON Pointer. */
function zodPathToPointer(path: (string | number)[]): string {
  if (path.length === 0) return '';
  return (
    '/' +
    path
      .map(String)
      .map((s) => s.replace(/~/g, '~0').replace(/\//g, '~1'))
      .join('/')
  );
}

/** Derive a human-readable suggestion for common Zod issue codes. */
function zodSuggestion(issue: ZodIssue): string | undefined {
  if (issue.code === 'invalid_type') {
    const i = issue as { code: 'invalid_type'; expected: string; received: string } & ZodIssue;
    return `Expected ${i.expected}, received ${i.received}.`;
  }
  if (issue.code === 'invalid_enum_value') {
    const i = issue as { code: 'invalid_enum_value'; options: (string | number)[] } & ZodIssue;
    return `Valid values are: ${i.options.join(', ')}.`;
  }
  if (issue.code === 'too_small') {
    const i = issue as { code: 'too_small'; minimum: number | bigint; type: string } & ZodIssue;
    return `Value must be at least ${String(i.minimum)} (${i.type}).`;
  }
  if (issue.code === 'invalid_string' && issue.validation === 'regex') {
    return 'Value does not match the required pattern. Check the field description.';
  }
  return undefined;
}

/** Convert Zod issues to Diagnostics. */
function zodIssuesToDiagnostics(issues: ZodIssue[]): Diagnostic[] {
  return issues.map((issue) => ({
    path: zodPathToPointer(issue.path),
    code: `SCHEMA_${issue.code.toUpperCase()}`,
    message: issue.message,
    severity: 'error' as const,
    suggestion: zodSuggestion(issue),
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a YAML or JSON string into a validated `IRDocument`.
 *
 * Format detection: if `format` is omitted, the text is treated as JSON when
 * it starts with `{` (after stripping leading whitespace), and as YAML
 * otherwise.
 *
 * @throws {IRParseError} On YAML/JSON syntax errors or Zod schema failures.
 *   Each diagnostic carries a JSON-Pointer `path`, a `code`, and a `message`.
 *   YAML errors include `range` (line/column) when the parser provides it.
 */
export function parseIR(text: string, format?: 'yaml' | 'json'): IRDocument {
  const fmt: 'yaml' | 'json' =
    format ?? (text.trimStart().startsWith('{') ? 'json' : 'yaml');

  // ── 1. Syntactic parse ────────────────────────────────────────────────────

  let parsed: unknown;

  if (fmt === 'json') {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new IRParseError(`JSON parse error: ${msg}`, [
        {
          path: '',
          code: 'JSON_PARSE_ERROR',
          message: msg,
          severity: 'error',
          suggestion: 'Ensure the input is valid JSON.',
        },
      ]);
    }
  } else {
    try {
      parsed = YAML.parse(text) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let range: DiagnosticRange | undefined;

      if (e != null && typeof e === 'object' && 'linePos' in e) {
        const lp = (e as { linePos?: Array<{ line: number; col: number }> }).linePos;
        if (lp?.[0] != null) {
          range = {
            start: { line: lp[0].line, column: lp[0].col },
            end: {
              line: lp[1]?.line ?? lp[0].line,
              column: lp[1]?.col ?? lp[0].col,
            },
          };
        }
      }

      throw new IRParseError(`YAML parse error: ${msg}`, [
        {
          path: '',
          code: 'YAML_PARSE_ERROR',
          message: msg,
          severity: 'error',
          suggestion: 'Check the YAML syntax at the indicated position.',
          range,
        },
      ]);
    }
  }

  // ── 2. Schema validation ───────────────────────────────────────────────────

  const result = irDocumentSchema.safeParse(parsed);

  if (!result.success) {
    const diagnostics = zodIssuesToDiagnostics(result.error.issues);
    throw new IRParseError(
      `Schema validation failed with ${diagnostics.length} error(s)`,
      diagnostics,
    );
  }

  return result.data as unknown as IRDocument;
}
