/**
 * @file diagrams/architecture/layout.ts — Cloud architecture diagram.
 *
 * Phase C implementation — replaces Sugiyama layered layout with a
 * direction-constrained BFS grid placer that honours L/R/T/B side semantics.
 * All other rendering features from Phase B remain unchanged.
 *
 * Features:
 *   1. Directional grid placement — BFS from directional edge constraints
 *   2. Junctions      — small 4-way split nodes; edges enter/leave on any side.
 *   3. Arrowheads     — driven by arrowLeft / arrowRight; axis-aligned markers.
 *   4. {group} edges  — port sits on the enclosing group boundary, not the service box.
 *   5. Align          — containment-safe row/column constraints in cluster placement.
 *   6. Nested groups  — parent groups visually contain child groups.
 *   7. Iconify icons  — prefix:name tokens resolved through LayoutOptions.icons;
 *                       unresolvable tokens fall back to the built-in glyph.
 *
 * Deviations / limitations (disclosed):
 *   - Iconify resolution requires the host to supply LayoutOptions.icons.
 */

import type { ArchitectureDocument, ArchGroup, ArchIconAlign } from './ir.js';
import type {
  Scene,
  SceneElement,
  LayoutResult,
  Point,
  Rect,
  PortDirection,
  LayoutOptions,
  RouteStyle,
  TextAnchor,
} from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { groupAwareDirectionalGridPlacer } from './gridPlacer.js';
import { createRouter } from '../../../routing/router.js';
import { rhu, rhuInt } from '../../../util/round.js';
import { parseIconRef, resolveIcon } from '../../../icons/resolver.js';
import { wavifyPath } from '../../../crosslink/render.js';
import {
  measureFormattedText,
  renderFormattedText,
  type FormattedTextLines,
} from '../../../text/formatted.js';

// ─── Marker IDs ──────────────────────────────────────────────────────────────

const ARROW_END_ID = 'arch-arrow-end'; // → points in path direction
const ARROW_START_ID = 'arch-arrow-start'; // ← points against path direction

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const MIN_SERVICE_W = 130;
const MIN_SERVICE_H = 56;
const SERVICE_PAD = 12;
const ICON_SIZE = 24;
const ICON_LANE_W = 34;
const ICON_BAND_H = 30;
const SERVICE_TOP_BAR_H = 8;
const CENTER_ICON_GAP = 8;

function normalizedIconAlign(align: ArchIconAlign | undefined): ArchIconAlign {
  return align ?? 'N';
}

function isSideIconAlign(align: ArchIconAlign): boolean {
  return align === 'E' || align === 'W';
}

function serviceSize(
  label: string,
  align: ArchIconAlign | undefined,
  font: number,
  smallFont: number,
): { width: number; height: number; info: FormattedTextLines } {
  const a = normalizedIconAlign(align);
  const info = measureFormattedText(label, font, smallFont, 220, 4);
  const laneW = isSideIconAlign(a) ? ICON_LANE_W : 0;
  const width = Math.ceil(Math.max(MIN_SERVICE_W, laneW + info.maxLineWidth + SERVICE_PAD * 2));
  const textH = info.lineCount > 1 ? info.lineCount * (font * 1.25) : font * 1.2;
  const baseH =
    a === 'C'
      ? Math.ceil(
          Math.max(
            MIN_SERVICE_H,
            SERVICE_TOP_BAR_H + ICON_SIZE + CENTER_ICON_GAP + textH + SERVICE_PAD,
          ),
        )
      : MIN_SERVICE_H;
  const height =
    info.lineCount > 1
      ? Math.max(
          baseH,
          Math.ceil(
            SERVICE_TOP_BAR_H +
              textH +
              (a === 'N' || a === 'NE' || a === 'NW' ? ICON_BAND_H : 0) +
              SERVICE_PAD,
          ),
        )
      : baseH;
  return { width, height, info };
}

function port(r: Rect, side: string, t = 0.5): { x: number; y: number } {
  switch (side.toUpperCase()) {
    case 'L':
      return { x: r.x, y: r.y + r.height * t };
    case 'R':
      return { x: r.x + r.width, y: r.y + r.height * t };
    case 'T':
      return { x: r.x + r.width * t, y: r.y };
    default:
      return { x: r.x + r.width * t, y: r.y + r.height };
  }
}

function sideToDir(side: string): PortDirection {
  switch (side.toUpperCase()) {
    case 'L':
      return 'W';
    case 'R':
      return 'E';
    case 'T':
      return 'N';
    default:
      return 'S';
  }
}

function dirToSide(dir: PortDirection): string {
  switch (dir) {
    case 'W':
      return 'L';
    case 'E':
      return 'R';
    case 'N':
      return 'T';
    case 'S':
      return 'B';
  }
}

function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function endpointSide(edge: ArchitectureDocument['edges'][number], isSource: boolean): string {
  const wall = isSource ? edge.exitWall : edge.entryWall;
  return wall ? dirToSide(wall) : isSource ? edge.fromSide : edge.toSide;
}

function tangentKeyForSide(side: string, otherCenter: Point): number {
  switch (side.toUpperCase()) {
    case 'T':
    case 'B':
      return otherCenter.x;
    default:
      return otherCenter.y;
  }
}

function edgeDash(style: string | undefined): string | undefined {
  switch (style) {
    case 'dotted':
      return '6 3';
    case 'dashed':
      return '8 4';
    default:
      return undefined;
  }
}

function edgeStrokeWidth(style: string | undefined, base: number): number {
  return style === 'thick' ? base * 2 : base;
}

function iconCenter(r: Rect, align: ArchIconAlign | undefined): { x: number; y: number } {
  const a = normalizedIconAlign(align);
  const sideY = r.y + SERVICE_TOP_BAR_H + (r.height - SERVICE_TOP_BAR_H) / 2;
  const topY = r.y + SERVICE_TOP_BAR_H + ICON_SIZE / 2;
  const bottomY = r.y + r.height - ICON_SIZE / 2 - 4;
  switch (a) {
    case 'S':
      return { x: r.x + r.width / 2, y: bottomY };
    case 'E':
      return { x: r.x + r.width - ICON_LANE_W / 2, y: sideY };
    case 'W':
      return { x: r.x + ICON_LANE_W / 2, y: sideY };
    case 'NE':
      return { x: r.x + r.width - ICON_LANE_W / 2, y: topY };
    case 'NW':
      return { x: r.x + ICON_LANE_W / 2, y: topY };
    case 'SE':
      return { x: r.x + r.width - ICON_LANE_W / 2, y: bottomY };
    case 'SW':
      return { x: r.x + ICON_LANE_W / 2, y: bottomY };
    case 'C':
      return { x: r.x + r.width / 2, y: topY };
    case 'N':
    default:
      return { x: r.x + r.width / 2, y: topY };
  }
}

function serviceLabelArea(
  r: Rect,
  align: ArchIconAlign | undefined,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: TextAnchor;
  paddingLeft?: number;
} {
  const a = normalizedIconAlign(align);
  switch (a) {
    case 'W':
      return {
        x: r.x + ICON_LANE_W + SERVICE_PAD,
        y: r.y + SERVICE_TOP_BAR_H,
        width: r.width - ICON_LANE_W - SERVICE_PAD * 2,
        height: r.height - SERVICE_TOP_BAR_H,
        anchor: 'start',
      };
    case 'E':
      return {
        x: r.x + SERVICE_PAD,
        y: r.y + SERVICE_TOP_BAR_H,
        width: r.width - ICON_LANE_W - SERVICE_PAD * 2,
        height: r.height - SERVICE_TOP_BAR_H,
        anchor: 'start',
      };
    case 'S':
    case 'SE':
    case 'SW':
      return {
        x: r.x + SERVICE_PAD,
        y: r.y + SERVICE_TOP_BAR_H,
        width: r.width - SERVICE_PAD * 2,
        height: r.height - SERVICE_TOP_BAR_H - ICON_BAND_H,
        anchor: 'middle',
      };
    case 'C': {
      const top = r.y + SERVICE_TOP_BAR_H + ICON_SIZE + CENTER_ICON_GAP;
      return {
        x: r.x + SERVICE_PAD,
        y: top,
        width: r.width - SERVICE_PAD * 2,
        height: r.y + r.height - SERVICE_PAD - top,
        anchor: 'middle',
      };
    }
    case 'N':
    case 'NE':
    case 'NW':
    default: {
      const top = r.y + SERVICE_TOP_BAR_H + ICON_BAND_H;
      return {
        x: r.x + SERVICE_PAD,
        y: top,
        width: r.width - SERVICE_PAD * 2,
        height: r.y + r.height - top,
        anchor: 'middle',
      };
    }
  }
}

const GROUP_HEADER_ICON_X = 18;
const GROUP_HEADER_LABEL_GAP_X = 34;
const GROUP_HEADER_CENTER_Y = 16;

function isRightGroupIconAlign(align: ArchIconAlign | undefined): boolean {
  return align === 'E' || align === 'NE' || align === 'SE';
}

function groupHeaderPlacement(
  r: Rect,
  align: ArchIconAlign | undefined,
  hasIcon: boolean,
): {
  icon: Point;
  label: { x: number; y: number; anchor: TextAnchor };
} {
  const y = r.y + GROUP_HEADER_CENTER_Y;
  if (hasIcon && isRightGroupIconAlign(align)) {
    return {
      icon: { x: r.x + r.width - GROUP_HEADER_ICON_X, y },
      label: { x: r.x + r.width - GROUP_HEADER_LABEL_GAP_X, y, anchor: 'end' },
    };
  }
  return {
    icon: { x: r.x + GROUP_HEADER_ICON_X, y },
    label: { x: r.x + (hasIcon ? GROUP_HEADER_LABEL_GAP_X : 12), y, anchor: 'start' },
  };
}

// ─── Group sort (parent before child for back-to-front rendering) ─────────────

function groupsByDepth(groups: readonly ArchGroup[]): ArchGroup[] {
  const result: ArchGroup[] = [];
  const added = new Set<string>();
  function add(g: ArchGroup) {
    if (added.has(g.id)) return;
    if (g.parent) {
      const par = groups.find((pg) => pg.id === g.parent);
      if (par) add(par);
    }
    result.push(g);
    added.add(g.id);
  }
  for (const g of groups) add(g);
  return result;
}

// ─── Layout entry point ───────────────────────────────────────────────────────

export function layoutArchitecture(
  ir: ArchitectureDocument,
  theme: ResolvedTheme,
  options?: LayoutOptions,
): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;
  const iconPacks = options?.icons;

  // ── Sizes ─────────────────────────────────────────────────────────────────
  const jctW = 16,
    jctH = 16; // junctions are small crosshair nodes

  // ── Node sizes (services vs junctions) ───────────────────────────────────
  const nodeSizes = new Map<string, { width: number; height: number }>();
  const serviceInfos = new Map<string, FormattedTextLines>();
  for (const s of ir.services) {
    const sz = serviceSize(s.label, s.iconAlign, font, smallFont);
    nodeSizes.set(s.id, sz);
    serviceInfos.set(s.id, sz.info);
  }
  for (const j of ir.junctions) nodeSizes.set(j.id, { width: jctW, height: jctH });

  // ── Directional grid placement ────────────────────────────────────────────
  const colGap = 90,
    rowGap = 64;
  const gridCells = groupAwareDirectionalGridPlacer(ir);

  // Convert grid cells → pixel coords; mutable for align post-processing.
  const colWidths = new Map<number, number>();
  const rowHeights = new Map<number, number>();
  for (const [id, cell] of gridCells) {
    const sz = nodeSizes.get(id);
    if (!sz) continue;
    colWidths.set(cell.col, Math.max(colWidths.get(cell.col) ?? MIN_SERVICE_W, sz.width));
    rowHeights.set(cell.row, Math.max(rowHeights.get(cell.row) ?? MIN_SERVICE_H, sz.height));
  }
  const cells = [...gridCells.values()];
  const maxCol = Math.max(0, ...cells.map((c) => c.col));
  const maxRow = Math.max(0, ...cells.map((c) => c.row));
  const colX = new Map<number, number>();
  const rowY = new Map<number, number>();
  let xCursor = margin;
  for (let c = 0; c <= maxCol; c++) {
    colX.set(c, xCursor);
    xCursor += (colWidths.get(c) ?? MIN_SERVICE_W) + colGap;
  }
  let yCursor = margin;
  for (let r = 0; r <= maxRow; r++) {
    rowY.set(r, yCursor);
    yCursor += (rowHeights.get(r) ?? MIN_SERVICE_H) + rowGap;
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, cell] of gridCells) {
    positions.set(id, {
      x: colX.get(cell.col) ?? margin,
      y: rowY.get(cell.row) ?? margin,
    });
  }

  // ── rectOf: adjusted position + node size + yOffset ─────────────────────
  const titleH = ir.metadata.title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;
  const rectOf = (id: string): Rect | undefined => {
    const pos = positions.get(id);
    const sz = nodeSizes.get(id);
    const cell = gridCells.get(id);
    if (!pos || !sz) return undefined;
    const isJct = ir.junctions.some((j) => j.id === id);
    const width = isJct ? sz.width : cell ? colWidths.get(cell.col) ?? sz.width : sz.width;
    return { x: pos.x, y: pos.y + yOff, width, height: sz.height };
  };

  // ── Compute group rects (memoised, recursive for nested groups) ───────────
  const groupRectCache = new Map<string, Rect>();
  const computeGroupRect = (gId: string): Rect | undefined => {
    if (groupRectCache.has(gId)) return groupRectCache.get(gId)!;
    const pad = 20;
    const memberRects: Rect[] = [
      ...ir.services
        .filter((s) => s.group === gId)
        .map((s) => rectOf(s.id))
        .filter((r): r is Rect => !!r),
      ...ir.junctions
        .filter((j) => j.group === gId)
        .map((j) => rectOf(j.id))
        .filter((r): r is Rect => !!r),
      ...ir.groups
        .filter((g) => g.parent === gId)
        .map((g) => computeGroupRect(g.id))
        .filter((r): r is Rect => !!r),
    ];
    if (memberRects.length === 0) return undefined;
    const minX = Math.min(...memberRects.map((r) => r.x)) - pad;
    const minY = Math.min(...memberRects.map((r) => r.y)) - pad - 14;
    const maxX = Math.max(...memberRects.map((r) => r.x + r.width)) + pad;
    const maxY = Math.max(...memberRects.map((r) => r.y + r.height)) + pad;
    const rect: Rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    groupRectCache.set(gId, rect);
    return rect;
  };
  // Prime the cache for all groups.
  for (const g of ir.groups) computeGroupRect(g.id);

  // ── Build element list ────────────────────────────────────────────────────
  const elements: SceneElement[] = [];
  const warnedIcons = new Set<string>();

  // Title
  if (ir.metadata.title) {
    elements.push(
      p.text(
        String(ir.metadata.title),
        margin,
        margin + typography.titleFontSize,
        typography.titleFontSize,
        palette.text,
        { weight: 'bold' },
      ),
    );
  }

  // ── Group boxes (outermost first so children render on top) ──────────────
  const isMono = theme.name === 'bw-light' || theme.name === 'bw-dark' || theme.name === 'minimal';
  const orderedGroups = groupsByDepth(ir.groups);
  orderedGroups.forEach((g, gi) => {
    const r = computeGroupRect(g.id);
    if (!r) return;
    const hue = categoricalHue(gi, theme);
    const groupStroke = isMono ? palette.border : hue;
    const groupFill = isMono ? palette.surface : hue + '14';
    const groupLabelColor = isMono ? palette.text : hue;
    elements.push(
      p.rect(
        { x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: rhu(r.height) },
        groupFill,
        groupStroke,
        1.4,
        { rx: 10 },
      ),
    );
    const header = groupHeaderPlacement(r, g.iconAlign, !!g.iconAlign);
    if (g.iconAlign) {
      elements.push(
        ...resolveIconElems(
          p,
          g.icon,
          header.icon.x,
          header.icon.y,
          isMono ? palette.textMuted : hue,
          palette,
          iconPacks,
          warnedIcons,
        ),
      );
    }
    elements.push(
      p.text(g.label, rhu(header.label.x), rhu(header.label.y), typography.smallFontSize, groupLabelColor, {
        weight: 'bold',
        anchor: header.label.anchor,
      }),
    );
  });

  // ── Flat box list for orthogonalRouter obstacle detection ────────────────
  const allBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
  for (const [id, pos] of positions) {
    const sz = nodeSizes.get(id);
    if (sz) allBoxes.push({ id, x: pos.x, y: pos.y, width: sz.width, height: sz.height });
  }

  const endpointRect = (
    edge: ArchitectureDocument['edges'][number],
    isSource: boolean,
  ): Rect | undefined => {
    const id = isSource ? edge.from : edge.to;
    let r = rectOf(id);
    if (!r) return undefined;
    const useGroup = isSource ? edge.fromGroup : edge.toGroup;
    if (useGroup) {
      const svc = ir.services.find((s) => s.id === id);
      if (svc?.group) {
        const gr = computeGroupRect(svc.group);
        if (gr) r = gr;
      }
    }
    return r;
  };

  type EndpointSlot = { sourceT?: number; targetT?: number };
  type EndpointMember = {
    edgeIndex: number;
    isSource: boolean;
    tangentKey: number;
  };
  const endpointGroups = new Map<string, EndpointMember[]>();
  const endpointSlots = new Map<number, EndpointSlot>();

  ir.edges.forEach((e, edgeIndex) => {
    const fromRect = endpointRect(e, true);
    const toRect = endpointRect(e, false);
    if (!fromRect || !toRect) return;

    const fromSide = endpointSide(e, true);
    const toSide = endpointSide(e, false);
    const fromCenter = rectCenter(fromRect);
    const toCenter = rectCenter(toRect);

    const sourceKey = `${e.from}:${fromSide.toUpperCase()}`;
    const targetKey = `${e.to}:${toSide.toUpperCase()}`;
    if (!endpointGroups.has(sourceKey)) endpointGroups.set(sourceKey, []);
    if (!endpointGroups.has(targetKey)) endpointGroups.set(targetKey, []);
    endpointGroups
      .get(sourceKey)!
      .push({ edgeIndex, isSource: true, tangentKey: tangentKeyForSide(fromSide, toCenter) });
    endpointGroups
      .get(targetKey)!
      .push({ edgeIndex, isSource: false, tangentKey: tangentKeyForSide(toSide, fromCenter) });
  });

  for (const members of endpointGroups.values()) {
    members.sort(
      (a, b) =>
        a.tangentKey - b.tangentKey ||
        a.edgeIndex - b.edgeIndex ||
        Number(a.isSource) - Number(b.isSource),
    );
    const n = members.length;
    for (let k = 0; k < n; k++) {
      const member = members[k]!;
      const t = (k + 1) / (n + 1);
      const slot = endpointSlots.get(member.edgeIndex) ?? {};
      endpointSlots.set(
        member.edgeIndex,
        member.isSource ? { ...slot, sourceT: t } : { ...slot, targetT: t },
      );
    }
  }

  // Align straight on-axis connections where one side is multi-fanned and the other is single
  ir.edges.forEach((e, edgeIndex) => {
    const fromRect = endpointRect(e, true);
    const toRect = endpointRect(e, false);
    if (!fromRect || !toRect) return;

    const fromSide = endpointSide(e, true).toUpperCase();
    const toSide = endpointSide(e, false).toUpperCase();
    const fromCenter = rectCenter(fromRect);
    const toCenter = rectCenter(toRect);

    const isVerticalStraight =
      ((fromSide === 'B' && toSide === 'T') || (fromSide === 'T' && toSide === 'B')) &&
      Math.abs(fromCenter.x - toCenter.x) < 4;

    const isHorizontalStraight =
      ((fromSide === 'R' && toSide === 'L') || (fromSide === 'L' && toSide === 'R')) &&
      Math.abs(fromCenter.y - toCenter.y) < 4;

    if (isVerticalStraight || isHorizontalStraight) {
      const sourceKey = `${e.from}:${fromSide}`;
      const targetKey = `${e.to}:${toSide}`;
      const sourceCount = endpointGroups.get(sourceKey)?.length ?? 1;
      const targetCount = endpointGroups.get(targetKey)?.length ?? 1;
      const slot = endpointSlots.get(edgeIndex);
      if (sourceCount > 1 && targetCount === 1 && slot?.sourceT !== undefined) {
        endpointSlots.set(edgeIndex, { ...slot, targetT: slot.sourceT });
      } else if (targetCount > 1 && sourceCount === 1 && slot?.targetT !== undefined) {
        endpointSlots.set(edgeIndex, { ...slot, sourceT: slot.targetT });
      }
    }
  });

  for (let edgeIndex = 0; edgeIndex < ir.edges.length; edgeIndex++) {
    const e = ir.edges[edgeIndex]!;
    // Resolve from-port — use group boundary when fromGroup=true.
    let fromRect = endpointRect(e, true);
    if (!fromRect) continue;

    // Resolve to-port — use group boundary when toGroup=true.
    let toRect = endpointRect(e, false);
    if (!toRect) continue;

    const fromDir = e.exitWall ?? sideToDir(e.fromSide);
    const toDir = e.entryWall ?? sideToDir(e.toSide);
    const slots = endpointSlots.get(edgeIndex);
    const pa = port(fromRect, endpointSide(e, true), slots?.sourceT);
    const pb = port(toRect, endpointSide(e, false), slots?.targetT);

    const obstacles: Rect[] = allBoxes
      .filter((bx) => bx.id !== e.from && bx.id !== e.to)
      .map((bx) => ({ x: bx.x, y: bx.y + yOff, width: bx.width, height: bx.height }));

    const routing: RouteStyle = e.routing ?? 'orthogonal';
    const route = createRouter(routing).route({
      from: pa,
      to: pb,
      style: routing,
      obstacles,
      padding: 10,
      fromDir,
      toDir,
    });
    const routedPoints =
      routing === 'orthogonal' && isHorizontalDir(fromDir) !== isHorizontalDir(toDir)
        ? mixedOrthogonalRoutePoints(pa, pb, fromDir, toDir, obstacles, 10)
        : route.points;
    const routePoints = cleanRoutePoints(routedPoints);

    const style = e.style ?? 'solid';

    // Drive arrowhead markers from marker fields, with arrowLeft/Right fallback
    // for older JSON IR created before Triton connector styles existed.
    const pathOpts: Parameters<typeof p.path>[3] = {};
    if (e.endMarker === 'arrow' || (!e.endMarker && e.arrowRight))
      pathOpts.markerEnd = ARROW_END_ID;
    if (e.startMarker === 'arrow' || (!e.startMarker && e.arrowLeft))
      pathOpts.markerStart = ARROW_START_ID;
    const dash = edgeDash(style);
    if (dash) pathOpts.dash = dash;
    if (e.animation && e.animation !== 'none') pathOpts.animated = e.animation;

    const path =
      style === 'wavy'
        ? wavifyPath(routePoints, 3, 12)
        : routing === 'bezier'
          ? route.path
          : routePointsToPath(routePoints, route.path);
    elements.push(p.path(path, palette.primary, edgeStrokeWidth(style, 1.6), pathOpts));
  }

  // ── Service nodes ─────────────────────────────────────────────────────────
  ir.services.forEach((s, i) => {
    const r = rectOf(s.id);
    if (!r) return;
    const hue = categoricalHue(i, theme);
    elements.push(
      p.rect(
        { x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: rhu(r.height) },
        palette.surface,
        palette.border,
        1.4,
        { rx: 8 },
      ),
    );
    elements.push(
      p.rect({ x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: 8 }, hue, hue, 0, { rx: 4 }),
    );

    // Icon: try iconify resolution first, fall back to built-in glyph.
    const iconPos = iconCenter(r, s.iconAlign);
    const iconElems = resolveIconElems(
      p,
      s.icon,
      iconPos.x,
      iconPos.y,
      isMono ? palette.text : hue,
      palette,
      iconPacks,
      warnedIcons,
    );
    elements.push(...iconElems);

    const area = serviceLabelArea(r, s.iconAlign);
    const info = serviceInfos.get(s.id);
    if (info) {
      elements.push(
        ...renderFormattedText(
          p,
          info,
          area.x,
          area.y,
          area.width,
          area.height,
          font,
          smallFont,
          palette.text,
          palette.textMuted,
          { align: area.anchor, defaultBold: true },
        ),
      );
    }
  });

  // ── Junction nodes (4-way crosshair dot) ─────────────────────────────────
  ir.junctions.forEach((j) => {
    const r = rectOf(j.id);
    if (!r) return;
    const cx = rhu(r.x + r.width / 2);
    const cy = rhu(r.y + r.height / 2);
    const R = 4; // outer crosshair half-length
    // Central filled circle
    elements.push(p.circle({ x: cx, y: cy }, R, palette.primary, palette.primary, 0));
    // Four short lines extending to the sides (visual affordance for 4-way)
    elements.push(
      p.path(
        `M ${rhu(cx - R)} ${cy} L ${rhu(cx + R)} ${cy} M ${cx} ${rhu(cy - R)} L ${cx} ${rhu(cy + R)}`,
        palette.primary,
        1.6,
      ),
    );
  });

  // ── Compute canvas bounds ─────────────────────────────────────────────────
  const allNodeRects: Rect[] = [
    ...ir.services.map((s) => rectOf(s.id)).filter((r): r is Rect => !!r),
    ...ir.junctions.map((j) => rectOf(j.id)).filter((r): r is Rect => !!r),
  ];
  // Also include group rects so nested group labels aren't clipped.
  const allGroupRects: Rect[] = [...groupRectCache.values()];
  const allRects = [...allNodeRects, ...allGroupRects];

  if (allRects.length === 0) {
    // Empty diagram — minimal canvas.
    const scene: Scene = applyOverlays(
      {
        viewBox: { x: 0, y: 0, width: 200, height: 100 },
        background: palette.background,
        elements,
        defs: [],
      },
      ir.overlays,
      theme,
    );
    return { scene, anchors: {} };
  }

  const totalW = rhuInt(Math.max(...allRects.map((r) => r.x + r.width)) + margin + 26);
  const totalH = rhuInt(Math.max(...allRects.map((r) => r.y + r.height)) + margin + 26);

  // Expand viewBox upward/leftward to accommodate group boxes that extend above/left of origin.
  const vbX = rhuInt(Math.min(0, ...allRects.map((r) => r.x)) - margin);
  const vbY = rhuInt(Math.min(0, ...allRects.map((r) => r.y)) - margin);

  const s = theme.edges?.arrowSize ?? 8;
  const sW = s * 2;
  const sH = rhu(sW * 0.8125);
  const sMidY = rhu(sH / 2);
  const sRefX = rhu(sW * 0.9);
  const sRefXStart = rhu(sW * 0.1);

  const defs = [
    `<marker id="${ARROW_END_ID}" markerUnits="userSpaceOnUse" markerWidth="${sW}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto">` +
      `<polygon points="0 0, ${sW} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
    `<marker id="${ARROW_START_ID}" markerUnits="userSpaceOnUse" markerWidth="${sW}" markerHeight="${sH}" refX="${sRefXStart}" refY="${sMidY}" orient="auto-start-reverse">` +
      `<polygon points="0 0, ${sW} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
  ];

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: vbX, y: vbY, width: totalW - vbX, height: totalH - vbY },
      background: palette.background,
      elements,
      defs,
    },
    ir.overlays,
    theme,
  );

  return { scene, anchors: {} };
}

function cleanRoutePoints(
  points: readonly { x: number; y: number }[],
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) out.push(p);
  }
  return out;
}

function routePointsToPath(points: readonly { x: number; y: number }[], fallback: string): string {
  if (points.length === 0) return fallback;
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function isHorizontalDir(dir: PortDirection): boolean {
  return dir === 'E' || dir === 'W';
}

function mixedOrthogonalRoutePoints(
  from: Point,
  to: Point,
  fromDir: PortDirection,
  toDir: PortDirection,
  obstacles: readonly Rect[],
  pad: number,
): Point[] {
  // Check if a direct single-bend L-route is collision-free
  const directCorner: Point = isHorizontalDir(fromDir)
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
  const simpleL = [from, directCorner, to];
  if (routeCollisionCount(simpleL, obstacles) === 0) {
    return simpleL;
  }

  // When direct L crosses an obstacle, route via corridor bend with minimal segments
  const stubLen = Math.max(pad, 20);
  const stub1 = offsetPoint(from, fromDir, stubLen);
  const stub2 = offsetPoint(to, toDir, stubLen);

  if (isHorizontalDir(fromDir)) {
    let bendX = (from.x + to.x) / 2;
    const blockingObstacles = obstacles.filter(
      (o) =>
        ((fromDir === 'E' && o.x > from.x && o.x < to.x) ||
          (fromDir === 'W' && o.x + o.width < from.x && o.x + o.width > to.x)) &&
        from.y >= o.y - pad &&
        from.y <= o.y + o.height + pad,
    );
    if (blockingObstacles.length > 0) {
      if (fromDir === 'E') {
        const nearest = Math.min(...blockingObstacles.map((o) => o.x));
        bendX = (from.x + nearest) / 2;
      } else {
        const nearest = Math.max(...blockingObstacles.map((o) => o.x + o.width));
        bendX = (from.x + nearest) / 2;
      }
    }

    const candidates = [
      (from.y + to.y) / 2,
      (stub1.y + stub2.y) / 2,
      ...obstacles.flatMap((o) => [
        o.y - pad,
        o.y + o.height + pad,
        (o.y + to.y) / 2,
        (o.y + o.height + to.y) / 2,
      ]),
    ];
    const bendY = bestBend(
      candidates,
      (y) => [from, { x: bendX, y: from.y }, { x: bendX, y }, { x: to.x, y }, to],
      obstacles,
    );
    const candidate = [
      from,
      { x: bendX, y: from.y },
      { x: bendX, y: bendY },
      { x: to.x, y: bendY },
      to,
    ];
    return clearMixedRoute(candidate, from, to, stub1, stub2, obstacles, pad);
  }

  let bendY = (from.y + to.y) / 2;
  const blockingObstacles = obstacles.filter(
    (o) =>
      ((fromDir === 'S' && o.y > from.y && o.y < to.y) ||
        (fromDir === 'N' && o.y + o.height < from.y && o.y + o.height > to.y)) &&
      from.x >= o.x - pad &&
      from.x <= o.x + o.width + pad,
  );
  if (blockingObstacles.length > 0) {
    if (fromDir === 'S') {
      const nearest = Math.min(...blockingObstacles.map((o) => o.y));
      bendY = (from.y + nearest) / 2;
    } else {
      const nearest = Math.max(...blockingObstacles.map((o) => o.y + o.height));
      bendY = (from.y + nearest) / 2;
    }
  }

  const candidates = [
    (from.x + to.x) / 2,
    (stub1.x + stub2.x) / 2,
    ...obstacles.flatMap((o) => [
      o.x - pad,
      o.x + o.width + pad,
      (o.x + to.x) / 2,
      (o.x + o.width + to.x) / 2,
    ]),
  ];
  const bendX = bestBend(
    candidates,
    (x) => [from, { x: from.x, y: bendY }, { x, y: bendY }, { x, y: to.y }, to],
    obstacles,
  );
  const candidate = [
    from,
    { x: from.x, y: bendY },
    { x: bendX, y: bendY },
    { x: bendX, y: to.y },
    to,
  ];
  return clearMixedRoute(candidate, from, to, stub1, stub2, obstacles, pad);
}

function clearMixedRoute(
  candidate: Point[],
  from: Point,
  to: Point,
  stub1: Point,
  stub2: Point,
  obstacles: readonly Rect[],
  pad: number,
): Point[] {
  if (routeCollisionCount(candidate, obstacles) === 0) return candidate;
  const middle = createRouter('orthogonal').route({
    from: stub1,
    to: stub2,
    style: 'orthogonal',
    obstacles,
    padding: pad,
  }).points;
  const detour = [from, ...middle, to];
  return routeCollisionCount(detour, obstacles) < routeCollisionCount(candidate, obstacles)
    ? detour
    : candidate;
}

function offsetPoint(p: Point, dir: PortDirection, amount: number): Point {
  switch (dir) {
    case 'W':
      return { x: p.x - amount, y: p.y };
    case 'E':
      return { x: p.x + amount, y: p.y };
    case 'N':
      return { x: p.x, y: p.y - amount };
    case 'S':
      return { x: p.x, y: p.y + amount };
  }
}

function bestBend(
  candidates: readonly number[],
  build: (v: number) => Point[],
  obstacles: readonly Rect[],
): number {
  let best = candidates[0] ?? 0;
  let bestHits = Infinity;
  let bestLen = Infinity;
  for (const c of [...new Set(candidates)]) {
    const points = build(c);
    const hits = routeCollisionCount(points, obstacles);
    const len = routeLength(points);
    if (hits < bestHits || (hits === bestHits && len < bestLen)) {
      best = c;
      bestHits = hits;
      bestLen = len;
    }
  }
  return best;
}

function routeCollisionCount(points: readonly Point[], obstacles: readonly Rect[]): number {
  let count = 0;
  for (let i = 0; i < points.length - 1; i++) {
    for (const obs of obstacles) {
      if (segmentCrossesRectInterior(points[i]!, points[i + 1]!, obs)) count++;
    }
  }
  return count;
}

function routeLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.abs(points[i + 1]!.x - points[i]!.x) + Math.abs(points[i + 1]!.y - points[i]!.y);
  }
  return len;
}

function segmentCrossesRectInterior(a: Point, b: Point, r: Rect): boolean {
  const xMin = r.x,
    xMax = r.x + r.width,
    yMin = r.y,
    yMax = r.y + r.height;
  if (a.x === b.x) {
    if (a.x <= xMin || a.x >= xMax) return false;
    return Math.max(a.y, b.y) > yMin && Math.min(a.y, b.y) < yMax;
  }
  if (a.y === b.y) {
    if (a.y <= yMin || a.y >= yMax) return false;
    return Math.max(a.x, b.x) > xMin && Math.min(a.x, b.x) < xMax;
  }
  return false;
}

// ─── Icon resolution (Feature 6) ──────────────────────────────────────────────

/**
 * Attempt to resolve an icon token as a prefixed iconify reference (prefix:name).
 * Falls back to the built-in line-art glyph when:
 *   - the token has no colon (it's a simple glyph hint like "server"),
 *   - no icon pack map was provided,
 *   - parseIconRef or resolveIcon fails.
 * Emits console.warn once per unresolvable prefixed token.
 */
function resolveIconElems(
  p: ReturnType<typeof pen>,
  icon: string,
  cx: number,
  cy: number,
  hue: string,
  palette: ResolvedTheme['palette'],
  iconPacks: Parameters<typeof resolveIcon>[1] | undefined,
  warnedIcons: Set<string>,
): SceneElement[] {
  // Only attempt iconify resolution when there is a colon separator.
  if (icon.includes(':') && iconPacks) {
    const ref = parseIconRef(icon);
    if (ref.ok) {
      const resolved = resolveIcon(ref.value, iconPacks);
      if (resolved.ok) {
        // Center the icon in a 24×24 box at (cx, cy).
        const size = 24;
        return [
          p.icon(resolved.value, rhu(cx - size / 2), rhu(cy - size / 2), size, { color: hue }),
        ];
      }
    }
    // Resolution failed — warn once.
    if (!warnedIcons.has(icon)) {
      warnedIcons.add(icon);
      console.warn(`[architecture] icon "${icon}" could not be resolved — falling back to glyph.`);
    }
  } else if (icon.includes(':') && !iconPacks) {
    // Prefixed token but no packs loaded — warn once.
    if (!warnedIcons.has(icon)) {
      warnedIcons.add(icon);
      console.warn(
        `[architecture] icon "${icon}" is an iconify token but no icon packs were loaded.`,
      );
    }
  }

  // Built-in line-art glyph fallback.
  return iconGlyph(p, icon, cx, cy, hue, palette);
}

// ─── Built-in line-art glyphs ─────────────────────────────────────────────────

/** A small line glyph for a service icon name (server/database/cloud/internet/disk). */
function iconGlyph(
  p: ReturnType<typeof pen>,
  icon: string,
  cx: number,
  cy: number,
  hue: string,
  palette: ResolvedTheme['palette'],
): SceneElement[] {
  const name = icon.toLowerCase();
  const out: SceneElement[] = [];
  const stroke = hue;
  if (name.includes('server') || name.includes('compute')) {
    for (let i = 0; i < 3; i++)
      out.push(
        p.rect(
          { x: rhu(cx - 10), y: rhu(cy - 9 + i * 7), width: 20, height: 5 },
          palette.surface,
          stroke,
          1.3,
          { rx: 1 },
        ),
      );
  } else if (
    name.includes('database') ||
    name.includes('db') ||
    name.includes('datastore') ||
    name.includes('storage') ||
    name.includes('disk')
  ) {
    out.push(
      p.rect(
        { x: rhu(cx - 9), y: rhu(cy - 9), width: 18, height: 18 },
        palette.surface,
        stroke,
        1.3,
        { rx: 5 },
      ),
    );
    out.push(
      p.path(
        `M ${rhu(cx - 9)} ${rhu(cy - 3)} Q ${rhu(cx)} ${rhu(cy + 1)}, ${rhu(cx + 9)} ${rhu(cy - 3)}`,
        stroke,
        1.3,
      ),
    );
  } else if (name.includes('cloud')) {
    out.push(p.circle({ x: rhu(cx - 6), y: rhu(cy + 2) }, 6, palette.surface, stroke, 1.3));
    out.push(p.circle({ x: rhu(cx + 6), y: rhu(cy + 2) }, 6, palette.surface, stroke, 1.3));
    out.push(p.circle({ x: rhu(cx), y: rhu(cy - 3) }, 7, palette.surface, stroke, 1.3));
    out.push(
      p.rect(
        { x: rhu(cx - 10), y: rhu(cy + 2), width: 20, height: 6 },
        palette.surface,
        palette.surface,
        0,
      ),
    );
  } else if (
    name.includes('internet') ||
    name.includes('globe') ||
    name.includes('web') ||
    name.includes('client')
  ) {
    out.push(p.circle({ x: rhu(cx), y: rhu(cy) }, 9, palette.surface, stroke, 1.3));
    out.push(
      p.path(
        `M ${rhu(cx)} ${rhu(cy - 9)} L ${rhu(cx)} ${rhu(cy + 9)} M ${rhu(cx - 9)} ${rhu(cy)} L ${rhu(cx + 9)} ${rhu(cy)}`,
        stroke,
        1,
      ),
    );
    out.push(
      p.path(
        `M ${rhu(cx - 9)} ${rhu(cy)} Q ${rhu(cx)} ${rhu(cy - 11)}, ${rhu(cx + 9)} ${rhu(cy)} Q ${rhu(cx)} ${rhu(cy + 11)}, ${rhu(cx - 9)} ${rhu(cy)}`,
        stroke,
        1,
      ),
    );
  } else {
    out.push(
      p.rect(
        { x: rhu(cx - 9), y: rhu(cy - 9), width: 18, height: 18 },
        palette.surface,
        stroke,
        1.3,
        { rx: 4 },
      ),
    );
  }
  return out;
}
