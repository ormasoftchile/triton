// Triton ⇄ Markdown integration.
//
// This module is the bridge between the Triton compiler's SYNCHRONOUS render
// path (`renderSync`, added in src/frontend/index.ts) and two Markdown
// surfaces:
//
//   1. VS Code's built-in Markdown preview, via `extendMarkdownIt(md)` returned
//      from the extension's `activate()`. The fence renderer is overridden so
//      ```triton blocks (always) and ```mermaid blocks (only when
//      `triton.enableMermaid` is true) are compiled to inline SVG.
//
//   2. The Triton live webview (PreviewManager in extension.ts), which extracts
//      the same fenced blocks from the active Markdown document and renders them
//      stacked. It reuses `renderFencedBlock` / `extractFencedBlocks` here so the
//      two surfaces behave identically (including `file:` embeds and error UI).
//
// Everything here is synchronous — markdown-it's fence rule must return a string
// synchronously, and `renderSync` makes that possible (no diagram layout does
// genuinely-async work).

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { renderSync } from '../../src/frontend/index.js';

// markdown-it is provided by VS Code's Markdown preview at runtime; we never
// bundle it. Type it structurally with just the surface we touch.
interface MarkdownItLike {
  renderer: {
    rules: {
      fence?: FenceRule;
      [key: string]: FenceRule | undefined;
    };
  };
}

type FenceRule = (
  tokens: ReadonlyArray<{ info: string; content: string }>,
  idx: number,
  options: unknown,
  env: unknown,
  self: { renderToken(tokens: unknown, idx: number, options: unknown): string },
) => string;

export interface FencedBlock {
  /** Lower-cased first word of the fence info string (e.g. `triton`). */
  readonly lang: string;
  /** Raw block body (the lines between the fences). */
  readonly body: string;
}

// ─── Public: markdown-it plugin ────────────────────────────────────────────────

/**
 * Override markdown-it's fence renderer so Triton/Mermaid blocks become inline
 * SVG. Returns the same `md` instance (VS Code expects the plugin to return it).
 *
 * Gating:
 *   - `triton`  → always handled.
 *   - `mermaid` → only when the `triton.enableMermaid` setting is true,
 *                 read fresh on every render so toggling the setting takes
 *                 effect on the next preview refresh.
 *
 * Never throws: a compile/read failure renders a styled error block instead.
 */
export function extendMarkdownIt(md: MarkdownItLike): MarkdownItLike {
  const original = md.renderer.rules.fence;

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const lang = firstWord(token.info);

    const handle = lang === 'triton' || (lang === 'mermaid' && mermaidEnabled());
    if (!handle) {
      // Defer to the default fence renderer for everything else.
      return original
        ? original(tokens, idx, options, env, self)
        : `<pre><code>${escapeHtml(token.content)}</code></pre>`;
    }

    // VS Code's built-in preview often doesn't expose the document path through
    // `env`, so fall back to the last active Markdown file's folder (set by the
    // extension) so relative `file:` embeds still resolve.
    return renderFencedBlock(token.content, baseDirFromEnv(env) ?? fallbackBaseDir);
  };

  return md;
}

// Folder of the most recently active Markdown file, used as the `baseDir`
// fallback for the built-in preview when markdown-it's `env` lacks the path.
let fallbackBaseDir: string | undefined;

/** Record the folder to resolve relative `file:` embeds against in the built-in preview. */
export function setMarkdownBaseDir(dir: string | undefined): void {
  fallbackBaseDir = dir;
}

// ─── Public: shared block rendering ────────────────────────────────────────────

/**
 * Render a single fenced block's body to HTML (an inline-SVG container, or a
 * styled error block). Used by BOTH the markdown-it plugin and the live webview.
 *
 * If the body is a lone `file: <path>` directive, the referenced file is read
 * and compiled instead of the inline body. File reads are restricted to within
 * an open workspace folder (no traversal outside it).
 *
 * @param baseDir Folder to resolve relative `file:` paths against (the Markdown
 *   document's folder). Absent when the host gives us no document path.
 */
export function renderFencedBlock(rawBody: string, baseDir: string | undefined): string {
  let source = rawBody;

  const fileRef = parseFileDirective(rawBody);
  if (fileRef !== undefined) {
    const read = safeRead(fileRef, baseDir);
    if (!read.ok) return errorBlock(read.message);
    source = read.text;
  }

  const result = renderSync(source);
  if (result.ok) return svgContainer(result.value);
  return errorBlock(`[${result.error.code}] ${result.error.message}`);
}

/**
 * Extract every fenced code block whose language is in `langs` (lower-cased).
 * Mirrors the simple backtick-fence convention the rest of the extension uses;
 * good enough for the controlled webview/preview surfaces (no tilde fences).
 */
export function extractFencedBlocks(text: string, langs: ReadonlySet<string>): FencedBlock[] {
  const re = /```([A-Za-z0-9_-]*)[^\n]*\r?\n([\s\S]*?)```/g;
  const out: FencedBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lang = (m[1] ?? '').toLowerCase();
    if (langs.has(lang)) out.push({ lang, body: m[2] ?? '' });
  }
  return out;
}

// ─── `file:` directive ─────────────────────────────────────────────────────────

/**
 * If the block body is a single `file: <path>` directive (ignoring blank
 * lines), return the path; otherwise undefined (treat the body as inline DSL).
 */
export function parseFileDirective(body: string): string | undefined {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length !== 1) return undefined;
  const m = /^file:\s*(.+)$/i.exec(lines[0]!);
  return m ? m[1]!.trim() : undefined;
}

type ReadResult = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly message: string };

/**
 * Resolve and read a `file:` target with strict workspace containment.
 *
 * Security: the resolved path must stay within an open workspace folder.
 * Relative paths resolve against `baseDir` (the Markdown document's folder);
 * absolute paths are accepted only if they fall inside a workspace folder.
 * Any `..` traversal that would escape the workspace is rejected.
 */
function safeRead(rawPath: string, baseDir: string | undefined): ReadResult {
  let abs: string;
  if (path.isAbsolute(rawPath)) {
    abs = path.normalize(rawPath);
  } else if (baseDir) {
    abs = path.normalize(path.resolve(baseDir, rawPath));
  } else {
    return { ok: false, message: `Cannot resolve relative file embed "${rawPath}": the document folder is unknown here.` };
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return { ok: false, message: 'File embeds require an open workspace folder.' };
  }
  const within = folders.some((f) => isWithin(f.uri.fsPath, abs));
  if (!within) {
    return { ok: false, message: `Refused to read "${rawPath}": file embeds must stay within the workspace.` };
  }

  try {
    const text = fs.readFileSync(abs, 'utf8');
    return { ok: true, text };
  } catch {
    return { ok: false, message: `Could not read file embed "${rawPath}".` };
  }
}

/** True iff `target` is `root` itself or lives underneath it (lexically). */
function isWithin(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// ─── HTML fragments ─────────────────────────────────────────────────────────────

function svgContainer(svg: string): string {
  return `<div class="triton-diagram" style="margin:1em 0;overflow:auto;">${svg}</div>\n`;
}

function errorBlock(message: string): string {
  return (
    `<pre class="triton-error" style="white-space:pre-wrap;margin:1em 0;padding:10px 14px;` +
    `border-radius:4px;color:var(--vscode-inputValidation-errorForeground,#fff);` +
    `background:var(--vscode-inputValidation-errorBackground,#5a1d1d);` +
    `border:1px solid var(--vscode-inputValidation-errorBorder,#be1100);` +
    `font-family:var(--vscode-editor-font-family,monospace);font-size:12px;">` +
    `${escapeHtml(message)}</pre>\n`
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────────────

function firstWord(info: string): string {
  return (info ?? '').trim().split(/\s+/)[0]!.toLowerCase();
}

function mermaidEnabled(): boolean {
  return vscode.workspace.getConfiguration('triton').get<boolean>('enableMermaid', false);
}

/**
 * Best-effort: pull the current Markdown document's folder out of markdown-it's
 * `env`. VS Code's preview populates `env` differently across versions, so we
 * probe the common shapes. When none is present, relative `file:` embeds in the
 * built-in preview can't resolve (the Triton webview path always knows the
 * folder, so embeds work reliably there).
 */
function baseDirFromEnv(env: unknown): string | undefined {
  if (!env || typeof env !== 'object') return undefined;
  const e = env as Record<string, unknown>;
  const candidate =
    e['currentDocument'] ?? e['resource'] ?? e['uri'] ?? (e['document'] as { uri?: unknown } | undefined)?.uri;
  if (!candidate) return undefined;

  if (typeof candidate === 'string') return path.dirname(candidate);
  const uriLike = candidate as { fsPath?: unknown; path?: unknown };
  if (typeof uriLike.fsPath === 'string') return path.dirname(uriLike.fsPath);
  if (typeof uriLike.path === 'string') return path.dirname(uriLike.path);
  return undefined;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
