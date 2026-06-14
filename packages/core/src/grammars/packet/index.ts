/**
 * @file grammars/packet/index.ts — Packet Grammar public API.
 */

import type { Scene } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';

import type { PacketDocument } from './types.js';
import type { PacketTheme } from './theme.js';
import { packetDocumentSchema } from './schema.js';
import { layoutPacket } from './layout.js';

export type { PacketDocument, PacketMetadata, PacketField } from './types.js';
export { packetDocumentSchema } from './schema.js';
export type { PacketDocumentInput } from './schema.js';
export type { PacketTheme } from './theme.js';
export {
  defaultPacketTheme,
  darkPacketTheme,
  resolvePacketTheme,
  PACKET_THEME_REGISTRY,
} from './theme.js';

export function buildPacketScene(doc: PacketDocument, themeOverride?: PacketTheme): Scene {
  packetDocumentSchema.parse(doc);
  return layoutPacket(doc, themeOverride);
}

export type PacketRenderFormat = 'svg' | 'png';
export type PacketRenderBackend = 'resvg' | 'skia';

export interface PacketRenderOptions {
  format: PacketRenderFormat;
  backend?: PacketRenderBackend;
}

export interface PacketRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderPacketDocument(
  doc: PacketDocument,
  options: PacketRenderOptions,
  themeOverride?: PacketTheme,
): PacketRenderResult | Promise<PacketRenderResult> {
  const scene = buildPacketScene(doc, themeOverride);
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
