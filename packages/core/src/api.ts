/**
 * @file api.ts — Public API for Timeline Compiler.
 *
 * TRANSPARENCY CONTRACT
 * ---------------------
 * All consumers (CLI, MCP server, VS Code extension, future web worker) import
 * these functions and call them IN-PROCESS.  No child-process spawning occurs.
 * - `render` / `compile` return SVG as a plain `string` (not a Buffer, not a stream).
 * - `Diagnostic` objects map 1:1 to `vscode.Diagnostic` — same path/severity/range shape.
 * - `createSession` returns a stateful, synchronous `Session`; the caller disposes it.
 *
 * Phase 1: Real implementations delegate to parseIR / validateDocument / renderDocument.
 */

import { buildJsonSchema } from './schema.js';
import { parseIR, IRParseError } from './load.js';
import { validateDocument } from './validate.js';
import { renderDocument } from './render/index.js';
import { listThemeInfos } from './themes/index.js';
import type {
  Diagnostic,
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
 * Kept for backward compatibility — no longer thrown by the public API in Phase 1.
 * Consumers that previously caught this may still reference it safely.
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Not implemented (Phase 0 stub): ${feature}`);
    this.name = 'NotImplementedError';
  }
}

// Re-export IRParseError so consumers don't need to import from load.js directly.
export { IRParseError } from './load.js';

// ---------------------------------------------------------------------------
// Built-in theme catalogue (delegates to themes/index.ts registry)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a YAML or JSON string into a validated IRDocument.
 *
 * @throws {IRParseError} On syntax or schema validation failure.
 */
export function loadIR(text: string, format?: 'yaml' | 'json'): IRDocument {
  return parseIR(text, format);
}

/**
 * Validate an IRDocument against the 17 well-formedness invariants from §4.
 */
export function validate(ir: IRDocument): ValidationResult {
  return validateDocument(ir);
}

/**
 * Render an IRDocument to SVG or PNG.
 * SVG is always populated; PNG is populated when options.format === 'png'.
 */
export function render(ir: IRDocument, options: RenderOptions): RenderResult {
  return renderDocument(ir, options);
}

/**
 * Synchronous convenience wrapper: accepts a pre-parsed IRDocument or a raw
 * YAML/JSON string.  Parses when necessary, then renders.
 * SVG is returned as a plain string — no spawning, no I/O.
 *
 * @throws {IRParseError} When `input` is a string that fails to parse.
 */
export function compile(input: IRDocument | string, options: RenderOptions): RenderResult {
  const doc = typeof input === 'string' ? parseIR(input) : input;
  return renderDocument(doc, options);
}

/**
 * List all built-in themes.  Returns metadata only; theme assets are not loaded.
 */
export function listThemes(): ThemeInfo[] {
  return listThemeInfos();
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
 * Each `update(text)` call parses, validates, and renders the document.
 * Problems are surfaced as diagnostics — `update()` never throws.
 * Call `dispose()` when done to release internal state.
 */
export function createSession(options?: { theme?: string }): Session {
  let disposed = false;
  let lastSceneHash: string | undefined;
  let lastSvg = '';

  return {
    update(text: string): IncrementalResult {
      if (disposed) throw new Error('Session has been disposed');

      // ── Parse ──────────────────────────────────────────────────────────────
      let ir: IRDocument;
      try {
        ir = parseIR(text);
      } catch (e) {
        const diagnostics: Diagnostic[] =
          e instanceof IRParseError
            ? [...e.diagnostics]
            : [{ path: '', code: 'INTERNAL_ERROR', message: String(e), severity: 'error' }];
        return { svg: lastSvg, diagnostics, changed: false };
      }

      // ── Validate ───────────────────────────────────────────────────────────
      const vr = validateDocument(ir);
      const allDiagnostics: Diagnostic[] = [...vr.errors, ...vr.warnings];

      if (vr.errors.length > 0) {
        return { svg: lastSvg, diagnostics: allDiagnostics, changed: false };
      }

      // ── Render ─────────────────────────────────────────────────────────────
      try {
        const result = renderDocument(ir, { format: 'svg', theme: options?.theme });
        const newHash = result.sceneHash;
        const changed = newHash !== lastSceneHash;
        lastSceneHash = newHash;
        lastSvg = result.svg ?? '';
        return { svg: lastSvg, diagnostics: allDiagnostics, changed };
      } catch (e) {
        const diag: Diagnostic = {
          path: '',
          code: 'RENDER_ERROR',
          message: e instanceof Error ? e.message : String(e),
          severity: 'error',
        };
        return { svg: lastSvg, diagnostics: [diag], changed: false };
      }
    },

    dispose(): void {
      disposed = true;
    },
  };
}
