/**
 * @file lint.ts — Layout-quality linter for the Scene / Render IR.
 *
 * `lintScene(scene)` performs axis-aligned bounding-box analysis over every
 * relevant primitive in the Scene and returns an array of QualityIssue
 * descriptors.  It is a pure, deterministic function — no I/O, no side-effects.
 *
 * Checks performed
 * ────────────────
 *  NODE_OVERLAP       (error)   — two milestone node markers whose bboxes overlap.
 *  LABEL_OVERLAP      (error)   — two label bboxes belonging to DIFFERENT entries
 *                                 overlap beyond the allowed tolerance.
 *  LABEL_AXIS_OVERLAP (error)   — a label bbox intersects the axis / tick-label band.
 *  OUT_OF_BOUNDS      (error)   — any primitive bbox extends outside [0,0,W,H].
 *  TIGHT_SPACING      (warning) — label bboxes are near-misses (< TIGHT_GAP px gap).
 */

import type {
  CirclePrimitive,
  LinePrimitive,
  MultiTextPrimitive,
  PathPrimitive,
  RectPrimitive,
  Scene,
  ScenePrimitive,
  TextPrimitive,
} from './scene.js';
import { measureText } from './fonts/metrics.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QualityIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  /** Representative canvas coordinates for the offending primitives. */
  where?: { x: number; y: number }[];
}

// ---------------------------------------------------------------------------
// Internal geometry
// ---------------------------------------------------------------------------

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** True when bboxes a and b overlap by MORE than `tolerance` px in both axes. */
function bboxesOverlap(a: BBox, b: BBox, tolerance = 0): boolean {
  return (
    a.x + a.w - tolerance > b.x + tolerance &&
    b.x + b.w - tolerance > a.x + tolerance &&
    a.y + a.h - tolerance > b.y + tolerance &&
    b.y + b.h - tolerance > a.y + tolerance
  );
}

// ---------------------------------------------------------------------------
// Bounding-box helpers
// ---------------------------------------------------------------------------

const LINE_HEIGHT_FACTOR = 1.2; // must match fonts/metrics.ts

/**
 * Compute the axis-aligned bbox for a TextPrimitive.
 *
 * Respects textAnchor (start/middle/end) and dominantBaseline
 * (alphabetic/auto → baseline-anchored; middle/central → centred; hanging → top-anchored).
 */
function textBBox(t: TextPrimitive): BBox {
  const { width } = measureText(t.text, t.fontSize);
  const height = t.fontSize * LINE_HEIGHT_FACTOR;

  let left: number;
  const anchor = t.textAnchor ?? 'start';
  if (anchor === 'middle') left = t.x - width / 2;
  else if (anchor === 'end') left = t.x - width;
  else left = t.x; // 'start'

  let top: number;
  const bl = t.dominantBaseline ?? 'alphabetic';
  if (bl === 'middle' || bl === 'central') top = t.y - height / 2;
  else if (bl === 'hanging') top = t.y;
  else top = t.y - height * 0.8; // 'alphabetic' | 'auto'

  return { x: left, y: top, w: width, h: height };
}

/**
 * Compute the axis-aligned bbox for a MultiTextPrimitive.
 *
 * Width  = widest line.
 * Height = (nLines-1) × lineHeight + singleLineHeight.
 * Position follows the same anchor rules as textBBox (anchored at first-line baseline).
 */
function multiTextBBox(t: MultiTextPrimitive): BBox {
  const lineWidths = t.lines.map((l) => measureText(l, t.fontSize).width);
  const maxWidth = lineWidths.length > 0 ? Math.max(...lineWidths) : 0;
  const singleLineH = t.fontSize * LINE_HEIGHT_FACTOR;
  const totalH =
    t.lines.length <= 1 ? singleLineH : (t.lines.length - 1) * t.lineHeight + singleLineH;

  let left: number;
  const anchor = t.textAnchor ?? 'start';
  if (anchor === 'middle') left = t.x - maxWidth / 2;
  else if (anchor === 'end') left = t.x - maxWidth;
  else left = t.x;

  let top: number;
  const bl = t.dominantBaseline ?? 'alphabetic';
  if (bl === 'middle' || bl === 'central') top = t.y - totalH / 2;
  else if (bl === 'hanging') top = t.y;
  else top = t.y - singleLineH * 0.8; // first-line alphabetic baseline

  return { x: left, y: top, w: maxWidth, h: totalH };
}

/** Bbox for a CirclePrimitive including half-stroke on every side. */
function circleBBox(c: CirclePrimitive): BBox {
  const r = c.r + (c.strokeWidth ?? 0) / 2;
  return { x: c.cx - r, y: c.cy - r, w: r * 2, h: r * 2 };
}

/**
 * Extract (x, y) vertex pairs from a simple M/L path string.
 * Only handles absolute M and L commands — matches milestone diamond/triangle shapes.
 */
function parseSimplePathVertices(d: string): [number, number][] {
  const verts: [number, number][] = [];
  const re = /[ML]\s*([-\d.]+)[,\s]+([-\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    verts.push([parseFloat(m[1]!), parseFloat(m[2]!)]);
  }
  return verts;
}

/** Compute bbox from a list of vertices. */
function vertexBBox(verts: [number, number][]): BBox | null {
  if (verts.length < 2) return null;
  const xs = verts.map(([x]) => x);
  const ys = verts.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Compute bbox for a PathPrimitive without a transform (milestone shapes only). */
function pathBBox(p: PathPrimitive): BBox | null {
  if (p.transform) return null; // transformed paths (icons) — skip
  if (/[AaQqCcSsTt]/.test(p.d)) return null; // curved paths — not a simple polygon
  const verts = parseSimplePathVertices(p.d);
  if (verts.length < 3 || verts.length > 7) return null; // only simple polygons
  return vertexBBox(verts);
}

// ---------------------------------------------------------------------------
// Primitive flattening
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a primitive tree (resolving GroupPrimitives) into a
 * flat list of leaf primitives.
 */
function flattenPrimitives(prims: ScenePrimitive[]): ScenePrimitive[] {
  const out: ScenePrimitive[] = [];
  for (const p of prims) {
    if (p.kind === 'group') {
      out.push(...flattenPrimitives(p.primitives));
    } else {
      out.push(p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Axis detection
// ---------------------------------------------------------------------------

interface AxisInfo {
  /** y coordinate of the horizontal axis line (horizontal layout). */
  hAxisY?: number;
  /** Bounding rectangle of the tick-label band for the horizontal axis. */
  hAxisBand?: BBox;
}

const AXIS_SPAN_FRACTION = 0.3; // axis line must span ≥30 % of relevant dimension
const AXIS_BAND_ABOVE = 22; // px above axis line where tick labels live
const AXIS_BAND_BELOW = 4; // px below the axis line to include

/**
 * Detect the primary horizontal axis from Scene lines.
 * Only applicable to horizontal-family layouts.
 */
function detectAxes(scene: Scene, flat: ScenePrimitive[]): AxisInfo {
  const { width: W, height: H } = scene;
  const lines = flat.filter((p): p is LinePrimitive => p.kind === 'line');

  // If there's a prominent vertical spine line (vertical-spine layout), the
  // full-width today-marker line would be misidentified as the horizontal axis.
  // Detect this layout and skip horizontal-axis detection in that case.
  const centreVerticalLines = lines
    .filter(
      (l) =>
        Math.abs(l.x1 - l.x2) < 2 && Math.abs(l.x1 - W / 2) < W * 0.1 && Math.abs(l.y2 - l.y1) > 8,
    )
    .map((l) => ({
      y1: Math.min(l.y1, l.y2),
      y2: Math.max(l.y1, l.y2),
    }))
    .sort((a, b) => a.y1 - b.y1);

  let centreVerticalSpan = 0;
  if (centreVerticalLines.length > 0) {
    let curY1 = centreVerticalLines[0]!.y1;
    let curY2 = centreVerticalLines[0]!.y2;
    for (let i = 1; i < centreVerticalLines.length; i++) {
      const seg = centreVerticalLines[i]!;
      if (seg.y1 <= curY2 + 6) {
        curY2 = Math.max(curY2, seg.y2);
      } else {
        centreVerticalSpan += curY2 - curY1;
        curY1 = seg.y1;
        curY2 = seg.y2;
      }
    }
    centreVerticalSpan += curY2 - curY1;
  }

  const hasVerticalSpine = centreVerticalSpan > H * 0.3;
  if (hasVerticalSpine) return {};

  // Horizontal axis: nearly-horizontal line spanning ≥30 % of canvas width,
  // positioned in the upper half but not flush against the top edge.
  const hAxisLine = lines
    .filter(
      (l) =>
        Math.abs(l.y1 - l.y2) < 2 &&
        Math.abs(l.x2 - l.x1) > W * AXIS_SPAN_FRACTION &&
        l.y1 > H * 0.04 &&
        l.y1 < H * 0.55,
    )
    .sort((a, b) => a.y1 - b.y1)[0];

  if (!hAxisLine) return {};

  const axY = hAxisLine.y1;
  const x1 = Math.min(hAxisLine.x1, hAxisLine.x2);
  const x2 = Math.max(hAxisLine.x1, hAxisLine.x2);

  return {
    hAxisY: axY,
    hAxisBand: {
      x: x1,
      y: axY - AXIS_BAND_ABOVE,
      w: x2 - x1,
      h: AXIS_BAND_ABOVE + AXIS_BAND_BELOW,
    },
  };
}

// ---------------------------------------------------------------------------
// Label-block grouping
// ---------------------------------------------------------------------------

/**
 * Internally annotated label entry carrying its bbox and anchor x/y.
 */
interface LabelEntry {
  bbox: BBox;
  /** Anchor x from the primitive (used for block-grouping). */
  anchorX: number;
  /** Anchor y from the primitive (used for axis-tick exclusion). */
  anchorY: number;
}

/**
 * Build logical label groups via connected-components over anchor-x proximity
 * and vertical adjacency.
 *
 * Two text primitives belong to the same "label block" if they share the same
 * anchor-x (within SAME_X_EPSILON) AND their bboxes are vertically adjacent
 * (gap ≤ VERTICAL_ADJACENCY_GAP).  Primitives in the same block are not
 * checked against each other for LABEL_OVERLAP.
 */
const SAME_X_EPSILON = 1; // px
const VERTICAL_ADJACENCY_GAP = 16; // px — covers typical line-spacing within a block

function buildLabelGroups(entries: LabelEntry[]): number[] {
  const n = entries.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!; // path compression
      i = parent[i]!;
    }
    return i;
  }

  function union(i: number, j: number): void {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const la = entries[i]!;
      const lb = entries[j]!;
      if (Math.abs(la.anchorX - lb.anchorX) > SAME_X_EPSILON) continue;
      // Same anchor-x: check vertical proximity
      const aTop = la.bbox.y;
      const aBot = la.bbox.y + la.bbox.h;
      const bTop = lb.bbox.y;
      const bBot = lb.bbox.y + lb.bbox.h;
      const gap = Math.max(0, Math.max(aTop, bTop) - Math.min(aBot, bBot));
      if (gap <= VERTICAL_ADJACENCY_GAP) {
        union(i, j);
      }
    }
  }

  return parent.map((_, i) => find(i));
}

// ---------------------------------------------------------------------------
// Tolerance constants
// ---------------------------------------------------------------------------

/** Bboxes must overlap by MORE THAN this many pixels to count as an overlap. */
const OVERLAP_EPSILON = 4; // px — accounts for font-metrics approximation
const NODE_OVERLAP_EPS = 2; // px — tighter tolerance for node markers
const BOUNDS_EPSILON = 1; // px — out-of-bounds tolerance
/** Bboxes within this gap trigger TIGHT_SPACING (warning only). */
const TIGHT_GAP = 5; // px

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the layout-quality linter over a rendered Scene.
 *
 * Returns an array of QualityIssue descriptors.  Error-severity issues
 * indicate genuine rendering defects (superposition, overflow, axis
 * overwrite).  Warning-severity issues are informational.
 *
 * The function is pure and deterministic: same Scene always yields same output.
 */
export function lintScene(scene: Scene): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const { width: W, height: H } = scene;

  const flat = flattenPrimitives(scene.primitives);

  // ── Axis detection ────────────────────────────────────────────────────────
  const axisInfo = detectAxes(scene, flat);

  // ── Collect text labels ───────────────────────────────────────────────────
  const textPrims = flat.filter((p): p is TextPrimitive => p.kind === 'text');
  const multiPrims = flat.filter((p): p is MultiTextPrimitive => p.kind === 'multitext');

  const labelEntries: LabelEntry[] = [
    ...textPrims.map((t) => ({
      bbox: textBBox(t),
      anchorX: t.x,
      anchorY: t.y,
    })),
    ...multiPrims.map((t) => ({
      bbox: multiTextBBox(t),
      anchorX: t.x,
      anchorY: t.y,
    })),
  ];

  // ── Build label block groups ──────────────────────────────────────────────
  const groupIds = buildLabelGroups(labelEntries);

  // ── Collect node bboxes ───────────────────────────────────────────────────
  const nodeBBoxes: BBox[] = [];

  // Circles with r >= 4 px (milestone nodes; excludes tiny decorative elements)
  for (const c of flat.filter((p): p is CirclePrimitive => p.kind === 'circle')) {
    if (c.r >= 4) nodeBBoxes.push(circleBBox(c));
  }

  // Untransformed paths with 3–6 vertices (diamond / triangle milestone shapes)
  for (const p of flat.filter((p): p is PathPrimitive => p.kind === 'path')) {
    const bb = pathBBox(p);
    if (bb && bb.w >= 4 && bb.h >= 4) nodeBBoxes.push(bb);
  }

  // ── Check: NODE_OVERLAP ───────────────────────────────────────────────────
  for (let i = 0; i < nodeBBoxes.length - 1; i++) {
    for (let j = i + 1; j < nodeBBoxes.length; j++) {
      const a = nodeBBoxes[i]!;
      const b = nodeBBoxes[j]!;
      if (bboxesOverlap(a, b, NODE_OVERLAP_EPS)) {
        issues.push({
          code: 'NODE_OVERLAP',
          severity: 'error',
          message: 'Two milestone node markers overlap.',
          where: [
            { x: a.x + a.w / 2, y: a.y + a.h / 2 },
            { x: b.x + b.w / 2, y: b.y + b.h / 2 },
          ],
        });
      }
    }
  }

  // ── Check: LABEL_OVERLAP ─────────────────────────────────────────────────
  for (let i = 0; i < labelEntries.length - 1; i++) {
    for (let j = i + 1; j < labelEntries.length; j++) {
      // Skip pairs in the same logical label block (same entry's title+date etc.)
      if (groupIds[i] === groupIds[j]) continue;

      const la = labelEntries[i]!;
      const lb = labelEntries[j]!;

      if (bboxesOverlap(la.bbox, lb.bbox, OVERLAP_EPSILON)) {
        issues.push({
          code: 'LABEL_OVERLAP',
          severity: 'error',
          message: 'Two label bboxes from different entries overlap.',
          where: [
            { x: la.bbox.x + la.bbox.w / 2, y: la.bbox.y + la.bbox.h / 2 },
            { x: lb.bbox.x + lb.bbox.w / 2, y: lb.bbox.y + lb.bbox.h / 2 },
          ],
        });
      }
    }
  }

  // ── Check: LABEL_AXIS_OVERLAP ─────────────────────────────────────────────
  if (axisInfo.hAxisBand && axisInfo.hAxisY !== undefined) {
    const axY = axisInfo.hAxisY;
    const axisBand = axisInfo.hAxisBand;

    for (const la of labelEntries) {
      // Only check labels whose anchor is BELOW the axis line.
      // Labels above the axis (tick labels, header text, title) are intentionally
      // in the axis zone and must not trigger false positives.
      if (la.anchorY <= axY) continue;

      if (bboxesOverlap(la.bbox, axisBand)) {
        issues.push({
          code: 'LABEL_AXIS_OVERLAP',
          severity: 'error',
          message: 'A label bbox overlaps the axis / tick-label band.',
          where: [{ x: la.bbox.x + la.bbox.w / 2, y: la.bbox.y + la.bbox.h / 2 }],
        });
      }
    }
  }

  // ── Check: OUT_OF_BOUNDS ──────────────────────────────────────────────────
  for (const p of flat) {
    let bb: BBox | null = null;

    switch (p.kind) {
      case 'text':
        bb = textBBox(p);
        break;
      case 'multitext':
        bb = multiTextBBox(p);
        break;
      case 'circle':
        bb = circleBBox(p);
        break;
      case 'rect':
        bb = {
          x: (p as RectPrimitive).x,
          y: (p as RectPrimitive).y,
          w: (p as RectPrimitive).width,
          h: (p as RectPrimitive).height,
        };
        break;
      case 'line': {
        const l = p as LinePrimitive;
        bb = {
          x: Math.min(l.x1, l.x2),
          y: Math.min(l.y1, l.y2),
          w: Math.abs(l.x2 - l.x1),
          h: Math.abs(l.y2 - l.y1),
        };
        break;
      }
      case 'path': {
        bb = pathBBox(p as PathPrimitive);
        break;
      }
      case 'group':
        // Already flattened — skip the wrapper
        break;
    }

    if (!bb) continue;

    if (
      bb.x < -BOUNDS_EPSILON ||
      bb.y < -BOUNDS_EPSILON ||
      bb.x + bb.w > W + BOUNDS_EPSILON ||
      bb.y + bb.h > H + BOUNDS_EPSILON
    ) {
      issues.push({
        code: 'OUT_OF_BOUNDS',
        severity: 'error',
        message: `Primitive (${p.kind}) extends outside the canvas bounds [0,0,${W},${H}].`,
        where: [{ x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 }],
      });
    }
  }

  // ── Check: TIGHT_SPACING (warning) ────────────────────────────────────────
  for (let i = 0; i < labelEntries.length - 1; i++) {
    for (let j = i + 1; j < labelEntries.length; j++) {
      if (groupIds[i] === groupIds[j]) continue;

      const la = labelEntries[i]!;
      const lb = labelEntries[j]!;

      // Bboxes must NOT already overlap (those are LABEL_OVERLAP errors)
      if (bboxesOverlap(la.bbox, lb.bbox, OVERLAP_EPSILON)) continue;

      // Expand la by TIGHT_GAP on all sides and check for overlap with lb
      const expanded: BBox = {
        x: la.bbox.x - TIGHT_GAP,
        y: la.bbox.y - TIGHT_GAP,
        w: la.bbox.w + 2 * TIGHT_GAP,
        h: la.bbox.h + 2 * TIGHT_GAP,
      };

      if (bboxesOverlap(expanded, lb.bbox)) {
        issues.push({
          code: 'TIGHT_SPACING',
          severity: 'warning',
          message: `Two label bboxes are very close (< ${TIGHT_GAP} px gap).`,
          where: [
            { x: la.bbox.x + la.bbox.w / 2, y: la.bbox.y + la.bbox.h / 2 },
            { x: lb.bbox.x + lb.bbox.w / 2, y: lb.bbox.y + lb.bbox.h / 2 },
          ],
        });
      }
    }
  }

  return issues;
}
