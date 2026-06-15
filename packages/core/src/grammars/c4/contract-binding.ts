/**
 * @file grammars/c4/contract-binding.ts — Tier-3 binding: ThemeContract → C4Theme.
 */

import type { Density, ThemeContract } from '../../theme-contract/types.js';
import type { C4Theme } from './theme.js';

interface C4DensityLayout {
  margin: number;
  elementPadX: number;
  elementPadY: number;
  elementGapX: number;
  elementGapY: number;
  boundaryPadX: number;
  boundaryPadY: number;
}

function densityLayout(density: Density): C4DensityLayout {
  switch (density) {
    case 'comfortable':
      return { margin: 48, elementPadX: 18, elementPadY: 14, elementGapX: 80, elementGapY: 60, boundaryPadX: 24, boundaryPadY: 20 };
    case 'compact':
      return { margin: 32, elementPadX: 12, elementPadY: 8, elementGapX: 64, elementGapY: 44, boundaryPadX: 16, boundaryPadY: 12 };
    default:
      return { margin: 32, elementPadX: 16, elementPadY: 12, elementGapX: 72, elementGapY: 52, boundaryPadX: 20, boundaryPadY: 16 };
  }
}

export function bindC4Theme(contract: ThemeContract): C4Theme {
  const { palette, typography, density, shape } = contract;
  const geo = densityLayout(density);
  const nodeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;
  const lineHeight = Math.round(typography.scale.base * 1.6);

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    elementPadX: geo.elementPadX,
    elementPadY: geo.elementPadY,
    elementMinWidth: 160,
    elementGapX: geo.elementGapX,
    elementGapY: geo.elementGapY,
    stereotypeFontSize: typography.scale.xs,
    stereotypeColor: palette.accentMuted,
    nameFontSize: typography.scale.base,
    nameFontWeight: typography.weights.bold,
    nameColor: palette.inkInverse,
    descFontSize: typography.scale.xs,
    descColor: `${palette.inkInverse}cc`,
    descLineHeight: Math.round(typography.scale.base * 1.3),
    descMaxWidth: 140,
    personFill: palette.accentStrong,
    personStroke: palette.accent,
    personTextColor: palette.inkInverse,
    systemFill: palette.accent,
    systemStroke: palette.accentStrong,
    systemTextColor: palette.inkInverse,
    containerFill: palette.accentMuted,
    containerStroke: palette.accent,
    containerTextColor: palette.inkInverse,
    componentFill: palette.muted,
    componentStroke: palette.accentMuted,
    componentTextColor: palette.ink,
    extFill: palette.mutedStrong,
    extStroke: palette.borderStrong,
    extTextColor: palette.ink,
    boundaryStroke: palette.borderStrong,
    boundaryStrokeWidth: nodeStrokeWidth,
    boundaryDash: '8,5',
    boundaryFill: palette.surfacePanel,
    boundaryRx: shape.cornerRadius + 8,
    boundaryHeaderHeight: 36,
    boundaryLabelFontSize: typography.scale.base + 1,
    boundaryLabelColor: palette.ink,
    boundaryPadX: geo.boundaryPadX,
    boundaryPadY: geo.boundaryPadY,
    boundaryGapX: geo.elementGapX,
    boundaryGapY: geo.elementGapY,
    relStroke: palette.borderStrong,
    relStrokeWidth: nodeStrokeWidth,
    relArrowSize: Math.round(typography.scale.base * 1.0),
    relLabelFontSize: typography.scale.sm,
    relLabelColor: palette.inkMuted,
    relTechFontSize: typography.scale.xs,
    relTechColor: palette.inkMuted,
    elementRx: shape.cornerRadius + 4,
    dbArcHeight: 12,
    lineHeight,
  };
}
