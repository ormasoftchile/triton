/**
 * @file grammars/flow/theme.ts — FlowTheme token surface.
 *
 * All styling decisions for flow diagrams live here.
 * Grammar = semantics (topology, node kinds, edge types).
 * Theme   = style  (colors, fonts, geometry, edge routing, orientation).
 *
 * Follows the SequenceTheme / TreeTheme precedent:
 *   - Complete typed token struct (FlowTheme)
 *   - Named default (defaultFlowTheme) with clean, modern pipeline style
 *   - Registry + resolver (FLOW_THEME_REGISTRY / resolveFlowTheme)
 */

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/** Primary layout direction. LR: nodes flow left-to-right (pipeline style). */
export type FlowOrientation = 'LR' | 'TB';

/** Edge routing style for forward connectors. */
export type FlowEdgeStyle = 'straight' | 'elbow' | 'curved';

// ---------------------------------------------------------------------------
// FlowTheme
// ---------------------------------------------------------------------------

/**
 * Complete visual token set for a flow diagram.
 *
 * All geometry, color, typography, and feature-flag tokens live here.
 * The layout engine reads only these tokens — never hardcoded literals.
 *
 * Grammar ≡ semantics: node 'kind' and 'status' carry no visual meaning
 * until the theme maps them to colors via kindFills / statusFills.
 */
export interface FlowTheme {
  // ── Canvas ───────────────────────────────────────────────────────────────
  /** Canvas background color. */
  background: string;
  /** Font family for all text in the diagram. */
  fontFamily: string;

  // ── Layout orientation ───────────────────────────────────────────────────
  /**
   * Primary layout direction.
   * 'LR': nodes flow left-to-right (default, pipeline/sequence style).
   * 'TB': nodes flow top-to-bottom (vertical process flow).
   * Increment-1: LR is fully implemented; TB is a reserved token.
   */
  orientation: FlowOrientation;

  // ── Canvas margins ───────────────────────────────────────────────────────
  /** Canvas left margin (px). */
  marginLeft: number;
  /** Canvas right margin (px). */
  marginRight: number;
  /** Canvas top margin (px). */
  marginTop: number;
  /** Canvas bottom margin (px). */
  marginBottom: number;

  // ── Node geometry ─────────────────────────────────────────────────────────
  /** Horizontal padding inside each node box (left and right sides). */
  nodePadX: number;
  /** Vertical padding inside each node box (top and bottom sides). */
  nodePadY: number;
  /** Minimum node width (px). Expands to fit label + icon if needed. */
  minNodeWidth: number;

  // ── Layout spacing ────────────────────────────────────────────────────────
  /**
   * Gap between adjacent column/rank bands (px).
   * In LR orientation this is the horizontal gap between node right-edge
   * and next-column left-edge.
   */
  layerGap: number;
  /** Gap between adjacent nodes within the same column/rank (px). */
  nodeGap: number;

  // ── Node visual (defaults) ────────────────────────────────────────────────
  /** Default node box fill color. */
  nodeFill: string;
  /** Default node box stroke color. */
  nodeStroke: string;
  /** Default node box stroke width (px). */
  nodeStrokeWidth: number;
  /** Default node box corner radius (rounded-rect shape). */
  nodeRx: number;
  /** Default node label text color. */
  nodeTextColor: string;

  // ── Kind → fill color overrides ──────────────────────────────────────────
  /**
   * Per-kind fill color map. The 'kind' field on a FlowNode selects a fill
   * from this map. If the kind is not listed, nodeFill is used.
   * Note: in the Flow grammar, 'kind' is a shape hint ('stadium', 'circle',
   * etc.) not a semantic category, so kindFills affects ONLY color, not shape.
   * Use separate kindShapes tokens (future) for shape-per-kind overrides.
   */
  kindFills: Record<string, string>;
  /** Per-kind text color overrides. Falls back to nodeTextColor. */
  kindTextColors: Record<string, string>;

  // ── Status → fill color overrides ────────────────────────────────────────
  /**
   * Per-status fill color map. The 'status' field on a FlowNode selects a fill
   * from this map (takes precedence over kindFills).
   */
  statusFills: Record<string, string>;
  /** Per-status text color overrides. Falls back to kindTextColors → nodeTextColor. */
  statusTextColors: Record<string, string>;

  // ── Typography ────────────────────────────────────────────────────────────
  /** Node label font size (px). */
  nodeFontSize: number;
  /** Node label font weight. */
  nodeFontWeight: number | string;
  /** Edge annotation label font size (px). */
  edgeLabelFontSize: number;
  /** Edge annotation label font weight. */
  edgeLabelFontWeight: number | string;
  /** Edge annotation label text color. */
  edgeLabelColor: string;

  // ── Edge routing ──────────────────────────────────────────────────────────
  /**
   * Forward edge routing style.
   * 'curved'  → cubic Bézier from right-center to left-center (default).
   * 'elbow'   → orthogonal (H→V→H) segments.
   * 'straight' → direct straight line.
   */
  edgeStyle: FlowEdgeStyle;
  /** Default edge stroke color. */
  edgeStroke: string;
  /** Default edge stroke width (px). */
  edgeStrokeWidth: number;
  /** Dash pattern for 'dashed' or 'async' edges (CSS stroke-dasharray). */
  edgeDash: string;
  /** Dash pattern for 'dotted' edges (CSS stroke-dasharray). */
  edgeDotted: string;
  /** Dash pattern for 'animated' edges (resting frame in PNG/raster). */
  animatedEdgeDash: string;
  /** Stroke color for animated edges (may differ from normal edge color). */
  animatedEdgeStroke: string;

  // ── Arrowhead ─────────────────────────────────────────────────────────────
  /** Arrowhead half-height (px). Full arrowhead height = 2 * arrowSize. */
  arrowSize: number;
  /** Arrowhead fill color. Defaults to edgeStroke if unset. */
  arrowFill: string;

  // ── Back-edge routing ─────────────────────────────────────────────────────
  /**
   * Vertical distance (px) below the node bottom that back-edge Bézier
   * control points are placed. Larger values create a more pronounced arc.
   */
  backEdgeCurvature: number;
  /** Stroke color for back-edges (feedback arcs). */
  backEdgeStroke: string;
  /** Dash pattern for back-edges. Empty string = solid. */
  backEdgeDash: string;

  // ── Icon support ──────────────────────────────────────────────────────────
  /** Whether to render icons when node.icon is set. */
  showIcons: boolean;
  /** Icon rendering size (px, square). Used when showIcons=true. */
  iconSize: number;
  /** Gap between icon and label text (px). */
  iconLabelGap: number;
}

// ---------------------------------------------------------------------------
// defaultFlowTheme
// ---------------------------------------------------------------------------

/**
 * Default flow theme: clean, modern light-background pipeline style.
 * Curved edges, rounded-rect nodes, blue palette, LR orientation.
 *
 * This default is the only theme in increment-1.
 * Additional named themes (dark, infographic, minimal) are registered
 * in FLOW_THEME_REGISTRY.
 */
export const defaultFlowTheme: FlowTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  orientation: 'LR',

  marginLeft: 40,
  marginRight: 40,
  marginTop: 40,
  marginBottom: 60,  // extra for back-edge arcs below diagram

  nodePadX: 20,
  nodePadY: 12,
  minNodeWidth: 120,

  layerGap: 80,
  nodeGap: 24,

  nodeFill: '#e8f0fe',
  nodeStroke: '#4a6cf7',
  nodeStrokeWidth: 1.5,
  nodeRx: 8,
  nodeTextColor: '#1a1a2e',

  // kind → color: stadium/circle/rect have no special color in default theme
  kindFills: {},
  kindTextColors: {},

  // status → color palette
  statusFills: {
    default: '#e8f0fe',
    active:  '#dbeafe',
    success: '#d1fae5',
    warning: '#fef3c7',
    error:   '#fee2e2',
    muted:   '#f3f4f6',
  },
  statusTextColors: {
    default: '#1a1a2e',
    active:  '#1e40af',
    success: '#065f46',
    warning: '#92400e',
    error:   '#991b1b',
    muted:   '#6b7280',
  },

  nodeFontSize: 13,
  nodeFontWeight: 600,
  edgeLabelFontSize: 11,
  edgeLabelFontWeight: 400,
  edgeLabelColor: '#4b5563',

  edgeStyle: 'curved',
  edgeStroke: '#6b7280',
  edgeStrokeWidth: 1.5,
  edgeDash: '6,4',
  edgeDotted: '2,4',
  animatedEdgeDash: '8,5',
  animatedEdgeStroke: '#4a6cf7',

  arrowSize: 7,
  arrowFill: '#6b7280',

  backEdgeCurvature: 50,
  backEdgeStroke: '#94a3b8',
  backEdgeDash: '5,4',

  showIcons: true,
  iconSize: 14,
  iconLabelGap: 6,
};

// ---------------------------------------------------------------------------
// Theme registry + resolver
// ---------------------------------------------------------------------------

export const FLOW_THEME_REGISTRY: Record<string, FlowTheme> = {
  'default-flow': defaultFlowTheme,
};

/**
 * Resolve a theme by name. Falls back to `defaultFlowTheme` for unknown names.
 */
export function resolveFlowTheme(name?: string): FlowTheme {
  if (!name) return defaultFlowTheme;
  return FLOW_THEME_REGISTRY[name] ?? defaultFlowTheme;
}
