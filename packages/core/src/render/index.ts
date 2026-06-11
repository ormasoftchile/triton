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

/**
 * Compute the Scene (layout IR) for an IRDocument without rendering to any
 * output format.  Consumers (linter, tests, tooling) can inspect geometry
 * without parsing SVG.
 */
export function buildScene(
  ir: IRDocument,
  options?: Pick<RenderOptions, 'theme' | 'layout' | 'spineSpacing'>,
): Scene {
  const themeId = options?.theme ?? ir.metadata.theme ?? 'default';
  let theme = resolveTheme(themeId);
  // Apply render-level overrides that supersede the theme declaration.
  if (options?.spineSpacing !== undefined) {
    theme = { ...theme, spineSpacing: options.spineSpacing };
  }
  return layout(ir, theme, options?.layout);
}

/**
 * Render an IRDocument to SVG and/or PNG (synchronous, SVG + resvg-PNG path).
 *
 * When `options.backend === 'skia'` AND `options.format === 'png'`, this
 * function returns the Scene hash and SVG but does NOT produce Skia PNG bytes
 * (use `renderDocumentAsync` for that).  All other combinations are handled
 * synchronously and are byte-identical to previous behaviour.
 */
export function renderDocument(ir: IRDocument, options: RenderOptions): RenderResult {
  const scene = buildScene(ir, { theme: options.theme, layout: options.layout, spineSpacing: options.spineSpacing });
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
 */
export async function renderDocumentAsync(ir: IRDocument, options: RenderOptions): Promise<RenderResult> {
  const scene = buildScene(ir, { theme: options.theme, layout: options.layout, spineSpacing: options.spineSpacing });
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

