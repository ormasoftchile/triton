/**
 * @file themes/serpentine.ts — Serpentine "Journey Path" theme (T4).
 *
 * A light-background theme for boustrophedon winding timelines.
 * Features a thick green gradient path with a soft glow, white dot nodes,
 * and start/end icon badges.
 *
 * Tier 3: Skia glow effects enabled (SVG backend renders cleanly without glow).
 */

import type { ResolvedTheme } from './types.js';

// Palette
const BG          = '#F7FBF7';  // very light greenish white
const PATH_START  = '#86EFAC';  // light green (gradient start)
const PATH_END    = '#15803D';  // dark green (gradient end)
const GLOW_COLOR  = '#4ADE80';  // medium green glow
const NODE_FILL   = '#FFFFFF';  // white dot nodes
const NODE_STROKE = '#15803D';  // dark green node outline
const BADGE_FILL  = '#15803D';  // dark green badge
const BADGE_ICON  = '#FFFFFF';  // white icon in badge
const LABEL_COLOR = '#374151';  // dark gray labels
const TITLE_COLOR = '#111827';  // near-black title
const DIM         = '#6B7280';  // muted gray (secondary text)
const AXIS_LINE   = '#D1FAE5';  // very light green axis
const SEP_COLOR   = '#E5F5E8';  // light separator

export const serpentineTheme: ResolvedTheme = {
  id:    'serpentine',
  title: 'Serpentine Journey',
  tier:  3,

  canvas: {
    width:           1200,
    backgroundColor: BG,
    margin:          { top: 56, right: 44, bottom: 60, left: 44 },
  },

  typography: {
    fontFamily:         'DejaVu Sans',
    fontFamilyFallback: 'Arial, Helvetica, sans-serif',
    fontSizeBase:       11,
    fontSizeAxis:       10,
    fontSizeTitle:      22,
    fontSizeSubtitle:   13,
    fontSizeTrack:      11,
    fontWeightLabel:    600,
    fontWeightAxis:     400,
    fontWeightHeader:   700,
    titleColor:         TITLE_COLOR,
    titleAlign:         'center',
  },

  axis: {
    height:          36,
    tickHeight:       6,
    tickLabelOffset:  5,
    gridlineColor:    AXIS_LINE,
    gridlineWidth:    0.5,
    gridlineOpacity:  0.4,
    gridlineStyle:   'none',
    axisLineColor:    AXIS_LINE,
    tickLabelColor:   DIM,
    todayMarker: {
      enabled: false,
      color:   GLOW_COLOR,
      width:   1,
      style:  'dashed',
    },
  },

  track: {
    headerWidth:       0,
    rowHeight:        80,
    subLaneHeight:    28,
    maxSubLanes:       4,
    rowGap:           12,
    headerFontSize:   11,
    headerFontWeight: 700,
    headerColor:      DIM,
    headerBackground: null,
    separatorColor:   SEP_COLOR,
    separatorWidth:   1,
  },

  activity: {
    barHeight:           24,
    barRadius:            4,
    barTopMargin:        10,
    minWidth:             4,
    labelInsideMinWidth: 40,
    labelFontSize:       10,
    labelColorInside:    BG,
    labelColorOutside:   LABEL_COLOR,
    labelTruncateChars:  32,
    progressBarHeight:    3,
    progressFillColor:   NODE_STROKE,
    progressFillOpacity: 0.3,
  },

  milestone: {
    shape:              'circle',
    size:               10,
    strokeWidth:         2,
    strokeColor:         NODE_STROKE,
    showOrdinalNumber:   false,
    ordinalFontSize:     9,
    ordinalFontWeight:   700,
    ordinalColor:        NODE_STROKE,
    dateLabelAbove:      false,
    dateLabelFontSize:   9,
    dateLabelFontWeight: 400,
    dateLabelColor:      DIM,
    titleLabelBelow:     true,
    titleLabelFontSize:  9,
    titleLabelFontWeight: 600,
    titleLabelColor:     LABEL_COLOR,
    labelGapPx:          8,
    labelOffsetX:        8,
    labelMaxWidth:       100,
    labelStackOffset:    10,
    stackOffsetY:        14,
    leaderColor:         DIM,
    leaderWidth:         0.5,
    blockTierGap:        4,
  },

  statusMap: {
    planned:     { fill: '#86EFAC', stroke: '#4ADE80', opacity: 1.0, pattern: 'solid' },
    'in-progress': { fill: '#4ADE80', stroke: '#22C55E', opacity: 1.0, pattern: 'solid' },
    done:        { fill: '#15803D', stroke: '#166534', opacity: 0.9, pattern: 'solid' },
    'at-risk':   { fill: '#FCD34D', stroke: '#F59E0B', opacity: 1.0, pattern: 'solid' },
    blocked:     { fill: '#F87171', stroke: '#EF4444', opacity: 1.0, pattern: 'solid' },
    cancelled:   { fill: '#9CA3AF', stroke: '#6B7280', opacity: 0.6, pattern: 'diagonal-hatch' },
    tentative:   { fill: '#A7F3D0', stroke: '#6EE7B7', opacity: 0.7, pattern: 'dashed-border' },
  },

  categoryMap: {},

  legend: {
    position:        'bottom-right',
    backgroundColor: '#FFFFFF',
    borderColor:     AXIS_LINE,
    borderWidth:     1,
    padding:         10,
    swatchSize:      11,
    swatchRadius:    3,
    rowGap:          5,
    swatchLabelGap:  7,
    labelFontSize:   9,
    labelFontWeight: 400,
    labelColor:      DIM,
    titleFontSize:   10,
    titleFontWeight: 700,
    titleColor:      TITLE_COLOR,
    titleBottomGap:  5,
    maxWidth:        150,
  },

  section: {
    bandOpacityEven: 0.04,
    bandOpacityOdd:  0.00,
    bandFillEven:    GLOW_COLOR,
    bandFillOdd:     BG,
    labelFontSize:   9,
    labelFontWeight: 700,
    labelColor:      NODE_STROKE,
    labelOpacity:    0.6,
  },

  // Serpentine-specific tokens
  serpentine: {
    pathStrokeWidth: 14,
    gradientFrom:    PATH_START,
    gradientTo:      PATH_END,
    glowColor:       GLOW_COLOR,
    glowRadius:      18,
    nodeRadius:      10,
    nodeFill:        NODE_FILL,
    nodeStroke:      NODE_STROKE,
    nodeStrokeWidth: 3,
    startIcon:       'play',
    endIcon:         'target',
    badgeRadius:     22,
    badgeFill:       BADGE_FILL,
    badgeIconColor:  BADGE_ICON,
    rowSpacing:      160,
    turnRadius:      80,
    showLabels:      true,
    labelColor:      LABEL_COLOR,
    labelFontSize:   9,
  },
};
