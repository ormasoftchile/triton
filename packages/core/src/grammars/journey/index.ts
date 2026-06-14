import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { JourneyDocument } from './types.js';
import type { JourneyTheme } from './theme.js';
import { journeyDocumentSchema } from './schema.js';
import { layoutJourney } from './layout.js';

export type {
  JourneyDocument,
  JourneyMetadata,
  JourneySection,
  JourneyTask,
} from './types.js';
export { journeyDocumentSchema } from './schema.js';
export type { JourneyDocumentInput } from './schema.js';
export type { JourneyTheme } from './theme.js';
export {
  defaultJourneyTheme,
  darkJourneyTheme,
  resolveJourneyTheme,
  JOURNEY_THEME_REGISTRY,
} from './theme.js';

export function buildJourneyScene(doc: JourneyDocument, themeOverride?: JourneyTheme): Scene {
  journeyDocumentSchema.parse(doc);
  return layoutJourney(doc, themeOverride);
}

export type JourneyRenderFormat = 'svg' | 'png';
export type JourneyRenderBackend = 'resvg' | 'skia';

export interface JourneyRenderOptions {
  format: JourneyRenderFormat;
  backend?: JourneyRenderBackend;
}

export interface JourneyRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderJourneyDocument(
  doc: JourneyDocument,
  options: JourneyRenderOptions,
  themeOverride?: JourneyTheme,
): JourneyRenderResult | Promise<JourneyRenderResult> {
  const scene = buildJourneyScene(doc, themeOverride);
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
