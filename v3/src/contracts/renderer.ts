/**
 * Renderer
 *
 * Output-format contract. A Renderer transforms a resolved Scene into a
 * specific output format (SVG string, PNG buffer, Canvas draw calls…).
 *
 * Renderers are registered by name via the render registry. The default
 * renderer is 'svg'. Third-party output formats register themselves with
 * registerRenderer().
 *
 * Renderers know nothing about diagram types, themes, or IR shapes — they
 * consume only Scene, which is the universal render-ready representation.
 */

import type { Scene } from './scene.js';

export interface Renderer<Output = string> {
  /** Unique name used for renderer lookup, e.g. 'svg', 'png', 'canvas'. */
  readonly name: string;

  /** Transform a fully resolved Scene into the target output format. */
  render(scene: Scene): Output;
}
