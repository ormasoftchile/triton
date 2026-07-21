/**
 * Theme Discovery Utility — src/theme/discover.ts
 *
 * Scans directories for `.triton-theme.json` files, validates them, resolves
 * them over their declared base preset, and returns a name→ResolvedTheme
 * registry.
 *
 * ⚠️  This module performs filesystem I/O (node:fs / node:path).
 *     It MUST NOT be imported from src/index.ts or src/frontend/index.ts.
 *     Hosts (VS Code extension, triton-latex CLI) consume it by relative path:
 *       import { discoverThemes } from '../../src/theme/discover.js'
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import type { ResolvedTheme } from '../contracts/theme.js';
import { ok, err, type Result } from '../contracts/result.js';
import { validateThemeInput, isBuiltinThemeName } from './validate.js';
import { resolveTheme } from './resolver.js';
import { getThemePreset } from './preset.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ThemeDiscoveryResult {
  /** Resolved themes keyed by name (declared `name` field or filename-derived). */
  readonly themes: ReadonlyMap<string, ResolvedTheme>;
  /** Human-readable warnings for skipped/invalid files. Never throws. */
  readonly warnings: readonly string[];
}

// ─── Name derivation ──────────────────────────────────────────────────────────

const THEME_SUFFIX = '.triton-theme.json';
const SLUG = /^[a-z0-9-]+$/;

/** Strip `.triton-theme.json` from a filename to derive a theme name. */
function deriveNameFromFilename(filename: string): string {
  return basename(filename, THEME_SUFFIX);
}

// ─── loadThemeFile ────────────────────────────────────────────────────────────

/**
 * Load, validate, and resolve a single `.triton-theme.json` file.
 *
 * Returns ok(ResolvedTheme) on success, err(...) on any failure.
 * Never throws.
 */
export function loadThemeFile(filePath: string): Result<ResolvedTheme> {
  // 1. Read file
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (cause) {
    return err('THEME_VALIDATION_ERROR', `Cannot read theme file "${filePath}": ${String(cause)}`, cause);
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return err('THEME_VALIDATION_ERROR', `Invalid JSON in theme file "${filePath}": ${String(cause)}`, cause);
  }

  // 3. Validate against ThemeInput schema (strict — unknown keys are errors)
  const validated = validateThemeInput(parsed);
  if (!validated.ok) {
    return err(
      'THEME_VALIDATION_ERROR',
      `Theme file "${filePath}" failed validation: ${validated.error.message}`,
      validated.error,
    );
  }

  // 4. Resolve over declared base (or 'default' if absent)
  const input = validated.value;
  const baseName = (parsed as Record<string, unknown>)['base'] as string | undefined ?? 'default';
  const base = getThemePreset(baseName);
  const resolved = resolveTheme(input, base);

  return ok(resolved);
}

// ─── discoverThemes ───────────────────────────────────────────────────────────

/**
 * Scan `dir` for all `.triton-theme.json` files, load and resolve each one,
 * and return a name→ResolvedTheme map plus any warnings for skipped files.
 *
 * Rules (Cristian's decisions):
 *  - Name = the theme's `name` field if present; else derived from filename.
 *  - Derived name must satisfy slug rule; if not → warning + skipped.
 *  - If name is a built-in preset name → warning + skipped (no shadowing).
 *  - Duplicate custom name within same dir → last wins + warning.
 *  - Errors (bad JSON, validation failure) → warning + skipped. Never throws.
 */
export function discoverThemes(dir: string): ThemeDiscoveryResult {
  const themes = new Map<string, ResolvedTheme>();
  const warnings: string[] = [];

  // Gracefully handle missing / unreadable directory
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (cause) {
    // A missing directory is the normal case (project has no custom themes) —
    // not a warning. Only surface genuinely unreadable/invalid paths (EACCES, ENOTDIR, …).
    const code = (cause as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      warnings.push(`Cannot read themes directory "${dir}": ${String(cause)}`);
    }
    return { themes, warnings };
  }

  const themeFiles = entries.filter(e => e.endsWith(THEME_SUFFIX));

  for (const filename of themeFiles) {
    const filePath = join(dir, filename);

    // Load + validate + resolve
    const result = loadThemeFile(filePath);
    if (!result.ok) {
      warnings.push(result.error.message);
      continue;
    }

    const resolved = result.value;

    // Determine registered name:
    //   - declared `name` field in the file → use it (already validated as a slug)
    //   - no `name` field → derive from filename
    // We re-read the raw name field here rather than relying on resolved.name,
    // because resolveTheme always fills name from the base preset when absent.
    const name: string = extractNameFromFile(filePath) ?? deriveNameFromFilename(filename);

    // Validate slug rule on derived name
    if (!SLUG.test(name)) {
      warnings.push(`Theme file "${filename}": derived name "${name}" is not a valid slug (^[a-z0-9-]+$); skipped`);
      continue;
    }

    // Built-in collision check
    if (isBuiltinThemeName(name)) {
      warnings.push(`Theme "${name}" shadows a built-in preset; skipped`);
      continue;
    }

    // Duplicate within same dir → last wins + warning
    if (themes.has(name)) {
      warnings.push(`Duplicate theme name "${name}": "${filename}" overrides an earlier definition`);
    }

    themes.set(name, resolved);
  }

  return { themes, warnings };
}

// ─── extractNameFromFile ──────────────────────────────────────────────────────

/** Read the `name` field directly from the raw JSON (returns null if absent or unreadable). */
function extractNameFromFile(filePath: string): string | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed['name'] === 'string' ? parsed['name'] as string : null;
  } catch {
    return null;
  }
}

// ─── findTritonThemesDir ──────────────────────────────────────────────────────

/**
 * Walk up from `startDir` looking for a `.triton/themes/` directory.
 * Returns its absolute path when found, or undefined if not found.
 *
 * Stops at the filesystem root or after 10 levels (infinite-loop guard).
 */
export function findTritonThemesDir(startDir: string): string | undefined {
  const MAX_LEVELS = 10;
  let current = resolve(startDir);

  for (let level = 0; level < MAX_LEVELS; level++) {
    const candidate = join(current, '.triton', 'themes');
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
