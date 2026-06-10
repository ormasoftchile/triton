/**
 * @file themes/minimal.ts — Minimal Tier-1 theme.
 *
 * Academic / monochrome aesthetic: near-white background, all status states
 * expressed through grey fill weight and opacity only (no hue differentiation),
 * thin strokes, generous whitespace, understated typography.
 *
 * NO status colour fills — all fills are greyscale (#RRGGBB where RR=GG=BB).
 * Cancelled / tentative are distinguished by pattern only.
 */

import type { ResolvedTheme } from './types.js';

const WHITE      = '#FFFFFF';
const GREY_900   = '#1A1A1A'; // titles, headers
const GREY_700   = '#555555'; // body text, labels
const GREY_500   = '#888888'; // secondary text, tick labels
const GREY_400   = '#AAAAAA'; // axis lines, separators
const GREY_200   = '#CCCCCC'; // gridlines, light borders

// Status fills — greyscale only (R=G=B in every hex)
const FILL_DONE        = '#9A9A9A'; // done: dark grey, full opacity
const FILL_IN_PROGRESS = '#666666'; // in-progress: medium-dark
const FILL_PLANNED     = '#BBBBBB'; // planned: medium-light
const FILL_AT_RISK     = '#777777'; // at-risk: medium (+ hatch pattern)
const FILL_BLOCKED     = '#444444'; // blocked: darkest (+ hatch pattern)
const FILL_CANCELLED   = '#DDDDDD'; // cancelled: very light
const FILL_TENTATIVE   = '#C8C8C8'; // tentative: light (+ dashed border)

export const minimalTheme: ResolvedTheme = {
  id:    'minimal',
  title: 'Minimal',
  tier:  1,

  canvas: {
    width:           1200,
    backgroundColor: WHITE,
    margin:          { top: 52, right: 48, bottom: 52, left: 0 },
  },

  typography: {
    fontFamily:         'DejaVu Sans',
    fontFamilyFallback: 'Arial, Helvetica, sans-serif',
    fontSizeBase:       10,
    fontSizeAxis:        9,
    fontSizeTitle:      18,
    fontSizeSubtitle:   12,
    fontSizeTrack:      10,
    fontWeightLabel:    400,
    fontWeightAxis:     400,
    fontWeightHeader:   600,
    titleColor:         GREY_900,
  },

  axis: {
    height:           28,
    tickHeight:        4,
    tickLabelOffset:   4,
    gridlineColor:    GREY_200,
    gridlineWidth:     0.5,
    gridlineOpacity:   0.8,
    gridlineStyle:    'dashed',
    axisLineColor:    GREY_400,
    tickLabelColor:   GREY_500,
    todayMarker: {
      enabled: false,
      color:   GREY_700,
      width:   1,
      style:   'dashed',
    },
  },

  track: {
    headerWidth:      140,
    rowHeight:         72,
    subLaneHeight:     22,
    maxSubLanes:        8,
    rowGap:            12,
    headerFontSize:    10,
    headerFontWeight:  600,
    headerColor:       GREY_700,
    headerBackground:  null,
    separatorColor:    GREY_200,
    separatorWidth:    1,
  },

  activity: {
    barHeight:            20,
    barRadius:             2,   // very slight rounding
    barTopMargin:         12,
    minWidth:              4,
    labelInsideMinWidth:  40,
    labelFontSize:         9,
    labelColorInside:     WHITE,
    labelColorOutside:    GREY_700,
    labelTruncateChars:   32,
    progressBarHeight:     3,
    progressFillColor:    WHITE,
    progressFillOpacity:  0.55,
  },

  milestone: {
    shape:                'circle',
    size:                 18,
    strokeWidth:           1.5,
    strokeColor:           GREY_400,
    showOrdinalNumber:     false,
    ordinalFontSize:       10,
    ordinalFontWeight:     400,
    ordinalColor:          WHITE,
    dateLabelAbove:        true,
    dateLabelFontSize:      8,
    dateLabelFontWeight:   400,
    dateLabelColor:        GREY_500,
    titleLabelBelow:       true,
    titleLabelFontSize:     9,
    titleLabelFontWeight:  400,
    titleLabelColor:       GREY_700,
    labelGapPx:             6,
    labelOffsetX:           8,
    labelMaxWidth:          120,
    labelStackOffset:       12,
    stackOffsetY:           18,
  },

  statusMap: {
    'planned':     { fill: FILL_PLANNED,     stroke: GREY_400,  opacity: 1.0,  pattern: 'solid'          },
    'in-progress': { fill: FILL_IN_PROGRESS, stroke: GREY_700,  opacity: 0.90, pattern: 'solid'          },
    'done':        { fill: FILL_DONE,        stroke: GREY_400,  opacity: 0.75, pattern: 'solid'          },
    'at-risk':     { fill: FILL_AT_RISK,     stroke: GREY_500,  opacity: 0.90, pattern: 'diagonal-hatch' },
    'blocked':     { fill: FILL_BLOCKED,     stroke: GREY_900,  opacity: 0.85, pattern: 'diagonal-hatch' },
    'cancelled':   { fill: FILL_CANCELLED,   stroke: GREY_200,  opacity: 0.50, pattern: 'diagonal-hatch' },
    'tentative':   { fill: FILL_TENTATIVE,   stroke: GREY_400,  opacity: 0.65, pattern: 'dashed-border'  },
  },

  categoryMap: {
    'standard-node': { fill: FILL_IN_PROGRESS, stroke: GREY_700 },
  },

  entryStyle: 'plain',
};
