/**
 * @file themes/our-timeline.ts — "Our Timeline" infographic theme (T1 target).
 *
 * Light background with three large numbered circle nodes.  The key visual
 * convention from the T1 target (design/figures/target-horizontal-numbered.png):
 *
 *   • Milestone status `in-progress`  → filled navy circle (highlighted node)
 *   • Milestone status `planned`/`done` → hollow circle (white fill + navy stroke)
 *   • `ordinalColorContrast: true`    → ordinal text adapts: white on navy,
 *                                        dark on white (WCAG contrast)
 *   • `titleAlign: 'center'`          → document title centered mid-canvas
 *
 * Theme is opt-in (new `our-timeline` id); all existing themes are unchanged.
 */

import type { ResolvedTheme } from './types.js';

const NAVY       = '#1F497D';
const NAVY_DARK  = '#163760';
const BLACK      = '#111111';
const WHITE      = '#FFFFFF';
const GREY_MID   = '#888888';
const GREY_LIGHT = '#CCCCCC';
const AMBER      = '#D97706';
const RED        = '#DC2626';

export const ourTimelineTheme: ResolvedTheme = {
  id: 'our-timeline',
  title: 'Our Timeline',
  tier: 1,

  canvas: {
    width:           1200,
    backgroundColor: WHITE,
    margin:          { top: 48, right: 40, bottom: 48, left: 0 },
  },

  typography: {
    fontFamily:           'DejaVu Sans',
    fontFamilyFallback:   'Arial, Helvetica, sans-serif',
    fontSizeBase:         11,
    fontSizeAxis:         10,
    fontSizeTitle:        22,   // larger title for infographic feel
    fontSizeSubtitle:     13,
    fontSizeTrack:        11,
    fontWeightLabel:      600,
    fontWeightAxis:       400,
    fontWeightHeader:     700,
    titleColor:           BLACK,
    titleAlign:           'center',
  },

  axis: {
    height:          32,
    tickHeight:       6,
    tickLabelOffset:  4,
    gridlineColor:   '#E0E0E0',
    gridlineWidth:    0,
    gridlineOpacity:  0,
    gridlineStyle:  'none',
    axisLineColor:  '#333333',
    tickLabelColor: '#555555',
    todayMarker: {
      enabled: false,
      color:   RED,
      width:   1.5,
      style:   'solid',
    },
    nodeWrap:       'over-under',
  },

  track: {
    headerWidth:      0,
    rowHeight:        80,
    subLaneHeight:    30,
    maxSubLanes:       8,
    rowGap:           16,
    headerFontSize:   11,
    headerFontWeight: 600,
    headerColor:      BLACK,
    headerBackground: null,
    separatorColor:   '#333333',
    separatorWidth:   1,
  },

  activity: {
    barHeight:            24,
    barRadius:             0,
    barTopMargin:         12,
    minWidth:              4,
    labelInsideMinWidth:  40,
    labelFontSize:        10,
    labelColorInside:     WHITE,
    labelColorOutside:    BLACK,
    labelTruncateChars:   32,
    progressBarHeight:     4,
    progressFillColor:   WHITE,
    progressFillOpacity: 0.45,
  },

  milestone: {
    shape:               'circle',
    size:                28,          // slightly larger than consulting (22) for T1 feel
    strokeWidth:          2,
    strokeColor:          NAVY,       // navy ring on hollow nodes
    showOrdinalNumber:    true,
    ordinalFontSize:      14,
    ordinalFontWeight:    700,
    ordinalColor:         WHITE,      // fallback (overridden by ordinalColorContrast)
    ordinalColorContrast: true,       // auto: white on navy, dark on white
    dateLabelAbove:       true,
    dateLabelFontSize:    9,
    dateLabelFontWeight:  400,
    dateLabelColor:      '#555555',
    titleLabelBelow:      true,
    titleLabelFontSize:   10,
    titleLabelFontWeight: 700,        // bold titles as in target
    titleLabelColor:      BLACK,
    labelGapPx:            8,
    labelOffsetX:          8,
    labelMaxWidth:        130,
    labelStackOffset:     14,
    stackOffsetY:         20,
    minNodeGap:           60,         // 2 × 28 + 4
    leaderColor:         '#888888',
    leaderWidth:          0.75,
    blockTierGap:          6,
  },

  // Status → fill mapping (the core T1 visual logic):
  //   planned / done / cancelled / tentative / at-risk / blocked → hollow (white fill)
  //   in-progress → filled navy (highlighted / active node)
  statusMap: {
    'planned':     { fill: WHITE,      stroke: NAVY,      opacity: 1.0,  pattern: 'solid' },
    'in-progress': { fill: NAVY,       stroke: NAVY_DARK, opacity: 1.0,  pattern: 'solid' },
    'done':        { fill: WHITE,      stroke: GREY_MID,  opacity: 0.85, pattern: 'solid' },
    'at-risk':     { fill: AMBER,      stroke: '#B45309', opacity: 1.0,  pattern: 'solid' },
    'blocked':     { fill: RED,        stroke: '#B91C1C', opacity: 1.0,  pattern: 'solid' },
    'cancelled':   { fill: GREY_LIGHT, stroke: '#AAAAAA', opacity: 0.60, pattern: 'solid' },
    'tentative':   { fill: GREY_LIGHT, stroke: '#AAAAAA', opacity: 0.70, pattern: 'solid' },
  },

  categoryMap: {},

  legend: {
    position:        'bottom-right',
    backgroundColor: WHITE,
    borderColor:     GREY_LIGHT,
    borderWidth:     1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:    0,
    rowGap:          6,
    swatchLabelGap:  8,
    labelFontSize:   9,
    labelFontWeight: 400,
    labelColor:      '#333333',
    titleFontSize:   10,
    titleFontWeight: 700,
    titleColor:      BLACK,
    titleBottomGap:  6,
    maxWidth:        160,
  },

  section: {
    bandOpacityEven: 0.04,
    bandOpacityOdd:  0.00,
    bandFillEven:    NAVY,
    bandFillOdd:     WHITE,
    labelFontSize:   9,
    labelFontWeight: 700,
    labelColor:      NAVY,
    labelOpacity:    0.7,
  },
  entryStyle: 'plain',
};
