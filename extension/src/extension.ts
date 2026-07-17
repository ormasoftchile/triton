import * as vscode from 'vscode';
import { basename, dirname } from 'path';
import type { ThemeInput } from '../../src/contracts/index.js';
// The Triton compiler is imported by RELATIVE PATH (the repo has no package
// `main`/`exports`, so `import 'triton'` is impossible). esbuild bundles this
// whole graph into a single CJS file; its `.js`→`.ts` resolve plugin follows
// the NodeNext `.js` specifier below into `src/frontend/index.ts`.
import { compileAndRenderSync, compileAndRenderWithThemeSync } from '../../src/frontend/index.js';
import { ExportCancelledError, exportAnimatedPng, exportStaticPng, initExportWasm } from '../../src/export/index.js';
import { resolveThemeFont, type ResolvedThemeFont } from '../../src/export/fonts.js';
import { themePresetNames } from '../../src/theme/preset.js';
import { extendMarkdownIt, extractFencedBlocks, renderFencedBlock, setMarkdownBaseDir } from './markdown.js';
import { editorThemeInput } from './editor-theme.js';
import { registerCompletion } from './completion.js';
import { registerDiagnostics } from './diagnostics.js';
import { shellHtml } from './preview-html.js';
import { ThemeRegistry } from './theme-registry.js';
import { IconRegistry } from './icon-registry.js';

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
const DEFAULT_ANIMATED_EXPORT: AnimatedExportConfig = {
  fps: 60,
  speed: 1,
  motionBlurSamples: 8,
  shutter: 0.75,
};

interface Renderable {
  /** The diagram source text to feed to `render()`. */
  readonly text: string;
}

interface PreviewConfig {
  readonly enableMermaid: boolean;
  readonly debounceMs: number;
  readonly animatedExport: AnimatedExportConfig;
}

interface AnimatedExportConfig {
  readonly fps: number;
  readonly speed: number;
  readonly motionBlurSamples: number;
  readonly shutter: number;
}

function readConfig(): PreviewConfig {
  const cfg = vscode.workspace.getConfiguration('triton');
  return {
    enableMermaid: cfg.get<boolean>('enableMermaid', false),
    debounceMs: cfg.get<number>('preview.debounceMs', 150),
    animatedExport: {
      fps: cfg.get<number>('export.animated.fps', DEFAULT_ANIMATED_EXPORT.fps),
      speed: cfg.get<number>('export.animated.speed', DEFAULT_ANIMATED_EXPORT.speed),
      motionBlurSamples: cfg.get<number>('export.animated.motionBlurSamples', DEFAULT_ANIMATED_EXPORT.motionBlurSamples),
      shutter: cfg.get<number>('export.animated.shutter', DEFAULT_ANIMATED_EXPORT.shutter),
    },
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
  | { readonly type: 'svg'; readonly svg: string; readonly anchors?: string; readonly docUri: string; readonly doc: boolean }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'theme'; readonly name: string }
  | { readonly type: 'themeOptions'; readonly builtins: readonly string[]; readonly custom: readonly string[]; readonly selected: string };

class PreviewManager {
  // A single live preview that FOLLOWS the active editor, like the built-in
  // Markdown preview. Switching to another diagram file re-points it; switching
  // to a non-diagram file leaves the last diagram untouched.
  private preview: Preview | undefined;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private exportWasmPromise: Promise<void> | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly registry: ThemeRegistry;
  private readonly iconRegistry: IconRegistry;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.registry = new ThemeRegistry();
    this.iconRegistry = new IconRegistry();
    context.subscriptions.push(this.registry);
    context.subscriptions.push(this.iconRegistry);

    // Build watchers and do initial discovery
    this.registry.buildWatchers();
    this.registry.refresh();
    this.iconRegistry.buildWatchers();
    this.iconRegistry.refresh();

    // When themes change: refresh dropdown + re-render; drop vanished selection
    this.disposables.push(
      this.registry.onDidChange(() => this.onThemeRegistryChange()),
    );

    // When icon packs change: re-render so the new icons are picked up immediately
    this.disposables.push(
      this.iconRegistry.onDidChange(() => this.onIconRegistryChange()),
    );

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
      panel.webview.html = shellHtml(panel.webview, this.label(doc.uri), this.selectedTheme(), this.registry.customNames());
      this.bindPanel(panel, doc.uri);
    } else {
      this.preview.docUri = doc.uri;
      this.preview.panel.title = `Triton: ${this.label(doc.uri)}`;
      this.preview.panel.reveal(column, true);
    }

    void this.renderInto(doc, 'explicit');
  }

  async exportSvg(resource?: vscode.Uri): Promise<void> {
    try {
      await this.exportToSibling(resource, 'svg');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Triton: export failed: ${message}`);
    }
  }

  async exportPng(resource?: vscode.Uri): Promise<void> {
    try {
      await this.exportToSibling(resource, 'png');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Triton: export failed: ${message}`);
    }
  }

  async exportAnimated(resource?: vscode.Uri): Promise<void> {
    try {
      const prepared = await this.prepareExport(resource, 'exporting animated PNG');
      if (!prepared) return;
      await this.ensureExportWasm();
      const fonts = await this.resolveExportFonts(prepared.fontFamily);
      const outputUri = this.animatedExportOutputUri(prepared.doc.uri);
      const options = readConfig().animatedExport;
      const png = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, cancellable: true, title: 'Exporting animated PNG…' },
        async (progress, token) => {
          const controller = new AbortController();
          const disposable = token.onCancellationRequested(() => controller.abort());
          let reported = 0;
          try {
            return await exportAnimatedPng(prepared.svg, {
              ...options,
              fonts,
              signal: controller.signal,
              onProgress: (framesDone, frameTotal) => {
                const next = frameTotal > 0 ? (framesDone / frameTotal) * 100 : 100;
                progress.report({ increment: Math.max(0, next - reported), message: `frame ${framesDone}/${frameTotal}` });
                reported = next;
              },
            });
          } finally {
            disposable.dispose();
          }
        },
      );
      await vscode.workspace.fs.writeFile(outputUri, png);
      await this.showExported(outputUri);
    } catch (err) {
      if (err instanceof ExportCancelledError) {
        void vscode.window.showInformationMessage('Animated export cancelled');
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Triton: export failed: ${message}`);
    }
  }

  async exportAs(resource?: vscode.Uri): Promise<void> {
    try {
      const prepared = await this.prepareExport(resource, 'using Export As');
      if (!prepared) return;

      const { outputUri: defaultUri } = this.exportOutputUri(prepared.doc.uri, 'svg');
      const target = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
          'SVG image': ['svg'],
          'PNG image': ['png'],
        },
      });
      if (!target) return;

      const extension = extname(target);
      if (extension !== '.svg' && extension !== '.png') {
        void vscode.window.showErrorMessage('Triton: choose a .svg or .png file name.');
        return;
      }

      await this.writeExport(prepared.svg, target, extension === '.png' ? 'png' : 'svg', prepared.fontFamily);
      await this.showExported(target);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Triton: export failed: ${message}`);
    }
  }

  private async exportToSibling(resource: vscode.Uri | undefined, format: 'svg' | 'png'): Promise<void> {
    const prepared = await this.prepareExport(resource, `exporting ${format.toUpperCase()}`);
    if (!prepared) return;
    const { outputUri } = this.exportOutputUri(prepared.doc.uri, format);
    await this.writeExport(prepared.svg, outputUri, format, prepared.fontFamily);
    await this.showExported(outputUri);
  }

  private async prepareExport(
    resource: vscode.Uri | undefined,
    action: string,
  ): Promise<{ readonly doc: vscode.TextDocument; readonly svg: string; readonly fontFamily: string } | undefined> {
    const doc = await this.exportDocument(resource);
    if (!doc) {
      void vscode.window.showInformationMessage('Triton: open a .triton or .mmd diagram first, then export.');
      return undefined;
    }
    if (doc.uri.scheme === 'untitled') {
      void vscode.window.showInformationMessage(`Triton: save the diagram file before ${action}.`);
      return undefined;
    }

    const rendered = this.renderExportSvg(doc);
    return rendered == null ? undefined : { doc, ...rendered };
  }

  private renderExportSvg(doc: vscode.TextDocument): { readonly svg: string; readonly fontFamily: string } | undefined {
    const renderable = pickRenderable(doc, readConfig(), 'explicit');
    if (!renderable) {
      void vscode.window.showInformationMessage('Triton: no exportable diagram found in the active document.');
      return undefined;
    }

    const { themeInput, forcedThemeName } = this.themeArgs();
    const result = compileAndRenderWithThemeSync(renderable.text, themeInput, 'svg', forcedThemeName, this.iconRegistry.iconPacks());
    if (!result.ok) {
      void vscode.window.showErrorMessage(`Triton: export failed: [${result.error.code}] ${result.error.message}`);
      return undefined;
    }
    return { svg: result.value.svg, fontFamily: result.value.theme.typography.fontFamily };
  }

  private async writeExport(svg: string, outputUri: vscode.Uri, format: 'svg' | 'png', fontFamily: string): Promise<void> {
    if (format === 'svg') {
      await vscode.workspace.fs.writeFile(outputUri, Buffer.from(svg, 'utf8'));
      return;
    }
    await this.ensureExportWasm();
    const fonts = await this.resolveExportFonts(fontFamily);
    const png = await exportStaticPng(svg, { fonts });
    await vscode.workspace.fs.writeFile(outputUri, png);
  }

  private async resolveExportFonts(fontFamily: string): Promise<ResolvedThemeFont | undefined> {
    const fonts = await resolveThemeFont(fontFamily);
    if (!fonts) {
      console.warn(`Triton: could not resolve theme font for PNG export: ${fontFamily}`);
    }
    return fonts;
  }

  private ensureExportWasm(): Promise<void> {
    this.exportWasmPromise ??= vscode.workspace.fs
      .readFile(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'index_bg.wasm'))
      .then(bytes => initExportWasm(bytes));
    return this.exportWasmPromise;
  }

  private async showExported(outputUri: vscode.Uri): Promise<void> {
    const outputName = basename(outputUri.scheme === 'file' ? outputUri.fsPath : outputUri.path);
    const reveal =
      process.platform === 'darwin' ? 'Reveal in Finder' : process.platform === 'win32' ? 'Reveal in Explorer' : 'Reveal in File Manager';
    const action = await vscode.window.showInformationMessage(`Exported ${outputName}`, 'Open', reveal);
    if (action === 'Open') {
      await vscode.commands.executeCommand('vscode.open', outputUri);
    } else if (action === reveal) {
      await vscode.commands.executeCommand('revealFileInOS', outputUri);
    }
  }

  private async exportDocument(resource?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
    const config = readConfig();
    if (resource) {
      const doc = await vscode.workspace.openTextDocument(resource);
      if (isDiagramDoc(doc, config)) return doc;
    }

    const active = vscode.window.activeTextEditor?.document;
    if (active && isDiagramDoc(active, config)) return active;

    const preview = this.preview;
    if (!preview) return undefined;
    const existing = vscode.workspace.textDocuments.find((d) => d.uri.toString() === preview.docUri.toString());
    const doc = existing ?? (await vscode.workspace.openTextDocument(preview.docUri));
    return isDiagramDoc(doc, config) ? doc : undefined;
  }

  private animatedExportOutputUri(source: vscode.Uri): vscode.Uri {
    const sourcePath = source.scheme === 'file' ? source.fsPath : source.path;
    const sourceName = basename(sourcePath);
    const sourceExt = extname(source);
    const outputBase = sourceExt && sourceName.toLowerCase().endsWith(sourceExt) ? sourceName.slice(0, -sourceExt.length) : sourceName;
    const outputName = `${outputBase}.animated.png`;
    if (source.scheme === 'file') {
      return vscode.Uri.joinPath(vscode.Uri.file(dirname(source.fsPath)), outputName);
    }
    const slash = source.path.lastIndexOf('/');
    const dir = source.with({ path: slash >= 0 ? source.path.slice(0, slash) || '/' : '/', query: '', fragment: '' });
    return vscode.Uri.joinPath(dir, outputName);
  }

  private exportOutputUri(source: vscode.Uri, format: 'svg' | 'png'): { readonly outputName: string; readonly outputUri: vscode.Uri } {
    const sourcePath = source.scheme === 'file' ? source.fsPath : source.path;
    const sourceName = basename(sourcePath);
    const sourceExt = extname(source);
    const outputBase = sourceExt && sourceName.toLowerCase().endsWith(sourceExt) ? sourceName.slice(0, -sourceExt.length) : sourceName;
    const outputName = `${outputBase}.${format}`;
    if (source.scheme === 'file') {
      return { outputName, outputUri: vscode.Uri.joinPath(vscode.Uri.file(dirname(source.fsPath)), outputName) };
    }
    const slash = source.path.lastIndexOf('/');
    const dir = source.with({ path: slash >= 0 ? source.path.slice(0, slash) || '/' : '/', query: '', fragment: '' });
    return { outputName, outputUri: vscode.Uri.joinPath(dir, outputName) };
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
    panel.webview.html = shellHtml(panel.webview, 'Triton', this.selectedTheme(), this.registry.customNames());
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

  /**
   * Called when the theme registry fires onDidChange (file watcher or workspace
   * folder change). Pushes fresh theme options to the webview, resets a vanished
   * selection, and re-renders the active diagram.
   */
  private onThemeRegistryChange(): void {
    const preview = this.preview;
    if (!preview) return;

    // If the selected theme no longer exists, fall back to Auto
    const selected = this.selectedTheme();
    const stillValid = selected === '' || this.registry.isKnown(selected);
    if (!stillValid) {
      void this.context.workspaceState.update(PREVIEW_THEME_KEY, '');
      this.post({ type: 'theme', name: '' });
    }

    // Push updated options to the webview (in-place rebuild, no panel teardown)
    this.post({
      type: 'themeOptions',
      builtins: [...themePresetNames],
      custom: this.registry.customNames(),
      selected: stillValid ? selected : '',
    });

    // Re-render the diagram so any live-edited theme colours apply immediately
    const editor = vscode.window.activeTextEditor;
    const doc =
      editor && editor.document.uri.toString() === preview.docUri.toString()
        ? editor.document
        : vscode.workspace.textDocuments.find((d) => d.uri.toString() === preview.docUri.toString());
    if (doc) void this.renderInto(doc, 'explicit');
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

  /** Re-render the current preview when icon packs change (file watcher or workspace folder change). */
  private onIconRegistryChange(): void {
    const preview = this.preview;
    if (!preview) return;
    const editor = vscode.window.activeTextEditor;
    const doc =
      editor && editor.document.uri.toString() === preview.docUri.toString()
        ? editor.document
        : vscode.workspace.textDocuments.find((d) => d.uri.toString() === preview.docUri.toString());
    if (doc) void this.renderInto(doc, 'explicit');
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
    return this.registry.isKnown(stored) ? stored : '';
  }

  private normalizeThemeName(name: unknown): string {
    return typeof name === 'string' && this.registry.isKnown(name) ? name : '';
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
    if (!selected) {
      // Auto — adaptive colors from the editor theme
      return { themeInput: editorThemeInput(), forcedThemeName: undefined };
    }
    if (themePresetNames.includes(selected)) {
      // Built-in preset: pass a transparent background and let core force the preset
      return { themeInput: { palette: { background: '' } }, forcedThemeName: selected };
    }
    const custom = this.registry.resolve(selected);
    if (custom) {
      // External theme: pass the full ResolvedTheme as themeInput; forcedThemeName
      // must be undefined so core doesn't try to look up the name in getThemePreset()
      // (which only knows built-ins). The ResolvedTheme is a structural superset of
      // ThemeInput, so it is directly assignable.
      return { themeInput: custom as ThemeInput, forcedThemeName: undefined };
    }
    // Selected theme vanished (e.g. file deleted) → fall back to Auto
    return { themeInput: editorThemeInput(), forcedThemeName: undefined };
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
    const result = compileAndRenderSync(renderable.text, themeInput, 'svg', forcedThemeName, this.iconRegistry.iconPacks());
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
        labelBlock(i, blocks.length, b.lang, renderFencedBlock(b.body, baseDir, themeInput, forcedThemeName, this.iconRegistry.iconPacks())),
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
    vscode.commands.registerCommand('triton.exportSvg', (resource?: vscode.Uri) => {
      void manager.exportSvg(resource);
    }),
    vscode.commands.registerCommand('triton.exportPng', (resource?: vscode.Uri) => {
      void manager.exportPng(resource);
    }),
    vscode.commands.registerCommand('triton.exportAnimated', (resource?: vscode.Uri) => {
      void manager.exportAnimated(resource);
    }),
    vscode.commands.registerCommand('triton.exportAs', (resource?: vscode.Uri) => {
      void manager.exportAs(resource);
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
