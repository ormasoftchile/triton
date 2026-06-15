/**
 * @file theme-contract/executive.ts — Executive theme: one concrete ThemeContract.
 *
 * Corporate boardroom aesthetic. Navy/slate on white, refined accent, clean
 * serif type scale with clear weight hierarchy, comfortable density, subtle
 * effects. Fidelity Tier 2 (Polished). 16:9 slide target.
 *
 * "Beautiful, coherent, beats Mermaid" — this is the showcase theme.
 */

import type { ThemeContract } from './types.js';

export const executive: ThemeContract = {
  id:   'executive',
  name: 'Executive',

  // ── Role palette ────────────────────────────────────────────────────────
  palette: {
    // Surfaces — crisp white canvas with barely-there elevation tones
    surface:        '#FFFFFF',
    surfaceRaised:  '#F8F9FA',
    surfaceOverlay: '#0F172A',

    // Content — dark slate ink (warmer than pure black; more professional)
    ink:        '#1E293B',
    inkMuted:   '#64748B',
    inkInverse: '#F8FAFC',

    // Brand — navy blue: authoritative, restrained
    accent:       '#1F497D',
    accentMuted:  '#6B92BF',
    accentStrong: '#0D2B4E',

    // Borders — barely-there on white, visible when needed
    border:       '#E2E8F0',
    borderStrong: '#94A3B8',

    // Muted fill regions — off-white backgrounds, light grey
    muted:       '#F1F5F9',
    mutedStrong: '#CBD5E1',

    // Semantic status — clear, professional color communication
    statusSuccess: { fill: '#166534', stroke: '#14532D' },
    statusWarning: { fill: '#92400E', stroke: '#78350F' },
    statusError:   { fill: '#991B1B', stroke: '#7F1D1D' },
    statusInfo:    { fill: '#1F497D', stroke: '#0D2B4E' },

    // IR workflow states — navy/slate language, not traffic lights
    statusPlanned:   { fill: '#6B92BF', stroke: '#1F497D' },
    statusActive:    { fill: '#1F497D', stroke: '#0D2B4E' },
    statusDone:      { fill: '#64748B', stroke: '#475569', opacity: 0.85 },
    statusCancelled: { fill: '#CBD5E1', stroke: '#94A3B8', opacity: 0.60 },
    statusUncertain: { fill: '#CBD5E1', stroke: '#94A3B8', opacity: 0.70 },
  },

  // ── Data palette ────────────────────────────────────────────────────────
  dataPalette: {
    // Categorical — navy-anchored professional series colors.
    // Index 0 is always the primary accent; subsequent entries are
    // coordinated complements that cohere on a white canvas.
    categorical: [
      '#1F497D',  // 0 — navy (primary)
      '#2E86AB',  // 1 — steel blue
      '#4CAF82',  // 2 — teal-green
      '#D97706',  // 3 — amber (warm contrast)
      '#7C3AED',  // 4 — violet (sophisticated pop)
      '#0891B2',  // 5 — cyan-blue
      '#B45309',  // 6 — dark amber (extended series)
      '#0D2B4E',  // 7 — deep navy (extended series)
    ],

    // Sequential — navy ramp (light wash → saturated → deep)
    sequential: {
      low:  '#EEF4FB',
      mid:  '#6B92BF',
      high: '#0D2B4E',
    },

    // Diverging — amber/navy (negative risk → neutral → positive progress)
    diverging: {
      negative: '#991B1B',
      zero:     '#F1F5F9',
      positive: '#166534',
    },
  },

  // ── Typography ──────────────────────────────────────────────────────────
  // Georgia is the canonical "boardroom serif" — universally available,
  // reads well at small sizes, communicates credibility.
  typography: {
    family:   'Georgia',
    fallback: "'Times New Roman', serif",

    // Scale aligned to 16:9 slide target: slightly generous for readability
    // at projection distances. pt values per §12 spec baseline.
    scale: {
      xs:   8,   // axis ticks, dense chart labels
      sm:   10,  // captions, secondary labels
      base: 12,  // body text, node labels, message text
      md:   14,  // section headers, participant names
      lg:   20,  // slide title
      xl:   28,  // hero / keynote headline
    },

    // Weight hierarchy: clear differentiation between header, label, body
    weights: {
      regular:  400,
      medium:   500,
      semibold: 600,
      bold:     700,
    },
  },

  // ── Spacing ─────────────────────────────────────────────────────────────
  // Base unit = 8px; comfortable density adds generous multiples.
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
  // Comfortable: generous whitespace; slide/poster readability.
  density: 'comfortable',

  // ── Shape language ──────────────────────────────────────────────────────
  // 4px corner radius: slight softening without losing authority.
  // Elbow connectors: clean, orthogonal — boardroom precision.
  shape: {
    cornerRadius:   4,
    nodePadding:   12,
    strokeScale:    1.0,
    connectorStyle: 'elbow',
  },

  // ── Effects (Tier 2 — Polished) ─────────────────────────────────────────
  // Subtle shadow for depth. No glow, no motion — the diagram earns
  // authority through typography and palette, not decoration.
  effects: {
    fidelity: 2,
    dropShadow: {
      enabled: true,
      blur:    4,
      color:   'rgba(15,23,42,0.10)',
      offsetX: 0,
      offsetY: 2,
    },
    glow:   { enabled: false },
    motion: { enabled: false },
  },
};
