/**
 * @file themes/bytebytego.ts — ByteByteGo-style dark timeline theme.
 *
 * Dark canvas (`#111827`), vivid teal/blue/purple accent palette — consistent
 * with the dark-flow, dark-tree, and bytebytego-sequence grammar themes so that
 * all four grammar families share a cohesive infographic look when composed.
 *
 * Uses the horizontal layout family (tracks + activities + milestones).
 */

import type { ResolvedTheme } from './types.js';

// ── Palette ──────────────────────────────────────────────────────────────────
const CANVAS_BG   = '#111827'; // ByteByteGo dark navy canvas
const SURFACE     = '#1f2937'; // card/header surface
const TEAL        = '#2dd4bf'; // primary teal accent
const TEXT_BRIGHT = '#f9fafb'; // bright text on dark bg
const TEXT_MID    = '#e2e8f0'; // mid-weight labels
const TEXT_DIM    = '#9ca3af'; // dim secondary labels
const GRID        = '#374151'; // gridline / separator colour

export const bytebyteGoTheme: ResolvedTheme = {
  id: 'bytebytego',
  title: 'ByteByteGo Dark',
  tier: 2,

  canvas: {
    width: 1200,
    backgroundColor: CANVAS_BG,
    margin: { top: 44, right: 36, bottom: 44, left: 0 },
  },

  typography: {
    fontFamily:         'DejaVu Sans',
    fontFamilyFallback: 'Arial, Helvetica, sans-serif',
    fontSizeBase:       10,
    fontSizeAxis:        9,
    fontSizeTitle:      18,
    fontSizeSubtitle:   11,
    fontSizeTrack:      10,
    fontWeightLabel:    600,
    fontWeightAxis:     400,
    fontWeightHeader:   700,
    titleColor:         TEXT_BRIGHT,
  },

  axis: {
    height:         28,
    tickHeight:      5,
    tickLabelOffset: 3,
    gridlineColor:   GRID,
    gridlineWidth:   0.75,
    gridlineOpacity: 0.8,
    gridlineStyle:   'solid',
    axisLineColor:   '#4b5563',
    tickLabelColor:  TEXT_DIM,
    todayMarker: {
      enabled: true,
      color:   TEAL,
      width:   1.5,
      style:   'dashed',
    },
  },

  track: {
    headerWidth:     140,
    rowHeight:        64,
    subLaneHeight:    26,
    maxSubLanes:       8,
    rowGap:           10,
    headerFontSize:   10,
    headerFontWeight: 700,
    headerColor:      TEXT_MID,
    headerBackground: SURFACE,
    separatorColor:   GRID,
    separatorWidth:    1,
  },

  activity: {
    barHeight:           20,
    barRadius:            4,
    barTopMargin:        10,
    minWidth:             4,
    labelInsideMinWidth: 36,
    labelFontSize:        9,
    labelColorInside:    TEXT_BRIGHT,
    labelColorOutside:   TEXT_MID,
    labelTruncateChars:  28,
    progressBarHeight:    4,
    progressFillColor:   TEAL,
    progressFillOpacity: 0.6,
  },

  milestone: {
    shape:              'circle',
    size:               16,
    strokeWidth:         2,
    strokeColor:        CANVAS_BG,
    showOrdinalNumber:   true,
    ordinalFontSize:     8,
    ordinalFontWeight:  700,
    ordinalColor:       TEXT_BRIGHT,
    dateLabelAbove:      true,
    dateLabelFontSize:   8,
    dateLabelFontWeight: 400,
    dateLabelColor:      TEXT_DIM,
    titleLabelBelow:     true,
    titleLabelFontSize:  9,
    titleLabelFontWeight: 600,
    titleLabelColor:     TEXT_MID,
    labelGapPx:          6,
    labelOffsetX:        8,
    labelMaxWidth:       110,
    labelStackOffset:    12,
    stackOffsetY:        18,
    minNodeGap:          38,   // 2 × 16 + 6
    leaderColor:         TEXT_DIM,
    leaderWidth:         0.75,
    blockTierGap:        5,
  },

  statusMap: {
    'planned':     { fill: '#1d4ed8', stroke: '#2563eb', opacity: 0.85, pattern: 'solid'          },
    'in-progress': { fill: '#0d9488', stroke: '#0f766e', opacity: 1.00, pattern: 'solid'          },
    'done':        { fill: '#059669', stroke: '#047857', opacity: 0.85, pattern: 'solid'          },
    'at-risk':     { fill: '#d97706', stroke: '#b45309', opacity: 1.00, pattern: 'solid'          },
    'blocked':     { fill: '#dc2626', stroke: '#b91c1c', opacity: 1.00, pattern: 'solid'          },
    'cancelled':   { fill: '#374151', stroke: '#4b5563', opacity: 0.50, pattern: 'diagonal-hatch' },
    'tentative':   { fill: '#7c3aed', stroke: '#6d28d9', opacity: 0.75, pattern: 'dashed-border'  },
  },

  categoryMap: {
    'standard-node': { fill: TEAL,     stroke: '#0d9488' },
    'strategy':      { fill: '#7c3aed', stroke: '#6d28d9' },
    'platform':      { fill: '#0ea5e9', stroke: '#0284c7' },
    'mobile':        { fill: '#10b981', stroke: '#059669' },
    'analytics':     { fill: '#f59e0b', stroke: '#d97706' },
    'backend':       { fill: '#8b5cf6', stroke: '#7c3aed' },
    'frontend':      { fill: '#ec4899', stroke: '#db2777' },
    'infra':         { fill: '#14b8a6', stroke: '#0d9488' },
    'quality':       { fill: '#22d3ee', stroke: '#06b6d4' },
    'discovery':     { fill: '#a78bfa', stroke: '#8b5cf6' },
    'development':   { fill: '#34d399', stroke: '#10b981' },
  },

  legend: {
    position:        'bottom-right',
    backgroundColor: SURFACE,
    borderColor:     GRID,
    borderWidth:     1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:     3,
    rowGap:           6,
    swatchLabelGap:   8,
    labelFontSize:    8,
    labelFontWeight: 400,
    labelColor:      TEXT_DIM,
    titleFontSize:    9,
    titleFontWeight: 700,
    titleColor:      TEXT_MID,
    titleBottomGap:   5,
    maxWidth:        160,
  },

  section: {
    bandOpacityEven: 0.07,
    bandOpacityOdd:  0.03,
    bandFillEven:    TEAL,
    bandFillOdd:     '#7c3aed',
    labelFontSize:   8,
    labelFontWeight: 700,
    labelColor:      TEXT_MID,
    labelOpacity:    0.6,
  },
};
