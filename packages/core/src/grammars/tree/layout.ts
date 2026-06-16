/**
 * @file grammars/tree/layout.ts — Tree Grammar layout engine.
 *
 * `layoutTree(doc, themeOverride?)` produces a DETERMINISTIC Scene from a
 * validated TreeDocument using the Buchheim–Jünger–Leipert (2002) tidy-tree
 * algorithm:
 *   - Phase 1 (firstWalk): bottom-up preliminary x assignment with thread
 *     contour walking to ensure non-overlapping subtrees.
 *   - Phase 2 (secondWalk): top-down accumulation of mod values to compute
 *     final x positions.
 *   - Phase 3: normalize coordinates (shift so leftmost node is at marginLeft),
 *     then emit Scene primitives.
 *
 * Complexity: O(n) time and O(n) space.
 * Determinism: pure function over tree structure + sibling order + theme tokens.
 * No randomness, no iteration count, no convergence criterion.
 *
 * Scene primitives emitted (all existing kernel types — no extensions):
 *   - RectPrimitive: node box (rounded rect, theme-styled)
 *   - TextPrimitive: node label (centered in box)
 *   - PathPrimitive: parent→child edge (elbow / straight / curved per theme)
 *   - CirclePrimitive + TextPrimitive: collapsed-node expander indicator
 *
 * All styling is READ FROM THE THEME — no hardcoded colors or geometry.
 */

import type { Scene, ScenePrimitive } from '../../scene.js';
import type { TreeDocument, TreeNode } from './types.js';
import { measureText } from '../../fonts/metrics.js';
import type { TreeTheme } from './theme.js';
import { defaultTreeTheme, resolveTreeTheme } from './theme.js';
import { getIcon } from '../../icons.js';
import { splitLabelLines } from '../../util/label-lines.js';

// ---------------------------------------------------------------------------
// Rounding helper — round-half-up to integer (§5.1 item 3)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Internal layout node — wraps TreeNode with BJ+L working fields
// ---------------------------------------------------------------------------

interface LayoutNode {
  // Source
  treeNode: TreeNode;
  label: string;
  // Hierarchy
  parent: LayoutNode | null;
  children: LayoutNode[];
  depth: number;
  childIndex: number;  // index among siblings (0-based)
  // Node size (computed from label + theme)
  w: number;
  h: number;
  // BJ+L working fields
  prelim: number;
  mod: number;
  shift: number;
  change: number;
  thread: LayoutNode | null;
  ancestor: LayoutNode;  // initially = self
  // Final position (after secondWalk + normalize)
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Build internal layout tree
// ---------------------------------------------------------------------------

function buildLayoutTree(
  node: TreeNode,
  parent: LayoutNode | null,
  depth: number,
  childIndex: number,
  tk: TreeTheme,
  collapseAtParent: boolean,
): LayoutNode {
  const lines = splitLabelLines(node.label);
  const iconW = (tk.showIcons && node.icon && getIcon(node.icon))
    ? tk.iconSize + tk.iconLabelGap
    : 0;
  // Width: widest line among all label lines
  const textW = lines.reduce(
    (max, line) => Math.max(max, rhuInt(measureText(line, tk.nodeFontSize).width)),
    0,
  );
  const w = Math.max(textW + iconW + 2 * tk.nodePadX, tk.minNodeWidth);
  const lineHeight = rhuInt(tk.nodeFontSize * 1.4);
  const h = rhuInt(lineHeight * lines.length + 2 * tk.nodePadY);

  const ln: LayoutNode = {
    treeNode: node,
    label: node.label,
    parent,
    children: [],
    depth,
    childIndex,
    w,
    h,
    prelim: 0,
    mod: 0,
    shift: 0,
    change: 0,
    thread: null,
    ancestor: null!,  // set immediately below
    x: 0,
    y: 0,
  };
  ln.ancestor = ln;  // self-reference

  // If this node is collapsed (or its parent was, cascade), don't add children
  const isCollapsed = node.collapsed === true;

  if (!collapseAtParent && !isCollapsed) {
    const kids = node.children ?? [];
    for (let i = 0; i < kids.length; i++) {
      // kids[i] is always defined in range [0, length)
      ln.children.push(buildLayoutTree(kids[i]!, ln, depth + 1, i, tk, false));
    }
  }

  return ln;
}

// ---------------------------------------------------------------------------
// BJ+L helper functions
// ---------------------------------------------------------------------------

/** Left sibling of v (same parent, previous in children array). */
function leftSibling(v: LayoutNode): LayoutNode | null {
  if (!v.parent || v.childIndex === 0) return null;
  return v.parent.children[v.childIndex - 1] ?? null;
}

/** Leftmost sibling of v (including v if it IS the leftmost). */
function leftmostSibling(v: LayoutNode): LayoutNode {
  if (!v.parent) return v;
  return v.parent.children[0] ?? v;
}

/** Minimum separation between two nodes (center-to-center gap). */
function separation(v: LayoutNode, w: LayoutNode, tk: TreeTheme): number {
  // Half-widths plus the appropriate gap
  return rhuInt((v.w + w.w) / 2) + tk.siblingGap;
}

/** Next node on the left contour after v (going down the tree). */
function nextLeft(v: LayoutNode): LayoutNode | null {
  return v.children.length > 0 ? (v.children[0] ?? null) : v.thread;
}

/** Next node on the right contour after v (going down the tree). */
function nextRight(v: LayoutNode): LayoutNode | null {
  return v.children.length > 0 ? (v.children[v.children.length - 1] ?? null) : v.thread;
}

/** MOVESUBTREE: shift the subtree of wR by the overlap amount `shift`. */
function moveSubtree(wL: LayoutNode, wR: LayoutNode, shift: number): void {
  const subtrees = wR.childIndex - wL.childIndex;
  if (subtrees > 0) {
    wR.change -= shift / subtrees;
    wR.shift += shift;
    wL.change += shift / subtrees;
    wR.prelim += shift;
    wR.mod += shift;
  }
}

/**
 * ANCESTOR: return the ancestor of vim that is a sibling of v,
 * or defaultAncestor if none found.
 */
function ancestor(
  vim: LayoutNode,
  v: LayoutNode,
  defaultAncestor: LayoutNode,
): LayoutNode {
  // vim.ancestor is a sibling of v if they share a parent
  if (vim.ancestor.parent === v.parent) {
    return vim.ancestor;
  }
  return defaultAncestor;
}

/** EXECUTESHIFT: propagate accumulated shift/change values left-to-right. */
function executeShifts(v: LayoutNode): void {
  let shift = 0;
  let change = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i]!;
    w.prelim += shift;
    w.mod += shift;
    change += w.change;
    shift += w.shift + change;
  }
}

/**
 * APPORTION: walk the inner contours of adjacent subtrees, detect overlaps,
 * and call moveSubtree to resolve them.
 */
function apportion(
  v: LayoutNode,
  defaultAncestor: LayoutNode,
  tk: TreeTheme,
): LayoutNode {
  const w = leftSibling(v);
  if (w === null) return defaultAncestor;

  // Inner right contour of left subtree (vim), outer right contour of left subtree (vom)
  // Inner left contour of right subtree (vip), outer left contour of right subtree (vop)
  let vip: LayoutNode = v;
  let vop: LayoutNode = v;
  let vim: LayoutNode = w;
  let vom: LayoutNode = leftmostSibling(v);

  let sip = vip.mod;
  let sop = vop.mod;
  let sim = vim.mod;
  let som = vom.mod;

  while (nextRight(vim) !== null && nextLeft(vip) !== null) {
    vim = nextRight(vim)!;
    vip = nextLeft(vip)!;
    vom = nextLeft(vom)!;
    vop = nextRight(vop)!;
    vop.ancestor = v;

    const shift =
      (vim.prelim + sim) - (vip.prelim + sip) + separation(vim, vip, tk);
    if (shift > 0) {
      moveSubtree(ancestor(vim, v, defaultAncestor), v, shift);
      sip += shift;
      sop += shift;
    }

    sim += vim.mod;
    sip += vip.mod;
    som += vom.mod;
    sop += vop.mod;
  }

  // Set threads to bridge contours
  if (nextRight(vim) !== null && nextRight(vop) === null) {
    vop.thread = nextRight(vim);
    vop.mod += sim - sop;
  }
  if (nextLeft(vip) !== null && nextLeft(vom) === null) {
    vom.thread = nextLeft(vip);
    vom.mod += sip - som;
    defaultAncestor = v;
  }

  return defaultAncestor;
}

// ---------------------------------------------------------------------------
// Phase 1: firstWalk (bottom-up)
// ---------------------------------------------------------------------------

function firstWalk(v: LayoutNode, tk: TreeTheme): void {
  if (v.children.length === 0) {
    // Leaf node
    const ls = leftSibling(v);
    if (ls !== null) {
      v.prelim = ls.prelim + separation(ls, v, tk);
    } else {
      v.prelim = 0;
    }
  } else {
    let defaultAncestor = v.children[0]!;
    for (const w of v.children) {
      firstWalk(w, tk);
      defaultAncestor = apportion(w, defaultAncestor, tk);
    }
    executeShifts(v);

    const leftmostChild = v.children[0]!;
    const rightmostChild = v.children[v.children.length - 1]!;
    const midpoint = (leftmostChild.prelim + rightmostChild.prelim) / 2;

    const ls = leftSibling(v);
    if (ls !== null) {
      v.prelim = ls.prelim + separation(ls, v, tk);
      v.mod = v.prelim - midpoint;
    } else {
      v.prelim = midpoint;
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: secondWalk (top-down — accumulate mod)
// ---------------------------------------------------------------------------

function secondWalk(
  v: LayoutNode,
  m: number,
  depth: number,
  tk: TreeTheme,
): void {
  v.x = v.prelim + m;
  v.y = depth * (v.h + tk.levelGap);
  for (const child of v.children) {
    secondWalk(child, m + v.mod, depth + 1, tk);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: normalize x so leftmost node edge is at marginLeft
// ---------------------------------------------------------------------------

function findMinX(v: LayoutNode): number {
  let min = v.x - v.w / 2;
  for (const child of v.children) {
    min = Math.min(min, findMinX(child));
  }
  return min;
}

function findMaxX(v: LayoutNode): number {
  let max = v.x + v.w / 2;
  for (const child of v.children) {
    max = Math.max(max, findMaxX(child));
  }
  return max;
}

function findMaxY(v: LayoutNode): number {
  let max = v.y + v.h;
  for (const child of v.children) {
    max = Math.max(max, findMaxY(child));
  }
  return max;
}

function shiftX(v: LayoutNode, dx: number): void {
  v.x += dx;
  for (const child of v.children) {
    shiftX(child, dx);
  }
}

// ---------------------------------------------------------------------------
// Scene primitive emission
// ---------------------------------------------------------------------------

function emitNode(
  v: LayoutNode,
  primitives: ScenePrimitive[],
  tk: TreeTheme,
): void {
  const node = v.treeNode;
  const cx = rhuInt(v.x);
  const cy = rhuInt(v.y + v.h / 2);
  const boxX = rhuInt(v.x - v.w / 2);
  const boxY = rhuInt(v.y);

  // Kind-based fill/text color overrides
  const fill = (node.kind && tk.kindFills[node.kind]) ?? tk.nodeFill;
  const textColor = (node.kind && tk.kindTextColors[node.kind]) ?? tk.nodeTextColor;

  // Node box
  primitives.push({
    kind: 'rect',
    x: boxX,
    y: boxY,
    width: v.w,
    height: v.h,
    fill,
    stroke: tk.nodeStroke,
    strokeWidth: tk.nodeStrokeWidth,
    rx: tk.nodeRx,
  });

  // Icon (if enabled and icon is set)
  let textX = cx;
  if (tk.showIcons && node.icon) {
    const iconDef = getIcon(node.icon);
    if (iconDef) {
      const iconLeft = rhuInt(boxX + tk.nodePadX);
      const iconTop = rhuInt(cy - tk.iconSize / 2);
      const scale = tk.iconSize / 24;
      for (const pathDef of iconDef.paths) {
        primitives.push({
          kind: 'path',
          d: pathDef.d,
          fill: pathDef.fill ? textColor : 'none',
          stroke: pathDef.stroke !== false ? textColor : undefined,
          strokeWidth: pathDef.stroke !== false ? 1.5 : undefined,
          transform: `translate(${iconLeft},${iconTop}) scale(${scale.toFixed(4)})`,
          opacity: 0.8,
        });
      }
      textX = rhuInt(iconLeft + tk.iconSize + tk.iconLabelGap + (v.w - tk.iconSize - tk.iconLabelGap - 2 * tk.nodePadX) / 2);
    }
  }

  // Node label — single or multi-line depending on break markers in the label
  const labelLines = splitLabelLines(node.label);
  if (labelLines.length > 1) {
    const lineHeight = rhuInt(tk.nodeFontSize * 1.4);
    primitives.push({
      kind: 'multitext',
      x: textX,
      y: rhuInt(cy - (labelLines.length - 1) * lineHeight / 2),
      lines: labelLines,
      lineHeight,
      fontFamily: tk.fontFamily,
      fontSize: tk.nodeFontSize,
      fontWeight: tk.nodeFontWeight,
      fill: textColor,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
  } else {
    primitives.push({
      kind: 'text',
      x: textX,
      y: cy,
      text: node.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.nodeFontSize,
      fontWeight: tk.nodeFontWeight,
      fill: textColor,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
  }

  // Collapsed expander indicator (when node.collapsed=true and children exist in original tree)
  const hasHiddenChildren = (node.children ?? []).length > 0;
  if (node.collapsed && hasHiddenChildren && tk.showCollapsedIndicator) {
    const indX = cx;
    const indY = rhuInt(boxY + v.h + 14);
    const r = tk.collapsedIndicatorRadius;
    primitives.push({
      kind: 'circle',
      cx: indX,
      cy: indY,
      r,
      fill: tk.collapsedIndicatorFill,
      stroke: tk.nodeStroke,
      strokeWidth: 1,
    });
    primitives.push({
      kind: 'text',
      x: indX,
      y: indY,
      text: '+',
      fontFamily: tk.fontFamily,
      fontSize: r * 1.3,
      fontWeight: 700,
      fill: tk.collapsedIndicatorTextColor,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
  }
}

function emitEdge(
  parent: LayoutNode,
  child: LayoutNode,
  primitives: ScenePrimitive[],
  tk: TreeTheme,
): void {
  const px = rhuInt(parent.x);
  const py = rhuInt(parent.y + parent.h);
  const cx = rhuInt(child.x);
  const cy = rhuInt(child.y);

  if (tk.edgeStyle === 'straight') {
    primitives.push({
      kind: 'line',
      x1: px,
      y1: py,
      x2: cx,
      y2: cy,
      stroke: tk.edgeStroke,
      strokeWidth: tk.edgeStrokeWidth,
    });
    return;
  }

  if (tk.edgeStyle === 'curved') {
    const midY = rhuInt((py + cy) / 2);
    const d = `M ${px} ${py} C ${px} ${midY} ${cx} ${midY} ${cx} ${cy}`;
    primitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke: tk.edgeStroke,
      strokeWidth: tk.edgeStrokeWidth,
    });
    return;
  }

  // Default: elbow
  const midY = rhuInt(py + (cy - py) * tk.elbowMidFraction);
  const d = `M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`;
  primitives.push({
    kind: 'path',
    d,
    fill: 'none',
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
  });
}

/** Walk all nodes in the layout tree, emitting edges then nodes (painter order). */
function emitAll(
  root: LayoutNode,
  edges: ScenePrimitive[],
  nodes: ScenePrimitive[],
  tk: TreeTheme,
): void {
  for (const child of root.children) {
    emitEdge(root, child, edges, tk);
    emitAll(child, edges, nodes, tk);
  }
  emitNode(root, nodes, tk);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Lay out `doc` using the Buchheim–Jünger–Leipert tidy-tree algorithm and
 * produce a Scene with all nodes, labels, and edges.
 *
 * @param doc - Validated TreeDocument.
 * @param themeOverride - Optional theme (overrides metadata.theme lookup).
 * @returns Deterministic Scene ready for sceneToSvg / svgToPng.
 */
export function layoutTree(doc: TreeDocument, themeOverride?: TreeTheme): Scene {
  const tk = themeOverride ?? resolveTreeTheme(doc.metadata?.theme);

  // Build internal layout tree
  const root = buildLayoutTree(doc.tree.root, null, 0, 0, tk, false);

  // Phase 1: firstWalk (bottom-up — assign prelim + mod)
  firstWalk(root, tk);

  // Phase 2: secondWalk (top-down — compute final x = prelim + mod, y = depth * levelH)
  secondWalk(root, 0, 0, tk);

  // Phase 3: normalize so leftmost node edge starts at marginLeft
  const minX = findMinX(root);
  const dx = tk.marginLeft - minX;
  shiftX(root, dx);

  // Compute canvas dimensions
  const maxX = findMaxX(root);
  const maxY = findMaxY(root);
  const canvasW = rhuInt(maxX + tk.marginRight);
  const canvasH = rhuInt(maxY + tk.marginBottom);

  // Emit primitives: edges first (behind nodes), then nodes
  const edges: ScenePrimitive[] = [];
  const nodes: ScenePrimitive[] = [];
  emitAll(root, edges, nodes, tk);

  // Background rect
  const background: ScenePrimitive = {
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvasW,
    height: canvasH,
    fill: tk.background,
  };

  return {
    width: canvasW,
    height: canvasH,
    background: tk.background,
    primitives: [background, ...edges, ...nodes],
  };
}
