import * as vscode from 'vscode';
import type { ThemeInput } from '../../src/contracts/index.js';

/**
 * Build a ThemeInput overlay so diagrams blend with the VS Code preview the way
 * Mermaid does: the canvas background is made transparent (empty `background`
 * makes renderSVG skip the full-canvas rect). On a dark/high-contrast editor we
 * also swap to a dark-friendly palette so free-floating text and edges — which
 * sit directly on the now-transparent canvas — stay readable. On a light editor
 * the default palette already suits, so only the background is cleared.
 */
export function editorThemeInput(): ThemeInput {
  const kind = vscode.window.activeColorTheme.kind;
  const dark =
    kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;

  if (dark) {
    return {
      palette: {
        background: '', // transparent — blend with the editor
        surface: '#1E293B', // dark node fills
        border: '#475569',
        text: '#E2E8F0', // light text + edges
        textMuted: '#94A3B8',
      },
    };
  }
  return { palette: { background: '' } };
}
