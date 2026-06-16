/**
 * @file geometry/index.ts — Public surface of the geometry-quality kernel.
 *
 * A single PURE, DETERMINISTIC kernel over lightweight primitives (boxes,
 * segments, anchors) — NOT full Scenes — consumed at two points:
 *   (1) DURING layout: enumerate candidate routes → `scoreRoute` /
 *       `pickBestRoute` → commit the lowest-cost candidate before emitting any
 *       Scene ("no poisoned render").
 *   (2) AFTER render: `detectDefects` / `computeScores` over the final geometry
 *       as a CI gate + objective report.
 */

export type { Box, BoxWithId, Point, Segment } from './primitives.js';
export {
  boxRight,
  boxBottom,
  boxCenter,
  boxArea,
  normalizeBox,
  boxFromCorners,
  insetBox,
  boxCorners,
  boxEdges,
  segmentLength,
  polylineLength,
  polylineToSegments,
  countBends,
} from './primitives.js';

export {
  boxesOverlap,
  overlapArea,
  boxContains,
  pointInBox,
  segmentIntersectsBox,
  segmentsCross,
} from './predicates.js';

export { BoxIndex } from './spatial-index.js';

export type {
  LabeledEdge,
  LabeledGeometry,
  Defect,
  DefectKind,
  DefectReport,
} from './detectors.js';
export {
  labelOverNode,
  edgeThroughNode,
  labelLabelOverlap,
  outOfBounds,
  detectDefects,
  formatDefectReport,
} from './detectors.js';

export type { QualityScores } from './scores.js';
export {
  edgeCrossingsScore,
  nodeOverlapScore,
  nodeEdgeCrossingsScore,
  densityScore,
  whitespaceBalanceScore,
  computeScores,
} from './scores.js';

export type { RouteCandidate, RouteContext, RouteCost } from './route-cost.js';
export { ROUTE_WEIGHTS, scoreRoute, pickBestRoute } from './route-cost.js';
