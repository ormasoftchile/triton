/**
 * @file themes/index.ts — Theme registry and resolver.
 *
 * `resolveTheme(id)` is the single entry point for the layout engine to
 * obtain a fully-expanded ResolvedTheme.  It is pure: no I/O, no system
 * calls.
 */

import { consultingTheme } from './consulting.js';
import type { ResolvedTheme } from './types.js';

export type { ResolvedTheme } from './types.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY = new Map<string, ResolvedTheme>([
  ['consulting', consultingTheme],
  ['default',    consultingTheme],  // Phase 1 alias; extended in later phases
]);

/**
 * Resolve a theme identifier to a `ResolvedTheme`.
 *
 * Falls back to the 'consulting' theme for any unknown id so that callers
 * never receive null; a warning is the appropriate signal for callers that
 * care.
 *
 * @param id  Theme identifier (e.g. 'consulting', 'default').  Case-sensitive.
 */
export function resolveTheme(id: string): ResolvedTheme {
  return REGISTRY.get(id) ?? consultingTheme;
}
