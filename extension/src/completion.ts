import * as vscode from 'vscode';
// Core is imported by relative path (the repo has no package `main`/`exports`);
// esbuild bundles it. `detect()` is the SAME header→kind table the renderer and
// CLI use, so per-kind keyword completion never drifts from what actually parses.
import { detect } from '../../src/frontend/detect.js';
import { DIAGRAM_HEADERS, KIND_KEYWORDS, type KeywordEntry } from './keywords.js';
import { headerLineIndex } from './source-shape.js';
import { tritonFenceAt } from './triton-fences.js';

/**
 * Completion provider for Triton (Phase 3).
 *
 *  • At the HEADER position (top of an empty/early document, before the first
 *    real token), offers the diagram-kind headers from {@link DIAGRAM_HEADERS}
 *    — the same set `detect()` recognises.
 *  • Below the header, offers a modest curated set of per-kind body keywords for
 *    whatever kind the document's header resolves to (via core `detect()`).
 *
 * Registered for the `triton` language and (best-effort) inside ```triton fences
 * in Markdown. It never offers anything in a Markdown document outside such a
 * fence.
 */
class TritonCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    // Resolve the block we're completing within: the whole document for a
    // Triton file, or a single ```triton fence body inside Markdown.
    let baseLine = 0;
    let blockText = document.getText();
    if (!isTritonDocument(document)) {
      const fence = tritonFenceAt(document, position);
      if (!fence) return undefined; // Markdown outside a triton fence — not ours.
      baseLine = fence.bodyStartLine;
      blockText = fence.body;
    }

    const lines = blockText.split(/\r?\n/);
    const localLine = position.line - baseLine;
    const header = headerLineIndex(lines);

    // At or above the header line → offer diagram headers.
    if (localLine <= header) return headerItems();

    // Below the header → per-kind body keywords for the detected kind.
    const { diagramType } = detect(blockText);
    const entries = KIND_KEYWORDS[diagramType];
    if (!entries || entries.length === 0) return undefined;
    return entries.map((e) => keywordItem(e));
  }
}

function isTritonDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'triton' || document.uri.path.toLowerCase().endsWith('.triton');
}

function headerItems(): vscode.CompletionItem[] {
  return DIAGRAM_HEADERS.map((h) => {
    const item = new vscode.CompletionItem(h.insert, vscode.CompletionItemKind.Keyword);
    item.insertText = h.insert;
    item.detail = h.detail;
    item.documentation = new vscode.MarkdownString(h.doc);
    // Sort headers ahead of any incidental word-based suggestions.
    item.sortText = `0_${h.insert}`;
    return item;
  });
}

function keywordItem(e: KeywordEntry): vscode.CompletionItem {
  const kind = e.snippet ? vscode.CompletionItemKind.Snippet : vscode.CompletionItemKind.Keyword;
  const item = new vscode.CompletionItem(e.label, kind);
  if (e.snippet && e.insert) {
    item.insertText = new vscode.SnippetString(e.insert);
  } else if (e.insert) {
    item.insertText = e.insert;
  }
  item.detail = e.detail;
  if (e.doc) item.documentation = new vscode.MarkdownString(e.doc);
  return item;
}

/** Register the completion provider for `triton` files and ```triton fences. */
export function registerCompletion(context: vscode.ExtensionContext): void {
  const provider = new TritonCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      [{ language: 'triton' }, { language: 'markdown' }],
      provider,
    ),
  );
}
