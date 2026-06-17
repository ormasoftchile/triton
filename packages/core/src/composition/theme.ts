/**
 * @file composition/theme.ts — CompositionTheme token surface.
 *
 * All styling decisions for composition posters live here.
 * Grammar = semantics (grid, cells, content types).
 * Theme   = style  (colors, fonts, borders, spacing).
 *
 * Following the SequenceTheme / TreeTheme / FlowTheme precedent:
 *   - Complete typed token struct (CompositionTheme)
 *   - Named default (defaultCompositionTheme)
 *   - Registry + resolver (COMPOSITION_THEME_REGISTRY / resolveCompositionTheme)
 */

// ---------------------------------------------------------------------------
// CompositionTheme
// ---------------------------------------------------------------------------

export interface CompositionTheme {
  // ── Canvas ────────────────────────────────────────────────────────────────
  /** Canvas background color. */
  canvasBackground: string;

  // ── Grid spacing ──────────────────────────────────────────────────────────
  /** Gap between cells in pixels. */
  gap: number;
  /** Outer canvas padding in pixels. */
  padding: number;

  // ── Cell chrome ───────────────────────────────────────────────────────────
  /** Per-cell background fill (CSS color or 'transparent'). */
  cellBackground: string;
  /** Cell border styling. */
  cellBorder: {
    color: string;
    width: number;
    radius: number;
  };
  /**
   * Padding inside the cell border (between border and sub-scene).
   * Applied uniformly on all sides.
   */
  cellPadding: number;

  // ── Cell title ────────────────────────────────────────────────────────────
  /** Font settings for the per-cell panel title. */
  cellTitleFont: {
    family: string;
    size: number;
    weight: number;
    color: string;
  };
  /**
   * Height of the cell title bar in pixels.
   * Computed from fontSize * 1.8 when not set explicitly.
   * Used to offset the sub-scene rect below the title.
   */
  cellTitleHeight: number;
  /** Cell title bar background. */
  cellTitleBackground: string;

  // ── Poster header ─────────────────────────────────────────────────────────
  /** Font settings for the composition (poster) title. */
  posterTitleFont: {
    family: string;
    size: number;
    weight: number;
    color: string;
  };
  /** Height of the poster header area in pixels. */
  posterHeaderHeight: number;
  /** Poster header background. */
  posterHeaderBackground: string;

  // ── Stat cells ────────────────────────────────────────────────────────────
  /** Font for the stat value (the large number). */
  statValueFont: {
    family: string;
    size: number;
    weight: number;
    color: string;
  };
  /** Font for the stat label beneath the value. */
  statLabelFont: {
    family: string;
    size: number;
    weight: number;
    color: string;
  };

  // ── Connector routing ─────────────────────────────────────────────────────
  /**
   * Routing style for overlay connectors (cross-cell links/traces).
   *
   * - 'orthogonal' (default): Manhattan routing with wall-centered exit/entry
   *   points, using vertical/horizontal gutters. Guarantees no diagonal segments.
   * - 'straight': Direct point-to-point routing with wall-centered exit/entry
   *   points. Connectors drawn as straight lines (like class diagram arrows).
   */
  connectorRouting: 'orthogonal' | 'straight';

  // ── Cell content alignment ────────────────────────────────────────────────
  /**
   * Vertical alignment of the sub-scene within the available cell embed area.
   *
   * - 'top'    : sub-scene is anchored at the top of the embed area; excess
   *              vertical space accumulates at the bottom.  Best for mixed
   *              tall/short panels (avoids wide-short diagrams floating in the
   *              middle of a tall row).
   * - 'center' : sub-scene is vertically centered in the embed area.
   * - 'fill'   : treated the same as 'center' (reserved for future stretch mode).
   */
  cellVAlign: 'top' | 'center' | 'fill';

  /**
   * Horizontal alignment of the sub-scene within the available cell embed area.
   *
   * - 'center' : sub-scene is horizontally centered (default).
   * - 'left'   : sub-scene is left-aligned.
   */
  cellHAlign: 'left' | 'center';

  // ── Row sizing ────────────────────────────────────────────────────────────
  /**
   * Controls how row heights are computed.
   *
   * - 'content' (default): each row's height = its own tallest cell content
   *   (+ padding). A row of short diagrams is short; a row with a tall
   *   diagram is tall. Eliminates dead vertical space in mixed-height grids.
   * - 'equal': all rows are normalized to the same height (the global maximum
   *   across all rows). Useful when uniform panel heights are desired.
   */
  rowSizing: 'equal' | 'content';

  // ── Text / title cells ────────────────────────────────────────────────────
  /** Font for text cells. */
  textFont: {
    family: string;
    size: number;
    weight: number;
    color: string;
  };
  /** Font for title cells. */
  titleFont: {
    family: string;
    size: number;
    weight: number;
    color: string;
  };
}

// ---------------------------------------------------------------------------
// Default theme — clean dark poster style
// ---------------------------------------------------------------------------

export const defaultCompositionTheme: CompositionTheme = {
  canvasBackground: '#0f172a',
  gap: 20,
  padding: 28,

  cellBackground: '#1e293b',
  cellBorder: { color: '#334155', width: 1, radius: 10 },
  cellPadding: 12,

  cellTitleFont: { family: 'Inter, sans-serif', size: 13, weight: 600, color: '#94a3b8' },
  cellTitleHeight: 28,
  cellTitleBackground: '#1e293b',

  posterTitleFont: { family: 'Inter, sans-serif', size: 22, weight: 700, color: '#f1f5f9' },
  posterHeaderHeight: 52,
  posterHeaderBackground: '#0f172a',

  statValueFont: { family: 'Inter, sans-serif', size: 48, weight: 700, color: '#38bdf8' },
  statLabelFont: { family: 'Inter, sans-serif', size: 13, weight: 400, color: '#94a3b8' },

  connectorRouting: 'orthogonal',

  cellVAlign: 'top',
  cellHAlign: 'center',

  rowSizing: 'content',

  textFont: { family: 'Inter, sans-serif', size: 14, weight: 400, color: '#cbd5e1' },
  titleFont: { family: 'Inter, sans-serif', size: 20, weight: 700, color: '#f1f5f9' },
};

// ---------------------------------------------------------------------------
// Dark composition theme — ByteByteGo-style cohesive dark poster
// ---------------------------------------------------------------------------

/**
 * Dark poster theme: deep navy canvas, teal-accented cell borders,
 * vivid stat callouts. Designed to pair with dark/BBG grammar themes
 * (dark-flow, dark-tree, bytebytego-sequence) for cohesive infographics.
 */
export const darkCompositionTheme: CompositionTheme = {
  canvasBackground: '#0d1117',
  gap: 16,
  padding: 24,

  cellBackground: '#161b22',
  cellBorder: { color: '#30363d', width: 1, radius: 12 },
  cellPadding: 12,

  cellTitleFont: { family: 'Inter, sans-serif', size: 12, weight: 600, color: '#58a6ff' },
  cellTitleHeight: 28,
  cellTitleBackground: '#161b22',

  posterTitleFont: { family: 'Inter, sans-serif', size: 22, weight: 700, color: '#e6edf3' },
  posterHeaderHeight: 52,
  posterHeaderBackground: '#0d1117',

  statValueFont: { family: 'Inter, sans-serif', size: 48, weight: 700, color: '#2dd4bf' },
  statLabelFont: { family: 'Inter, sans-serif', size: 13, weight: 400, color: '#8b949e' },

  connectorRouting: 'orthogonal',

  cellVAlign: 'top',
  cellHAlign: 'center',

  rowSizing: 'content',

  textFont: { family: 'Inter, sans-serif', size: 14, weight: 400, color: '#c9d1d9' },
  titleFont: { family: 'Inter, sans-serif', size: 20, weight: 700, color: '#e6edf3' },
};

// ---------------------------------------------------------------------------
// Theme registry + resolver
// ---------------------------------------------------------------------------

export const COMPOSITION_THEME_REGISTRY: Record<string, CompositionTheme> = {
  default: defaultCompositionTheme,
  'dark-poster': darkCompositionTheme,
};

export function resolveCompositionTheme(name?: string): CompositionTheme {
  if (!name) return defaultCompositionTheme;
  return COMPOSITION_THEME_REGISTRY[name] ?? defaultCompositionTheme;
}
