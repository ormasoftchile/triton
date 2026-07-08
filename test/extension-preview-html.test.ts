import { describe, expect, it } from 'vitest';
import { shellHtml } from '../extension/src/preview-html.js';
import { themePresetNames } from '../src/theme/preset.js';

describe('preview webview shell HTML', () => {
  it('renders the theme dropdown with Auto and all preset options', () => {
    const html = shellHtml({ cspSource: 'vscode-resource:' }, 'Preview', 'minimal');

    expect(html).toContain('<label for="theme">Theme</label>');
    expect(html).toContain('<select id="theme"');
    expect(html).toContain('<option value="">Auto</option>');
    for (const name of themePresetNames) {
      expect(html).toContain(`<option value="${name}"${name === 'minimal' ? ' selected' : ''}>${name}</option>`);
    }
  });

  it('posts setTheme when the dropdown changes', () => {
    const html = shellHtml({ cspSource: 'vscode-resource:' }, 'Preview');

    expect(html).toContain("vscodeApi.postMessage({ type: 'setTheme', name: themeSelect.value })");
  });
});
