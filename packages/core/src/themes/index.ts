/**
 * @file themes/index.ts — Theme registry and resolver.
 *
 * `resolveTheme(id)` is the single entry point for the layout engine to
 * obtain a fully-expanded ResolvedTheme.  It is pure: no I/O, no system
 * calls.
 */

import { consultingTheme } from './consulting.js';
import { executiveTheme }  from './executive.js';
import { minimalTheme }    from './minimal.js';
import { productTheme }    from './product.js';
import { releaseTheme }    from './release.js';
import { showcaseTheme }   from './showcase.js';
import { aiTimelineTheme } from './ai-timeline.js';
import { gitlineTheme }    from './gitline.js';
import { ourTimelineTheme } from './our-timeline.js';
import type { ResolvedTheme } from './types.js';

export type { ResolvedTheme } from './types.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY = new Map<string, ResolvedTheme>([
  ['consulting',    consultingTheme],
  ['default',       consultingTheme],  // Phase 1 alias
  ['executive',     executiveTheme],
  ['minimal',       minimalTheme],
  ['product',       productTheme],
  ['release',       releaseTheme],
  ['showcase',      showcaseTheme],
  ['ai-timeline',   aiTimelineTheme],
  ['gitline',       gitlineTheme],
  ['our-timeline',  ourTimelineTheme],
]);

/**
 * Resolve a theme identifier to a `ResolvedTheme`.
 *
 * Falls back to the 'consulting' theme for any unknown id so that callers
 * never receive null; a warning is the appropriate signal for callers that
 * care.
 *
 * @param id  Theme identifier (e.g. 'consulting', 'executive').  Case-sensitive.
 */
export function resolveTheme(id: string): ResolvedTheme {
  return REGISTRY.get(id) ?? consultingTheme;
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
    { id: 'consulting',   title: 'Consulting',   tier: 1 },
    { id: 'default',      title: 'Default',      tier: 1 },  // alias for consulting
    { id: 'minimal',      title: 'Minimal',      tier: 1 },
    { id: 'release',      title: 'Release',      tier: 1 },
    { id: 'our-timeline', title: 'Our Timeline', tier: 1 },
    { id: 'executive',    title: 'Executive',    tier: 2 },
    { id: 'product',      title: 'Product',      tier: 2 },
    { id: 'ai-timeline',  title: 'AI Timeline',  tier: 2 },
    { id: 'gitline',      title: 'Gitline',      tier: 2 },
    { id: 'showcase',     title: 'Showcase',     tier: 3 },
  ];
}
