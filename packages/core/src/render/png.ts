/**
 * @file render/png.ts — SVG → PNG rasteriser using @resvg/resvg-js.
 *
 * Uses the bundled DejaVu Sans font (src/fonts/DejaVuSans.ttf) and sets
 * `loadSystemFonts: false` so that text shaping is identical on every
 * platform.  This satisfies the §5.1 determinism contract for rasterisation.
 *
 * CONTRACT: returns `Uint8Array` — no process spawning, no file I/O beyond
 * the font file lookup at call time.
 *
 * NOTE: exact layout-vs-resvg glyph-advance parity (HarfBuzz vs the metrics
 * table in fonts/metrics.ts) is a known follow-up item (§5.8 HarfBuzz flag).
 * For MVP, the same font binary is used by both layout and rasterisation,
 * giving visually consistent output.
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Font discovery (handles both src/ and dist/ locations)
// ---------------------------------------------------------------------------

function findFontPath(): string {
  // __filename equivalent for ESM
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir  = dirname(thisFile);

  // Try: sibling fonts/ directory (works when running from src/render/)
  const candidate1 = resolve(join(thisDir, '..', 'fonts', 'DejaVuSans.ttf'));
  try {
    readFileSync(candidate1);  // probe only
    return candidate1;
  } catch {
    // not found at this path
  }

  // Try: from dist/render/ → ../../src/fonts/ (works after `pnpm build`)
  const candidate2 = resolve(join(thisDir, '..', '..', 'src', 'fonts', 'DejaVuSans.ttf'));
  try {
    readFileSync(candidate2);
    return candidate2;
  } catch {
    // not found here either
  }

  // Try: from dist/render/ → ../fonts/ (if fonts were copied to dist/fonts/)
  const candidate3 = resolve(join(thisDir, '..', 'fonts', 'DejaVuSans.ttf'));
  return candidate3; // best-effort; will throw at rasterisation time if missing
}

let _cachedFontPath: string | undefined;

function getFontPath(): string {
  if (!_cachedFontPath) {
    _cachedFontPath = findFontPath();
  }
  return _cachedFontPath;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rasterise an SVG string to a PNG byte array.
 *
 * @param svg       The SVG string to rasterise (output of `sceneToSvg`).
 * @param fontPath  Optional explicit path to a TTF/OTF font file.  When
 *                  omitted, the bundled DejaVu Sans font is used.
 * @param scale     Optional zoom factor for high-DPI output (e.g. 2 or 3).
 *                  Uses resvg's fitTo zoom mode. Default: 1 (no scaling).
 */
export function svgToPng(svg: string, fontPath?: string, scale?: number): Uint8Array {
  const resolvedFontPath = fontPath ?? getFontPath();
  const zoom = (scale !== undefined && scale > 0) ? scale : 1;

  const resvg = new Resvg(svg, {
    font: {
      fontFiles:        [resolvedFontPath],
      loadSystemFonts:  false,
      defaultFontFamily: 'DejaVu Sans',
    },
    shapeRendering: 2,   // geometricPrecision
    textRendering:  2,   // geometricPrecision
    ...(zoom !== 1 ? { fitTo: { mode: 'zoom' as const, value: zoom } } : {}),
  });

  const rendered = resvg.render();
  const pngBuffer = rendered.asPng();
  return new Uint8Array(pngBuffer);
}
