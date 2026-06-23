import type { ResolvedTheme, ThemeInput } from '../contracts/index.js';

/**
 * Merge a partial ThemeInput over a base ResolvedTheme.
 * Only present fields override the base — absent fields keep the base value.
 */
export function resolveTheme(input: ThemeInput, base: ResolvedTheme): ResolvedTheme {
  return {
    name:       input.name       ?? base.name,
    palette:    { ...base.palette,    ...input.palette },
    typography: { ...base.typography, ...input.typography },
    spacing:    { ...base.spacing,    ...input.spacing },
    edges:      { ...base.edges,      ...input.edges },
    panel:      { ...base.panel,      ...input.panel },
  };
}
