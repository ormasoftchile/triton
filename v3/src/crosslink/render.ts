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
import type { ResolvedCrossLink, TraceRecord, CrossLinkEdgeStyle } from '../contracts/crosslink.js';
import type { CardinalSide, NodeAnchorRegistry } from '../contracts/anchors.js';
import type { PortDirection } from '../contracts/routing.js';
import type { Point, Rect } from '../contracts/primitives.js';
import type { ResolvedTheme } from '../contracts/theme.js';
import { getRouter } from '../routing/registry.js';
import { defaultRouter } from '../routing/router.js';

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
 * @param traces  — trace records for colour assignment
 * @param theme   — for styling (colours, fonts, stroke widths)
 * @param anchors — full anchor registry for obstacle avoidance
 * @param occupiedRects — bounding boxes of existing text/elements that labels must avoid
 * @param routingObstacles — additional thin obstacles (cell borders) for the router to avoid
 */
export function renderCrossLinks(
  resolved: readonly ResolvedCrossLink[],
  traces: readonly TraceRecord[],
  theme: ResolvedTheme,
  anchors?: NodeAnchorRegistry,
  occupiedRects?: readonly Rect[],
  routingObstacles?: readonly Rect[],
): CrossLinkRenderResult {
  const { palette, typography, edges: edgeTheme } = theme;
  const elements: SceneElement[] = [];
  const defs: string[] = [];
  let needsArrow = false;
  let needsBiArrow = false;

  // Extract obstacles from the anchor registry (all node bounds)
  // Note: cell borders are handled separately in post-route nudging, not as generic obstacles
  const obstacles: Rect[] = [];
  if (anchors) {
    for (const anchor of Object.values(anchors)) {
      obstacles.push(anchor.bounds);
    }
  }

  // Build trace colour map — uses distinct colours (avoids primary which is the default link colour)
  const traceColors = new Map<string, string>();
  const categoricalPalette = [
    '#E11D48', '#16A34A', '#9333EA', '#0891B2',
    '#CA8A04', '#DC2626', '#2563EB', '#7C3AED',
  ];
  for (let i = 0; i < traces.length; i++) {
    const t = traces[i]!;
    traceColors.set(t.id, t.color ?? categoricalPalette[i % categoricalPalette.length]!);
  }

  // Assign distinct colours to explicit (non-trace) links as well
  let explicitColorIdx = 0;

  // Collect labels for de-collision pass after all routes are computed
  const pendingLabels: Array<{
    content: string; x: number; y: number;
    fontSize: number; fontFamily: string; fill: string;
    anchor: 'middle'; fontWeight: 'bold';
  }> = [];

  // Phase 1: Compute all routes
  interface PendingRoute {
    points: readonly Point[];
    color: string;
    dash: string | undefined;
    markerEnd: string | undefined;
    markerStart: string | undefined;
    label: string | undefined;
  }
  const pendingRoutes: PendingRoute[] = [];

  for (const rLink of resolved) {
    const { link, fromPort, toPort, fromSide, toSide } = rLink;

    let color: string;
    if (link.traceId) {
      color = traceColors.get(link.traceId) ?? palette.primary;
    } else {
      color = categoricalPalette[explicitColorIdx % categoricalPalette.length]!;
      explicitColorIdx++;
    }

    const fromDir = sideToPortDir(fromSide);
    const toDir   = sideToPortDir(toSide);
    const router  = getRouter('orthogonal') ?? defaultRouter;
    const route   = router.route({
      from: fromPort,
      to: toPort,
      style: 'orthogonal',
      obstacles,
      padding: 12,
      fromDir,
      toDir,
    });

    const dash = edgeStyleToDash(link.style);
    let markerEnd: string | undefined;
    let markerStart: string | undefined;
    if (link.direction === 'directed') {
      markerEnd = CROSSLINK_ARROW_ID;
      needsArrow = true;
    } else if (link.direction === 'bidirectional') {
      markerEnd = CROSSLINK_ARROW_ID;
      markerStart = CROSSLINK_ARROW_BOTH_ID;
      needsArrow = true;
      needsBiArrow = true;
    }

    pendingRoutes.push({
      points: route.points,
      color,
      dash,
      markerEnd,
      markerStart,
      label: link.label,
    });
  }

  // Phase 2: Nudge segments away from cell borders (avoid running along walls)
  if (routingObstacles && routingObstacles.length > 0) {
    nudgeOffBorders(pendingRoutes, routingObstacles);
  }

  // Phase 3: Channel separation — offset overlapping parallel segments
  const CHANNEL_GAP = 6;
  separateOverlappingChannels(pendingRoutes, CHANNEL_GAP);

  // Phase 4: Emit path elements and collect labels
  for (const pr of pendingRoutes) {
    const path = pr.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const pathEl: SceneElement = {
      type: 'path',
      d: path,
      stroke: pr.color,
      strokeWidth: edgeTheme.strokeWidth + 0.5,
      ...(pr.dash ? { strokeDasharray: pr.dash } : {}),
      ...(pr.markerEnd ? { markerEnd: pr.markerEnd } : {}),
      ...(pr.markerStart ? { markerStart: pr.markerStart } : {}),
    };
    elements.push(pathEl);

    if (pr.label) {
      const labelPos = longestSegmentMidpoint(pr.points);
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
  if (needsArrow) {
    const s = edgeTheme.arrowSize;
    defs.push(
      `<marker id="${CROSSLINK_ARROW_ID}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="${s - 1}" refY="${s * 0.35}" orient="auto"><polygon points="0 0, ${s} ${s * 0.35}, 0 ${s * 0.7}" fill="currentColor" /></marker>`,
    );
  }
  if (needsBiArrow) {
    const s = edgeTheme.arrowSize;
    defs.push(
      `<marker id="${CROSSLINK_ARROW_BOTH_ID}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="1" refY="${s * 0.35}" orient="auto"><polygon points="${s} 0, 0 ${s * 0.35}, ${s} ${s * 0.7}" fill="currentColor" /></marker>`,
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
    case 'dashed': return '8 4';
    case 'dotted': return '4 3';
    default: return undefined;
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
 * De-collide label rectangles by pushing them vertically away from
 * fixed obstacles and from each other. Mutates labelRects in place.
 */
function deCollideLabels(labelRects: Rect[], fixedRects: readonly Rect[]): void {
  const MAX_PASSES = 20;
  const NUDGE = 2; // extra pixels gap after pushing

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;

    // Push labels away from fixed rects
    for (const lr of labelRects) {
      for (const fr of fixedRects) {
        if (rectsOverlap(lr, fr)) {
          // Push label vertically away from fixed rect center
          const labelCY = lr.y + lr.height / 2;
          const fixedCY = fr.y + fr.height / 2;
          if (labelCY <= fixedCY) {
            // Push up (above the fixed rect)
            lr.y = fr.y - lr.height - NUDGE;
          } else {
            // Push down (below the fixed rect)
            lr.y = fr.y + fr.height + NUDGE;
          }
          moved = true;
        }
      }
    }

    // Push labels away from each other
    for (let i = 0; i < labelRects.length; i++) {
      for (let j = i + 1; j < labelRects.length; j++) {
        const a = labelRects[i]!, b = labelRects[j]!;
        if (rectsOverlap(a, b)) {
          const aCY = a.y + a.height / 2;
          const bCY = b.y + b.height / 2;
          if (aCY <= bCY) {
            // a above b — push apart
            const overlap = (a.y + a.height) - b.y + NUDGE;
            a.y -= overlap / 2;
            b.y += overlap / 2;
          } else {
            const overlap = (b.y + b.height) - a.y + NUDGE;
            b.y -= overlap / 2;
            a.y += overlap / 2;
          }
          moved = true;
        }
      }
    }

    if (!moved) break;
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
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
  color: string;
  dash: string | undefined;
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
  const COORD_TOLERANCE = 1;
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
