/**
 * @file themes/showcase.ts — Showcase Tier-3 theme.
 *
 * A high-fidelity "wow" aesthetic designed for the Skia raster backend:
 *  - Deep navy gradient / cloud background (baseColor #0D1B2A → #1A3A5C)
 *  - Glowing electric-cyan milestone nodes (glow effect, radius 18)
 *  - Soft-shadowed card blocks (vertical-spine, entryStyle:'card')
 *  - Light-on-dark typography in near-white / cyan tones
 *  - Refined activity bars (rounded corners, cyan spectrum palette)
 *
 * Under the SVG backend the theme renders cleanly (all effects omitted /
 * degraded to CSS colour only) and remains deterministic + lint-clean.
 * Under the Skia backend the full art effects are realised.
 *
 * NOTE: cross-backend pixel identity is NOT promised.  Skia determinism is
 * per pinned canvaskit-wasm version (see design/sections/05-rendering.tex).
 */

import type { ResolvedTheme } from './types.js';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BG          = '#0D1B2A'; // deep navy canvas (solid fallback for SVG)
const FG          = '#E8EEF5'; // near-white primary text
const FG_DIM      = '#7AACCC'; // muted cyan secondary text
const CYAN        = '#00D4FF'; // electric cyan (glow, borders, accent)
const CYAN_DIM    = '#0099CC'; // deeper cyan for stroke/accent
const GOLD        = '#FFB800'; // warm gold (at-risk, section)
const CRIMSON     = '#FF4D6D'; // vivid crimson (blocked)
const STEEL       = '#607D9B'; // steel blue (done)
const SLATE       = '#334455'; // dark slate (cancelled)
const LAVENDER    = '#9B8FDF'; // soft lavender (tentative)
const CARD_FILL   = '#132035'; // dark card background
const AXIS_LINE   = '#1E3A5A'; // subdued spine/axis colour
const SEPARATOR   = '#1A3050'; // track separator

// ---------------------------------------------------------------------------
// Showcase theme
// ---------------------------------------------------------------------------

export const showcaseTheme: ResolvedTheme = {
  id:    'showcase',
  title: 'Showcase',
  tier:  3,

  canvas: {
    width:           1200,
    backgroundColor: BG,
    margin:          { top: 56, right: 44, bottom: 64, left: 0 },
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
    height:          36,
    tickHeight:        6,
    tickLabelOffset:   5,
    gridlineColor:   '#1E3A5A',
    gridlineWidth:    0.5,
    gridlineOpacity:  0.4,
    gridlineStyle:   'solid',
    axisLineColor:   AXIS_LINE,
    tickLabelColor:  FG_DIM,
    todayMarker: {
      enabled: false,
      color:   CYAN,
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
    headerColor:       FG_DIM,
    headerBackground:  null,
    separatorColor:    SEPARATOR,
    separatorWidth:    1,
  },

  activity: {
    barHeight:            26,
    barRadius:             6, // rounded corners
    barTopMargin:         12,
    minWidth:              4,
    labelInsideMinWidth:  40,
    labelFontSize:        10,
    labelColorInside:     BG,
    labelColorOutside:    FG,
    labelTruncateChars:   32,
    progressBarHeight:     4,
    progressFillColor:    FG,
    progressFillOpacity:  0.3,
  },

  milestone: {
    shape:              'circle',
    size:               22,
    strokeWidth:         2,
    strokeColor:         CYAN,
    showOrdinalNumber:   false,  // icons preferred in showcase
    ordinalFontSize:     13,
    ordinalFontWeight:   700,
    ordinalColor:        BG,
    dateLabelAbove:      true,
    dateLabelFontSize:    9,
    dateLabelFontWeight: 400,
    dateLabelColor:      FG_DIM,
    titleLabelBelow:     true,
    titleLabelFontSize:  10,
    titleLabelFontWeight: 600,
    titleLabelColor:     FG,
    labelGapPx:           8,
    labelOffsetX:          8,
    labelMaxWidth:        120,
    labelStackOffset:     14,
    stackOffsetY:         20,
    minNodeGap:           50,
    leaderColor:          CYAN_DIM,
    leaderWidth:          0.75,
    blockTierGap:          6,
    iconColor:             CYAN,
    iconScale:             0.65,
  },

  statusMap: {
    'planned':     { fill: CYAN,     stroke: CYAN_DIM, opacity: 1.0,  pattern: 'solid'          },
    'in-progress': { fill: CYAN_DIM, stroke: '#006688', opacity: 1.0, pattern: 'solid'           },
    'done':        { fill: STEEL,    stroke: '#455A7B', opacity: 0.85, pattern: 'solid'          },
    'at-risk':     { fill: GOLD,     stroke: '#CC8800', opacity: 1.0,  pattern: 'solid'          },
    'blocked':     { fill: CRIMSON,  stroke: '#CC2244', opacity: 1.0,  pattern: 'solid'          },
    'cancelled':   { fill: SLATE,    stroke: '#223344', opacity: 0.6,  pattern: 'diagonal-hatch' },
    'tentative':   { fill: LAVENDER, stroke: '#6655BB', opacity: 0.7,  pattern: 'dashed-border'  },
  },

  categoryMap: {
    'standard-node': { fill: CYAN, stroke: CYAN_DIM },
  },

  legend: {
    position:        'bottom-right',
    backgroundColor: CARD_FILL,
    borderColor:     AXIS_LINE,
    borderWidth:     1,
    padding:         10,
    swatchSize:      12,
    swatchRadius:    3,
    rowGap:           6,
    swatchLabelGap:   8,
    labelFontSize:    9,
    labelFontWeight:  400,
    labelColor:       FG_DIM,
    titleFontSize:   10,
    titleFontWeight:  700,
    titleColor:       FG,
    titleBottomGap:   6,
    maxWidth:        160,
  },

  section: {
    bandOpacityEven: 0.06,
    bandOpacityOdd:  0.00,
    bandFillEven:    CYAN_DIM,
    bandFillOdd:     BG,
    labelFontSize:    9,
    labelFontWeight:  700,
    labelColor:       CYAN,
    labelOpacity:     0.7,
  },

  // Vertical-spine uses cards with dark background
  entryStyle: 'card',

  // Gradient/cloud canvas background for Skia backend
  sceneBackground: {
    kind:        'cloud',
    baseColor:   '#0D1B2A',
    accentColor: '#1A3A5C',
    intensity:   1.4,
  },

  // Art-effect tokens: attached by layout engine to node/card primitives.
  // SVG backend silently omits all effects.
  effects: {
    nodeEffects: [
      { kind: 'glow', color: '#00D4FF', radius: 18 },
    ],
    cardEffects: [
      { kind: 'shadow', dx: 2, dy: 4, blur: 10, color: '#00000088' },
    ],
    activityEffects: [
      { kind: 'shadow', dx: 1, dy: 2, blur: 6, color: '#00000066' },
    ],
  },
};
