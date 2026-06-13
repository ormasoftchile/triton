/**
 * @file grammars/sequence/index.ts — Sequence Grammar public API.
 *
 * Provides:
 *  - `buildSequenceScene(doc)` — validates the document and produces a Scene
 *  - `renderSequenceDocument(doc, options)` — builds the Scene and serialises
 *    it to SVG or PNG using the existing shared serialisers (no new backends).
 *
 * The kernel serialisers (sceneToSvg, svgToPng, sceneToPngSkia) are reused
 * without modification. New grammar, same kernel — this is the two-IR-layer
 * pattern described in §2 (decisions.md).
 */

import type { Scene } from '../../scene.js';
import { sceneHash }      from '../../scene.js';
import { sceneToSvg }     from '../../render/svg.js';
import { svgToPng }       from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { SequenceDocument }  from './types.js';
import type { SequenceTheme } from './theme.js';
import { sequenceDocumentSchema } from './schema.js';
import { layoutSequence }         from './layout.js';

export type { SequenceDocument, Participant, Message, Activation, Fragment, SequenceMetadata, SequenceDefinition } from './types.js';
export { sequenceDocumentSchema } from './schema.js';
export type { SequenceDocumentInput } from './schema.js';
export type { SequenceTheme, CardKindStyle } from './theme.js';
export { defaultSequenceTheme, sequenceByteByteGoTheme, resolveSequenceTheme, SEQUENCE_THEME_REGISTRY } from './theme.js';

// ---------------------------------------------------------------------------
// buildSequenceScene
// ---------------------------------------------------------------------------

/**
 * Validate `doc` against the Sequence Grammar schema then run the layout
 * engine to produce a Scene.
 *
 * Throws a ZodError if the document is structurally invalid.
 */
export function buildSequenceScene(doc: SequenceDocument, themeOverride?: SequenceTheme): Scene {
  sequenceDocumentSchema.parse(doc);
  return layoutSequence(doc, themeOverride);
}

// ---------------------------------------------------------------------------
// renderSequenceDocument
// ---------------------------------------------------------------------------

export type SequenceRenderFormat = 'svg' | 'png';
export type SequenceRenderBackend = 'resvg' | 'skia';

export interface SequenceRenderOptions {
  format: SequenceRenderFormat;
  /** PNG backend. Default: 'resvg'. Use 'skia' for SceneEffect rendering. */
  backend?: SequenceRenderBackend;
}

export interface SequenceRenderResult {
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
export function renderSequenceDocument(
  doc: SequenceDocument,
  options: SequenceRenderOptions,
  themeOverride?: SequenceTheme,
): SequenceRenderResult | Promise<SequenceRenderResult> {
  const scene = buildSequenceScene(doc, themeOverride);
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
