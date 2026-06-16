/**
 * @file geometry-kernel.test.ts — Unit tests for the geometry-quality kernel.
 *
 * Hand-built cases covering the predicates, the interior-only segment/box
 * semantic (the determinism-critical one), the defect detectors, the scores,
 * and the closed-form candidate-route cost model used during layout.
 */

import { describe, expect, it } from 'vitest';

import {
  boxesOverlap,
  overlapArea,
  boxContains,
  pointInBox,
  segmentIntersectsBox,
  segmentsCross,
  BoxIndex,
  labelOverNode,
  edgeThroughNode,
  labelLabelOverlap,
  outOfBounds,
  detectDefects,
  formatDefectReport,
  computeScores,
  scoreRoute,
  pickBestRoute,
} from '../src/geometry/index.js';
import type {
  Box,
  BoxWithId,
  Segment,
  LabeledGeometry,
  RouteCandidate,
  RouteContext,
} from '../src/geometry/index.js';

const node = (id: string, x: number, y: number, w: number, h: number): BoxWithId => ({ id, x, y, w, h });

// ---------------------------------------------------------------------------
// Box predicates
// ---------------------------------------------------------------------------

describe('box predicates', () => {
  it('boxesOverlap: positive-area overlap is true', () => {
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('boxesOverlap: edge-touching (zero area) is false', () => {
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it('overlapArea: computes intersection area, 0 when disjoint', () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 })).toBe(0);
  });

  it('boxContains: full containment, boundary inclusive', () => {
    expect(boxContains({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 20, h: 20 })).toBe(true);
    expect(boxContains({ x: 0, y: 0, w: 100, h: 100 }, { x: 90, y: 90, w: 20, h: 20 })).toBe(false);
  });

  it('pointInBox: strict interior vs closed', () => {
    const b: Box = { x: 0, y: 0, w: 10, h: 10 };
    expect(pointInBox({ x: 5, y: 5 }, b)).toBe(true);
    expect(pointInBox({ x: 0, y: 5 }, b, true)).toBe(false); // on boundary, strict
    expect(pointInBox({ x: 0, y: 5 }, b, false)).toBe(true); // on boundary, closed
  });
});

// ---------------------------------------------------------------------------
// Segment ⇄ box: the interior-only semantic
// ---------------------------------------------------------------------------

describe('segmentIntersectsBox (interior only)', () => {
  const box: Box = { x: 10, y: 10, w: 20, h: 20 }; // 10..30 × 10..30

  it('flags a segment passing through the interior', () => {
    const seg: Segment = { x1: 0, y1: 20, x2: 40, y2: 20 };
    expect(segmentIntersectsBox(seg, box)).toBe(true);
  });

  it('does NOT flag a segment that only touches the boundary at an endpoint', () => {
    // Endpoint rests on the left edge (x=10), segment goes left (outward).
    const seg: Segment = { x1: 10, y1: 20, x2: -20, y2: 20 };
    expect(segmentIntersectsBox(seg, box)).toBe(false);
  });

  it('does NOT flag a segment running ALONG a box edge', () => {
    const seg: Segment = { x1: 0, y1: 10, x2: 40, y2: 10 }; // along top edge y=10
    expect(segmentIntersectsBox(seg, box)).toBe(false);
  });

  it('does NOT flag a segment grazing a single corner', () => {
    const seg: Segment = { x1: 0, y1: 20, x2: 20, y2: 0 }; // touches corner (10,10)
    expect(segmentIntersectsBox(seg, box)).toBe(false);
  });

  it('flags a segment with one endpoint strictly inside', () => {
    const seg: Segment = { x1: 20, y1: 20, x2: 100, y2: 20 };
    expect(segmentIntersectsBox(seg, box)).toBe(true);
  });

  it('does NOT flag a disjoint segment', () => {
    const seg: Segment = { x1: 0, y1: 0, x2: 5, y2: 5 };
    expect(segmentIntersectsBox(seg, box)).toBe(false);
  });
});

describe('segmentsCross (proper crossing)', () => {
  it('flags two segments crossing in their interiors', () => {
    expect(
      segmentsCross({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 0, y1: 10, x2: 10, y2: 0 }),
    ).toBe(true);
  });

  it('does NOT flag segments that only share an endpoint', () => {
    expect(
      segmentsCross({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x1: 10, y1: 0, x2: 10, y2: 10 }),
    ).toBe(false);
  });

  it('does NOT flag disjoint segments', () => {
    expect(
      segmentsCross({ x1: 0, y1: 0, x2: 1, y2: 1 }, { x1: 10, y1: 10, x2: 11, y2: 11 }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Spatial index
// ---------------------------------------------------------------------------

describe('BoxIndex', () => {
  it('returns overlapping boxes in stable insertion order', () => {
    const boxes = [node('a', 0, 0, 10, 10), node('b', 100, 100, 10, 10), node('c', 5, 5, 10, 10)];
    const idx = new BoxIndex(boxes);
    const hits = idx.searchBox({ x: 1, y: 1, w: 8, h: 8 });
    expect(hits.map((h) => h.id)).toEqual(['a', 'c']);
  });

  it('searchSegment uses the segment bounding box', () => {
    const idx = new BoxIndex([node('a', 0, 0, 10, 10), node('z', 200, 200, 10, 10)]);
    const hits = idx.searchSegment({ x1: -5, y1: 5, x2: 5, y2: 5 });
    expect(hits.map((h) => h.id)).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// Defect detectors
// ---------------------------------------------------------------------------

describe('labelOverNode', () => {
  it('flags a label over a non-owner node', () => {
    const geo: LabeledGeometry = {
      nodes: [node('n1', 0, 0, 50, 30)],
      labels: [node('lbl', 10, 10, 20, 10)],
      edges: [],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    const defects = labelOverNode(geo);
    expect(defects).toHaveLength(1);
    expect(defects[0]!.objectId).toBe('n1');
  });

  it('does NOT flag a clear label', () => {
    const geo: LabeledGeometry = {
      nodes: [node('n1', 0, 0, 50, 30)],
      labels: [node('lbl', 100, 100, 20, 10)],
      edges: [],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(labelOverNode(geo)).toHaveLength(0);
  });

  it('does NOT flag a label over its OWNER node', () => {
    const geo: LabeledGeometry = {
      nodes: [node('n1', 0, 0, 50, 30)],
      labels: [node('n1:label', 5, 5, 20, 10)],
      edges: [],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(labelOverNode(geo)).toHaveLength(0);
  });
});

describe('edgeThroughNode', () => {
  it('flags an edge stabbing a non-endpoint node', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('mid', 40, 0, 10, 10), node('b', 80, 0, 10, 10)],
      labels: [],
      edges: [{ fromId: 'a', toId: 'b', segments: [{ x1: 5, y1: 5, x2: 85, y2: 5 }] }],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    const defects = edgeThroughNode(geo);
    expect(defects).toHaveLength(1);
    expect(defects[0]!.objectId).toBe('mid');
  });

  it('does NOT flag the edge passing through its own endpoint nodes', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('b', 80, 0, 10, 10)],
      labels: [],
      // segment starts on a's boundary, ends on b's boundary
      edges: [{ fromId: 'a', toId: 'b', segments: [{ x1: 10, y1: 5, x2: 80, y2: 5 }] }],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(edgeThroughNode(geo)).toHaveLength(0);
  });

  it('does NOT flag an edge routed around a node', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('mid', 40, 0, 10, 10), node('b', 80, 0, 10, 10)],
      labels: [],
      // route dips below y=20 to clear the mid node band
      edges: [
        {
          fromId: 'a',
          toId: 'b',
          segments: [
            { x1: 5, y1: 10, x2: 5, y2: 30 },
            { x1: 5, y1: 30, x2: 85, y2: 30 },
            { x1: 85, y1: 30, x2: 85, y2: 10 },
          ],
        },
      ],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(edgeThroughNode(geo)).toHaveLength(0);
  });
});

describe('labelLabelOverlap', () => {
  it('flags two overlapping labels', () => {
    const geo: LabeledGeometry = {
      nodes: [],
      labels: [node('l1', 0, 0, 20, 10), node('l2', 10, 0, 20, 10)],
      edges: [],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(labelLabelOverlap(geo)).toHaveLength(1);
  });

  it('does NOT flag separated labels', () => {
    const geo: LabeledGeometry = {
      nodes: [],
      labels: [node('l1', 0, 0, 20, 10), node('l2', 100, 0, 20, 10)],
      edges: [],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(labelLabelOverlap(geo)).toHaveLength(0);
  });
});

describe('outOfBounds', () => {
  it('flags a node spilling past the canvas', () => {
    const geo: LabeledGeometry = {
      nodes: [node('n', 190, 10, 30, 30)],
      labels: [],
      edges: [],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(outOfBounds(geo)).toHaveLength(1);
  });

  it('does NOT flag in-bounds geometry', () => {
    const geo: LabeledGeometry = {
      nodes: [node('n', 10, 10, 30, 30)],
      labels: [],
      edges: [{ fromId: 'n', toId: 'n', segments: [{ x1: 10, y1: 10, x2: 40, y2: 40 }] }],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(outOfBounds(geo)).toHaveLength(0);
  });
});

describe('detectDefects + formatDefectReport', () => {
  it('a clean scene reports clean', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('b', 100, 0, 10, 10)],
      labels: [node('a:label', 0, 12, 10, 6)],
      edges: [{ fromId: 'a', toId: 'b', segments: [{ x1: 10, y1: 5, x2: 100, y2: 5 }] }],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    const report = detectDefects(geo);
    expect(report.clean).toBe(true);
    expect(formatDefectReport(geo, 'clean-fixture')).toContain('CLEAN');
  });

  it('a broken scene enumerates every defect kind', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('mid', 40, 0, 10, 10), node('b', 80, 0, 10, 10)],
      labels: [node('lbl', 42, 1, 6, 6), node('lbl2', 44, 2, 6, 6)],
      edges: [{ fromId: 'a', toId: 'b', segments: [{ x1: 5, y1: 5, x2: 85, y2: 5 }] }],
      canvas: { x: 0, y: 0, w: 50, h: 50 }, // node 'b' (80..90) spills out
    };
    const report = detectDefects(geo);
    expect(report.clean).toBe(false);
    expect(report.counts.edgeThroughNode).toBeGreaterThan(0);
    expect(report.counts.labelOverNode).toBeGreaterThan(0);
    expect(report.counts.labelLabelOverlap).toBeGreaterThan(0);
    expect(report.counts.outOfBounds).toBeGreaterThan(0);
  });

  it('is deterministic — repeated runs give identical reports', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('mid', 40, 0, 10, 10), node('b', 80, 0, 10, 10)],
      labels: [],
      edges: [{ fromId: 'a', toId: 'b', segments: [{ x1: 5, y1: 5, x2: 85, y2: 5 }] }],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(formatDefectReport(geo)).toEqual(formatDefectReport(geo));
  });
});

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

describe('computeScores', () => {
  it('a clean layout scores 1 on hard metrics', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('b', 100, 0, 10, 10)],
      labels: [],
      edges: [{ fromId: 'a', toId: 'b', segments: [{ x1: 10, y1: 5, x2: 100, y2: 5 }] }],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    const s = computeScores(geo);
    expect(s.nodeOverlap).toBe(1);
    expect(s.nodeEdgeCrossings).toBe(1);
    expect(s.edgeCrossings).toBe(1);
  });

  it('an edge stabbing a node drops nodeEdgeCrossings below 1', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 10, 10), node('mid', 40, 0, 10, 10), node('b', 80, 0, 10, 10)],
      labels: [],
      edges: [{ fromId: 'a', toId: 'b', segments: [{ x1: 5, y1: 5, x2: 85, y2: 5 }] }],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(computeScores(geo).nodeEdgeCrossings).toBeLessThan(1);
  });

  it('overlapping nodes drop nodeOverlap below 1', () => {
    const geo: LabeledGeometry = {
      nodes: [node('a', 0, 0, 30, 30), node('b', 10, 10, 30, 30)],
      labels: [],
      edges: [],
      canvas: { x: 0, y: 0, w: 200, h: 200 },
    };
    expect(computeScores(geo).nodeOverlap).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Route cost — the during-layout consumer
// ---------------------------------------------------------------------------

describe('scoreRoute / pickBestRoute (closed-form candidate selection)', () => {
  const nodes: BoxWithId[] = [node('a', 0, 0, 20, 20), node('mid', 60, 0, 20, 20), node('b', 120, 0, 20, 20)];
  const ctx: RouteContext = {
    nodes,
    committedEdges: [],
    committedLabels: [],
    canvas: { x: 0, y: 0, w: 300, h: 300 },
    lengthScale: 300,
  };

  const straightThroughMid: RouteCandidate = {
    points: [
      { x: 20, y: 10 },
      { x: 120, y: 10 },
    ],
    fromId: 'a',
    toId: 'b',
    rank: 0,
  };

  const aroundMid: RouteCandidate = {
    points: [
      { x: 10, y: 20 },
      { x: 10, y: 60 },
      { x: 130, y: 60 },
      { x: 130, y: 20 },
    ],
    fromId: 'a',
    toId: 'b',
    rank: 1,
  };

  it('penalises a route that stabs a non-endpoint node', () => {
    const cost = scoreRoute(straightThroughMid, ctx);
    expect(cost.throughNodeCount).toBe(1);
    expect(cost.total).toBeGreaterThan(900);
  });

  it('prefers the clean route even though it is longer with more bends', () => {
    const best = pickBestRoute([straightThroughMid, aroundMid], ctx);
    expect(best.candidate).toBe(aroundMid);
    expect(best.cost.throughNodeCount).toBe(0);
  });

  it('is deterministic and stable on ties (lower rank/index wins)', () => {
    const c1: RouteCandidate = { points: [{ x: 20, y: 10 }, { x: 120, y: 10 }], fromId: 'a', toId: 'b', rank: 5 };
    const c2: RouteCandidate = { points: [{ x: 20, y: 10 }, { x: 120, y: 10 }], fromId: 'a', toId: 'b', rank: 2 };
    // identical cost → lower rank (c2) wins regardless of order
    expect(pickBestRoute([c1, c2], ctx).candidate).toBe(c2);
    expect(pickBestRoute([c2, c1], ctx).candidate).toBe(c2);
  });

  it('penalises a label placed over a non-owner node', () => {
    const withBadLabel: RouteCandidate = {
      points: [{ x: 20, y: 30 }, { x: 120, y: 30 }],
      labelBox: { x: 62, y: 2, w: 16, h: 16 }, // over 'mid'
      fromId: 'a',
      toId: 'b',
      rank: 0,
    };
    expect(scoreRoute(withBadLabel, ctx).labelOverNodeCount).toBeGreaterThan(0);
  });
});
