/**
 * @file themes/executive.ts — Executive Tier-2 theme.
 *
 * Boardroom / presentation aesthetic: deep navy background, light text,
 * rounded bars, full 7-status colour palette with vibrant semantics,
 * generous spacing and heavier typography weight.  No art effects — just
 * dark + rounded + refined colour choices that resvg renders faithfully.
 */

import type { ResolvedTheme } from './types.js';

const BG         = '#0D1B2A'; // deep navy canvas
const FG         = '#E8EEF5'; // near-white primary text
const FG_DIM     = '#8BAAC8'; // muted blue-grey secondary text
const AXIS_LINE  = '#2A4060'; // subdued axis/tick colour
const SEPARATOR  = '#1E3350'; // track separator (dark)
const TRACK_HDR  = '#B8CCE0'; // track header label colour

// Status palette — vivid but harmonious on dark background
const BLUE       = '#3A86C8'; // planned
const CYAN       = '#00B4D8'; // in-progress
const STEEL      = '#607D8B'; // done (muted)
const GOLD       = '#F4A742'; // at-risk
const CRIMSON    = '#E05252'; // blocked
const SLATE      = '#455A64'; // cancelled
const LAVENDER   = '#7986CB'; // tentative

export const executiveTheme: ResolvedTheme = {
  id:    'executive',
  title: 'Executive',
  tier:  2,

  canvas: {
    width:           1200,
    backgroundColor: BG,
    margin:          { top: 56, right: 44, bottom: 56, left: 0 },
  },

  typography: {
    fontFamily:         'DejaVu Sans',
    fontFamilyFallback: 'Arial, Helvetica, sans-serif',
    fontSizeBase:       11,
    fontSizeAxis:       10,
    fontSizeTitle:      22,
    fontSizeSubtitle:   14,
    fontSizeTrack:      11,
    fontWeightLabel:    700,
    fontWeightAxis:     400,
    fontWeightHeader:   700,
    titleColor:         FG,
  },

  axis: {
    height:           36,
    tickHeight:        6,
    tickLabelOffset:   4,
    gridlineColor:    '#1E3350',
    gridlineWidth:     0.5,
    gridlineOpacity:   0.6,
    gridlineStyle:    'solid',
    axisLineColor:    AXIS_LINE,
    tickLabelColor:   FG_DIM,
    todayMarker: {
      enabled: false,
      color:   GOLD,
      width:   1.5,
      style:   'solid',
    },
  },

  track: {
    headerWidth:      148,
    rowHeight:         88,
    subLaneHeight:     34,  // barHeight(28) + 6 px gap between sub-lanes
    maxSubLanes:        8,
    rowGap:            20,
    headerFontSize:    11,
    headerFontWeight:  700,
    headerColor:       TRACK_HDR,
    headerBackground:  null,
    separatorColor:    SEPARATOR,
    separatorWidth:    1,
  },

  activity: {
    barHeight:            28,
    barRadius:             8,   // rounded bars
    barTopMargin:         14,
    minWidth:              4,
    labelInsideMinWidth:  44,
    labelFontSize:        10,
    labelColorInside:     FG,
    labelColorOutside:    FG_DIM,
    labelTruncateChars:   32,
    progressBarHeight:     5,
    progressFillColor:    '#FFFFFF',
    progressFillOpacity:  0.35,
  },

  milestone: {
    shape:                'circle',
    size:                 20,
    strokeWidth:           2,
    strokeColor:           BG,
    showOrdinalNumber:     true,
    ordinalFontSize:       11,
    ordinalFontWeight:     700,
    ordinalColor:          BG,
    dateLabelAbove:        true,
    dateLabelFontSize:      9,
    dateLabelFontWeight:   400,
    dateLabelColor:        FG_DIM,
    titleLabelBelow:       true,
    titleLabelFontSize:    10,
    titleLabelFontWeight:  600,
    titleLabelColor:       FG,
    labelGapPx:             8,
    labelOffsetX:           8,
    labelMaxWidth:          120,
    labelStackOffset:       14,
    stackOffsetY:           20,
    minNodeGap:            46,   // 2 × 20 + 6
    leaderColor:           '#8BAAC8',
    leaderWidth:           0.75,
    blockTierGap:          6,
  },

  statusMap: {
    'planned':     { fill: BLUE,     stroke: '#2A6A9E', opacity: 1.0,  pattern: 'solid'          },
    'in-progress': { fill: CYAN,     stroke: '#0090B0', opacity: 1.0,  pattern: 'solid'          },
    'done':        { fill: STEEL,    stroke: '#4A6070', opacity: 0.85, pattern: 'solid'          },
    'at-risk':     { fill: GOLD,     stroke: '#C08020', opacity: 1.0,  pattern: 'solid'          },
    'blocked':     { fill: CRIMSON,  stroke: '#B03030', opacity: 1.0,  pattern: 'solid'          },
    'cancelled':   { fill: SLATE,    stroke: '#304050', opacity: 0.55, pattern: 'diagonal-hatch' },
    'tentative':   { fill: LAVENDER, stroke: '#5060A0', opacity: 0.70, pattern: 'dashed-border'  },
  },

  categoryMap: {
    'standard-node': { fill: BLUE, stroke: '#2A6A9E' },
  },


  legend: {
    position:        'bottom-right',
    backgroundColor: '#1E3350',
    borderColor:     '#2A4060',
    borderWidth:     1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:    2,
    rowGap:          6,
    swatchLabelGap:  8,
    labelFontSize:   9,
    labelFontWeight: 400,
    labelColor:      '#8BAAC8',
    titleFontSize:   10,
    titleFontWeight: 700,
    titleColor:      '#E8EEF5',
    titleBottomGap:  6,
    maxWidth:        170,
  },

  section: {
    bandOpacityEven: 0.06,
    bandOpacityOdd:  0.00,
    bandFillEven:    '#3A86C8',
    bandFillOdd:     '#0D1B2A',
    labelFontSize:   9,
    labelFontWeight: 700,
    labelColor:      '#8BAAC8',
    labelOpacity:    0.8,
  },
  entryStyle: 'card',
};
