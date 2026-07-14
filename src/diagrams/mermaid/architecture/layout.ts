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
 *   5. Align          — row/column constraints applied as post-grid position nudges.
 *   6. Nested groups  — parent groups visually contain child groups.
 *   7. Iconify icons  — prefix:name tokens resolved through LayoutOptions.icons;
 *                       unresolvable tokens fall back to the built-in glyph.
 *
 * Deviations / limitations (disclosed):
 *   - Align constraints are applied as a post-BFS median-snap. Edge directions
 *     take precedence; align is a fixup for disconnected nodes or user overrides.
 *   - Iconify resolution requires the host to supply LayoutOptions.icons.
 */

import type { ArchitectureDocument, ArchGroup } from './ir.js';
import type { Scene, SceneElement, LayoutResult, Rect, PortDirection, LayoutOptions, RouteStyle } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { directionalGridPlacer } from './gridPlacer.js';
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
  const colGap = 90, rowGap = 44;
  const gridCells = directionalGridPlacer(
    [...ir.services, ...ir.junctions],
    ir.edges,
  );

  // Convert grid cells → pixel coords; mutable for align post-processing.
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, cell] of gridCells) {
    positions.set(id, {
      x: cell.col * (svcW + colGap) + margin,
      y: cell.row * (svcH + rowGap) + margin,
    });
  }

  // ── Apply align constraints (approximated as median-snap) ─────────────────
  for (const align of ir.aligns) {
    const coords = align.members
      .map(id => positions.get(id))
      .filter((pos): pos is { x: number; y: number } => !!pos);
    if (coords.length < 2) continue;

    if (align.axis === 'row') {
      // Pin all members to the median y of the group.
      const ys = coords.map(c => c.y).sort((a, b) => a - b);
      const medY = ys[Math.floor(ys.length / 2)]!;
      for (const id of align.members) {
        const pos = positions.get(id);
        if (pos) pos.y = medY;
      }
    } else {
      // column — pin to median x.
      const xs = coords.map(c => c.x).sort((a, b) => a - b);
      const medX = xs[Math.floor(xs.length / 2)]!;
      for (const id of align.members) {
        const pos = positions.get(id);
        if (pos) pos.x = medX;
      }
    }
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
    elements.push(p.text(
      g.label, rhu(r.x + 12), rhu(r.y + 16),
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

    const pa       = port(fromRect, e.fromSide);
    const pb       = port(toRect,   e.toSide);
    const fromDir  = e.exitWall ?? sideToDir(e.fromSide);
    const toDir    = e.entryWall ?? sideToDir(e.toSide);

    const obstacles: Rect[] = allBoxes
      .filter(bx => bx.id !== e.from && bx.id !== e.to)
      .map(bx => ({ x: bx.x, y: bx.y + yOff, width: bx.width, height: bx.height }));

    const routing: RouteStyle = e.routing ?? 'orthogonal';
    const route = createRouter(routing).route({
      from: pa, to: pb, style: routing,
      obstacles, padding: 10,
      fromDir, toDir,
    });

    const style = e.style ?? 'solid';

    // Drive arrowhead markers from marker fields, with arrowLeft/Right fallback
    // for older JSON IR created before Triton connector styles existed.
    const pathOpts: Parameters<typeof p.path>[3] = {};
    if (e.endMarker === 'arrow' || (!e.endMarker && e.arrowRight)) pathOpts.markerEnd = ARROW_END_ID;
    if (e.startMarker === 'arrow' || (!e.startMarker && e.arrowLeft)) pathOpts.markerStart = ARROW_START_ID;
    const dash = edgeDash(style);
    if (dash) pathOpts.dash = dash;
    if (e.animation && e.animation !== 'none') pathOpts.animated = e.animation;

    const path = style === 'wavy' ? wavifyPath(route.points, 3, 12) : route.path;
    elements.push(p.path(path, palette.primary, edgeStrokeWidth(style, 1.6), pathOpts));
  }

  // ── Service nodes ─────────────────────────────────────────────────────────
  const warnedIcons = new Set<string>();
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
    const iconElems = resolveIconElems(p, s.icon, r.x + r.width / 2, r.y + 24, hue, palette, iconPacks, warnedIcons);
    elements.push(...iconElems);

    elements.push(p.text(
      s.label, rhuInt(r.x + r.width / 2), rhu(r.y + r.height - 9),
      font, palette.text, { weight: 'bold', anchor: 'middle' },
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
