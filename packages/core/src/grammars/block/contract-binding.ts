/**
 * @file grammars/block/contract-binding.ts — Tier-3 binding: ThemeContract → BlockTheme.
 */

import type { Density, ThemeContract } from '../../theme-contract/types.js';
import type { BlockTheme } from './theme.js';

interface BlockDensityLayout {
  margin: number;
  cellWidth: number;
  cellHeight: number;
  cellGapX: number;
  cellGapY: number;
}

function densityLayout(density: Density): BlockDensityLayout {
  switch (density) {
    case 'comfortable':
      return { margin: 48, cellWidth: 128, cellHeight: 54, cellGapX: 20, cellGapY: 20 };
    case 'compact':
      return { margin: 32, cellWidth: 112, cellHeight: 46, cellGapX: 14, cellGapY: 14 };
    default:
      return { margin: 40, cellWidth: 120, cellHeight: 50, cellGapX: 16, cellGapY: 16 };
  }
}

export function bindBlockTheme(contract: ThemeContract): BlockTheme {
  const { palette, typography, density, shape } = contract;
  const geo = densityLayout(density);
  const nodeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    cellWidth: geo.cellWidth,
    cellHeight: geo.cellHeight,
    cellGapX: geo.cellGapX,
    cellGapY: geo.cellGapY,
    blockFill: palette.muted,
    blockStroke: palette.accent,
    blockStrokeWidth: nodeStrokeWidth,
    blockRx: shape.cornerRadius,
    blockFontSize: typography.scale.md,
    blockFontWeight: typography.weights.semibold,
    blockTextColor: palette.ink,
    circleFill: palette.muted,
    circleStroke: palette.accentMuted,
    diamondFill: palette.surfaceRaised,
    diamondStroke: palette.borderStrong,
    groupFill: palette.surfaceRaised,
    groupStroke: palette.border,
    groupLabelFontSize: typography.scale.base,
    groupLabelColor: palette.inkMuted,
    arrowStroke: palette.borderStrong,
    arrowStrokeWidth: nodeStrokeWidth,
    arrowFontSize: typography.scale.sm,
    arrowLabelColor: palette.inkMuted,
  };
}
