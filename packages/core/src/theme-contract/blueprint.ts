/**
 * @file theme-contract/blueprint.ts — Blueprint theme: technical / architectural.
 *
 * Classic architectural drawing-board look: deep blue field, cyan/white ink,
 * precise hairline strokes, zero corner radius, monospace family.
 * Like a real blueprint: content IS the art; no decorative effects.
 *
 * Fidelity Tier 1 (Crisp — no shadows or glow; precision over polish).
 * JetBrains Mono primary — the best-in-class technical monospace.
 */

import type { ThemeContract } from './types.js';

export const blueprint: ThemeContract = {
  id:   'blueprint',
  name: 'Blueprint',

  // ── Role palette ────────────────────────────────────────────────────────
  palette: {
    // Surfaces — deep draftsman blue: the unmistakable blueprint field
    surface:        '#1A2B47',
    surfaceRaised:  '#243554',
    surfaceOverlay: '#E8F0FF',
    // Panel/lane — a cool slightly-lighter band for track headers
    surfacePanel:   '#1E3159',
    inkPanel:       '#93C5FD',

    // Content — near-white with a cool blue tint; renders like white ink on blue
    ink:        '#E8F0FF',
    inkMuted:   '#93C5FD',
    inkInverse: '#1A2B47',

    // Brand — cyan: the technical annotation color on blueprints
    accent:       '#00BFFF',
    accentMuted:  '#6CB4E4',
    accentStrong: '#0099CC',

    // Borders — faint gridlines (the blueprint grid aesthetic)
    border:       '#2A3F62',
    borderStrong: '#3A5482',

    // Muted fills — slightly darker than surface (sunken panels)
    muted:       '#162238',
    mutedStrong: '#1A2B47',

    // Semantic status — clean technical palette on blue field
    statusSuccess: { fill: '#22C55E', stroke: '#16A34A' },
    statusWarning: { fill: '#FBBF24', stroke: '#D97706' },
    statusError:   { fill: '#EF4444', stroke: '#DC2626' },
    statusInfo:    { fill: '#00BFFF', stroke: '#0099CC' },

    // IR workflow states — annotation-blue language
    statusPlanned:   { fill: '#6CB4E4', stroke: '#00BFFF' },
    statusActive:    { fill: '#00BFFF', stroke: '#0099CC' },
    statusDone:      { fill: '#3A5482', stroke: '#2A3F62', opacity: 0.80 },
    statusCancelled: { fill: '#2A3F62', stroke: '#3A5482', opacity: 0.55, pattern: 'diagonal-hatch' },
    statusUncertain: { fill: '#2A3F62', stroke: '#3A5482', opacity: 0.65, pattern: 'dashed-border' },
  },

  // ── Data palette ────────────────────────────────────────────────────────
  dataPalette: {
    // Categorical — cyans, whites, and cool blues that read on #1A2B47.
    // Deliberately restrained and technical: no warm hues, no pastels.
    categorical: [
      '#00BFFF',  // 0 — cyan (primary accent, blueprint annotation)
      '#E8F0FF',  // 1 — near-white (high-contrast secondary)
      '#93C5FD',  // 2 — sky-blue
      '#38BDF8',  // 3 — light blue
      '#6CB4E4',  // 4 — steel blue
      '#BAE6FD',  // 5 — pale blue (extended series)
      '#0EA5E9',  // 6 — mid-blue
      '#7DD3FC',  // 7 — light sky (extended)
    ],

    // Sequential — dark blue → cyan ramp (engineering density encoding)
    sequential: {
      low:  '#1A2B47',
      mid:  '#2A7AB5',
      high: '#00BFFF',
    },

    // Diverging — error-red / field-blue / cyan (negative → neutral → positive)
    diverging: {
      negative: '#EF4444',
      zero:     '#243554',
      positive: '#00BFFF',
    },
  },

  // ── Typography ──────────────────────────────────────────────────────────
  // JetBrains Mono: technical monospace. Brings drafting-annotation precision.
  typography: {
    family:   'JetBrains Mono',
    fallback: "'Courier New', 'Lucida Console', monospace",

    scale: {
      xs:   7,   // very tight — technical annotation density
      sm:   9,
      base: 11,
      md:   13,
      lg:   18,
      xl:   24,
    },

    weights: {
      regular:  400,
      medium:   500,
      semibold: 600,
      bold:     700,
    },
  },

  // ── Spacing ─────────────────────────────────────────────────────────────
  // Normal density: tight grid-aligned packing, like a real technical drawing.
  spacing: {
    unit: 8,
    steps: {
      xxs:  2,
      xs:   4,
      sm:   8,
      md:  16,
      lg:  24,
      xl:  32,
      xxl: 48,
    },
  },

  // ── Density ─────────────────────────────────────────────────────────────
  // Normal: grid-tight — more information per unit area.
  density: 'normal',

  // ── Shape language ──────────────────────────────────────────────────────
  // Cornerless (0px radius): hard right angles, like drafted edges.
  // Orthogonal connectors: precise routing, no curves.
  // 1.5× stroke scale: slightly heavier lines for technical precision.
  // Diamond markers: engineering milestone markers.
  shape: {
    cornerRadius:   0,
    nodePadding:   10,
    strokeScale:    1.5,
    connectorStyle: 'orthogonal',
    markerShape:    'diamond',
  },

  // ── Effects (Tier 1 — Crisp) ─────────────────────────────────────────────
  // Zero decoration: a real blueprint has no shadows or glow.
  // Precision IS the aesthetic — effects would undermine it.
  effects: {
    fidelity: 1,
    dropShadow: { enabled: false },
    glow:       { enabled: false },
    motion:     { enabled: false },
  },
};
