/**
 * latex/src/theme-resolve.ts
 *
 * Standalone theme-resolution logic for the triton-latex CLI.
 *
 * Intentionally imports ONLY Node built-ins and packages under ../../src/**
 * (the Triton core compiler). It does NOT import ./pdf.ts or any latex-only
 * dependency (pdfkit, svg-to-pdfkit), so it can be imported by vitest at root
 * `pnpm test` time without installing latex's isolated node_modules.
 *
 * Resolution priority (same as the CLI flag semantics):
 *   1. themeFile → loadThemeFile that path; throw on error (caller handles exit).
 *   2. Build registry: auto-discover .triton/themes/ ancestor + themesDir overlay.
 *      theme → registry lookup, then fall back to built-in preset.
 *   3. No args set → undefined (core uses frontmatter / default preset).
 */

import { resolve } from 'node:path';
import type { ResolvedTheme } from '../../src/contracts/theme.js';
import { loadThemeFile, discoverThemes, findTritonThemesDir } from '../../src/theme/discover.js';
import { getThemePreset } from '../../src/theme/preset.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Minimal parameter interface for the theme-resolution inputs.
 * A superset of this (e.g. the full CLI Args) satisfies it structurally.
 */
export interface ThemeArgs {
  themeFile?: string;
  themesDir?: string;
  theme?: string;
}

// ─── resolveCliTheme ──────────────────────────────────────────────────────────

/**
 * Resolve the theme to apply for a render, honouring flag priority:
 *
 *   1. themeFile → load that exact file; THROWS on error (no process.exit here —
 *      the CLI entry point wraps calls in try/catch and exits with code 1).
 *   2. Build registry: auto-discover .triton/themes/ ancestor from `inputDir`,
 *      then overlay themesDir. Use `theme` to select by name (registry first,
 *      then built-in preset fallback).
 *   3. No args set → undefined (core uses diagram frontmatter / default preset).
 *
 * `inputDir` is the directory of the diagram being rendered, used for walk-up
 * auto-discovery. Never calls process.exit — never throws except on a bad
 * themeFile path (so the caller can catch and surface cleanly).
 */
export function resolveCliTheme(
  args: ThemeArgs,
  inputDir: string,
): ResolvedTheme | undefined {
  // Priority 1: explicit theme file
  if (args.themeFile) {
    const result = loadThemeFile(resolve(args.themeFile));
    if (!result.ok) {
      throw new Error(`--theme-file: ${result.error.message}`);
    }
    return result.value;
  }

  // Priority 2: build name registry
  const registry = new Map<string, ResolvedTheme>();

  // Auto-discover .triton/themes/ walking up from inputDir
  const autoDir = findTritonThemesDir(inputDir);
  if (autoDir) {
    const { themes, warnings } = discoverThemes(autoDir);
    for (const [name, theme] of themes) registry.set(name, theme);
    for (const w of warnings) console.error(`warning: ${w}`);
  }

  // themesDir override (merged on top; overrides auto on collision)
  if (args.themesDir) {
    const { themes, warnings } = discoverThemes(resolve(args.themesDir));
    for (const [name, theme] of themes) registry.set(name, theme);
    for (const w of warnings) console.error(`warning: ${w}`);
  }

  // theme <name>: registry first, then built-in preset
  if (args.theme) {
    if (registry.has(args.theme)) {
      return registry.get(args.theme)!;
    }
    // Falls back to built-in preset (getThemePreset returns default if unknown)
    return getThemePreset(args.theme);
  }

  // No theme flags — core decides
  return undefined;
}
