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
import type { Scene, SceneElement, LayoutResult, Point, Rect, PortDirection, LayoutOptions, RouteStyle, TextAnchor } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { groupAwareDirectionalGridPlacer } from './gridPlacer.js';
import { createRouter } from '../../../routing/router.js';
import { rhu, rhuInt } from '../../../util/round.js';
import { parseIconRef, resolveIcon } from '../../../icons/resolver.js';
import { wavifyPath } from '../../../crosslink/render.js';

// ─── Marker IDs ──────────────────────────────────────────────────────────────

const ARROW_END_ID   = 'arch-arrow-end';   // → points in path direction
const ARROW_START_ID = 'arch-arrow-start'; // ← points against path direction

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function port(r: Rect, side: string): { x: number; y: number } {
  switch (side.toUpperCase()) {
    case 'L': return { x: r.x,                  y: r.y + r.height / 2 };
    case 'R': return { x: r.x + r.width,         y: r.y + r.height / 2 };
    case 'T': return { x: r.x + r.width / 2,     y: r.y                };
    default:  return { x: r.x + r.width / 2,     y: r.y + r.height     };
  }
}

function sideToDir(side: string): PortDirection {
  switch (side.toUpperCase()) {
    case 'L': return 'W';
    case 'R': return 'E';
    case 'T': return 'N';
    default:  return 'S';
  }
}

function dirToSide(dir: PortDirection): string {
  switch (dir) {
    case 'W': return 'L';
    case 'E': return 'R';
    case 'N': return 'T';
    case 'S': return 'B';
  }
}

function edgeDash(style: string | undefined): string | undefined {
  switch (style) {
    case 'dotted': return '6 3';
    case 'dashed': return '8 4';
    default: return undefined;
  }
}

function edgeStrokeWidth(style: string | undefined, base: number): number {
  return style === 'thick' ? base * 2 : base;
}

function iconCenter(r: Rect, align: ArchIconAlign | undefined): { x: number; y: number } {
  switch (align ?? 'N') {
    case 'S':  return { x: r.x + r.width / 2, y: r.y + r.height - 24 };
    case 'E':  return { x: r.x + r.width - 24, y: r.y + r.height / 2 };
    case 'W':  return { x: r.x + 24, y: r.y + r.height / 2 };
    case 'NE': return { x: r.x + r.width - 24, y: r.y + 24 };
    case 'NW': return { x: r.x + 24, y: r.y + 24 };
    case 'SE': return { x: r.x + r.width - 24, y: r.y + r.height - 24 };
    case 'SW': return { x: r.x + 24, y: r.y + r.height - 24 };
    case 'C':  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    case 'N':
    default:   return { x: r.x + r.width / 2, y: r.y + 24 };
  }
}

function serviceLabelPlacement(r: Rect, align: ArchIconAlign | undefined): { x: number; y: number; anchor: TextAnchor } {
  switch (align) {
    case 'W':  return { x: r.x + 46, y: r.y + r.height - 9, anchor: 'start' };
    case 'E':  return { x: r.x + r.width - 46, y: r.y + r.height - 9, anchor: 'end' };
    case 'S':
    case 'SE':
    case 'SW': return { x: r.x + r.width / 2, y: r.y + 21, anchor: 'middle' };
    default:   return { x: r.x + r.width / 2, y: r.y + r.height - 9, anchor: 'middle' };
  }
}

// ─── Group sort (parent before child for back-to-front rendering) ─────────────

function groupsByDepth(groups: readonly ArchGroup[]): ArchGroup[] {
  const result: ArchGroup[] = [];
  const added = new Set<string>();
  function add(g: ArchGroup) {
    if (added.has(g.id)) return;
    if (g.parent) {
      const par = groups.find(pg => pg.id === g.parent);
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
  const iconPacks = options?.icons;

  // ── Sizes ─────────────────────────────────────────────────────────────────
  const svcW = 130, svcH = 56;
  const jctW = 16,  jctH = 16; // junctions are small crosshair nodes

  // ── Node sizes (services vs junctions) ───────────────────────────────────
  const nodeSizes = new Map<string, { width: number; height: number }>();
  for (const s of ir.services)  nodeSizes.set(s.id, { width: svcW, height: svcH });
  for (const j of ir.junctions) nodeSizes.set(j.id, { width: jctW, height: jctH });

  // ── Directional grid placement ────────────────────────────────────────────
  const colGap = 90, rowGap = 64;
  const gridCells = groupAwareDirectionalGridPlacer(ir);

  // Convert grid cells → pixel coords; mutable for align post-processing.
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, cell] of gridCells) {
    positions.set(id, {
      x: cell.col * (svcW + colGap) + margin,
      y: cell.row * (svcH + rowGap) + margin,
    });
  }

  // ── rectOf: adjusted position + node size + yOffset ─────────────────────
  const titleH = ir.metadata.title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;
  const rectOf = (id: string): Rect | undefined => {
    const pos = positions.get(id);
    const sz  = nodeSizes.get(id);
    if (!pos || !sz) return undefined;
    return { x: pos.x, y: pos.y + yOff, width: sz.width, height: sz.height };
  };

  // ── Compute group rects (memoised, recursive for nested groups) ───────────
  const groupRectCache = new Map<string, Rect>();
  const computeGroupRect = (gId: string): Rect | undefined => {
    if (groupRectCache.has(gId)) return groupRectCache.get(gId)!;
    const pad = 20;
    const memberRects: Rect[] = [
      ...ir.services .filter(s => s.group === gId).map(s => rectOf(s.id)).filter((r): r is Rect => !!r),
      ...ir.junctions.filter(j => j.group === gId).map(j => rectOf(j.id)).filter((r): r is Rect => !!r),
      ...ir.groups   .filter(g => g.parent === gId).map(g => computeGroupRect(g.id)).filter((r): r is Rect => !!r),
    ];
    if (memberRects.length === 0) return undefined;
    const minX = Math.min(...memberRects.map(r => r.x)) - pad;
    const minY = Math.min(...memberRects.map(r => r.y)) - pad - 14;
    const maxX = Math.max(...memberRects.map(r => r.x + r.width))  + pad;
    const maxY = Math.max(...memberRects.map(r => r.y + r.height)) + pad;
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
    elements.push(p.text(
      String(ir.metadata.title), margin, margin + typography.titleFontSize,
      typography.titleFontSize, palette.text, { weight: 'bold' },
    ));
  }

  // ── Group boxes (outermost first so children render on top) ──────────────
  const orderedGroups = groupsByDepth(ir.groups);
  orderedGroups.forEach((g, gi) => {
    const r = computeGroupRect(g.id);
    if (!r) return;
    const hue = categoricalHue(gi);
    elements.push(p.rect(
      { x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: rhu(r.height) },
      hue + '14', hue, 1.4, { rx: 10 },
    ));
    if (g.iconAlign) {
      const c = iconCenter(r, g.iconAlign);
      elements.push(...resolveIconElems(p, g.icon, c.x, c.y, hue, palette, iconPacks, warnedIcons));
    }
    const labelX = g.iconAlign === 'NW' || g.iconAlign === 'W' ? r.x + 42 : r.x + 12;
    elements.push(p.text(
      g.label, rhu(labelX), rhu(r.y + 16),
      typography.smallFontSize, hue, { weight: 'bold' },
    ));
  });

  // ── Flat box list for orthogonalRouter obstacle detection ────────────────
  const allBoxes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
  for (const [id, pos] of positions) {
    const sz = nodeSizes.get(id);
    if (sz) allBoxes.push({ id, x: pos.x, y: pos.y, width: sz.width, height: sz.height });
  }

  for (const e of ir.edges) {
    // Resolve from-port — use group boundary when fromGroup=true.
    let fromRect = rectOf(e.from);
    if (!fromRect) continue;
    if (e.fromGroup) {
      const svc = ir.services.find(s => s.id === e.from);
      if (svc?.group) {
        const gr = computeGroupRect(svc.group);
        if (gr) fromRect = gr;
      }
    }

    // Resolve to-port — use group boundary when toGroup=true.
    let toRect = rectOf(e.to);
    if (!toRect) continue;
    if (e.toGroup) {
      const svc = ir.services.find(s => s.id === e.to);
      if (svc?.group) {
        const gr = computeGroupRect(svc.group);
        if (gr) toRect = gr;
      }
    }

    const fromDir  = e.exitWall ?? sideToDir(e.fromSide);
    const toDir    = e.entryWall ?? sideToDir(e.toSide);
    const pa       = port(fromRect, e.exitWall ? dirToSide(e.exitWall) : e.fromSide);
    const pb       = port(toRect,   e.entryWall ? dirToSide(e.entryWall) : e.toSide);

    const obstacles: Rect[] = allBoxes
      .filter(bx => bx.id !== e.from && bx.id !== e.to)
      .map(bx => ({ x: bx.x, y: bx.y + yOff, width: bx.width, height: bx.height }));

    const routing: RouteStyle = e.routing ?? 'orthogonal';
    const route = createRouter(routing).route({
      from: pa, to: pb, style: routing,
      obstacles, padding: 10,
      fromDir, toDir,
    });
    const routedPoints = routing === 'orthogonal' && isHorizontalDir(fromDir) !== isHorizontalDir(toDir)
      ? mixedOrthogonalRoutePoints(pa, pb, fromDir, toDir, obstacles, 10)
      : route.points;
    const routePoints = cleanRoutePoints(routedPoints);

    const style = e.style ?? 'solid';

    // Drive arrowhead markers from marker fields, with arrowLeft/Right fallback
    // for older JSON IR created before Triton connector styles existed.
    const pathOpts: Parameters<typeof p.path>[3] = {};
    if (e.endMarker === 'arrow' || (!e.endMarker && e.arrowRight)) pathOpts.markerEnd = ARROW_END_ID;
    if (e.startMarker === 'arrow' || (!e.startMarker && e.arrowLeft)) pathOpts.markerStart = ARROW_START_ID;
    const dash = edgeDash(style);
    if (dash) pathOpts.dash = dash;
    if (e.animation && e.animation !== 'none') pathOpts.animated = e.animation;

    const path = style === 'wavy'
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
    const hue = categoricalHue(i);
    elements.push(p.rect(
      { x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: rhu(r.height) },
      palette.surface, palette.border, 1.4, { rx: 8 },
    ));
    elements.push(p.rect(
      { x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: 8 },
      hue, hue, 0, { rx: 4 },
    ));

    // Icon: try iconify resolution first, fall back to built-in glyph.
    const iconPos = iconCenter(r, s.iconAlign);
    const iconElems = resolveIconElems(p, s.icon, iconPos.x, iconPos.y, hue, palette, iconPacks, warnedIcons);
    elements.push(...iconElems);

    const label = serviceLabelPlacement(r, s.iconAlign);
    elements.push(p.text(
      s.label, rhuInt(label.x), rhu(label.y),
      font, palette.text, { weight: 'bold', anchor: label.anchor },
    ));
  });

  // ── Junction nodes (4-way crosshair dot) ─────────────────────────────────
  ir.junctions.forEach(j => {
    const r = rectOf(j.id);
    if (!r) return;
    const cx = rhu(r.x + r.width  / 2);
    const cy = rhu(r.y + r.height / 2);
    const R  = 4; // outer crosshair half-length
    // Central filled circle
    elements.push(p.circle({ x: cx, y: cy }, R, palette.primary, palette.primary, 0));
    // Four short lines extending to the sides (visual affordance for 4-way)
    elements.push(p.path(
      `M ${rhu(cx - R)} ${cy} L ${rhu(cx + R)} ${cy} M ${cx} ${rhu(cy - R)} L ${cx} ${rhu(cy + R)}`,
      palette.primary, 1.6,
    ));
  });

  // ── Compute canvas bounds ─────────────────────────────────────────────────
  const allNodeRects: Rect[] = [
    ...ir.services .map(s => rectOf(s.id)).filter((r): r is Rect => !!r),
    ...ir.junctions.map(j => rectOf(j.id)).filter((r): r is Rect => !!r),
  ];
  // Also include group rects so nested group labels aren't clipped.
  const allGroupRects: Rect[] = [...groupRectCache.values()];
  const allRects = [...allNodeRects, ...allGroupRects];

  if (allRects.length === 0) {
    // Empty diagram — minimal canvas.
    const scene: Scene = applyOverlays(
      { viewBox: { x: 0, y: 0, width: 200, height: 100 }, background: palette.background, elements, defs: [] },
      ir.overlays, theme,
    );
    return { scene, anchors: {} };
  }

  const totalW = rhuInt(Math.max(...allRects.map(r => r.x + r.width))  + margin + 26);
  const totalH = rhuInt(Math.max(...allRects.map(r => r.y + r.height)) + margin + 26);

  // Expand viewBox upward/leftward to accommodate group boxes that extend above/left of origin.
  const vbX = rhuInt(Math.min(0, ...allRects.map(r => r.x)) - margin);
  const vbY = rhuInt(Math.min(0, ...allRects.map(r => r.y)) - margin);

  const defs = [
    `<marker id="${ARROW_END_ID}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">` +
      `<polygon points="0 0, 10 4, 0 8" fill="${palette.primary}" /></marker>`,
    `<marker id="${ARROW_START_ID}" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse">` +
      `<polygon points="0 0, 10 4, 0 8" fill="${palette.primary}" /></marker>`,
  ];

  const scene: Scene = applyOverlays({
    viewBox: { x: vbX, y: vbY, width: totalW - vbX, height: totalH - vbY },
    background: palette.background,
    elements,
    defs,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}

function cleanRoutePoints(points: readonly { x: number; y: number }[]): Array<{ x: number; y: number }> {
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
  const stubLen = Math.max(pad, 24);
  const stub1 = offsetPoint(from, fromDir, stubLen);
  const stub2 = offsetPoint(to, toDir, stubLen);
  if (isHorizontalDir(fromDir)) {
    const bendY = bestBend(
      [(stub1.y + stub2.y) / 2, ...obstacles.flatMap(o => [o.y - pad, o.y + o.height + pad])],
      y => [from, stub1, { x: stub1.x, y }, { x: stub2.x, y }, stub2, to],
      obstacles,
    );
    return [from, stub1, { x: stub1.x, y: bendY }, { x: stub2.x, y: bendY }, stub2, to];
  }
  const bendX = bestBend(
    [(stub1.x + stub2.x) / 2, ...obstacles.flatMap(o => [o.x - pad, o.x + o.width + pad])],
    x => [from, stub1, { x, y: stub1.y }, { x, y: stub2.y }, stub2, to],
    obstacles,
  );
  return [from, stub1, { x: bendX, y: stub1.y }, { x: bendX, y: stub2.y }, stub2, to];
}

function offsetPoint(p: Point, dir: PortDirection, amount: number): Point {
  switch (dir) {
    case 'W': return { x: p.x - amount, y: p.y };
    case 'E': return { x: p.x + amount, y: p.y };
    case 'N': return { x: p.x, y: p.y - amount };
    case 'S': return { x: p.x, y: p.y + amount };
  }
}

function bestBend(candidates: readonly number[], build: (v: number) => Point[], obstacles: readonly Rect[]): number {
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
  const xMin = r.x, xMax = r.x + r.width, yMin = r.y, yMax = r.y + r.height;
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
        return [p.icon(resolved.value, rhu(cx - size / 2), rhu(cy - size / 2), size, { color: hue })];
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
      console.warn(`[architecture] icon "${icon}" is an iconify token but no icon packs were loaded.`);
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
    for (let i = 0; i < 3; i++) out.push(p.rect({ x: rhu(cx - 10), y: rhu(cy - 9 + i * 7), width: 20, height: 5 }, palette.surface, stroke, 1.3, { rx: 1 }));
  } else if (name.includes('database') || name.includes('db') || name.includes('datastore') || name.includes('storage') || name.includes('disk')) {
    out.push(p.rect({ x: rhu(cx - 9), y: rhu(cy - 9), width: 18, height: 18 }, palette.surface, stroke, 1.3, { rx: 5 }));
    out.push(p.path(`M ${rhu(cx - 9)} ${rhu(cy - 3)} Q ${rhu(cx)} ${rhu(cy + 1)}, ${rhu(cx + 9)} ${rhu(cy - 3)}`, stroke, 1.3));
  } else if (name.includes('cloud')) {
    out.push(p.circle({ x: rhu(cx - 6), y: rhu(cy + 2) }, 6, palette.surface, stroke, 1.3));
    out.push(p.circle({ x: rhu(cx + 6), y: rhu(cy + 2) }, 6, palette.surface, stroke, 1.3));
    out.push(p.circle({ x: rhu(cx), y: rhu(cy - 3) }, 7, palette.surface, stroke, 1.3));
    out.push(p.rect({ x: rhu(cx - 10), y: rhu(cy + 2), width: 20, height: 6 }, palette.surface, palette.surface, 0));
  } else if (name.includes('internet') || name.includes('globe') || name.includes('web') || name.includes('client')) {
    out.push(p.circle({ x: rhu(cx), y: rhu(cy) }, 9, palette.surface, stroke, 1.3));
    out.push(p.path(`M ${rhu(cx)} ${rhu(cy - 9)} L ${rhu(cx)} ${rhu(cy + 9)} M ${rhu(cx - 9)} ${rhu(cy)} L ${rhu(cx + 9)} ${rhu(cy)}`, stroke, 1));
    out.push(p.path(`M ${rhu(cx - 9)} ${rhu(cy)} Q ${rhu(cx)} ${rhu(cy - 11)}, ${rhu(cx + 9)} ${rhu(cy)} Q ${rhu(cx)} ${rhu(cy + 11)}, ${rhu(cx - 9)} ${rhu(cy)}`, stroke, 1));
  } else {
    out.push(p.rect({ x: rhu(cx - 9), y: rhu(cy - 9), width: 18, height: 18 }, palette.surface, stroke, 1.3, { rx: 4 }));
  }
  return out;
}
