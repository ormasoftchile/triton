/**
 * @file grammars/architecture/index.ts — Architecture Grammar public API.
 */

import type { PathPrimitive, Scene, ScenePrimitive } from '../../scene.js';
import { sceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng } from '../../render/png.js';
import { sceneToPngSkia } from '../../render/skia.js';
import { getIcon } from '../../icons.js';

import type {
  ArchitectureDocument,
  ArchEdge,
  ArchGroup,
  ArchJunction,
  ArchService,
  ArrowType,
  PortSide,
} from './types.js';
import type { ArchitectureTheme } from './theme.js';
import { architectureDocumentSchema } from './schema.js';
import { layoutArchitecture } from './layout.js';
import { resolveArchitectureTheme } from './theme.js';

export type {
  ArchitectureDocument,
  ArchitectureMetadata,
  ArchitectureIR,
  ArchService,
  ArchGroup,
  ArchJunction,
  ArchEdge,
  PortSide,
  ArrowType,
} from './types.js';
export { architectureDocumentSchema } from './schema.js';
export type { ArchitectureDocumentInput } from './schema.js';
export type { ArchitectureTheme } from './theme.js';
export {
  defaultArchitectureTheme,
  darkArchitectureTheme,
  resolveArchitectureTheme,
  ARCHITECTURE_THEME_REGISTRY,
} from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

function rectPath(x: number, y: number, width: number, height: number): string {
  return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
}

function renderIcon(
  primitives: ScenePrimitive[],
  iconName: string,
  left: number,
  top: number,
  size: number,
  color: string,
  strokeWidth: number,
): void {
  const iconDef = getIcon(iconName);
  if (!iconDef) return;
  const scale = size / 24;
  for (const pathDef of iconDef.paths) {
    primitives.push({
      kind: 'path',
      d: pathDef.d,
      fill: pathDef.fill ? color : 'none',
      stroke: pathDef.stroke !== false ? color : undefined,
      strokeWidth: pathDef.stroke !== false ? strokeWidth : undefined,
      transform: `translate(${left},${top}) scale(${scale.toFixed(4)})`,
    });
  }
}

function edgeDirection(points: Array<{ x: number; y: number }>, atStart: boolean): { dx: number; dy: number } {
  if (points.length < 2) return { dx: 1, dy: 0 };
  if (atStart) {
    const a = points[0]!;
    const b = points[1]!;
    return { dx: a.x - b.x, dy: a.y - b.y };
  }
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  return { dx: b.x - a.x, dy: b.y - a.y };
}

function arrowheadPath(x: number, y: number, dx: number, dy: number, size: number): string {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const baseX = x - ux * size;
  const baseY = y - uy * size;
  const px = -uy * size * 0.55;
  const py = ux * size * 0.55;
  return `M ${rhuInt(x)} ${rhuInt(y)} L ${rhuInt(baseX + px)} ${rhuInt(baseY + py)} L ${rhuInt(baseX - px)} ${rhuInt(baseY - py)} Z`;
}

function pushArrowheads(primitives: ScenePrimitive[], edge: ArchEdge, points: Array<{ x: number; y: number }>, theme: ArchitectureTheme): void {
  const pushArrow = (atStart: boolean): void => {
    const point = atStart ? points[0]! : points[points.length - 1]!;
    const dir = edgeDirection(points, atStart);
    primitives.push({
      kind: 'path',
      d: arrowheadPath(point.x, point.y, dir.dx, dir.dy, theme.arrowSize),
      fill: theme.edgeStroke,
      stroke: theme.edgeStroke,
      strokeWidth: 1,
    } satisfies PathPrimitive);
  };

  if (edge.arrowType === 'arrow-left' || edge.arrowType === 'arrow-both') pushArrow(true);
  if (edge.arrowType === 'arrow' || edge.arrowType === 'arrow-both') pushArrow(false);
}

export function buildArchitectureScene(doc: ArchitectureDocument, themeOverride?: ArchitectureTheme): Scene {
  architectureDocumentSchema.parse(doc);
  const theme = themeOverride ?? resolveArchitectureTheme(doc.metadata.theme);
  const layout = layoutArchitecture(doc, theme);
  const primitives: ScenePrimitive[] = [];

  if (layout.title) {
    primitives.push({
      kind: 'text',
      x: rhuInt(layout.width / 2),
      y: rhuInt(theme.marginTop - 10 + theme.titleFontSize),
      text: layout.title,
      fontFamily: theme.fontFamily,
      fontSize: theme.titleFontSize,
      fontWeight: theme.titleFontWeight,
      fill: theme.titleColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    });
  }

  for (const group of layout.groups) {
    primitives.push({
      kind: 'rect',
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      fill: theme.groupFill,
      opacity: 0.9,
    });
    primitives.push({
      kind: 'path',
      d: rectPath(group.x, group.y, group.width, group.height),
      fill: 'none',
      stroke: theme.groupStroke,
      strokeWidth: theme.groupStrokeWidth,
      dashArray: theme.groupDashArray,
    });
    renderIcon(
      primitives,
      group.icon,
      rhuInt(group.x + 12),
      rhuInt(group.y + 8),
      theme.groupIconSize,
      theme.groupTitleColor,
      theme.iconStrokeWidth,
    );
    primitives.push({
      kind: 'text',
      x: rhuInt(group.x + 12 + theme.groupIconSize + 8),
      y: rhuInt(group.y + 12 + theme.groupTitleFontSize),
      text: group.title,
      fontFamily: theme.fontFamily,
      fontSize: theme.groupTitleFontSize,
      fontWeight: theme.groupTitleFontWeight,
      fill: theme.groupTitleColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    });
  }

  for (const placedEdge of layout.edges) {
    const d = placedEdge.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    primitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke: theme.edgeStroke,
      strokeWidth: theme.edgeStrokeWidth,
      strokeLinecap: 'round',
    });
    pushArrowheads(primitives, placedEdge.edge, placedEdge.points, theme);
  }

  for (const node of layout.nodes) {
    if (node.kind === 'junction') {
      primitives.push({
        kind: 'circle',
        cx: node.cx,
        cy: node.cy,
        r: node.r,
        fill: theme.junctionFill,
        stroke: theme.junctionStroke,
        strokeWidth: theme.junctionStrokeWidth,
      });
      continue;
    }

    primitives.push({
      kind: 'rect',
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      fill: theme.serviceFill,
      stroke: theme.serviceStroke,
      strokeWidth: theme.serviceStrokeWidth,
      rx: theme.serviceRx,
    });

    const iconSize = theme.serviceIconSize;
    renderIcon(
      primitives,
      node.icon,
      rhuInt(node.x + node.width / 2 - iconSize / 2),
      rhuInt(node.y + theme.servicePadTop),
      iconSize,
      theme.serviceIconColor,
      theme.iconStrokeWidth,
    );

    const lineHeight = theme.serviceTitleFontSize * 1.15;
    const labelTop = node.y + theme.servicePadTop + iconSize + 12;
    node.lines.forEach((line, index) => {
      primitives.push({
        kind: 'text',
        x: rhuInt(node.x + node.width / 2),
        y: rhuInt(labelTop + index * lineHeight + theme.serviceTitleFontSize),
        text: line,
        fontFamily: theme.fontFamily,
        fontSize: theme.serviceTitleFontSize,
        fontWeight: theme.serviceTitleFontWeight,
        fill: theme.serviceTitleColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      });
    });
  }

  return {
    width: layout.width,
    height: layout.height,
    background: theme.background,
    primitives,
  };
}

export type ArchitectureRenderFormat = 'svg' | 'png';
export type ArchitectureRenderBackend = 'resvg' | 'skia';

export interface ArchitectureRenderOptions {
  format: ArchitectureRenderFormat;
  backend?: ArchitectureRenderBackend;
}

export interface ArchitectureRenderResult {
  scene: Scene;
  sceneHash: string;
  svg?: string;
  png?: Uint8Array;
}

export function renderArchitectureDocument(
  doc: ArchitectureDocument,
  options: ArchitectureRenderOptions,
  themeOverride?: ArchitectureTheme,
): ArchitectureRenderResult | Promise<ArchitectureRenderResult> {
  const scene = buildArchitectureScene(doc, themeOverride);
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
