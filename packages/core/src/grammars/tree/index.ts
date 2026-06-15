/**
 * @file grammars/tree/index.ts — Tree Grammar public API.
 *
 * Provides:
 *  - `buildTreeScene(doc)` — validates the document and produces a Scene
 *  - `renderTreeDocument(doc, options)` — builds the Scene and serialises
 *    it to SVG or PNG using the existing shared serialisers (no new backends).
 *
 * The kernel serialisers (sceneToSvg, svgToPng, sceneToPngSkia) are reused
 * without modification. New grammar, same kernel — the two-IR-layer pattern.
 */

import type { Scene } from '../../scene.js';
import { sceneHash }      from '../../scene.js';
import { sceneToSvg }     from '../../render/svg.js';
import { svgToPng }       from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { TreeDocument }   from './types.js';
import type { TreeTheme }      from './theme.js';
import { treeDocumentSchema }  from './schema.js';
import { layoutTree }          from './layout.js';
import { layoutTreeRadial }    from './layoutRadial.js';
import type { BranchColors, RadialThemeOpts } from './layoutRadial.js';

export type { TreeDocument, TreeNode, TreeMetadata, TreeDefinition } from './types.js';
export { treeDocumentSchema }   from './schema.js';
export type { TreeDocumentInput } from './schema.js';
export type { TreeTheme, TreeEdgeStyle, TreeOrientation } from './theme.js';
export {
  defaultTreeTheme,
  treeDarkTheme,
  resolveTreeTheme,
  TREE_THEME_REGISTRY,
} from './theme.js';
export { layoutTreeRadial } from './layoutRadial.js';
export type { RadialThemeOpts, BranchColors } from './layoutRadial.js';

// ---------------------------------------------------------------------------
// buildTreeScene
// ---------------------------------------------------------------------------

/**
 * Validate `doc` against the Tree Grammar schema then run the tidy-tree
 * layout engine to produce a Scene.
 *
 * Throws a ZodError if the document is structurally invalid.
 */
export function buildTreeScene(doc: TreeDocument, themeOverride?: TreeTheme): Scene {
  treeDocumentSchema.parse(doc);
  return layoutTree(doc, themeOverride);
}

// ---------------------------------------------------------------------------
// renderTreeDocument
// ---------------------------------------------------------------------------

export type TreeRenderFormat = 'svg' | 'png';
export type TreeRenderBackend = 'resvg' | 'skia';

export interface TreeRenderOptions {
  format: TreeRenderFormat;
  /** PNG backend. Default: 'resvg'. Use 'skia' for SceneEffect rendering. */
  backend?: TreeRenderBackend;
}

export interface TreeRenderResult {
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
export function renderTreeDocument(
  doc: TreeDocument,
  options: TreeRenderOptions,
  themeOverride?: TreeTheme,
): TreeRenderResult | Promise<TreeRenderResult> {
  const scene = buildTreeScene(doc, themeOverride);
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
// renderTreeDocumentRadial — synchronous radial mindmap rendering
// ---------------------------------------------------------------------------

/**
 * Build a radial mindmap scene from `doc` and serialise to the requested format.
 *
 * Always synchronous (resvg only). This is the render entry point for the
 * mindmap grammar path in `frontend/mermaid/index.ts`.
 *
 * ADDITIVE — the default `renderTreeDocument` is unaffected.
 */
export function renderTreeDocumentRadial(
  doc: TreeDocument,
  options: Pick<TreeRenderOptions, 'format'>,
  themeOpts?: RadialThemeOpts,
): TreeRenderResult {
  treeDocumentSchema.parse(doc);
  const scene = layoutTreeRadial(doc, themeOpts);
  const hash  = sceneHash(scene);
  const base  = { scene, sceneHash: hash };

  if (options.format === 'svg') {
    return { ...base, svg: sceneToSvg(scene) };
  }

  // PNG via resvg (synchronous)
  const svg = sceneToSvg(scene);
  const png = svgToPng(svg);
  return { ...base, svg, png };
}
