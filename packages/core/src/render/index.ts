/**
 * @file render/index.ts — `buildScene` + `renderDocument` — primary rendering entry points.
 *
 * Wires together:
 *   resolveTheme  → ResolvedTheme
 *   layout        → Scene          (via buildScene)
 *   sceneToSvg    → SVG string
 *   svgToPng      → Uint8Array     (when format === 'png')
 *   sceneHash     → deterministic hash
 *
 * `buildScene` is the single path through the layout pipeline; `renderDocument`
 * calls it internally so there is exactly ONE layout code-path.
 *
 * This module does NOT modify api.ts / index.ts — Leslie wires the public
 * render() function in Wave 2.  Tests import renderDocument directly.
 */

import type { IRDocument, RenderOptions, RenderResult } from '../types.js';
import type { Scene } from '../scene.js';
import { resolveTheme } from '../themes/index.js';
import { layout }        from '../layout/index.js';
import { sceneToSvg }    from './svg.js';
import { svgToPng }      from './png.js';
import { sceneHash }     from '../scene.js';

/**
 * Compute the Scene (layout IR) for an IRDocument without rendering to any
 * output format.  Consumers (linter, tests, tooling) can inspect geometry
 * without parsing SVG.
 *
 * @param ir       IRDocument (should be valid; layout errors surface as thrown exceptions).
 * @param options  Subset of RenderOptions: theme and layout family only.
 *                 `format` is ignored — no serialisation is performed.
 * @returns        Fully-computed Scene ready for backend serialisation or linting.
 */
export function buildScene(ir: IRDocument, options?: Pick<RenderOptions, 'theme' | 'layout'>): Scene {
  const themeId = options?.theme ?? ir.metadata.theme ?? 'default';
  const theme   = resolveTheme(themeId);
  return layout(ir, theme, options?.layout);
}

/**
 * Render an IRDocument to SVG and/or PNG.
 *
 * @param ir       Validated IRDocument (version must be "1.0").
 * @param options  Render options: format, theme id, and optional tier.
 * @returns        RenderResult with `svg` always populated; `png` populated
 *                 when `options.format === 'png'`.  `sceneHash` is always set.
 */
export function renderDocument(ir: IRDocument, options: RenderOptions): RenderResult {
  // 1. Layout → Scene (single code path via buildScene)
  const scene = buildScene(ir, { theme: options.theme, layout: options.layout });

  // 2. Scene → SVG string
  const svg = sceneToSvg(scene);

  // 3. Compute deterministic hash
  const hash = sceneHash(scene);

  // 4. Rasterise if PNG requested
  if (options.format === 'png') {
    const png = svgToPng(svg);
    return { format: 'png', svg, png, sceneHash: hash };
  }

  return { format: 'svg', svg, sceneHash: hash };
}
