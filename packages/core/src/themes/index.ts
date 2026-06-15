/**
 * @file themes/index.ts — Theme registry and resolver.
 *
 * `resolveTheme(id)` is the single entry point for the layout engine to
 * obtain a fully-expanded ResolvedTheme.  It is pure: no I/O, no system
 * calls.
 *
 * ## Precedence rule (CRITICAL for determinism)
 *
 * 1. REGISTRY lookup — the 14 legacy timeline theme names always win.
 *    `executive` in the REGISTRY is the dark-navy legacy timeline theme;
 *    it ALWAYS resolves to that, NOT the contract-derived version.
 * 2. CONTRACT fallback — if the name is a registered Tier-2 contract theme
 *    AND not in the legacy REGISTRY, derive a ResolvedTheme via the
 *    timeline binding (`bindTimelineTheme`).
 * 3. DEFAULT fallback — unknown names resolve to `consultingTheme`.
 *
 * This guarantees ALL 14 legacy timeline goldens remain byte-identical.
 * Contract themes reach the timeline ONLY via non-legacy names (or when
 * `bindTimelineTheme()` is called DIRECTLY, bypassing name dispatch).
 */

import { consultingTheme } from './consulting.js';
import { executiveTheme } from './executive.js';
import { minimalTheme } from './minimal.js';
import { productTheme } from './product.js';
import { releaseTheme } from './release.js';
import { roadmapTheme } from './roadmap.js';
import { serpentineTheme } from './serpentine.js';
import { showcaseTheme } from './showcase.js';
import { aiTimelineTheme } from './ai-timeline.js';
import { gitlineTheme } from './gitline.js';
import { ourTimelineTheme } from './our-timeline.js';
import { subjectTimelineTheme } from './subject-timeline.js';
import { bytebyteGoTheme } from './bytebytego.js';
import { bindTimelineTheme } from './contract-binding.js';
import { isContractTheme, CONTRACT_THEMES } from '../theme-contract/index.js';
import type { ResolvedTheme } from './types.js';

export type { ResolvedTheme } from './types.js';
export { bindTimelineTheme } from './contract-binding.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY = new Map<string, ResolvedTheme>([
  ['consulting', consultingTheme],
  ['default', consultingTheme], // Phase 1 alias
  ['executive', executiveTheme],
  ['minimal', minimalTheme],
  ['product', productTheme],
  ['release', releaseTheme],
  ['roadmap', roadmapTheme],
  ['serpentine', serpentineTheme],
  ['showcase', showcaseTheme],
  ['ai-timeline', aiTimelineTheme],
  ['gitline', gitlineTheme],
  ['our-timeline', ourTimelineTheme],
  ['subject-timeline', subjectTimelineTheme],
  ['bytebytego', bytebyteGoTheme],
]);

/**
 * Resolve a theme identifier to a `ResolvedTheme`.
 *
 * ## Precedence (see module-level comment for full rationale):
 *   1. Legacy REGISTRY (14 named timeline themes) — always wins.
 *      `executive` in the REGISTRY is the dark-navy legacy theme; it is
 *      served from here, NEVER from the contract binding.
 *   2. Contract-path fallback — non-legacy contract theme names are derived
 *      via `bindTimelineTheme`.
 *   3. Default fallback — unknown names → `consultingTheme`.
 *
 * @param id  Theme identifier (e.g. 'consulting', 'executive').  Case-sensitive.
 */
export function resolveTheme(id: string): ResolvedTheme {
  // Step 1: Legacy REGISTRY — always wins.
  const legacy = REGISTRY.get(id);
  if (legacy) return legacy;

  // Step 2: Contract-path fallback — non-legacy contract theme names.
  // NOTE: `executive` never reaches here because it IS in REGISTRY.
  if (isContractTheme(id)) {
    return bindTimelineTheme(CONTRACT_THEMES[id]!);
  }

  // Step 3: Unknown — fall back to consulting.
  return consultingTheme;
}

// ---------------------------------------------------------------------------
// Theme metadata catalogue
// ---------------------------------------------------------------------------

/** Metadata record for a built-in theme. */
export interface ThemeInfo {
  id: string;
  title: string;
  /** Fidelity tier: 1 = Crisp, 2 = Polished. */
  tier: number;
}

/**
 * Return metadata for every registered theme.
 *
 * This is the authoritative source for `listThemes()` in api.ts; consumers
 * (CLI, MCP, schema) should call that instead.
 */
export function listThemeInfos(): ThemeInfo[] {
  return [
    { id: 'consulting', title: 'Consulting', tier: 1 },
    { id: 'default', title: 'Default', tier: 1 }, // alias for consulting
    { id: 'minimal', title: 'Minimal', tier: 1 },
    { id: 'release', title: 'Release', tier: 1 },
    { id: 'our-timeline', title: 'Our Timeline', tier: 1 },
    { id: 'executive', title: 'Executive', tier: 2 },
    { id: 'product', title: 'Product', tier: 2 },
    { id: 'roadmap', title: 'Roadmap', tier: 2 },
    { id: 'ai-timeline', title: 'AI Timeline', tier: 2 },
    { id: 'gitline', title: 'Gitline', tier: 2 },
    { id: 'subject-timeline', title: 'Subject Timeline', tier: 2 },
    { id: 'bytebytego', title: 'ByteByteGo Dark', tier: 2 },
    { id: 'serpentine', title: 'Serpentine Journey', tier: 3 },
    { id: 'showcase', title: 'Showcase', tier: 3 },
  ];
}
