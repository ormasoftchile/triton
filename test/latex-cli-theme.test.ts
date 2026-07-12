/**
 * test/latex-cli-theme.test.ts
 *
 * Unit tests for the resolveCliTheme() resolution contract (Phase 4).
 *
 * Strategy:
 *  - Import resolveCliTheme() from latex/src/theme-resolve.ts — NOT from
 *    cli.ts. theme-resolve.ts imports ONLY Node built-ins and ../../src/**
 *    (Triton core). It has zero dependency on ./pdf.ts or any latex-only
 *    package (pdfkit, svg-to-pdfkit), so these tests run cleanly at root
 *    `pnpm test` time even when latex/node_modules is not installed and
 *    latex/dist/cli.cjs does not exist.
 *  - The acme-demo fixture has primary: #6C3FC5 — distinctive purple absent
 *    from all built-in presets — so checking palette.primary is conclusive.
 *  - resolveCliTheme() throws (not calls process.exit) on a bad --theme-file,
 *    so the error path is testable with a plain expect().toThrow().
 *
 * Fixtures:
 *   examples/.triton/themes/acme-demo.triton-theme.json  (primary #6C3FC5)
 */

import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';

// Import from the core-only module — no pdfkit/pdf.ts in the import graph.
import { resolveCliTheme } from '../latex/src/theme-resolve.js';

const ROOT = resolve(__dirname, '..');
const ACME_THEME = join(ROOT, 'examples', '.triton', 'themes', 'acme-demo.triton-theme.json');
const THEMES_DIR = join(ROOT, 'examples', '.triton', 'themes');
// A directory under examples/ so walk-up can find examples/.triton/themes/
const EXAMPLE_INPUT_DIR = join(ROOT, 'examples', 'mermaid', 'flowchart');
const ACME_PRIMARY = '#6C3FC5';

describe('resolveCliTheme: --theme-file flag', () => {
  it('loads the theme file and returns the resolved palette', () => {
    const theme = resolveCliTheme({ themeFile: ACME_THEME }, ROOT);
    expect(theme).toBeDefined();
    expect(theme!.palette.primary).toBe(ACME_PRIMARY);
  });

  it('throws with a clear message for a nonexistent --theme-file', () => {
    expect(() =>
      resolveCliTheme({ themeFile: 'does-not-exist.json' }, ROOT),
    ).toThrow(/--theme-file|Cannot read|ENOENT/);
  });
});

describe('resolveCliTheme: --themes-dir + --theme flags', () => {
  it('builds a registry from --themes-dir and returns the named theme', () => {
    const theme = resolveCliTheme({ themesDir: THEMES_DIR, theme: 'acme-demo' }, ROOT);
    expect(theme).toBeDefined();
    expect(theme!.palette.primary).toBe(ACME_PRIMARY);
  });
});

describe('resolveCliTheme: auto-discovery of .triton/themes/', () => {
  it('walks up from inputDir to find .triton/themes/ and resolves --theme acme-demo', () => {
    // EXAMPLE_INPUT_DIR is under examples/mermaid/flowchart — walk-up finds
    // examples/.triton/themes/ without any --themes-dir flag.
    const theme = resolveCliTheme({ theme: 'acme-demo' }, EXAMPLE_INPUT_DIR);
    expect(theme).toBeDefined();
    expect(theme!.palette.primary).toBe(ACME_PRIMARY);
  });
});
