/**
 * Cross-Link Rendering
 *
 * Converts resolved cross-links into SceneElements (paths + labels)
 * that are layered on top of the poster's cell elements.
 *
 * Routes use the orthogonal router with port-direction hints from the
 * resolved link's fromSide/toSide.
 */

import type { SceneElement } from '../contracts/scene.js';
import { isRenderedConnectorAnimation, type ResolvedCrossLink, type CrossLinkEdgeStyle, type RenderedConnectorAnimation } from '../contracts/crosslink.js';
import type { CardinalSide, NodeAnchorRegistry } from '../contracts/anchors.js';
import type { PortDirection, RouteStyle } from '../contracts/routing.js';
import type { Point, Rect } from '../contracts/primitives.js';
import type { ResolvedTheme } from '../contracts/theme.js';
import { getRouter } from '../routing/registry.js';
import { defaultRouter, createRouter } from '../routing/router.js';
import { crossLinkMarkerId } from './markers.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CrossLinkRenderResult {
  /** SVG defs needed (e.g. arrowhead markers for cross-links). */
  readonly defs: string[];
  /** Scene elements: paths, labels, grouped per link. */
  readonly elements: SceneElement[];
}

const CROSSLINK_ARROW_ID = 'triton-crosslink-arrow';
const CROSSLINK_ARROW_BOTH_ID = 'triton-crosslink-arrow-both';

/**
 * Render resolved cross-links into scene elements.
 *
 * @param resolved — links with resolved port positions in poster space
 * @param theme   — for styling (colours, fonts, stroke widths)
 * @param anchors — full anchor registry for obstacle avoidance
 * @param occupiedRects — bounding boxes of existing text/elements that labels must avoid
 * @param routingObstacles — additional thin obstacles (cell borders) for the router to avoid
 */
/**
 * Amount (px) by which intermediate-cell rectangles are shrunk on each side
 * before being used as routing obstacles. Must match the router’s padding
 * so that effective corridor width (gap + 2×SHRINK − 2×padding) leaves room.
 */
const CELL_SHRINK = 12;

export function renderCrossLinks(
  resolved: readonly ResolvedCrossLink[],
  theme: ResolvedTheme,
  anchors?: NodeAnchorRegistry,
  occupiedRects?: readonly Rect[],
  routingObstacles?: readonly Rect[],
  cellRects?: ReadonlyMap<string, Rect>,
): CrossLinkRenderResult {
  const { palette, typography, edges: edgeTheme } = theme;
  const elements: SceneElement[] = [];
  const defs: string[] = [];
  const arrowMarkerColors = new Map<string, string>();
  const biArrowMarkerColors = new Map<string, string>();

  // Extract obstacles from the anchor registry (all node bounds)
  // Note: cell borders are handled separately in post-route nudging, not as generic obstacles
  const obstacles: Rect[] = [];
  if (anchors) {
    for (const anchor of Object.values(anchors)) {
      obstacles.push(anchor.bounds);
    }
  }

  // Assign distinct colours to explicit links
  const categoricalPalette = [
    '#E11D48', '#16A34A', '#9333EA', '#0891B2',
    '#CA8A04', '#DC2626', '#2563EB', '#7C3AED',
  ];
  let explicitColorIdx = 0;

  // Collect labels for de-collision pass after all routes are computed
  const pendingLabels: Array<{
    content: string; x: number; y: number;
    fontSize: number; fontFamily: string; fill: string;
    anchor: 'middle'; fontWeight: 'bold';
  }> = [];

  // Phase 1: Compute all routes
  const pendingRoutes: PendingRoute[] = [];

  for (const rLink of resolved) {
    const { link, fromPort, toPort, fromSide, toSide } = rLink;

    let color: string;
    const explicitColor = typeof link.props?.color === 'string' ? link.props.color : undefined;
    if (explicitColor) {
      color = explicitColor;
    } else {
      color = categoricalPalette[explicitColorIdx % categoricalPalette.length]!;
      explicitColorIdx++;
    }

    const fromDir = sideToPortDir(fromSide);
    const toDir   = sideToPortDir(toSide);
    const routeStyle: RouteStyle = link.routing ?? 'orthogonal';
    const router  = getRouter(routeStyle) ?? createRouter(routeStyle);
    const tension = link.props?.tension as number | undefined;

    // Build per-link obstacles: all node bounds + shrunken intermediate-cell
    // rects. Intermediate cells (neither source nor target) are shrunk inward
    // by CELL_SHRINK so routes travel through inter-cell corridors instead of
    // cutting through other cells’ content areas. Source/target cells are
    // excluded so routes can freely exit/enter through their own cell’s space.
    let linkObstacles: Rect[] = obstacles;
    if (cellRects) {
      const srcId = link.from.cellPath.join('.');
      const dstId = link.to.cellPath.join('.');
      const extra: Rect[] = [];
      for (const [cellId, r] of cellRects) {
        if (cellId === srcId || cellId === dstId) continue;
        const sw = r.width  - 2 * CELL_SHRINK;
        const sh = r.height - 2 * CELL_SHRINK;
        if (sw > 0 && sh > 0) {
          extra.push({ x: r.x + CELL_SHRINK, y: r.y + CELL_SHRINK, width: sw, height: sh });
        }
      }
      if (extra.length > 0) linkObstacles = [...obstacles, ...extra];
    }

    const route   = router.route({
      from: fromPort,
      to: toPort,
      style: routeStyle,
      obstacles: linkObstacles,
      padding: 12,
      fromDir,
      toDir,
      ...(tension != null ? { tension } : {}),
    });

    const dash = edgeStyleToDash(link.style);
    // Animation: explicit DSL value only. All styles are STATIC by default.
    // Motion requires explicit @anim:<name> or { anim: <name> }.
    const animation: RenderedConnectorAnimation | undefined =
      link.animation === 'none'     ? undefined :
      isRenderedConnectorAnimation(link.animation) ? link.animation :
      undefined;
    let markerEnd: string | undefined;
    let markerStart: string | undefined;
    if (link.direction === 'directed') {
      markerEnd = crossLinkMarkerId(CROSSLINK_ARROW_ID, color);
      arrowMarkerColors.set(markerEnd, color);
    } else if (link.direction === 'bidirectional') {
      markerEnd = crossLinkMarkerId(CROSSLINK_ARROW_ID, color);
      markerStart = crossLinkMarkerId(CROSSLINK_ARROW_BOTH_ID, color);
      arrowMarkerColors.set(markerEnd, color);
      biArrowMarkerColors.set(markerStart, color);
    }

    const strokeWidth = link.style === 'thick'
      ? (edgeTheme.strokeWidth + 0.5) * 2
      : (edgeTheme.strokeWidth + 0.5);
    const isWavy = link.style === 'wavy';
    const wavyAmplitude  = (link.props?.amplitude  as number | undefined) ?? 3;
    const wavyWavelength = (link.props?.wavelength as number | undefined) ?? 12;

    pendingRoutes.push({
      points: route.points,
      routePath: routeStyle !== 'orthogonal' ? route.path : undefined,
      routing: routeStyle,
      fromDir,
      toDir,
      color,
      dash,
      strokeWidth,
      isWavy,
      wavyAmplitude,
      wavyWavelength,
      animation,
      markerEnd,
      markerStart,
      label: link.label,
    });
  }

  // Phase 2: Deflect straight routes that cross other routes
  deflectCrossingStraightRoutes(pendingRoutes, obstacles);

  // Phase 3: Nudge segments away from cell borders (orthogonal routes only)
  if (routingObstacles && routingObstacles.length > 0) {
    const orthoRoutes = pendingRoutes.filter(r => r.routing === 'orthogonal');
    nudgeOffBorders(orthoRoutes, routingObstacles);
  }

  // Phase 4a: Bezier separation — fan apart or fall back crossing beziers to orthogonal
  // Runs BEFORE channel separation so any new orthogonal routes get included.
  const CHANNEL_GAP = 12;
  separateBezierCurves(pendingRoutes.filter(r => r.routing === 'bezier'), CHANNEL_GAP, obstacles, pendingRoutes);

  // Phase 4b: Channel separation — offset overlapping parallel segments (all orthogonal, including fallbacks)
  separateOverlappingChannels(pendingRoutes.filter(r => r.routing === 'orthogonal'), CHANNEL_GAP);

  // ─── Label position staggering ───────────────────────────────────────────
  // Routes sharing the same corridor (same dominant-segment axis + close coord)
  // would all land their labels at the same midpoint.  Distribute positions
  // evenly along the route: 1/(n+1), 2/(n+1), …, n/(n+1).
  const CORRIDOR_TOL = 20; // px — routes within this band share a corridor
  const labelFractions = new Array<number>(pendingRoutes.length).fill(0.5);
  const labeledIndices = pendingRoutes.map((pr, i) => pr.label ? i : -1).filter(i => i >= 0);
  const staggerAssigned = new Set<number>();

  for (const i of labeledIndices) {
    if (staggerAssigned.has(i)) continue;
    const infoI = dominantSegmentInfo(pendingRoutes[i]!.points);
    const group = [i];
    for (const j of labeledIndices) {
      if (j === i || staggerAssigned.has(j)) continue;
      const infoJ = dominantSegmentInfo(pendingRoutes[j]!.points);
      if (infoI.axis === infoJ.axis && Math.abs(infoI.coord - infoJ.coord) < CORRIDOR_TOL) {
        group.push(j);
      }
    }
    if (group.length > 1) {
      group.sort((a, b) => a - b); // consistent ordering by route index
      const n = group.length;
      group.forEach((idx, k) => { labelFractions[idx] = (k + 1) / (n + 1); });
      group.forEach(idx => staggerAssigned.add(idx));
    }
  }

  // Phase 5: Emit path elements and collect labels
  for (let prIdx = 0; prIdx < pendingRoutes.length; prIdx++) {
    const pr = pendingRoutes[prIdx]!;
    // Bezier/straight routes use the router's SVG path; orthogonal rebuilds from points
    let path = pr.routePath ?? pr.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Wavy style: displace path geometry with a sine wave
    if (pr.isWavy) {
      path = wavifyPath([...pr.points], pr.wavyAmplitude, pr.wavyWavelength);
    }

    const pathEl: SceneElement = {
      type: 'path',
      d: path,
      stroke: pr.color,
      strokeWidth: pr.strokeWidth,
      ...(pr.dash      ? { strokeDasharray: pr.dash }     : {}),
      ...(pr.animation ? { animated: pr.animation }       : {}),
      ...(pr.markerEnd   ? { markerEnd: pr.markerEnd }   : {}),
      ...(pr.markerStart ? { markerStart: pr.markerStart } : {}),
    };
    elements.push(pathEl);

    if (pr.label) {
      const labelPos = pointAtFraction(pr.points, labelFractions[prIdx] ?? 0.5);
      pendingLabels.push({
        content: pr.label,
        x: labelPos.x,
        y: labelPos.y - 6,
        fontSize: edgeTheme.labelFontSize,
        fontFamily: typography.fontFamily,
        fill: pr.color,
        anchor: 'middle' as const,
        fontWeight: 'bold' as const,
      });
    }
  }

  // ─── Label de-collision pass ──────────────────────────────────────────────
  // Estimate label bounding boxes, resolve overlaps against fixed rects + siblings
  const CHAR_WIDTH_FACTOR = 0.65; // approximate character width / font size
  const LABEL_PAD = 4;

  // Fixed obstacles: node bounds + caller-provided occupied rects (cell titles, poster title)
  const fixedRects: Rect[] = [...obstacles, ...(occupiedRects ?? [])];

  // Estimate bounding rect for each label (centered at anchor='middle')
  const labelRects: Rect[] = pendingLabels.map(l => {
    const w = l.content.length * l.fontSize * CHAR_WIDTH_FACTOR + LABEL_PAD * 2;
    const h = l.fontSize + LABEL_PAD * 2;
    return { x: l.x - w / 2, y: l.y - h + LABEL_PAD, width: w, height: h };
  });

  // Iteratively push overlapping labels vertically
  deCollideLabels(labelRects, fixedRects);

  // Emit labels at de-collided positions
  for (let i = 0; i < pendingLabels.length; i++) {
    const l = pendingLabels[i]!;
    const r = labelRects[i]!;
    // Recover center position from adjusted rect
    const finalX = r.x + r.width / 2;
    const finalY = r.y + r.height - LABEL_PAD;
    elements.push({
      type: 'text',
      content: l.content,
      position: { x: finalX, y: finalY },
      fontSize: l.fontSize,
      fontFamily: l.fontFamily,
      fill: l.fill,
      anchor: l.anchor,
      fontWeight: l.fontWeight,
    });
  }

  // Build defs
  const s = edgeTheme.arrowSize;
  for (const [id, color] of arrowMarkerColors) {
    defs.push(
      `<marker id="${id}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="${s - 1}" refY="${s * 0.35}" orient="auto"><polygon points="0 0, ${s} ${s * 0.35}, 0 ${s * 0.7}" fill="${color}" /></marker>`,
    );
  }
  for (const [id, color] of biArrowMarkerColors) {
    defs.push(
      `<marker id="${id}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="1" refY="${s * 0.35}" orient="auto"><polygon points="${s} 0, 0 ${s * 0.35}, ${s} ${s * 0.7}" fill="${color}" /></marker>`,
    );
  }

  return { defs, elements };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sideToPortDir(side: CardinalSide): PortDirection {
  return side; // CardinalSide and PortDirection use same values
}

function edgeStyleToDash(style: CrossLinkEdgeStyle): string | undefined {
  switch (style) {
    case 'dotted': return '4 3';
    case 'dashed': return '8 4';
    case 'solid':  return undefined;
    case 'thick':  return undefined;  // thick uses stroke-width bump, not dasharray
    case 'wavy':   return undefined;  // wavy uses path displacement, not dasharray
  }
}

/** Find the midpoint of the longest segment in a polyline. */
function longestSegmentMidpoint(points: readonly Point[]): Point {
  let bestLen = 0;
  let bestMid: Point = points[0]!;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); // Manhattan length for ortho
    if (len > bestLen) {
      bestLen = len;
      bestMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return bestMid;
}

/**
 * Returns the axis ('h'|'v') and fixed coordinate of the longest segment
 * in a polyline — used to group routes sharing the same corridor.
 */
function dominantSegmentInfo(points: readonly Point[]): { axis: 'h' | 'v'; coord: number } {
  let bestLen = 0, axis: 'h' | 'v' = 'h', coord = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    const len = dx + dy;
    if (len > bestLen) {
      bestLen = len;
      if (dy > dx) { axis = 'v'; coord = (a.x + b.x) / 2; }
      else          { axis = 'h'; coord = (a.y + b.y) / 2; }
    }
  }
  return { axis, coord };
}

/**
 * Returns the point at fraction t (0..1) of total Euclidean path length.
 */
function pointAtFraction(points: readonly Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return points[0]!;
  const target = total * Math.min(Math.max(t, 0), 1);
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (acc + l >= target) {
      const frac = l > 0 ? (target - acc) / l : 0;
      const a = points[i]!, b = points[i + 1]!;
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
    acc += l;
  }
  return points[points.length - 1]!;
}

/**
 * De-collide label rectangles by pushing them away from fixed obstacles and
 * from each other in the direction of minimum overlap (MTV approach).
 * Horizontal push is used when horizontal overlap is smaller than vertical —
 * this avoids vertical stacking when labels share the same route corridor.
 * Mutates labelRects in place.
 */
function deCollideLabels(labelRects: Array<{ x: number; y: number; width: number; height: number }>, fixedRects: readonly Rect[]): void {
  const MAX_PASSES = 20;
  const NUDGE = 2;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;

    // Push labels away from fixed rects
    for (const lr of labelRects) {
      for (const fr of fixedRects) {
        if (!rectsOverlap(lr, fr)) continue;
        const ox = Math.min(lr.x + lr.width, fr.x + fr.width) - Math.max(lr.x, fr.x);
        const oy = Math.min(lr.y + lr.height, fr.y + fr.height) - Math.max(lr.y, fr.y);
        if (ox <= oy) {
          // Horizontal push — less movement
          const lCX = lr.x + lr.width / 2;
          const fCX = fr.x + fr.width / 2;
          lr.x = lCX <= fCX ? fr.x - lr.width - NUDGE : fr.x + fr.width + NUDGE;
        } else {
          // Vertical push
          const lCY = lr.y + lr.height / 2;
          const fCY = fr.y + fr.height / 2;
          lr.y = lCY <= fCY ? fr.y - lr.height - NUDGE : fr.y + fr.height + NUDGE;
        }
        moved = true;
      }
    }

    // Push labels away from each other
    for (let i = 0; i < labelRects.length; i++) {
      for (let j = i + 1; j < labelRects.length; j++) {
        const a = labelRects[i]!, b = labelRects[j]!;
        if (!rectsOverlap(a, b)) continue;
        const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ox <= oy) {
          // Push horizontally — shared-corridor case
          const aCX = a.x + a.width / 2;
          const bCX = b.x + b.width / 2;
          if (aCX <= bCX) { a.x -= ox / 2; b.x += ox / 2; }
          else             { a.x += ox / 2; b.x -= ox / 2; }
        } else {
          // Push vertically
          const aCY = a.y + a.height / 2;
          const bCY = b.y + b.height / 2;
          if (aCY <= bCY) {
            const overlap = (a.y + a.height) - b.y;
            a.y -= (overlap + NUDGE) / 2;
            b.y += (overlap + NUDGE) / 2;
          } else {
            const overlap = (b.y + b.height) - a.y;
            b.y -= (overlap + NUDGE) / 2;
            a.y += (overlap + NUDGE) / 2;
          }
        }
        moved = true;
      }
    }

    if (!moved) break;
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

// ─── Straight Route Crossing Deflection ──────────────────────────────────────

/**
 * Post-route pass: detect straight routes whose segments cross other routes,
 * and deflect them by inserting a perpendicular waypoint.
 *
 * This handles the case where a straight line doesn't hit any node bounding box
 * but still visually crosses other connector paths.
 */
function deflectCrossingStraightRoutes(routes: PendingRoute[], obstacles: readonly Rect[]): void {
  const straightRoutes = routes.filter(r => r.routing === 'straight');
  if (straightRoutes.length === 0) return;

  // Collect all segments from OTHER routes for crossing checks.
  // For bezier routes, sample the curve into a polyline (control points aren't line segments).
  const BEZIER_SAMPLES = 16;
  const otherSegments: Array<[Point, Point]> = [];
  for (const r of routes) {
    if (r.routing === 'bezier') {
      const pts = r.points;
      if (pts.length >= 4) {
        const samples = sampleBezierToPolyline(pts[0]!, pts[1]!, pts[2]!, pts[3]!, BEZIER_SAMPLES);
        for (let i = 0; i < samples.length - 1; i++) {
          otherSegments.push([samples[i]!, samples[i + 1]!]);
        }
      }
    } else {
      const pts = r.points;
      for (let i = 0; i < pts.length - 1; i++) {
        otherSegments.push([pts[i]!, pts[i + 1]!]);
      }
    }
  }

  for (const sr of straightRoutes) {
    const pts = sr.points as Point[];
    if (pts.length !== 2) continue;

    const from = pts[0]!, to = pts[1]!;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 30) continue;

    // Check if this straight line crosses any other route segment
    const segsExcludingSelf = otherSegments.filter(
      ([a, b]) => !(a === from && b === to),
    );
    const originalCrossings = segsExcludingSelf.filter(
      ([a, b]) => straightSegmentsIntersect(from, to, a, b),
    ).length;
    if (originalCrossings === 0) continue;

    // Try perpendicular waypoints at increasing offsets
    const perpX = -dy / len, perpY = dx / len;
    const mid: Point = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

    let bestWp: Point | null = null;
    let bestCrossings = Infinity;

    for (let offset = len * 0.08; offset <= len * 0.5; offset += len * 0.06) {
      for (const sign of [1, -1]) {
        const wp: Point = { x: mid.x + perpX * offset * sign, y: mid.y + perpY * offset * sign };

        let hitsNode = false;
        for (const obs of obstacles) {
          if (segIntersectsRectInterior(from, wp, obs) || segIntersectsRectInterior(wp, to, obs)) {
            hitsNode = true;
            break;
          }
        }
        if (hitsNode) continue;

        let crossings = 0;
        for (const [a, b] of segsExcludingSelf) {
          if (straightSegmentsIntersect(from, wp, a, b)) crossings++;
          if (straightSegmentsIntersect(wp, to, a, b)) crossings++;
        }
        if (crossings < bestCrossings) {
          bestCrossings = crossings;
          bestWp = wp;
          if (crossings === 0) break;
        }
      }
      if (bestCrossings === 0) break;
    }

    if (bestWp && bestCrossings < originalCrossings) {
      (sr.points as Point[]).splice(1, 0, bestWp);
      sr.routePath = sr.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    } else {
      // Deflection failed — fall back to orthogonal routing for this link.
      // This prevents ugly diagonal lines that cross everything.
      const orthoRouter = createRouter('orthogonal');
      const route = orthoRouter.route({
        from, to,
        style: 'orthogonal',
        obstacles,
        padding: 12,
        ...(sr.fromDir ? { fromDir: sr.fromDir } : {}),
        ...(sr.toDir ? { toDir: sr.toDir } : {}),
      });
      (sr as any).points = [...route.points];
      sr.routePath = undefined; // let Phase 5 rebuild from points
      sr.routing = 'orthogonal' as RouteStyle; // so post-route passes treat it correctly
    }
  }
}

/** Sample a cubic bezier [from, cp1, cp2, to] into a polyline of n+1 points. */
function sampleBezierToPolyline(p0: Point, p1: Point, p2: Point, p3: Point, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
      y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
    });
  }
  return pts;
}

/** Check if two segments properly cross (not just touch). */
function straightSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = crossProduct(p3, p4, p1);
  const d2 = crossProduct(p3, p4, p2);
  const d3 = crossProduct(p1, p2, p3);
  const d4 = crossProduct(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function crossProduct(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Check if a line segment crosses the interior of a rectangle (Liang-Barsky). */
function segIntersectsRectInterior(p1: Point, p2: Point, r: Rect): boolean {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  let tmin = 0, tmax = 1;
  const edges = [
    { p: -dx, q: p1.x - r.x },
    { p: dx, q: r.x + r.width - p1.x },
    { p: -dy, q: p1.y - r.y },
    { p: dy, q: r.y + r.height - p1.y },
  ];
  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-10) { if (q <= 0) return false; }
    else {
      const t = q / p;
      if (p < 0) tmin = Math.max(tmin, t);
      else tmax = Math.min(tmax, t);
      if (tmin >= tmax) return false;
    }
  }
  return tmin < tmax;
}

// ─── Bezier Separation ───────────────────────────────────────────────────────

/**
 * Fan apart bezier curves that share endpoints or cross each other.
 *
 * The BezierRouter stores points as [from, cp1, cp2, to].
 *
 * Phase A: Shared-endpoint fan-out — when multiple curves converge on
 *   the same endpoint, offset each curve's nearby control point perpendicular
 *   to the from→to axis so they fan apart.
 *
 * Phase B: Crossing resolution — for every pair of bezier curves, sample both
 *   and detect segment crossings. If they cross, offset both curves' control
 *   points to opposite sides of their respective from→to axes.
 */
function separateBezierCurves(routes: PendingRoute[], gap: number, obstacles: readonly Rect[], allRoutes: PendingRoute[]): void {
  if (routes.length < 2) return;

  const PROXIMITY = 20;

  // ── Phase A: shared-endpoint fan-out ─────────────────────────────────────

  type EndGroup = { routes: PendingRoute[]; end: 'from' | 'to' };
  const groups: EndGroup[] = [];

  const fromGroups = clusterByEndpoint(routes, 'from', PROXIMITY);
  for (const cluster of fromGroups) {
    if (cluster.length > 1) groups.push({ routes: cluster, end: 'from' });
  }

  const toGroups = clusterByEndpoint(routes, 'to', PROXIMITY);
  for (const cluster of toGroups) {
    if (cluster.length > 1) groups.push({ routes: cluster, end: 'to' });
  }

  for (const group of groups) {
    const n = group.routes.length;
    for (let i = 0; i < n; i++) {
      const pr = group.routes[i]!;
      const pts = pr.points as Point[];
      if (pts.length < 4) continue;

      const from = pts[0]!, to = pts[pts.length - 1]!;
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      const perpX = -dy / len, perpY = dx / len;
      const offset = (i - (n - 1) / 2) * gap;

      if (group.end === 'from') {
        pts[1] = { x: pts[1]!.x + perpX * offset, y: pts[1]!.y + perpY * offset };
      } else {
        pts[pts.length - 2] = {
          x: pts[pts.length - 2]!.x + perpX * offset,
          y: pts[pts.length - 2]!.y + perpY * offset,
        };
      }

      rebuildBezierPath(pr);
    }
  }

  // ── Phase B: crossing resolution ─────────────────────────────────────────
  // When two beziers cross, try offsetting one curve perpendicular to
  // separate them. If no offset resolves the crossing (e.g. endpoints form
  // an X pattern), fall back one curve to orthogonal routing.

  const SAMPLES = 40;

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const ri = routes[i]!, rj = routes[j]!;
      const ptsI = ri.points as Point[];
      const ptsJ = rj.points as Point[];
      if (ptsI.length < 4 || ptsJ.length < 4) continue;

      const sampI = sampleBezierCurve(ptsI[0]!, ptsI[1]!, ptsI[2]!, ptsI[3]!, SAMPLES);
      const sampJ = sampleBezierCurve(ptsJ[0]!, ptsJ[1]!, ptsJ[2]!, ptsJ[3]!, SAMPLES);
      if (!polylinesIntersect(sampI, sampJ)) continue;

      // Compute perpendicular for each curve
      const perpOf = (pts: Point[]) => {
        const dx = pts[3]!.x - pts[0]!.x, dy = pts[3]!.y - pts[0]!.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        return len < 1 ? null : { px: -dy / len, py: dx / len, len };
      };
      const pI = perpOf(ptsI), pJ = perpOf(ptsJ);
      if (!pI || !pJ) continue;

      const origI1 = { ...ptsI[1]! }, origI2 = { ...ptsI[2]! };
      const origJ1 = { ...ptsJ[1]! }, origJ2 = { ...ptsJ[2]! };

      // Try offsetting one curve at a time, in both directions
      type Solution = { moveRoute: 'I' | 'J'; off: number; px: number; py: number };
      let best: Solution | null = null;
      const stepSize = Math.max(gap * 3, 15);

      for (const moveRoute of ['I', 'J'] as const) {
        const p = moveRoute === 'I' ? pI : pJ;
        const pts = moveRoute === 'I' ? ptsI : ptsJ;
        const orig1 = moveRoute === 'I' ? origI1 : origJ1;
        const orig2 = moveRoute === 'I' ? origI2 : origJ2;
        const otherPts = moveRoute === 'I' ? ptsJ : ptsI;

        for (const sign of [1, -1]) {
          for (let step = 1; step <= 8; step++) {
            const off = sign * step * stepSize;
            pts[1] = { x: orig1.x + p.px * off, y: orig1.y + p.py * off };
            pts[2] = { x: orig2.x + p.px * off, y: orig2.y + p.py * off };

            const sA = sampleBezierCurve(pts[0]!, pts[1]!, pts[2]!, pts[3]!, SAMPLES);
            const sB = sampleBezierCurve(otherPts[0]!, otherPts[1]!, otherPts[2]!, otherPts[3]!, SAMPLES);

            if (!polylinesIntersect(sA, sB)) {
              if (!best || Math.abs(off) < Math.abs(best.off)) {
                best = { moveRoute, off, px: p.px, py: p.py };
              }
              break;
            }
          }
          // Reset
          pts[1] = { ...orig1 }; pts[2] = { ...orig2 };
        }
      }

      if (best) {
        // Apply smallest offset that resolves
        const pts = best.moveRoute === 'I' ? ptsI : ptsJ;
        const orig1 = best.moveRoute === 'I' ? origI1 : origJ1;
        const orig2 = best.moveRoute === 'I' ? origI2 : origJ2;
        pts[1] = { x: orig1.x + best.px * best.off, y: orig1.y + best.py * best.off };
        pts[2] = { x: orig2.x + best.px * best.off, y: orig2.y + best.py * best.off };
        rebuildBezierPath(ri);
        rebuildBezierPath(rj);
      } else {
        // No offset resolves — endpoints form an X pattern (interleaved on
        // parallel lines). Swap the ports on the shared node so both routes
        // stay on the same side, then re-route as orthogonal.
        swapInterleavedPortsAndReroute(ri, rj, obstacles);
      }
    }
  }
}

/**
 * Detect interleaved endpoints and swap ports on the shared line to
 * un-interleave them. Then re-route both as orthogonal.
 *
 * Before: A.from(399,388) A.to(471,597)  B.from(367,597) B.to(439,388)
 *   y=388: A=399(left) B=439(right)  y=597: B=367(left) A=471(right) → interleaved
 * After swap on y=388: A.from↔B.to → A(439,388) B(399,388)
 *   y=388: B=399(left) A=439(right)  y=597: B=367(left) A=471(right) → consistent
 */
function swapInterleavedPortsAndReroute(
  ri: PendingRoute, rj: PendingRoute, obstacles: readonly Rect[],
): void {
  const fromI = ri.points[0]!, toI = ri.points[ri.points.length - 1]!;
  const fromJ = rj.points[0]!, toJ = rj.points[rj.points.length - 1]!;

  const TOLERANCE = 15;

  // Check all pairings of endpoints that share a horizontal or vertical line
  // and swap to un-interleave.
  const pairs: Array<{
    endI: 'from' | 'to'; ptI: Point;
    endJ: 'from' | 'to'; ptJ: Point;
    axis: 'x' | 'y';
  }> = [];

  // fromI near toJ? (same horizontal/vertical line)
  if (Math.abs(fromI.y - toJ.y) < TOLERANCE) pairs.push({ endI: 'from', ptI: fromI, endJ: 'to', ptJ: toJ, axis: 'x' });
  if (Math.abs(fromI.x - toJ.x) < TOLERANCE) pairs.push({ endI: 'from', ptI: fromI, endJ: 'to', ptJ: toJ, axis: 'y' });
  // toI near fromJ?
  if (Math.abs(toI.y - fromJ.y) < TOLERANCE) pairs.push({ endI: 'to', ptI: toI, endJ: 'from', ptJ: fromJ, axis: 'x' });
  if (Math.abs(toI.x - fromJ.x) < TOLERANCE) pairs.push({ endI: 'to', ptI: toI, endJ: 'from', ptJ: fromJ, axis: 'y' });

  // For each pair on a shared line, check if swapping un-interleaves
  for (const pair of pairs) {
    // Get the OTHER endpoints (the ones NOT on this shared line)
    const otherI = pair.endI === 'from' ? toI : fromI;
    const otherJ = pair.endJ === 'from' ? toJ : fromJ;

    // Check interleaving on the shared axis
    const coord = pair.axis; // 'x' means compare x-values on a shared y-line
    const iOnShared = pair.ptI[coord];
    const jOnShared = pair.ptJ[coord];
    const iOther = otherI[coord];
    const jOther = otherJ[coord];

    // Interleaved = one is left/above on shared line but right/below on the other
    const iLeftOnShared = iOnShared < jOnShared;
    const iLeftOnOther = iOther < jOther;
    if (iLeftOnShared === iLeftOnOther) continue; // Not interleaved, skip

    // SWAP: exchange the positions on the shared line
    const newPtI = { ...pair.ptJ }; // I takes J's position
    const newPtJ = { ...pair.ptI }; // J takes I's position
    // Keep the shared-line coordinate averaged (same y for horizontal line)
    if (pair.axis === 'x') {
      const avgY = (pair.ptI.y + pair.ptJ.y) / 2;
      newPtI.y = avgY;
      newPtJ.y = avgY;
    } else {
      const avgX = (pair.ptI.x + pair.ptJ.x) / 2;
      newPtI.x = avgX;
      newPtJ.x = avgX;
    }

    // Build new from/to for each route
    const newFromI = pair.endI === 'from' ? newPtI : fromI;
    const newToI = pair.endI === 'to' ? newPtI : toI;
    const newFromJ = pair.endJ === 'from' ? newPtJ : fromJ;
    const newToJ = pair.endJ === 'to' ? newPtJ : toJ;

    // Re-route both as orthogonal and check crossing
    const orthoRouter = createRouter('orthogonal');
    const routeI = orthoRouter.route({ from: newFromI, to: newToI, style: 'orthogonal', obstacles, padding: 12 });
    const routeJ = orthoRouter.route({ from: newFromJ, to: newToJ, style: 'orthogonal', obstacles, padding: 12 });

    const polyI = routeI.points as Point[];
    const polyJ = routeJ.points as Point[];
    let crosses = false;
    for (let a = 0; a < polyI.length - 1 && !crosses; a++)
      for (let b = 0; b < polyJ.length - 1 && !crosses; b++)
        if (straightSegmentsIntersect(polyI[a]!, polyI[a + 1]!, polyJ[b]!, polyJ[b + 1]!))
          crosses = true;

    if (!crosses) {
      // Apply
      (ri as any).points = [...routeI.points];
      ri.routePath = undefined;
      ri.routing = 'orthogonal' as RouteStyle;

      (rj as any).points = [...routeJ.points];
      rj.routePath = undefined;
      rj.routing = 'orthogonal' as RouteStyle;
      return;
    }
  }

  // Fallback: just convert both to orthogonal with natural ports
  convertToOrthogonal(ri, obstacles);
  convertToOrthogonal(rj, obstacles);
}

/** Convert a PendingRoute to orthogonal routing. */
function convertToOrthogonal(target: PendingRoute, obstacles: readonly Rect[]): void {
  const from = target.points[0]!, to = target.points[target.points.length - 1]!;
  const orthoRouter = createRouter('orthogonal');
  const route = orthoRouter.route({
    from, to,
    style: 'orthogonal',
    obstacles,
    padding: 12,
  });
  (target as any).points = [...route.points];
  target.routePath = undefined;
  target.routing = 'orthogonal' as RouteStyle;
}

/** Rebuild the routePath string from [from, cp1, cp2, to] points. */
function rebuildBezierPath(pr: PendingRoute): void {
  const pts = pr.points;
  pr.routePath = `M ${pts[0]!.x} ${pts[0]!.y} C ${pts[1]!.x} ${pts[1]!.y} ${pts[2]!.x} ${pts[2]!.y} ${pts[3]!.x} ${pts[3]!.y}`;
}

/** Offset both control points of a bezier curve perpendicular to its from→to axis. */
function offsetBezierPerp(pts: Point[], offset: number): void {
  const from = pts[0]!, to = pts[3]!;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const perpX = -dy / len, perpY = dx / len;
  pts[1] = { x: pts[1]!.x + perpX * offset, y: pts[1]!.y + perpY * offset };
  pts[2] = { x: pts[2]!.x + perpX * offset, y: pts[2]!.y + perpY * offset };
}

/** Sample a cubic bezier into a polyline of N+1 points. */
function sampleBezierCurve(p0: Point, p1: Point, p2: Point, p3: Point, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
      y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
    });
  }
  return pts;
}

/** Check if two polylines have any crossing segments. */
function polylinesIntersect(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (segmentsIntersect(a[i]!, a[i+1]!, b[j]!, b[j+1]!)) return true;
    }
  }
  return false;
}

/** Check if two line segments p1-p2 and p3-p4 intersect (proper crossing only). */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Cluster bezier routes by proximity of their from or to endpoint. */
function clusterByEndpoint(
  routes: PendingRoute[],
  end: 'from' | 'to',
  proximity: number,
): PendingRoute[][] {
  const clusters: PendingRoute[][] = [];
  const assigned = new Set<PendingRoute>();

  for (let i = 0; i < routes.length; i++) {
    const ri = routes[i]!;
    if (assigned.has(ri)) continue;

    const pi = end === 'from' ? ri.points[0]! : ri.points[ri.points.length - 1]!;
    const cluster: PendingRoute[] = [ri];
    assigned.add(ri);

    for (let j = i + 1; j < routes.length; j++) {
      const rj = routes[j]!;
      if (assigned.has(rj)) continue;

      const pj = end === 'from' ? rj.points[0]! : rj.points[rj.points.length - 1]!;
      const dx = pi.x - pj.x, dy = pi.y - pj.y;
      if (Math.sqrt(dx * dx + dy * dy) < proximity) {
        cluster.push(rj);
        assigned.add(rj);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

// ─── Border Nudging ──────────────────────────────────────────────────────────

/**
 * Nudge segments that run parallel along cell borders (walls) away from them.
 * A horizontal segment at y ≈ border.y is shifted vertically.
 * A vertical segment at x ≈ border.x is shifted horizontally.
 * Only affects "running along" — perpendicular crossings are fine.
 */
function nudgeOffBorders(routes: PendingRoute[], borders: readonly Rect[]): void {
  const TOLERANCE = 3; // within 3px of a border edge
  const NUDGE = 8;     // push 8px away

  // Extract unique horizontal border Y values and vertical border X values
  const hBorderYs: number[] = []; // horizontal borders (wide, thin height)
  const vBorderXs: number[] = []; // vertical borders (tall, thin width)

  for (const b of borders) {
    if (b.width > b.height) {
      // Horizontal border — center Y
      hBorderYs.push(b.y + b.height / 2);
    } else {
      // Vertical border — center X
      vBorderXs.push(b.x + b.width / 2);
    }
  }

  for (const route of routes) {
    const pts = route.points as Point[];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);

      if (dy < 1 && dx > 1) {
        // Horizontal segment — check against horizontal borders
        for (const borderY of hBorderYs) {
          if (Math.abs(a.y - borderY) < TOLERANCE) {
            // Nudge toward the midpoint between from/to Y of the full route
            const routeMinY = Math.min(...pts.map(p => p.y));
            const routeMaxY = Math.max(...pts.map(p => p.y));
            const routeMidY = (routeMinY + routeMaxY) / 2;
            const nudgeDir = a.y < routeMidY ? -NUDGE : NUDGE;
            pts[i] = { x: a.x, y: a.y + nudgeDir };
            pts[i + 1] = { x: b.x, y: b.y + nudgeDir };
            // Also adjust adjacent vertical segment endpoints
            if (i > 0 && Math.abs(pts[i - 1]!.x - a.x) < 1) {
              pts[i - 1] = { ...pts[i - 1]!, y: pts[i - 1]!.y }; // keep as-is, the vertex moved
            }
            break;
          }
        }
      } else if (dx < 1 && dy > 1) {
        // Vertical segment — check against vertical borders
        for (const borderX of vBorderXs) {
          if (Math.abs(a.x - borderX) < TOLERANCE) {
            const routeMinX = Math.min(...pts.map(p => p.x));
            const routeMaxX = Math.max(...pts.map(p => p.x));
            const routeMidX = (routeMinX + routeMaxX) / 2;
            const nudgeDir = a.x < routeMidX ? -NUDGE : NUDGE;
            pts[i] = { x: a.x + nudgeDir, y: a.y };
            pts[i + 1] = { x: b.x + nudgeDir, y: b.y };
            break;
          }
        }
      }
    }
  }
}

// ─── Channel Separation ──────────────────────────────────────────────────────

interface PendingRoute {
  points: readonly Point[];
  routePath: string | undefined;
  routing: RouteStyle;
  fromDir: PortDirection | undefined;
  toDir: PortDirection | undefined;
  color: string;
  dash: string | undefined;
  strokeWidth: number;
  isWavy: boolean;
  wavyAmplitude: number;
  wavyWavelength: number;
  animation: RenderedConnectorAnimation | undefined;
  markerEnd: string | undefined;
  markerStart: string | undefined;
  label: string | undefined;
}

/**
 * Detect overlapping parallel segments across all routes and offset them
 * so they don't visually merge. Mutates route points in place.
 */
function separateOverlappingChannels(routes: PendingRoute[], gap: number): void {
  // Collect all segments tagged by route index and segment index
  interface Segment { routeIdx: number; segIdx: number; isVertical: boolean; coord: number; min: number; max: number; }
  const segments: Segment[] = [];

  for (let r = 0; r < routes.length; r++) {
    const pts = routes[r]!.points;
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s]!, b = pts[s + 1]!;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      if (dx < 1 && dy > 1) {
        // Vertical segment
        segments.push({ routeIdx: r, segIdx: s, isVertical: true, coord: a.x, min: Math.min(a.y, b.y), max: Math.max(a.y, b.y) });
      } else if (dy < 1 && dx > 1) {
        // Horizontal segment
        segments.push({ routeIdx: r, segIdx: s, isVertical: false, coord: a.y, min: Math.min(a.x, b.x), max: Math.max(a.x, b.x) });
      }
    }
  }

  // Group segments that share the same axis, similar coord, and overlapping range
  const COORD_TOLERANCE = 10;
  const processed = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    if (processed.has(i)) continue;
    const group = [i];
    const si = segments[i]!;

    for (let j = i + 1; j < segments.length; j++) {
      if (processed.has(j)) continue;
      const sj = segments[j]!;
      if (si.isVertical !== sj.isVertical) continue;
      if (Math.abs(si.coord - sj.coord) > COORD_TOLERANCE) continue;
      // Check range overlap
      if (si.max <= sj.min || sj.max <= si.min) continue;
      group.push(j);
    }

    if (group.length < 2) continue;

    // Offset each segment in the group
    const n = group.length;
    for (let k = 0; k < n; k++) {
      const offset = (k - (n - 1) / 2) * gap;
      const seg = segments[group[k]!]!;
      processed.add(group[k]!);

      // Mutate the points in the route
      const pts = routes[seg.routeIdx]!.points as Point[];
      if (seg.isVertical) {
        // Offset x coordinate of both endpoints of this segment
        pts[seg.segIdx] = { x: pts[seg.segIdx]!.x + offset, y: pts[seg.segIdx]!.y };
        pts[seg.segIdx + 1] = { x: pts[seg.segIdx + 1]!.x + offset, y: pts[seg.segIdx + 1]!.y };
      } else {
        // Offset y coordinate
        pts[seg.segIdx] = { x: pts[seg.segIdx]!.x, y: pts[seg.segIdx]!.y + offset };
        pts[seg.segIdx + 1] = { x: pts[seg.segIdx + 1]!.x, y: pts[seg.segIdx + 1]!.y + offset };
      }
    }
  }
}

// ─── Wavy Path Generation ────────────────────────────────────────────────────

/**
 * Replace a polyline route with a sine-wave displaced version.
 *
 * Algorithm (fully deterministic):
 * 1. Compute cumulative arc-length at each original vertex.
 * 2. Re-sample the polyline at uniform intervals of λ/4.
 * 3. At each sample, compute the local tangent and its perpendicular normal.
 * 4. Displace the sample along the normal by A·sin(2π·s/λ) where s is the
 *    cumulative arc-length.  The first/last two samples are forced onto the
 *    route axis, while endpoints and 90° corners ramp amplitude over one
 *    wavelength so arrowhead tips and kinks stay clean.
 * 5. Fit smooth cubic Béziers through displaced samples (Catmull-Rom-to-Bézier).
 *
 * Returns an SVG path `d` string.  Same input → same output (no randomness).
 */
export function wavifyPath(
  points: readonly Point[],
  amplitude: number,
  wavelength: number,
): string {
  if (points.length < 2) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  const sampleInterval = wavelength / 4;

  // ── Step 1: cumulative arc-lengths at original vertices ───────────────────
  const arcLen: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    arcLen.push(arcLen[i - 1]! + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLen = arcLen[arcLen.length - 1]!;
  if (totalLen < 1) {
    return `M ${points[0]!.x} ${points[0]!.y}`;
  }

  // ── Step 2: re-sample at uniform intervals ────────────────────────────────
  // Include start and end explicitly.
  const sampleCount = Math.max(2, Math.ceil(totalLen / sampleInterval) + 1);
  const samples: Point[] = [];
  const sampleArcLens: number[] = [];

  // Find polyline point at given arc-length parameter
  function polylineAt(s: number): { pt: Point; tangentX: number; tangentY: number } {
    s = Math.max(0, Math.min(s, totalLen));
    for (let i = 1; i < points.length; i++) {
      if (arcLen[i]! >= s - 1e-9) {
        const segStart = arcLen[i - 1]!;
        const segEnd   = arcLen[i]!;
        const segLen   = segEnd - segStart;
        const t = segLen < 1e-9 ? 0 : (s - segStart) / segLen;
        const a = points[i - 1]!, b = points[i]!;
        const pt = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const tx = len > 1e-9 ? dx / len : 1;
        const ty = len > 1e-9 ? dy / len : 0;
        return { pt, tangentX: tx, tangentY: ty };
      }
    }
    const last = points[points.length - 1]!, prev = points[points.length - 2]!;
    const dx = last.x - prev.x, dy = last.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { pt: last, tangentX: len > 1e-9 ? dx / len : 1, tangentY: len > 1e-9 ? dy / len : 0 };
  }

  // Build corner-proximity map: ramp amplitude to 0 at each 90° bend
  // A "corner" is any vertex where the turning angle > 45°.
  const cornerArcLens: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
    const d1x = b.x - a.x, d1y = b.y - a.y;
    const d2x = c.x - b.x, d2y = c.y - b.y;
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
    if (len1 < 1e-9 || len2 < 1e-9) continue;
    const dot = (d1x / len1) * (d2x / len2) + (d1y / len1) * (d2y / len2);
    if (dot < 0.7) { // angle > ~45°
      cornerArcLens.push(arcLen[i]!);
    }
  }

  function cornerAmplitudeFactor(s: number): number {
    let minDist = Infinity;
    for (const cs of cornerArcLens) {
      minDist = Math.min(minDist, Math.abs(s - cs));
    }
    if (minDist >= wavelength) return 1;
    return minDist / wavelength; // ramp 0..1 over one wavelength from corner
  }

  function endpointAmplitudeFactor(s: number): number {
    const endpointDist = Math.min(s, totalLen - s);
    // Keep the first/last interior samples flat so Catmull-Rom endpoint handles
    // align with the route direction used by SVG marker orientation.
    return Math.max(0, Math.min(1, (endpointDist - sampleInterval) / (wavelength - sampleInterval)));
  }

  for (let k = 0; k < sampleCount; k++) {
    const s = (k / (sampleCount - 1)) * totalLen;
    const { pt, tangentX, tangentY } = polylineAt(s);
    // Normal: perpendicular to tangent (rotate 90°)
    const nx = -tangentY;
    const ny = tangentX;
    const phase = (2 * Math.PI * s) / wavelength;
    const cornerFactor = cornerAmplitudeFactor(s);
    const factor = Math.min(cornerFactor, endpointAmplitudeFactor(s));
    const endpointStub = k <= 1 || k >= sampleCount - 2;
    const displacement = endpointStub ? 0 : amplitude * factor * Math.sin(phase);
    samples.push({ x: pt.x + nx * displacement, y: pt.y + ny * displacement });
    sampleArcLens.push(s);
  }

  // ── Step 5: Catmull-Rom to cubic Bézier ──────────────────────────────────
  // For each interior sample i, compute Catmull-Rom tangents and emit a
  // cubic Bézier from samples[i-1] to samples[i].
  const tension = 0.5; // standard Catmull-Rom tension
  let d = `M ${f(samples[0]!.x)} ${f(samples[0]!.y)}`;

  for (let i = 1; i < samples.length; i++) {
    const p0 = samples[Math.max(0, i - 2)]!;
    const p1 = samples[i - 1]!;
    const p2 = samples[i]!;
    const p3 = samples[Math.min(samples.length - 1, i + 1)]!;

    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

    d += ` C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(p2.x)} ${f(p2.y)}`;
  }

  return d;
}

/** Format a number to 2 decimal places for SVG path output. */
function f(n: number): string {
  return Math.round(n * 100) / 100 + '';
}
