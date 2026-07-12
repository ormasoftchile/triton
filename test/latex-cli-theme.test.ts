/**
 * test/latex-cli-theme.test.ts
 *
 * Unit + integration tests for Phase-4: triton-latex CLI theme-file/dir flags
 * and resolveCliTheme() resolution contract.
 *
 * Strategy:
 *  - Resolution logic is a thin orchestrator over loadThemeFile / discoverThemes /
 *    findTritonThemesDir (all covered by test/theme-discover.test.ts).  Here we
 *    verify the END-TO-END contract: the built CLI (latex/dist/cli.cjs) applies
 *    the correct theme by grepping the SVG output for a known palette color.
 *  - The acme-demo fixture has primary: #6C3FC5 — a distinctive purple that does
 *    NOT appear in any built-in preset — so a grep hit is conclusive proof.
 *  - We also verify that an invalid --theme-file path produces exit code 1.
 *
 * Fixtures used (committed):
 *   examples/.triton/themes/acme-demo.triton-theme.json  (primary #6C3FC5)
 *   examples/mermaid/flowchart/flowchart.mmd
 *   latex/dist/cli.cjs  (must be built before running)
 *
 * Output files are written under latex/examples/ (never /tmp) and deleted
 * during teardown.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(__dirname, '..');
const CLI = join(ROOT, 'latex', 'dist', 'cli.cjs');
const DIAGRAM = join(ROOT, 'examples', 'mermaid', 'flowchart', 'flowchart.mmd');
const ACME_THEME = join(ROOT, 'examples', '.triton', 'themes', 'acme-demo.triton-theme.json');
const THEMES_DIR = join(ROOT, 'examples', '.triton', 'themes');
const ACME_PRIMARY = '#6C3FC5';

// Output files under latex/examples/ (cleaned in afterAll)
const OUT_THEME_FILE = join(ROOT, 'latex', 'examples', 'test-cli-theme-file.svg');
const OUT_THEMES_DIR = join(ROOT, 'latex', 'examples', 'test-cli-themes-dir.svg');
const OUT_AUTODISCOVER = join(ROOT, 'latex', 'examples', 'test-cli-autodiscover.svg');

afterAll(() => {
  for (const f of [OUT_THEME_FILE, OUT_THEMES_DIR, OUT_AUTODISCOVER]) {
    if (existsSync(f)) rmSync(f);
  }
});

describe('triton-latex CLI: --theme-file flag', () => {
  it('renders with --theme-file and applies the custom palette', () => {
    const result = spawnSync(
      process.execPath,
      [CLI, 'render', DIAGRAM, '-o', OUT_THEME_FILE, '--theme-file', ACME_THEME],
      { encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);
    expect(existsSync(OUT_THEME_FILE)).toBe(true);
    const svg = readFileSync(OUT_THEME_FILE, 'utf8');
    expect(svg).toContain(ACME_PRIMARY);
  });

  it('exits 1 with clear stderr for a nonexistent --theme-file', () => {
    const result = spawnSync(
      process.execPath,
      [CLI, 'render', DIAGRAM, '-o', OUT_THEME_FILE, '--theme-file', 'does-not-exist.json'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--theme-file/);
    expect(result.stderr).toMatch(/ENOENT|Cannot read/);
  });
});

describe('triton-latex CLI: --themes-dir + --theme flags', () => {
  it('renders with --themes-dir + --theme acme-demo and applies the custom palette', () => {
    const result = spawnSync(
      process.execPath,
      [CLI, 'render', DIAGRAM, '-o', OUT_THEMES_DIR, '--themes-dir', THEMES_DIR, '--theme', 'acme-demo'],
      { encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);
    expect(existsSync(OUT_THEMES_DIR)).toBe(true);
    const svg = readFileSync(OUT_THEMES_DIR, 'utf8');
    expect(svg).toContain(ACME_PRIMARY);
  });
});

describe('triton-latex CLI: auto-discovery of .triton/themes/', () => {
  it('auto-discovers .triton/themes/ from input ancestor and resolves --theme acme-demo', () => {
    // The input is under examples/ which has examples/.triton/themes/
    // No --themes-dir flag — relies on walk-up discovery from the input file's dir
    const result = spawnSync(
      process.execPath,
      [CLI, 'render', DIAGRAM, '-o', OUT_AUTODISCOVER, '--theme', 'acme-demo'],
      { encoding: 'utf8' },
    );
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);
    expect(existsSync(OUT_AUTODISCOVER)).toBe(true);
    const svg = readFileSync(OUT_AUTODISCOVER, 'utf8');
    expect(svg).toContain(ACME_PRIMARY);
  });
});
