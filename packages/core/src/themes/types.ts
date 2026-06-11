/**
 * @file themes/types.ts — ResolvedTheme interface.
 *
 * A ResolvedTheme is the fully-expanded, data-independent styling record for
 * a single built-in or custom theme.  It contains no IR content — only style
 * properties and constants.  The layout engine consumes ResolvedTheme to
 * assign colours, sizes, and spacing to every scene primitive it emits.
 */

import type { Status } from '../types.js';
import type { SceneBackground, SceneEffect } from '../scene.js';

// ---------------------------------------------------------------------------
// Sub-blocks
// ---------------------------------------------------------------------------

/**
 * Optional art-effect tokens for Tier-3 themes.
 *
 * When present, the layout engine GATES effect attachment to these primitives.
 * All effects use fallback-policy 'omit': the SVG backend ignores them silently,
 * preserving byte-identical output.  The Skia backend renders them in full.
 */
export interface EffectTokens {
  /** Effects applied to milestone node markers (circle / diamond / triangle). */
  nodeEffects?: SceneEffect[];
  /** Effects applied to card background rects (vertical-spine entryStyle:'card'). */
  cardEffects?: SceneEffect[];
  /** Effects applied to activity bar rects. */
  activityEffects?: SceneEffect[];
}

export interface CanvasTheme {
  width: number;
  backgroundColor: string;
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface TypographyTheme {
  fontFamily: string;
  /** Comma-separated CSS fallback stack (appended after fontFamily). */
  fontFamilyFallback: string;
  fontSizeBase: number;   // pt
  fontSizeAxis: number;   // pt
  fontSizeTitle: number;  // pt
  fontSizeSubtitle: number; // pt
  fontSizeTrack: number;  // pt
  fontWeightLabel: number;
  fontWeightAxis: number;
  fontWeightHeader: number;
  /** Fill colour for the document title text element. */
  titleColor: string;
  /**
   * Optional override for year / axis-tick labels in the vertical-spine layout.
   * When set, spine tick labels use this size (pt) and `fontWeightHeader` (bold).
   * When unset the layout falls back to `fontSizeAxis` with `fontWeightAxis`.
   * Existing themes that do not set this token are completely unaffected —
   * their golden outputs do NOT change.
   */
  fontSizeYearLabel?: number;
}

export interface AxisTheme {
  height: number;
  tickHeight: number;
  tickLabelOffset: number;
  gridlineColor: string;
  gridlineWidth: number;
  gridlineOpacity: number;
  gridlineStyle: 'solid' | 'dashed' | 'none';
  /** Stroke colour for the axis baseline and tick marks. */
  axisLineColor: string;
  /** Fill colour for tick label text. */
  tickLabelColor: string;
  todayMarker: {
    enabled: boolean;
    color: string;
    width: number;
    style: 'solid' | 'dashed';
  };
}

export interface TrackTheme {
  headerWidth: number;
  rowHeight: number;
  subLaneHeight: number;
  maxSubLanes: number;
  rowGap: number;
  headerFontSize: number; // pt
  headerFontWeight: number;
  headerColor: string;
  headerBackground: string | null;
  separatorColor: string;
  separatorWidth: number;
}

export interface ActivityTheme {
  barHeight: number;
  barRadius: number;
  barTopMargin: number;
  minWidth: number;
  labelInsideMinWidth: number;
  labelFontSize: number; // pt
  labelColorInside: string;
  labelColorOutside: string;
  labelTruncateChars: number;
  /** Height (px) of the progress-fill strip at the bar bottom (§5 progress indicator). */
  progressBarHeight: number;
  /** Fill colour of the progress strip overlay. */
  progressFillColor: string;
  /** Opacity of the progress strip overlay in [0, 1]. */
  progressFillOpacity: number;
}

/** Shape style for milestone markers. */
export type MilestoneShape = 'diamond' | 'circle' | 'triangle';

export interface MilestoneTheme {
  /** Visual shape for milestone markers. */
  shape: MilestoneShape;
  /**
   * For 'circle': radius in px.
   * For 'diamond': half-diagonal in px.
   */
  size: number;
  strokeWidth: number;
  strokeColor: string;
  /** Show a sequential ordinal number (01, 02, …) inside each marker. */
  showOrdinalNumber: boolean;
  ordinalFontSize: number;  // pt
  ordinalFontWeight: number;
  ordinalColor: string;
  /** Place the date label ABOVE the marker centre (T2 style). */
  dateLabelAbove: boolean;
  dateLabelFontSize: number; // pt
  dateLabelFontWeight: number;
  dateLabelColor: string;
  /** Place the title label BELOW the marker centre (T2 style). */
  titleLabelBelow: boolean;
  titleLabelFontSize: number; // pt
  titleLabelFontWeight: number;
  titleLabelColor: string;
  /** Gap between marker edge and the nearest label baseline. */
  labelGapPx: number;
  /** Horizontal offset from diamond right vertex to label left (classic style). */
  labelOffsetX: number;
  labelMaxWidth: number;
  labelStackOffset: number;
  stackOffsetY: number;
  /**
   * Colour used to draw icon glyphs inside node markers.
   * Defaults to `ordinalColor` when not set.
   */
  iconColor?: string;
  /**
   * Scale factor applied to the 24×24 icon viewBox relative to the node size.
   * A value of 1.0 means the icon fills the full node diameter; 0.65 is a comfortable fit.
   * Defaults to 0.65 when not set.
   */
  iconScale?: number;

  // ── Dense-milestone decluttering tokens (Barbara, phase-2 polish) ────────

  /**
   * Minimum horizontal gap between adjacent decluttered node centers (px).
   * Default: 2 × size + 6.
   */
  minNodeGap?: number;
  /**
   * Stroke colour for declutter leader ticks and block leader lines.
   * Defaults to `dateLabelColor`.
   */
  leaderColor?: string;
  /**
   * Stroke width for leader lines (px). Default: 0.75.
   */
  leaderWidth?: number;
  /**
   * Vertical gap between label tiers (px). Default: 6.
   */
  blockTierGap?: number;
}

export interface StatusStyle {
  fill: string;
  stroke: string;
  opacity: number;
  pattern: 'solid' | 'diagonal-hatch' | 'dashed-border';
}

export interface LegendTheme {
  /** Corner to place the legend block. */
  position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  /** Inner padding on all sides in px. */
  padding: number;
  /** Colour swatch width & height in px. */
  swatchSize: number;
  swatchRadius: number;
  /** Vertical gap between swatch rows in px. */
  rowGap: number;
  /** Gap between swatch and label in px. */
  swatchLabelGap: number;
  labelFontSize: number; // pt
  labelFontWeight: number;
  labelColor: string;
  titleFontSize: number; // pt
  titleFontWeight: number;
  titleColor: string;
  titleBottomGap: number;
  /** Max width of the legend panel in px. */
  maxWidth: number;
}

export interface SectionTheme {
  /** Opacity of even-index section band fill (0–1). */
  bandOpacityEven: number;
  /** Opacity of odd-index section band fill (0–1). */
  bandOpacityOdd: number;
  /** Fill colour for even-index section bands. */
  bandFillEven: string;
  /** Fill colour for odd-index section bands. */
  bandFillOdd: string;
  /** Label font size in pt. */
  labelFontSize: number;
  labelFontWeight: number;
  labelColor: string;
  /** Opacity of the section label text. */
  labelOpacity: number;
}

// ---------------------------------------------------------------------------
// Root resolved-theme
// ---------------------------------------------------------------------------

export interface ResolvedTheme {
  id: string;
  /** Display name. */
  title: string;
  /** Fidelity tier: 0 = Minimal, 1 = Crisp, 2 = Polished, 3 = Showcase. */
  tier: number;

  canvas: CanvasTheme;
  typography: TypographyTheme;
  axis: AxisTheme;
  track: TrackTheme;
  activity: ActivityTheme;
  milestone: MilestoneTheme;
  legend: LegendTheme;
  section: SectionTheme;

  /** Complete status → style map (all 7 Status values must be present). */
  statusMap: Record<Status, StatusStyle>;

  /** Optional category-id → { fill, stroke } override map. */
  categoryMap: Record<string, { fill: string; stroke: string }>;

  /**
   * Entry display style for the vertical-spine layout family.
   *   'card'  — rounded rect background + status-coloured border around each entry block.
   *   'plain' — text only; no background rect.
   * Defaults to 'plain' when not set.  Has NO effect on horizontal layout output.
   */
  entryStyle?: 'card' | 'plain';

  /**
   * Optional declarative background for Skia rendering (Tier-3 Showcase).
   * When set, passed through to Scene.sceneBackground.  SVG backend ignores it.
   */
  sceneBackground?: SceneBackground;

  /**
   * Optional art-effect tokens (Tier-3 Showcase).  When present, the layout
   * engine attaches the specified SceneEffect[] to the relevant primitives.
   * The SVG backend ignores all effects — output is byte-identical.
   */
  effects?: EffectTokens;
}
