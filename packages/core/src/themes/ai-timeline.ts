/**
 * @file themes/ai-timeline.ts — AI Timeline Tier-2 theme.
 *
 * A light, crisp aesthetic designed for dense vertical-spine timelines
 * spanning many decades (the "T3 — THE AI TIMELINE" target look):
 *
 *  - Soft off-white canvas with a subtle top-to-bottom gradient for Skia.
 *  - Oversized bold YEAR labels on the spine (~24 pt, 3× body text),
 *    achieved via the new `fontSizeYearLabel` token (T3-2).
 *  - Per-entry accent colors flow through `Activity.color` / `Milestone.color`
 *    without needing categoryMap boilerplate (T3-3).
 *  - Card-style content blocks with a very light shadow (Skia backend).
 *  - Vivid multi-color status palette to support 12+ entry accent colors.
 *
 * Under the SVG backend the gradient is ignored (solid #F8F9FF) and effects
 * are omitted — output is deterministic and byte-identical across runs.
 * Under the Skia backend the full gradient / card-shadow art is realised.
 */

import type { ResolvedTheme } from './types.js';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BG         = '#F8F9FF'; // near-white canvas (solid SVG fallback)
const FG         = '#1A1A2E'; // near-black primary text
const FG_MID     = '#4A4A6A'; // secondary text / dates
const ACCENT     = '#5B4FCF'; // indigo accent (spine, axis)
const SPINE_LINE = '#C0C4DF'; // subdued spine/axis colour
const CARD_FILL  = '#FFFFFF'; // white card background

// Status / accent palette — vivid, distinct, print-safe
const INDIGO  = '#5B4FCF';
const TEAL    = '#0EA5A8';
const CORAL   = '#E05B5B';
const GOLD    = '#D97706';
const GREEN   = '#2D9E67';
const PURPLE  = '#9333EA';
const NAVY    = '#1F497D';
const ORANGE  = '#EA7C2D';

// ---------------------------------------------------------------------------
// AI Timeline theme
// ---------------------------------------------------------------------------

export const aiTimelineTheme: ResolvedTheme = {
  id:    'ai-timeline',
  title: 'AI Timeline',
  tier:  2,

  canvas: {
    width:           1200,
    backgroundColor: BG,
    margin:          { top: 56, right: 44, bottom: 64, left: 0 },
  },

  typography: {
    fontFamily:          'DejaVu Sans',
    fontFamilyFallback:  'Arial, Helvetica, sans-serif',
    fontSizeBase:        11,
    fontSizeAxis:        10,
    fontSizeTitle:       22,
    fontSizeSubtitle:    13,
    fontSizeTrack:       11,
    fontWeightLabel:     600,
    fontWeightAxis:      400,
    fontWeightHeader:    700,
    titleColor:          FG,
    // T3-2: large bold year labels on the vertical-spine (~1.6× body text, bold).
    // 16pt stays within the connector-label gap so it never overlaps entry text.
    fontSizeYearLabel:   16,
  },

  axis: {
    height:            36,
    tickHeight:         8,
    tickLabelOffset:    6,
    gridlineColor:     '#D8DAEA',
    gridlineWidth:      0,
    gridlineOpacity:    0,
    gridlineStyle:     'none',
    axisLineColor:     SPINE_LINE,
    tickLabelColor:    ACCENT,
    todayMarker: {
      enabled: false,
      color:   CORAL,
      width:   1.5,
      style:   'solid',
    },
  },

  track: {
    headerWidth:      148,
    rowHeight:         88,
    subLaneHeight:     34,
    maxSubLanes:        8,
    rowGap:            20,
    headerFontSize:    11,
    headerFontWeight:  700,
    headerColor:       FG_MID,
    headerBackground:  null,
    separatorColor:    '#D0D4EA',
    separatorWidth:    1,
  },

  activity: {
    barHeight:           24,
    barRadius:            6,
    barTopMargin:        12,
    minWidth:             4,
    labelInsideMinWidth: 40,
    labelFontSize:       10,
    labelColorInside:    '#FFFFFF',
    labelColorOutside:   FG,
    labelTruncateChars:  32,
    progressBarHeight:    3,
    progressFillColor:   '#FFFFFF',
    progressFillOpacity: 0.4,
  },

  milestone: {
    shape:               'circle',
    size:                14,
    strokeWidth:          1.5,
    strokeColor:         ACCENT,
    showOrdinalNumber:   false,
    ordinalFontSize:     10,
    ordinalFontWeight:   700,
    ordinalColor:        '#FFFFFF',
    dateLabelAbove:      false,
    dateLabelFontSize:    9,
    dateLabelFontWeight: 400,
    dateLabelColor:      FG_MID,
    titleLabelBelow:     false,
    titleLabelFontSize:  10,
    titleLabelFontWeight: 600,
    titleLabelColor:     FG,
    labelGapPx:           6,
    labelOffsetX:          8,
    labelMaxWidth:        120,
    labelStackOffset:     12,
    stackOffsetY:         18,
    minNodeGap:           44,
    leaderColor:         SPINE_LINE,
    leaderWidth:          0.75,
    blockTierGap:          6,
    iconColor:           '#FFFFFF',
    iconScale:            0.65,
  },

  statusMap: {
    'planned':     { fill: INDIGO,  stroke: '#3D34B8', opacity: 1.0, pattern: 'solid'         },
    'in-progress': { fill: TEAL,    stroke: '#0B7B7E', opacity: 1.0, pattern: 'solid'         },
    'done':        { fill: GREEN,   stroke: '#1F7A4E', opacity: 1.0, pattern: 'solid'         },
    'at-risk':     { fill: GOLD,    stroke: '#B35A00', opacity: 1.0, pattern: 'solid'         },
    'blocked':     { fill: CORAL,   stroke: '#B83030', opacity: 1.0, pattern: 'solid'         },
    'cancelled':   { fill: '#9CA3AF', stroke: '#6B7280', opacity: 0.6, pattern: 'diagonal-hatch' },
    'tentative':   { fill: PURPLE,  stroke: '#6B21A8', opacity: 0.75, pattern: 'dashed-border' },
  },

  categoryMap: {
    'breakthrough': { fill: CORAL,   stroke: '#B83030' },
    'release':      { fill: TEAL,    stroke: '#0B7B7E' },
    'research':     { fill: INDIGO,  stroke: '#3D34B8' },
    'open-source':  { fill: GREEN,   stroke: '#1F7A4E' },
    'model':        { fill: NAVY,    stroke: '#163760' },
    'product':      { fill: ORANGE,  stroke: '#B85A00' },
    'milestone':    { fill: PURPLE,  stroke: '#6B21A8' },
  },

  // Vertical-spine card style — clean white cards with subtle border
  entryStyle: 'card',

  // T3-1: subtle vertical gradient for Skia backend.
  // SVG backend ignores this and uses canvas.backgroundColor instead.
  sceneBackground: {
    kind:  'gradient',
    from:  '#EEF0FF',
    to:    '#F8F0FF',
    angle: 90,
  },

  // Light card shadow (Skia only; SVG silently omits)
  effects: {
    cardEffects: [
      { kind: 'shadow', dx: 1, dy: 2, blur: 6, color: '#00000022' },
    ],
  },

  legend: {
    position:        'bottom-right',
    backgroundColor: CARD_FILL,
    borderColor:     SPINE_LINE,
    borderWidth:     1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:     3,
    rowGap:           6,
    swatchLabelGap:   8,
    labelFontSize:    9,
    labelFontWeight:  400,
    labelColor:       FG_MID,
    titleFontSize:   10,
    titleFontWeight:  700,
    titleColor:       FG,
    titleBottomGap:   6,
    maxWidth:        160,
  },

  section: {
    bandOpacityEven: 0.04,
    bandOpacityOdd:  0.00,
    bandFillEven:    ACCENT,
    bandFillOdd:     BG,
    labelFontSize:    9,
    labelFontWeight:  700,
    labelColor:       ACCENT,
    labelOpacity:     0.6,
  },
};
