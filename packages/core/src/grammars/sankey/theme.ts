/**
 * @file grammars/sankey/theme.ts — Sankey diagram theme definitions.
 *
 * Light + dark themes; node palette + ribbon opacity.
 * All geometry constants (margins, bar width, gaps) live here so the layout
 * engine is fully theme-driven and deterministic.
 */

export interface SankeyTheme {
  background: string;
  fontFamily: string;

  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;

  /** Width (px) of each node bar column. */
  nodeBarWidth: number;
  /** Minimum node bar height (px) — prevents zero-height bars for zero-value nodes. */
  nodeBarMinHeight: number;
  /** Vertical gap (px) between node bars in the same column. */
  nodeGapY: number;

  /** Font size for node labels. */
  labelFontSize: number;
  /** Font weight for node labels. */
  labelFontWeight: number | string;
  /** Color for node labels. */
  labelColor: string;
  /** Gap (px) between node bar edge and label. */
  labelGap: number;

  /** Total canvas height used for Sankey content (not counting margins). */
  contentHeight: number;
  /** Horizontal gap between columns (px). */
  columnGapX: number;

  /** Ribbon fill opacity (0–1). */
  ribbonOpacity: number;
  /** Stroke applied to ribbon boundary (thin, same color as fill). */
  ribbonStrokeWidth: number;

  /**
   * Node color palette — one color per node, cycling.
   * The ribbon for a link uses its source node's color.
   */
  nodePalette: string[];
}

export const defaultSankeyTheme: SankeyTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',

  marginLeft: 16,
  marginRight: 16,
  marginTop: 40,
  marginBottom: 24,

  nodeBarWidth: 18,
  nodeBarMinHeight: 4,
  nodeGapY: 12,

  labelFontSize: 13,
  labelFontWeight: 600,
  labelColor: '#1e293b',
  labelGap: 8,

  contentHeight: 480,
  columnGapX: 180,

  ribbonOpacity: 0.45,
  ribbonStrokeWidth: 0.5,

  nodePalette: [
    '#6366f1', // indigo
    '#f59e0b', // amber
    '#10b981', // emerald
    '#ef4444', // red
    '#3b82f6', // blue
    '#a855f7', // purple
    '#14b8a6', // teal
    '#f97316', // orange
    '#84cc16', // lime
    '#ec4899', // pink
    '#0ea5e9', // sky
    '#8b5cf6', // violet
  ],
};

export const darkSankeyTheme: SankeyTheme = {
  ...defaultSankeyTheme,
  background: '#0f172a',
  labelColor: '#e2e8f0',
  nodePalette: [
    '#818cf8', // indigo-400
    '#fbbf24', // amber-400
    '#34d399', // emerald-400
    '#f87171', // red-400
    '#60a5fa', // blue-400
    '#c084fc', // purple-400
    '#2dd4bf', // teal-400
    '#fb923c', // orange-400
    '#a3e635', // lime-400
    '#f472b6', // pink-400
    '#38bdf8', // sky-400
    '#a78bfa', // violet-400
  ],
};

export const SANKEY_THEME_REGISTRY: Record<string, SankeyTheme> = {
  'default-sankey': defaultSankeyTheme,
  'dark-sankey': darkSankeyTheme,
};

export function resolveSankeyTheme(name?: string): SankeyTheme {
  if (!name) return defaultSankeyTheme;
  return SANKEY_THEME_REGISTRY[name] ?? defaultSankeyTheme;
}
