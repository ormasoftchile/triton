/**
 * @file themes/types.ts — ResolvedTheme interface.
 *
 * A ResolvedTheme is the fully-expanded, data-independent styling record for
 * a single built-in or custom theme.  It contains no IR content — only style
 * properties and constants.  The layout engine consumes ResolvedTheme to
 * assign colours, sizes, and spacing to every scene primitive it emits.
 */

import type { Status } from '../types.js';

// ---------------------------------------------------------------------------
// Sub-blocks
// ---------------------------------------------------------------------------

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
}

export interface StatusStyle {
  fill: string;
  stroke: string;
  opacity: number;
  pattern: 'solid' | 'diagonal-hatch' | 'dashed-border';
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
}
