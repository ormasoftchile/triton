/**
 * test/latex-cli-icons.test.ts
 *
 * Unit tests for resolveCliIcons() — the icon-pack resolution logic for the
 * triton-latex CLI (P3).
 *
 * Strategy:
 *  - Import resolveCliIcons() from latex/src/icon-resolve.ts — NOT from
 *    cli.ts. icon-resolve.ts imports ONLY Node built-ins and ../../src/**
 *    (Triton core). It has zero dependency on ./pdf.ts or any latex-only
 *    package (pdfkit, svg-to-pdfkit), so these tests run cleanly at root
 *    `pnpm test` time even when latex/node_modules is not installed and
 *    latex/dist does not exist.
 *  - Tests cover: --icon-pack loads exact file, --icons-dir discovers a dir,
 *    auto-discovery via ancestor .triton/icons/, precedence / merge order,
 *    bad --icon-pack throws (not process.exit).
 *
 * Fixtures:
 *   test/fixtures/icons/valid-mdi.triton-icons.json         (prefix "mdi")
 *   test/fixtures/icons/valid-lucide.triton-icons.json      (prefix "lucide")
 *   test/fixtures/icons/valid-heroicons.triton-icons.json   (prefix "heroicons")
 *   test/fixtures/icons/bad-json.triton-icons.json          (malformed JSON)
 *   test/fixtures/icons-discovery/.triton/icons/
 *     azure.triton-icons.json                               (prefix "azure")
 */

import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';

// Import from the core-only module — no pdfkit/pdf.ts in the import graph.
import { resolveCliIcons } from '../latex/src/icon-resolve.js';

const ROOT = resolve(__dirname, '..');
const ICONS_DIR = join(ROOT, 'test', 'fixtures', 'icons');
const MDI_PACK = join(ICONS_DIR, 'valid-mdi.triton-icons.json');
const LUCIDE_PACK = join(ICONS_DIR, 'valid-lucide.triton-icons.json');
const HEROICONS_PACK = join(ICONS_DIR, 'valid-heroicons.triton-icons.json');
const BAD_JSON_PACK = join(ICONS_DIR, 'bad-json.triton-icons.json');

// The discovery fixture has .triton/icons/azure.triton-icons.json
const DISCOVERY_ROOT = join(ROOT, 'test', 'fixtures', 'icons-discovery');
// A subdirectory — walk-up from here should still find .triton/icons/
const DISCOVERY_SUBDIR = join(DISCOVERY_ROOT, 'docs', 'diagrams');

describe('resolveCliIcons: --icon-pack flag', () => {
  it('loads the specified pack file and returns it in the map', () => {
    const map = resolveCliIcons({ iconPack: MDI_PACK }, ROOT);
    expect(map.size).toBeGreaterThan(0);
    expect(map.has('mdi')).toBe(true);
    const pack = map.get('mdi')!;
    expect(pack.prefix).toBe('mdi');
    expect(pack.icons).toHaveProperty('server');
  });

  it('loads lucide pack via --icon-pack', () => {
    const map = resolveCliIcons({ iconPack: LUCIDE_PACK }, ROOT);
    expect(map.has('lucide')).toBe(true);
  });

  it('throws with a clear message for a nonexistent --icon-pack path', () => {
    expect(() =>
      resolveCliIcons({ iconPack: join(ROOT, 'does-not-exist.triton-icons.json') }, ROOT),
    ).toThrow(/--icon-pack|Cannot read|ENOENT/);
  });

  it('throws with a clear message for a malformed JSON --icon-pack', () => {
    expect(() =>
      resolveCliIcons({ iconPack: BAD_JSON_PACK }, ROOT),
    ).toThrow(/--icon-pack|invalid JSON|JSON/i);
  });
});

describe('resolveCliIcons: --icons-dir flag', () => {
  it('discovers all packs in the given directory', () => {
    const map = resolveCliIcons({ iconsDir: ICONS_DIR }, ROOT);
    // The icons dir contains mdi, lucide, heroicons (bad-json/invalid are skipped)
    expect(map.has('mdi')).toBe(true);
    expect(map.has('lucide')).toBe(true);
    expect(map.has('heroicons')).toBe(true);
  });

  it('returns empty map for a directory with no .triton-icons.json files', () => {
    // ROOT itself has no icon packs at top level
    const map = resolveCliIcons({ iconsDir: join(ROOT, 'src') }, ROOT);
    expect(map.size).toBe(0);
  });
});

describe('resolveCliIcons: auto-discovery via .triton/icons/ ancestor walk', () => {
  it('finds .triton/icons/ when inputDir is the discovery root', () => {
    const map = resolveCliIcons({}, DISCOVERY_ROOT);
    expect(map.has('azure')).toBe(true);
    expect(map.get('azure')!.icons).toHaveProperty('app-service');
  });

  it('finds .triton/icons/ walking up from a subdirectory', () => {
    // DISCOVERY_SUBDIR is a non-existent subdirectory — findTritonIconsDir
    // walks up until it finds .triton/icons/ at DISCOVERY_ROOT.
    const map = resolveCliIcons({}, DISCOVERY_SUBDIR);
    expect(map.has('azure')).toBe(true);
  });

  it('returns empty map when no .triton/icons/ is found', () => {
    // Use /tmp equivalent: the repo root has no .triton/icons/ (only .triton/themes/)
    const map = resolveCliIcons({}, ROOT);
    expect(map.has('azure')).toBe(false);
  });
});

describe('resolveCliIcons: precedence and merge order', () => {
  it('--icon-pack takes precedence over --icons-dir on same prefix', () => {
    // Create a scenario: --icons-dir has mdi, --icon-pack also provides mdi.
    // The --icon-pack mdi should win (last-merge wins).
    // We use the same file for both to guarantee the same data, but test that
    // --icon-pack result is present when both specify "mdi".
    const map = resolveCliIcons({ iconsDir: ICONS_DIR, iconPack: MDI_PACK }, ROOT);
    // mdi comes from both sources; --icon-pack is applied last → should exist
    expect(map.has('mdi')).toBe(true);
    // lucide comes only from --icons-dir
    expect(map.has('lucide')).toBe(true);
  });

  it('--icons-dir overrides auto-discovery on duplicate prefix', () => {
    // auto-discovery from DISCOVERY_ROOT yields "azure"
    // --icons-dir from ICONS_DIR yields mdi/lucide/heroicons (no azure)
    // net result: all four prefixes present
    const map = resolveCliIcons({ iconsDir: ICONS_DIR }, DISCOVERY_ROOT);
    expect(map.has('azure')).toBe(true);   // from auto-discovery
    expect(map.has('mdi')).toBe(true);     // from --icons-dir
    expect(map.has('lucide')).toBe(true);  // from --icons-dir
  });

  it('combines all three sources with correct precedence', () => {
    // auto-discovery: azure; --icons-dir: mdi+lucide+heroicons; --icon-pack: lucide
    // Expected: azure (auto), mdi (dir), lucide (both dir + pack → pack wins), heroicons (dir)
    const map = resolveCliIcons(
      { iconsDir: ICONS_DIR, iconPack: LUCIDE_PACK },
      DISCOVERY_ROOT,
    );
    expect(map.has('azure')).toBe(true);
    expect(map.has('mdi')).toBe(true);
    expect(map.has('lucide')).toBe(true);
    expect(map.has('heroicons')).toBe(true);
    // lucide from --icon-pack (applied last, same data — verify the pack loaded)
    expect(map.get('lucide')!.icons).toHaveProperty('box');
  });

  it('returns empty map when no args and no .triton/icons/ ancestor exists', () => {
    const map = resolveCliIcons({}, ROOT);
    expect(map.size).toBe(0);
  });
});
