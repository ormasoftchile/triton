/**
 * Diagram Registry
 *
 * Central registry of all available diagram modules.
 * Built-in modules are registered in frontend/index.ts at startup.
 * Third-party diagrams call registerDiagram() from their own package.
 *
 * The registry stores modules as DiagramModule<any> internally to handle
 * the contravariance of layout()'s IR parameter. Type safety is preserved
 * at registration time via the generic constraint on registerDiagram().
 */

import type { DiagramKind, DiagramModule, BaseIR } from '../contracts/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = DiagramModule<any>;

const registry = new Map<DiagramKind, AnyModule>();

/** Register a diagram module under the given kind key. */
export function registerDiagram<IR extends BaseIR>(
  kind: DiagramKind,
  module: DiagramModule<IR>,
): void {
  registry.set(kind, module as AnyModule);
}

/** Look up a registered diagram module by kind. Returns undefined if not found. */
export function getModule(kind: DiagramKind): AnyModule | undefined {
  return registry.get(kind);
}

/** Return all currently registered diagram kind strings. */
export function registeredKinds(): DiagramKind[] {
  return [...registry.keys()];
}
