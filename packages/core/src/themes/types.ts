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
  fontSizeBase: number; // pt
  fontSizeAxis: number; // pt
  fontSizeTitle: number; // pt
  fontSizeSubtitle: number; // pt
  fontSizeTrack: number; // pt
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
  /**
   * Alignment for the document title in the header block.
   *
   * When `undefined` or `'center'` (the historical default), the title is
   * rendered at the canvas horizontal midpoint — matching all existing
   * committed goldens.  Set to `'left'` to left-align the title to the
   * draw-area edge.
   *
   * This token is opt-in: every existing theme leaves it unset, so all
   * existing golden outputs remain byte-identical.
   */
  titleAlign?: 'left' | 'center';
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
    /**
     * When true, draws a small filled background chip (rounded rect) behind the
     * "Today" label so it remains legible over any activity pill underneath.
     * Default: false (absent) — byte-identical to pre-feature behaviour for all
     * existing themes. Only enabled in the `roadmap` theme.
     */
    labelChip?: boolean;
    /**
     * When true, the entire today-marker group (dashed line + chip + label) is
     * deferred to the very end of primitive assembly so it renders on top of all
     * activity bars and milestone nodes.  Default: false (absent) — inline
     * z-order, byte-identical to pre-feature behaviour.  Only enabled in the
     * `roadmap` theme.
     */
    onTop?: boolean;
  };
  /**
   * Controls how the horizontal spine line behaves at each circular milestone node.
   *
   *   'none'       (default) — spine is a single straight line at axisY.
   *                Byte-identical to pre-feature behaviour; no golden may move.
   *
   *   'over-under' — spine routes around each on-axis node's circumference as a
   *                semicircular arc, alternating above (odd nodes) and below (even
   *                nodes).  The arc radius is `ms.size + 3` px so the line hugs
   *                just outside the circle.  Straight segments run between nodes.
   *                Only active in the horizontal layout family.
   */
  nodeWrap?: 'none' | 'over-under';
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
  ordinalFontSize: number; // pt
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
  /**
   * When `true`, milestone title labels wrap to at most 2 lines at word
   * boundaries instead of being truncated to a single line.
   * Default: `false` — single-line truncate, byte-identical with existing renders.
   * Opt-in per theme; currently enabled only by the `roadmap` theme.
   */
  labelWrap?: boolean;
  /**
   * When `true`, the ordinal number (or icon) inside each milestone node is
   * rendered with a WCAG-contrast-aware colour derived from the node's fill:
   * white text on dark fills, dark text on light/white fills.
   *
   * Opt-in: when `undefined` / `false`, the renderer uses `ordinalColor`
   * as always, keeping all existing golden outputs byte-identical.
   */
  ordinalColorContrast?: boolean;
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
// Roadmap layout geometry tokens
// ---------------------------------------------------------------------------

/**
 * Configurable geometry tokens for the roadmap layout family.
 *
 * Every field is optional.  When a field is absent the layout falls back to
 * the hardcoded constant in layout/roadmap.ts, keeping all existing golden
 * outputs byte-identical for themes that do not supply this block.
 *
 * Has NO effect on horizontal, vertical-spine, or serpentine layouts.
 */
export interface RoadmapTheme {
  // ── Padding ──────────────────────────────────────────────────────────────
  /** Horizontal padding inside the callout text block (px). Default: 6. */
  calloutHPad?: number;
  /** Vertical padding inside the callout text block (px). Default: 4. */
  calloutVPad?: number;
  /** Extra horizontal outward padding on the goal-milestone outlined box (px). Default: 9. */
  goalBoxPadX?: number;
  /** Extra top padding on the goal-milestone outlined box (px). Default: 6. */
  goalBoxPadTop?: number;
  /** Extra bottom padding on the goal-milestone outlined box (px). Default: 3. */
  goalBoxPadBottom?: number;

  // ── Gaps / separation ────────────────────────────────────────────────────
  /** Vertical gap between header bottom edge and callout row top (px). Default: 16. */
  headerCalloutGap?: number;
  /** Vertical gap between callout block bottoms and phase band top (px). Default: 6. */
  leaderGap?: number;
  /** Vertical gap between phase band bottom and axis line (px). Default: 4. */
  axisBelowGap?: number;
  /** Vertical gap between axis line and date label baseline (px). Default: 3. */
  axisLabelGap?: number;
  /** Minimum horizontal gap between adjacent callout block edges during de-collision (px). Default: 12. */
  milestoneGap?: number;
  /** Vertical gap between wrapped title lines inside a callout block (px). Default: 2. */
  titleLineGap?: number;

  // ── Sizes ─────────────────────────────────────────────────────────────────
  /** Height of the continuous phase band pills (px). Default: 56. */
  pillHeight?: number;
  /** Radius of the icon badge circle inside each phase pill (px). Default: 18. */
  badgeRadius?: number;
  /** Multiplier applied to the pill fill colour to derive the badge fill (0–1). Default: 0.65. */
  badgeDarkFrac?: number;
  /** Radius of the filled dot at the band top edge where each leader line lands (px). Default: 4. */
  dotRadius?: number;
  /** Maximum callout text-block width before the label wraps to a second line (px). Default: 130. */
  calloutWrapWidth?: number;
  /** Fixed pixel width consumed by each axis-break gap. Default: 24. */
  breakGapPx?: number;
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
   * Controls y-position placement of entries in the vertical-spine layout.
   *   'time'  (default) — positions are strictly time-proportional (§5 original behaviour).
   *             Empty years between sparse entries consume proportional vertical space.
   *   'even'  — entries are placed at uniform intervals regardless of temporal gaps.
   *             Suitable for infographic/sequence timelines that span decades but have
   *             only O(20) entries: avoids the giant dead-space problem that arises when
   *             pixelsPerDay hits its 0.4 floor on a 57-year sparse range.
   *
   *   In 'even' mode for vertical-spine, duration bands (fixed start→end spans) are
   *   still rendered on the spine, but their end y-coordinate is determined by linear
   *   interpolation between the two adjacent entry positions that bracket the end ordinal.
   *
   *   In 'even' mode for horizontal layout, milestones are placed at uniform x-intervals
   *   (Mermaid-columnar style). Axis tick marks are suppressed (they would be misleading
   *   at non-proportional positions); milestone label blocks carry the actual dates.
   *   The canvas width expands automatically if the default width is too narrow for the
   *   minimum column spacing. Section bands are derived from milestone track membership.
   *
   * Defaults to 'time' when not set. Existing themes that do not set this token are
   * completely unaffected — their golden outputs do NOT change.
   */
  spineSpacing?: 'time' | 'even';

  /**
   * Optional art-effect tokens (Tier-3 Showcase).  When present, the layout
   * engine attaches the specified SceneEffect[] to the relevant primitives.
   * The SVG backend ignores all effects — output is byte-identical.
   */
  effects?: EffectTokens;

  // ── Card CTA button tokens (T5-1) ─────────────────────────────────────────

  /**
   * Label text for the CTA button rendered at the bottom of card entries that
   * have a `url` field.  When undefined, no button is rendered.
   * Existing themes that omit this token are completely unaffected.
   * Example: 'VIEW REPOSITORY' (gitline theme).
   */
  cardCtaLabel?: string;

  /**
   * Fill colour for the CTA button background rect.
   * Defaults to 'transparent' when not set.
   */
  cardCtaFill?: string;

  /**
   * Text colour for the CTA button label.
   * Defaults to the canvas backgroundColor's contrasting colour (white on dark, dark on light).
   */
  cardCtaTextColor?: string;

  /**
   * Corner radius of the CTA button pill rect (px).
   * Defaults to half the button height (true pill) when not set.
   */
  cardCtaRadius?: number;

  /**
   * Stroke/border colour for the CTA button outline.
   * Defaults to the CTA text colour when not set.
   */
  cardCtaBorderColor?: string;

  /**
   * Stroke/border width for the CTA button outline (px).
   * Defaults to 1.0 when not set.
   */
  cardCtaBorderWidth?: number;

  // ── Inline date icon token (T5-2) ─────────────────────────────────────────

  /**
   * Name of an icon from the built-in registry to render inline immediately
   * before the date text in card entries.  When undefined, no icon is shown
   * and existing card themes are completely unaffected.
   * Example: 'clock' (gitline theme).
   */
  cardDateIcon?: string;

  // ── T2 vertical-spine features ─────────────────────────────────────────────

  /**
   * T2-1: When true, the central spine is drawn as per-segment coloured lines
   * where each segment between consecutive entry nodes uses that entry's resolved
   * colour (milestone.color / activity.color → statusFill).  The segment from
   * spineTopY to the first node uses the first entry's colour; the last segment
   * from the last node to spineBottomY uses the last entry's colour.
   *
   * Opt-in.  Default: false → single-colour spine (axisLineColor, unchanged).
   * Existing themes that do not set this token are completely unaffected.
   */
  spineSegmentColor?: boolean;

  /**
   * T2-2: Controls icon badge placement in the vertical-spine layout.
   *
   * 'inline' (default): small badge at the top corner of the content block —
   *   the current behaviour; all existing themes are byte-identical.
   * 'edge': large circular badge pinned to the canvas edge on the entry's text
   *   side, containing the entry's icon via getIcon(), plus a DASHED horizontal
   *   leader line from the spine node to the badge.  The badge is sized to
   *   EDGE_BADGE_R (28 px) and centred vertically at the node Y.
   *
   * Has no effect when the entry has no icon hint.
   */
  badgePlacement?: 'inline' | 'edge';

  /**
   * T2-3: When true, renders a small filled chevron/arrow at each spine node
   * pointing toward the entry's text side (right-pointing ">" for right entries,
   * left-pointing "<" for left entries).  Drawn after the node circle.
   *
   * Opt-in.  Default: false (no chevron, byte-identical for existing themes).
   */
  spineNodeArrow?: boolean;

  /**
   * T2-5: When true, the date/year text in the content block and the entry label
   * (acting as a subject heading) are rendered in the entry's resolved colour
   * (entry.statusFill) rather than the theme's default label colours.  Also,
   * when fontSizeYearLabel is set, the date/year line in the content block uses
   * that size (making it a large coloured year label matching the T2 target).
   *
   * When this token is active AND spineSpacing='even', the even-mode year tick
   * labels on the spine are suppressed (the year is shown inside the content
   * block instead).
   *
   * Opt-in.  Default: false (uses theme.milestone.dateLabelColor, byte-identical).
   */
  yearLabelUsesEntryColor?: boolean;

  /**
   * T2: Override fill colour for spine node markers.  When set, ALL spine node
   * markers use this fill instead of entry.statusFill.  The statusFill continues
   * to be used for spine segments, connectors, edge badges, and text colours.
   *
   * Typical use: white dots on a dark background while entry colours drive the spine.
   * Opt-in: existing themes are unaffected.
   */
  spineNodeFillOverride?: string;

  // ── Serpentine layout theme tokens (T4) ───────────────────────────────────────

  /**
   * Styling tokens specific to the serpentine (boustrophedon) layout family.
   * When absent, the serpentine layout uses hardcoded defaults.
   * Has NO effect on horizontal or vertical-spine layouts.
   */
  serpentine?: {
    /** Stroke width of the main path in px. Default: 14. */
    pathStrokeWidth: number;
    /** Gradient start colour (path beginning). */
    gradientFrom: string;
    /** Gradient end colour (path end). */
    gradientTo: string;
    /** Glow effect colour (Skia only). */
    glowColor: string;
    /** Glow effect radius px (Skia only). */
    glowRadius: number;
    /** Radius of dot-node circles at each entry. */
    nodeRadius: number;
    /** Fill colour of dot nodes. */
    nodeFill: string;
    /** Stroke colour of dot nodes. */
    nodeStroke: string;
    /** Stroke width of dot nodes. */
    nodeStrokeWidth: number;
    /** Icon name (from built-in registry) for the start-of-path badge. */
    startIcon?: string;
    /** Icon name (from built-in registry) for the end-of-path badge. */
    endIcon?: string;
    /** Radius of the start/end icon badge circles. */
    badgeRadius: number;
    /** Fill colour of the icon badges. */
    badgeFill: string;
    /** Colour of the icon rendered inside badges. */
    badgeIconColor: string;
    /** Vertical distance between serpentine rows in px. Must equal 2 × turnRadius. */
    rowSpacing: number;
    /** Radius of the semicircular U-turns in px. Must equal rowSpacing / 2. */
    turnRadius: number;
    /** When true, renders entry labels near each node. Default: true. */
    showLabels?: boolean;
    /** Label text colour. */
    labelColor?: string;
    /** Label font size in pt. */
    labelFontSize?: number;
  };

  /**
   * Geometry tokens for the roadmap layout family.
   * When absent, the roadmap layout falls back to its hardcoded constant
   * defaults, preserving byte-identical output for all other themes.
   * Has NO effect on horizontal, vertical-spine, or serpentine layouts.
   */
  roadmap?: RoadmapTheme;
}
