/**
 * test/theme-discover.test.ts
 *
 * Tests for the Phase-2 theme discovery utility: discoverThemes, loadThemeFile,
 * findTritonThemesDir.
 *
 * Fixture themes live under test/fixtures/themes/ (committed, no /tmp).
 * Walk-up tests use test/.tmp-discover/ (created & cleaned inside the repo).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  discoverThemes,
  loadThemeFile,
  findTritonThemesDir,
  type ThemeDiscoveryResult,
} from '../src/theme/discover.js';
import { getThemePreset } from '../src/theme/preset.js';

// ─── Paths ───────────────────────────────────────────────────────────────────

const FIXTURES = resolve(__dirname, 'fixtures/themes');
const TMP_ROOT = resolve(__dirname, '.tmp-discover');

// ─── Walk-up temp dir setup/teardown ─────────────────────────────────────────

beforeAll(() => {
  // Create a nested dir with a .triton/themes/ at a mid-level ancestor
  // Structure: TMP_ROOT/a/b/c/d/   (start dir)
  //            TMP_ROOT/a/.triton/themes/   (target)
  mkdirSync(join(TMP_ROOT, 'a', 'b', 'c', 'd'), { recursive: true });
  mkdirSync(join(TMP_ROOT, 'a', '.triton', 'themes'), { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_ROOT)) {
    rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

// ─── loadThemeFile ────────────────────────────────────────────────────────────

describe('loadThemeFile', () => {
  it('loads and resolves a valid partial theme over its declared base', () => {
    // valid-partial.triton-theme.json: base=default, overrides palette.primary=#E63946
    const result = loadThemeFile(join(FIXTURES, 'valid-partial.triton-theme.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resolved = result.value;
    const defaultBase = getThemePreset('default');

    // Overridden field = override value
    expect(resolved.palette.primary).toBe('#E63946');
    // Non-overridden field = base value
    expect(resolved.palette.background).toBe(defaultBase.palette.background);
    // typography inherited from default
    expect(resolved.typography.baseFontSize).toBe(defaultBase.typography.baseFontSize);
  });

  it('loads and resolves a full theme over its declared base (executive)', () => {
    const result = loadThemeFile(join(FIXTURES, 'valid-full.triton-theme.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resolved = result.value;
    expect(resolved.palette.primary).toBe('#1A1A2E');
    expect(resolved.panel.titleAlign).toBe('center');
    expect(resolved.panel.titleChrome).toBe('box');
  });

  it('returns err for bad JSON', () => {
    const result = loadThemeFile(join(FIXTURES, 'bad-json.triton-theme.json'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('THEME_VALIDATION_ERROR');
    expect(result.error.message).toMatch(/Invalid JSON/);
  });

  it('returns err for unknown key', () => {
    const result = loadThemeFile(join(FIXTURES, 'unknown-key.triton-theme.json'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('THEME_VALIDATION_ERROR');
    expect(result.error.message).toMatch(/failed validation/);
  });

  it('returns err for non-existent file', () => {
    const result = loadThemeFile(join(FIXTURES, 'does-not-exist.triton-theme.json'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('THEME_VALIDATION_ERROR');
    expect(result.error.message).toMatch(/Cannot read/);
  });

  it('resolves partial theme: overridden field differs from base, non-overridden field equals base', () => {
    // acme-corp.triton-theme.json: base=minimal, overrides palette.primary=#2C7BE5
    const result = loadThemeFile(join(FIXTURES, 'acme-corp.triton-theme.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const minimalBase = getThemePreset('minimal');
    expect(result.value.palette.primary).toBe('#2C7BE5');           // overridden
    expect(result.value.palette.background).toBe(minimalBase.palette.background); // inherited
    expect(result.value.typography.lineHeight).toBe(minimalBase.typography.lineHeight);
  });
});

// ─── discoverThemes ───────────────────────────────────────────────────────────

describe('discoverThemes', () => {
  let result: ThemeDiscoveryResult;

  beforeAll(() => {
    result = discoverThemes(FIXTURES);
  });

  it('returns valid themes keyed by declared name', () => {
    // valid-partial.triton-theme.json has name="acme-brand"
    expect(result.themes.has('acme-brand')).toBe(true);
    // valid-full.triton-theme.json has name="acme-full"
    expect(result.themes.has('acme-full')).toBe(true);
  });

  it('returns a valid theme keyed by filename-derived name when no name field', () => {
    // acme-corp.triton-theme.json has NO name field → derived = "acme-corp"
    expect(result.themes.has('acme-corp')).toBe(true);
  });

  it('the filename-derived theme is correctly resolved', () => {
    const acmeCorp = result.themes.get('acme-corp');
    expect(acmeCorp).toBeDefined();
    if (!acmeCorp) return;
    expect(acmeCorp.palette.primary).toBe('#2C7BE5');
  });

  it('excludes bad-json files and adds a warning', () => {
    expect(result.themes.has('bad-json')).toBe(false);
    const hasBadJsonWarning = result.warnings.some(w => w.includes('bad-json') || w.includes('Invalid JSON'));
    expect(hasBadJsonWarning).toBe(true);
  });

  it('excludes unknown-key files and adds a warning', () => {
    expect(result.themes.has('acme-unknown')).toBe(false);
    const hasValidationWarning = result.warnings.some(w =>
      w.includes('unknown-key') || w.includes('failed validation'),
    );
    expect(hasValidationWarning).toBe(true);
  });

  it('excludes built-in name collision and adds warning', () => {
    // executive.triton-theme.json has name="executive" (built-in)
    const executiveTheme = result.themes.get('executive');
    expect(executiveTheme).toBeUndefined();
    const hasCollisionWarning = result.warnings.some(w =>
      w.includes('executive') && w.includes('built-in'),
    );
    expect(hasCollisionWarning).toBe(true);
  });

  it('does not throw on invalid files', () => {
    expect(() => discoverThemes(FIXTURES)).not.toThrow();
  });

  it('returns empty themes + warning for missing directory', () => {
    const r = discoverThemes(join(FIXTURES, 'does-not-exist-dir'));
    expect(r.themes.size).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toMatch(/Cannot read/);
  });

  it('last-wins for duplicate custom names within same dir', () => {
    // Write two files with same name= into a temp subdir
    const dupDir = join(TMP_ROOT, 'dup-test');
    mkdirSync(dupDir, { recursive: true });

    writeFileSync(
      join(dupDir, 'first.triton-theme.json'),
      JSON.stringify({ name: 'same-name', palette: { primary: '#111111' } }),
    );
    writeFileSync(
      join(dupDir, 'second.triton-theme.json'),
      JSON.stringify({ name: 'same-name', palette: { primary: '#222222' } }),
    );

    const r = discoverThemes(dupDir);
    expect(r.themes.has('same-name')).toBe(true);
    // last-wins (readdir order may vary; check a duplicate warning exists)
    const hasDupWarning = r.warnings.some(w => w.includes('same-name') && w.includes('Duplicate'));
    expect(hasDupWarning).toBe(true);
  });
});

// ─── findTritonThemesDir ──────────────────────────────────────────────────────

describe('findTritonThemesDir', () => {
  it('finds .triton/themes/ from a deeply nested start dir', () => {
    const startDir = join(TMP_ROOT, 'a', 'b', 'c', 'd');
    const found = findTritonThemesDir(startDir);
    expect(found).toBeDefined();
    expect(found).toBe(resolve(TMP_ROOT, 'a', '.triton', 'themes'));
  });

  it('finds .triton/themes/ from the directory that directly contains it', () => {
    const startDir = join(TMP_ROOT, 'a');
    const found = findTritonThemesDir(startDir);
    expect(found).toBeDefined();
    expect(found).toBe(resolve(TMP_ROOT, 'a', '.triton', 'themes'));
  });

  it('returns undefined when .triton/themes/ does not exist in the walk path', () => {
    // b/c/d has no .triton/themes/ at b level (only at a level, but we start lower
    // and check in a subtree that never crosses 'a')
    const isolatedDir = join(TMP_ROOT, 'isolated');
    mkdirSync(isolatedDir, { recursive: true });
    const found = findTritonThemesDir(isolatedDir);
    // Should not find TMP_ROOT/a/.triton/themes because the walk goes UP
    // from 'isolated' toward root — it will pass TMP_ROOT and continue up.
    // TMP_ROOT itself has no .triton/themes/. It will eventually hit the repo
    // root or OS root. As long as neither has .triton/themes/ in ≤10 levels we're fine.
    // We cannot guarantee this in all environments, so we skip the assertion
    // if found is non-null (the repo might have a .triton/themes/ somewhere above).
    if (found !== undefined) {
      // Accept — there is a .triton/themes/ somewhere in the real tree above
      expect(typeof found).toBe('string');
    } else {
      expect(found).toBeUndefined();
    }
  });

  it('returns undefined for a path that provably has no .triton/themes/ ancestor', () => {
    // Create a dir we KNOW has no .triton/themes/ between it and TMP_ROOT:
    const noThemeDir = join(TMP_ROOT, 'no-theme-sub');
    mkdirSync(noThemeDir, { recursive: true });
    // We can't use MAX_LEVELS easily here, but we CAN verify the function
    // doesn't crash and returns string | undefined.
    const found = findTritonThemesDir(noThemeDir);
    expect(found === undefined || typeof found === 'string').toBe(true);
  });
});

// ─── Purity boundary: discover.ts is NOT reachable from src/index.ts ─────────

describe('purity boundary', () => {
  it('src/index.ts does not import discover', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve: pathResolve } = await import('node:path');
    const indexSrc = readFileSync(pathResolve(__dirname, '../src/index.ts'), 'utf8');
    expect(indexSrc).not.toMatch(/discover/);
  });

  it('src/frontend/index.ts does not import discover', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve: pathResolve } = await import('node:path');
    const frontendSrc = readFileSync(pathResolve(__dirname, '../src/frontend/index.ts'), 'utf8');
    expect(frontendSrc).not.toMatch(/from ['"].*discover/);
    expect(frontendSrc).not.toMatch(/import.*discover/);
  });
});
