/**
 * @file themes/contract-binding.ts — Tier-3 timeline contract binding.
 *
 * `bindTimelineTheme(contract)` derives a full `ResolvedTheme` from a
 * Tier-2 `ThemeContract`.  This is the deepest binding in the codebase:
 * it covers canvas, typography, axis, track, milestone, activity bar,
 * legend, section bands, status map, and layout flags.
 *
 * ## Tier-2 → Tier-3 derivation conventions
 *
 *   - Axis lines use `palette.ink`       (authoritative, legible)
 *   - Gridlines use `palette.border`     (subtle, structural)
 *   - Track separator uses `palette.border`
 *   - Track header bg uses `palette.surfacePanel`
 *   - Activity bar radius = `min(shape.cornerRadius, barHeight / 2)`
 *   - Marker shape = `shape.markerShape ?? 'circle'`
 *   - Status patterns read from `palette.statusCancelled.pattern` etc.
 *
 * ## Density → geometry tables
 *
 *   compact:     tight rows, smaller markers, minimal margins
 *   normal:      standard proportions
 *   comfortable: generous rows, larger markers, spacious margins
 *
 * ## Precedence rule (CRITICAL for determinism)
 *
 * This binding is invoked ONLY as a fallback from `resolveTheme()` when:
 *   (a) the theme name is NOT in the legacy REGISTRY, AND
 *   (b) the name IS registered in CONTRACT_THEMES.
 *
 * The 14 legacy timeline theme names (consulting, executive, product, …)
 * are always served from the REGISTRY first — this binding NEVER overrides
 * a legacy theme by name. See `themes/index.ts` for the enforcement.
 *
 * The binding may also be called DIRECTLY (bypassing resolveTheme dispatch)
 * via `bindTimelineTheme(CONTRACT_THEMES.executive)` to render a diagram
 * with the contract-derived theme without touching legacy theme names.
 */

import type { ThemeContract } from '../theme-contract/types.js';
import type {
  ResolvedTheme,
  CanvasTheme,
  TypographyTheme,
  AxisTheme,
  TrackTheme,
  ActivityTheme,
  MilestoneTheme,
  MilestoneShape,
  LegendTheme,
  SectionTheme,
  StatusStyle,
} from './types.js';
import type { Status } from '../types.js';

// ---------------------------------------------------------------------------
// Density-driven geometry tables
// ---------------------------------------------------------------------------

interface DensityGeometry {
  canvasMargin:  { top: number; right: number; bottom: number; left: number };
  axisHeight:    number;
  rowHeight:     number;
  subLaneHeight: number;
  rowGap:        number;
  headerWidth:   number;
  barHeight:     number;
  barTopMargin:  number;
  markerSize:    number;
}

const DENSITY_TABLES: Record<'compact' | 'normal' | 'comfortable', DensityGeometry> = {
  compact: {
    canvasMargin:  { top: 32, right: 24, bottom: 32, left: 0 },
    axisHeight:    28,
    rowHeight:     56,
    subLaneHeight: 22,
    rowGap:         8,
    headerWidth:   100,
    barHeight:      18,
    barTopMargin:    8,
    markerSize:     14,
  },
  normal: {
    canvasMargin:  { top: 48, right: 40, bottom: 48, left: 0 },
    axisHeight:    32,
    rowHeight:     72,
    subLaneHeight: 28,
    rowGap:        12,
    headerWidth:   124,
    barHeight:      22,
    barTopMargin:   10,
    markerSize:     16,
  },
  comfortable: {
    canvasMargin:  { top: 56, right: 44, bottom: 56, left: 0 },
    axisHeight:    36,
    rowHeight:     88,
    subLaneHeight: 34,
    rowGap:        20,
    headerWidth:   148,
    barHeight:      28,
    barTopMargin:   14,
    markerSize:     20,
  },
};

// ---------------------------------------------------------------------------
// bindTimelineTheme
// ---------------------------------------------------------------------------

/**
 * Derive a complete `ResolvedTheme` from a Tier-2 `ThemeContract`.
 *
 * All 14 legacy timeline theme names (consulting, executive, etc.) ALWAYS win
 * over this binding when theme resolution goes through `resolveTheme()`.
 * This function is the fallback for contract-only theme names, or can be
 * called directly to bypass the name dispatch entirely.
 */
export function bindTimelineTheme(contract: ThemeContract): ResolvedTheme {
  const { palette, typography: typo, spacing, density, shape, effects } = contract;

  const geo = DENSITY_TABLES[density];

  // ── Canvas ─────────────────────────────────────────────────────────────
  const canvas: CanvasTheme = {
    width:           1200,
    backgroundColor: palette.surface,
    margin:          geo.canvasMargin,
  };

  // ── Typography ─────────────────────────────────────────────────────────
  const typography: TypographyTheme = {
    fontFamily:         typo.family,
    fontFamilyFallback: typo.fallback,
    fontSizeBase:       typo.scale.base,
    fontSizeAxis:       typo.scale.xs,
    fontSizeTitle:      typo.scale.lg,
    fontSizeSubtitle:   typo.scale.md,
    fontSizeTrack:      typo.scale.sm,
    fontWeightLabel:    typo.weights.semibold,
    fontWeightAxis:     typo.weights.regular,
    fontWeightHeader:   typo.weights.bold,
    titleColor:         palette.ink,
  };

  // ── Axis ───────────────────────────────────────────────────────────────
  // Convention: axis lines → palette.ink; gridlines → palette.border.
  const hasGridlines = effects.fidelity >= 1;
  const axis: AxisTheme = {
    height:          geo.axisHeight,
    tickHeight:       6,
    tickLabelOffset:  4,
    gridlineColor:   palette.border,
    gridlineWidth:   hasGridlines ? 0.5 : 0,
    gridlineOpacity: hasGridlines ? 0.8 : 0,
    gridlineStyle:   hasGridlines ? 'solid' : 'none',
    axisLineColor:   palette.ink,
    tickLabelColor:  palette.inkMuted,
    todayMarker: {
      enabled: false,
      // Today marker uses statusWarning (amber = time-sensitive)
      color:   palette.statusWarning.fill,
      width:   1.5,
      style:   'dashed',
    },
  };

  // ── Track ──────────────────────────────────────────────────────────────
  const track: TrackTheme = {
    headerWidth:      geo.headerWidth,
    rowHeight:        geo.rowHeight,
    subLaneHeight:    geo.subLaneHeight,
    maxSubLanes:       8,
    rowGap:           geo.rowGap,
    headerFontSize:   typo.scale.sm,
    headerFontWeight: typo.weights.bold,
    headerColor:      palette.inkPanel,
    headerBackground: palette.surfacePanel,   // panel lift for lane headers
    separatorColor:   palette.border,
    separatorWidth:    1,
  };

  // ── Activity bar ───────────────────────────────────────────────────────
  const barRadius = Math.min(shape.cornerRadius, Math.floor(geo.barHeight / 2));
  const activity: ActivityTheme = {
    barHeight:            geo.barHeight,
    barRadius,
    barTopMargin:         geo.barTopMargin,
    minWidth:              4,
    labelInsideMinWidth:  44,
    labelFontSize:        typo.scale.xs,
    labelColorInside:     palette.inkInverse,
    labelColorOutside:    palette.ink,
    labelTruncateChars:   32,
    progressBarHeight:     4,
    progressFillColor:    palette.inkInverse,
    progressFillOpacity:  0.35,
  };

  // ── Milestone marker ───────────────────────────────────────────────────
  const markerShape: MilestoneShape =
    (shape.markerShape === 'circle' || shape.markerShape === 'diamond' || shape.markerShape === 'triangle')
      ? shape.markerShape
      : 'circle';

  const ms = geo.markerSize;
  const milestone: MilestoneTheme = {
    shape:                markerShape,
    size:                 ms,
    strokeWidth:           2,
    strokeColor:          palette.surface,       // halo outline against background
    showOrdinalNumber:    true,
    ordinalFontSize:      typo.scale.sm,
    ordinalFontWeight:    typo.weights.bold,
    ordinalColor:         palette.inkInverse,
    dateLabelAbove:       true,
    dateLabelFontSize:    typo.scale.xs,
    dateLabelFontWeight:  typo.weights.regular,
    dateLabelColor:       palette.inkMuted,
    titleLabelBelow:      true,
    titleLabelFontSize:   typo.scale.sm,
    titleLabelFontWeight: typo.weights.semibold,
    titleLabelColor:      palette.ink,
    labelGapPx:           spacing.steps.xs,
    labelOffsetX:          8,
    labelMaxWidth:         120,
    labelStackOffset:      14,
    stackOffsetY:          20,
    minNodeGap:            ms * 2 + 6,
    leaderColor:          palette.inkMuted,
    leaderWidth:           0.75,
    blockTierGap:          6,
  };

  // ── Status map ─────────────────────────────────────────────────────────
  // Reads fill/stroke/opacity/pattern from contract workflow state roles.
  // 'at-risk' maps to statusWarning; 'blocked' maps to statusError.
  const statusMap: Record<Status, StatusStyle> = {
    'planned': {
      fill:    palette.statusPlanned.fill,
      stroke:  palette.statusPlanned.stroke,
      opacity: 1.0,
      pattern: palette.statusPlanned.pattern ?? 'solid',
    },
    'in-progress': {
      fill:    palette.statusActive.fill,
      stroke:  palette.statusActive.stroke,
      opacity: 1.0,
      pattern: palette.statusActive.pattern ?? 'solid',
    },
    'done': {
      fill:    palette.statusDone.fill,
      stroke:  palette.statusDone.stroke,
      opacity: palette.statusDone.opacity ?? 0.85,
      pattern: palette.statusDone.pattern ?? 'solid',
    },
    'at-risk': {
      fill:    palette.statusWarning.fill,
      stroke:  palette.statusWarning.stroke,
      opacity: 1.0,
      pattern: palette.statusWarning.pattern ?? 'solid',
    },
    'blocked': {
      fill:    palette.statusError.fill,
      stroke:  palette.statusError.stroke,
      opacity: 1.0,
      pattern: palette.statusError.pattern ?? 'solid',
    },
    'cancelled': {
      fill:    palette.statusCancelled.fill,
      stroke:  palette.statusCancelled.stroke,
      opacity: palette.statusCancelled.opacity ?? 0.55,
      pattern: palette.statusCancelled.pattern ?? 'diagonal-hatch',
    },
    'tentative': {
      fill:    palette.statusUncertain.fill,
      stroke:  palette.statusUncertain.stroke,
      opacity: palette.statusUncertain.opacity ?? 0.70,
      pattern: palette.statusUncertain.pattern ?? 'dashed-border',
    },
  };

  // ── Category map ───────────────────────────────────────────────────────
  const categoryMap: Record<string, { fill: string; stroke: string }> = {
    'standard-node': { fill: palette.accent, stroke: palette.accentStrong },
  };

  // ── Legend ─────────────────────────────────────────────────────────────
  const legend: LegendTheme = {
    position:        'bottom-right',
    backgroundColor: palette.surfaceRaised,
    borderColor:     palette.border,
    borderWidth:      1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:     2,
    rowGap:           6,
    swatchLabelGap:   8,
    labelFontSize:   typo.scale.xs,
    labelFontWeight: typo.weights.regular,
    labelColor:      palette.inkMuted,
    titleFontSize:   typo.scale.sm,
    titleFontWeight: typo.weights.bold,
    titleColor:      palette.ink,
    titleBottomGap:   6,
    maxWidth:        170,
  };

  // ── Section bands ──────────────────────────────────────────────────────
  const section: SectionTheme = {
    bandOpacityEven: effects.fidelity >= 1 ? 0.08 : 0.05,
    bandOpacityOdd:  0.0,
    bandFillEven:    palette.muted,
    bandFillOdd:     palette.surface,
    labelFontSize:   typo.scale.xs,
    labelFontWeight: typo.weights.semibold,
    labelColor:      palette.inkMuted,
    labelOpacity:    0.8,
  };

  // ── Assemble ───────────────────────────────────────────────────────────
  return {
    id:    contract.id,
    title: contract.name,
    tier:  effects.fidelity,

    canvas,
    typography,
    axis,
    track,
    activity,
    milestone,
    legend,
    section,
    statusMap,
    categoryMap,

    // Entry cards: enable when fidelity >= 2 and corner radius is set
    entryStyle: (effects.fidelity >= 2 && shape.cornerRadius > 0) ? 'card' : 'plain',

    // Section-column palette: drive timeline-columns section bands from the
    // contract's categorical data palette instead of the Mermaid rainbow.
    // The layout derives full per-section SectionColors from each base hex.
    sectionPalette: contract.dataPalette.categorical.slice(),
  };
}
