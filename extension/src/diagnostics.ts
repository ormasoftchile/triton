import * as vscode from 'vscode';
// Core, bundled by esbuild via relative path. `renderSync` is the synchronous
// parse → theme → layout → render pipeline; it returns a Result and NEVER throws.
import { renderSync } from '../../src/frontend/index.js';
import type { DiagramError } from '../../src/contracts/index.js';
import { editorThemeInput } from './editor-theme.js';
import { findTritonFences } from './triton-fences.js';
import { firstNonBlankLine } from './source-shape.js';

/**
 * Live diagnostics for Triton (Phase 3).
 *
 * On open/change (debounced by `triton.preview.debounceMs`), the document is
 * compiled with the real core `renderSync`. A failing Result becomes a single
 * Error diagnostic; a successful one clears diagnostics.
 *
 * Range mapping (see {@link rangeFromError}): the core `DiagramError` itself
 * carries only `{ code, message }` — NO position. But parse failures wrap the
 * thrown Peggy `SyntaxError` as `error.cause`, and THAT carries a precise
 * `location { start, end }` (1-based line/column). So we map to the exact range
 * when a Peggy location is present, and otherwise fall back to underlining the
 * header line (the most useful no-position guess).
 *
 *  • `.triton` files / `triton` language → the whole document is one diagram.
 *  • Markdown → every ```triton fence is compiled, with ranges offset into the
 *    host document.
 */
export function registerDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('triton');
  context.subscriptions.push(collection);

  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const debounceMs = (): number =>
    Math.max(0, vscode.workspace.getConfiguration('triton').get<number>('preview.debounceMs', 150));

  const schedule = (doc: vscode.TextDocument): void => {
    if (!isTarget(doc)) return;
    const key = doc.uri.toString();
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        validate(doc, collection);
      }, debounceMs()),
    );
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => schedule(doc)),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      const key = doc.uri.toString();
      const t = timers.get(key);
      if (t) {
        clearTimeout(t);
        timers.delete(key);
      }
      collection.delete(doc.uri);
    }),
  );

  // Validate everything already open at activation.
  for (const doc of vscode.workspace.textDocuments) schedule(doc);

  // Clean up pending timers on deactivation.
  context.subscriptions.push({
    dispose() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  });
}

function isTarget(doc: vscode.TextDocument): boolean {
  if (doc.languageId === 'triton') return true;
  const path = doc.uri.path.toLowerCase();
  if (path.endsWith('.triton')) return true;
  return doc.languageId === 'markdown' || path.endsWith('.md') || path.endsWith('.markdown');
}

function isMarkdown(doc: vscode.TextDocument): boolean {
  const path = doc.uri.path.toLowerCase();
  return doc.languageId === 'markdown' || path.endsWith('.md') || path.endsWith('.markdown');
}

function validate(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
  const theme = editorThemeInput();
  const diagnostics: vscode.Diagnostic[] = [];

  if (isMarkdown(doc)) {
    // Each ```triton fence is an independent diagram; offset ranges into the doc.
    for (const fence of findTritonFences(doc.getText())) {
      const result = renderSync(fence.body, theme);
      if (!result.ok) {
        diagnostics.push(toDiagnostic(result.error, fence.bodyStartLine, fence.body, doc));
      }
    }
  } else {
    const result = renderSync(doc.getText(), theme);
    if (!result.ok) {
      diagnostics.push(toDiagnostic(result.error, 0, doc.getText(), doc));
    }
  }

  collection.set(doc.uri, diagnostics);
}

function toDiagnostic(
  error: DiagramError,
  baseLine: number,
  blockText: string,
  doc: vscode.TextDocument,
): vscode.Diagnostic {
  const range = rangeFromError(error, baseLine, blockText, doc);
  const diag = new vscode.Diagnostic(range, error.message, vscode.DiagnosticSeverity.Error);
  diag.code = error.code;
  diag.source = 'triton';
  return diag;
}

interface PeggyLocation {
  readonly start: { readonly line: number; readonly column: number };
  readonly end: { readonly line: number; readonly column: number };
}

/** Extract a Peggy `SyntaxError.location` from a wrapped `cause`, if present. */
function peggyLocation(cause: unknown): PeggyLocation | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const loc = (cause as { location?: unknown }).location;
  if (!loc || typeof loc !== 'object') return undefined;
  const start = (loc as { start?: unknown }).start;
  const end = (loc as { end?: unknown }).end;
  if (!isLineCol(start) || !isLineCol(end)) return undefined;
  return { start, end };
}

function isLineCol(v: unknown): v is { line: number; column: number } {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as { line?: unknown }).line === 'number' &&
    typeof (v as { column?: unknown }).column === 'number'
  );
}

/**
 * Build the diagnostic Range. Precise when the error carries a Peggy location
 * (1-based → 0-based, offset by the block's base line); otherwise underline the
 * block's first non-blank line as a sensible fallback.
 */
function rangeFromError(
  error: DiagramError,
  baseLine: number,
  blockText: string,
  doc: vscode.TextDocument,
): vscode.Range {
  const lineCount = doc.lineCount;
  const loc = peggyLocation(error.cause);
  if (loc) {
    const startLine = clampLine(baseLine + loc.start.line - 1, lineCount);
    const endLine = clampLine(baseLine + loc.end.line - 1, lineCount);
    const startCol = Math.max(0, loc.start.column - 1);
    let endCol = Math.max(0, loc.end.column - 1);
    // Peggy often reports a zero-width point (end === start). Widen to the end
    // of the line so the squiggle is visible.
    if (startLine === endLine && endCol <= startCol) {
      endCol = doc.lineAt(startLine).range.end.character;
    }
    return new vscode.Range(startLine, startCol, endLine, endCol);
  }

  // No position — underline the first non-blank line of the block.
  const lines = blockText.split(/\r?\n/);
  const local = firstNonBlankLine(lines);
  const line = clampLine(baseLine + local, lineCount);
  return doc.lineAt(line).range;
}

function clampLine(line: number, lineCount: number): number {
  if (line < 0) return 0;
  if (line >= lineCount) return Math.max(0, lineCount - 1);
  return line;
}
