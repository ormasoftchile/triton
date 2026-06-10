/**
 * @file themes/consulting.ts — Consulting Tier-1 theme.
 *
 * McKinsey/BCG-style executive roadmap aesthetic (§6.3.1).  Black, white, and
 * a single navy accent (#1F497D).  Heavy typography, generous whitespace, no
 * decorative chrome.
 *
 * Phase 1 milestone shape: numbered circle (required for T2 acceptance target,
 * §14.2).  The classic diamond shape will be added in Phase 2 when the full
 * consulting theme variant is split from the T2-optimised variant.
 */

import type { ResolvedTheme } from './types.js';

/** Navy accent colour shared by activities and milestone fills. */
const NAVY = '#1F497D';
const BLACK = '#111111';
const GREY_MID = '#888888';
const GREY_LIGHT = '#CCCCCC';
const AMBER = '#D97706';
const RED = '#DC2626';
const WHITE = '#FFFFFF';

export const consultingTheme: ResolvedTheme = {
  id: 'consulting',
  title: 'Consulting',
  tier: 1,

  canvas: {
    width: 1200,
    backgroundColor: WHITE,
    margin: { top: 48, right: 40, bottom: 48, left: 0 },
  },

  typography: {
    fontFamily: 'DejaVu Sans',
    fontFamilyFallback: 'Arial, Helvetica, sans-serif',
    fontSizeBase:     11,
    fontSizeAxis:     10,
    fontSizeTitle:    20,
    fontSizeSubtitle: 13,
    fontSizeTrack:    11,
    fontWeightLabel:  600,
    fontWeightAxis:   400,
    fontWeightHeader: 700,
    titleColor:       '#111111',  // matches existing hardcoded value
  },

  axis: {
    height:            32,
    tickHeight:         6,
    tickLabelOffset:    4,
    gridlineColor:     '#E0E0E0',
    gridlineWidth:      0,    // Consulting: no gridlines
    gridlineOpacity:    0,
    gridlineStyle:    'none',
    axisLineColor:    '#333333',  // matches existing hardcoded value
    tickLabelColor:   '#555555',  // matches existing hardcoded value
    todayMarker: {
      enabled: false,
      color:   RED,
      width:   1.5,
      style:   'solid',
    },
  },

  track: {
    headerWidth:      140,    // gutter for track label text (suppressed when all labels empty)
    rowHeight:        80,
    subLaneHeight:    24,
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
    barRadius:             0,  // Consulting: square corners
    barTopMargin:         12,
    minWidth:              4,
    labelInsideMinWidth:  40,
    labelFontSize:        10,
    labelColorInside:     WHITE,
    labelColorOutside:    BLACK,
    labelTruncateChars:   32,
    progressBarHeight:     4,  // §5 progress indicator strip height (px)
    progressFillColor:   WHITE, // white overlay on dark navy bars
    progressFillOpacity: 0.45, // semi-transparent for subtlety
  },

  milestone: {
    shape:                'circle',
    size:                 22,           // circle radius in px
    strokeWidth:           2,
    strokeColor:           WHITE,
    showOrdinalNumber:     true,        // T2: "01", "02", "03" inside circles
    ordinalFontSize:       13,
    ordinalFontWeight:     700,
    ordinalColor:          WHITE,
    dateLabelAbove:        true,        // T2: date above circle
    dateLabelFontSize:      9,
    dateLabelFontWeight:   400,
    dateLabelColor:        '#555555',
    titleLabelBelow:       true,        // T2: title below circle
    titleLabelFontSize:    10,
    titleLabelFontWeight:  600,
    titleLabelColor:       BLACK,
    labelGapPx:             8,
    labelOffsetX:           8,
    labelMaxWidth:         120,
    labelStackOffset:      14,
    stackOffsetY:          20,
  },

  statusMap: {
    'planned':     { fill: NAVY,       stroke: '#163760', opacity: 1.0,  pattern: 'solid'          },
    'in-progress': { fill: NAVY,       stroke: '#163760', opacity: 1.0,  pattern: 'solid'          },
    'done':        { fill: GREY_MID,   stroke: '#666666', opacity: 0.85, pattern: 'solid'          },
    'at-risk':     { fill: AMBER,      stroke: '#B45309', opacity: 1.0,  pattern: 'solid'          },
    'blocked':     { fill: RED,        stroke: '#B91C1C', opacity: 1.0,  pattern: 'solid'          },
    'cancelled':   { fill: GREY_LIGHT, stroke: '#AAAAAA', opacity: 0.60, pattern: 'diagonal-hatch' },
    'tentative':   { fill: GREY_LIGHT, stroke: '#AAAAAA', opacity: 0.70, pattern: 'dashed-border'  },
  },

  categoryMap: {
    'standard-node': { fill: NAVY, stroke: '#163760' },
  },
};
