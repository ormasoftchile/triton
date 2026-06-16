/**
 * @file grammars/state/index.ts — State Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';
import type { NodeAnchorRegistry } from '../../anchors.js';

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
  return layoutState(normalized, themeOverride).scene;
}

/**
 * Like `buildStateScene` but also returns the `NodeAnchorRegistry` sidecar (§30b).
 * Used by the poster composition layer for cross-diagram link resolution.
 *
 * Also returns `obstacles` — the full set of rendered node boxes including
 * pseudo-states (start/end/fork/join/choice) — which the geometry kernel uses
 * as its obstacle set so routes never pass through rendered-but-not-addressable
 * shapes such as the end-state bullseye.
 */
export function buildStateSceneWithAnchors(
  doc: StateDocument,
  themeOverride?: StateTheme,
): { scene: Scene; anchors: NodeAnchorRegistry; obstacles: NodeAnchorRegistry } {
  const normalized = normalizeStateDocument(doc);
  stateDocumentSchema.parse(normalized);
  const result = layoutState(normalized, themeOverride);
  return { scene: result.scene, anchors: result.anchors, obstacles: result.obstacles ?? result.anchors };
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
