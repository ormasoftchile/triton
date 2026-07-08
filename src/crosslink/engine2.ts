/**
 * Cross-Link Engine v2 — Global Cost-Function Routing
 *
 * Replaces the two-step resolve.ts + render.ts pipeline with a single unified
 * pass that uses a global cost function for port selection.
 *
 * Architecture:
 *   1. For each link, generate all 16 (srcWall × dstWall) port-pair candidates
 *   2. Score each candidate against already-committed routes using a unified
 *      cost function: side preference, crossing count, port conflict, bend
 *      count, path length, and alignment penalty
 *   3. Commit the best candidate greedily (longest links first, so the most
 *      spatially constrained routes claim cleaner corridors first)
 *   4. Post-route: border nudge → channel separation → label stagger → label de-collision
 *
 * Cost function:
 *   cost = W_CROSS × crossings(candidate, committed_routes)
 *        + W_SIDE  × wrong_side_penalty(srcWall, dstWall, Δx, Δy)
 *        + W_PORT  × port_conflict_penalty(ports, committed_ports)
 *        + W_BENDS × bend_count
 *        + W_LEN   × path_length
 *        + W_ALIGN × alignment_penalty  (short jog segments < SNAP_THRESHOLD)
 */

import type { SceneElement } from '../contracts/scene.js';
import type { CrossLink, CrossLinkEdgeStyle } from '../contracts/crosslink.js';
import type { CardinalSide, NodeAnchorRegistry } from '../contracts/anchors.js';
import type { PortDirection } from '../contracts/routing.js';
import type { Point, Rect } from '../contracts/primitives.js';
import type { ResolvedTheme } from '../contracts/theme.js';
import { createRouter } from '../routing/router.js';

export interface CrossLinkRenderResult {
  readonly defs: string[];
  readonly elements: SceneElement[];
}

// ─── Cost weights ─────────────────────────────────────────────────────────────

/** Per crossing with an already-committed route. */
const W_CROSS         = 10_000;
/** Per wrong-side step on source or destination wall. */
const W_SIDE          =    800;
/** Per committed port within CONFLICT_RADIUS on the same node+wall. */
const W_PORT_CONFLICT =    600;
/** Per bend beyond the minimum (points.length − 2). */
const W_BENDS         =     50;
/** Per pixel of total path length. */
const W_LEN           =      1;
/** Flat penalty per short jog segment shorter than SNAP_THRESHOLD. */
const W_ALIGN         =    400;

/** Jog segments shorter than this are penalised and snapped away. */
const SNAP_THRESHOLD  =     14;
/** Ports within this distance on the same wall count as conflicting. */
const CONFLICT_RADIUS =     24;
/** Shrink intermediate cell rects by this amount for routing obstacles. */
const CELL_SHRINK     =     12;
/** Gap between parallel overlapping segments after channel separation. */
const CHANNEL_GAP     =     12;
/** Clearance around obstacles when routing. */
const ROUTE_PADDING   =     12;

// ─── SVG marker IDs ───────────────────────────────────────────────────────────

const ARROW_ID    = 'triton-crosslink-arrow';
const BI_ARROW_ID = 'triton-crosslink-arrow-both';

// ─── Internal types ───────────────────────────────────────────────────────────

/** A route that has been chosen and committed during the greedy assignment. */
interface CommittedRoute {
  readonly srcKey:  string;
  readonly dstKey:  string;
  readonly srcSide: CardinalSide;
  readonly dstSide: CardinalSide;
  readonly srcPort: Point;
  readonly dstPort: Point;
  readonly points:  readonly Point[];
}

/** A route being built before SVG emission. */
interface WorkingRoute {
  points:      Point[];
  /** True when points = [from, cp1, cp2, to] — render with SVG C command. */
  isBezier?:   true;
  color:       string;
  dash?:       string;
  animation?:  'march' | 'particle';
  markerEnd?:  string;
  markerStart?: string;
  label?:      string;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Unified routing + rendering pass for all cross-links in a poster.
 *
 * Drop-in replacement for `resolveCrossLinks` + `renderCrossLinks` but takes
 * the raw CrossLink array instead of pre-resolved port positions.
 */
export function routeAndRenderCrossLinks2(
  links: readonly CrossLink[],
  theme: ResolvedTheme,
  anchors: NodeAnchorRegistry,
  occupiedRects?: readonly Rect[],
  routingObstacles?: readonly Rect[],
  cellRects?: ReadonlyMap<string, Rect>,
): CrossLinkRenderResult {
  const { palette, typography, edges: edgeTheme } = theme;
  const elements: SceneElement[] = [];
  const defs: string[] = [];

  // ── Colour assignment (same logic as render.ts) ───────────────────────────
  const PALETTE = [
    '#E11D48', '#16A34A', '#9333EA', '#0891B2',
    '#CA8A04', '#DC2626', '#2563EB', '#7C3AED',
  ];
  let explicitColorIdx = 0;

  // All node bounds used as routing obstacles
  const allNodeBounds: Rect[] = Object.values(anchors).map(a => a.bounds);

  // ── Address → registry key helper ────────────────────────────────────────
  const addrKey = (addr: { cellPath: readonly string[]; nodeId: string }): string =>
    [...addr.cellPath, addr.nodeId].join('.');

  function centerOf(key: string): Point {
    const a = anchors[key];
    if (!a) return { x: 0, y: 0 };
    return { x: a.bounds.x + a.bounds.width / 2, y: a.bounds.y + a.bounds.height / 2 };
  }

  // ── Filter to resolvable links, sort axis-aligned-first ──────────────────
  // Routes that are nearly horizontal or vertical have exactly one natural
  // corridor — commit them first so they claim a clean straight path.
  // Diagonal routes are more flexible and route around already-committed ones.
  //
  // Sort key: min(|dx|,|dy|) / (max(|dx|,|dy|)+1)  → 0 = axis-aligned, 1 = diagonal.
  const resolvable = links.filter(l => anchors[addrKey(l.from)] && anchors[addrKey(l.to)]);

  const sortedLinks = [...resolvable].sort((a, b) => {
    const ca = centerOf(addrKey(a.from)), cb = centerOf(addrKey(a.to));
    const cc = centerOf(addrKey(b.from)), cd = centerOf(addrKey(b.to));
    const axA = Math.abs(cb.x - ca.x), ayA = Math.abs(cb.y - ca.y);
    const axB = Math.abs(cd.x - cc.x), ayB = Math.abs(cd.y - cc.y);
    const sA = Math.min(axA, ayA) / (Math.max(axA, ayA) + 1);
    const sB = Math.min(axB, ayB) / (Math.max(axB, ayB) + 1);
    if (Math.abs(sA - sB) > 0.05) return sA - sB; // more aligned first
    // Tie-break: longer route first (more spatially constrained)
    return Math.hypot(cb.x - ca.x, cb.y - ca.y) - Math.hypot(cd.x - cc.x, cd.y - cc.y);
  }).reverse(); // within same alignment group, longest first

  // ── Phase 1: Global port selection + routing ──────────────────────────────
  const committed: CommittedRoute[] = [];

  // workingByOriginalIdx preserves the original link order for colour assignment
  const workingByOriginalIdx = new Map<number, WorkingRoute>();

  for (const link of sortedLinks) {
    const srcKey = addrKey(link.from);
    const dstKey = addrKey(link.to);
    const srcAnchor = anchors[srcKey]!;
    const dstAnchor = anchors[dstKey]!;
    const srcCenter = centerOf(srcKey);
    const dstCenter = centerOf(dstKey);

    // Per-link routing obstacles: node bounds + shrunken intermediate cells
    const linkObstacles: Rect[] = [...allNodeBounds];
    if (cellRects) {
      const srcCellId = link.from.cellPath.join('.');
      const dstCellId = link.to.cellPath.join('.');
      for (const [cellId, r] of cellRects) {
        if (cellId === srcCellId || cellId === dstCellId) continue;
        const sw = r.width  - 2 * CELL_SHRINK;
        const sh = r.height - 2 * CELL_SHRINK;
        if (sw > 0 && sh > 0) {
          linkObstacles.push({ x: r.x + CELL_SHRINK, y: r.y + CELL_SHRINK, width: sw, height: sh });
        }
      }
    }

    const sides: CardinalSide[] = ['N', 'S', 'E', 'W'];
    const routeStyle = link.routing ?? 'orthogonal';

    let bestPoints: Point[] = [];
    let bestEffectivePts: Point[] = []; // sampled curve pts for crossing detection
    let bestIsBezier = false;
    let bestScore = Infinity;
    let bestSrcSide: CardinalSide = 'E';
    let bestDstSide: CardinalSide = 'W';
    let bestSrcPort: Point = midport(srcAnchor.bounds, 'E');
    let bestDstPort: Point = midport(dstAnchor.bounds, 'W');

    for (const ss of sides) {
      for (const ds of sides) {
        // Try three port positions per wall: 25 %, 50 %, 75 % of edge length.
        // The port-conflict penalty then naturally spreads connectors that
        // share the same wall to different positions instead of stacking them.
        for (const spBase of wallPorts(srcAnchor.bounds, ss)) {
          for (const dpBase of wallPorts(dstAnchor.bounds, ds)) {
            // Port alignment snap: if both ports exit on the same axis and
            // the perpendicular offset is tiny, snap to exact alignment.
            const snapped = snapAlignment(ss, spBase, ds, dpBase);
            const sp = snapped.srcPort;
            const dp = snapped.dstPort;

            // Route using the link's preferred style
            const router = createRouter(routeStyle);
            const route = router.route({
              from: sp,
              to: dp,
              style: routeStyle,
              obstacles: linkObstacles,
              padding: ROUTE_PADDING,
              fromDir: ss as PortDirection,
              toDir:   ds as PortDirection,
            });
            const pts = route.points as Point[];

            // Bezier router returns [from, cp1, cp2, to] — these are control
            // points, NOT path points. Using them as a polyline gives wrong
            // crossing counts and wrong arc length.  Sample the actual cubic
            // bezier curve for scoring.
            const isBez = routeStyle === 'bezier' && pts.length === 4;
            const effectivePts: Point[] = isBez
              ? sampleCubicBezierPts(pts[0]!, pts[1]!, pts[2]!, pts[3]!, 12)
              : pts;

            // ── Unified cost function ────────────────────────────────────
            const score =
              sidePenalty(ss, ds, srcCenter, dstCenter)      +
              crossingPenalty(effectivePts, committed)        +
              portConflictPenalty(
                srcKey, ss, sp,
                dstKey, ds, dp,
                committed,
              )                                               +
              (isBez ? 0 : Math.max(0, pts.length - 2) * W_BENDS) +
              pathLen(effectivePts) * W_LEN                   +
              (isBez ? 0 : alignPenalty(pts));

            if (score < bestScore) {
              bestScore        = score;
              bestPoints       = pts;
              bestEffectivePts = effectivePts;
              bestIsBezier     = isBez;
              bestSrcSide      = ss;
              bestDstSide      = ds;
              bestSrcPort      = sp;
              bestDstPort      = dp;
            }
          }
        }
      }
    }

    committed.push({
      srcKey, dstKey,
      srcSide: bestSrcSide, dstSide: bestDstSide,
      srcPort: bestSrcPort, dstPort: bestDstPort,
      points: bestEffectivePts, // sampled points for accurate future crossing detection
    });

    // Colour
    let color: string;
    {
      color = PALETTE[explicitColorIdx % PALETTE.length]!;
      explicitColorIdx++;
    }

    const dash = edgeStyleToDash(link.style);
    const animation: 'march' | 'particle' | undefined =
      link.animation === 'none'     ? undefined :
      link.animation === 'particle' ? 'particle' :
      link.animation === 'march'    ? 'march'    :
      dash                          ? 'march'    : undefined;

    let markerEnd:   string | undefined;
    let markerStart: string | undefined;
    if (link.direction === 'directed') {
      markerEnd = ARROW_ID;
    } else if (link.direction === 'bidirectional') {
      markerEnd   = ARROW_ID;
      markerStart = BI_ARROW_ID;
    }

    // Record with original link index so colours match original declaration order
    const origIdx = links.indexOf(link);
    workingByOriginalIdx.set(origIdx >= 0 ? origIdx : workingByOriginalIdx.size, {
      points: [...bestPoints],
      ...(bestIsBezier ? { isBezier: true as const } : {}),
      color,
      ...(dash        ? { dash }        : {}),
      ...(animation   ? { animation }   : {}),
      ...(markerEnd   ? { markerEnd }   : {}),
      ...(markerStart ? { markerStart } : {}),
      ...(link.label  ? { label: link.label } : {}),
    });
  }

  // Reconstruct in original link order
  const workingRoutes: WorkingRoute[] = [];
  for (let i = 0; i < links.length; i++) {
    const wr = workingByOriginalIdx.get(i);
    if (wr) workingRoutes.push(wr);
  }

  // ── Phase 2: Border nudging ───────────────────────────────────────────────
  if (routingObstacles && routingObstacles.length > 0) {
    nudgeOffBorders(workingRoutes, routingObstacles);
  }

  // ── Phase 3: Channel separation ───────────────────────────────────────────
  separateChannels(workingRoutes);

  // ── Phase 4: Label staggering ─────────────────────────────────────────────
  const CORRIDOR_TOL  = 20;
  const labelFractions = new Array<number>(workingRoutes.length).fill(0.5);
  const labeledIdxs   = workingRoutes.map((r, i) => r.label ? i : -1).filter(i => i >= 0);
  const staggered     = new Set<number>();

  for (const i of labeledIdxs) {
    if (staggered.has(i)) continue;
    const wrI = workingRoutes[i]!;
    const ptsI = wrI.isBezier
      ? sampleCubicBezierPts(wrI.points[0]!, wrI.points[1]!, wrI.points[2]!, wrI.points[3]!, 12)
      : wrI.points;
    const infoI = dominantSegment(ptsI);
    const group = [i];
    for (const j of labeledIdxs) {
      if (j === i || staggered.has(j)) continue;
      const wrJ = workingRoutes[j]!;
      const ptsJ = wrJ.isBezier
        ? sampleCubicBezierPts(wrJ.points[0]!, wrJ.points[1]!, wrJ.points[2]!, wrJ.points[3]!, 12)
        : wrJ.points;
      const infoJ = dominantSegment(ptsJ);
      if (infoI.axis === infoJ.axis && Math.abs(infoI.coord - infoJ.coord) < CORRIDOR_TOL) {
        group.push(j);
      }
    }
    if (group.length > 1) {
      group.sort((a, b) => a - b);
      group.forEach((idx, k) => { labelFractions[idx] = (k + 1) / (group.length + 1); });
      group.forEach(idx => staggered.add(idx));
    }
  }

  // ── Phase 5: Emit path elements ───────────────────────────────────────────
  let needsArrow   = false;
  let needsBiArrow = false;

  const pendingLabels: Array<{
    content:    string;
    x:          number;
    y:          number;
    fontSize:   number;
    fontFamily: string;
    fill:       string;
  }> = [];

  for (let i = 0; i < workingRoutes.length; i++) {
    const wr = workingRoutes[i]!;
    const path = wr.isBezier
      ? `M ${wr.points[0]!.x} ${wr.points[0]!.y} C ${wr.points[1]!.x} ${wr.points[1]!.y} ${wr.points[2]!.x} ${wr.points[2]!.y} ${wr.points[3]!.x} ${wr.points[3]!.y}`
      : wr.points.map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    if (wr.markerEnd   === ARROW_ID)    needsArrow   = true;
    if (wr.markerStart === BI_ARROW_ID) needsBiArrow = true;

    elements.push({
      type:        'path',
      d:           path,
      stroke:      wr.color,
      strokeWidth: edgeTheme.strokeWidth + 0.5,
      ...(wr.dash        ? { strokeDasharray: wr.dash }    : {}),
      ...(wr.animation   ? { animated: wr.animation }      : {}),
      ...(wr.markerEnd   ? { markerEnd: wr.markerEnd }     : {}),
      ...(wr.markerStart ? { markerStart: wr.markerStart } : {}),
    });

    if (wr.label) {
      const labelPts = wr.isBezier
        ? sampleCubicBezierPts(wr.points[0]!, wr.points[1]!, wr.points[2]!, wr.points[3]!, 12)
        : wr.points;
      const labelPos = pointAtFrac(labelPts, labelFractions[i] ?? 0.5);
      pendingLabels.push({
        content:    wr.label,
        x:          labelPos.x,
        y:          labelPos.y - 6,
        fontSize:   edgeTheme.labelFontSize,
        fontFamily: typography.fontFamily,
        fill:       wr.color,
      });
    }
  }

  // ── Phase 6: Label de-collision ───────────────────────────────────────────
  const CHAR_W    = 0.65;
  const LABEL_PAD = 4;
  const fixedRects: Rect[] = [...allNodeBounds, ...(occupiedRects ?? [])];

  const labelRects = pendingLabels.map(l => ({
    x:      l.x - (l.content.length * l.fontSize * CHAR_W) / 2 - LABEL_PAD,
    y:      l.y - l.fontSize,
    width:  l.content.length * l.fontSize * CHAR_W + LABEL_PAD * 2,
    height: l.fontSize + LABEL_PAD * 2,
  }));

  deCollideLabels(labelRects, fixedRects);

  for (let i = 0; i < pendingLabels.length; i++) {
    const l = pendingLabels[i]!;
    const r = labelRects[i]!;
    elements.push({
      type:       'text',
      content:    l.content,
      position:   { x: r.x + r.width / 2, y: r.y + r.height - LABEL_PAD },
      fontSize:   l.fontSize,
      fontFamily: l.fontFamily,
      fill:       l.fill,
      anchor:     'middle',
      fontWeight: 'bold',
    });
  }

  // ── Defs ──────────────────────────────────────────────────────────────────
  if (needsArrow) {
    const s = edgeTheme.arrowSize;
    defs.push(
      `<marker id="${ARROW_ID}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="${s - 1}" refY="${s * 0.35}" orient="auto">` +
      `<polygon points="0 0, ${s} ${s * 0.35}, 0 ${s * 0.7}" fill="currentColor" /></marker>`,
    );
  }
  if (needsBiArrow) {
    const s = edgeTheme.arrowSize;
    defs.push(
      `<marker id="${BI_ARROW_ID}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="1" refY="${s * 0.35}" orient="auto">` +
      `<polygon points="${s} 0, 0 ${s * 0.35}, ${s} ${s * 0.7}" fill="currentColor" /></marker>`,
    );
  }

  return { defs, elements };
}

// ─── Cost function ────────────────────────────────────────────────────────────

/** Opposite of a cardinal side. */
function opp(side: CardinalSide): CardinalSide {
  return side === 'N' ? 'S' : side === 'S' ? 'N' : side === 'E' ? 'W' : 'E';
}

/**
 * Side preference penalty.
 *
 * Ideal source wall: the one facing the direction of the target centre.
 * Ideal dest wall:   the opposite wall (facing back toward the source).
 *
 * Returns 0 for the ideal combination, W_SIDE × 1 for an adjacent wall, and
 * W_SIDE × 2 for the directly opposite (worst) wall.
 */
function sidePenalty(
  srcSide: CardinalSide,
  dstSide: CardinalSide,
  srcCenter: Point,
  dstCenter: Point,
): number {
  const dx   = dstCenter.x - srcCenter.x;
  const dy   = dstCenter.y - srcCenter.y;
  const absX = Math.abs(dx), absY = Math.abs(dy);

  // Ideal: exit from the wall that faces the target
  const idealSrc: CardinalSide =
    absX >= absY ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N');
  const idealDst: CardinalSide = opp(idealSrc);

  const steps = (actual: CardinalSide, ideal: CardinalSide): number =>
    actual === ideal ? 0 : actual === opp(ideal) ? 2 : 1;

  return (steps(srcSide, idealSrc) + steps(dstSide, idealDst)) * W_SIDE;
}

/**
 * Count proper crossings between the candidate route and each already-committed
 * route, weighted by W_CROSS. A "proper crossing" is a strict intersection —
 * touching at a shared endpoint does not count.
 */
function crossingPenalty(points: readonly Point[], committed: CommittedRoute[]): number {
  let count = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    for (const cr of committed) {
      for (let j = 0; j < cr.points.length - 1; j++) {
        if (properlyCross(a, b, cr.points[j]!, cr.points[j + 1]!)) count++;
      }
    }
  }
  return count * W_CROSS;
}

/**
 * Penalise candidates whose ports land very close to ports that are already
 * committed on the same node+wall. This spreads ports out naturally — later
 * routes prefer unused positions on the wall.
 */
function portConflictPenalty(
  srcKey:  string,
  srcSide: CardinalSide,
  srcPort: Point,
  dstKey:  string,
  dstSide: CardinalSide,
  dstPort: Point,
  committed: CommittedRoute[],
): number {
  let penalty = 0;
  for (const cr of committed) {
    // Compare against both endpoints of each committed route
    const crPorts: [string, CardinalSide, Point][] = [
      [cr.srcKey, cr.srcSide, cr.srcPort],
      [cr.dstKey, cr.dstSide, cr.dstPort],
    ];
    for (const [key, side, pt] of crPorts) {
      if (key === srcKey && side === srcSide) {
        const d = Math.hypot(srcPort.x - pt.x, srcPort.y - pt.y);
        if (d < CONFLICT_RADIUS) penalty += W_PORT_CONFLICT * (1 - d / CONFLICT_RADIUS);
      }
      if (key === dstKey && side === dstSide) {
        const d = Math.hypot(dstPort.x - pt.x, dstPort.y - pt.y);
        if (d < CONFLICT_RADIUS) penalty += W_PORT_CONFLICT * (1 - d / CONFLICT_RADIUS);
      }
    }
  }
  return penalty;
}

/**
 * Flat W_ALIGN penalty per short "jog" segment.
 * Jog segments arise when source and destination ports are on the same axis
 * but not exactly aligned, producing a tiny perpendicular segment in an
 * otherwise straight route. Penalising them here causes the cost function
 * to prefer the snapped (straight) alternative.
 */
function alignPenalty(points: readonly Point[]): number {
  let penalty = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < SNAP_THRESHOLD) penalty += W_ALIGN;
  }
  return penalty;
}

// ─── Port alignment snap ──────────────────────────────────────────────────────

/**
 * If both ports exit on the same axis (E/W or N/S) and their perpendicular
 * offset is within SNAP_THRESHOLD, snap both to the average coordinate.
 *
 * This turns a 3-segment H→V→H route (with a tiny V jog) into a single
 * perfectly horizontal segment — the most common "jagged connector" fix.
 * Similarly for V→H→V routes in the vertical case.
 */
function snapAlignment(
  ss: CardinalSide, sp: Point,
  ds: CardinalSide, dp: Point,
): { srcPort: Point; dstPort: Point } {
  const sH = ss === 'E' || ss === 'W';
  const dH = ds === 'E' || ds === 'W';
  if (sH && dH && Math.abs(sp.y - dp.y) < SNAP_THRESHOLD) {
    const avgY = (sp.y + dp.y) / 2;
    return {
      srcPort: { x: sp.x, y: avgY },
      dstPort: { x: dp.x, y: avgY },
    };
  }
  const sV = ss === 'N' || ss === 'S';
  const dV = ds === 'N' || ds === 'S';
  if (sV && dV && Math.abs(sp.x - dp.x) < SNAP_THRESHOLD) {
    const avgX = (sp.x + dp.x) / 2;
    return {
      srcPort: { x: avgX, y: sp.y },
      dstPort: { x: avgX, y: dp.y },
    };
  }
  return { srcPort: sp, dstPort: dp };
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Mid-edge port of a bounding rect on the given cardinal side. */
function midport(bounds: Rect, side: CardinalSide): Point {
  const cx = bounds.x + bounds.width  / 2;
  const cy = bounds.y + bounds.height / 2;
  switch (side) {
    case 'N': return { x: cx, y: bounds.y };
    case 'S': return { x: cx, y: bounds.y + bounds.height };
    case 'E': return { x: bounds.x + bounds.width, y: cy };
    case 'W': return { x: bounds.x, y: cy };
  }
}

/**
 * Three port positions along a wall at 25 %, 50 %, 75 % of edge length.
 * Trying all three per wall (4×4×3×3 = 144 candidates) lets the port-conflict
 * penalty push simultaneous arrivals on the same wall to different positions.
 */
function wallPorts(bounds: Rect, side: CardinalSide): Point[] {
  const { x, y, width, height } = bounds;
  switch (side) {
    case 'N': return [
      { x: x + width * 0.25, y },
      { x: x + width * 0.5,  y },
      { x: x + width * 0.75, y },
    ];
    case 'S': return [
      { x: x + width * 0.25, y: y + height },
      { x: x + width * 0.5,  y: y + height },
      { x: x + width * 0.75, y: y + height },
    ];
    case 'W': return [
      { x, y: y + height * 0.25 },
      { x, y: y + height * 0.5  },
      { x, y: y + height * 0.75 },
    ];
    case 'E': return [
      { x: x + width, y: y + height * 0.25 },
      { x: x + width, y: y + height * 0.5  },
      { x: x + width, y: y + height * 0.75 },
    ];
  }
}

/**
 * Sample n+1 evenly-spaced points along a cubic bezier curve.
 * Used to convert bezier control-point arrays into actual path points for
 * crossing detection and arc-length computation.
 */
function sampleCubicBezierPts(
  p0: Point, p1: Point, p2: Point, p3: Point,
  n: number,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const t2 = t * t, t3 = t2 * t;
    const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
    pts.push({
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    });
  }
  return pts;
}

/** True iff two line segments properly cross (not merely touch). */
function properlyCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross2(p3, p4, p1), d2 = cross2(p3, p4, p2);
  const d3 = cross2(p1, p2, p3), d4 = cross2(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function cross2(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Total Euclidean length of a polyline. */
function pathLen(points: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** Point at fraction t (0..1) of total Euclidean path length. */
function pointAtFrac(points: readonly Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    lens.push(l);
    total += l;
  }
  if (total === 0) return points[0]!;
  const target = total * Math.min(Math.max(t, 0), 1);
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]!;
    if (acc + l >= target) {
      const frac = l > 0 ? (target - acc) / l : 0;
      const a = points[i]!, b = points[i + 1]!;
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
    acc += l;
  }
  return points[points.length - 1]!;
}

/** Axis and fixed coordinate of the dominant (longest) segment. */
function dominantSegment(points: readonly Point[]): { axis: 'h' | 'v'; coord: number } {
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

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width  && a.x + a.width  > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

// ─── Post-route: border nudging ───────────────────────────────────────────────

/**
 * Nudge segments that run parallel along cell borders away from the border.
 * A horizontal segment at y ≈ borderY is shifted vertically by NUDGE.
 * A vertical segment at x ≈ borderX is shifted horizontally by NUDGE.
 * Perpendicular crossings are not affected.
 */
function nudgeOffBorders(routes: WorkingRoute[], borders: readonly Rect[]): void {
  const TOLERANCE = 3;
  const NUDGE     = 8;

  const hBorderYs: number[] = [];
  const vBorderXs: number[] = [];

  for (const b of borders) {
    if (b.width > b.height) hBorderYs.push(b.y + b.height / 2);
    else                    vBorderXs.push(b.x + b.width  / 2);
  }

  for (const route of routes) {
    if (route.isBezier) continue; // bezier control points are not path segments
    const pts = route.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);

      if (dy < 1 && dx > 1) {
        for (const borderY of hBorderYs) {
          if (Math.abs(a.y - borderY) < TOLERANCE) {
            const midY   = (Math.min(...pts.map(p => p.y)) + Math.max(...pts.map(p => p.y))) / 2;
            const nudgeD = a.y < midY ? -NUDGE : NUDGE;
            pts[i]     = { x: a.x, y: a.y + nudgeD };
            pts[i + 1] = { x: b.x, y: b.y + nudgeD };
            break;
          }
        }
      } else if (dx < 1 && dy > 1) {
        for (const borderX of vBorderXs) {
          if (Math.abs(a.x - borderX) < TOLERANCE) {
            const midX   = (Math.min(...pts.map(p => p.x)) + Math.max(...pts.map(p => p.x))) / 2;
            const nudgeD = a.x < midX ? -NUDGE : NUDGE;
            pts[i]     = { x: a.x + nudgeD, y: a.y };
            pts[i + 1] = { x: b.x + nudgeD, y: b.y };
            break;
          }
        }
      }
    }
  }
}

// ─── Post-route: channel separation ──────────────────────────────────────────

/**
 * Detect overlapping parallel segments across routes and offset them by
 * CHANNEL_GAP so they form a visible bundle rather than drawing on top of
 * each other.  Mutates route point arrays in place.
 */
function separateChannels(routes: WorkingRoute[]): void {
  interface Seg {
    routeIdx: number;
    segIdx:   number;
    isV:      boolean; // true = vertical segment
    coord:    number;  // fixed coordinate (x for V, y for H)
    lo:       number;  // range start
    hi:       number;  // range end
  }

  const segs: Seg[] = [];
  for (let ri = 0; ri < routes.length; ri++) {
    if (routes[ri]!.isBezier) continue; // bezier control points are not segments
    const pts = routes[ri]!.points;
    for (let si = 0; si < pts.length - 1; si++) {
      const a = pts[si]!, b = pts[si + 1]!;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      if (dx < 1 && dy > 1) {
        segs.push({ routeIdx: ri, segIdx: si, isV: true,  coord: (a.x + b.x) / 2, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
      } else if (dy < 1 && dx > 1) {
        segs.push({ routeIdx: ri, segIdx: si, isV: false, coord: (a.y + b.y) / 2, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
      }
    }
  }

  const COORD_TOL = 10;
  const used      = new Set<number>();

  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    const si    = segs[i]!;
    const group = [i];

    for (let j = i + 1; j < segs.length; j++) {
      if (used.has(j)) continue;
      const sj = segs[j]!;
      if (sj.isV !== si.isV) continue;
      if (Math.abs(sj.coord - si.coord) > COORD_TOL) continue;
      if (sj.hi - si.lo > 8 && si.hi - sj.lo > 8) { // ranges overlap
        group.push(j);
        used.add(j);
      }
    }
    used.add(i);
    if (group.length < 2) continue;

    const n = group.length;
    for (let k = 0; k < n; k++) {
      const seg    = segs[group[k]!]!;
      const offset = (k - (n - 1) / 2) * CHANNEL_GAP;
      const pts    = routes[seg.routeIdx]!.points;

      if (seg.isV) {
        pts[seg.segIdx]     = { x: pts[seg.segIdx]!.x     + offset, y: pts[seg.segIdx]!.y };
        pts[seg.segIdx + 1] = { x: pts[seg.segIdx + 1]!.x + offset, y: pts[seg.segIdx + 1]!.y };
      } else {
        pts[seg.segIdx]     = { x: pts[seg.segIdx]!.x,     y: pts[seg.segIdx]!.y     + offset };
        pts[seg.segIdx + 1] = { x: pts[seg.segIdx + 1]!.x, y: pts[seg.segIdx + 1]!.y + offset };
      }
    }
  }
}

// ─── Post-route: label de-collision ──────────────────────────────────────────

/**
 * Iteratively push overlapping label rectangles away from each other and from
 * fixed obstacles.  Uses the minimum-translation-vector (MTV) approach.
 * Mutates labelRects in place.
 */
function deCollideLabels(
  labelRects: Array<{ x: number; y: number; width: number; height: number }>,
  fixedRects: readonly Rect[],
): void {
  const MAX_PASSES = 20;
  const NUDGE      = 2;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;

    // Push labels away from fixed rects
    for (const lr of labelRects) {
      for (const fr of fixedRects) {
        if (!rectsOverlap(lr, fr)) continue;
        const ox = Math.min(lr.x + lr.width,  fr.x + fr.width)  - Math.max(lr.x, fr.x);
        const oy = Math.min(lr.y + lr.height, fr.y + fr.height) - Math.max(lr.y, fr.y);
        if (ox <= oy) {
          lr.x = (lr.x + lr.width / 2) <= (fr.x + fr.width / 2)
            ? fr.x - lr.width - NUDGE
            : fr.x + fr.width + NUDGE;
        } else {
          lr.y = (lr.y + lr.height / 2) <= (fr.y + fr.height / 2)
            ? fr.y - lr.height - NUDGE
            : fr.y + fr.height + NUDGE;
        }
        moved = true;
      }
    }

    // Push labels away from each other
    for (let i = 0; i < labelRects.length; i++) {
      for (let j = i + 1; j < labelRects.length; j++) {
        const a = labelRects[i]!, b = labelRects[j]!;
        if (!rectsOverlap(a, b)) continue;
        const ox = Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ox <= oy) {
          if ((a.x + a.width / 2) <= (b.x + b.width / 2)) { a.x -= ox / 2; b.x += ox / 2; }
          else                                              { a.x += ox / 2; b.x -= ox / 2; }
        } else {
          if ((a.y + a.height / 2) <= (b.y + b.height / 2)) {
            const ov = (a.y + a.height) - b.y;
            a.y -= (ov + NUDGE) / 2; b.y += (ov + NUDGE) / 2;
          } else {
            const ov = (b.y + b.height) - a.y;
            b.y -= (ov + NUDGE) / 2; a.y += (ov + NUDGE) / 2;
          }
        }
        moved = true;
      }
    }

    if (!moved) break;
  }
}

// ─── Edge style ───────────────────────────────────────────────────────────────

function edgeStyleToDash(style: CrossLinkEdgeStyle): string | undefined {
  switch (style) {
    case 'dashed': return '8 4';
    case 'dotted': return '4 3';
    default:       return undefined;
  }
}
