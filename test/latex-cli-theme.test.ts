/**
 * test/latex-cli-theme.test.ts
 *
 * Unit tests for Phase-4: resolveCliTheme() resolution contract.
 *
 * Strategy:
 *  - Import resolveCliTheme() directly from TypeScript source (vitest transpiles
 *    TS; no built bundle required). This makes the tests CI-robust: they pass
 *    even when latex/dist/cli.cjs does not exist and latex's esbuild deps are not
 *    installed — exactly the condition at `pnpm test` time in the release workflow.
 *  - The acme-demo fixture has primary: #6C3FC5 — distinctive purple absent from
 *    all built-in presets — so checking palette.primary is conclusive.
 *  - SVG rendering correctness is already covered by core tests; here we only
 *    verify the Phase-4 resolver contract (which theme object is returned).
 *  - The process.exit(1) error path is not tested here: vitest intercepts
 *    process.exit globally before vi.spyOn can substitute it, causing a global
 *    error even when the spy mock throws. The behavior (loadThemeFile → err →
 *    console.error + exit(1)) is verified by code inspection.
 *
 * Fixtures:
 *   examples/.triton/themes/acme-demo.triton-theme.json  (primary #6C3FC5)
 */

import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';

// Import resolver FROM SOURCE — vitest transpiles TS; no built bundle needed.
import { resolveCliTheme } from '../latex/src/cli.js';

const ROOT = resolve(__dirname, '..');
const ACME_THEME = join(ROOT, 'examples', '.triton', 'themes', 'acme-demo.triton-theme.json');
const THEMES_DIR = join(ROOT, 'examples', '.triton', 'themes');
// A directory that is a descendant of examples/ so walk-up can find .triton/themes/
const EXAMPLE_INPUT_DIR = join(ROOT, 'examples', 'mermaid', 'flowchart');
const ACME_PRIMARY = '#6C3FC5';

// Minimal Args shape — only theme-related fields vary per test
const baseArgs = {
  positionals: [] as string[],
  scale: 1,
  help: false,
  out: undefined as string | undefined,
  command: 'render' as string | undefined,
  theme: undefined as string | undefined,
  themeFile: undefined as string | undefined,
  themesDir: undefined as string | undefined,
};

describe('resolveCliTheme: --theme-file flag', () => {
  it('loads the theme file and returns the resolved palette', () => {
    const theme = resolveCliTheme({ ...baseArgs, themeFile: ACME_THEME }, ROOT);
    expect(theme).toBeDefined();
    expect(theme!.palette.primary).toBe(ACME_PRIMARY);
  });
});

describe('resolveCliTheme: --themes-dir + --theme flags', () => {
  it('builds a registry from --themes-dir and returns the named theme', () => {
    const theme = resolveCliTheme(
      { ...baseArgs, themesDir: THEMES_DIR, theme: 'acme-demo' },
      ROOT,
    );
    expect(theme).toBeDefined();
    expect(theme!.palette.primary).toBe(ACME_PRIMARY);
  });
});

describe('resolveCliTheme: auto-discovery of .triton/themes/', () => {
  it('walks up from inputDir to find .triton/themes/ and resolves --theme acme-demo', () => {
    // EXAMPLE_INPUT_DIR is under examples/mermaid/flowchart — walk-up finds
    // examples/.triton/themes/ without any --themes-dir flag.
    const theme = resolveCliTheme(
      { ...baseArgs, theme: 'acme-demo' },
      EXAMPLE_INPUT_DIR,
    );
    expect(theme).toBeDefined();
    expect(theme!.palette.primary).toBe(ACME_PRIMARY);
  });
});
