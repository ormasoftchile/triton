import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { GitGraphDocument } from './types.js';
import type { GitGraphTheme } from './theme.js';
import { gitGraphDocumentSchema } from './schema.js';
import { layoutGitGraph } from './layout.js';

export type {
  GitBranch,
  GitCommit,
  GitCommitType,
  GitGraphDocument,
  GitGraphMetadata,
  GitGraphOrientation,
} from './types.js';
export { gitGraphDocumentSchema } from './schema.js';
export type { GitGraphDocumentInput } from './schema.js';
export type { GitGraphTheme } from './theme.js';
export {
  defaultGitGraphTheme,
  darkGitGraphTheme,
  resolveGitGraphTheme,
  GITGRAPH_THEME_REGISTRY,
} from './theme.js';

export function buildGitGraphScene(doc: GitGraphDocument, themeOverride?: GitGraphTheme): Scene {
  gitGraphDocumentSchema.parse(doc);
  return layoutGitGraph(doc, themeOverride);
}

export type GitGraphRenderFormat = 'svg' | 'png';
export type GitGraphRenderBackend = 'resvg' | 'skia';

export interface GitGraphRenderOptions {
  format: GitGraphRenderFormat;
  backend?: GitGraphRenderBackend;
}

export interface GitGraphRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderGitGraphDocument(
  doc: GitGraphDocument,
  options: GitGraphRenderOptions,
  themeOverride?: GitGraphTheme,
): GitGraphRenderResult | Promise<GitGraphRenderResult> {
  const scene = buildGitGraphScene(doc, themeOverride);
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
