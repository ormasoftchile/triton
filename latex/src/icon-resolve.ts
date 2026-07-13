/**
 * latex/src/icon-resolve.ts
 *
 * Standalone icon-pack resolution logic for the triton-latex CLI.
 *
 * Intentionally imports ONLY Node built-ins and packages under ../../src/**
 * (the Triton core compiler). It does NOT import ./pdf.ts or any latex-only
 * dependency (pdfkit, svg-to-pdfkit), so it can be imported by vitest at root
 * `pnpm test` time without installing latex's isolated node_modules.
 *
 * Resolution priority (mirrors resolveCliTheme's three-level pattern):
 *   1. iconPack  → loadIconPack that exact file; THROWS on error (no process.exit —
 *                  caller wraps in try/catch and exits with code 1). Merged LAST
 *                  (highest precedence).
 *   2. iconsDir  → discoverIconPacks(iconsDir); merged on top of auto-discovery.
 *   3. Auto-discovery → findTritonIconsDir(inputDir) + discoverIconPacks.
 *
 * Duplicate prefix: later source wins (last-wins, consistent with discoverIconPacks).
 * Returns an empty map when no flags and no .triton/icons/ is found — valid.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IconPackMap } from '../../src/contracts/icons.js';
import {
  findTritonIconsDir,
  discoverIconPacks,
} from '../../src/icons/discover.js';
import { validateIconPack } from '../../src/icons/validate.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Minimal parameter interface for icon-resolution inputs.
 * A superset (e.g. the full CLI Args) satisfies it structurally.
 */
export interface IconArgs {
  iconPack?: string;
  iconsDir?: string;
}

// ─── resolveCliIcons ──────────────────────────────────────────────────────────

/**
 * Resolve the icon packs to pass to the renderer, honouring flag priority:
 *
 *   1. --icon-pack <path> — load that exact .triton-icons.json file; THROWS on
 *      any error (not process.exit — the CLI catches and exits 1). Merged last
 *      so it takes precedence over all other sources.
 *   2. --icons-dir <dir>  — discover packs in that directory, merged on top of
 *      auto-discovery (overrides on duplicate prefix).
 *   3. Auto-discovery     — walk up from `inputDir` looking for .triton/icons/,
 *      load all packs found there (lowest precedence).
 *
 * Returns the combined IconPackMap (Map<prefix, IconifyJSON>).
 * Returns an empty map when no flags are set and no .triton/icons/ is found.
 * Never calls process.exit.
 */
export function resolveCliIcons(args: IconArgs, inputDir: string): IconPackMap {
  const merged: IconPackMap = new Map();

  // Priority 3 (lowest): auto-discover .triton/icons/ walking up from inputDir
  const autoDir = findTritonIconsDir(inputDir);
  if (autoDir) {
    const { map, warnings } = discoverIconPacks(autoDir);
    for (const [prefix, pack] of map) merged.set(prefix, pack);
    for (const w of warnings) console.error(`warning: ${w}`);
  }

  // Priority 2: explicit --icons-dir (overrides auto on duplicate prefix)
  if (args.iconsDir) {
    const { map, warnings } = discoverIconPacks(resolve(args.iconsDir));
    for (const [prefix, pack] of map) merged.set(prefix, pack);
    for (const w of warnings) console.error(`warning: ${w}`);
  }

  // Priority 1 (highest): explicit --icon-pack file (throws on any error)
  if (args.iconPack) {
    const packPath = resolve(args.iconPack);

    let raw: string;
    try {
      raw = readFileSync(packPath, 'utf8');
    } catch (cause) {
      throw new Error(`--icon-pack: cannot read "${packPath}": ${(cause as Error).message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new Error(`--icon-pack: invalid JSON in "${packPath}": ${(cause as Error).message}`);
    }

    const result = validateIconPack(parsed);
    if (!result.ok) {
      throw new Error(`--icon-pack: "${packPath}" failed validation: ${result.error.message}`);
    }

    merged.set(result.value.prefix, result.value);
  }

  return merged;
}
