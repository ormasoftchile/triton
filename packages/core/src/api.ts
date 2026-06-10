/**
 * @file api.ts — Public function stubs for Timeline Compiler.
 *
 * TRANSPARENCY CONTRACT
 * ---------------------
 * All consumers (CLI, MCP server, VS Code extension, future web worker) import
 * these functions and call them IN-PROCESS.  No child-process spawning occurs.
 * - `render` / `compile` return SVG as a plain `string` (not a Buffer, not a stream).
 * - `Diagnostic` objects map 1:1 to `vscode.Diagnostic` — same path/severity/range shape.
 * - `createSession` returns a stateful, synchronous `Session`; the caller disposes it.
 *
 * Phase 0: All rendering/layout/validation functions throw `NotImplementedError`.
 *          Only `getSchema()`, `listThemes()`, and `createSession()` return real values.
 * Phase 1: Replace stubs with real implementations.
 */

import { buildJsonSchema } from './schema.js';
import type {
  IRDocument,
  IncrementalResult,
  RenderOptions,
  RenderResult,
  Session,
  ThemeInfo,
  ValidationResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Thrown by Phase 0 stubs to signal unimplemented functionality.
 * Consumers should catch this and surface a graceful "not yet implemented" message.
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Not implemented (Phase 0 stub): ${feature}`);
    this.name = 'NotImplementedError';
  }
}

// ---------------------------------------------------------------------------
// Built-in theme catalogue (stub — real themes added in Phase 1)
// ---------------------------------------------------------------------------

const BUILT_IN_THEMES: ThemeInfo[] = [
  { id: 'default', title: 'Default', tier: 1 },
  { id: 'minimal', title: 'Minimal', tier: 1 },
  { id: 'executive', title: 'Executive', tier: 2 },
  { id: 'dark', title: 'Dark', tier: 1 },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a YAML or JSON string into an IRDocument.
 *
 * @throws {NotImplementedError} Phase 0 — parsing not yet implemented.
 */
export function loadIR(_text: string, _format?: 'yaml' | 'json'): IRDocument {
  throw new NotImplementedError('loadIR');
}

/**
 * Validate an IRDocument against the 17 well-formedness invariants from §4.
 *
 * @throws {NotImplementedError} Phase 0 — validator not yet implemented.
 */
export function validate(_ir: IRDocument): ValidationResult {
  throw new NotImplementedError('validate');
}

/**
 * Render an IRDocument to SVG or PNG.
 *
 * @throws {NotImplementedError} Phase 0 — renderer not yet implemented.
 */
export function render(_ir: IRDocument, _options: RenderOptions): RenderResult {
  throw new NotImplementedError('render');
}

/**
 * Synchronous convenience wrapper for live-preview use cases.
 * Accepts an already-parsed IRDocument or a raw YAML/JSON string.
 * SVG is returned as a plain string — no spawning, no I/O.
 *
 * @throws {NotImplementedError} Phase 0 — compile not yet implemented.
 */
export function compile(_input: IRDocument | string, _options: RenderOptions): RenderResult {
  throw new NotImplementedError('compile');
}

/**
 * List all built-in themes.  Returns metadata only; theme assets are not loaded.
 */
export function listThemes(): ThemeInfo[] {
  return BUILT_IN_THEMES.slice();
}

/**
 * Return the JSON Schema object for IRDocument (backed by the Zod schema in schema.ts).
 * Safe to call at any time — no I/O.
 */
export function getSchema(): object {
  return buildJsonSchema();
}

/**
 * Create a stateful live-preview session.
 *
 * The session parses and validates the document on each `update()` call and returns an
 * incremental result.  Phase 0: returns a placeholder result (no real parse/render).
 */
export function createSession(_options?: { theme?: string }): Session {
  let disposed = false;

  return {
    update(_text: string): IncrementalResult {
      if (disposed) throw new Error('Session has been disposed');
      // Phase 0 stub — returns placeholder values so callers can test the shape.
      return {
        svg: '<!-- Timeline Compiler Phase 0 stub — not yet implemented -->',
        diagnostics: [],
        changed: false,
      };
    },

    dispose(): void {
      disposed = true;
    },
  };
}
