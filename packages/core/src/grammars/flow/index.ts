/**
 * @file grammars/flow/index.ts — Flow Grammar public API.
 *
 * Provides:
 *  - `buildFlowScene(doc)` — validates the document and produces a Scene
 *  - `renderFlowDocument(doc, options)` — builds the Scene and serialises
 *    it to SVG or PNG using the existing shared serialisers (no new backends).
 *
 * The kernel serialisers (sceneToSvg, svgToPng, sceneToPngSkia) are reused
 * without modification. New grammar, same kernel — the two-IR-layer pattern.
 */

import type { Scene }    from '../../scene.js';
import { sceneHash }     from '../../scene.js';
import { sceneToSvg }    from '../../render/svg.js';
import { svgToPng }      from '../../render/png.js';
import { sceneToPngSkia }from '../../render/skia.js';

import type { FlowDocument } from './types.js';
import type { FlowTheme }    from './theme.js';
import { flowDocumentSchema } from './schema.js';
import { layoutFlow }        from './layout.js';

export type { FlowDocument, FlowNode, FlowEdge, FlowDefinition, FlowMetadata } from './types.js';
export { flowDocumentSchema } from './schema.js';
export type { FlowDocumentInput } from './schema.js';
export type { FlowTheme, FlowOrientation, FlowEdgeStyle } from './theme.js';
export {
  defaultFlowTheme,
  resolveFlowTheme,
  FLOW_THEME_REGISTRY,
} from './theme.js';

// ---------------------------------------------------------------------------
// buildFlowScene
// ---------------------------------------------------------------------------

/**
 * Validate `doc` against the Flow Grammar schema then run the layered-layout
 * engine to produce a Scene.
 *
 * Throws a ZodError if the document is structurally invalid.
 */
export function buildFlowScene(
  doc: FlowDocument,
  themeOverride?: FlowTheme,
): Scene {
  flowDocumentSchema.parse(doc);
  return layoutFlow(doc, themeOverride);
}

// ---------------------------------------------------------------------------
// renderFlowDocument
// ---------------------------------------------------------------------------

export type FlowRenderFormat = 'svg' | 'png';
export type FlowRenderBackend = 'resvg' | 'skia';

export interface FlowRenderOptions {
  format: FlowRenderFormat;
  /** PNG backend. Default: 'resvg'. Use 'skia' for SceneEffect rendering. */
  backend?: FlowRenderBackend;
}

export interface FlowRenderResult {
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
export function renderFlowDocument(
  doc: FlowDocument,
  options: FlowRenderOptions,
  themeOverride?: FlowTheme,
): FlowRenderResult | Promise<FlowRenderResult> {
  const scene = buildFlowScene(doc, themeOverride);
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
