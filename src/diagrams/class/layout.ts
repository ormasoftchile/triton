/**
 * @file diagrams/class/layout.ts — UML class diagram.
 *
 * Classes render as three-compartment boxes (name/stereotype, attributes,
 * methods); placement uses the shared layered kernel (inheritance points up).
 * Relationships draw as straight connectors clipped to box borders with
 * UML end markers (triangle / diamond / arrow) plus cardinality + labels.
 */

import type { ClassDocument, ClassBox, RelEnd } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { measureText } from '../../text/metrics.js';
import { layeredLayout, routeEdge, type GraphNode, type GraphEdge, type NodeBox } from '../../graph/layered.js';
import { borderPoint } from '../../graph/connect.js';
import { rhu, rhuInt } from '../../util/round.js';

// ── Skip-edge routing helpers (module-level) ───────────────────────────────

/** Axis-aligned segment stored as an inflated rect for overlap detection. */
interface RoutedSegment {
  x1: number; y1: number;   // top-left
  x2: number; y2: number;   // bottom-right (x2 >= x1, y2 >= y1)
}

/** A scored routing candidate carrying full path geometry for one wall-pair strategy. */
interface RouteCandidate {
  strategy: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  laneX:    number;
  segments: Array<[number, number, number, number]>;
  labelMid: { x: number; y: number };
  isMixed:  boolean;  // true for D, E, F — wall-pair penalty applies
}

/** True if axis-aligned segment (x1,y1)→(x2,y2) passes through box interior. */
function segmentIntersectsBox(
  x1: number, y1: number, x2: number, y2: number,
  box: NodeBox,
): boolean {
  const bx1 = box.x, bx2 = box.x + box.width;
  const by1 = box.y, by2 = box.y + box.height;
  if (y1 === y2) {
    const lx = Math.min(x1, x2), rx = Math.max(x1, x2);
    return y1 > by1 && y1 < by2 && lx < bx2 && rx > bx1;
  }
  const ty = Math.min(y1, y2), by = Math.max(y1, y2);
  return x1 > bx1 && x1 < bx2 && ty < by2 && by > by1;
}

/** Convert a segment to a 2px-wide axis-aligned rect. */
function toRect(x1: number, y1: number, x2: number, y2: number): RoutedSegment {
  const W = 1;
  return {
    x1: Math.min(x1, x2) - W, y1: Math.min(y1, y2) - W,
    x2: Math.max(x1, x2) + W, y2: Math.max(y1, y2) + W,
  };
}

/** Returns the shared axis length between two RoutedSegment rects. */
function rectsOverlapLength(a: RoutedSegment, b: RoutedSegment): number {
  const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (ox <= 0 || oy <= 0) return 0;
  return Math.max(ox, oy);
}

const CLEARANCE = 12;

// ── Port-assignment helpers (module-level) ─────────────────────────────────

type Wall = 'top' | 'bottom' | 'left' | 'right';

const MIN_PORT_GAP = 32;
const WALL_MARGIN  = 16;

/**
 * Cascade algorithm: given N ideal positions (pre-sorted ascending) in [lo, hi],
 * return N positions that respect minGap while staying as close to ideals as possible.
 * Falls back to even distribution when the required span exceeds the available space.
 */
function cascadePorts(ideals: number[], lo: number, hi: number, minGap: number): number[] {
  const n = ideals.length;
  if (n === 0) return [];
  if (n === 1) return [Math.max(lo, Math.min(hi, ideals[0]!))];
  if ((n - 1) * minGap > hi - lo) {
    const step = (hi - lo) / (n + 1);
    return Array.from({ length: n }, (_, i) => lo + step * (i + 1));
  }
  const pos = ideals.map(v => Math.max(lo, Math.min(hi, v)));
  for (let iter = 0; iter < 5; iter++) {
    let changed = false;
    for (let i = 1; i < n; i++) {
      const minI = pos[i - 1]! + minGap;
      if (pos[i]! < minI) { pos[i] = minI; changed = true; }
    }
    for (let i = n - 1; i >= 0; i--) {
      const maxI = i === n - 1 ? hi : pos[i + 1]! - minGap;
      if (pos[i]! > maxI) { pos[i] = maxI; changed = true; }
    }
    if (pos[0]! < lo) { pos[0] = lo; changed = true; }
    if (!changed) break;
  }
  return pos;
}

/**
 * Compute port points for one (box, wall) group of edges.
 * Edges are sorted by their opposite-end node centre along the wall axis
 * (crossing-minimisation), then spread via cascade to enforce MIN_PORT_GAP.
 * Returns Map<relationIndex, {x,y}>.
 */
function assignGroupPorts(
  box: NodeBox,
  wall: Wall,
  group: Array<{ ri: number; sourceCenter: number }>,
  yOff: number,
): Map<number, { x: number; y: number }> {
  const result = new Map<number, { x: number; y: number }>();
  if (group.length === 0) return result;

  const sorted = [...group].sort((a, b) => a.sourceCenter - b.sourceCenter);

  let wallBase: number, wallLen: number, fixedCoord: number, isHorizontal: boolean;
  switch (wall) {
    case 'top':
      wallBase = box.x; wallLen = box.width; fixedCoord = box.y + yOff; isHorizontal = true; break;
    case 'bottom':
      wallBase = box.x; wallLen = box.width; fixedCoord = box.y + yOff + box.height; isHorizontal = true; break;
    case 'left':
      wallBase = box.y + yOff; wallLen = box.height; fixedCoord = box.x; isHorizontal = false; break;
    default: // 'right'
      wallBase = box.y + yOff; wallLen = box.height; fixedCoord = box.x + box.width; isHorizontal = false; break;
  }

  const lo = wallBase + WALL_MARGIN;
  const hi = wallBase + wallLen - WALL_MARGIN;
  const ideals = sorted.map(e => Math.max(lo, Math.min(hi, e.sourceCenter)));
  const positions = cascadePorts(ideals, lo, hi, MIN_PORT_GAP);

  for (let i = 0; i < sorted.length; i++) {
    const p = positions[i]!;
    result.set(sorted[i]!.ri, isHorizontal ? { x: p, y: fixedCoord } : { x: fixedCoord, y: p });
  }
  return result;
}

export function layoutClass(ir: ClassDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const memFont = typography.smallFontSize;
  const nameFont = typography.baseFontSize;
  const lineH = rhuInt(memFont * 1.6);
  const headH = rhuInt(nameFont * 1.6);

  // ── Box sizing ─────────────────────────────────────────────────────────────
  const sizeOf = (c: ClassBox): { w: number; h: number; attrH: number } => {
    const texts = [c.name, ...(c.stereotype ? [`«${c.stereotype}»`] : []), ...c.attributes.map(m => m.text), ...c.methods.map(m => m.text)];
    const w = Math.max(130, ...texts.map(t => measureText(t, memFont).width + 24));
    const stereoH = c.stereotype ? memFont + 4 : 0;
    const attrH = c.attributes.length * lineH + 8;
    const methH = c.methods.length * lineH + 8;
    const h = headH + stereoH + attrH + methH;
    return { w, h, attrH: headH + stereoH + attrH };
  };
  const sizes = new Map(ir.classes.map(c => [c.name, sizeOf(c)]));

  const nodes: GraphNode[] = ir.classes.map(c => ({ id: c.name, width: sizes.get(c.name)!.w, height: sizes.get(c.name)!.h }));
  const edges: GraphEdge[] = ir.relations.map(r =>
    r.leftHead === 'triangle' ? { from: r.right, to: r.left } : { from: r.left, to: r.right });
  const LAYER_GAP = 64;
  const laid = layeredLayout(nodes, edges, { direction: 'TB', layerGap: LAYER_GAP, nodeGap: 46, margin });

  const canvasWidth  = laid.width + margin * 2;
  const allRealBoxes = [...laid.boxes.values()];

  // Segment registry: updated after each skip edge is routed.
  const routedSegments: RoutedSegment[] = [];

  // Real-node x-centre values, deduplicated and sorted.
  const realColumnXs = [...new Set(
    allRealBoxes.map(b => b.x + b.width / 2)
  )].sort((a, b) => a - b);

  // Midpoint between each adjacent pair of real-node columns.
  const interColMidpoints: number[] = [];
  for (let ci = 0; ci < realColumnXs.length - 1; ci++) {
    interColMidpoints.push((realColumnXs[ci]! + realColumnXs[ci + 1]!) / 2);
  }

  /**
   * Score a candidate lane x for a skip edge.
   * Lower score = better. Returns Infinity if the candidate is out-of-bounds.
   */
  function scoreLane(
    laneX:           number,
    segments:        Array<[number, number, number, number]>,
    interBoxes:      NodeBox[],
    routed:          RoutedSegment[],
    canvasW:         number,
    realMinX:        number,
    wallPairPenalty: number = 0,
    sameWallBonus:   number = 0,
  ): number {
    if (laneX < 0 || laneX > canvasW) return Infinity;

    let pathLength  = 0;
    let segCount    = segments.length;
    let boxHits     = 0;
    let overlapHits = 0;

    for (const [x1, y1, x2, y2] of segments) {
      const dx = x2 - x1, dy = y2 - y1;
      pathLength += Math.sqrt(dx * dx + dy * dy);

      for (const nb of interBoxes) {
        if (segmentIntersectsBox(x1, y1, x2, y2, nb)) boxHits++;
      }

      const segRect = toRect(x1, y1, x2, y2);
      for (const rs of routed) {
        if (rectsOverlapLength(segRect, rs) >= 10) overlapHits++;
      }
    }

    const dirPenalty = laneX <= realMinX - CLEARANCE ? 0 : 5;

    // Canvas expansion penalty: proportional to how far left we push the origin.
    const expansionPenalty = laneX < realMinX ? (realMinX - laneX) * 1.0 : 0;

    return (
      0.3   * pathLength  +
      10.0  * segCount    +
      1000  * boxHits     +
      50    * overlapHits +
      dirPenalty          +
      expansionPenalty    +
      wallPairPenalty     -
      sameWallBonus           // bonus for same-wall same-column routing (B/C)
    );
  }

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Relationships (under boxes) ────────────────────────────────────────────
  const allBoxes = [...laid.boxes.values()];

  const approachWall = (from: NodeBox, to: NodeBox): Wall => {
    if (from.y + from.height <= to.y) return 'top';
    if (to.y + to.height     <= from.y) return 'bottom';
    const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
    const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
    if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'top' : 'bottom';
    return dx >= 0 ? 'left' : 'right';
  };

  const wallPoint = (box: NodeBox, wall: Wall, t: number, yOff_: number): { x: number; y: number } => {
    const bx = box.x, by = box.y + yOff_, bw = box.width, bh = box.height;
    switch (wall) {
      case 'top':    return { x: bx + t * bw, y: by };
      case 'bottom': return { x: bx + t * bw, y: by + bh };
      case 'left':   return { x: bx,           y: by + t * bh };
      case 'right':  return { x: bx + bw,      y: by + t * bh };
    }
  };

  // ── Port assignment: arrival ports (toPortMap2) ────────────────────────────
  // Group edges by (targetId, wall). Sort each group by source-center along the
  // wall axis → crossing-free order. Spread with cascade to enforce MIN_PORT_GAP.
  // All edges (including skip edges) participate so ports are always separated.
  // For skip edges, use laneX as the ideal arrival position so cascade sees a
  // distinct ideal and doesn't tie with direct-edge ideals.
  const toGroupAccum = new Map<string, Array<{ ri: number; sourceCenter: number }>>();
  for (let ri = 0; ri < ir.relations.length; ri++) {
    const r = ir.relations[ri]!;
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;
    const wall = approachWall(a, b);
    const key = `${b.id}:${wall}`;
    const bends = laid.edgeBends.get(ri);
    const sourceCenter = (wall === 'top' || wall === 'bottom')
      ? (bends && bends.length > 0 ? bends[0]!.x : a.x + a.width / 2)
      : a.y + a.height / 2 + yOff;
    if (!toGroupAccum.has(key)) toGroupAccum.set(key, []);
    toGroupAccum.get(key)!.push({ ri, sourceCenter });
  }
  const toPortMap2 = new Map<string, Map<number, { x: number; y: number }>>();
  for (const [key, group] of toGroupAccum) {
    const nodeId = key.split(':')[0]!;
    const wall = key.split(':')[1] as Wall;
    toPortMap2.set(key, assignGroupPorts(laid.boxes.get(nodeId)!, wall, group, yOff));
  }

  // ── Port assignment: departure ports (fromPortMap2) ────────────────────────
  // Departure wall of A toward B = approachWall(b, a). Sort by target-center.
  // For skip edges, use laneX as the ideal departure position so cascade sees a
  // distinct ideal and doesn't tie with direct-edge ideals.
  const fromGroupAccum = new Map<string, Array<{ ri: number; sourceCenter: number }>>();
  for (let ri = 0; ri < ir.relations.length; ri++) {
    const r = ir.relations[ri]!;
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;
    const wall = approachWall(b, a);
    const key = `${a.id}:${wall}`;
    const bends = laid.edgeBends.get(ri);
    const targetCenter = (wall === 'top' || wall === 'bottom')
      ? (bends && bends.length > 0 ? bends[0]!.x : b.x + b.width / 2)
      : b.y + b.height / 2 + yOff;
    if (!fromGroupAccum.has(key)) fromGroupAccum.set(key, []);
    fromGroupAccum.get(key)!.push({ ri, sourceCenter: targetCenter });
  }
  const fromPortMap2 = new Map<string, Map<number, { x: number; y: number }>>();
  for (const [key, group] of fromGroupAccum) {
    const nodeId = key.split(':')[0]!;
    const wall = key.split(':')[1] as Wall;
    fromPortMap2.set(key, assignGroupPorts(laid.boxes.get(nodeId)!, wall, group, yOff));
  }

  // Arrowhead direction: point just outside the wall in the edge's travel direction.
  const wallDir = (wall: Wall, pt: { x: number; y: number }): { x: number; y: number } => {
    switch (wall) {
      case 'top':    return { x: pt.x,     y: pt.y - 1 };
      case 'bottom': return { x: pt.x,     y: pt.y + 1 };
      case 'left':   return { x: pt.x - 1, y: pt.y     };
      case 'right':  return { x: pt.x + 1, y: pt.y     };
    }
  };

  for (let ri = 0; ri < ir.relations.length; ri++) {
    const r = ir.relations[ri]!;
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;

    // Arrival port: cascade-assigned position on target wall.
    const toWall = approachWall(a, b);
    const toPt = toPortMap2.get(`${b.id}:${toWall}`)?.get(ri) ?? wallPoint(b, toWall, 0.5, yOff);

    // Departure port: cascade-assigned position on source wall, aimed at toPt.
    const fromWall = approachWall(b, a);
    const fromPt = fromPortMap2.get(`${a.id}:${fromWall}`)?.get(ri)
      ?? borderPoint({ ...a, y: a.y + yOff }, toPt.x, toPt.y);

    const bends = laid.edgeBends.get(ri);
    let safePath: string;
    let labelMid: { x: number; y: number };
    let skipEdgeLateralStrategy = false;
    let effectiveFromPt: { x: number; y: number } = fromPt;
    let effectiveFromWall: Wall = fromWall;
    let effectiveToPt: { x: number; y: number } = toPt;
    let effectiveToWall: Wall = toWall;

    if (bends && bends.length > 0) {
      // ── Build candidate lane x positions ──────────────────────────────────
      const srcLayerY = a.y;
      const tgtLayerY = b.y;
      const minY = Math.min(srcLayerY, tgtLayerY);
      const maxY = Math.max(srcLayerY, tgtLayerY);
      const interBoxes = allRealBoxes.filter(nb => {
        const cy = nb.y + nb.height / 2;
        return cy > minY && cy < maxY;
      });

      // Seed from BK sweeps: the 4 per-dummy x values from the first dummy in chain
      const firstDummyId = laid.dummyChainIds.get(ri)?.[0] ?? null;
      const sweepCandidates: number[] = firstDummyId
        ? (laid.dummySweepXs.get(firstDummyId) ?? [])
        : [];

      const rightMarginX = Math.max(...allRealBoxes.map(b => b.x + b.width)) + CLEARANCE;
      const sourceX      = fromPt.x;
      const realMinX     = Math.min(...allRealBoxes.map(b => b.x));

      // ── Compute route for each candidate ──────────────────────────────────
      const exitY  = bends[0]!.y + yOff;
      const entryY = toPt.y - LAYER_GAP / 2;

      // Adaptive left-margin: push far enough left that horizontal segments at
      // exitY and entryY clear ALL intermediate boxes.
      // safeX = min(fromPt.x, toPt.x) - max(intermediate box right edge that
      // would be crossed by a horizontal from laneX to fromPt.x) - CLEARANCE.
      // Equivalently: laneX must satisfy laneX < min(interBox.left) for all
      // interBoxes whose y range overlaps exitY or entryY.
      const blockingAtExit  = interBoxes.filter(b => exitY  > b.y && exitY  < b.y + b.height);
      const blockingAtEntry = interBoxes.filter(b => entryY > b.y && entryY < b.y + b.height);
      const allBlocking     = [...blockingAtExit, ...blockingAtEntry];

      const adaptiveLeftX = allBlocking.length > 0
        ? Math.min(...allBlocking.map(b => b.x)) - CLEARANCE
        : realMinX - CLEARANCE;

      const candidates_A: number[] = [
        ...sweepCandidates,
        adaptiveLeftX,
        rightMarginX,
        sourceX,
        ...interColMidpoints,
      ];

      // ── Mid-wall port coords for non-A strategies ──────────────────────────
      const srcMidY_  = a.y  + a.height  / 2 + yOff;
      const tgtMidY_  = b.y  + b.height  / 2 + yOff;
      const srcLeft_  = a.x;
      const srcRight_ = a.x  + a.width;
      const tgtLeft_  = b.x;
      const tgtRight_ = b.x  + b.width;

      // Extended blocking set: covers B/C/D/E/F horizontal segments that may
      // hit boxes at srcMidY or tgtMidY rows outside the strict inter-layer band.
      const interBoxesExt = allRealBoxes.filter(nb => {
        const cy = nb.y + nb.height / 2;
        return cy > a.y && cy < b.y + b.height && nb.id !== a.id && nb.id !== b.id;
      });

      // Adaptive left-margin for B/D strategies (left-side lanes)
      const blockingBD = allRealBoxes.filter(nb => {
        const ny = nb.y, nh = nb.height;
        return (srcMidY_ > ny && srcMidY_ < ny + nh) || (tgtMidY_ > ny && tgtMidY_ < ny + nh);
      });
      const adaptiveLeftX_BD = blockingBD.length > 0
        ? Math.min(...blockingBD.map(nb => nb.x)) - CLEARANCE
        : realMinX - CLEARANCE;

      // Adaptive right-margin for C/E strategies (right-side lanes)
      const adaptiveRightX_CE = blockingBD.length > 0
        ? Math.max(...blockingBD.map(nb => nb.x + nb.width)) + CLEARANCE
        : rightMarginX;

      // Adaptive left-margin for F strategy (checks exitY and tgtMidY rows)
      const blockingF = allRealBoxes.filter(nb => {
        return (exitY   > nb.y && exitY   < nb.y + nb.height) ||
               (tgtMidY_ > nb.y && tgtMidY_ < nb.y + nb.height);
      });
      const adaptiveLeftX_F = blockingF.length > 0
        ? Math.min(...blockingF.map(nb => nb.x)) - CLEARANCE
        : realMinX - CLEARANCE;

      // ── Segment builder functions ──────────────────────────────────────────
      function buildSegmentsA(laneX: number): Array<[number, number, number, number]> {
        const fx = fromPt.x, fy = fromPt.y;
        const tx = toPt.x,   ty = toPt.y;
        if (Math.abs(laneX - fx) < 1 && Math.abs(laneX - tx) < 1) {
          return [[fx, fy, tx, ty]];
        }
        return [
          [fx,    fy,     fx,    exitY  ],
          [fx,    exitY,  laneX, exitY  ],
          [laneX, exitY,  laneX, entryY ],
          [laneX, entryY, tx,    entryY ],
          [tx,    entryY, tx,    ty     ],
        ];
      }

      function buildSegmentsB(laneX: number): Array<[number, number, number, number]> {
        return [
          [srcLeft_,  srcMidY_, laneX,    srcMidY_],
          [laneX,     srcMidY_, laneX,    tgtMidY_],
          [laneX,     tgtMidY_, tgtLeft_, tgtMidY_],
        ];
      }

      function buildSegmentsC(laneX: number): Array<[number, number, number, number]> {
        return [
          [srcRight_,  srcMidY_, laneX,     srcMidY_],
          [laneX,      srcMidY_, laneX,     tgtMidY_],
          [laneX,      tgtMidY_, tgtRight_, tgtMidY_],
        ];
      }

      function buildSegmentsD(laneX: number): Array<[number, number, number, number]> {
        return [
          [srcLeft_, srcMidY_, laneX,  srcMidY_],
          [laneX,    srcMidY_, laneX,  entryY  ],
          [laneX,    entryY,   toPt.x, entryY  ],
          [toPt.x,   entryY,   toPt.x, toPt.y  ],
        ];
      }

      function buildSegmentsE(laneX: number): Array<[number, number, number, number]> {
        return [
          [srcRight_, srcMidY_, laneX,  srcMidY_],
          [laneX,     srcMidY_, laneX,  entryY  ],
          [laneX,     entryY,   toPt.x, entryY  ],
          [toPt.x,    entryY,   toPt.x, toPt.y  ],
        ];
      }

      function buildSegmentsF(laneX: number): Array<[number, number, number, number]> {
        return [
          [fromPt.x, fromPt.y, fromPt.x, exitY   ],
          [fromPt.x, exitY,    laneX,    exitY   ],
          [laneX,    exitY,    laneX,    tgtMidY_],
          [laneX,    tgtMidY_, tgtLeft_, tgtMidY_],
        ];
      }

      // ── Build flat candidate list from all strategies ──────────────────────
      const allCandidates: RouteCandidate[] = [];

      for (const laneX of candidates_A) {
        allCandidates.push({
          strategy: 'A', laneX, isMixed: false,
          segments: buildSegmentsA(laneX),
          labelMid: { x: laneX, y: (exitY + entryY) / 2 },
        });
      }

      const laneXsB = [adaptiveLeftX_BD, realMinX - CLEARANCE, ...sweepCandidates]
        .filter(x => x < Math.min(srcLeft_, tgtLeft_));
      for (const laneX of laneXsB) {
        allCandidates.push({
          strategy: 'B', laneX, isMixed: false,
          segments: buildSegmentsB(laneX),
          labelMid: { x: laneX, y: (srcMidY_ + tgtMidY_) / 2 },
        });
      }

      const laneXsC = [adaptiveRightX_CE, rightMarginX, ...sweepCandidates]
        .filter(x => x > Math.max(srcRight_, tgtRight_));
      for (const laneX of laneXsC) {
        allCandidates.push({
          strategy: 'C', laneX, isMixed: false,
          segments: buildSegmentsC(laneX),
          labelMid: { x: laneX, y: (srcMidY_ + tgtMidY_) / 2 },
        });
      }

      const laneXsD = [adaptiveLeftX_BD, realMinX - CLEARANCE, ...sweepCandidates]
        .filter(x => x < srcLeft_);
      for (const laneX of laneXsD) {
        allCandidates.push({
          strategy: 'D', laneX, isMixed: true,
          segments: buildSegmentsD(laneX),
          labelMid: { x: laneX, y: (srcMidY_ + entryY) / 2 },
        });
      }

      const laneXsE = [adaptiveRightX_CE, rightMarginX, ...sweepCandidates]
        .filter(x => x > srcRight_);
      for (const laneX of laneXsE) {
        allCandidates.push({
          strategy: 'E', laneX, isMixed: true,
          segments: buildSegmentsE(laneX),
          labelMid: { x: laneX, y: (srcMidY_ + entryY) / 2 },
        });
      }

      const laneXsF = [adaptiveLeftX_F, realMinX - CLEARANCE, ...sweepCandidates]
        .filter(x => x < tgtLeft_);
      for (const laneX of laneXsF) {
        allCandidates.push({
          strategy: 'F', laneX, isMixed: true,
          segments: buildSegmentsF(laneX),
          labelMid: { x: laneX, y: (exitY + tgtMidY_) / 2 },
        });
      }

      // ── Score all candidates and pick best ────────────────────────────────
      let bestScore     = Infinity;
      let bestCandidate: RouteCandidate = allCandidates[0] ?? {
        strategy: 'A', laneX: bends[0]!.x, isMixed: false,
        segments: buildSegmentsA(bends[0]!.x),
        labelMid: { x: bends[0]!.x, y: (exitY + entryY) / 2 },
      };

      for (const c of allCandidates) {
        // Same-wall bonus: Strategy B (left→left) and C (right→right) are
        // the canonical routing style for skip edges in the same column.
        // 20-point bonus ensures they win over A when geometry is clean.
        const sameWallBonus = (c.strategy === 'B' || c.strategy === 'C') ? 20 : 0;
        const score = scoreLane(
          c.laneX, c.segments, interBoxesExt, routedSegments,
          canvasWidth, realMinX,
          c.isMixed ? 2.0 : 0,
          sameWallBonus,
        );
        if (score < bestScore) {
          bestScore     = score;
          bestCandidate = c;
        }
      }

      // ── Register winning segments ──────────────────────────────────────────
      for (const [x1, y1, x2, y2] of bestCandidate.segments) {
        routedSegments.push(toRect(x1, y1, x2, y2));
      }
      skipEdgeLateralStrategy = bestCandidate.strategy === 'B' || bestCandidate.strategy === 'C';

      // ── Determine effective port points and walls for arrowheads ──────────
      switch (bestCandidate.strategy) {
        case 'B':
          effectiveFromPt   = { x: srcLeft_,  y: srcMidY_ };
          effectiveFromWall = 'left';
          effectiveToPt     = { x: tgtLeft_,  y: tgtMidY_ };
          effectiveToWall   = 'left';
          break;
        case 'C':
          effectiveFromPt   = { x: srcRight_, y: srcMidY_ };
          effectiveFromWall = 'right';
          effectiveToPt     = { x: tgtRight_, y: tgtMidY_ };
          effectiveToWall   = 'right';
          break;
        case 'D':
          effectiveFromPt   = { x: srcLeft_,  y: srcMidY_ };
          effectiveFromWall = 'left';
          break;
        case 'E':
          effectiveFromPt   = { x: srcRight_, y: srcMidY_ };
          effectiveFromWall = 'right';
          break;
        case 'F':
          effectiveToPt     = { x: tgtLeft_,  y: tgtMidY_ };
          effectiveToWall   = 'left';
          break;
      }

      // ── Render path from winning candidate's segments ─────────────────────
      const segs = bestCandidate.segments;
      if (segs.length === 1) {
        safePath = `M ${rhu(segs[0]![0])} ${rhu(segs[0]![1])} L ${rhu(segs[0]![2])} ${rhu(segs[0]![3])}`;
      } else {
        const pts: string[] = [`M ${rhu(segs[0]![0])} ${rhu(segs[0]![1])}`];
        for (const [,, x2, y2] of segs) {
          pts.push(`L ${rhu(x2)} ${rhu(y2)}`);
        }
        safePath = pts.join(' ');
      }
      labelMid = bestCandidate.labelMid;

      elements.push(p.path(safePath, palette.textMuted, 1.3, r.dashed ? { dash: '6 4' } : {}));

      elements.push(...endMarker(p, effectiveFromPt, wallDir(effectiveFromWall, effectiveFromPt), r.leftHead,  palette));
      elements.push(...endMarker(p, effectiveToPt,   wallDir(effectiveToWall,   effectiveToPt),   r.rightHead, palette));
    } else {
      const routed = routeEdge(a, b, allBoxes, yOff, fromPt, toPt, true);
      safePath = routed.path || `M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y}`;
      labelMid = routed.labelMidpoint;

      elements.push(p.path(safePath, palette.textMuted, 1.3, r.dashed ? { dash: '6 4' } : {}));

      // Arrowhead direction from wall: axis-aligned, independent of path geometry.
      elements.push(...endMarker(p, fromPt, wallDir(fromWall, fromPt), r.leftHead, palette));
      elements.push(...endMarker(p, toPt,   wallDir(toWall,   toPt),   r.rightHead, palette));
    }

    const mx = labelMid.x, my = labelMid.y;
    if (r.label) {
      let labelX: number, labelAnchor: 'start' | 'middle' | 'end';
      if (skipEdgeLateralStrategy && labelMid.x < Math.min(...allRealBoxes.map(b => b.x))) {
        labelX = mx - 4; labelAnchor = 'end';
      } else if (skipEdgeLateralStrategy) {
        labelX = mx + 8; labelAnchor = 'start';
      } else {
        labelX = mx; labelAnchor = 'middle';
      }
      elements.push(p.text(r.label, rhuInt(labelX), rhuInt(my - 4), memFont, palette.textMuted, { anchor: labelAnchor }));
    }
    const cardOffset = (wall: Wall, pt: { x: number; y: number }): { cx: number; cy: number } => {
      switch (wall) {
        case 'top':    return { cx: pt.x + 10, cy: pt.y - 10 };
        case 'bottom': return { cx: pt.x + 10, cy: pt.y + 10 };
        case 'left':   return { cx: pt.x - 10, cy: pt.y - 10 };
        default:       return { cx: pt.x + 10, cy: pt.y - 10 };
      }
    };
    if (r.leftCard)  { const o = cardOffset(effectiveFromWall, effectiveFromPt); elements.push(p.text(r.leftCard,  rhu(o.cx), rhu(o.cy), memFont, palette.textMuted)); }
    if (r.rightCard) { const o = cardOffset(effectiveToWall,   effectiveToPt);   elements.push(p.text(r.rightCard, rhu(o.cx), rhu(o.cy), memFont, palette.textMuted)); }
  }

  // ── Class boxes ────────────────────────────────────────────────────────────
  for (const c of ir.classes) {
    const box = laid.boxes.get(c.name)!;
    const s = sizes.get(c.name)!;
    const x = box.x, y = box.y + yOff;
    elements.push(p.rect({ x: rhu(x), y: rhu(y), width: rhu(s.w), height: rhu(s.h) }, palette.surface, palette.border, 1.4, { rx: 4 }));

    // Header
    let ty = y + nameFont + 6;
    elements.push(p.text(c.name, rhuInt(x + s.w / 2), rhu(ty), nameFont, palette.text, { weight: 'bold', anchor: 'middle' }));
    if (c.stereotype) { ty += memFont + 2; elements.push(p.text(`«${c.stereotype}»`, rhuInt(x + s.w / 2), rhu(ty), memFont, palette.textMuted, { anchor: 'middle' })); }
    const headerBottom = y + headH + (c.stereotype ? memFont + 4 : 0);
    elements.push(p.path(`M ${rhu(x)} ${rhu(headerBottom)} L ${rhu(x + s.w)} ${rhu(headerBottom)}`, palette.border, 1));

    // Attributes
    let ay = headerBottom + lineH - 4;
    for (const m of c.attributes) { elements.push(p.text(m.text, rhu(x + 8), rhu(ay), memFont, palette.text)); ay += lineH; }
    const attrBottom = y + s.attrH;
    elements.push(p.path(`M ${rhu(x)} ${rhu(attrBottom)} L ${rhu(x + s.w)} ${rhu(attrBottom)}`, palette.border, 1));

    // Methods
    let my2 = attrBottom + lineH - 4;
    for (const m of c.methods) { elements.push(p.text(m.text, rhu(x + 8), rhu(my2), memFont, palette.text)); my2 += lineH; }
  }

  const totalW = rhuInt(laid.width + margin);
  const totalH = rhuInt(laid.height + yOff + margin);

  // If any skip-edge routing went left of x=margin (Strategy B lateral lanes),
  // expand the viewBox leftward so the lane and its label aren't clipped.
  const routingMinX = Math.min(0, ...routedSegments.map(s => s.x1));
  const leftOvershoot = routingMinX < margin ? Math.ceil(margin - routingMinX) : 0;

  const scene: Scene = applyOverlays({
    viewBox: { x: -leftOvershoot, y: 0, width: totalW + leftOvershoot, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}

/** Draw a UML relationship end marker at `at`, pointing from `toward` into the box. */
function endMarker(
  p: ReturnType<typeof pen>,
  at: { x: number; y: number },
  toward: { x: number; y: number },
  type: RelEnd,
  palette: ResolvedTheme['palette'],
): SceneElement[] {
  if (type === 'none') return [];
  const ang = Math.atan2(at.y - toward.y, at.x - toward.x); // points outward from box centre toward marker
  const back = ang + Math.PI; // into the box
  const at2 = (len: number, spread: number) => ({
    x: at.x + Math.cos(back + spread) * len,
    y: at.y + Math.sin(back + spread) * len,
  });
  const tip = `${rhu(at.x)} ${rhu(at.y)}`;

  if (type === 'arrow') {
    const a = at2(12, 0.4), b = at2(12, -0.4);
    return [p.path(`M ${rhu(a.x)} ${rhu(a.y)} L ${tip} L ${rhu(b.x)} ${rhu(b.y)}`, palette.textMuted, 1.4)];
  }
  if (type === 'triangle') {
    const a = at2(14, 0.45), b = at2(14, -0.45);
    return [p.path(`M ${tip} L ${rhu(a.x)} ${rhu(a.y)} L ${rhu(b.x)} ${rhu(b.y)} Z`, palette.textMuted, 1.3, { fill: palette.background })];
  }
  // diamonds
  const near = at2(11, 0);
  const a = at2(8, 0.9), b = at2(8, -0.9);
  const fill = type === 'diamondF' ? palette.textMuted : palette.background;
  return [p.path(`M ${tip} L ${rhu(a.x)} ${rhu(a.y)} L ${rhu(near.x)} ${rhu(near.y)} L ${rhu(b.x)} ${rhu(b.y)} Z`, palette.textMuted, 1.3, { fill })];
}
