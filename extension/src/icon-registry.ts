/**
 * IconRegistry — extension/src/icon-registry.ts
 *
 * Discovers and live-reloads external `.triton-icons.json` files from each
 * workspace folder's `.triton/icons/` directory.
 *
 * Mirrors ThemeRegistry exactly — multi-root scan, per-folder FileSystemWatcher,
 * last-scanned-wins on duplicate prefix, onDidChange event, vscode.Disposable.
 *
 * - Holds a merged IconPackMap (Map<prefix, IconifyJSON>) of loaded icon packs.
 * - Refreshes on file create/change/delete via per-folder FileSystemWatcher.
 * - Refreshes and rebuilds watchers on workspace folder changes.
 * - Fires `onDidChange` after each refresh so consumers can re-render.
 * - Surfaces warnings via a shared output channel plus a deduped VS Code popup.
 */

import * as vscode from 'vscode';
import { join } from 'path';
import type { IconPackMap } from '../../src/contracts/icons.js';
import { discoverIconPacks } from '../../src/icons/discover.js';

export class IconRegistry implements vscode.Disposable {
  // ─── State ────────────────────────────────────────────────────────────────

  private readonly mergedPacks: Map<string, import('../../src/contracts/icons.js').IconifyJSON> = new Map();
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
    this.outputChannel = vscode.window.createOutputChannel('Triton Icons');

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

  /** The current merged IconPackMap across all workspace folders. */
  iconPacks(): IconPackMap {
    return this.mergedPacks;
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  /**
   * Scan all workspace folders' `.triton/icons/` directories and rebuild the
   * merged icon pack map. Fires `onDidChange` afterwards.
   */
  refresh(): void {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const merged: Map<string, import('../../src/contracts/icons.js').IconifyJSON> = new Map();
    const allWarnings: string[] = [];

    for (const folder of folders) {
      const dir = join(folder.uri.fsPath, '.triton', 'icons');
      const { map, warnings } = discoverIconPacks(dir);

      // Union across folders; duplicate prefix → last wins + warning
      for (const [prefix, pack] of map) {
        if (merged.has(prefix)) {
          allWarnings.push(
            `Duplicate icon pack prefix "${prefix}" found across workspace folders; last-scanned wins`,
          );
        }
        merged.set(prefix, pack);
      }

      allWarnings.push(...warnings);
    }

    // Replace merged map
    this.mergedPacks.clear();
    for (const [prefix, pack] of merged) {
      this.mergedPacks.set(prefix, pack);
    }

    // Surface warnings
    if (allWarnings.length > 0) {
      this.outputChannel.appendLine(`[Triton Icons] Refresh @ ${new Date().toISOString()}`);
      for (const w of allWarnings) {
        this.outputChannel.appendLine(`  ⚠ ${w}`);
      }

      // Show VS Code warning message once per unique warning, dedupe across refreshes
      const newWarnings = allWarnings.filter(w => !this.lastWarnSet.has(w));
      if (newWarnings.length > 0) {
        const summary =
          newWarnings.length === 1
            ? newWarnings[0]
            : `${newWarnings.length} icon pack warnings — see "Triton Icons" output channel`;
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
      const pattern = new vscode.RelativePattern(folder, '.triton/icons/*.triton-icons.json');
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
