/**
 * @file grammars/state/index.ts — State Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { StateDocument } from './types.js';
import type { StateTheme } from './theme.js';
import { normalizeStateDocument, stateDocumentSchema } from './schema.js';
import { layoutState } from './layout.js';

export type {
  StateDocument,
  StateMetadata,
  StateNode,
  StateTransition,
  PseudostateKind,
} from './types.js';
export { stateDocumentSchema } from './schema.js';
export type { StateDocumentInput } from './schema.js';
export type { StateTheme } from './theme.js';
export {
  defaultStateTheme,
  darkStateTheme,
  resolveStateTheme,
  STATE_THEME_REGISTRY,
} from './theme.js';

export function buildStateScene(doc: StateDocument, themeOverride?: StateTheme): Scene {
  const normalized = normalizeStateDocument(doc);
  stateDocumentSchema.parse(normalized);
  return layoutState(normalized, themeOverride);
}

export type StateRenderFormat = 'svg' | 'png';
export type StateRenderBackend = 'resvg' | 'skia';

export interface StateRenderOptions {
  format: StateRenderFormat;
  backend?: StateRenderBackend;
}

export interface StateRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderStateDocument(
  doc: StateDocument,
  options: StateRenderOptions,
  themeOverride?: StateTheme,
): StateRenderResult | Promise<StateRenderResult> {
  const scene = buildStateScene(doc, themeOverride);
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
