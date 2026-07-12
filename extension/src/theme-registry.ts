/**
 * ThemeRegistry — extension/src/theme-registry.ts
 *
 * Discovers and live-reloads external `.triton-theme.json` files from each
 * workspace folder's `.triton/themes/` directory.
 *
 * - Holds a Map<string, ResolvedTheme> of CUSTOM (non-built-in) themes.
 * - Refreshes on file create/change/delete via per-folder FileSystemWatcher.
 * - Refreshes and rebuilds watchers on workspace folder changes.
 * - Fires `onDidChange` after each refresh so PreviewManager can re-render.
 * - Surfaces warnings via a shared output channel (one log per refresh cycle)
 *   plus a single VS Code warning message when warnings appear (deduped).
 */

import * as vscode from 'vscode';
import { join } from 'path';
import type { ResolvedTheme } from '../../src/contracts/index.js';
import { themePresetNames } from '../../src/theme/preset.js';
import { discoverThemes } from '../../src/theme/discover.js';

export class ThemeRegistry implements vscode.Disposable {
  // ─── State ────────────────────────────────────────────────────────────────

  private readonly customThemes = new Map<string, ResolvedTheme>();
  private readonly watchers: vscode.Disposable[] = [];
  private readonly disposables: vscode.Disposable[] = [];

  /** Warnings emitted during the last refresh — used to dedupe VS Code popups. */
  private lastWarnSet = new Set<string>();

  private readonly outputChannel: vscode.OutputChannel;

  // ─── Event ────────────────────────────────────────────────────────────────

  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this.changeEmitter.event;

  // ─── Construction ─────────────────────────────────────────────────────────

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Triton Themes');

    // Rebuild watchers + refresh when folders are added/removed
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.rebuildWatchers();
        this.refresh();
      }),
      this.outputChannel,
      this.changeEmitter,
    );
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Names of all CUSTOM (external) themes currently loaded. */
  customNames(): string[] {
    return Array.from(this.customThemes.keys());
  }

  /** Names of ALL known themes: built-in presets ∪ custom. */
  allNames(): string[] {
    return [...themePresetNames, ...this.customNames()];
  }

  /**
   * Resolve a custom theme by name.
   * Returns undefined for built-in presets or unknown names.
   */
  resolve(name: string): ResolvedTheme | undefined {
    return this.customThemes.get(name);
  }

  /** True if `name` is either a built-in preset or a loaded custom theme. */
  isKnown(name: string): boolean {
    return themePresetNames.includes(name) || this.customThemes.has(name);
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  /**
   * Scan all workspace folders' `.triton/themes/` directories and rebuild the
   * custom theme map. Fires `onDidChange` afterwards.
   */
  refresh(): void {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const merged = new Map<string, ResolvedTheme>();
    const allWarnings: string[] = [];

    for (const folder of folders) {
      const dir = join(folder.uri.fsPath, '.triton', 'themes');
      const { themes, warnings } = discoverThemes(dir);

      // Union across folders; duplicate custom name → last wins + warning
      for (const [name, theme] of themes) {
        if (merged.has(name)) {
          allWarnings.push(
            `Duplicate external theme name "${name}" found across workspace folders; last-scanned wins`,
          );
        }
        merged.set(name, theme);
      }

      allWarnings.push(...warnings);
    }

    // Replace custom map
    this.customThemes.clear();
    for (const [name, theme] of merged) {
      this.customThemes.set(name, theme);
    }

    // Surface warnings
    if (allWarnings.length > 0) {
      this.outputChannel.appendLine(`[Triton Themes] Refresh @ ${new Date().toISOString()}`);
      for (const w of allWarnings) {
        this.outputChannel.appendLine(`  ⚠ ${w}`);
      }

      // Show VS Code warning message once per unique warning, dedupe across refreshes
      const newWarnings = allWarnings.filter(w => !this.lastWarnSet.has(w));
      if (newWarnings.length > 0) {
        const summary =
          newWarnings.length === 1
            ? newWarnings[0]
            : `${newWarnings.length} theme warnings — see "Triton Themes" output channel`;
        void vscode.window.showWarningMessage(`Triton: ${summary}`);
        this.lastWarnSet = new Set(allWarnings);
      }
    } else {
      this.lastWarnSet.clear();
    }

    this.changeEmitter.fire();
  }

  // ─── Watchers ─────────────────────────────────────────────────────────────

  /** Create one FileSystemWatcher per workspace folder and start initial refresh. */
  buildWatchers(): void {
    this.rebuildWatchers();
  }

  private rebuildWatchers(): void {
    // Dispose existing watchers
    for (const w of this.watchers) w.dispose();
    this.watchers.length = 0;

    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const pattern = new vscode.RelativePattern(folder, '.triton/themes/*.triton-theme.json');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      const onEvent = (): void => {
        this.refresh();
      };

      watcher.onDidCreate(onEvent);
      watcher.onDidChange(onEvent);
      watcher.onDidDelete(onEvent);

      this.watchers.push(watcher);
    }
  }

  // ─── Disposal ─────────────────────────────────────────────────────────────

  dispose(): void {
    for (const w of this.watchers) w.dispose();
    this.watchers.length = 0;
    for (const d of this.disposables) d.dispose();
  }
}
