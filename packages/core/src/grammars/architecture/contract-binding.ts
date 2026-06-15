/**
 * @file grammars/architecture/contract-binding.ts — Tier-3 binding: ThemeContract → ArchitectureTheme.
 */

import type { Density, ThemeContract } from '../../theme-contract/types.js';
import type { ArchitectureTheme } from './theme.js';

interface ArchitectureDensityLayout {
  margin: number;
  gridCellWidth: number;
  gridCellHeight: number;
  servicePadX: number;
  servicePadTop: number;
  servicePadBottom: number;
  groupPaddingX: number;
  groupPaddingY: number;
}

function densityLayout(density: Density): ArchitectureDensityLayout {
  switch (density) {
    case 'comfortable':
      return {
        margin: 48,
        gridCellWidth: 144,
        gridCellHeight: 120,
        servicePadX: 16,
        servicePadTop: 14,
        servicePadBottom: 14,
        groupPaddingX: 18,
        groupPaddingY: 18,
      };
    case 'compact':
      return {
        margin: 32,
        gridCellWidth: 132,
        gridCellHeight: 104,
        servicePadX: 12,
        servicePadTop: 10,
        servicePadBottom: 10,
        groupPaddingX: 14,
        groupPaddingY: 14,
      };
    default:
      return {
        margin: 40,
        gridCellWidth: 140,
        gridCellHeight: 112,
        servicePadX: 14,
        servicePadTop: 12,
        servicePadBottom: 12,
        groupPaddingX: 16,
        groupPaddingY: 16,
      };
  }
}

export function bindArchitectureTheme(contract: ThemeContract): ArchitectureTheme {
  const { palette, typography, density, shape } = contract;
  const geo = densityLayout(density);
  const nodeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;
  const iconStrokeWidth = Math.round(shape.strokeScale * 1.35 * 100) / 100;

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    gridCellWidth: geo.gridCellWidth,
    gridCellHeight: geo.gridCellHeight,
    componentGapCols: 2,
    serviceMinWidth: 116,
    servicePadX: geo.servicePadX,
    servicePadTop: geo.servicePadTop,
    servicePadBottom: geo.servicePadBottom,
    serviceRx: shape.cornerRadius + 8,
    serviceFill: palette.surfaceRaised,
    serviceStroke: palette.border,
    serviceStrokeWidth: nodeStrokeWidth,
    serviceTitleFontSize: typography.scale.base,
    serviceTitleFontWeight: typography.weights.semibold,
    serviceTitleColor: palette.ink,
    serviceIconSize: 24,
    serviceIconColor: palette.accent,
    iconStrokeWidth,
    junctionRadius: 8,
    junctionFill: palette.borderStrong,
    junctionStroke: palette.border,
    junctionStrokeWidth: 1,
    groupFill: palette.muted,
    groupStroke: palette.border,
    groupStrokeWidth: Math.round(shape.strokeScale * 1.25 * 100) / 100,
    groupDashArray: '6,4',
    groupPaddingX: geo.groupPaddingX,
    groupPaddingY: geo.groupPaddingY,
    groupHeaderHeight: 28,
    groupTitleFontSize: typography.scale.base,
    groupTitleFontWeight: typography.weights.bold,
    groupTitleColor: palette.inkMuted,
    groupIconSize: typography.scale.md,
    edgeStroke: palette.borderStrong,
    edgeStrokeWidth: nodeStrokeWidth,
    edgeStub: 14,
    arrowSize: Math.max(7, Math.round(typography.scale.base * 0.6)),
    titleFontSize: typography.scale.lg,
    titleFontWeight: typography.weights.bold,
    titleColor: palette.ink,
  };
}
