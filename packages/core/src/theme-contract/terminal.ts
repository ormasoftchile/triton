/**
 * @file theme-contract/terminal.ts — Terminal theme: retro CRT / hacker aesthetic.
 *
 * Near-matte-black surface, phosphor green ink and accent, classic Courier New
 * monospace, hard right-angle corners, straight-line routing, zero decoration.
 * Deliberately evokes a 1980s VT100 terminal or green-screen CRT display.
 *
 * Distinct from midnight (modern dark UI with cyan glow, Inter, curved routes)
 * and blueprint (dark BLUE field, cool-only palette, technical annotation).
 * Terminal lives in a different universe: black canvas, one-hue phosphor palette,
 * classic machine-room mono — the aesthetic is the constraint, not the polish.
 *
 * Fidelity Tier 1 (Crisp — no shadows or glow; precision monochrome over decoration).
 */

import type { ThemeContract } from './types.js';

export const terminal: ThemeContract = {
  id:   'terminal',
  name: 'Terminal',

  // ── Role palette ────────────────────────────────────────────────────────
  palette: {
    // Surfaces — near-matte black; the opposite of midnight's "slate charcoal"
    surface:        '#0C0C0C',
    surfaceRaised:  '#141414',
    surfaceOverlay: '#33FF00',
    // Panel/lane — barely lighter than surface; a dim region between dark zones
    surfacePanel:   '#111111',
    inkPanel:       '#33FF00',

    // Content — phosphor green: the canonical CRT text color
    ink:        '#33FF00',
    inkMuted:   '#1E9900',   // dim phosphor: secondary / de-emphasized text
    inkInverse: '#0C0C0C',

    // Brand — same phosphor green (intentionally monochromatic)
    accent:       '#33FF00',
    accentMuted:  '#1E9900',
    accentStrong: '#00CC00',

    // Borders — dark hairlines; visible only when needed
    border:       '#1C1C1C',
    borderStrong: '#2C2C2C',

    // Muted fills — sunken-panel dark
    muted:       '#111111',
    mutedStrong: '#1C1C1C',

    // Semantic status — terminal signal language: green=ok, amber=warn, red=err
    statusSuccess: { fill: '#33FF00', stroke: '#00CC00' },
    statusWarning: { fill: '#FFB800', stroke: '#CC9200' },
    statusError:   { fill: '#FF3333', stroke: '#CC0000' },
    statusInfo:    { fill: '#33FF00', stroke: '#00CC00' },

    // IR workflow states — CRT-screen palette (dim/bright phosphor + amber)
    statusPlanned:   { fill: '#1E9900', stroke: '#33FF00' },
    statusActive:    { fill: '#33FF00', stroke: '#00CC00' },
    statusDone:      { fill: '#1C1C1C', stroke: '#2C2C2C', opacity: 0.80 },
    statusCancelled: { fill: '#111111', stroke: '#1E9900', opacity: 0.55, pattern: 'diagonal-hatch' },
    statusUncertain: { fill: '#111111', stroke: '#1E9900', opacity: 0.65, pattern: 'dashed-border' },
  },

  // ── Data palette ────────────────────────────────────────────────────────
  dataPalette: {
    // Categorical — phosphor green primary, then amber (the other classic CRT hue),
    // then white (high-contrast), then cyan, then red — the classic terminal color set.
    // All chosen for maximum distinctness on a #0C0C0C background.
    categorical: [
      '#33FF00',  // 0 — phosphor green (primary accent)
      '#FFB800',  // 1 — amber (second CRT family: classic HP amber monitor)
      '#00FFFF',  // 2 — cyan (ANSI terminal cyan)
      '#FF3333',  // 3 — red (error / attention)
      '#FFFFFF',  // 4 — white (high-contrast label)
      '#1E9900',  // 5 — dim phosphor (de-emphasized series)
      '#CC9200',  // 6 — dim amber
      '#009999',  // 7 — dim cyan
    ],

    // Sequential — matte black → dim green → bright phosphor
    sequential: {
      low:  '#0C0C0C',
      mid:  '#1E9900',
      high: '#33FF00',
    },

    // Diverging — red error / dark neutral / green success (classic terminal semantics)
    diverging: {
      negative: '#FF3333',
      zero:     '#1C1C1C',
      positive: '#33FF00',
    },
  },

  // ── Typography ──────────────────────────────────────────────────────────
  // Courier New: the canonical CRT terminal typeface, universally available.
  // Not JetBrains Mono (that belongs to blueprint's modern-technical identity).
  typography: {
    family:   'Courier New',
    fallback: "'Courier', 'Lucida Console', monospace",

    // Slightly larger scale to compensate for Courier New's lower density vs JetBrains Mono
    scale: {
      xs:   8,
      sm:   10,
      base: 12,
      md:   14,
      lg:   18,
      xl:   24,
    },

    // Monospace fonts typically offer only regular and bold; honour that reality
    weights: {
      regular:  400,
      medium:   400,   // no true medium in most monospace stacks
      semibold: 700,
      bold:     700,
    },
  },

  // ── Spacing ─────────────────────────────────────────────────────────────
  // Tighter than executive/midnight — CRT screens were information-dense.
  spacing: {
    unit: 8,
    steps: {
      xxs:  2,
      xs:   4,
      sm:   8,
      md:  12,   // tighter than default 16
      lg:  20,
      xl:  28,
      xxl: 40,
    },
  },

  // ── Density ─────────────────────────────────────────────────────────────
  // Compact: CRT terminal aesthetic is information-dense; whitespace is waste.
  density: 'compact',

  // ── Shape language ──────────────────────────────────────────────────────
  // Zero corner radius: hard right angles — no softening, nothing rounded.
  // Straight connectors: direct lines between nodes, like ASCII diagrams.
  // Square markers: block-cursor aesthetic.
  // Nodding padding tight to match compact density.
  shape: {
    cornerRadius:   0,
    nodePadding:    8,
    strokeScale:    1.0,
    connectorStyle: 'straight',
    markerShape:    'square',
  },

  // ── Effects (Tier 1 — Crisp) ─────────────────────────────────────────────
  // Zero decoration: a real CRT terminal has no CSS drop shadows.
  // The phosphor glow is implicit in the palette brightness, not an SVG filter.
  effects: {
    fidelity: 1,
    dropShadow: { enabled: false },
    glow:       { enabled: false },
    motion:     { enabled: false },
  },
};
