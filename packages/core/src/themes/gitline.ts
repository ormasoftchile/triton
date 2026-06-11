/**
 * @file themes/gitline.ts — Gitline dark-card theme (T5 target).
 *
 * Matches the "Gitline" design target (design/figures/target-gitline-cards.png):
 *  - Deep dark-navy canvas (#0A1628)
 *  - Vertical-spine card entries with alternating left/right placement
 *  - Bold white titles, muted blue-grey date text
 *  - Clock icon inline before date (T5-2: cardDateIcon: 'clock')
 *  - Pill-shaped "VIEW REPOSITORY" CTA button at the bottom of each card (T5-1)
 *  - Bright blue connector dots on the spine
 *  - Even spacing (suitable for sparse repository-release timelines)
 *
 * Additive: existing themes are completely unaffected — the new tokens
 * (cardCtaLabel, cardDateIcon) default to undefined in all other themes,
 * preserving byte-identical output.
 */

import type { ResolvedTheme } from './types.js';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BG        = '#0A1628'; // darkest navy canvas
const FG        = '#E8EDF5'; // near-white primary text (titles)
const FG_DIM    = '#6B8FAF'; // muted blue-grey for dates + descriptions
const ACCENT    = '#4D9AFF'; // bright periwinkle blue — spine dots, axis, CTA border
const BTN_TEXT  = '#9DBDD8'; // slightly muted white for button label (matches reference)
const DONE_FILL = '#2C6EA8'; // filled-circle node colour

// ---------------------------------------------------------------------------
// Gitline theme
// ---------------------------------------------------------------------------

export const gitlineTheme: ResolvedTheme = {
  id:    'gitline',
  title: 'Gitline',
  tier:  2,

  canvas: {
    width:           1200,
    backgroundColor: BG,
    margin:          { top: 48, right: 40, bottom: 64, left: 0 },
  },

  typography: {
    fontFamily:         'DejaVu Sans',
    fontFamilyFallback: 'Arial, Helvetica, sans-serif',
    fontSizeBase:       12,
    fontSizeAxis:       10,
    fontSizeTitle:      22,
    fontSizeSubtitle:   13,
    fontSizeTrack:      11,
    fontWeightLabel:    700,
    fontWeightAxis:     400,
    fontWeightHeader:   700,
    titleColor:         FG,
  },

  axis: {
    height:         36,
    tickHeight:     6,
    tickLabelOffset: 5,
    gridlineColor:   '#1C3558',
    gridlineWidth:   0,
    gridlineOpacity: 0,
    gridlineStyle:   'none',
    axisLineColor:   '#1C3558',
    tickLabelColor:  ACCENT,
    todayMarker: {
      enabled: false,
      color:   ACCENT,
      width:   1.5,
      style:   'solid',
    },
  },

  track: {
    headerWidth:      140,
    rowHeight:         80,
    subLaneHeight:     32,
    maxSubLanes:        6,
    rowGap:            16,
    headerFontSize:    11,
    headerFontWeight:  700,
    headerColor:       FG_DIM,
    headerBackground:  null,
    separatorColor:    '#1C3558',
    separatorWidth:    1,
  },

  activity: {
    barHeight:           22,
    barRadius:            5,
    barTopMargin:        10,
    minWidth:             4,
    labelInsideMinWidth: 40,
    labelFontSize:       10,
    labelColorInside:    '#FFFFFF',
    labelColorOutside:   FG,
    labelTruncateChars:  32,
    progressBarHeight:    3,
    progressFillColor:   '#FFFFFF',
    progressFillOpacity: 0.35,
  },

  milestone: {
    shape:               'circle',
    size:                13,
    strokeWidth:          2,
    strokeColor:         BG,
    showOrdinalNumber:   false,
    ordinalFontSize:     10,
    ordinalFontWeight:   700,
    ordinalColor:        '#FFFFFF',
    dateLabelAbove:      false,
    dateLabelFontSize:    9,
    dateLabelFontWeight: 400,
    dateLabelColor:      FG_DIM,
    titleLabelBelow:     false,
    titleLabelFontSize:  10,
    titleLabelFontWeight: 700,
    titleLabelColor:     FG,
    labelGapPx:           6,
    labelOffsetX:          8,
    labelMaxWidth:        120,
    labelStackOffset:     12,
    stackOffsetY:         18,
    minNodeGap:           44,
    leaderColor:         FG_DIM,
    leaderWidth:          0.75,
    blockTierGap:          6,
    iconColor:           '#FFFFFF',
    iconScale:            0.65,
  },

  statusMap: {
    'planned':     { fill: DONE_FILL,  stroke: '#1B4F8A', opacity: 1.0,  pattern: 'solid' },
    'in-progress': { fill: ACCENT,     stroke: '#2A6CC7', opacity: 1.0,  pattern: 'solid' },
    'done':        { fill: DONE_FILL,  stroke: '#1B4F8A', opacity: 1.0,  pattern: 'solid' },
    'at-risk':     { fill: '#D97706',  stroke: '#B35A00', opacity: 1.0,  pattern: 'solid' },
    'blocked':     { fill: '#E05B5B',  stroke: '#B83030', opacity: 1.0,  pattern: 'solid' },
    'cancelled':   { fill: '#4B6176',  stroke: '#3A4D5E', opacity: 0.6,  pattern: 'diagonal-hatch' },
    'tentative':   { fill: '#5B7FA0',  stroke: '#3A5C7A', opacity: 0.75, pattern: 'dashed-border' },
  },

  categoryMap: {
    'release':   { fill: DONE_FILL, stroke: '#1B4F8A' },
    'milestone': { fill: ACCENT,    stroke: '#2A6CC7' },
  },

  // Vertical-spine card style
  entryStyle: 'card',

  // Even spacing: repository-release timelines can have irregular date gaps;
  // even spacing ensures a compact, infographic-style result.
  spineSpacing: 'even',

  // T5-1: CTA button token — renders a "VIEW REPOSITORY" pill at the bottom of
  // each card entry that has a `url` field.  Pill is outlined (transparent bg,
  // white-ish border) matching the reference design.
  cardCtaLabel:       'VIEW REPOSITORY',
  cardCtaFill:        'transparent',
  cardCtaTextColor:   BTN_TEXT,
  cardCtaBorderColor: BTN_TEXT,
  cardCtaBorderWidth: 1,
  // cardCtaRadius: omit → defaults to half button height (true pill)

  // T5-2: Inline clock icon before the date text.
  cardDateIcon: 'clock',

  // Light card shadow (Skia only; SVG silently omits)
  effects: {
    cardEffects: [
      { kind: 'shadow', dx: 0, dy: 2, blur: 8, color: '#00000044' },
    ],
    nodeEffects: [
      { kind: 'glow', color: ACCENT, radius: 8 },
    ],
  },

  legend: {
    position:        'bottom-right',
    backgroundColor: '#0F2044',
    borderColor:     '#1C3558',
    borderWidth:     1,
    padding:          10,
    swatchSize:       11,
    swatchRadius:      3,
    rowGap:            6,
    swatchLabelGap:    8,
    labelFontSize:     9,
    labelFontWeight:  400,
    labelColor:       FG_DIM,
    titleFontSize:    10,
    titleFontWeight:  700,
    titleColor:       FG,
    titleBottomGap:    6,
    maxWidth:         160,
  },

  section: {
    bandOpacityEven: 0.04,
    bandOpacityOdd:  0.00,
    bandFillEven:    ACCENT,
    bandFillOdd:     BG,
    labelFontSize:    9,
    labelFontWeight:  700,
    labelColor:       ACCENT,
    labelOpacity:     0.5,
  },
};
