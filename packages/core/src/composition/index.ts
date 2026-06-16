/**
 * @file composition/index.ts — Composition Grammar public API.
 *
 * Provides:
 *  - `buildCompositionScene(doc)` — validates the document and produces a Scene
 *    (pure; doc must have all refs resolved)
 *  - `renderCompositionDocument(doc, options)` — builds the Scene and serialises
 *    it to SVG or PNG using the existing shared serialisers (no new backends).
 *  - `renderCompositionDocumentFromRefs(doc, baseDir, options)` — resolves any
 *    ir_file ref cells from baseDir, then renders (convenience wrapper).
 *
 * The kernel serialisers (sceneToSvg, svgToPng, sceneToPngSkia) are reused
 * without modification. Same kernel, new composition layer — extends the
 * two-IR-layer pattern to multi-panel posters.
 */

import type { Scene } from '../scene.js';
import { sceneHash }      from '../scene.js';
import { sceneToSvg }     from '../render/svg.js';
import { svgToPng }       from '../render/png.js';
import { sceneToPngSkia } from '../render/skia.js';

import type { CompositionDocument } from './types.js';
import type { CompositionTheme }    from './theme.js';
import { compositionDocumentSchema } from './schema.js';
import { layoutComposition }         from './layout.js';
import { resolveCompositionRefs }    from './resolve.js';

export type { CompositionDocument, Cell, CellContent } from './types.js';
export type {
  FlowCellContent,
  TreeCellContent,
  SequenceCellContent,
  TimelineCellContent,
  RefCellContent,
  StatCellContent,
  TextCellContent,
  TitleCellContent,
  SceneCellContent,
} from './types.js';
export { compositionDocumentSchema } from './schema.js';
export type { CompositionDocumentInput } from './schema.js';
export type { CompositionTheme } from './theme.js';
export {
  defaultCompositionTheme,
  darkCompositionTheme,
  resolveCompositionTheme,
  COMPOSITION_THEME_REGISTRY,
} from './theme.js';
export { resolveCompositionRefs } from './resolve.js';
export { layoutComposition, layoutCompositionFull } from './layout.js';
export type { CellTransform } from './layout.js';

// ---------------------------------------------------------------------------
// buildCompositionScene
// ---------------------------------------------------------------------------

/**
 * Validate `doc` against the Composition Grammar schema then run the grid
 * layout engine to produce a Scene.
 *
 * Throws a ZodError if the document is structurally invalid.
 */
export function buildCompositionScene(
  doc: CompositionDocument,
  themeOverride?: CompositionTheme,
): Scene {
  compositionDocumentSchema.parse(doc);
  return layoutComposition(doc, themeOverride);
}

// ---------------------------------------------------------------------------
// renderCompositionDocument
// ---------------------------------------------------------------------------

export type CompositionRenderFormat = 'svg' | 'png';
export type CompositionRenderBackend = 'resvg' | 'skia';

export interface CompositionRenderOptions {
  format: CompositionRenderFormat;
  /** PNG backend. Default: 'resvg'. Use 'skia' for SceneEffect rendering. */
  backend?: CompositionRenderBackend;
}

export interface CompositionRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

/**
 * Build the scene from `doc` and serialise to the requested format.
 *
 * - `format: 'svg'`  → sync, returns `{ svg: string }`.
 * - `format: 'png', backend: 'resvg'` → sync via resvg, returns `{ png: Uint8Array }`.
 * - `format: 'png', backend: 'skia'`  → async (Promise), returns `{ png: Uint8Array }`.
 *
 * For the 'skia' backend this function returns a Promise; all other paths are
 * synchronous and may be awaited safely.
 */
export function renderCompositionDocument(
  doc: CompositionDocument,
  options: CompositionRenderOptions,
  themeOverride?: CompositionTheme,
): CompositionRenderResult | Promise<CompositionRenderResult> {
  const scene = buildCompositionScene(doc, themeOverride);
  const hash = sceneHash(scene);
  const base = { scene, sceneHash: hash };

  if (options.format === 'svg') {
    return { ...base, svg: sceneToSvg(scene) };
  }

  const backend = options.backend ?? 'resvg';
  if (backend === 'skia') {
    return sceneToPngSkia(scene).then((png) => ({ ...base, png }));
  }

  // Default: resvg
  const svg = sceneToSvg(scene);
  const png = svgToPng(svg);
  return { ...base, png };
}

// ---------------------------------------------------------------------------
// renderCompositionDocumentFromRefs
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper: resolve any `kind:'ref'` cells in `doc` by reading
 * the referenced files from `baseDir`, then render the fully-inlined document.
 *
 * This is the recommended entry point when authoring composition YAML files
 * that use `ir_file` external references.
 *
 * @param doc     - CompositionDocument (may contain ref cells).
 * @param baseDir - Directory from which `ir_file` paths are resolved
 *                  (typically `dirname` of the composition YAML file).
 * @param options - Same render options as `renderCompositionDocument`.
 * @param themeOverride - Optional theme override.
 *
 * Throws if any ref file is missing, invalid, or fails schema validation.
 */
export function renderCompositionDocumentFromRefs(
  doc: CompositionDocument,
  baseDir: string,
  options: CompositionRenderOptions,
  themeOverride?: CompositionTheme,
): CompositionRenderResult | Promise<CompositionRenderResult> {
  const resolved = resolveCompositionRefs(doc, baseDir);
  return renderCompositionDocument(resolved, options, themeOverride);
}
