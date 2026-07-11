import * as vscode from 'vscode';
import { dirname } from 'path';
import type { ThemeInput } from '../../src/contracts/index.js';
// The Triton compiler is imported by RELATIVE PATH (the repo has no package
// `main`/`exports`, so `import 'triton'` is impossible). esbuild bundles this
// whole graph into a single CJS file; its `.js`→`.ts` resolve plugin follows
// the NodeNext `.js` specifier below into `src/frontend/index.ts`.
import { render } from '../../src/frontend/index.js';
import { themePresetNames } from '../../src/theme/preset.js';
import { extendMarkdownIt, extractFencedBlocks, renderFencedBlock, setMarkdownBaseDir } from './markdown.js';
import { editorThemeInput } from './editor-theme.js';
import { registerCompletion } from './completion.js';
import { registerDiagnostics } from './diagnostics.js';
import { shellHtml } from './preview-html.js';

// ─── Mermaid coexistence reconciliation (LOCKED decision) ──────────────────────
//
// Triton renders the same diagram grammar as Mermaid, so it COULD claim every
// `.mmd` file and ```mermaid fence on the machine. We deliberately do not, to
// avoid stomping an already-installed Mermaid extension. The rule:
//
//   • `triton` language + `.triton` files + ```triton fences → ALWAYS handled.
//   • The explicit "Triton: Open Preview" / "…to the Side" commands render
//     WHATEVER the active file is, unconditionally — including `.mmd` files and
//     ```mermaid fences. Running the command is an explicit user intent.
//   • PASSIVE handling of Mermaid content (auto-selecting a ```mermaid fence in
//     a Markdown document) is gated behind the `triton.enableMermaid` setting,
//     which DEFAULTS TO false.
//
// In Phase 1 a preview only ever opens via the explicit command, so Triton never
// auto-claims anything on its own. Once a preview is open it live-updates that
// document (the user explicitly opened it). The `enableMermaid` gate has teeth
// for Markdown fence selection (see `pickRenderable`).

type RenderMode = 'explicit' | 'passive';

const PREVIEW_THEME_KEY = 'triton.previewTheme';

interface Renderable {
  /** The diagram source text to feed to `render()`. */
  readonly text: string;
}

interface PreviewConfig {
  readonly enableMermaid: boolean;
  readonly debounceMs: number;
}

function readConfig(): PreviewConfig {
  const cfg = vscode.workspace.getConfiguration('triton');
  return {
    enableMermaid: cfg.get<boolean>('enableMermaid', false),
    debounceMs: cfg.get<number>('preview.debounceMs', 150),
  };
}

function extname(uri: vscode.Uri): string {
  const path = uri.path;
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return dot > slash ? path.slice(dot).toLowerCase() : '';
}

/** Extract the first fenced block of the given language from Markdown text. */
function firstFence(text: string, lang: string): string | undefined {
  const re = new RegExp('```' + lang + '\\b[^\\n]*\\n([\\s\\S]*?)```', 'i');
  const m = re.exec(text);
  return m ? m[1] : undefined;
}

/**
 * Decide what (if anything) to render for a document, honoring the Mermaid
 * coexistence rule above. Returns `undefined` when there is nothing eligible.
 */
function pickRenderable(
  document: vscode.TextDocument,
  config: PreviewConfig,
  mode: RenderMode,
): Renderable | undefined {
  const lang = document.languageId;
  const ext = extname(document.uri);
  const text = document.getText();

  // Triton is always ours.
  if (lang === 'triton' || ext === '.triton') return { text };

  // Markdown: ```triton always; ```mermaid only when explicit OR enabled.
  if (lang === 'markdown' || ext === '.md' || ext === '.markdown') {
    const triton = firstFence(text, 'triton');
    if (triton !== undefined) return { text: triton };
    if (mode === 'explicit' || config.enableMermaid) {
      const mermaid = firstFence(text, 'mermaid');
      if (mermaid !== undefined) return { text: mermaid };
    }
    return undefined;
  }

  // Standalone Mermaid file: explicit command always; passive only when enabled.
  if (ext === '.mmd') {
    if (mode === 'explicit' || config.enableMermaid) return { text };
    return undefined;
  }

  // Any other file: render on explicit request only (detect() best-effort).
  if (mode === 'explicit') return { text };
  return undefined;
}

// ─── Webview HTML ──────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Preview manager ───────────────────────────────────────────────────────────

/**
 * Is this document a diagram the preview should FOLLOW when it becomes active?
 *
 * This is intentionally stricter than `pickRenderable`'s explicit mode: it only
 * returns true for clearly-diagram documents, so switching the active editor to
 * an unrelated file (a `.ts`, a plain Markdown note) leaves the last diagram on
 * screen instead of replacing it with an error banner.
 */
function isDiagramDoc(doc: vscode.TextDocument, config: PreviewConfig): boolean {
  const lang = doc.languageId;
  const ext = extname(doc.uri);
  if (lang === 'triton' || ext === '.triton') return true;
  if (ext === '.mmd') return true;
  if (lang === 'markdown' || ext === '.md' || ext === '.markdown') {
    const text = doc.getText();
    if (firstFence(text, 'triton') !== undefined) return true;
    if (config.enableMermaid && firstFence(text, 'mermaid') !== undefined) return true;
  }
  return false;
}

/** Is this document Markdown (where we render fenced blocks, not the whole file)? */
function isMarkdownDoc(doc: vscode.TextDocument): boolean {
  const ext = extname(doc.uri);
  return doc.languageId === 'markdown' || ext === '.md' || ext === '.markdown';
}

/** Wrap a rendered block with a caption when a document has more than one. */
function labelBlock(index: number, total: number, lang: string, html: string): string {
  if (total <= 1) return html;
  const caption = `Block ${index + 1} of ${total}${lang === 'mermaid' ? ' · mermaid' : ''}`;
  return (
    `<figure style="margin:0 0 1.5em;">` +
    `<figcaption style="font:600 12px var(--vscode-font-family,sans-serif);opacity:.65;margin:0 0 4px;">` +
    `${escapeHtml(caption)}</figcaption>${html}</figure>`
  );
}

interface Preview {
  readonly panel: vscode.WebviewPanel;
  docUri: vscode.Uri;
  /** True once the webview has signalled it is loaded and listening. */
  ready: boolean;
  /** The most recent message to deliver once the webview becomes ready. */
  pending: WebviewMessage | undefined;
}

type WebviewMessage =
  | { readonly type: 'svg'; readonly svg: string; readonly docUri: string; readonly doc: boolean }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'theme'; readonly name: string };

class PreviewManager {
  // A single live preview that FOLLOWS the active editor, like the built-in
  // Markdown preview. Switching to another diagram file re-points it; switching
  // to a non-diagram file leaves the last diagram untouched.
  private preview: Preview | undefined;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocChange(e.document)),
      vscode.window.onDidChangeActiveTextEditor((editor) => this.onActiveEditor(editor)),
      // Re-render when the editor's color theme changes so the transparent
      // background and light/dark palette track the editor.
      vscode.window.onDidChangeActiveColorTheme(() => this.onColorThemeChange()),
    );
  }

  /** Open or reveal the preview, bound to the active editor's document. */
  show(editor: vscode.TextEditor | undefined, column: vscode.ViewColumn): void {
    if (!editor) {
      void vscode.window.showInformationMessage('Triton: open a file first, then run the preview.');
      return;
    }
    const doc = editor.document;

    if (!this.preview) {
      const panel = vscode.window.createWebviewPanel(
        'tritonPreview',
        `Triton: ${this.label(doc.uri)}`,
        { viewColumn: column, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] },
      );
      panel.webview.html = shellHtml(panel.webview, this.label(doc.uri), this.selectedTheme());
      this.bindPanel(panel, doc.uri);
    } else {
      this.preview.docUri = doc.uri;
      this.preview.panel.title = `Triton: ${this.label(doc.uri)}`;
      this.preview.panel.reveal(column, true);
    }

    void this.renderInto(doc, 'explicit');
  }

  /**
   * Adopt a webview panel into the manager: wire the ready handshake and
   * disposal. Used by `show()` and by the serializer that restores a panel
   * after a window reload.
   */
  private bindPanel(panel: vscode.WebviewPanel, docUri: vscode.Uri): Preview {
    const preview: Preview = { panel, docUri, ready: false, pending: undefined };
    this.preview = preview;
    panel.webview.onDidReceiveMessage((msg: { type?: string; name?: unknown }) => {
      if (msg && msg.type === 'ready') {
        preview.ready = true;
        this.post({ type: 'theme', name: this.selectedTheme() });
        if (preview.pending) {
          void panel.webview.postMessage(preview.pending);
          preview.pending = undefined;
        }
      } else if (msg && msg.type === 'setTheme') {
        void this.setTheme(msg.name);
      }
    });
    panel.onDidDispose(() => {
      if (this.debounce) clearTimeout(this.debounce);
      this.debounce = undefined;
      if (this.preview === preview) this.preview = undefined;
    });
    return preview;
  }

  /** Post to the webview now if it is ready, else stash the latest message. */
  private post(message: WebviewMessage): void {
    const preview = this.preview;
    if (!preview) return;
    if (preview.ready) {
      void preview.panel.webview.postMessage(message);
    } else {
      preview.pending = message; // coalesce — only the latest render matters
    }
  }

  /** Restore a preview panel after a window reload (WebviewPanelSerializer). */
  async restore(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    panel.webview.html = shellHtml(panel.webview, 'Triton', this.selectedTheme());
    const docUri =
      state && typeof state === 'object' && typeof (state as { docUri?: unknown }).docUri === 'string'
        ? (state as { docUri: string }).docUri
        : undefined;
    if (!docUri) return; // webview repaints its last SVG from getState()
    const uri = vscode.Uri.parse(docUri);
    this.bindPanel(panel, uri);
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await this.renderInto(doc, 'explicit');
    } catch {
      // Document no longer available; the webview keeps its restored SVG.
    }
  }

  /** Follow the active editor when it switches to another diagram document. */
  private onActiveEditor(editor: vscode.TextEditor | undefined): void {
    if (!this.preview || !editor) return; // nothing open, or focus moved to the webview
    const doc = editor.document;
    if (doc.uri.toString() === this.preview.docUri.toString()) return;
    if (!isDiagramDoc(doc, readConfig())) return; // keep the last diagram on screen
    this.preview.docUri = doc.uri;
    this.preview.panel.title = `Triton: ${this.label(doc.uri)}`;
    void this.renderInto(doc, 'explicit');
  }

  /** Re-render the current preview when the editor's color theme changes. */
  private onColorThemeChange(): void {
    const preview = this.preview;
    if (!preview) return;
    const editor = vscode.window.activeTextEditor;
    const doc =
      editor && editor.document.uri.toString() === preview.docUri.toString()
        ? editor.document
        : vscode.workspace.textDocuments.find((d) => d.uri.toString() === preview.docUri.toString());
    if (doc) void this.renderInto(doc, 'explicit');
  }

  private onDocChange(doc: vscode.TextDocument): void {
    if (!this.preview) return;
    if (doc.uri.toString() !== this.preview.docUri.toString()) return;

    const { debounceMs } = readConfig();
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      void this.renderInto(doc, 'explicit');
    }, Math.max(0, debounceMs));
  }

  private selectedTheme(): string {
    const stored = this.context.workspaceState.get<string>(PREVIEW_THEME_KEY, '');
    return themePresetNames.includes(stored) ? stored : '';
  }

  private normalizeThemeName(name: unknown): string {
    return typeof name === 'string' && themePresetNames.includes(name) ? name : '';
  }

  private async setTheme(name: unknown): Promise<void> {
    const selected = this.normalizeThemeName(name);
    await this.context.workspaceState.update(PREVIEW_THEME_KEY, selected);
    this.post({ type: 'theme', name: selected });

    const preview = this.preview;
    if (!preview) return;
    const editor = vscode.window.activeTextEditor;
    const doc =
      editor && editor.document.uri.toString() === preview.docUri.toString()
        ? editor.document
        : vscode.workspace.textDocuments.find((d) => d.uri.toString() === preview.docUri.toString());
    if (doc) await this.renderInto(doc, 'explicit');
  }

  private themeArgs(): { readonly themeInput: ThemeInput; readonly forcedThemeName: string | undefined } {
    const selected = this.selectedTheme();
    if (selected) {
      return {
        themeInput: { palette: { background: '' } },
        forcedThemeName: selected,
      };
    }
    return {
      themeInput: editorThemeInput(),
      forcedThemeName: undefined,
    };
  }

  private async renderInto(doc: vscode.TextDocument, mode: RenderMode): Promise<void> {
    const preview = this.preview;
    if (!preview) return;

    const config = readConfig();

    // Markdown documents render ALL eligible fenced blocks, stacked. This uses
    // the synchronous render path (renderSync, via renderFencedBlock) so there's
    // no await race with concurrent edits.
    if (isMarkdownDoc(doc)) {
      this.renderMarkdownInto(doc, config, mode);
      return;
    }

    const renderable = pickRenderable(doc, config, mode);
    if (!renderable) {
      this.post({
        type: 'error',
        message:
          'Nothing to preview here. Triton previews `.triton` files, ```triton fences, ' +
          'and (with the command, or with triton.enableMermaid) Mermaid content.',
      });
      return;
    }

    // compileAndRenderSync returns a clean SVG plus the anchor registry.
    // Anchors travel as a separate JSON payload so the SVG string is byte-
    // identical to renderSync output — safe to inject via innerHTML under CSP.
    const { themeInput, forcedThemeName } = this.themeArgs();
    const result = compileAndRenderSync(renderable.text, themeInput, 'svg', forcedThemeName);
    // The active document may have changed while we were processing; only post
    // if the preview is still bound to the document we rendered.
    if (!this.preview || this.preview.docUri.toString() !== doc.uri.toString()) return;
    if (result.ok) {
      this.post({ type: 'svg', svg: result.value.svg, anchors: JSON.stringify(result.value.anchors), docUri: doc.uri.toString(), doc: false });
    } else {
      this.post({ type: 'error', message: `[${result.error.code}] ${result.error.message}` });
    }
  }

  /**
   * Render every ```triton (and, per the coexistence rule, ```mermaid) fenced
   * block in a Markdown document, stacked top-to-bottom and labelled when there
   * is more than one. Fully synchronous (renderSync under the hood), so no
   * stale-document guard is needed.
   */
  private renderMarkdownInto(doc: vscode.TextDocument, config: PreviewConfig, mode: RenderMode): void {
    const preview = this.preview;
    if (!preview) return;

    // ```triton is always ours; ```mermaid joins it under the explicit command
    // OR when triton.enableMermaid is on (mirrors pickRenderable's gate).
    const langs = new Set<string>(['triton']);
    if (mode === 'explicit' || config.enableMermaid) langs.add('mermaid');

    const blocks = extractFencedBlocks(doc.getText(), langs);
    if (blocks.length === 0) {
      this.post({
        type: 'error',
        message: 'No ```triton (or ```mermaid) blocks found in this Markdown document.',
      });
      return;
    }

    const baseDir = doc.uri.scheme === 'file' ? dirname(doc.uri.fsPath) : undefined;
    const { themeInput, forcedThemeName } = this.themeArgs();
    const html = blocks
      .map((b, i) =>
        labelBlock(i, blocks.length, b.lang, renderFencedBlock(b.body, baseDir, themeInput, forcedThemeName)),
      )
      .join('\n');

    this.post({ type: 'svg', svg: html, docUri: doc.uri.toString(), doc: true });
  }

  private label(uri: vscode.Uri): string {
    const path = uri.path;
    const slash = path.lastIndexOf('/');
    return slash >= 0 ? path.slice(slash + 1) : path;
  }

  dispose(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = undefined;
    if (this.preview) this.preview.panel.dispose();
    this.preview = undefined;
    for (const d of this.disposables) d.dispose();
  }
}

// ─── Activation ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): { extendMarkdownIt(md: unknown): unknown } {
  const manager = new PreviewManager(context);

  context.subscriptions.push(manager);

  // Phase 3 — IntelliSense: diagram-header + per-kind keyword completion, plus
  // live parse/render diagnostics. Both are self-contained and disposable.
  registerCompletion(context);
  registerDiagnostics(context);

  // Keep the markdown-it fallback baseDir pointed at the current Markdown file's
  // folder, so relative `file:` embeds resolve in the built-in preview (whose
  // markdown-it `env` usually omits the document path).
  const updateBaseDir = (editor: vscode.TextEditor | undefined): void => {
    const doc = editor?.document;
    if (doc && isMarkdownDoc(doc) && doc.uri.scheme === 'file') {
      setMarkdownBaseDir(dirname(doc.uri.fsPath));
    }
  };
  updateBaseDir(vscode.window.activeTextEditor);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => updateBaseDir(e)),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('triton.openPreview', () => {
      manager.show(vscode.window.activeTextEditor, vscode.ViewColumn.Active);
    }),
    vscode.commands.registerCommand('triton.openPreviewToSide', () => {
      manager.show(vscode.window.activeTextEditor, vscode.ViewColumn.Beside);
    }),
    // Reclaim and re-render the preview panel after a window reload, so the
    // diagram redraws from the live document (Mermaid included) instead of
    // showing only the webview's last restored paint.
    vscode.window.registerWebviewPanelSerializer('tritonPreview', {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown) {
        await manager.restore(panel, state);
      },
    }),
  );

  // Contributed to the built-in Markdown preview (contributes.markdown.
  // markdownItPlugins). Overrides the fence renderer so ```triton (always) and
  // ```mermaid (when triton.enableMermaid) blocks compile to inline SVG.
  return {
    extendMarkdownIt(md: unknown): unknown {
      return extendMarkdownIt(md as Parameters<typeof extendMarkdownIt>[0]);
    },
  };
}

export function deactivate(): void {
  // Subscriptions (incl. the PreviewManager) are disposed by VS Code.
}
