/**
 * @file grammars/block/index.ts — Block Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { BlockDocument } from './types.js';
import type { BlockTheme } from './theme.js';
import { blockDocumentSchema } from './schema.js';
import { layoutBlock } from './layout.js';

export type {
  BlockDocument,
  BlockMetadata,
  BlockItem,
  BlockGroup,
  BlockArrow,
  BlockShape,
} from './types.js';
export { blockDocumentSchema } from './schema.js';
export type { BlockDocumentInput } from './schema.js';
export type { BlockTheme } from './theme.js';
export {
  defaultBlockTheme,
  darkBlockTheme,
  resolveBlockTheme,
  BLOCK_THEME_REGISTRY,
} from './theme.js';

export function buildBlockScene(doc: BlockDocument, themeOverride?: BlockTheme): Scene {
  blockDocumentSchema.parse(doc);
  return layoutBlock(doc, themeOverride);
}

export type BlockRenderFormat = 'svg' | 'png';
export type BlockRenderBackend = 'resvg' | 'skia';

export interface BlockRenderOptions {
  format: BlockRenderFormat;
  backend?: BlockRenderBackend;
}

export interface BlockRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderBlockDocument(
  doc: BlockDocument,
  options: BlockRenderOptions,
  themeOverride?: BlockTheme,
): BlockRenderResult | Promise<BlockRenderResult> {
  const scene = buildBlockScene(doc, themeOverride);
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
