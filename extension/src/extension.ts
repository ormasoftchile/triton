import * as vscode from 'vscode';
// The Triton compiler is imported by RELATIVE PATH (the repo has no package
// `main`/`exports`, so `import 'triton'` is impossible). esbuild bundles this
// whole graph into a single CJS file; its `.js`→`.ts` resolve plugin follows
// the NodeNext `.js` specifier below into `src/frontend/index.ts`.
import { render } from '../../src/frontend/index.js';

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

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shellHtml(webview: vscode.Webview, title: string): string {
  const n = nonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${n}'`,
  ].join('; ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    #stage {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      overflow: auto; padding: 16px; box-sizing: border-box;
    }
    #stage.fit { padding: 0; }
    #content svg { display: block; height: auto; max-width: none; }
    #stage.fit #content svg { max-width: 100%; max-height: 100%; }
    #error {
      position: absolute; left: 0; right: 0; bottom: 0;
      margin: 0; padding: 10px 14px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px; white-space: pre-wrap;
      color: var(--vscode-inputValidation-errorForeground, #fff);
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-top: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      display: none;
    }
    #error.show { display: block; }
    #toolbar {
      position: absolute; top: 8px; right: 8px;
      display: flex; gap: 4px; z-index: 10;
    }
    #toolbar button {
      font: inherit; font-size: 11px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: none; border-radius: 3px;
      padding: 3px 8px; cursor: pointer;
    }
    #toolbar button:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="fit" title="Toggle zoom to fit">Fit</button>
    <button id="reset" title="Actual size">1:1</button>
  </div>
  <div id="stage" class="fit"><div id="content"></div></div>
  <pre id="error"></pre>
  <script nonce="${n}">
    const vscodeApi = acquireVsCodeApi();
    const stage = document.getElementById('stage');
    const content = document.getElementById('content');
    const errorBox = document.getElementById('error');

    document.getElementById('fit').addEventListener('click', () => stage.classList.add('fit'));
    document.getElementById('reset').addEventListener('click', () => stage.classList.remove('fit'));

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'svg') {
        content.innerHTML = msg.svg;
        errorBox.classList.remove('show');
        vscodeApi.setState({ svg: msg.svg });
      } else if (msg.type === 'error') {
        // Keep the last good SVG visible; show the error as a non-destructive banner.
        errorBox.textContent = msg.message;
        errorBox.classList.add('show');
      }
    });

    const prev = vscodeApi.getState();
    if (prev && prev.svg) content.innerHTML = prev.svg;
  </script>
</body>
</html>`;
}

// ─── Preview manager ───────────────────────────────────────────────────────────

interface Preview {
  readonly panel: vscode.WebviewPanel;
  readonly docUri: vscode.Uri;
}

class PreviewManager {
  private readonly previews = new Map<string, Preview>();
  private readonly debouncers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocChange(e.document)),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        // If the source document is gone there is nothing left to live-update.
        const p = this.previews.get(doc.uri.toString());
        if (p) p.panel.title = `Triton (closed): ${this.label(doc.uri)}`;
      }),
    );
  }

  /** Open or reveal a preview for the active editor's document. */
  show(editor: vscode.TextEditor | undefined, column: vscode.ViewColumn): void {
    if (!editor) {
      void vscode.window.showInformationMessage('Triton: open a file first, then run the preview.');
      return;
    }
    const doc = editor.document;
    const key = doc.uri.toString();
    const existing = this.previews.get(key);
    if (existing) {
      existing.panel.reveal(column, false);
      void this.renderInto(existing, doc, 'explicit');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'tritonPreview',
      `Triton: ${this.label(doc.uri)}`,
      { viewColumn: column, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] },
    );
    panel.webview.html = shellHtml(panel.webview, this.label(doc.uri));

    const preview: Preview = { panel, docUri: doc.uri };
    this.previews.set(key, preview);

    panel.onDidDispose(() => {
      this.previews.delete(key);
      const t = this.debouncers.get(key);
      if (t) clearTimeout(t);
      this.debouncers.delete(key);
    });

    void this.renderInto(preview, doc, 'explicit');
  }

  private onDocChange(doc: vscode.TextDocument): void {
    const key = doc.uri.toString();
    const preview = this.previews.get(key);
    if (!preview) return; // only update documents that have an open preview

    const { debounceMs } = readConfig();
    const prev = this.debouncers.get(key);
    if (prev) clearTimeout(prev);
    this.debouncers.set(
      key,
      setTimeout(() => {
        this.debouncers.delete(key);
        // An already-open preview keeps live-updating (explicit intent).
        void this.renderInto(preview, doc, 'explicit');
      }, Math.max(0, debounceMs)),
    );
  }

  private async renderInto(
    preview: Preview,
    doc: vscode.TextDocument,
    mode: RenderMode,
  ): Promise<void> {
    const config = readConfig();
    const renderable = pickRenderable(doc, config, mode);
    if (!renderable) {
      void preview.panel.webview.postMessage({
        type: 'error',
        message:
          'Nothing to preview here. Triton previews `.triton` files, ```triton fences, ' +
          'and (with the command, or with triton.enableMermaid) Mermaid content.',
      });
      return;
    }

    // render() returns a Result<string> and never throws.
    const result = await render(renderable.text);
    if (result.ok) {
      void preview.panel.webview.postMessage({ type: 'svg', svg: result.value });
    } else {
      void preview.panel.webview.postMessage({
        type: 'error',
        message: `[${result.error.code}] ${result.error.message}`,
      });
    }
  }

  private label(uri: vscode.Uri): string {
    const path = uri.path;
    const slash = path.lastIndexOf('/');
    return slash >= 0 ? path.slice(slash + 1) : path;
  }

  dispose(): void {
    for (const t of this.debouncers.values()) clearTimeout(t);
    this.debouncers.clear();
    for (const p of this.previews.values()) p.panel.dispose();
    this.previews.clear();
    for (const d of this.disposables) d.dispose();
  }
}

// ─── Activation ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  const manager = new PreviewManager();
  context.subscriptions.push(manager);

  context.subscriptions.push(
    vscode.commands.registerCommand('triton.openPreview', () => {
      manager.show(vscode.window.activeTextEditor, vscode.ViewColumn.Active);
    }),
    vscode.commands.registerCommand('triton.openPreviewToSide', () => {
      manager.show(vscode.window.activeTextEditor, vscode.ViewColumn.Beside);
    }),
  );
}

export function deactivate(): void {
  // Subscriptions (incl. the PreviewManager) are disposed by VS Code.
}
