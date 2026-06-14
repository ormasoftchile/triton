/**
 * @file grammars/sankey/index.ts — Sankey grammar public API.
 *
 * Two-IR-layer pattern:
 *   SankeyDocument (domain IR) → layoutSankey() → Scene (render IR)
 *   → sceneToSvg / svgToPng (existing serialisers, unchanged)
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { SankeyDocument } from './types.js';
import type { SankeyTheme } from './theme.js';
import { sankeyDocumentSchema } from './schema.js';
import { layoutSankey } from './layout.js';

export type {
  SankeyDocument,
  SankeyNode,
  SankeyLink,
  SankeyMetadata,
} from './types.js';
export { sankeyDocumentSchema } from './schema.js';
export type { SankeyDocumentInput } from './schema.js';
export type { SankeyTheme } from './theme.js';
export {
  defaultSankeyTheme,
  darkSankeyTheme,
  resolveSankeyTheme,
  SANKEY_THEME_REGISTRY,
} from './theme.js';

export function buildSankeyScene(doc: SankeyDocument, themeOverride?: SankeyTheme): Scene {
  sankeyDocumentSchema.parse(doc);
  return layoutSankey(doc, themeOverride);
}

export type SankeyRenderFormat = 'svg' | 'png';
export type SankeyRenderBackend = 'resvg' | 'skia';

export interface SankeyRenderOptions {
  format: SankeyRenderFormat;
  backend?: SankeyRenderBackend;
}

export interface SankeyRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderSankeyDocument(
  doc: SankeyDocument,
  options: SankeyRenderOptions,
  themeOverride?: SankeyTheme,
): SankeyRenderResult | Promise<SankeyRenderResult> {
  const scene = buildSankeyScene(doc, themeOverride);
  const hash = sceneHash(scene);
  const base = { scene, sceneHash: hash };

  if (options.format === 'svg') {
    return { ...base, svg: sceneToSvg(scene) };
  }

  const backend = options.backend ?? 'resvg';
  if (backend === 'skia') {
    return sceneToPngSkia(scene).then((png) => ({ ...base, png }));
  }

  const svg = sceneToSvg(scene);
  const png = svgToPng(svg);
  return { ...base, png };
}
