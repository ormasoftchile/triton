/**
 * @file grammars/class/index.ts — Class Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';
import type { NodeAnchorRegistry } from '../../anchors.js';

import type { ClassDocument } from './types.js';
import type { ClassTheme } from './theme.js';
import { classDocumentSchema } from './schema.js';
import { layoutClass } from './layout.js';

export type {
  ClassDocument,
  ClassMetadata,
  ClassDef,
  ClassMember,
  ClassRelationship,
} from './types.js';
export { classDocumentSchema } from './schema.js';
export type { ClassDocumentInput } from './schema.js';
export type { ClassTheme } from './theme.js';
export {
  defaultClassTheme,
  darkClassTheme,
  resolveClassTheme,
  CLASS_THEME_REGISTRY,
} from './theme.js';

export function buildClassScene(doc: ClassDocument, themeOverride?: ClassTheme): Scene {
  classDocumentSchema.parse(doc);
  return layoutClass(doc, themeOverride).scene;
}

/**
 * Like `buildClassScene` but also returns the `NodeAnchorRegistry` sidecar (§30b).
 * Used by the poster composition layer for cross-diagram link resolution.
 */
export function buildClassSceneWithAnchors(
  doc: ClassDocument,
  themeOverride?: ClassTheme,
): { scene: Scene; anchors: NodeAnchorRegistry } {
  classDocumentSchema.parse(doc);
  return layoutClass(doc, themeOverride);
}

export type ClassRenderFormat = 'svg' | 'png';
export type ClassRenderBackend = 'resvg' | 'skia';

export interface ClassRenderOptions {
  format: ClassRenderFormat;
  backend?: ClassRenderBackend;
}

export interface ClassRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderClassDocument(
  doc: ClassDocument,
  options: ClassRenderOptions,
  themeOverride?: ClassTheme,
): ClassRenderResult | Promise<ClassRenderResult> {
  const scene = buildClassScene(doc, themeOverride);
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
