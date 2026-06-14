/**
 * @file grammars/chart/index.ts — Chart Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { ChartDocument } from './types.js';
import type { ChartTheme } from './theme.js';
import { layoutChart } from './layout.js';

export type {
  ChartDocument,
  ChartData,
  ChartEncoding,
  FieldEncoding,
  ScaleConfig,
  ChartConfig,
} from './types.js';
export type { ChartTheme } from './theme.js';
export {
  defaultChartTheme,
  darkChartTheme,
  resolveChartTheme,
  CHART_THEME_REGISTRY,
} from './theme.js';

export function buildChartScene(doc: ChartDocument, themeOverride?: ChartTheme): Scene {
  return layoutChart(doc, themeOverride);
}

export type ChartRenderFormat = 'svg' | 'png';
export type ChartRenderBackend = 'resvg' | 'skia';

export interface ChartRenderOptions {
  format: ChartRenderFormat;
  backend?: ChartRenderBackend;
}

export interface ChartRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderChartDocument(
  doc: ChartDocument,
  options: ChartRenderOptions,
  themeOverride?: ChartTheme,
): ChartRenderResult | Promise<ChartRenderResult> {
  const scene = buildChartScene(doc, themeOverride);
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
