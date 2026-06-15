/**
 * @file theme-contract/pastel.ts — Pastel theme: soft, friendly, approachable.
 *
 * Warm off-white surface, muted lavender/periwinkle accent, generous 12px corner
 * radius, Nunito rounded sans-serif, comfortable density, curved connectors.
 * The antithesis of blueprint's austere technical precision — this theme is
 * inviting, gentle, and warm: diagrams you'd find in a product onboarding flow
 * or a friendly documentation site.
 *
 * Distinct from every existing theme:
 *   executive — crisp white / navy (professional cold)
 *   midnight  — dark charcoal / cyan (dev-doc dark)
 *   blueprint — dark blue field / mono precision
 *   editorial — warm cream / burgundy (serious print)
 *   terminal  — near-black / phosphor green (machine room)
 *   mono      — pure grayscale (chroma-free)
 *
 * Pastel is the only warm light theme with a pastel accent, a rounded font,
 * and a 12px corner radius — the most visually distinct shape profile in the set.
 *
 * Fidelity Tier 2 (Polished — gentle shadow for lift, no glow).
 */

import type { ThemeContract } from './types.js';

export const pastel: ThemeContract = {
  id:   'pastel',
  name: 'Pastel',

  // ── Role palette ────────────────────────────────────────────────────────
  palette: {
    // Surfaces — very light warm off-white with the faintest hint of pink
    surface:        '#FFF8F6',
    surfaceRaised:  '#FFF0ED',
    surfaceOverlay: '#3D2E5A',
    // Panel/lane — a gentle lavender-tinted band; warm but not harsh
    surfacePanel:   '#F0EBF8',
    inkPanel:       '#5B4F80',

    // Content — warm near-black ink (not neutral grey — there's subtle warmth)
    ink:        '#2D2540',
    inkMuted:   '#7B6F8E',
    inkInverse: '#FFF8F6',

    // Brand — soft lavender/periwinkle: gentle, unmistakably pastel
    accent:       '#8B7ED8',
    accentMuted:  '#B0A8E8',
    accentStrong: '#6B5FC0',

    // Borders — very light lavender-tinted lines; gentle dividers
    border:       '#E8E0F0',
    borderStrong: '#C8BCDC',

    // Muted fills — warm lavender-tinted off-white
    muted:       '#F0EBF8',
    mutedStrong: '#E0D8EC',

    // Semantic status — softened, pastel-toned (not harsh traffic-light primaries)
    statusSuccess: { fill: '#5B9C72', stroke: '#4A7D5D' },
    statusWarning: { fill: '#D4914A', stroke: '#B07538' },
    statusError:   { fill: '#C96060', stroke: '#A84848' },
    statusInfo:    { fill: '#8B7ED8', stroke: '#6B5FC0' },

    // IR workflow states — soft pastel language
    statusPlanned:   { fill: '#B0A8E8', stroke: '#8B7ED8' },
    statusActive:    { fill: '#8B7ED8', stroke: '#6B5FC0' },
    statusDone:      { fill: '#C8BCDC', stroke: '#B0A8E8', opacity: 0.85 },
    statusCancelled: { fill: '#E8E0F0', stroke: '#C8BCDC', opacity: 0.60, pattern: 'diagonal-hatch' },
    statusUncertain: { fill: '#E8E0F0', stroke: '#C8BCDC', opacity: 0.70, pattern: 'dashed-border' },
  },

  // ── Data palette ────────────────────────────────────────────────────────
  dataPalette: {
    // Categorical — all muted pastels that harmonize on a warm off-white surface.
    // Lavender anchors, supported by soft coral, mint, sky, peach, mauve.
    // None of these are electric or saturated — every hue has been tinted with white.
    categorical: [
      '#8B7ED8',  // 0 — soft lavender (primary accent)
      '#E8948C',  // 1 — soft coral/rose
      '#7EB89C',  // 2 — soft sage green
      '#7EB4D4',  // 3 — soft sky blue
      '#E8B87A',  // 4 — soft peach/amber
      '#C498C8',  // 5 — soft mauve/purple
      '#7ED4C4',  // 6 — soft seafoam
      '#D4B87A',  // 7 — soft golden ochre
    ],

    // Sequential — soft blush → mid lavender → deeper periwinkle
    sequential: {
      low:  '#F5EEFB',
      mid:  '#B0A8E8',
      high: '#6B5FC0',
    },

    // Diverging — soft coral / warm white / soft sage
    // (gentle — no harsh traffic-light semantics, everything is softened)
    diverging: {
      negative: '#C96060',
      zero:     '#FFF0ED',
      positive: '#5B9C72',
    },
  },

  // ── Typography ──────────────────────────────────────────────────────────
  // Nunito: a well-balanced rounded sans-serif. Its rounded terminals are the
  // defining feature — friendly without being childish. Widely used in product
  // design, onboarding flows, and friendly documentation.
  typography: {
    family:   'Nunito',
    fallback: "Poppins, 'Segoe UI', system-ui, sans-serif",

    // Slightly larger base for the friendly approachable feel
    scale: {
      xs:   9,
      sm:   11,
      base: 13,
      md:   16,
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
  // Generous whitespace — openness is part of the friendly, approachable feel.
  spacing: {
    unit: 8,
    steps: {
      xxs:  2,
      xs:   4,
      sm:   8,
      md:  16,
      lg:  28,   // slightly wider for breathable pastel feel
      xl:  40,
      xxl: 56,
    },
  },

  // ── Density ─────────────────────────────────────────────────────────────
  // Comfortable: open layout mirrors the soft, generous aesthetic.
  density: 'comfortable',

  // ── Shape language ──────────────────────────────────────────────────────
  // 12px corner radius: the most generous in the theme set — a defining
  // characteristic of the pastel identity. Everything is pillbox-rounded.
  // Curved connectors: fluid, organic paths reinforce the softness.
  // Circle markers: friendliest milestone shape.
  shape: {
    cornerRadius:   12,
    nodePadding:    16,
    strokeScale:    0.85,   // slightly lighter strokes — gentle, not bold
    connectorStyle: 'curved',
    markerShape:    'circle',
  },

  // ── Effects (Tier 2 — Polished) ─────────────────────────────────────────
  // Soft, warm pink-tinted shadow: adds gentle depth without heaviness.
  // No glow — glow is a backlit/electric concept; pastels are matte-warm.
  effects: {
    fidelity: 2,
    dropShadow: {
      enabled: true,
      blur:    6,
      color:   'rgba(139,126,216,0.12)',   // lavender-tinted alpha
      offsetX: 0,
      offsetY: 3,
    },
    glow:   { enabled: false },
    motion: { enabled: false },
  },
};
