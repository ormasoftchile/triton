/**
 * test/icon-discover.test.ts
 *
 * Tests for P1 icon pack discovery: discoverIconPacks, findTritonIconsDir, loadIconPacks.
 *
 * Fixture packs live under test/fixtures/icons/ (committed, no /tmp).
 * Walk-up tests use test/.tmp-icon-discover/ (created & cleaned inside the repo).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  discoverIconPacks,
  findTritonIconsDir,
  loadIconPacks,
  type IconDiscoveryResult,
} from '../src/icons/discover.js';

// ─── Paths ───────────────────────────────────────────────────────────────────

const FIXTURES = resolve(__dirname, 'fixtures/icons');
const TMP_ROOT = resolve(__dirname, '.tmp-icon-discover');

// ─── Walk-up temp dir setup/teardown ─────────────────────────────────────────

beforeAll(() => {
  // Structure: TMP_ROOT/a/b/c/d/   (start dir for walk-up tests)
  //            TMP_ROOT/a/.triton/icons/   (target)
  mkdirSync(join(TMP_ROOT, 'a', 'b', 'c', 'd'), { recursive: true });
  mkdirSync(join(TMP_ROOT, 'a', '.triton', 'icons'), { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_ROOT)) {
    rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

// ─── discoverIconPacks ────────────────────────────────────────────────────────

describe('discoverIconPacks', () => {
  let result: IconDiscoveryResult;

  beforeAll(() => {
    result = discoverIconPacks(FIXTURES);
  });

  it('loads valid packs into the map keyed by prefix', () => {
    expect(result.map.has('mdi')).toBe(true);
    expect(result.map.has('lucide')).toBe(true);
  });

  it('loaded pack contains correct icon data', () => {
    const mdi = result.map.get('mdi');
    expect(mdi).toBeDefined();
    if (!mdi) return;
    expect(mdi.prefix).toBe('mdi');
    expect(mdi.icons['server']).toBeDefined();
    expect(mdi.icons['server'].body).toContain('<path');
  });

  it('skips malformed JSON and adds a warning', () => {
    expect(result.map.has('broken')).toBe(false);
    const hasBadJsonWarning = result.warnings.some(w =>
      w.includes('bad-json') || w.includes('Invalid JSON'),
    );
    expect(hasBadJsonWarning).toBe(true);
  });

  it('skips packs that fail validation and adds a warning', () => {
    // invalid-pack.triton-icons.json has an empty icons object — fails validateIconPack
    expect(result.map.has('invalid')).toBe(false);
    const hasValidationWarning = result.warnings.some(w =>
      w.includes('invalid-pack') || w.includes('failed validation'),
    );
    expect(hasValidationWarning).toBe(true);
  });

  it('does not throw on any file in the fixtures dir', () => {
    expect(() => discoverIconPacks(FIXTURES)).not.toThrow();
  });

  it('returns empty map + warning for a missing directory', () => {
    const r = discoverIconPacks(join(FIXTURES, 'does-not-exist-dir'));
    expect(r.map.size).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toMatch(/Cannot read/);
  });

  it('duplicate prefix → last-wins + warning', () => {
    const dupDir = join(TMP_ROOT, 'dup-test');
    mkdirSync(dupDir, { recursive: true });

    writeFileSync(
      join(dupDir, 'first.triton-icons.json'),
      JSON.stringify({
        prefix: 'mypack',
        icons: { 'icon-a': { body: '<path d="M0 0"/>' } },
      }),
    );
    writeFileSync(
      join(dupDir, 'second.triton-icons.json'),
      JSON.stringify({
        prefix: 'mypack',
        icons: { 'icon-b': { body: '<path d="M1 1"/>' } },
      }),
    );

    const r = discoverIconPacks(dupDir);
    expect(r.map.has('mypack')).toBe(true);
    // Exactly one pack in the map — the later file won
    expect(r.map.size).toBe(1);
    const hasDupWarning = r.warnings.some(w =>
      w.includes('mypack') && w.includes('Duplicate'),
    );
    expect(hasDupWarning).toBe(true);
  });
});

// ─── findTritonIconsDir ───────────────────────────────────────────────────────

describe('findTritonIconsDir', () => {
  it('finds .triton/icons/ from a deeply nested start dir', () => {
    const startDir = join(TMP_ROOT, 'a', 'b', 'c', 'd');
    const found = findTritonIconsDir(startDir);
    expect(found).toBeDefined();
    expect(found).toBe(resolve(TMP_ROOT, 'a', '.triton', 'icons'));
  });

  it('finds .triton/icons/ from the directory that directly contains it', () => {
    const startDir = join(TMP_ROOT, 'a');
    const found = findTritonIconsDir(startDir);
    expect(found).toBeDefined();
    expect(found).toBe(resolve(TMP_ROOT, 'a', '.triton', 'icons'));
  });

  it('returns string | undefined (never throws) for an arbitrary path', () => {
    const isolatedDir = join(TMP_ROOT, 'isolated');
    mkdirSync(isolatedDir, { recursive: true });
    const found = findTritonIconsDir(isolatedDir);
    expect(found === undefined || typeof found === 'string').toBe(true);
  });
});

// ─── loadIconPacks ────────────────────────────────────────────────────────────

describe('loadIconPacks', () => {
  it('returns a Map and string[] regardless of environment', () => {
    const isolatedDir = join(TMP_ROOT, 'isolated-load');
    mkdirSync(isolatedDir, { recursive: true });
    const r = loadIconPacks(isolatedDir);
    expect(r.map instanceof Map).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it('finds and loads packs when walking up from a nested start dir', () => {
    // Place a valid pack under TMP_ROOT/a/.triton/icons/
    const iconsDir = join(TMP_ROOT, 'a', '.triton', 'icons');
    writeFileSync(
      join(iconsDir, 'test-pack.triton-icons.json'),
      JSON.stringify({
        prefix: 'test',
        icons: { 'check': { body: '<path d="M0 0 L4 4 L8 0"/>' } },
      }),
    );

    const startDir = join(TMP_ROOT, 'a', 'b', 'c', 'd');
    const r = loadIconPacks(startDir);
    expect(r.map.has('test')).toBe(true);
    expect(r.map.get('test')?.prefix).toBe('test');
  });
});

// ─── Purity boundary ─────────────────────────────────────────────────────────

describe('purity boundary', () => {
  it('src/index.ts does not import icons/discover', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve: pathResolve } = await import('node:path');
    const indexSrc = readFileSync(pathResolve(__dirname, '../src/index.ts'), 'utf8');
    expect(indexSrc).not.toMatch(/icons\/discover/);
  });

  it('src/frontend/index.ts does not import icons/discover', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve: pathResolve } = await import('node:path');
    const frontendSrc = readFileSync(pathResolve(__dirname, '../src/frontend/index.ts'), 'utf8');
    expect(frontendSrc).not.toMatch(/from ['"].*icons\/discover/);
    expect(frontendSrc).not.toMatch(/import.*icons\/discover/);
  });
});
