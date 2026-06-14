/**
 * @file grammars/er/index.ts — ER Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { ErDocument } from './types.js';
import type { ErTheme } from './theme.js';
import { erDocumentSchema } from './schema.js';
import { layoutEr } from './layout.js';

export type {
  ErDocument,
  ErMetadata,
  ErEntity,
  ErAttribute,
  ErRelationship,
  ErCardinality,
} from './types.js';
export { erDocumentSchema } from './schema.js';
export type { ErDocumentInput } from './schema.js';
export type { ErTheme } from './theme.js';
export {
  defaultErTheme,
  darkErTheme,
  resolveErTheme,
  ER_THEME_REGISTRY,
} from './theme.js';

export function buildErScene(doc: ErDocument, themeOverride?: ErTheme): Scene {
  erDocumentSchema.parse(doc);
  return layoutEr(doc, themeOverride);
}

export type ErRenderFormat = 'svg' | 'png';
export type ErRenderBackend = 'resvg' | 'skia';

export interface ErRenderOptions {
  format: ErRenderFormat;
  backend?: ErRenderBackend;
}

export interface ErRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderErDocument(
  doc: ErDocument,
  options: ErRenderOptions,
  themeOverride?: ErTheme,
): ErRenderResult | Promise<ErRenderResult> {
  const scene = buildErScene(doc, themeOverride);
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
