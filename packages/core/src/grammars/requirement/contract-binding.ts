/**
 * @file grammars/requirement/contract-binding.ts — Tier-3 binding: ThemeContract → RequirementTheme.
 */

import type { Density, ThemeContract } from '../../theme-contract/types.js';
import type { RequirementTheme } from './theme.js';

interface RequirementDensityLayout {
  margin: number;
  nodePadX: number;
  nodePadY: number;
  nodeGapX: number;
  nodeGapY: number;
}

function densityLayout(density: Density): RequirementDensityLayout {
  switch (density) {
    case 'comfortable':
      return { margin: 48, nodePadX: 16, nodePadY: 12, nodeGapX: 80, nodeGapY: 56 };
    case 'compact':
      return { margin: 32, nodePadX: 12, nodePadY: 8, nodeGapX: 64, nodeGapY: 40 };
    default:
      return { margin: 32, nodePadX: 14, nodePadY: 10, nodeGapX: 72, nodeGapY: 48 };
  }
}

export function bindRequirementTheme(contract: ThemeContract): RequirementTheme {
  const { palette, typography, density, shape } = contract;
  const geo = densityLayout(density);
  const nodeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;
  const arrowSize = Math.round(typography.scale.base * 0.8);
  const lineHeight = Math.round(typography.scale.base * 1.6);

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    nodePadX: geo.nodePadX,
    nodePadY: geo.nodePadY,
    minNodeWidth: 190,
    titleFill: palette.muted,
    titleStroke: palette.accent,
    titleStrokeWidth: nodeStrokeWidth,
    titleRx: shape.cornerRadius,
    titleTextColor: palette.accentStrong,
    titleFontSize: typography.scale.md,
    titleFontWeight: typography.weights.bold,
    stereotypeFontSize: typography.scale.sm,
    stereotypeColor: palette.inkMuted,
    bodyFill: palette.surfaceRaised,
    bodyStroke: palette.border,
    bodyStrokeWidth: 1,
    attrFontSize: typography.scale.base,
    attrFontWeight: typography.weights.regular,
    attrTextColor: palette.ink,
    attrLabelColor: palette.inkMuted,
    compartmentDividerStroke: palette.border,
    compartmentDividerWidth: 1,
    lineHeight,
    edgeStroke: palette.borderStrong,
    edgeStrokeWidth: nodeStrokeWidth,
    arrowSize,
    pillFill: palette.surface,
    pillStroke: palette.borderStrong,
    pillStrokeWidth: 1,
    pillRx: shape.cornerRadius * 2,
    pillTextColor: palette.ink,
    pillFontSize: typography.scale.sm,
    pillPadX: 8,
    pillPadY: 3,
    nodeGapX: geo.nodeGapX,
    nodeGapY: geo.nodeGapY,
  };
}
