/**
 * @file render/index.ts — `buildScene` + `renderDocument` / `renderDocumentAsync`
 *
 * Wires together:
 *   resolveTheme  → ResolvedTheme
 *   layout        → Scene          (via buildScene)
 *   sceneToSvg    → SVG string
 *   svgToPng      → Uint8Array     (resvg path, default)
 *   sceneToPngSkia→ Uint8Array     (Skia path, when backend='skia')
 *   sceneHash     → deterministic hash
 *
 * BACKEND SELECTION
 * -----------------
 *  SVG path (default):  renderDocument(ir, {format:'svg'}) → RenderResult (sync)
 *  resvg PNG path:      renderDocument(ir, {format:'png'}) → RenderResult (sync)
 *  Skia PNG path:       renderDocumentAsync(ir, {format:'png', backend:'skia'})
 *                       → Promise<RenderResult>
 *
 * The SVG golden and the resvg PNG path are UNCHANGED.  `renderDocument` is
 * still synchronous for all non-Skia calls.  `renderDocumentAsync` wraps
 * the sync path in a resolved Promise for uniformity.
 */

import type { IRDocument, RenderOptions, RenderResult } from '../types.js';
import type { Scene } from '../scene.js';
import { resolveTheme }    from '../themes/index.js';
import { layout }          from '../layout/index.js';
import { sceneToSvg }      from './svg.js';
import { svgToPng }        from './png.js';
import { sceneToPngSkia }  from './skia.js';
import { sceneHash }       from '../scene.js';

// ---------------------------------------------------------------------------
// Extended options for buildScene (rendering concern — not part of IR schema)
// ---------------------------------------------------------------------------

/**
 * Options for `buildScene`.  Extends the public `RenderOptions` subset with
 * rendering-only concerns (e.g. asset path resolution) that do not belong in
 * the IR schema (`types.ts`).
 */
export interface BuildSceneOptions {
  theme?: string;
  layout?: 'horizontal' | 'vertical-spine' | 'serpentine' | 'roadmap';
  spineSpacing?: 'time' | 'even';
  /**
   * Base directory for resolving relative asset paths in `metadata.logo.src`
   * (and future asset references).  Defaults to `process.cwd()`.
   *
   * Callers that know the on-disk location of the input document SHOULD pass
   * its directory here so that relative logo paths resolve correctly regardless
   * of the process working directory.
   */
  baseDir?: string;
}

/**
 * Compute the Scene (layout IR) for an IRDocument without rendering to any
 * output format.  Consumers (linter, tests, tooling) can inspect geometry
 * without parsing SVG.
 */
export function buildScene(
  ir: IRDocument,
  options?: BuildSceneOptions | Pick<RenderOptions, 'theme' | 'layout' | 'spineSpacing'>,
): Scene {
  const opts = options as BuildSceneOptions | undefined;
  const themeId = opts?.theme ?? ir.metadata.theme ?? 'default';
  let theme = resolveTheme(themeId);
  // Apply render-level overrides that supersede the theme declaration.
  if (opts?.spineSpacing !== undefined) {
    theme = { ...theme, spineSpacing: opts.spineSpacing };
  }
  return layout(ir, theme, opts?.layout ?? ir.metadata.layout, opts?.baseDir);
}

/**
 * Render an IRDocument to SVG and/or PNG (synchronous, SVG + resvg-PNG path).
 *
 * When `options.backend === 'skia'` AND `options.format === 'png'`, this
 * function returns the Scene hash and SVG but does NOT produce Skia PNG bytes
 * (use `renderDocumentAsync` for that).  All other combinations are handled
 * synchronously and are byte-identical to previous behaviour.
 *
 * Pass `baseDir` (via a `BuildSceneOptions`-extended options object) to
 * control asset path resolution for `metadata.logo.src`.
 */
export function renderDocument(ir: IRDocument, options: RenderOptions & { baseDir?: string }): RenderResult {
  const scene = buildScene(ir, { theme: options.theme, layout: options.layout, spineSpacing: options.spineSpacing, baseDir: options.baseDir });
  const svg   = sceneToSvg(scene);
  const hash  = sceneHash(scene);

  if (options.format === 'png') {
    if (options.backend !== 'skia') {
      // Default resvg path — synchronous, byte-identical to before.
      const png = svgToPng(svg);
      return { format: 'png', svg, png, sceneHash: hash };
    }
    // Skia path: caller must use renderDocumentAsync for actual PNG bytes.
    // Return result without png bytes (callers that need bytes use async).
    return { format: 'png', svg, sceneHash: hash };
  }

  return { format: 'svg', svg, sceneHash: hash };
}

/**
 * Async render entry point — handles all backends uniformly.
 *
 * When `options.format === 'png' && options.backend === 'skia'`, this
 * initialises CanvasKit (once, memoised) and renders via the Skia backend.
 * All other combinations delegate to the synchronous `renderDocument` path
 * and return a resolved Promise.
 *
 * Use this function in the CLI and in Skia tests.
 * Pass `baseDir` to control asset path resolution for `metadata.logo.src`.
 */
export async function renderDocumentAsync(ir: IRDocument, options: RenderOptions & { baseDir?: string }): Promise<RenderResult> {
  const scene = buildScene(ir, { theme: options.theme, layout: options.layout, spineSpacing: options.spineSpacing, baseDir: options.baseDir });
  const svg   = sceneToSvg(scene);
  const hash  = sceneHash(scene);

  if (options.format === 'png') {
    if (options.backend === 'skia') {
      const png = await sceneToPngSkia(scene);
      return { format: 'png', svg, png, sceneHash: hash };
    }
    // Default resvg path
    const png = svgToPng(svg);
    return { format: 'png', svg, png, sceneHash: hash };
  }

  return { format: 'svg', svg, sceneHash: hash };
}
