/**
 * Renderer Registry
 *
 * Central registry of all available output renderers.
 * The built-in 'svg' renderer is registered in frontend/index.ts.
 * Third-party renderers (PNG, Canvas, PDF…) call registerRenderer().
 */

import type { Renderer } from '../contracts/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, Renderer<any>>();

/** Register an output renderer under its name. */
export function registerRenderer<Output>(renderer: Renderer<Output>): void {
  registry.set(renderer.name, renderer);
}

/** Look up a renderer by name. Returns undefined if not registered. */
export function getRenderer<Output = string>(name: string): Renderer<Output> | undefined {
  return registry.get(name) as Renderer<Output> | undefined;
}

/** Return all currently registered renderer names. */
export function registeredRenderers(): string[] {
  return [...registry.keys()];
}
