/**
 * @file theme-contract/midnight.ts — Midnight theme: dark dev-doc aesthetic.
 *
 * Deep charcoal/slate canvas, luminous cyan accent, warm amber secondary.
 * Everything a dark-mode developer documentation site aspires to be:
 * crisp without being cold, vibrant without being loud.
 *
 * Fidelity Tier 2 (Polished). Subtle cyan glow on key elements.
 * Inter sans-serif — the canonical dev-doc typeface.
 */

import type { ThemeContract } from './types.js';

export const midnight: ThemeContract = {
  id:   'midnight',
  name: 'Midnight',

  // ── Role palette ────────────────────────────────────────────────────────
  palette: {
    // Surfaces — deep charcoal canvas, stepped elevation in slate
    surface:        '#0F1620',
    surfaceRaised:  '#1A2535',
    surfaceOverlay: '#E2E8F0',
    // Panel/lane — a shade lighter than surface, reads as a distinct band
    surfacePanel:   '#162030',
    inkPanel:       '#94A3B8',

    // Content — near-white ink with a cool tint; stays readable at small sizes
    ink:        '#E2E8F0',
    inkMuted:   '#64748B',
    inkInverse: '#0F1620',

    // Brand — vibrant cyan: readable on dark, signals interactivity
    accent:       '#00D4FF',
    accentMuted:  '#0EA5C4',
    accentStrong: '#00A8CC',

    // Borders — barely visible on dark, strong when needed
    border:       '#1E2D40',
    borderStrong: '#334A66',

    // Muted fills — dark recessed regions
    muted:       '#162030',
    mutedStrong: '#1E2D40',

    // Semantic status — shifted for dark surface legibility
    statusSuccess: { fill: '#059669', stroke: '#047857' },
    statusWarning: { fill: '#D97706', stroke: '#B45309' },
    statusError:   { fill: '#DC2626', stroke: '#B91C1C' },
    statusInfo:    { fill: '#00D4FF', stroke: '#00A8CC' },

    // IR workflow states — cyan-anchored on dark slate
    statusPlanned:   { fill: '#0EA5C4', stroke: '#00A8CC' },
    statusActive:    { fill: '#00D4FF', stroke: '#00A8CC' },
    statusDone:      { fill: '#334A66', stroke: '#1E2D40', opacity: 0.80 },
    statusCancelled: { fill: '#1E2D40', stroke: '#334A66', opacity: 0.55, pattern: 'diagonal-hatch' },
    statusUncertain: { fill: '#1E2D40', stroke: '#334A66', opacity: 0.65, pattern: 'dashed-border' },
  },

  // ── Data palette ────────────────────────────────────────────────────────
  dataPalette: {
    // Categorical — vivid-on-dark series; cyan anchors, warm amber contrasts.
    // Chosen for maximum distinguishability on a #0F1620 background.
    categorical: [
      '#00D4FF',  // 0 — cyan (primary accent)
      '#F59E0B',  // 1 — amber (warm counterpoint)
      '#34D399',  // 2 — emerald (cool-warm bridge)
      '#A78BFA',  // 3 — violet
      '#F87171',  // 4 — coral-red
      '#38BDF8',  // 5 — sky (lighter cyan sibling)
      '#FB923C',  // 6 — orange (warm extended)
      '#4ADE80',  // 7 — green (extended)
    ],

    // Sequential — cyan wash ramp on dark (near-black → mid-blue → vivid cyan)
    sequential: {
      low:  '#162030',
      mid:  '#0EA5C4',
      high: '#00D4FF',
    },

    // Diverging — coral/dark/cyan (negative → neutral dark → positive cyan)
    diverging: {
      negative: '#DC2626',
      zero:     '#1A2535',
      positive: '#00D4FF',
    },
  },

  // ── Typography ──────────────────────────────────────────────────────────
  // Inter: the canonical dev-doc and modern UI typeface.
  typography: {
    family:   'Inter',
    fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",

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
  // Comfortable: generous air in dark environments aids readability.
  density: 'comfortable',

  // ── Shape language ──────────────────────────────────────────────────────
  // 6px corner radius: softer than executive, approachable dev-doc feel.
  // Curved connectors: fluid, friendly — the opposite of blueprint precision.
  shape: {
    cornerRadius:   6,
    nodePadding:   12,
    strokeScale:    1.0,
    connectorStyle: 'curved',
    markerShape:    'circle',
  },

  // ── Effects (Tier 2 — Polished) ─────────────────────────────────────────
  // Subtle cyan glow on key elements: the hallmark of the dark-mode aesthetic.
  // Soft shadow uses dark-tinted alpha, not opaque black.
  effects: {
    fidelity: 2,
    dropShadow: {
      enabled: true,
      blur:    8,
      color:   'rgba(0,212,255,0.08)',
      offsetX: 0,
      offsetY: 2,
    },
    glow: {
      enabled: true,
      color:   'rgba(0,212,255,0.20)',
      radius:  6,
    },
    motion: { enabled: false },
  },
};
