/**
 * @file grammars/c4/index.ts — C4 Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { C4Document } from './types.js';
import type { C4Theme } from './theme.js';
import { c4DocumentSchema } from './schema.js';
import { layoutC4 } from './layout.js';

export type {
  C4Document,
  C4Metadata,
  C4Element,
  C4ElementKind,
  C4Boundary,
  C4Rel,
  C4RelKind,
  C4DiagramKind,
} from './types.js';
export { c4DocumentSchema } from './schema.js';
export type { C4DocumentInput } from './schema.js';
export type { C4Theme } from './theme.js';
export {
  defaultC4Theme,
  darkC4Theme,
  resolveC4Theme,
  C4_THEME_REGISTRY,
} from './theme.js';

export function buildC4Scene(doc: C4Document, themeOverride?: C4Theme): Scene {
  c4DocumentSchema.parse(doc);
  return layoutC4(doc, themeOverride);
}

export type C4RenderFormat = 'svg' | 'png';
export type C4RenderBackend = 'resvg' | 'skia';

export interface C4RenderOptions {
  format: C4RenderFormat;
  backend?: C4RenderBackend;
}

export interface C4RenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderC4Document(
  doc: C4Document,
  options: C4RenderOptions,
  themeOverride?: C4Theme,
): C4RenderResult | Promise<C4RenderResult> {
  const scene = buildC4Scene(doc, themeOverride);
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
