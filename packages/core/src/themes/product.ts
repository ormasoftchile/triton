/**
 * @file themes/product.ts — Product Tier-2 theme.
 *
 * Engineering roadmap aesthetic: denser rows, category-driven colour palette,
 * prominent progress fills, compact type, lively but organised.  White
 * background with saturated accent colours keyed to track/category.
 */

import type { ResolvedTheme } from './types.js';

const WHITE  = '#FFFFFF';
const BLACK  = '#111111';

export const productTheme: ResolvedTheme = {
  id:    'product',
  title: 'Product',
  tier:  2,

  canvas: {
    width:           1200,
    backgroundColor: WHITE,
    margin:          { top: 44, right: 36, bottom: 44, left: 0 },
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
      enabled: false,
      color:   '#EF4444',
      width:   1.5,
      style:   'solid',
    },
  },

  track: {
    headerWidth:      140,
    rowHeight:         64,   // denser rows
    subLaneHeight:     20,
    maxSubLanes:        8,
    rowGap:            10,
    headerFontSize:    10,
    headerFontWeight:  700,
    headerColor:       BLACK,
    headerBackground:  null,
    separatorColor:   '#D1D5DB',
    separatorWidth:    1,
  },

  activity: {
    barHeight:            20,
    barRadius:             4,
    barTopMargin:         10,
    minWidth:              4,
    labelInsideMinWidth:  36,
    labelFontSize:         9,
    labelColorInside:     WHITE,
    labelColorOutside:    BLACK,
    labelTruncateChars:   28,
    progressBarHeight:     5,   // prominent progress fills
    progressFillColor:    WHITE,
    progressFillOpacity:  0.50,
  },

  milestone: {
    shape:                'circle',
    size:                 18,
    strokeWidth:           2,
    strokeColor:           WHITE,
    showOrdinalNumber:     true,
    ordinalFontSize:       10,
    ordinalFontWeight:     700,
    ordinalColor:          WHITE,
    dateLabelAbove:        true,
    dateLabelFontSize:      8,
    dateLabelFontWeight:   400,
    dateLabelColor:        '#6B7280',
    titleLabelBelow:       true,
    titleLabelFontSize:     9,
    titleLabelFontWeight:  600,
    titleLabelColor:       BLACK,
    labelGapPx:             6,
    labelOffsetX:           8,
    labelMaxWidth:          110,
    labelStackOffset:       12,
    stackOffsetY:           18,
  },

  statusMap: {
    'planned':     { fill: '#93C5FD', stroke: '#60A5FA', opacity: 0.90, pattern: 'solid'          },
    'in-progress': { fill: '#3B82F6', stroke: '#2563EB', opacity: 1.0,  pattern: 'solid'          },
    'done':        { fill: '#4ADE80', stroke: '#22C55E', opacity: 0.85, pattern: 'solid'          },
    'at-risk':     { fill: '#FCD34D', stroke: '#F59E0B', opacity: 1.0,  pattern: 'solid'          },
    'blocked':     { fill: '#F87171', stroke: '#EF4444', opacity: 1.0,  pattern: 'solid'          },
    'cancelled':   { fill: '#D1D5DB', stroke: '#9CA3AF', opacity: 0.50, pattern: 'diagonal-hatch' },
    'tentative':   { fill: '#E0E7FF', stroke: '#818CF8', opacity: 0.75, pattern: 'dashed-border'  },
  },

  // Category-driven colour overrides — track id strings map to vivid palette entries
  categoryMap: {
    'standard-node': { fill: '#3B82F6', stroke: '#2563EB' },
    'strategy':      { fill: '#6366F1', stroke: '#4F46E5' },
    'platform':      { fill: '#0EA5E9', stroke: '#0284C7' },
    'mobile':        { fill: '#10B981', stroke: '#059669' },
    'analytics':     { fill: '#F59E0B', stroke: '#D97706' },
    'backend':       { fill: '#8B5CF6', stroke: '#7C3AED' },
    'frontend':      { fill: '#EC4899', stroke: '#DB2777' },
    'infra':         { fill: '#14B8A6', stroke: '#0D9488' },
    'quality':       { fill: '#22D3EE', stroke: '#06B6D4' },
    'discovery':     { fill: '#A78BFA', stroke: '#8B5CF6' },
    'development':   { fill: '#34D399', stroke: '#10B981' },
  },

  entryStyle: 'card',
};
