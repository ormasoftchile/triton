/**
 * @file grammars/tree/theme.ts — TreeTheme token surface.
 *
 * All styling decisions for tree diagrams live here.
 * Grammar = semantics (structure, hierarchy, sibling order).
 * Theme  = style  (colors, fonts, geometry, edge style, orientation).
 *
 * Follows the SequenceTheme precedent: a complete typed token struct +
 * a named default + a registry for future named themes.
 */

// ---------------------------------------------------------------------------
// TreeTheme
// ---------------------------------------------------------------------------

/** Edge routing style for parent→child connectors. */
export type TreeEdgeStyle = 'elbow' | 'straight' | 'curved';

/** Tree orientation: root position. v1 supports 'top-down' only. */
export type TreeOrientation = 'top-down' | 'left-right';

/**
 * Complete visual token set for a tree diagram.
 *
 * All geometry, color, typography, and feature-flag tokens live here.
 * The layout engine reads only these tokens — never hardcoded literals.
 */
export interface TreeTheme {
  // ── Canvas ───────────────────────────────────────────────────────────────
  /** Canvas background color. */
  background: string;
  /** Font family for all text in the diagram. */
  fontFamily: string;

  // ── Layout orientation ───────────────────────────────────────────────────
  /**
   * Root placement and growth direction.
   * 'top-down': root at top, children below (default).
   * 'left-right': root at left, children to the right.
   */
  orientation: TreeOrientation;

  // ── Geometry ─────────────────────────────────────────────────────────────
  /** Canvas left margin. */
  marginLeft: number;
  /** Canvas right margin. */
  marginRight: number;
  /** Canvas top margin (above root node). */
  marginTop: number;
  /** Canvas bottom margin (below deepest level). */
  marginBottom: number;

  /** Horizontal padding inside each node box (left and right). */
  nodePadX: number;
  /** Vertical padding inside each node box (top and bottom). */
  nodePadY: number;
  /** Minimum node width (px). Expands to fit label if larger. */
  minNodeWidth: number;

  /**
   * Vertical distance between depth levels (center-to-center of level bands).
   * Maps to the y-gap between a node's bottom edge and the next level's top.
   */
  levelGap: number;
  /** Minimum horizontal gap between adjacent sibling bounding boxes. */
  siblingGap: number;
  /** Minimum horizontal gap between adjacent subtree bounding boxes. */
  subtreeGap: number;

  // ── Node visual ──────────────────────────────────────────────────────────
  /** Default node box fill color. */
  nodeFill: string;
  /** Default node box stroke color. */
  nodeStroke: string;
  /** Default node box stroke width. */
  nodeStrokeWidth: number;
  /** Default node box corner radius (rounded rect). */
  nodeRx: number;
  /** Default node label text color. */
  nodeTextColor: string;

  // ── Kind → color overrides ───────────────────────────────────────────────
  /**
   * Per-kind fill color overrides. The theme may specify different fills for
   * semantic kinds (e.g. { root: '#1e3a5f', chapter: '#2563eb' }).
   * Nodes with a kind not in this map get the default `nodeFill`.
   */
  kindFills: Record<string, string>;
  /**
   * Per-kind text color overrides.
   * Nodes with a kind not in this map get the default `nodeTextColor`.
   */
  kindTextColors: Record<string, string>;

  // ── Typography ───────────────────────────────────────────────────────────
  /** Node label font size (px). */
  nodeFontSize: number;
  /** Node label font weight. */
  nodeFontWeight: number | string;

  // ── Edge style ───────────────────────────────────────────────────────────
  /** Edge routing style: elbow (default), straight, or curved Bézier. */
  edgeStyle: TreeEdgeStyle;
  /** Edge stroke color. */
  edgeStroke: string;
  /** Edge stroke width (px). */
  edgeStrokeWidth: number;
  /**
   * For elbow edges: fraction of levelGap used for the vertical segment
   * before the horizontal jog. Range [0.1, 0.9]. Default 0.5 (midpoint).
   */
  elbowMidFraction: number;

  // ── Icon support ─────────────────────────────────────────────────────────
  /** Whether to render icons when node.icon is set. */
  showIcons: boolean;
  /** Icon rendering size (px, square). Used when showIcons=true. */
  iconSize: number;
  /** Gap between icon and label text (px). */
  iconLabelGap: number;

  // ── Collapsed indicator ──────────────────────────────────────────────────
  /** Whether to render a "+" expander indicator on collapsed nodes. */
  showCollapsedIndicator: boolean;
  /** Expander circle radius. */
  collapsedIndicatorRadius: number;
  /** Expander fill color. */
  collapsedIndicatorFill: string;
  /** Expander text ("+") color. */
  collapsedIndicatorTextColor: string;
}

// ---------------------------------------------------------------------------
// defaultTreeTheme
// ---------------------------------------------------------------------------

/**
 * Default tree theme: clean, modern light-background org-chart style.
 * Elbow connectors, rounded nodes, 3-level kind color hierarchy.
 */
export const defaultTreeTheme: TreeTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  orientation: 'top-down',

  marginLeft: 40,
  marginRight: 40,
  marginTop: 40,
  marginBottom: 40,

  nodePadX: 18,
  nodePadY: 10,
  minNodeWidth: 100,

  levelGap: 70,
  siblingGap: 20,
  subtreeGap: 30,

  nodeFill: '#e8eaf6',
  nodeStroke: '#5c6bc0',
  nodeStrokeWidth: 1.5,
  nodeRx: 6,
  nodeTextColor: '#1a237e',

  // Root gets a darker accent; chapters get medium blue; sections use default.
  kindFills: {
    root:    '#3949ab',
    chapter: '#5c6bc0',
    section: '#c5cae9',
  },
  kindTextColors: {
    root:    '#ffffff',
    chapter: '#ffffff',
    section: '#1a237e',
  },

  nodeFontSize: 13,
  nodeFontWeight: 600,

  edgeStyle: 'elbow',
  edgeStroke: '#9fa8da',
  edgeStrokeWidth: 1.5,
  elbowMidFraction: 0.5,

  showIcons: false,
  iconSize: 16,
  iconLabelGap: 6,

  showCollapsedIndicator: true,
  collapsedIndicatorRadius: 8,
  collapsedIndicatorFill: '#5c6bc0',
  collapsedIndicatorTextColor: '#ffffff',
};

// ---------------------------------------------------------------------------
// Theme registry
// ---------------------------------------------------------------------------

export const TREE_THEME_REGISTRY: Record<string, TreeTheme> = {
  'default-tree': defaultTreeTheme,
};

/**
 * Resolve a theme name to a TreeTheme.
 * Falls back to `defaultTreeTheme` for unknown names.
 */
export function resolveTreeTheme(name?: string): TreeTheme {
  if (!name) return defaultTreeTheme;
  return TREE_THEME_REGISTRY[name] ?? defaultTreeTheme;
}
