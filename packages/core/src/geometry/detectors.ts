/**
 * @file detectors.ts — Objective defect detectors over labelled geometry.
 *
 * The kernel consumes a lightweight `LabeledGeometry` (boxes + segments +
 * canvas) and reports concrete, measurable defects that a human would call
 * "broken": a label sitting on top of an unrelated node, an edge stabbing
 * through a node it does not connect, overlapping labels, and elements that
 * spill outside the canvas.
 *
 * Every detector is pure and deterministic and returns a STABLE-ordered list
 * of defects (sorted by a canonical key) so reports are reproducible.
 */

import {
  boxesOverlap,
  boxContains,
  overlapArea,
  segmentIntersectsBox,
} from './predicates.js';
import type { Box, BoxWithId, Segment } from './primitives.js';
import { BoxIndex } from './spatial-index.js';

// ---------------------------------------------------------------------------
// Input model
// ---------------------------------------------------------------------------

/** A routed edge: its polyline segments plus the ids of the two nodes it joins. */
export interface LabeledEdge {
  /** Ordered, axis-aligned (or arbitrary) segments of the routed edge. */
  segments: Segment[];
  /** Source node id (an endpoint — never counts as a "through node"). */
  fromId: string;
  /** Target node id (an endpoint — never counts as a "through node"). */
  toId: string;
  /** Optional stable id for the edge (used in defect keys / reports). */
  id?: string;
}

/**
 * The complete labelled geometry the kernel scores.  Coordinates are poster
 * (scene) space.  `labels` may be empty; `edges` may be empty.
 */
export interface LabeledGeometry {
  nodes: BoxWithId[];
  labels: BoxWithId[];
  edges: LabeledEdge[];
  canvas: Box;
}

// ---------------------------------------------------------------------------
// Defect model
// ---------------------------------------------------------------------------

export type DefectKind =
  | 'labelOverNode'
  | 'edgeThroughNode'
  | 'labelLabelOverlap'
  | 'outOfBounds';

export interface Defect {
  kind: DefectKind;
  /** Human-readable, stable description. */
  message: string;
  /** The primary element id involved (label id, edge id, node id…). */
  subjectId: string;
  /** The secondary element id, when the defect relates two elements. */
  objectId?: string;
  /** A scalar severity proxy (e.g. overlap area, intrusion length) — higher = worse. */
  magnitude: number;
}

function sortDefects(defects: Defect[]): Defect[] {
  return defects.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.subjectId !== b.subjectId) return a.subjectId < b.subjectId ? -1 : 1;
    const ao = a.objectId ?? '';
    const bo = b.objectId ?? '';
    if (ao !== bo) return ao < bo ? -1 : 1;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Individual detectors
// ---------------------------------------------------------------------------

/**
 * A label box overlaps a node box that is NOT its owner.
 *
 * A label "owns" a node when `label.id === node.id` or the label id is
 * `"<nodeId>:label"` / `"<nodeId>"`-prefixed — owner overlap is expected and
 * never flagged.  Any other positive-area label∩node overlap is a defect.
 */
export function labelOverNode(geo: LabeledGeometry): Defect[] {
  const out: Defect[] = [];
  const index = new BoxIndex(geo.nodes);
  for (const label of geo.labels) {
    for (const node of index.searchBox(label)) {
      if (isOwner(label.id, node.id)) continue;
      const area = overlapArea(label, node);
      if (area > 0) {
        out.push({
          kind: 'labelOverNode',
          subjectId: label.id,
          objectId: node.id,
          magnitude: area,
          message: `label "${label.id}" overlaps non-owner node "${node.id}" (area ${area.toFixed(1)})`,
        });
      }
    }
  }
  return sortDefects(out);
}

/**
 * An edge segment passes through the INTERIOR of a node box that is not one of
 * the edge's two endpoints.  Endpoint nodes are excluded by id, and the
 * interior-only semantic of `segmentIntersectsBox` means an edge attaching to
 * an endpoint node's boundary port never registers here.
 */
export function edgeThroughNode(geo: LabeledGeometry): Defect[] {
  const out: Defect[] = [];
  const index = new BoxIndex(geo.nodes);
  geo.edges.forEach((edge, ei) => {
    const edgeId = edge.id ?? `${edge.fromId}->${edge.toId}#${ei}`;
    const seen = new Set<string>();
    for (const seg of edge.segments) {
      for (const node of index.searchSegment(seg)) {
        if (node.id === edge.fromId || node.id === edge.toId) continue;
        if (seen.has(node.id)) continue;
        if (segmentIntersectsBox(seg, node)) {
          seen.add(node.id);
          out.push({
            kind: 'edgeThroughNode',
            subjectId: edgeId,
            objectId: node.id,
            magnitude: 1,
            message: `edge "${edgeId}" passes through non-endpoint node "${node.id}"`,
          });
        }
      }
    }
  });
  return sortDefects(out);
}

/** Two label boxes overlap each other (positive area). */
export function labelLabelOverlap(geo: LabeledGeometry): Defect[] {
  const out: Defect[] = [];
  const labels = geo.labels;
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]!;
      const b = labels[j]!;
      const area = overlapArea(a, b);
      if (area > 0) {
        const [s, o] = a.id <= b.id ? [a.id, b.id] : [b.id, a.id];
        out.push({
          kind: 'labelLabelOverlap',
          subjectId: s,
          objectId: o,
          magnitude: area,
          message: `labels "${s}" and "${o}" overlap (area ${area.toFixed(1)})`,
        });
      }
    }
  }
  return sortDefects(out);
}

/**
 * Any node, label, or edge segment extends beyond the canvas (clipping).
 * The canvas is treated as the allowed region; elements must be fully inside.
 */
export function outOfBounds(geo: LabeledGeometry): Defect[] {
  const out: Defect[] = [];
  const canvas = geo.canvas;

  const checkBox = (box: BoxWithId, role: string) => {
    if (!boxContains(canvas, box)) {
      out.push({
        kind: 'outOfBounds',
        subjectId: box.id,
        magnitude: outsideAmount(canvas, box),
        message: `${role} "${box.id}" extends beyond the canvas`,
      });
    }
  };

  for (const node of geo.nodes) checkBox(node, 'node');
  for (const label of geo.labels) checkBox(label, 'label');

  geo.edges.forEach((edge, ei) => {
    const edgeId = edge.id ?? `${edge.fromId}->${edge.toId}#${ei}`;
    for (const seg of edge.segments) {
      if (!pointInCanvas(canvas, seg.x1, seg.y1) || !pointInCanvas(canvas, seg.x2, seg.y2)) {
        out.push({
          kind: 'outOfBounds',
          subjectId: edgeId,
          magnitude: 1,
          message: `edge "${edgeId}" extends beyond the canvas`,
        });
        break;
      }
    }
  });

  return sortDefects(out);
}

// ---------------------------------------------------------------------------
// Aggregate report
// ---------------------------------------------------------------------------

/** Full objective defect report for a piece of labelled geometry. */
export interface DefectReport {
  defects: Defect[];
  counts: Record<DefectKind, number>;
  /** True when no defect of any kind was found. */
  clean: boolean;
}

/**
 * Run every detector and aggregate the result.  "Egregious" detectors
 * (labelOverNode, edgeThroughNode, labelLabelOverlap, outOfBounds) all run —
 * the visual-quality gate fails on any non-empty result.
 */
export function detectDefects(geo: LabeledGeometry): DefectReport {
  const defects = [
    ...edgeThroughNode(geo),
    ...labelOverNode(geo),
    ...labelLabelOverlap(geo),
    ...outOfBounds(geo),
  ];
  const counts: Record<DefectKind, number> = {
    edgeThroughNode: 0,
    labelOverNode: 0,
    labelLabelOverlap: 0,
    outOfBounds: 0,
  };
  for (const d of defects) counts[d.kind]++;
  return { defects, counts, clean: defects.length === 0 };
}

/** Render a defect report as a human-readable, deterministic multi-line string. */
export function formatDefectReport(geo: LabeledGeometry, title = 'geometry'): string {
  const report = detectDefects(geo);
  const lines: string[] = [];
  lines.push(`── Geometry quality report: ${title} ──`);
  lines.push(
    `nodes=${geo.nodes.length} labels=${geo.labels.length} edges=${geo.edges.length} ` +
      `canvas=${geo.canvas.w}×${geo.canvas.h}`,
  );
  lines.push(
    `defects: edgeThroughNode=${report.counts.edgeThroughNode} ` +
      `labelOverNode=${report.counts.labelOverNode} ` +
      `labelLabelOverlap=${report.counts.labelLabelOverlap} ` +
      `outOfBounds=${report.counts.outOfBounds}`,
  );
  if (report.clean) {
    lines.push('verdict: CLEAN — no measurable geometry defects.');
  } else {
    lines.push(`verdict: ${report.defects.length} DEFECT(S):`);
    for (const d of report.defects) lines.push(`  • [${d.kind}] ${d.message}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOwner(labelId: string, nodeId: string): boolean {
  if (labelId === nodeId) return true;
  if (labelId === `${nodeId}:label`) return true;
  if (labelId.startsWith(`${nodeId}:`)) return true;
  return false;
}

function pointInCanvas(canvas: Box, x: number, y: number): boolean {
  return (
    x >= canvas.x - 0.5 &&
    y >= canvas.y - 0.5 &&
    x <= canvas.x + canvas.w + 0.5 &&
    y <= canvas.y + canvas.h + 0.5
  );
}

function outsideAmount(canvas: Box, box: Box): number {
  const left = Math.max(0, canvas.x - box.x);
  const top = Math.max(0, canvas.y - box.y);
  const right = Math.max(0, box.x + box.w - (canvas.x + canvas.w));
  const bottom = Math.max(0, box.y + box.h - (canvas.y + canvas.h));
  return left + top + right + bottom;
}

// re-export for callers building geometry inline
export { boxesOverlap };
