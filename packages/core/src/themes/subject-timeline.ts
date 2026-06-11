/**
 * @file themes/subject-timeline.ts — Subject Timeline dark theme (T2 target).
 *
 * Matches the "dark vertical-spine Subject Timeline" design target
 * (design/figures/target-vertical-spine-dark.png):
 *
 *  - Dark canvas (#1A1A2E near-black)
 *  - Central vertical spine SEGMENTED BY COLOUR: each segment adopts the
 *    resolved colour of its adjacent entry (T2-1: spineSegmentColor)
 *  - Small WHITE dot nodes at each year position
 *  - CHEVRON arrowhead at each node pointing toward the entry's text side (T2-3)
 *  - Large circular ICON BADGE pinned to the canvas edge, connected by a
 *    DASHED leader line (T2-2: badgePlacement: 'edge')
 *  - Large YEAR label + subject heading rendered in the entry's colour (T2-5)
 *  - Multi-block content blocks for structured entries (T2-4 — auto via blocks field)
 *  - Even spacing (infographic sequence, 4 year milestones)
 *  - Plain entry style (no card background)
 *
 * All T2 tokens are opt-in: existing themes do not set them, so all
 * existing golden outputs remain byte-identical.
 */

import type { ResolvedTheme } from './types.js';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BG = '#1A1A2E'; // deep dark navy
const FG = '#E8EEF4'; // near-white text
const FG_DIM = '#8A9BB0'; // muted blue-grey for body text

// Per-entry colours — match the T2 target
const CYAN = '#22D3EE'; // 2021
const AMBER = '#F59E0B'; // 2022
const PINK = '#EC4899'; // 2023
const STEEL_BLUE = '#60A5FA'; // 2024

// ---------------------------------------------------------------------------
// Subject Timeline theme
// ---------------------------------------------------------------------------

export const subjectTimelineTheme: ResolvedTheme = {
  id: 'subject-timeline',
  title: 'Subject Timeline',
  tier: 2,

  canvas: {
    width: 1200,
    backgroundColor: BG,
    margin: { top: 80, right: 72, bottom: 80, left: 72 },
  },

  typography: {
    fontFamily: 'DejaVu Sans',
    fontFamilyFallback: 'Arial, Helvetica, sans-serif',
    fontSizeBase: 11,
    fontSizeAxis: 10,
    fontSizeTitle: 22,
    fontSizeSubtitle: 13,
    fontSizeTrack: 11,
    fontWeightLabel: 700,
    fontWeightAxis: 400,
    fontWeightHeader: 700,
    titleColor: FG,
    // T2-5: large year label token — makes the year/date in content blocks
    // render at 28pt (bold) when yearLabelUsesEntryColor is also set.
    fontSizeYearLabel: 28,
  },

  axis: {
    height: 36,
    tickHeight: 6,
    tickLabelOffset: 5,
    gridlineColor: '#2A2A48',
    gridlineWidth: 0,
    gridlineOpacity: 0,
    gridlineStyle: 'none',
    axisLineColor: '#3A3A5C',
    tickLabelColor: FG_DIM,
    todayMarker: {
      enabled: false,
      color: CYAN,
      width: 1.5,
      style: 'dashed',
    },
  },

  track: {
    headerWidth: 140,
    rowHeight: 80,
    subLaneHeight: 32,
    maxSubLanes: 6,
    rowGap: 16,
    headerFontSize: 11,
    headerFontWeight: 700,
    headerColor: FG_DIM,
    headerBackground: null,
    separatorColor: '#2A2A48',
    separatorWidth: 1,
  },

  activity: {
    barHeight: 22,
    barRadius: 5,
    barTopMargin: 10,
    minWidth: 4,
    labelInsideMinWidth: 40,
    labelFontSize: 10,
    labelColorInside: '#FFFFFF',
    labelColorOutside: FG,
    labelTruncateChars: 32,
    progressBarHeight: 3,
    progressFillColor: '#FFFFFF',
    progressFillOpacity: 0.35,
  },

  milestone: {
    shape: 'circle',
    size: 12,
    strokeWidth: 2,
    strokeColor: BG,
    showOrdinalNumber: false,
    ordinalFontSize: 10,
    ordinalFontWeight: 700,
    ordinalColor: '#FFFFFF',
    dateLabelAbove: false,
    // T2-5: dateLabelFontSize is overridden when yearLabelUsesEntryColor+fontSizeYearLabel
    // — this value is the fallback for non-T2 usage.
    dateLabelFontSize: 10,
    dateLabelFontWeight: 700,
    dateLabelColor: FG_DIM,
    titleLabelBelow: false,
    titleLabelFontSize: 12,
    titleLabelFontWeight: 700,
    titleLabelColor: FG,
    labelGapPx: 6,
    labelOffsetX: 8,
    labelMaxWidth: 120,
    labelStackOffset: 12,
    stackOffsetY: 18,
    minNodeGap: 44,
    leaderColor: FG_DIM,
    leaderWidth: 1.0,
    blockTierGap: 6,
    iconColor: BG,
    iconScale: 0.6,
  },

  statusMap: {
    planned: { fill: CYAN, stroke: '#16A0BD', opacity: 1.0, pattern: 'solid' },
    'in-progress': { fill: AMBER, stroke: '#C07800', opacity: 1.0, pattern: 'solid' },
    done: { fill: STEEL_BLUE, stroke: '#3A7FD4', opacity: 1.0, pattern: 'solid' },
    'at-risk': { fill: PINK, stroke: '#C02070', opacity: 1.0, pattern: 'solid' },
    blocked: { fill: '#EF4444', stroke: '#B82222', opacity: 1.0, pattern: 'solid' },
    cancelled: { fill: '#4B6176', stroke: '#3A4D5E', opacity: 0.6, pattern: 'diagonal-hatch' },
    tentative: { fill: '#7B6FA0', stroke: '#5A4E7A', opacity: 0.75, pattern: 'dashed-border' },
  },

  categoryMap: {},

  // Plain entry style — text only, no card background
  entryStyle: 'plain',

  // Even spacing — 4 year entries should be uniformly spaced
  spineSpacing: 'even',

  // ── T2 feature tokens ─────────────────────────────────────────────────────

  // T2-1: per-segment coloured spine
  spineSegmentColor: true,

  // T2-2: edge badge placement + dashed leader lines
  badgePlacement: 'edge',

  // T2-3: chevron at each node pointing toward text side
  spineNodeArrow: true,

  // T2: white spine nodes while entry colours drive segments and labels
  spineNodeFillOverride: '#FFFFFF',

  // T2-5: large year/subject in entry colour
  yearLabelUsesEntryColor: true,

  legend: {
    position: 'bottom-right',
    backgroundColor: '#12122A',
    borderColor: '#2A2A48',
    borderWidth: 1,
    padding: 10,
    swatchSize: 11,
    swatchRadius: 3,
    rowGap: 6,
    swatchLabelGap: 8,
    labelFontSize: 9,
    labelFontWeight: 400,
    labelColor: FG_DIM,
    titleFontSize: 10,
    titleFontWeight: 700,
    titleColor: FG,
    titleBottomGap: 6,
    maxWidth: 160,
  },

  section: {
    bandOpacityEven: 0.04,
    bandOpacityOdd: 0.0,
    bandFillEven: CYAN,
    bandFillOdd: BG,
    labelFontSize: 9,
    labelFontWeight: 700,
    labelColor: CYAN,
    labelOpacity: 0.5,
  },
};
