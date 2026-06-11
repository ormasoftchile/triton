/**
 * @file asset-loader.ts — Synchronous image-asset resolver for the render pipeline.
 *
 * Resolves a logo `src` string (from `metadata.logo.src`) into an embedded
 * base64 data URI suitable for use in `ImagePrimitive.data`.  Embedding the
 * bytes at layout time satisfies the byte-determinism contract: the Scene
 * contains the actual image bytes, so all backends produce identical output
 * for a given input document + asset.
 *
 * PATH RESOLUTION
 * ---------------
 * Relative paths are resolved against the supplied `baseDir` (defaults to
 * `process.cwd()`).  Callers that know the on-disk location of the input
 * document SHOULD pass its directory as `baseDir` for portable resolution.
 *
 * SUPPORTED FORMATS
 * -----------------
 * .png  → image/png
 * .jpg / .jpeg → image/jpeg
 * .gif  → image/gif
 * .webp → image/webp
 * .svg  → image/svg+xml  (SVG + Skia backends only; PNG/resvg may skip)
 *
 * GRACEFUL FAILURE
 * ----------------
 * Returns `null` on any failure (missing file, unsupported extension, I/O
 * error) so callers can silently skip the logo without crashing.
 */

import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// MIME type map — keyed by lowercase extension
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
  '.gif':  'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg':  'image/jpeg',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LoadedAsset {
  /** Base64-encoded `data:` URI ready for use in `ImagePrimitive.data`. */
  dataUri: string;
  /** Extracted MIME type (e.g. `image/png`). */
  mimeType: string;
}

/**
 * Resolve `src` to a base64 `data:` URI.
 *
 * @param src      Logo asset reference — either a filesystem path or an
 *                 already-embedded `data:` URI.
 * @param baseDir  Directory used to resolve relative paths.  Defaults to
 *                 `process.cwd()`.  Pass the directory of the input document
 *                 for portable path resolution.
 * @returns        `LoadedAsset` on success, `null` on any failure.
 */
export function loadImageAsset(src: string, baseDir?: string): LoadedAsset | null {
  if (!src) return null;

  // ── Already a data URI — extract MIME type and return as-is ──────────────
  if (src.startsWith('data:')) {
    const mimeMatch = src.match(/^data:([^;,]+)[;,]/);
    const mimeType  = mimeMatch?.[1] ?? 'application/octet-stream';
    return { dataUri: src, mimeType };
  }

  // ── Filesystem path ───────────────────────────────────────────────────────
  try {
    const base    = baseDir ?? process.cwd();
    const absPath = resolve(base, src);
    const ext     = extname(absPath).toLowerCase();
    const mimeType = MIME_MAP[ext];

    if (!mimeType) {
      // Unsupported extension — skip gracefully (no crash, no noise)
      return null;
    }

    const bytes  = readFileSync(absPath);
    const b64    = bytes.toString('base64');
    const dataUri = `data:${mimeType};base64,${b64}`;
    return { dataUri, mimeType };
  } catch {
    // I/O error (file not found, permission denied, etc.) — skip gracefully
    return null;
  }
}
