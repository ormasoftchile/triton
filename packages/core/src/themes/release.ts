/**
 * @file themes/release.ts — Release / CI-dashboard Tier-1 theme.
 *
 * Traffic-light status palette: done=green, in-progress=blue, at-risk=amber,
 * blocked=red, planned=grey.  Milestones rendered as downward-pointing
 * triangles (▼) for flag/pin aesthetics.  Monospace-accented type, crisp
 * vertical gridlines.  White background with a clean, data-dense feel.
 */

import type { ResolvedTheme } from './types.js';

const WHITE   = '#FFFFFF';
const BLACK   = '#111111';

// Traffic-light palette
const GREEN   = '#16A34A'; // done
const BLUE    = '#2563EB'; // in-progress
const AMBER   = '#D97706'; // at-risk
const RED     = '#DC2626'; // blocked
const GREY    = '#6B7280'; // planned
const SILVER  = '#D1D5DB'; // cancelled
const SLATE   = '#94A3B8'; // tentative

export const releaseTheme: ResolvedTheme = {
  id:    'release',
  title: 'Release',
  tier:  1,

  canvas: {
    width:           1200,
    backgroundColor: WHITE,
    margin:          { top: 48, right: 40, bottom: 48, left: 0 },
  },

  typography: {
    fontFamily:         'DejaVu Sans',
    fontFamilyFallback: 'Courier New, Courier, monospace',
    fontSizeBase:       11,
    fontSizeAxis:       10,
    fontSizeTitle:      20,
    fontSizeSubtitle:   13,
    fontSizeTrack:      11,
    fontWeightLabel:    600,
    fontWeightAxis:     400,
    fontWeightHeader:   700,
    titleColor:         BLACK,
  },

  axis: {
    height:           32,
    tickHeight:        6,
    tickLabelOffset:   4,
    gridlineColor:    '#E5E7EB',
    gridlineWidth:     1,
    gridlineOpacity:   0.7,
    gridlineStyle:    'solid',
    axisLineColor:    '#374151',
    tickLabelColor:   '#374151',
    todayMarker: {
      enabled: false,
      color:   BLUE,
      width:   1.5,
      style:   'solid',
    },
  },

  track: {
    headerWidth:      140,
    rowHeight:         76,
    subLaneHeight:     24,
    maxSubLanes:        8,
    rowGap:            14,
    headerFontSize:    11,
    headerFontWeight:  700,
    headerColor:       BLACK,
    headerBackground:  null,
    separatorColor:   '#D1D5DB',
    separatorWidth:    1,
  },

  activity: {
    barHeight:            24,
    barRadius:             3,
    barTopMargin:         12,
    minWidth:              4,
    labelInsideMinWidth:  40,
    labelFontSize:        10,
    labelColorInside:     WHITE,
    labelColorOutside:    BLACK,
    labelTruncateChars:   32,
    progressBarHeight:     4,
    progressFillColor:    WHITE,
    progressFillOpacity:  0.40,
  },

  milestone: {
    shape:                'triangle',  // ▼ downward-pointing triangle
    size:                 14,
    strokeWidth:           1.5,
    strokeColor:           WHITE,
    showOrdinalNumber:     false,
    ordinalFontSize:       10,
    ordinalFontWeight:     700,
    ordinalColor:          WHITE,
    dateLabelAbove:        true,
    dateLabelFontSize:      9,
    dateLabelFontWeight:   400,
    dateLabelColor:        '#555555',
    titleLabelBelow:       true,
    titleLabelFontSize:    10,
    titleLabelFontWeight:  600,
    titleLabelColor:       BLACK,
    labelGapPx:             8,
    labelOffsetX:           8,
    labelMaxWidth:          120,
    labelStackOffset:       14,
    stackOffsetY:           20,
  },

  statusMap: {
    'planned':     { fill: GREY,   stroke: '#4B5563', opacity: 0.85, pattern: 'solid'          },
    'in-progress': { fill: BLUE,   stroke: '#1D4ED8', opacity: 1.0,  pattern: 'solid'          },
    'done':        { fill: GREEN,  stroke: '#15803D', opacity: 1.0,  pattern: 'solid'          },
    'at-risk':     { fill: AMBER,  stroke: '#B45309', opacity: 1.0,  pattern: 'solid'          },
    'blocked':     { fill: RED,    stroke: '#B91C1C', opacity: 1.0,  pattern: 'solid'          },
    'cancelled':   { fill: SILVER, stroke: '#9CA3AF', opacity: 0.55, pattern: 'diagonal-hatch' },
    'tentative':   { fill: SLATE,  stroke: '#64748B', opacity: 0.65, pattern: 'dashed-border'  },
  },

  categoryMap: {
    'standard-node': { fill: GREY, stroke: '#4B5563' },
  },


  legend: {
    position:        'bottom-right',
    backgroundColor: '#FFFFFF',
    borderColor:     '#D1D5DB',
    borderWidth:     1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:    2,
    rowGap:          6,
    swatchLabelGap:  8,
    labelFontSize:   9,
    labelFontWeight: 400,
    labelColor:      '#374151',
    titleFontSize:   10,
    titleFontWeight: 700,
    titleColor:      '#111111',
    titleBottomGap:  6,
    maxWidth:        160,
  },

  section: {
    bandOpacityEven: 0.04,
    bandOpacityOdd:  0.00,
    bandFillEven:    '#2563EB',
    bandFillOdd:     '#FFFFFF',
    labelFontSize:   9,
    labelFontWeight: 700,
    labelColor:      '#374151',
    labelOpacity:    0.65,
  },
  entryStyle: 'plain',
};
