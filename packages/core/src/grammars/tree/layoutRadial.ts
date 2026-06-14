/**
 * @file grammars/tree/layoutRadial.ts — Radial mindmap layout (opt-in, additive).
 *
 * Produces a radial/organic mindmap Scene from a TreeDocument:
 *   - Root centered at canvas origin; top-level branches radiate outward in all directions.
 *   - Equal angular sectors for top-level branches (clean quadrant distribution).
 *   - Leaf-weighted sub-sectors for deeper nodes (organic proportions).
 *   - Per-branch color from BRANCH_PALETTE; all descendants inherit their branch color.
 *   - Organic cubic-Bézier connectors using the d3-linkRadial formula.
 *   - Radius proportional to depth: r(d) = 170 + (d−1) × 130 px.
 *   - Dynamic root circle sized to label width + padding.
 *
 * ADDITIVE — does not touch the default layoutTree path.
 * Only the mindmap render branch in frontend/mermaid/index.ts calls this function.
 *
 * Determinism: pure function over tree structure + sibling order.
 * No randomness, no iteration, no convergence criterion.
 */

import type { Scene, ScenePrimitive } from '../../scene.js';
import type { TreeDocument, TreeNode } from './types.js';
import { measureText } from '../../fonts/metrics.js';

// ---------------------------------------------------------------------------
// Rounding helper — round-half-up to integer (§5.1 item 3)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Canvas constants
// ---------------------------------------------------------------------------

const CANVAS_W = 1400;
const CANVAS_H = 1000;
const CENTER_X = 700;
const CENTER_Y = 500;
const BG_COLOR = '#ffffff';
const FONT_FAMILY = 'DejaVu Sans, sans-serif';

// ---------------------------------------------------------------------------
// Root appearance
// ---------------------------------------------------------------------------

const ROOT_FONT_SIZE    = 13;
const ROOT_FONT_WEIGHT  = 700;
const ROOT_FILL         = '#1a23e0';
const ROOT_TEXT_COLOR   = '#ffffff';
const ROOT_RADIUS_MIN   = 44;   // minimum circle radius even for short labels
const ROOT_RADIUS_PAD   = 18;   // padding from half-text-width to circle edge

// ---------------------------------------------------------------------------
// Radial depth → radius mapping
// ---------------------------------------------------------------------------

/** r(d) = 170 + (d−1) × 130 for d ≥ 1. Root (d=0) returns 0 (center). */
function depthRadius(d: number): number {
  if (d === 0) return 0;
  return 170 + (d - 1) * 130;
}

// ---------------------------------------------------------------------------
// Per-depth appearance specs
// ---------------------------------------------------------------------------

interface DepthSpec {
  padX: number;
  padY: number;
  fontSize: number;
  fontWeight: number;
  minW: number;
  rx: number;
}

const DEPTH_SPECS: DepthSpec[] = [
  // depth 0 — root (unused here; root rendered as circle)
  { padX: 18, padY: 9, fontSize: 15, fontWeight: 700, minW: 90, rx: 12 },
  // depth 1 — top-level branches
  { padX: 15, padY: 8, fontSize: 14, fontWeight: 700, minW: 80, rx: 10 },
  // depth 2 — secondary nodes
  { padX: 12, padY: 7, fontSize: 13, fontWeight: 600, minW: 68, rx: 8  },
  // depth 3+ — leaf nodes
  { padX: 10, padY: 6, fontSize: 12, fontWeight: 600, minW: 58, rx: 7  },
];

function getSpec(depth: number): DepthSpec {
  return DEPTH_SPECS[Math.min(depth, DEPTH_SPECS.length - 1)]!;
}

// ---------------------------------------------------------------------------
// Edge widths by child depth — thicker closer to root
// ---------------------------------------------------------------------------

const EDGE_WIDTHS = [4.0, 3.0, 2.0, 1.5];

function getEdgeWidth(childDepth: number): number {
  return EDGE_WIDTHS[Math.min(childDepth, EDGE_WIDTHS.length - 1)]!;
}

// ---------------------------------------------------------------------------
// Branch color palette — warm, organic, Mermaid-inspired
// ---------------------------------------------------------------------------

interface BranchColors {
  fill:   string;   // node background fill
  edge:   string;   // connector stroke color
  stroke: string;   // node border (subtle, 1px)
  text:   string;   // node label color
}

const BRANCH_PALETTE: BranchColors[] = [
  { fill: '#ffe066', edge: '#c8a000', stroke: '#d4ac10', text: '#3d3000' },  // warm yellow   (idx 0)
  { fill: '#b8e868', edge: '#64a808', stroke: '#70b010', text: '#1e3400' },  // yellow-green  (idx 1)
  { fill: '#cca8f0', edge: '#8450cc', stroke: '#9060d8', text: '#280058' },  // soft purple   (idx 2)
  { fill: '#f4a0cc', edge: '#c84882', stroke: '#d4588e', text: '#480030' },  // warm pink     (idx 3)
  { fill: '#80d4f0', edge: '#2090c0', stroke: '#30a0d0', text: '#003050' },  // sky blue      (idx 4)
  { fill: '#f4b870', edge: '#c87020', stroke: '#d8803a', text: '#402000' },  // orange        (idx 5)
  { fill: '#a4ecc0', edge: '#30a860', stroke: '#40b870', text: '#004028' },  // mint          (idx 6)
  { fill: '#f0a0a0', edge: '#c84040', stroke: '#d85050', text: '#400000' },  // rose          (idx 7)
];

function getBranchColors(branchIndex: number): BranchColors {
  return BRANCH_PALETTE[branchIndex % BRANCH_PALETTE.length] ?? BRANCH_PALETTE[0]!;
}

// ---------------------------------------------------------------------------
// Internal layout node
// ---------------------------------------------------------------------------

interface RadialNode {
  treeNode:    TreeNode;
  depth:       number;
  branchIndex: number;       // -1 for root, 0-based for top-level branches
  angle:       number;       // center angle (radians)
  sectorStart: number;
  sectorEnd:   number;
  x:           number;       // final x position (pixels, scene space)
  y:           number;       // final y position (pixels, scene space)
  w:           number;       // node box width  (0 for root)
  h:           number;       // node box height (0 for root)
  rootR:       number;       // root circle radius (only used at depth 0)
  parent:      RadialNode | null;
  children:    RadialNode[];
}

// ---------------------------------------------------------------------------
// Leaf counting — sector allocation
// ---------------------------------------------------------------------------

function countLeaves(node: TreeNode): number {
  const kids = node.children ?? [];
  if (kids.length === 0) return 1;
  return kids.reduce((s, k) => s + countLeaves(k), 0);
}

// ---------------------------------------------------------------------------
// Build radial layout tree
// ---------------------------------------------------------------------------

function buildRadialNode(
  node:        TreeNode,
  parent:      RadialNode | null,
  depth:       number,
  branchIndex: number,
  sectorStart: number,
  sectorEnd:   number,
): RadialNode {
  const angle = (sectorStart + sectorEnd) / 2;
  const r     = depthRadius(depth);
  const rawX  = depth === 0 ? CENTER_X : CENTER_X + Math.cos(angle) * r;
  const rawY  = depth === 0 ? CENTER_Y : CENTER_Y + Math.sin(angle) * r;

  // Node box dimensions (root has w=h=0; it's rendered as a circle)
  let w     = 0;
  let h     = 0;
  let rootR = 0;

  if (depth === 0) {
    const measured = measureText(node.label, ROOT_FONT_SIZE);
    rootR = Math.max(ROOT_RADIUS_MIN, rhuInt(measured.width / 2) + ROOT_RADIUS_PAD);
  } else {
    const spec    = getSpec(depth);
    const measured = measureText(node.label, spec.fontSize);
    w = Math.max(rhuInt(measured.width) + 2 * spec.padX, spec.minW);
    h = rhuInt(spec.fontSize * 1.5 + 2 * spec.padY);
  }

  const rn: RadialNode = {
    treeNode: node,
    depth,
    branchIndex,
    angle,
    sectorStart,
    sectorEnd,
    x: rhuInt(rawX),
    y: rhuInt(rawY),
    w,
    h,
    rootR,
    parent,
    children: [],
  };

  const kids = node.children ?? [];
  if (kids.length > 0) {
    if (depth === 0) {
      // Root → L1: EQUAL angular sectors starting at 0° (rightward).
      // For a 4-branch mindmap this places centers at 45°/135°/225°/315°,
      // matching Mermaid's quadrant look exactly.
      const sectorPer = (2 * Math.PI) / kids.length;
      for (let i = 0; i < kids.length; i++) {
        const bStart = i * sectorPer;
        const bEnd   = (i + 1) * sectorPer;
        rn.children.push(buildRadialNode(kids[i]!, rn, 1, i, bStart, bEnd));
      }
    } else {
      // L1+ → deeper: LEAF-WEIGHTED sub-sectors within parent's sector.
      // Gives proportional spacing — dense sub-trees get wider wedges.
      const totalLeaves = kids.reduce((s, k) => s + countLeaves(k), 0);
      const span        = sectorEnd - sectorStart;
      let   a           = sectorStart;
      for (const kid of kids) {
        const kidLeaves = countLeaves(kid);
        const kidSpan   = (kidLeaves / totalLeaves) * span;
        rn.children.push(
          buildRadialNode(kid, rn, depth + 1, branchIndex, a, a + kidSpan),
        );
        a += kidSpan;
      }
    }
  }

  return rn;
}

// ---------------------------------------------------------------------------
// Edge emission — d3-linkRadial cubic Bézier
// ---------------------------------------------------------------------------

function emitEdge(
  parent: RadialNode,
  child:  RadialNode,
  edges:  ScenePrimitive[],
): void {
  const px     = parent.x;
  const py     = parent.y;
  const cx     = child.x;
  const cy     = child.y;
  const colors = getBranchColors(child.branchIndex);
  const sw     = getEdgeWidth(child.depth);

  let d: string;

  if (parent.depth === 0) {
    // Root → L1: cubic Bézier from root center along child's radial direction.
    // Root circle and L1 node rect cover the endpoints visually.
    const rc  = depthRadius(child.depth);
    const cp1x = rhuInt(CENTER_X + Math.cos(child.angle) * rc * 0.35);
    const cp1y = rhuInt(CENTER_Y + Math.sin(child.angle) * rc * 0.35);
    const cp2x = rhuInt(CENTER_X + Math.cos(child.angle) * rc * 0.78);
    const cp2y = rhuInt(CENTER_Y + Math.sin(child.angle) * rc * 0.78);
    d = `M ${px} ${py} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${cx} ${cy}`;
  } else {
    // L1+ → deeper: d3-linkRadial Bézier.
    // Tangent at start ∥ parent radial direction; tangent at end ∥ child radial direction.
    // CP1 = project parent-angle direction out to child radius.
    // CP2 = project child-angle direction in to parent radius.
    const rp   = depthRadius(parent.depth);
    const rc   = depthRadius(child.depth);
    const cp1x = rhuInt(CENTER_X + rc * Math.cos(parent.angle));
    const cp1y = rhuInt(CENTER_Y + rc * Math.sin(parent.angle));
    const cp2x = rhuInt(CENTER_X + rp * Math.cos(child.angle));
    const cp2y = rhuInt(CENTER_Y + rp * Math.sin(child.angle));
    d = `M ${px} ${py} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${cx} ${cy}`;
  }

  edges.push({
    kind: 'path',
    d,
    fill: 'none',
    stroke: colors.edge,
    strokeWidth: sw,
    strokeLinecap: 'round',
  });
}

// ---------------------------------------------------------------------------
// Node emission
// ---------------------------------------------------------------------------

function emitNode(rn: RadialNode, nodes: ScenePrimitive[]): void {
  if (rn.depth === 0) {
    // Root: filled circle with centered label
    nodes.push({
      kind: 'circle',
      cx:   rn.x,
      cy:   rn.y,
      r:    rn.rootR,
      fill: ROOT_FILL,
    });
    nodes.push({
      kind:            'text',
      x:               rn.x,
      y:               rn.y,
      text:            rn.treeNode.label,
      fontFamily:      FONT_FAMILY,
      fontSize:        ROOT_FONT_SIZE,
      fontWeight:      ROOT_FONT_WEIGHT,
      fill:            ROOT_TEXT_COLOR,
      textAnchor:      'middle',
      dominantBaseline:'central',
    });
    return;
  }

  const spec   = getSpec(rn.depth);
  const colors = getBranchColors(rn.branchIndex);

  const boxX = rhuInt(rn.x - rn.w / 2);
  const boxY = rhuInt(rn.y - rn.h / 2);

  // Branch-colored pill node with crisp 1px border
  nodes.push({
    kind:        'rect',
    x:           boxX,
    y:           boxY,
    width:       rn.w,
    height:      rn.h,
    fill:        colors.fill,
    stroke:      colors.stroke,
    strokeWidth: 1,
    rx:          spec.rx,
  });

  // Centered label
  nodes.push({
    kind:            'text',
    x:               rn.x,
    y:               rn.y,
    text:            rn.treeNode.label,
    fontFamily:      FONT_FAMILY,
    fontSize:        spec.fontSize,
    fontWeight:      spec.fontWeight,
    fill:            colors.text,
    textAnchor:      'middle',
    dominantBaseline:'central',
  });
}

// ---------------------------------------------------------------------------
// Recursive emit — edges first (behind nodes), then nodes (painter order)
// ---------------------------------------------------------------------------

function emitAll(
  root:  RadialNode,
  edges: ScenePrimitive[],
  nodes: ScenePrimitive[],
): void {
  for (const child of root.children) {
    emitEdge(root, child, edges);
    emitAll(child, edges, nodes);
  }
  emitNode(root, nodes);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Lay out `doc` as a radial/organic mindmap and produce a Scene.
 *
 * Root centered; branches radiate outward in all directions.
 * ADDITIVE and OPT-IN — the default `layoutTree` is completely unaffected.
 *
 * @param doc - Validated TreeDocument (produced by parseMindmapInternal).
 * @returns Deterministic Scene ready for sceneToSvg / svgToPng.
 */
export function layoutTreeRadial(doc: TreeDocument): Scene {
  // Build radial tree from full-circle sector (0 → 2π)
  const root = buildRadialNode(doc.tree.root, null, 0, -1, 0, 2 * Math.PI);

  const edges: ScenePrimitive[] = [];
  const nodes: ScenePrimitive[] = [];
  emitAll(root, edges, nodes);

  const background: ScenePrimitive = {
    kind:   'rect',
    x:      0,
    y:      0,
    width:  CANVAS_W,
    height: CANVAS_H,
    fill:   BG_COLOR,
  };

  return {
    width:      CANVAS_W,
    height:     CANVAS_H,
    background: BG_COLOR,
    primitives: [background, ...edges, ...nodes],
  };
}
