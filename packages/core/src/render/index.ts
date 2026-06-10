/**
 * @file render/index.ts — `renderDocument` — the primary rendering entry point.
 *
 * Wires together:
 *   resolveTheme  → ResolvedTheme
 *   layout        → Scene
 *   sceneToSvg    → SVG string
 *   svgToPng      → Uint8Array  (when format === 'png')
 *   sceneHash     → deterministic hash
 *
 * This module does NOT modify api.ts / index.ts — Leslie wires the public
 * render() function in Wave 2.  Tests import renderDocument directly.
 */

import type { IRDocument, RenderOptions, RenderResult } from '../types.js';
import { resolveTheme } from '../themes/index.js';
import { layout }        from '../layout/index.js';
import { sceneToSvg }    from './svg.js';
import { svgToPng }      from './png.js';
import { sceneHash }     from '../scene.js';

/**
 * Render an IRDocument to SVG and/or PNG.
 *
 * @param ir       Validated IRDocument (version must be "1.0").
 * @param options  Render options: format, theme id, and optional tier.
 * @returns        RenderResult with `svg` always populated; `png` populated
 *                 when `options.format === 'png'`.  `sceneHash` is always set.
 */
export function renderDocument(ir: IRDocument, options: RenderOptions): RenderResult {
  // 1. Resolve theme
  const themeId = options.theme ?? ir.metadata.theme ?? 'default';
  const theme   = resolveTheme(themeId);

  // 2. Layout → Scene
  const scene = layout(ir, theme, options.layout);

  // 3. Scene → SVG string
  const svg = sceneToSvg(scene);

  // 4. Compute deterministic hash
  const hash = sceneHash(scene);

  // 5. Rasterise if PNG requested
  if (options.format === 'png') {
    const png = svgToPng(svg);
    return { format: 'png', svg, png, sceneHash: hash };
  }

  return { format: 'svg', svg, sceneHash: hash };
}
