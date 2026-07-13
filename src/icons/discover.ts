/**
 * Icon Pack Discovery Utility — src/icons/discover.ts
 *
 * Scans directories for `.triton-icons.json` files, validates them via
 * validateIconPack, and returns a prefix→IconifyJSON map (IconPackMap)
 * for host consumption.
 *
 * ⚠️  This module performs filesystem I/O (node:fs / node:path).
 *     It MUST NOT be imported from src/index.ts or src/frontend/index.ts.
 *     Hosts (VS Code extension, triton-latex CLI) consume it by relative path:
 *       import { loadIconPacks } from '../../src/icons/discover.js'
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { IconifyJSON, IconPackMap } from '../contracts/icons.js';
import { validateIconPack } from './validate.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface IconDiscoveryResult {
  /** Loaded icon packs keyed by each pack's `prefix` field (the authoritative key). */
  readonly map: IconPackMap;
  /** Human-readable warnings for skipped/invalid files. Never throws. */
  readonly warnings: readonly string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_SUFFIX = '.triton-icons.json';

// ─── discoverIconPacks ────────────────────────────────────────────────────────

/**
 * Scan `dir` for all `.triton-icons.json` files, validate each one, and
 * return an IconPackMap keyed by each pack's `prefix` field, plus any
 * warnings for skipped files.
 *
 * Rules:
 *  - Key = the pack's `prefix` field (authoritative; filename is ignored for keying).
 *  - Missing directory → returns empty map + warning. Never throws.
 *  - Malformed JSON → warning + skipped.
 *  - Validation failure (validateIconPack returns err) → warning + skipped.
 *  - Duplicate prefix across files → last-wins + warning.
 *    (Mirrors theme discovery's duplicate-name policy: the later file in readdir
 *    order overrides any earlier definition with the same prefix.)
 */
export function discoverIconPacks(dir: string): IconDiscoveryResult {
  const map: Map<string, IconifyJSON> = new Map();
  const warnings: string[] = [];

  // Gracefully handle missing / unreadable directory
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (cause) {
    warnings.push(`Cannot read icons directory "${dir}": ${String(cause)}`);
    return { map, warnings };
  }

  const iconFiles = entries.filter(e => e.endsWith(ICON_SUFFIX));

  for (const filename of iconFiles) {
    const filePath = join(dir, filename);

    // 1. Read file
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch (cause) {
      warnings.push(`Cannot read icon pack file "${filePath}": ${String(cause)}`);
      continue;
    }

    // 2. Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      warnings.push(`Invalid JSON in icon pack file "${filePath}": ${String(cause)}`);
      continue;
    }

    // 3. Validate against IconifyJSON contract
    const result = validateIconPack(parsed);
    if (!result.ok) {
      warnings.push(`Icon pack file "${filePath}" failed validation: ${result.error.message}`);
      continue;
    }

    const pack = result.value;

    // 4. Duplicate prefix → last-wins + warning
    if (map.has(pack.prefix)) {
      warnings.push(
        `Duplicate icon pack prefix "${pack.prefix}": "${filename}" overrides an earlier definition`,
      );
    }

    map.set(pack.prefix, pack);
  }

  return { map, warnings };
}

// ─── findTritonIconsDir ───────────────────────────────────────────────────────

/**
 * Walk up from `startDir` looking for a `.triton/icons/` directory.
 * Returns its absolute path when found, or undefined if not found.
 *
 * Stops at the filesystem root or after 10 levels (infinite-loop guard).
 */
export function findTritonIconsDir(startDir: string): string | undefined {
  const MAX_LEVELS = 10;
  let current = resolve(startDir);

  for (let level = 0; level < MAX_LEVELS; level++) {
    const candidate = join(current, '.triton', 'icons');
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // permission error or similar — keep walking up
    }

    const parent = resolve(join(current, '..'));
    if (parent === current) break; // filesystem root
    current = parent;
  }

  return undefined;
}

// ─── loadIconPacks ────────────────────────────────────────────────────────────

/**
 * Convenience entry point for hosts: walk up from `startDir` to find the
 * nearest `.triton/icons/` directory, then discover and load all packs within it.
 *
 * Returns an empty map (with no warnings) when no `.triton/icons/` dir is found —
 * a project without any icon packs is valid. Returns discoverIconPacks result
 * (map + warnings) when the directory is found.
 */
export function loadIconPacks(startDir: string): IconDiscoveryResult {
  const iconsDir = findTritonIconsDir(startDir);
  if (iconsDir === undefined) {
    return { map: new Map(), warnings: [] };
  }
  return discoverIconPacks(iconsDir);
}
