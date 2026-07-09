/**
 * Cross-Link Engine v3 — Global Cost-Function Routing
 *
 * Passes:
 *   0. Port assign   Global: shared-endpoint t values sorted by angular order
 *   1. Sort          Axis-aligned first; longest within group
 *   2. Route         Greedy: search collapsed by phase-0 hints for shared ports
 *   3. Repair        Find crossing pairs, re-route lower-priority links
 *   4. Channel sep   Spread parallel overlapping segments
 *   5. Labels        Stagger + de-collision
 *   6. Emit          SVG path strings (L for orthogonal, C for bezier)
 *
 * Cost function:
 *   W_CROSS  × crossings          — H/V decomposition for orthogonal pairs
 *   W_INTER  × cross-link port conflict
 *   W_SIDE   × wrong-side wall
 *   W_INTRA  × intra-diagram port conflict (softer — can be overridden)
 *   W_BEND   × excess bends
 *   W_LEN    × path length
 *   W_ALIGN  × short jog segments (orthogonal only)
 *
 * Crossing detection:
 *   Orthogonal ↔ orthogonal: H/V decomposition, O(1) per segment pair
 *   Mixed/bezier: sampled polyline + AABB prefilter + segment intersection
 */

import type { SceneElement } from '../contracts/scene.js';
import type { CrossLink } from '../contracts/crosslink.js';
import type { CardinalSide, NodeAnchorRegistry, OccupiedPort } from '../contracts/anchors.js';
import type { PortDirection } from '../contracts/routing.js';
import type { Point, Rect } from '../contracts/primitives.js';
import type { ResolvedTheme } from '../contracts/theme.js';
import { createRouter } from '../routing/router.js';

export interface CrossLinkRenderResult {
  readonly defs:     string[];
  readonly elements: SceneElement[];
}

// ─── Cost weights ─────────────────────────────────────────────────────────────

const W_CROSS = 10_000;   // per crossing with a committed route
const W_INTER  = 3_000;   // port conflict with another cross-link (same wall+pos)
const W_SIDE   =   800;   // wrong-side wall (not facing the target)
const W_INTRA  =   500;   // port conflict with an intra-diagram edge
const W_BEND   =    50;   // per excess bend
const W_LEN    =     1;   // per pixel of path length
const W_ALIGN  =   400;   // per short jog segment (orthogonal only)

const SNAP_THRESHOLD  = 14;   // snap near-aligned E/W (or N/S) port pairs
const CONFLICT_RADIUS = 28;   // pixel radius for port conflict detection
const CELL_SHRINK     = 12;   // px to shrink intermediate cell rects
const CHANNEL_GAP     = 12;   // gap between overlapping parallel segments
const ROUTE_PADDING   = 12;   // obstacle clearance during routing

/** Fractional wall positions tried per candidate (0 = wall start, 1 = wall end). */
const WALL_TS: readonly number[] = [0.1, 0.25, 0.5, 0.75, 0.9];

/**
 * Pre-assigned port constraints produced by Pass 0 (shared-endpoint ordering).
 * Any field present collapses the corresponding search dimension in findBestRoute.
 */
interface PortHint {
  readonly srcWall?: CardinalSide;
  readonly srcT?:    number;
  readonly dstWall?: CardinalSide;
  readonly dstT?:    number;
}

const ARROW_ID    = 'triton-crosslink-arrow';
const BI_ARROW_ID = 'triton-crosslink-arrow-both';

// ─── Internal geometry types ──────────────────────────────────────────────────

/** A horizontal segment for H/V crossing detection. */
interface HSegment { readonly y: number; readonly x1: number; readonly x2: number }
/** A vertical segment for H/V crossing detection. */
interface VSegment { readonly x: number; readonly y1: number; readonly y2: number }

// ─── Internal route types ─────────────────────────────────────────────────────

interface CommittedRoute {
  readonly linkIdx:  number;
  readonly srcKey:   string;
  readonly dstKey:   string;
  readonly srcWall:  CardinalSide;
  readonly srcT:     number;
  readonly srcPort:  Point;
  readonly dstWall:  CardinalSide;
  readonly dstT:     number;
  readonly dstPort:  Point;
  /** Actual curve points (sampled for bezier, vertices for orthogonal/straight). */
  readonly points:   readonly Point[];
  /** Raw router output — [from, cp1, cp2, to] for bezier, equals points otherwise. */
  readonly rawPts:   readonly Point[];
  readonly isBezier: boolean;
  /** Pre-computed H/V decomposition (empty arrays for non-orthogonal). */
  readonly hSegs:    readonly HSegment[];
  readonly vSegs:    readonly VSegment[];
}

interface WorkingRoute {
  points:       Point[];
  isBezier?:    true;
  color:        string;
  dash?:        string;
  animation?:   'march' | 'particle';
  markerEnd?:   string;
  markerStart?: string;
  label?:       string;
  labelPlacement?: 'path-midpoint';
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function routeAndRenderCrossLinks3(
  links:             readonly CrossLink[],
  theme:             ResolvedTheme,
  anchors:           NodeAnchorRegistry,
  intraPorts?:       readonly OccupiedPort[],
  occupiedRects?:    readonly Rect[],
  routingObstacles?: readonly Rect[],
  cellRects?:        ReadonlyMap<string, Rect>,
): CrossLinkRenderResult {
  const { palette, typography, edges: edgeTheme } = theme;
  const elements: SceneElement[] = [];
  const defs:     string[]       = [];

  // ── Colour assignment ─────────────────────────────────────────────────────
  const PALETTE = [
    '#E11D48', '#16A34A', '#9333EA', '#0891B2',
    '#CA8A04', '#DC2626', '#2563EB', '#7C3AED',
  ];
  let explicitColorIdx = 0;

  const allNodeBounds: Rect[] = Object.values(anchors).map(a => a.bounds);

  const addrKey = (addr: { cellPath: readonly string[]; nodeId: string }): string =>
    [...addr.cellPath, addr.nodeId].join('.');

  function centerOf(key: string): Point {
    const a = anchors[key];
    return a ? { x: a.bounds.x + a.bounds.width / 2, y: a.bounds.y + a.bounds.height / 2 } : { x: 0, y: 0 };
  }

  // ── Pass 1: Sort links axis-aligned first ─────────────────────────────────
  const resolvable = links.filter(l => anchors[addrKey(l.from)] && anchors[addrKey(l.to)]);

  // ── Pass 0: Pre-assign ports at shared endpoints ─────────────────────────
  // For every (node, wall) that has 2+ links, sort arrivals/departures by the
  // angular position of the other endpoint and assign evenly-spaced t values.
  // This guarantees a non-crossing fan at the shared node before routing starts.
  const portHints = preAssignSharedPorts(resolvable, anchors);

  const sortedLinks = [...resolvable].sort((a, b) => {
    const ca = centerOf(addrKey(a.from)), cb = centerOf(addrKey(a.to));
    const cc = centerOf(addrKey(b.from)), cd = centerOf(addrKey(b.to));
    const axA = Math.abs(cb.x - ca.x), ayA = Math.abs(cb.y - ca.y);
    const axB = Math.abs(cd.x - cc.x), ayB = Math.abs(cd.y - cc.y);
    const sA = Math.min(axA, ayA) / (Math.max(axA, ayA) + 1);
    const sB = Math.min(axB, ayB) / (Math.max(axB, ayB) + 1);
    if (Math.abs(sA - sB) > 0.05) return sA - sB;
    return Math.hypot(cb.x - ca.x, cb.y - ca.y) - Math.hypot(cd.x - cc.x, cd.y - cc.y);
  }).reverse();

  // ── Pass 2: Greedy routing ────────────────────────────────────────────────
  const committed: CommittedRoute[] = [];
  const workingByOriginalIdx = new Map<number, WorkingRoute>();

  for (let si = 0; si < sortedLinks.length; si++) {
    const link   = sortedLinks[si]!;
    const rIdx   = resolvable.indexOf(link);
    const hint   = rIdx >= 0 ? portHints.get(rIdx) : undefined;
    const best   = findBestRoute(si, link, anchors, allNodeBounds, cellRects, committed, intraPorts ?? [], hint);
    if (!best) continue;
    committed.push(best.committed);

    let color: string;
    const explicitColor = typeof link.props?.color === 'string' ? link.props.color : undefined;
    if (explicitColor) {
      color = explicitColor;
    } else {
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

    const origIdx = links.indexOf(link);
    workingByOriginalIdx.set(origIdx >= 0 ? origIdx : workingByOriginalIdx.size, {
      points: [...best.rawPts],
      ...(best.committed.isBezier ? { isBezier: true as const } : {}),
      color,
      ...(dash        ? { dash }        : {}),
      ...(animation   ? { animation }   : {}),
      ...(markerEnd   ? { markerEnd }   : {}),
      ...(markerStart ? { markerStart } : {}),
      ...(link.label  ? { label: link.label } : {}),
      ...(link.props?.labelPlacement === 'path-midpoint' ? { labelPlacement: 'path-midpoint' as const } : {}),
    });
  }

  // ── Pass 3: Crossing repair ───────────────────────────────────────────────
  repairCrossings(committed, sortedLinks, anchors, allNodeBounds, cellRects, intraPorts ?? [], workingByOriginalIdx, links, portHints, resolvable);

  // Reconstruct workingRoutes in original link order
  const workingRoutes: WorkingRoute[] = [];
  for (let i = 0; i < links.length; i++) {
    const wr = workingByOriginalIdx.get(i);
    if (wr) workingRoutes.push(wr);
  }

  // ── Pass 4: Border nudging ────────────────────────────────────────────────
  if (routingObstacles && routingObstacles.length > 0) {
    nudgeOffBorders(workingRoutes, routingObstacles);
  }

  // ── Pass 4b: Channel separation ───────────────────────────────────────────
  separateChannels(workingRoutes);

  // ── Pass 5: Label staggering ──────────────────────────────────────────────
  const CORRIDOR_TOL  = 20;
  const labelFractions = new Array<number>(workingRoutes.length).fill(0.5);
  const labeledIdxs   = workingRoutes.map((r, i) => r.label ? i : -1).filter(i => i >= 0);
  const staggered     = new Set<number>();

  for (const i of labeledIdxs) {
    if (staggered.has(i)) continue;
    const wrI  = workingRoutes[i]!;
    const ptsI = sampledPts(wrI);
    const infoI = dominantSegment(ptsI);
    const group = [i];
    for (const j of labeledIdxs) {
      if (j === i || staggered.has(j)) continue;
      const wrJ  = workingRoutes[j]!;
      const ptsJ = sampledPts(wrJ);
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

  // ── Pass 6: Emit SVG elements ─────────────────────────────────────────────
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
      const pts    = sampledPts(wr);
      // Staggered labels (parallel links sharing a corridor) keep their
      // length-fraction offset so they don't stack. Otherwise anchor the label
      // on the route's longest HORIZONTAL run — labels are horizontal text and
      // read best along a horizontal segment, and this avoids parking them on a
      // short/outboard vertical channel that may sit at the diagram edge.
      const labelPos = staggered.has(i) || wr.isBezier || wr.labelPlacement === 'path-midpoint'
        ? pointAtFrac(pts, labelFractions[i] ?? 0.5)
        : labelAnchor(pts);
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

  // Label de-collision
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
      fontFamily: typography.fontFamily,
      fill:       l.fill,
      anchor:     'middle',
      fontWeight: 'bold',
    });
  }

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

// ─── Route finding (shared by greedy pass and repair pass) ───────────────────

function findBestRoute(
  linkIdx:    number,
  link:       CrossLink,
  anchors:    NodeAnchorRegistry,
  allNodeBounds: Rect[],
  cellRects:  ReadonlyMap<string, Rect> | undefined,
  committed:  readonly CommittedRoute[],
  intraPorts: readonly OccupiedPort[],
  portHint?:  PortHint,
): { committed: CommittedRoute; rawPts: readonly Point[] } | null {
  const addrKey = (addr: { cellPath: readonly string[]; nodeId: string }): string =>
    [...addr.cellPath, addr.nodeId].join('.');

  const srcKey    = addrKey(link.from);
  const dstKey    = addrKey(link.to);
  const srcAnchor = anchors[srcKey];
  const dstAnchor = anchors[dstKey];
  if (!srcAnchor || !dstAnchor) return null;

  const srcCenter: Point = {
    x: srcAnchor.bounds.x + srcAnchor.bounds.width  / 2,
    y: srcAnchor.bounds.y + srcAnchor.bounds.height / 2,
  };
  const dstCenter: Point = {
    x: dstAnchor.bounds.x + dstAnchor.bounds.width  / 2,
    y: dstAnchor.bounds.y + dstAnchor.bounds.height / 2,
  };

  // Build per-link obstacle list.
  // Nodes inside the source/dest cells must NOT be obstacles — they are the
  // "interior terrain" of the endpoint cells.  Without this exclusion the
  // router sees sibling nodes (e.g. Gateway next to the target Order Service)
  // as hard obstacles and produces large detours to reach the destination port.
  const srcCellId = link.from.cellPath.join('.');
  const dstCellId = link.to.cellPath.join('.');
  const linkObstacles: Rect[] = Object.entries(anchors)
    .filter(([key]) =>
      !key.startsWith(srcCellId + '.') &&
      !key.startsWith(dstCellId + '.') &&
      key !== srcKey && key !== dstKey,
    )
    .map(([, a]) => a.bounds);
  if (cellRects) {
    for (const [cellId, r] of cellRects) {
      if (cellId === srcCellId || cellId === dstCellId) continue;
      const sw = r.width  - 2 * CELL_SHRINK;
      const sh = r.height - 2 * CELL_SHRINK;
      if (sw > 0 && sh > 0) {
        linkObstacles.push({ x: r.x + CELL_SHRINK, y: r.y + CELL_SHRINK, width: sw, height: sh });
      }
    }
  }

  const routeStyle  = link.routing ?? 'orthogonal';
  const sides: CardinalSide[] = ['N', 'S', 'E', 'W'];
  // Collapse search dimensions. Precedence: explicit user exit/entry walls win,
  // then phase-0 shared-port fan hints, then full 4-wall search.
  const srcWalls: CardinalSide[] = link.exitWall  ? [link.exitWall]  : portHint?.srcWall ? [portHint.srcWall] : sides;
  const dstWalls: CardinalSide[] = link.entryWall ? [link.entryWall] : portHint?.dstWall ? [portHint.dstWall] : sides;
  // Honor a phase-0 fan t whenever one was assigned. Pinned walls always get a
  // fan slot (centre when alone, evenly spread when several share the wall), so
  // this is what centres the port on the wall.
  const srcTs: readonly number[] = portHint?.srcT !== undefined ? [portHint.srcT] : WALL_TS;
  const dstTs: readonly number[] = portHint?.dstT !== undefined ? [portHint.dstT] : WALL_TS;

  let bestScore        = Infinity;
  let bestCommitted!:  CommittedRoute;
  let bestRawPts!:     readonly Point[];

  for (const ss of srcWalls) {
    for (const ds of dstWalls) {
      for (const srcT of srcTs) {
        for (const dstT of dstTs) {
          let sp = wallPoint(srcAnchor.bounds, ss, srcT);
          let dp = wallPoint(dstAnchor.bounds, ds, dstT);

          // Snap near-aligned pairs to exact alignment (eliminates jog segments)
          const snapped = snapAlignment(ss, sp, ds, dp);
          sp = snapped.srcPort;
          dp = snapped.dstPort;

          const router = createRouter(routeStyle);
          const routePadding = typeof link.props?.routePadding === 'number' ? link.props.routePadding : ROUTE_PADDING;
          const routeObstacles = [...linkObstacles, srcAnchor.bounds, dstAnchor.bounds];
          const route  = router.route({
            from:    sp,
            to:      dp,
            style:   routeStyle,
            obstacles: routeObstacles,
            padding: routePadding,
            fromDir: ss as PortDirection,
            toDir:   ds as PortDirection,
          });
          const rawPts = route.points as Point[];

          const isBez = routeStyle === 'bezier' && rawPts.length === 4;
          const pts: readonly Point[] = isBez
            ? sampleCubicBezier(rawPts[0]!, rawPts[1]!, rawPts[2]!, rawPts[3]!, 12)
            : rawPts;

          const { hSegs, vSegs } = decomposeHV(pts, routeStyle);

          // ── Unified cost function ─────────────────────────────────────
          const score =
            sidePenalty(ss, ds, srcCenter, dstCenter)                    +
            crossingScore(pts, hSegs, vSegs, isBez, committed)           +
            portConflictScore(
              srcKey, ss, sp, srcT,
              dstKey, ds, dp, dstT,
              committed, intraPorts, anchors,
            )                                                             +
            (isBez ? 0 : Math.max(0, rawPts.length - 2) * W_BEND)       +
            pathLen(pts) * W_LEN                                          +
            (isBez ? 0 : alignPenalty(rawPts));

          if (score < bestScore) {
            bestScore = score;
            bestRawPts = rawPts;
            bestCommitted = {
              linkIdx,
              srcKey, dstKey,
              srcWall: ss, srcT, srcPort: sp,
              dstWall: ds, dstT, dstPort: dp,
              points: pts,
              rawPts,
              isBezier: isBez,
              hSegs,
              vSegs,
            };
          }
        }
      }
    }
  }

  return bestScore < Infinity ? { committed: bestCommitted, rawPts: bestRawPts } : null;
}

// ─── Pass 3: Crossing repair ──────────────────────────────────────────────────

function repairCrossings(
  committed:         CommittedRoute[],
  sortedLinks:       readonly CrossLink[],
  anchors:           NodeAnchorRegistry,
  allNodeBounds:     Rect[],
  cellRects:         ReadonlyMap<string, Rect> | undefined,
  intraPorts:        readonly OccupiedPort[],
  workingByOrigIdx:  Map<number, WorkingRoute>,
  links:             readonly CrossLink[],
  portHints:         ReadonlyMap<number, PortHint>,
  resolvable:        readonly CrossLink[],
): void {
  // One repair pass: for each crossing pair (i committed before j), try re-routing j
  for (let j = 1; j < committed.length; j++) {
    const crJ = committed[j]!;

    // Count crossings between j and any earlier route
    let jCrossings = 0;
    for (let i = 0; i < j; i++) {
      jCrossings += countCrossingsBetween(committed[i]!, crJ);
    }
    if (jCrossings === 0) continue;

    // Attempt re-route of j with all other routes committed except j itself
    const committedWithoutJ = committed.filter((_, k) => k !== j);
    const link = sortedLinks[crJ.linkIdx];
    if (!link) continue;

    const rIdx  = resolvable.indexOf(link);
    const hint   = rIdx >= 0 ? portHints.get(rIdx) : undefined;
    const result = findBestRoute(
      crJ.linkIdx, link, anchors, allNodeBounds, cellRects,
      committedWithoutJ, intraPorts, hint,
    );
    if (!result) continue;

    // Accept only if new route has fewer crossings with earlier routes
    let newCrossings = 0;
    for (let i = 0; i < j; i++) {
      newCrossings += countCrossingsBetween(committed[i]!, result.committed);
    }
    if (newCrossings >= jCrossings) continue;

    committed[j] = result.committed;
    const origIdx = links.indexOf(link);
    const wr = workingByOrigIdx.get(origIdx >= 0 ? origIdx : -1);
    if (wr) {
      wr.points = [...result.rawPts];
      if (result.committed.isBezier) {
        (wr as { isBezier?: true }).isBezier = true;
      } else {
        delete (wr as { isBezier?: true }).isBezier;
      }
    }
  }
}

// ─── H/V crossing detection ───────────────────────────────────────────────────

/**
 * Decompose a polyline into horizontal and vertical segments for fast
 * crossing detection. Only meaningful for orthogonal routes.
 */
function decomposeHV(pts: readonly Point[], style: string): { hSegs: HSegment[]; vSegs: VSegment[] } {
  const hSegs: HSegment[] = [];
  const vSegs: VSegment[] = [];
  if (style !== 'orthogonal') return { hSegs, vSegs };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (Math.abs(b.y - a.y) < 0.5 && Math.abs(b.x - a.x) > 0.5) {
      hSegs.push({ y: (a.y + b.y) / 2, x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x) });
    } else if (Math.abs(b.x - a.x) < 0.5 && Math.abs(b.y - a.y) > 0.5) {
      vSegs.push({ x: (a.x + b.x) / 2, y1: Math.min(a.y, b.y), y2: Math.max(a.y, b.y) });
    }
  }
  return { hSegs, vSegs };
}

/** Count H/V crossings between two sets of decomposed segments. */
function countHVCrossings(
  aH: readonly HSegment[], aV: readonly VSegment[],
  bH: readonly HSegment[], bV: readonly VSegment[],
): number {
  let n = 0;
  for (const h of aH) for (const v of bV) if (hvCross(h, v)) n++;
  for (const v of aV) for (const h of bH) if (hvCross(h, v)) n++;
  return n;
}

/** True iff a horizontal and a vertical segment properly intersect (not touch). */
function hvCross(h: HSegment, v: VSegment): boolean {
  return v.x > h.x1 && v.x < h.x2 && h.y > v.y1 && h.y < v.y2;
}

/** Count crossings between two polylines using AABB prefilter + proper intersection. */
function countPolylineCrossings(a: readonly Point[], b: readonly Point[]): number {
  let n = 0;
  for (let i = 0; i < a.length - 1; i++) {
    const a1 = a[i]!, a2 = a[i + 1]!;
    const axMin = Math.min(a1.x, a2.x), axMax = Math.max(a1.x, a2.x);
    const ayMin = Math.min(a1.y, a2.y), ayMax = Math.max(a1.y, a2.y);
    for (let j = 0; j < b.length - 1; j++) {
      const b1 = b[j]!, b2 = b[j + 1]!;
      // AABB prefilter
      if (axMax < Math.min(b1.x, b2.x) || axMin > Math.max(b1.x, b2.x)) continue;
      if (ayMax < Math.min(b1.y, b2.y) || ayMin > Math.max(b1.y, b2.y)) continue;
      if (properlyCross(a1, a2, b1, b2)) n++;
    }
  }
  return n;
}

/** Count crossings between a candidate and a single committed route. */
function countCrossingsBetween(a: CommittedRoute, b: CommittedRoute): number {
  if (!a.isBezier && !b.isBezier) {
    return countHVCrossings(a.hSegs, a.vSegs, b.hSegs, b.vSegs);
  }
  return countPolylineCrossings(a.points, b.points);
}

/** Total crossing score for a candidate against all committed routes. */
function crossingScore(
  pts:       readonly Point[],
  hSegs:     readonly HSegment[],
  vSegs:     readonly VSegment[],
  isBezier:  boolean,
  committed: readonly CommittedRoute[],
): number {
  let crossings = 0;
  for (const cr of committed) {
    if (!isBezier && !cr.isBezier) {
      crossings += countHVCrossings(hSegs, vSegs, cr.hSegs, cr.vSegs);
    } else {
      crossings += countPolylineCrossings(pts, cr.points);
    }
  }
  return crossings * W_CROSS;
}

// ─── Cost function components ─────────────────────────────────────────────────

/**
 * Side preference penalty.
 * Ideal source wall faces the target; ideal destination wall faces back.
 * Each step away from ideal costs W_SIDE.
 */
function sidePenalty(
  srcWall:   CardinalSide,
  dstWall:   CardinalSide,
  srcCenter: Point,
  dstCenter: Point,
): number {
  const dx   = dstCenter.x - srcCenter.x;
  const dy   = dstCenter.y - srcCenter.y;
  const absX = Math.abs(dx), absY = Math.abs(dy);

  const idealSrc: CardinalSide =
    absX >= absY ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N');
  const idealDst: CardinalSide =
    absX >= absY ? (dx >= 0 ? 'W' : 'E') : (dy >= 0 ? 'N' : 'S');

  return sideSteps(srcWall, idealSrc) * W_SIDE +
         sideSteps(dstWall, idealDst) * W_SIDE;
}

function sideSteps(wall: CardinalSide, ideal: CardinalSide): number {
  if (wall === ideal) return 0;
  const opp: Record<CardinalSide, CardinalSide> = { N: 'S', S: 'N', E: 'W', W: 'E' };
  return opp[wall] === ideal ? 2 : 1;
}

/**
 * Two-tier port conflict penalty.
 * W_INTER for cross-link vs cross-link conflicts (strongly discouraged).
 * W_INTRA for cross-link vs intra-diagram edge (softer, can be overridden).
 */
function portConflictScore(
  srcKey:   string, srcWall: CardinalSide, srcPt: Point, _srcT: number,
  dstKey:   string, dstWall: CardinalSide, dstPt: Point, _dstT: number,
  committed: readonly CommittedRoute[],
  intraPorts: readonly OccupiedPort[],
  anchors:    NodeAnchorRegistry,
): number {
  let penalty = 0;

  // Cross-link vs cross-link (W_INTER)
  for (const cr of committed) {
    for (const [key, wall, pt] of [
      [cr.srcKey, cr.srcWall, cr.srcPort] as const,
      [cr.dstKey, cr.dstWall, cr.dstPort] as const,
    ]) {
      if (key === srcKey && wall === srcWall) {
        const d = Math.hypot(srcPt.x - pt.x, srcPt.y - pt.y);
        if (d < CONFLICT_RADIUS) penalty += W_INTER * (1 - d / CONFLICT_RADIUS);
      }
      if (key === dstKey && wall === dstWall) {
        const d = Math.hypot(dstPt.x - pt.x, dstPt.y - pt.y);
        if (d < CONFLICT_RADIUS) penalty += W_INTER * (1 - d / CONFLICT_RADIUS);
      }
    }
  }

  // Cross-link vs intra-diagram (W_INTRA)
  for (const ip of intraPorts) {
    const anchor = anchors[ip.nodeKey];
    if (!anchor) continue;
    const ipPt = wallPoint(anchor.bounds, ip.wall, ip.t);
    if (ip.nodeKey === srcKey && ip.wall === srcWall) {
      const d = Math.hypot(srcPt.x - ipPt.x, srcPt.y - ipPt.y);
      if (d < CONFLICT_RADIUS) penalty += W_INTRA * (1 - d / CONFLICT_RADIUS);
    }
    if (ip.nodeKey === dstKey && ip.wall === dstWall) {
      const d = Math.hypot(dstPt.x - ipPt.x, dstPt.y - ipPt.y);
      if (d < CONFLICT_RADIUS) penalty += W_INTRA * (1 - d / CONFLICT_RADIUS);
    }
  }

  return penalty;
}

/** Flat penalty per short jog segment (orthogonal only). */
function alignPenalty(pts: readonly Point[]): number {
  let p = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < SNAP_THRESHOLD) p += W_ALIGN;
  }
  return p;
}

// ─── Port alignment snap ──────────────────────────────────────────────────────

function snapAlignment(
  ss: CardinalSide, sp: Point,
  ds: CardinalSide, dp: Point,
): { srcPort: Point; dstPort: Point } {
  const sH = ss === 'E' || ss === 'W', dH = ds === 'E' || ds === 'W';
  if (sH && dH && Math.abs(sp.y - dp.y) < SNAP_THRESHOLD) {
    const avgY = (sp.y + dp.y) / 2;
    return { srcPort: { x: sp.x, y: avgY }, dstPort: { x: dp.x, y: avgY } };
  }
  const sV = ss === 'N' || ss === 'S', dV = ds === 'N' || ds === 'S';
  if (sV && dV && Math.abs(sp.x - dp.x) < SNAP_THRESHOLD) {
    const avgX = (sp.x + dp.x) / 2;
    return { srcPort: { x: avgX, y: sp.y }, dstPort: { x: avgX, y: dp.y } };
  }
  return { srcPort: sp, dstPort: dp };
}

// ─── Pass 0: Shared-endpoint port pre-assignment ─────────────────────────────

/**
 * For every (node, wall) pair that has 2+ cross-links touching it, assign
 * evenly-spaced t values sorted by the angular position of the OTHER endpoint
 * along the wall's tangent direction.
 *
 * Invariant: if two routes share a node wall, their t values are ordered the
 * same way as the spatial positions of their other endpoints — so the routes
 * form a non-crossing fan at the shared node, eliminating the need for repair.
 */
function preAssignSharedPorts(
  links:   readonly CrossLink[],
  anchors: NodeAnchorRegistry,
): Map<number, PortHint> {
  const key = (addr: { cellPath: readonly string[]; nodeId: string }) =>
    [...addr.cellPath, addr.nodeId].join('.');

  // Step 1: determine ideal wall for each endpoint
  const walls: Array<{ srcWall: CardinalSide; dstWall: CardinalSide }> = links.map(link => {
    const sa = anchors[key(link.from)];
    const da = anchors[key(link.to)];
    if (!sa || !da) return { srcWall: 'E' as CardinalSide, dstWall: 'W' as CardinalSide };
    const sc = rectCenter(sa.bounds), dc = rectCenter(da.bounds);
    return {
      srcWall: link.exitWall  ?? idealSrcWall(sc, dc),
      dstWall: link.entryWall ?? idealDstWall(sc, dc),
    };
  });

  // Step 2: group by (nodeKey, wall)
  type Entry = { linkIdx: number; isSource: boolean; tangentKey: number };
  const groups = new Map<string, Entry[]>();

  for (let i = 0; i < links.length; i++) {
    const link    = links[i]!;
    const srcKey  = key(link.from);
    const dstKey  = key(link.to);
    const sa      = anchors[srcKey];
    const da      = anchors[dstKey];
    if (!sa || !da) continue;

    const { srcWall, dstWall } = walls[i]!;
    const sc = rectCenter(sa.bounds), dc = rectCenter(da.bounds);

    // tangent key = position of the OTHER endpoint along the wall's tangent axis
    // N/S walls run horizontally → sort by x; E/W walls run vertically → sort by y
    const srcTK = (srcWall === 'N' || srcWall === 'S') ? dc.x : dc.y;
    const dstTK = (dstWall === 'N' || dstWall === 'S') ? sc.x : sc.y;

    const sg = `${srcKey}:${srcWall}`;
    const dg = `${dstKey}:${dstWall}`;
    if (!groups.has(sg)) groups.set(sg, []);
    if (!groups.has(dg)) groups.set(dg, []);
    groups.get(sg)!.push({ linkIdx: i, isSource: true,  tangentKey: srcTK });
    groups.get(dg)!.push({ linkIdx: i, isSource: false, tangentKey: dstTK });
  }

  // Step 3: assign evenly-spaced t values along each wall.
  //   - Groups with 2+ members always fan (non-crossing arrival/departure order).
  //   - A single link that is USER-PINNED to a wall still gets a slot so it
  //     lands at the wall midpoint (1/(1+1)); this is the fan formula degenerating
  //     to centre, NOT a hardcoded 0.5. Two pinned links → 1/3, 2/3, and so on.
  //   - A single AUTO link keeps its cost-search freedom (no hint emitted).
  const result = new Map<number, PortHint>();

  for (const [groupKey, members] of groups) {
    const wall = groupKey.split(':').at(-1) as CardinalSide;
    const pinnedHere = members.filter(m => {
      const l = links[m.linkIdx]!;
      return m.isSource ? l.exitWall === wall : l.entryWall === wall;
    });

    // Which members actually get fanned on this wall.
    // If any link is pinned here, only the pinned links share the wall slots
    // (auto links keep searching). Otherwise fan the whole group when 2+.
    const fanned = pinnedHere.length > 0 ? pinnedHere : members;
    if (fanned.length < 2 && pinnedHere.length === 0) continue;

    fanned.sort((a, b) => a.tangentKey - b.tangentKey);
    const n = fanned.length;

    for (let k = 0; k < n; k++) {
      const { linkIdx, isSource } = fanned[k]!;
      const t = (k + 1) / (n + 1);
      const ex = result.get(linkIdx) ?? {};
      result.set(linkIdx, isSource
        ? { ...ex, srcWall: wall, srcT: t }
        : { ...ex, dstWall: wall, dstT: t },
      );
    }
  }

  return result;
}

/** Centre of a bounding rect. */
function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Ideal exit wall on the source node when routing toward dst. */
function idealSrcWall(sc: Point, dc: Point): CardinalSide {
  const dx = dc.x - sc.x, dy = dc.y - sc.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N');
}

/** Ideal entry wall on the destination node (opposite of idealSrcWall). */
function idealDstWall(sc: Point, dc: Point): CardinalSide {
  const opp: Record<CardinalSide, CardinalSide> = { N: 'S', S: 'N', E: 'W', W: 'E' };
  return opp[idealSrcWall(sc, dc)];
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * Point at fraction t (0=wall start, 1=wall end) along a node wall.
 * N/S: t=0 is left edge, t=1 is right edge.
 * E/W: t=0 is top edge, t=1 is bottom edge.
 */
function wallPoint(bounds: Rect, wall: CardinalSide, t: number): Point {
  const { x, y, width: w, height: h } = bounds;
  switch (wall) {
    case 'N': return { x: x + w * t, y };
    case 'S': return { x: x + w * t, y: y + h };
    case 'W': return { x, y: y + h * t };
    case 'E': return { x: x + w, y: y + h * t };
  }
}

/** Sample n+1 points along a cubic bezier. */
function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, t2 = t * t, t3 = t2 * t;
    const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
    pts.push({
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    });
  }
  return pts;
}

/** For bezier WorkingRoute: return sampled curve pts; otherwise return raw pts. */
function sampledPts(wr: WorkingRoute): Point[] {
  if (wr.isBezier && wr.points.length === 4) {
    return sampleCubicBezier(wr.points[0]!, wr.points[1]!, wr.points[2]!, wr.points[3]!, 12);
  }
  return wr.points;
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

function pathLen(pts: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

function pointAtFrac(pts: readonly Point[], t: number): Point {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    lens.push(l); total += l;
  }
  if (total === 0) return pts[0]!;
  let acc = 0;
  const target = total * Math.min(Math.max(t, 0), 1);
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]!;
    if (acc + l >= target) {
      const frac = l > 0 ? (target - acc) / l : 0;
      const a = pts[i]!, b = pts[i + 1]!;
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
    acc += l;
  }
  return pts[pts.length - 1]!;
}

function dominantSegment(pts: readonly Point[]): { axis: 'h' | 'v'; coord: number } {
  let bestLen = 0, axis: 'h' | 'v' = 'h', coord = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
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
 * Pick the anchor point for an edge label. Prefers the midpoint of the longest
 * HORIZONTAL segment (labels are horizontal text and read best along a
 * horizontal run), and only falls back to the longest segment overall when the
 * route has no meaningful horizontal segment (e.g. a pure vertical link).
 */
function labelAnchor(pts: readonly Point[]): Point {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;
  let bestH = -1;
  let hMid: Point | null = null;
  let bestAny = -1;
  let anyMid: Point = pts[0]!;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    const len = Math.hypot(dx, dy);
    if (len > bestAny) {
      bestAny = len;
      anyMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    if (dx > dy && dx > bestH) {
      bestH = dx;
      hMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return hMid ?? anyMid;
}

function edgeStyleToDash(style: string | undefined): string | undefined {
  if (style === 'dashed') return '8 4';
  if (style === 'dotted') return '3 4';
  return undefined;
}

// ─── Post-route: border nudging ───────────────────────────────────────────────

function nudgeOffBorders(routes: WorkingRoute[], borders: readonly Rect[]): void {
  const TOLERANCE = 3, NUDGE = 8;
  const hBorderYs = borders.filter(b => b.width > b.height).map(b => b.y + b.height / 2);
  const vBorderXs = borders.filter(b => b.height >= b.width).map(b => b.x + b.width / 2);

  for (const route of routes) {
    if (route.isBezier) continue;
    const pts = route.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      if (Math.abs(b.y - a.y) < 1 && Math.abs(b.x - a.x) > 1) {
        for (const borderY of hBorderYs) {
          if (Math.abs(a.y - borderY) < TOLERANCE) {
            const midY = (Math.min(...pts.map(p => p.y)) + Math.max(...pts.map(p => p.y))) / 2;
            const nd = a.y < midY ? -NUDGE : NUDGE;
            pts[i] = { x: a.x, y: a.y + nd }; pts[i + 1] = { x: b.x, y: b.y + nd }; break;
          }
        }
      } else if (Math.abs(b.x - a.x) < 1 && Math.abs(b.y - a.y) > 1) {
        for (const borderX of vBorderXs) {
          if (Math.abs(a.x - borderX) < TOLERANCE) {
            const midX = (Math.min(...pts.map(p => p.x)) + Math.max(...pts.map(p => p.x))) / 2;
            const nd = a.x < midX ? -NUDGE : NUDGE;
            pts[i] = { x: a.x + nd, y: a.y }; pts[i + 1] = { x: b.x + nd, y: b.y }; break;
          }
        }
      }
    }
  }
}

// ─── Post-route: channel separation ──────────────────────────────────────────

function separateChannels(routes: WorkingRoute[]): void {
  interface Seg {
    ri: number; si: number; isV: boolean; coord: number; lo: number; hi: number;
  }
  const segs: Seg[] = [];
  for (let ri = 0; ri < routes.length; ri++) {
    if (routes[ri]!.isBezier) continue;
    const pts = routes[ri]!.points;
    for (let si = 0; si < pts.length - 1; si++) {
      const a = pts[si]!, b = pts[si + 1]!;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      if (dx < 1 && dy > 1) {
        segs.push({ ri, si, isV: true,  coord: (a.x + b.x) / 2, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
      } else if (dy < 1 && dx > 1) {
        segs.push({ ri, si, isV: false, coord: (a.y + b.y) / 2, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
      }
    }
  }

  const COORD_TOL = 10;
  const used = new Set<number>();
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    const si = segs[i]!;
    const group = [i];
    for (let j = i + 1; j < segs.length; j++) {
      if (used.has(j)) continue;
      const sj = segs[j]!;
      if (sj.isV !== si.isV) continue;
      if (Math.abs(sj.coord - si.coord) > COORD_TOL) continue;
      if (sj.hi - si.lo > 8 && si.hi - sj.lo > 8) { group.push(j); used.add(j); }
    }
    used.add(i);
    if (group.length < 2) continue;
    const n = group.length;
    for (let k = 0; k < n; k++) {
      const seg = segs[group[k]!]!;
      const offset = (k - (n - 1) / 2) * CHANNEL_GAP;
      const pts = routes[seg.ri]!.points;
      if (seg.isV) {
        pts[seg.si]     = { x: pts[seg.si]!.x     + offset, y: pts[seg.si]!.y };
        pts[seg.si + 1] = { x: pts[seg.si + 1]!.x + offset, y: pts[seg.si + 1]!.y };
      } else {
        pts[seg.si]     = { x: pts[seg.si]!.x,     y: pts[seg.si]!.y     + offset };
        pts[seg.si + 1] = { x: pts[seg.si + 1]!.x, y: pts[seg.si + 1]!.y + offset };
      }
    }
  }
}

// ─── Label de-collision ───────────────────────────────────────────────────────

function deCollideLabels(
  labelRects: Array<{ x: number; y: number; width: number; height: number }>,
  fixedRects: readonly Rect[],
): void {
  const MAX_PASSES = 20, NUDGE = 2;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (const lr of labelRects) {
      for (const fr of fixedRects) {
        if (!rectsOverlap(lr, fr)) continue;
        const ox = Math.min(lr.x + lr.width,  fr.x + fr.width)  - Math.max(lr.x, fr.x);
        const oy = Math.min(lr.y + lr.height, fr.y + fr.height) - Math.max(lr.y, fr.y);
        if (ox <= oy) {
          lr.x = (lr.x + lr.width / 2) <= (fr.x + fr.width / 2) ? fr.x - lr.width - NUDGE : fr.x + fr.width + NUDGE;
        } else {
          lr.y = (lr.y + lr.height / 2) <= (fr.y + fr.height / 2) ? fr.y - lr.height - NUDGE : fr.y + fr.height + NUDGE;
        }
        moved = true;
      }
    }
    for (let i = 0; i < labelRects.length; i++) {
      for (let j = i + 1; j < labelRects.length; j++) {
        const a = labelRects[i]!, b = labelRects[j]!;
        if (!rectsOverlap(a, b)) continue;
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (a.y + a.height / 2 <= b.y + b.height / 2) {
          a.y -= oy / 2 + NUDGE; b.y += oy / 2 + NUDGE;
        } else {
          a.y += oy / 2 + NUDGE; b.y -= oy / 2 + NUDGE;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width  && a.x + a.width  > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}
