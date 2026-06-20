/**
 * Theme — Unified theming contract for all diagram types.
 *
 * Base theme defines shared visual properties (colors, fonts, spacing).
 * Each diagram type may extend with diagram-specific tokens.
 */

// ─── Color Palette ─────────────────────────────────────────────────────────────

export interface ThemePalette {
  /** Primary accent color (edges, active elements) */
  primary: string;
  /** Secondary accent */
  secondary: string;
  /** Background color */
  background: string;
  /** Surface color (node fills) */
  surface: string;
  /** Border/stroke color */
  border: string;
  /** Primary text color */
  text: string;
  /** Muted/secondary text */
  textMuted: string;
  /** Success state */
  success: string;
  /** Warning state */
  warning: string;
  /** Error state */
  error: string;
}

// ─── Typography ────────────────────────────────────────────────────────────────

export interface ThemeTypography {
  fontFamily: string;
  monoFamily: string;
  baseFontSize: number;
  titleFontSize: number;
  smallFontSize: number;
  lineHeight: number;
}

// ─── Spacing ───────────────────────────────────────────────────────────────────

export interface ThemeSpacing {
  /** Base unit in pixels (default: 8) */
  unit: number;
  /** Padding inside nodes */
  nodePadding: number;
  /** Gap between nodes */
  nodeGap: number;
  /** Margin around the entire diagram */
  diagramMargin: number;
}

// ─── Edge Styling ──────────────────────────────────────────────────────────────

export interface ThemeEdges {
  /** Default edge stroke width */
  strokeWidth: number;
  /** Arrow marker size */
  arrowSize: number;
  /** Edge label font size */
  labelFontSize: number;
  /** Curve tension for bezier edges (0 = straight, 1 = full curve) */
  curveTension: number;
}

// ─── Resolved Theme (what layout engines consume) ──────────────────────────────

export interface ResolvedTheme {
  name: string;
  palette: ThemePalette;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  edges: ThemeEdges;
}

// ─── Theme Input (what users provide — partial, merged with defaults) ──────────

export type ThemeInput = Partial<{
  name: string;
  palette: Partial<ThemePalette>;
  typography: Partial<ThemeTypography>;
  spacing: Partial<ThemeSpacing>;
  edges: Partial<ThemeEdges>;
}>;
