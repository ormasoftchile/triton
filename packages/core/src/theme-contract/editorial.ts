/**
 * @file theme-contract/editorial.ts — Editorial theme: warm print/magazine.
 *
 * Warm cream paper surface, near-black ink, a single refined burgundy accent.
 * Lora serif primary — elegant, high-legibility, widely used in quality editorial.
 * Generous whitespace, restrained effects, a palette that could come off a printing press.
 *
 * "Typography is design, and design is typography." — the editorial conviction.
 *
 * Fidelity Tier 2 (Polished). Ink-style shadow, no glow.
 */

import type { ThemeContract } from './types.js';

export const editorial: ThemeContract = {
  id:   'editorial',
  name: 'Editorial',

  // ── Role palette ────────────────────────────────────────────────────────
  palette: {
    // Surfaces — warm cream paper: #FAF6EF (aged, warm, paper-like)
    surface:        '#FAF6EF',
    surfaceRaised:  '#F3EDE2',
    surfaceOverlay: '#1A1208',
    // Panel/lane — a warm slightly-deeper band for section headers
    surfacePanel:   '#EDE5D8',
    inkPanel:       '#3D2C1E',

    // Content — near-black warm ink (not pure black: too cold for cream paper)
    ink:        '#1A1208',
    inkMuted:   '#8B7355',
    inkInverse: '#FAF6EF',

    // Brand — burgundy: restrained, editorial, wine-colored
    accent:       '#8B2635',
    accentMuted:  '#B5606F',
    accentStrong: '#6B1826',

    // Borders — warm parchment lines (think typeset rule)
    border:       '#D9CFC0',
    borderStrong: '#B8A898',

    // Muted fills — warm off-white, slightly deeper than surface
    muted:       '#EDE5D8',
    mutedStrong: '#D9CFC0',

    // Semantic status — toned for warm/print context
    statusSuccess: { fill: '#2D6A3F', stroke: '#1E4E2C' },
    statusWarning: { fill: '#92400E', stroke: '#78350F' },
    statusError:   { fill: '#8B2635', stroke: '#6B1826' },
    statusInfo:    { fill: '#4A5A6B', stroke: '#374554' },

    // IR workflow states — warm editorial color language
    statusPlanned:   { fill: '#B5606F', stroke: '#8B2635' },
    statusActive:    { fill: '#8B2635', stroke: '#6B1826' },
    statusDone:      { fill: '#B8A898', stroke: '#8B7355', opacity: 0.85 },
    statusCancelled: { fill: '#D9CFC0', stroke: '#B8A898', opacity: 0.60, pattern: 'diagonal-hatch' },
    statusUncertain: { fill: '#D9CFC0', stroke: '#B8A898', opacity: 0.70, pattern: 'dashed-border' },
  },

  // ── Data palette ────────────────────────────────────────────────────────
  dataPalette: {
    // Categorical — muted, warm, print-harmonious; as if from a Pantone swatch book.
    // Burgundy anchors, supported by forest, ochre, teal, dusty violet.
    // No electric hues — this palette feels printed, not backlit.
    categorical: [
      '#8B2635',  // 0 — burgundy (primary accent)
      '#4A7C59',  // 1 — forest green
      '#B87333',  // 2 — copper/ochre
      '#4A5A6B',  // 3 — slate blue
      '#7B5E3A',  // 4 — warm brown
      '#8B5CF6',  // 5 — muted violet
      '#2D6A3F',  // 6 — deep forest (extended)
      '#9C6B3C',  // 7 — amber-brown (extended)
    ],

    // Sequential — cream wash → warm mid → deep burgundy
    sequential: {
      low:  '#F3EDE2',
      mid:  '#B5606F',
      high: '#8B2635',
    },

    // Diverging — forest/cream/burgundy (positive → neutral → negative)
    diverging: {
      negative: '#8B2635',
      zero:     '#EDE5D8',
      positive: '#2D6A3F',
    },
  },

  // ── Typography ──────────────────────────────────────────────────────────
  // Lora: a well-known editorial serif with calligraphic roots —
  // beautiful for both headings and body text, designed for screen reading.
  typography: {
    family:   'Lora',
    fallback: "Georgia, 'Times New Roman', serif",

    scale: {
      xs:   8,
      sm:   10,
      base: 12,
      md:   15,  // slightly generous md for editorial hierarchy
      lg:   22,
      xl:   30,
    },

    weights: {
      regular:  400,
      medium:   500,
      semibold: 600,
      bold:     700,
    },
  },

  // ── Spacing ─────────────────────────────────────────────────────────────
  // Generous whitespace — the hallmark of quality editorial design.
  // "White space is not empty space; it is breathing room."
  spacing: {
    unit: 8,
    steps: {
      xxs:  2,
      xs:   4,
      sm:   8,
      md:  20,  // wider than default for editorial air
      lg:  28,
      xl:  40,
      xxl: 56,
    },
  },

  // ── Density ─────────────────────────────────────────────────────────────
  // Comfortable: generous, magazine-spread whitespace.
  density: 'comfortable',

  // ── Shape language ──────────────────────────────────────────────────────
  // 3px corner radius: slight softening that feels hand-typeset, not digital.
  // Elbow connectors: editorial diagrams prefer clean right-angle routing.
  // 0.9× stroke scale: slightly lighter — ink on paper looks delicate.
  // Circle markers: clean milestone dots, like typeset bullet marks.
  shape: {
    cornerRadius:   3,
    nodePadding:   14,
    strokeScale:    0.9,
    connectorStyle: 'elbow',
    markerShape:    'circle',
  },

  // ── Effects (Tier 2 — Polished) ─────────────────────────────────────────
  // Warm ink-shadow (warm-black alpha): like a printed element with
  // subtle letterpress depth. No glow — glow is a backlit concept.
  effects: {
    fidelity: 2,
    dropShadow: {
      enabled: true,
      blur:    3,
      color:   'rgba(26,18,8,0.12)',
      offsetX: 1,
      offsetY: 2,
    },
    glow:   { enabled: false },
    motion: { enabled: false },
  },
};
