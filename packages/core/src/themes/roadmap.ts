/**
 * @file themes/roadmap.ts — Roadmap / Phase-pills theme.
 *
 * Extends the product aesthetic with taller activity bars (barHeight: 36 px,
 * barRadius: 8 px) so that each bar can display a two-line "phase pill":
 * icon badge + primary title + secondary description subtitle.
 *
 * Milestones are diamond-shaped callouts above the axis (dateLabelAbove: true,
 * titleLabelBelow: true) with a compact date/label block.
 *
 * Opt-in via `theme: roadmap` in the YAML; no change to any other theme.
 */

import type { ResolvedTheme } from './types.js';

const WHITE = '#FFFFFF';
const BLACK = '#111111';

export const roadmapTheme: ResolvedTheme = {
  id:    'roadmap',
  title: 'Roadmap',
  tier:  2,

  canvas: {
    width:           1200,
    backgroundColor: WHITE,
    margin:          { top: 44, right: 48, bottom: 44, left: 48 },
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
    titleColor:         BLACK,
  },

  axis: {
    height:           28,
    tickHeight:        5,
    tickLabelOffset:   3,
    gridlineColor:    '#E5E7EB',
    gridlineWidth:     0.75,
    gridlineOpacity:   0.9,
    gridlineStyle:    'solid',
    axisLineColor:    '#374151',
    tickLabelColor:   '#6B7280',
    todayMarker: {
      enabled:   true,
      color:     '#EF4444',
      width:     1.5,
      style:     'dashed',
      labelChip: true,
    },
  },

  track: {
    headerWidth:      0,    // no left-side track-label gutter (suppress header)
    rowHeight:         72,   // taller rows to accommodate 36 px pill + margins
    subLaneHeight:     42,   // barHeight(36) + 6 px gap between sub-lanes
    maxSubLanes:        4,
    rowGap:            12,
    headerFontSize:    10,
    headerFontWeight:  700,
    headerColor:       BLACK,
    headerBackground:  null,
    separatorColor:   '#D1D5DB',
    separatorWidth:    1,
  },

  activity: {
    barHeight:            36,  // tall phase pills (supports two-line label+subtitle)
    barRadius:             8,  // rounded pill corners
    barTopMargin:         10,
    minWidth:              4,
    labelInsideMinWidth:  60,
    labelFontSize:        10,  // pt — primary label
    labelColorInside:     WHITE,
    labelColorOutside:    BLACK,
    labelTruncateChars:   36,
    progressBarHeight:     5,
    progressFillColor:    WHITE,
    progressFillOpacity:  0.40,
  },

  milestone: {
    shape:                'circle',
    size:                 10,
    strokeWidth:           2,
    strokeColor:           WHITE,
    showOrdinalNumber:     false,
    ordinalFontSize:       10,
    ordinalFontWeight:     700,
    ordinalColor:          WHITE,
    dateLabelAbove:        true,
    dateLabelFontSize:      8,
    dateLabelFontWeight:   400,
    dateLabelColor:        '#6B7280',
    titleLabelBelow:       true,
    titleLabelFontSize:     8,
    titleLabelFontWeight:  600,
    titleLabelColor:       BLACK,
    labelGapPx:             6,
    labelOffsetX:           8,
    labelMaxWidth:          120,
    labelStackOffset:       12,
    stackOffsetY:           16,
    minNodeGap:            28,
    leaderColor:           '#6B7280',
    leaderWidth:           0.75,
    blockTierGap:          4,
    labelWrap:             true,
  },

  statusMap: {
    'planned':     { fill: '#93C5FD', stroke: '#60A5FA', opacity: 0.90, pattern: 'solid' },
    'in-progress': { fill: '#3B82F6', stroke: '#2563EB', opacity: 1.0,  pattern: 'solid' },
    'done':        { fill: '#4ADE80', stroke: '#22C55E', opacity: 0.85, pattern: 'solid' },
    'at-risk':     { fill: '#FCD34D', stroke: '#F59E0B', opacity: 1.0,  pattern: 'solid' },
    'blocked':     { fill: '#F87171', stroke: '#EF4444', opacity: 1.0,  pattern: 'solid' },
    'cancelled':   { fill: '#D1D5DB', stroke: '#9CA3AF', opacity: 0.50, pattern: 'diagonal-hatch' },
    'tentative':   { fill: '#E0E7FF', stroke: '#818CF8', opacity: 0.75, pattern: 'dashed-border'  },
  },

  categoryMap: {
    'standard-node': { fill: '#3B82F6', stroke: '#2563EB' },
    'strategy':      { fill: '#6366F1', stroke: '#4F46E5' },
    'platform':      { fill: '#0EA5E9', stroke: '#0284C7' },
    'mobile':        { fill: '#10B981', stroke: '#059669' },
    'analytics':     { fill: '#F59E0B', stroke: '#D97706' },
    'goal':          { fill: '#1e3a5f', stroke: '#162b46' },
  },

  legend: {
    position:        'bottom-right',
    backgroundColor: '#FFFFFF',
    borderColor:     '#E5E7EB',
    borderWidth:     1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:    3,
    rowGap:          6,
    swatchLabelGap:  8,
    labelFontSize:   8,
    labelFontWeight: 400,
    labelColor:      '#6B7280',
    titleFontSize:   9,
    titleFontWeight: 700,
    titleColor:      '#111111',
    titleBottomGap:  5,
    maxWidth:        160,
  },

  section: {
    bandOpacityEven: 0.04,
    bandOpacityOdd:  0.02,
    bandFillEven:    '#3B82F6',
    bandFillOdd:     '#8B5CF6',
    labelFontSize:   8,
    labelFontWeight: 700,
    labelColor:      '#374151',
    labelOpacity:    0.7,
  },
  entryStyle: 'card',
};
