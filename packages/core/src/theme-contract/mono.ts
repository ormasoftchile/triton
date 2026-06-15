/**
 * @file theme-contract/mono.ts — Mono theme: grayscale / chroma-free minimal.
 *
 * Pure grayscale palette: white surface, black/dark-gray ink, a single mid-gray
 * accent. No hue anywhere — the entire theme is achromatic. System-UI / Helvetica
 * Neue family: clean, neutral, invisible — the typeface that doesn't get in the way.
 *
 * This theme is a deliberate stress test of the ThemeContract abstraction:
 * does the contract degenerate gracefully when the data palette has zero chroma?
 * Answer: yes. The categorical sequence becomes a graded gray ramp; the sequential
 * and diverging ramps remain readable; every binding renders deterministically.
 *
 * Distinct from every other theme:
 *   executive — white surface, but has navy accent and Georgia serif
 *   midnight  — dark surface, cyan accent
 *   blueprint — dark surface, blue + cyan palette
 *   editorial — cream surface, burgundy + warm muted hues
 *   terminal  — near-black, phosphor green
 *   pastel    — warm off-white, lavender + pastel rainbow
 *
 * Mono is the only theme with literally zero chroma — no hue in any token.
 *
 * Fidelity Tier 1 (Crisp — no shadows, no glow; the restraint IS the aesthetic).
 */

import type { ThemeContract } from './types.js';

export const mono: ThemeContract = {
  id:   'mono',
  name: 'Mono',

  // ── Role palette ────────────────────────────────────────────────────────
  palette: {
    // Surfaces — pure white; no tint, no warmth, no cool — truly neutral
    surface:        '#FFFFFF',
    surfaceRaised:  '#F5F5F5',
    surfaceOverlay: '#1A1A1A',
    // Panel/lane — light gray; the only "elevation" in a chroma-free world
    surfacePanel:   '#EBEBEB',
    inkPanel:       '#2E2E2E',

    // Content — near-black (not pure black: 100% density reads as harsh)
    ink:        '#1A1A1A',
    inkMuted:   '#767676',
    inkInverse: '#FFFFFF',

    // Brand — single mid-gray accent (the "color" in a colorless theme)
    accent:       '#595959',
    accentMuted:  '#9E9E9E',
    accentStrong: '#2E2E2E',

    // Borders — light and medium grays; all readable on white
    border:       '#D4D4D4',
    borderStrong: '#9E9E9E',

    // Muted fills — off-white and light gray
    muted:       '#F0F0F0',
    mutedStrong: '#D4D4D4',

    // Semantic status — grayscale only; communicating state without color
    // Uses shades: dark for active/error, mid for warning/info, light for done
    statusSuccess: { fill: '#2E2E2E', stroke: '#1A1A1A' },
    statusWarning: { fill: '#595959', stroke: '#2E2E2E' },
    statusError:   { fill: '#1A1A1A', stroke: '#000000' },
    statusInfo:    { fill: '#767676', stroke: '#595959' },

    // IR workflow states — achromatic progression from light (planned) to dark (active)
    statusPlanned:   { fill: '#9E9E9E', stroke: '#767676' },
    statusActive:    { fill: '#595959', stroke: '#2E2E2E' },
    statusDone:      { fill: '#D4D4D4', stroke: '#9E9E9E', opacity: 0.85 },
    statusCancelled: { fill: '#EBEBEB', stroke: '#D4D4D4', opacity: 0.60, pattern: 'diagonal-hatch' },
    statusUncertain: { fill: '#EBEBEB', stroke: '#D4D4D4', opacity: 0.70, pattern: 'dashed-border' },
  },

  // ── Data palette ────────────────────────────────────────────────────────
  dataPalette: {
    // Categorical — graded gray ramp: the chroma-free test case.
    // 8 distinct gray levels; chosen for maximum step contrast between adjacent entries.
    // This is the canonical proof that the contract works without any hue.
    categorical: [
      '#595959',  // 0 — mid-dark gray (primary accent)
      '#2E2E2E',  // 1 — near-black (strong contrast series)
      '#9E9E9E',  // 2 — medium gray
      '#1A1A1A',  // 3 — darkest non-black
      '#BDBDBD',  // 4 — light-medium gray
      '#424242',  // 5 — dark gray
      '#D4D4D4',  // 6 — light gray
      '#757575',  // 7 — classic mid-gray
    ],

    // Sequential — white → medium gray → near-black
    sequential: {
      low:  '#F5F5F5',
      mid:  '#9E9E9E',
      high: '#1A1A1A',
    },

    // Diverging — achromatic; relies on luminance contrast rather than hue.
    // Darker = "strong" negative; white = neutral zero; mid-gray = positive.
    // Not ideal for semantic diverging charts, but proves the contract
    // doesn't require chroma in any slot.
    diverging: {
      negative: '#2E2E2E',
      zero:     '#F5F5F5',
      positive: '#767676',
    },
  },

  // ── Typography ──────────────────────────────────────────────────────────
  // Helvetica Neue / system-ui: the canonical "no-opinion" typeface stack.
  // Clean, neutral, universally available — does not assert a personality.
  typography: {
    family:   'Helvetica Neue',
    fallback: "Helvetica, Arial, system-ui, sans-serif",

    scale: {
      xs:   8,
      sm:   10,
      base: 12,
      md:   14,
      lg:   20,
      xl:   28,
    },

    weights: {
      regular:  400,
      medium:   500,
      semibold: 600,
      bold:     700,
    },
  },

  // ── Spacing ─────────────────────────────────────────────────────────────
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
  // Normal: the default — mono makes no strong claim about whitespace.
  density: 'normal',

  // ── Shape language ──────────────────────────────────────────────────────
  // 2px corner radius: the minimum softening — present but restrained.
  // Elbow connectors: clean, orthogonal routing; no curves (curves assert warmth).
  // 1.0× stroke scale: neutral — neither hair-thin nor bold.
  // Diamond markers: the only geometric variation in an otherwise neutral theme.
  shape: {
    cornerRadius:   2,
    nodePadding:   10,
    strokeScale:    1.0,
    connectorStyle: 'elbow',
    markerShape:    'diamond',
  },

  // ── Effects (Tier 1 — Crisp) ─────────────────────────────────────────────
  // Zero decoration: a grayscale diagram earns clarity through contrast alone.
  // Shadows and glows would add visual noise where restraint is the point.
  effects: {
    fidelity: 1,
    dropShadow: { enabled: false },
    glow:       { enabled: false },
    motion:     { enabled: false },
  },
};
