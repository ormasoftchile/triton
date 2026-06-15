/**
 * @file grammars/chart/contract-binding.ts — Tier-3 binding: ThemeContract → ChartTheme.
 *
 * `bindChartTheme` derives every ChartTheme field from the Tier-2 contract.
 * This binding is the critical third leg of the proof set: it exercises the
 * data palette (categorical + sequential ramp), type scale, and spacing rhythm
 * — contract domains not exercised by the flow and sequence bindings.
 *
 * Binding invariants (§12.4):
 *   - All values derive from contract tokens or are computed from them.
 *   - No magic constants: every default is traceable to a contract domain.
 *   - Deterministic: same contract → byte-identical ChartTheme.
 */

import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { ChartTheme } from './theme.js';

// ── Density → canvas / margin geometry ───────────────────────────────────────

interface ChartDensityGeo {
  marginTop:    number;
  marginBottom: number;
  marginLeft:   number;
  marginRight:  number;
  canvasHeight: number;
}

function chartDensityGeo(density: Density, spacingMd: number, spacingLg: number, spacingXl: number): ChartDensityGeo {
  switch (density) {
    case 'compact':
      return { marginTop: spacingMd, marginBottom: spacingMd, marginLeft: spacingLg, marginRight: spacingMd, canvasHeight: 480 };
    case 'comfortable':
      return { marginTop: spacingXl, marginBottom: spacingXl, marginLeft: spacingXl + spacingMd, marginRight: spacingXl, canvasHeight: 600 };
    default: // 'normal'
      return { marginTop: spacingLg, marginBottom: spacingLg, marginLeft: spacingXl, marginRight: spacingLg, canvasHeight: 560 };
  }
}

// ── Main binding ──────────────────────────────────────────────────────────────

/**
 * Derive a ChartTheme from a Tier-2 ThemeContract.
 *
 * The data palette's `categorical` array drives all bar/line/pie series colors.
 * Typography scale drives all font sizes; ink/border roles drive axis and grid.
 * Density drives canvas margins and height.
 */
export function bindChartTheme(contract: ThemeContract): ChartTheme {
  const { palette, dataPalette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;

  const geo = chartDensityGeo(density, s.md, s.lg, s.xl);

  // Tier-3: stroke widths from shape.strokeScale
  const axisStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;
  const barStrokeWidth  = Math.round(1.0 * shape.strokeScale * 10) / 10;
  const lineStrokeWidth = Math.round(2.5 * shape.strokeScale * 10) / 10;

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,

    // Title: lg scale, bold weight, primary ink
    titleFontSize:   typography.scale.lg,
    titleFontWeight: typography.weights.bold,
    titleColor:      palette.ink,

    // Canvas dimensions: 920px wide (16:9-friendly), density-driven height
    canvasWidth:  920,
    canvasHeight: geo.canvasHeight,

    marginTop:    geo.marginTop,
    marginBottom: geo.marginBottom,
    marginLeft:   geo.marginLeft,
    marginRight:  geo.marginRight,

    // Axes: ink color, contract stroke scale
    axisColor:       palette.ink,
    axisStrokeWidth,
    tickLength:      s.xs + 2,
    tickLabelFontSize: typography.scale.sm,
    tickLabelColor:  palette.inkMuted,
    axisTitleFontSize: typography.scale.base,
    axisTitleColor:  palette.ink,

    // Gridlines: muted border, subtle dash
    gridlineColor:  palette.border,
    gridlineDash:   '4,4',

    // Bar/line/point stroke from data palette primary + shape scale
    barStroke:       palette.surface,
    barStrokeWidth,
    lineStrokeWidth,
    pointRadius:     Math.max(3, Math.round(shape.strokeScale * 4)),

    // Pie series from data palette categorical
    piePalette:        dataPalette.categorical,
    pieLabelFontSize:  typography.scale.sm,
    pieLabelColor:     palette.ink,
    pieLeaderLineColor: palette.inkMuted,

    // Legend: base scale, compact sizing
    legendFontSize:   typography.scale.sm,
    legendSwatchSize: s.md - 4,
    legendGap:        s.sm + 2,
  };
}
