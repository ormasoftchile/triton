/**
 * @file grammars/kanban/index.ts — Kanban Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { KanbanDocument } from './types.js';
import type { KanbanTheme } from './theme.js';
import { kanbanDocumentSchema } from './schema.js';
import { layoutKanban } from './layout.js';

export type {
  KanbanDocument,
  KanbanMetadata,
  KanbanColumn,
  KanbanCard,
  KanbanCardMetadata,
} from './types.js';
export { kanbanDocumentSchema } from './schema.js';
export type { KanbanDocumentInput } from './schema.js';
export type { KanbanTheme } from './theme.js';
export {
  defaultKanbanTheme,
  darkKanbanTheme,
  resolveKanbanTheme,
  KANBAN_THEME_REGISTRY,
} from './theme.js';

export function buildKanbanScene(doc: KanbanDocument, themeOverride?: KanbanTheme): Scene {
  kanbanDocumentSchema.parse(doc);
  return layoutKanban(doc, themeOverride);
}

export type KanbanRenderFormat = 'svg' | 'png';
export type KanbanRenderBackend = 'resvg' | 'skia';

export interface KanbanRenderOptions {
  format: KanbanRenderFormat;
  backend?: KanbanRenderBackend;
}

export interface KanbanRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderKanbanDocument(
  doc: KanbanDocument,
  options: KanbanRenderOptions,
  themeOverride?: KanbanTheme,
): KanbanRenderResult | Promise<KanbanRenderResult> {
  const scene = buildKanbanScene(doc, themeOverride);
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
