/**
 * @file theme-contract/index.ts — Tier-2 theme contract public API.
 *
 * Exports:
 *   - ThemeContract interface (and all supporting types)
 *   - `executive` theme instance
 *   - `CONTRACT_THEMES` registry (name → ThemeContract)
 *   - `isContractTheme(name)` guard for opt-in wiring
 *
 * Note: `bindTimelineTheme` is exported from `themes/index.ts` (not here)
 * to avoid circular dependencies — the binding imports theme types from
 * `themes/types.ts` which must not re-import from this module.
 */

export type {
  ThemeContract,
  RolePalette,
  StatusRole,
  DataPalette,
  SequentialRamp,
  DivergingRamp,
  Typography,
  TypeScale,
  WeightSet,
  Spacing,
  SpacingSteps,
  Density,
  ShapeLanguage,
  ConnectorStyle,
  Effects,
  DropShadow,
  Glow,
  FidelityTier,
} from './types.js';

export { executive } from './executive.js';
export { midnight }  from './midnight.js';
export { blueprint } from './blueprint.js';
export { editorial } from './editorial.js';

import type { ThemeContract } from './types.js';
import { executive } from './executive.js';
import { midnight }  from './midnight.js';
import { blueprint } from './blueprint.js';
import { editorial } from './editorial.js';

/**
 * Registry of all contract-path named themes.
 * A theme name present in this map routes through the Tier-2 → Tier-3
 * binding path instead of the legacy per-component theme registry.
 *
 * Currently registered themes:
 *   executive — corporate navy/white, Georgia serif, comfortable, fidelity 2
 *   midnight  — dark charcoal/cyan, Inter sans, comfortable, fidelity 2
 *   blueprint — deep-blue/cyan, JetBrains Mono, normal density, fidelity 1
 *   editorial — warm cream/burgundy, Lora serif, comfortable, fidelity 2
 */
export const CONTRACT_THEMES: Record<string, ThemeContract> = {
  executive,
  midnight,
  blueprint,
  editorial,
};

/**
 * Returns true if `name` is a registered contract theme.
 * Use this in render dispatch to choose the contract-binding path.
 */
export function isContractTheme(name: string | undefined): name is string {
  return name !== undefined && Object.prototype.hasOwnProperty.call(CONTRACT_THEMES, name);
}
