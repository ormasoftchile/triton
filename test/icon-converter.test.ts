/**
 * icon-converter.test.ts
 *
 * Tests the SVG → Triton icon pack converter (scripts/convert-icons.mjs).
 *
 * Strategy: run the converter on the small fixture SVG set at
 * test/fixtures/svg-icons/ and assert the output passes validateIconPack.
 * Fast and focused — no subprocess, no latex deps.
 *
 * Dependency note: this test imports @iconify/tools (a devDependency) via the
 * converter module. That is fine for tests. The converter is NEVER imported
 * from src/** — triton-core stays a pure render pipeline with zero authoring deps.
 */

import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs import, typed as any; tests don't run through tsconfig
import { convertIconDirectory } from '../scripts/convert-icons.mjs';
import { validateIconPack } from '../src/icons/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, 'fixtures/svg-icons');

const ALLOWED_TOP_KEYS = new Set(['prefix', 'icons', 'aliases', 'width', 'height', 'left', 'top']);
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

// ─── Round-trip: convert → validate ──────────────────────────────────────────

describe('convert-icons: SVG → Triton pack round-trip', () => {
  it('converts fixture SVG directory and passes validateIconPack', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { pack, iconCount, skipped } = await convertIconDirectory(
      FIXTURE_DIR,
      'azure-test',
      { useSvgo: true, verbose: false },
    );

    expect(iconCount).toBe(3);
    expect(skipped).toHaveLength(0);

    // Core invariant: the output must satisfy Triton's strict validator
    const result = validateIconPack(pack);
    if (!result.ok) {
      throw new Error(`validateIconPack failed: ${JSON.stringify((result as any).error)}`);
    }
    expect(result.ok).toBe(true);
  });

  it('honours the requested prefix', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { pack } = await convertIconDirectory(FIXTURE_DIR, 'my-icons', { useSvgo: false });
    expect(pack.prefix).toBe('my-icons');
  });

  it('produces only Triton-allowed top-level keys', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { pack } = await convertIconDirectory(FIXTURE_DIR, 'test', { useSvgo: false });
    for (const key of Object.keys(pack as object)) {
      expect(ALLOWED_TOP_KEYS.has(key)).toBe(true);
    }
  });

  it('all icon names match Triton name grammar', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { pack } = await convertIconDirectory(FIXTURE_DIR, 'test', { useSvgo: false });
    for (const name of Object.keys((pack as any).icons as object)) {
      expect(NAME_RE.test(name)).toBe(true);
    }
  });

  it('every icon has a non-empty body string', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { pack } = await convertIconDirectory(FIXTURE_DIR, 'test', { useSvgo: false });
    const icons: Record<string, { body: string }> = (pack as any).icons;
    for (const data of Object.values(icons)) {
      expect(typeof data.body).toBe('string');
      expect(data.body.length).toBeGreaterThan(0);
    }
  });

  it('icon bodies contain no <svg> wrapper', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { pack } = await convertIconDirectory(FIXTURE_DIR, 'test', { useSvgo: false });
    const icons: Record<string, { body: string }> = (pack as any).icons;
    for (const data of Object.values(icons)) {
      expect(data.body).not.toContain('<svg');
    }
  });

  it('works without SVGO and still passes validateIconPack', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { pack } = await convertIconDirectory(FIXTURE_DIR, 'test', { useSvgo: false });
    const result = validateIconPack(pack);
    expect(result.ok).toBe(true);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('convert-icons: error handling', () => {
  it('rejects an invalid prefix (uppercase)', async () => {
    await expect(
      convertIconDirectory(FIXTURE_DIR, 'BadPrefix', { useSvgo: false }),
    ).rejects.toThrow(/invalid prefix/i);
  });

  it('rejects a non-existent SVG directory', async () => {
    await expect(
      convertIconDirectory('/no/such/path/svg', 'test', { useSvgo: false }),
    ).rejects.toThrow(/not found/i);
  });
});
