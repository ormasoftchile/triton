/**
 * @file theme-contract/resolve.ts — resolveContractTheme: density + token override helper.
 *
 * This helper is the single point of authority for applying user-specified
 * config-surface overrides onto a named Tier-2 contract theme before any
 * component binding occurs.  It is deterministic and pure: same inputs →
 * same output.
 *
 * Usage:
 *   const contract = resolveContractTheme('midnight', {
 *     density: 'compact',
 *     overrides: { accent: '#0A7F6F', palette: { ink: '#E0E0E0' } },
 *   });
 *   const componentTheme = bindFlowTheme(contract);
 *
 * Config-surface precedence (managed by the caller):
 *   options.density > frontmatter `density:` > %%{init}%% density > theme default
 *   options.overrides merged with frontmatter `themeOverrides:` + %%{init}%% overrides
 *
 * Note: imports themes directly (not through index.ts) to avoid circular deps.
 */

import type { ThemeContract, Density } from './types.js';
import { executive } from './executive.js';
import { midnight }  from './midnight.js';
import { blueprint } from './blueprint.js';
import { editorial } from './editorial.js';
import { terminal }  from './terminal.js';
import { pastel }    from './pastel.js';
import { mono }      from './mono.js';

// ---------------------------------------------------------------------------
// Internal registry (avoids circular import with index.ts)
// ---------------------------------------------------------------------------

const REGISTRY: Record<string, ThemeContract> = {
  executive,
  midnight,
  blueprint,
  editorial,
  terminal,
  pastel,
  mono,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Options accepted by resolveContractTheme. */
export interface ResolveContractOptions {
  /**
   * Density override.  When provided, replaces the theme's own `density` field.
   * Invalid values are silently ignored (caller should validate before passing).
   */
  density?: Density;
  /**
   * Token overrides.  Deep-merged onto the resolved ThemeContract.
   * Supports shorthand flat keys (see SHORTHAND_MAP below) and nested paths
   * that follow the ThemeContract structure directly (e.g. `{ palette: { accent: '#0A7' } }`).
   * Unknown keys are ignored without error (standard Mermaid graceful-degradation policy).
   */
  overrides?: Record<string, unknown>;
}

/**
 * Resolve a named contract theme with optional density override and token patches.
 *
 * Returns the base ThemeContract (unchanged) if no density/overrides are provided,
 * so this function is safe to call unconditionally for all contract-theme branches.
 *
 * @throws {Error} if `name` is not a registered contract theme.
 */
export function resolveContractTheme(
  name: string,
  { density, overrides }: ResolveContractOptions = {},
): ThemeContract {
  const base = REGISTRY[name];
  if (!base) {
    throw new Error(
      `[resolveContractTheme] Unknown contract theme: "${name}". ` +
      `Registered themes: ${Object.keys(REGISTRY).join(', ')}.`,
    );
  }

  // Fast path: no modifications requested
  if (density === undefined && (overrides === undefined || Object.keys(overrides).length === 0)) {
    return base;
  }

  let contract: ThemeContract = base;

  // 1. Apply density override
  if (density !== undefined) {
    contract = { ...contract, density };
  }

  // 2. Apply token overrides (expand shorthands → deep-merge)
  if (overrides !== undefined && Object.keys(overrides).length > 0) {
    const expanded = expandShorthands(overrides);
    contract = deepMerge(contract as unknown as Record<string, unknown>, expanded) as unknown as ThemeContract;
  }

  return contract;
}

// ---------------------------------------------------------------------------
// Shorthand key expansion
// ---------------------------------------------------------------------------

/**
 * Flat shorthand keys → nested ThemeContract paths.
 *
 * These are convenience aliases so users can write:
 *   themeOverrides: { accent: "#0A7" }
 * instead of:
 *   themeOverrides: { palette: { accent: "#0A7" } }
 *
 * Keys NOT in this map are treated as direct nested ThemeContract paths and
 * are deep-merged without transformation (unknown keys are silently ignored
 * by the deep-merge because they land on properties that don't exist).
 */
const SHORTHAND_MAP: Record<string, [string, string]> = {
  accent:       ['palette', 'accent'],
  accentMuted:  ['palette', 'accentMuted'],
  accentStrong: ['palette', 'accentStrong'],
  surface:      ['palette', 'surface'],
  surfaceRaised:['palette', 'surfaceRaised'],
  ink:          ['palette', 'ink'],
  inkMuted:     ['palette', 'inkMuted'],
  inkInverse:   ['palette', 'inkInverse'],
  border:       ['palette', 'border'],
  borderStrong: ['palette', 'borderStrong'],
  muted:        ['palette', 'muted'],
  mutedStrong:  ['palette', 'mutedStrong'],
  fontFamily:   ['typography', 'family'],
  cornerRadius: ['shape', 'cornerRadius'],
  nodePadding:  ['shape', 'nodePadding'],
  strokeScale:  ['shape', 'strokeScale'],
};

/**
 * Expand shorthand flat keys into nested ThemeContract paths.
 * Non-shorthand keys are left as-is (they will be deep-merged as nested paths).
 */
function expandShorthands(overrides: Record<string, unknown>): Record<string, unknown> {
  const expanded: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(overrides)) {
    const mapping = SHORTHAND_MAP[key];
    if (mapping !== undefined) {
      // Expand shorthand: { accent: "#0A7" } → { palette: { accent: "#0A7" } }
      const [section, field] = mapping;
      if (typeof expanded[section] !== 'object' || expanded[section] === null) {
        expanded[section] = {};
      }
      (expanded[section] as Record<string, unknown>)[field] = value;
    } else {
      // Pass through as-is (may be a nested ThemeContract path or an unknown key)
      expanded[key] = value;
    }
  }

  return expanded;
}

// ---------------------------------------------------------------------------
// Deep merge
// ---------------------------------------------------------------------------

/**
 * Deterministic deep merge: source properties recursively overwrite target.
 * Arrays are replaced (not concatenated).  Null values in source are applied.
 * Primitive source values overwrite regardless of target type.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const targetVal = result[key];
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      // Both sides are plain objects: recurse
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      // Primitive, array, or null: source wins
      result[key] = value;
    }
  }

  return result as T;
}
