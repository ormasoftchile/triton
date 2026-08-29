import type { ResolvedTheme, ThemeInput } from '../contracts/index.js';

/**
 * Merge a partial ThemeInput over a base ResolvedTheme.
 * Only present fields override the base — absent fields keep the base value.
 */
export function resolveTheme(input: ThemeInput, base: ResolvedTheme): ResolvedTheme {
  const baseNodes = base.nodes;
  const inputNodes = input.nodes;
  const nodes =
    baseNodes || inputNodes
      ? {
          standard: {
            ...(baseNodes?.standard ?? { borderWidth: 1.5, cornerRadius: 6, padding: 12 }),
            ...inputNodes?.standard,
          },
          leaf: {
            ...(baseNodes?.leaf ?? { borderWidth: 1.2, cornerRadius: 18, padding: 10 }),
            ...inputNodes?.leaf,
          },
          datastore: {
            ...(baseNodes?.datastore ?? { borderWidth: 1.5, padding: 12 }),
            ...inputNodes?.datastore,
          },
        }
      : undefined;

  return {
    name: input.name ?? base.name,
    palette: { ...base.palette, ...input.palette },
    typography: { ...base.typography, ...input.typography },
    spacing: { ...base.spacing, ...input.spacing },
    edges: { ...base.edges, ...input.edges },
    panel: { ...base.panel, ...input.panel },
    ...(nodes !== undefined ? { nodes } : {}),
  };
}
