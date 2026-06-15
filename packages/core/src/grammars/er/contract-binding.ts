/**
 * @file grammars/er/contract-binding.ts — Tier-3 binding: ThemeContract → ErTheme.
 */

import type { Density, ThemeContract } from '../../theme-contract/types.js';
import type { ErTheme } from './theme.js';

interface ErDensityLayout {
  margin: number;
  entityPadX: number;
  entityPadY: number;
  entityGapX: number;
  entityGapY: number;
}

function densityLayout(density: Density): ErDensityLayout {
  switch (density) {
    case 'comfortable':
      return { margin: 48, entityPadX: 16, entityPadY: 12, entityGapX: 120, entityGapY: 56 };
    case 'compact':
      return { margin: 32, entityPadX: 12, entityPadY: 8, entityGapX: 88, entityGapY: 40 };
    default:
      return { margin: 32, entityPadX: 14, entityPadY: 10, entityGapX: 104, entityGapY: 48 };
  }
}

export function bindErTheme(contract: ThemeContract): ErTheme {
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
    entityPadX: geo.entityPadX,
    entityPadY: geo.entityPadY,
    minEntityWidth: 220,
    titleFill: palette.muted,
    titleStroke: palette.accent,
    titleStrokeWidth: nodeStrokeWidth,
    titleRx: shape.cornerRadius,
    titleTextColor: palette.accentStrong,
    titleFontSize: typography.scale.md,
    titleFontWeight: typography.weights.bold,
    bodyFill: palette.surfaceRaised,
    bodyStroke: palette.border,
    bodyStrokeWidth: 1,
    attrTypeFontSize: typography.scale.sm,
    attrTypeColor: palette.inkMuted,
    attrNameFontSize: typography.scale.base,
    attrNameColor: palette.ink,
    attrKeyFontSize: typography.scale.sm,
    attrKeyColor: palette.accent,
    compartmentDividerStroke: palette.border,
    compartmentDividerWidth: 1,
    edgeStroke: palette.borderStrong,
    edgeStrokeWidth: nodeStrokeWidth,
    edgeDash: '6,4',
    crowFootSize: 12,
    entityGapX: geo.entityGapX,
    entityGapY: geo.entityGapY,
    lineHeight,
    edgeLabelFontSize: typography.scale.sm,
    edgeLabelColor: palette.inkMuted,
  };
}
