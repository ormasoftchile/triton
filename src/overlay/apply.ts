/**
 * @file overlay/apply.ts — Uniform overlay application for layout engines.
 *
 * Every diagram layout ends the same way: if the IR carries overlays, compile
 * them, lay them out against the finished scene, and merge their elements +
 * expanded viewBox back in. This helper centralizes that tail so each layout
 * engine reduces to a single call.
 */

import type { RawOverlay, Scene, ResolvedTheme } from '../contracts/index.js';
import { compileOverlays } from './compiler.js';
import { layoutOverlays } from './layout.js';

/**
 * Return a scene with the IR's overlays merged in. When there are no overlays
 * the input scene is returned unchanged.
 */
export function applyOverlays(
  scene: Scene,
  overlays: readonly RawOverlay[] | undefined,
  theme: ResolvedTheme,
): Scene {
  if (!overlays || overlays.length === 0) return scene;
  const compiled = compileOverlays(overlays);
  const { elements, viewBox } = layoutOverlays(compiled, scene, theme);
  return { ...scene, elements: [...scene.elements, ...elements], viewBox };
}
