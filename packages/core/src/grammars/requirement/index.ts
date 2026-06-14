/**
 * @file grammars/requirement/index.ts — Requirement Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { RequirementDocument } from './types.js';
import type { RequirementTheme } from './theme.js';
import { requirementDocumentSchema } from './schema.js';
import { layoutRequirement } from './layout.js';

export type {
  RequirementDocument,
  RequirementMetadata,
  RequirementNode,
  RequirementElement,
  RequirementRelationship,
  RequirementKind,
  RequirementRisk,
  RequirementVerifyMethod,
  RequirementRelKind,
} from './types.js';
export { requirementDocumentSchema } from './schema.js';
export type { RequirementDocumentInput } from './schema.js';
export type { RequirementTheme } from './theme.js';
export {
  defaultRequirementTheme,
  darkRequirementTheme,
  resolveRequirementTheme,
  REQUIREMENT_THEME_REGISTRY,
} from './theme.js';

export function buildRequirementScene(doc: RequirementDocument, themeOverride?: RequirementTheme): Scene {
  requirementDocumentSchema.parse(doc);
  return layoutRequirement(doc, themeOverride);
}

export type RequirementRenderFormat = 'svg' | 'png';
export type RequirementRenderBackend = 'resvg' | 'skia';

export interface RequirementRenderOptions {
  format: RequirementRenderFormat;
  backend?: RequirementRenderBackend;
}

export interface RequirementRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderRequirementDocument(
  doc: RequirementDocument,
  options: RequirementRenderOptions,
  themeOverride?: RequirementTheme,
): RequirementRenderResult | Promise<RequirementRenderResult> {
  const scene = buildRequirementScene(doc, themeOverride);
  const hash  = sceneHash(scene);
  const base  = { scene, sceneHash: hash };

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
