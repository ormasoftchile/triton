/**
 * @file grammars/class/contract-binding.ts — Tier-3 binding: ThemeContract → ClassTheme.
 */

import type { Density, SpacingSteps, ThemeContract } from '../../theme-contract/types.js';
import type { ClassTheme } from './theme.js';

interface ClassDensityLayout {
  margin: number;
  classPadX: number;
  classPadY: number;
  classGapX: number;
  classGapY: number;
}

function densityLayout(density: Density, s: SpacingSteps): ClassDensityLayout {
  switch (density) {
    case 'comfortable':
      return {
        margin: s.xxl,
        classPadX: s.md + 2,
        classPadY: s.sm + 4,
        classGapX: 96,
        classGapY: s.xxl,
      };
    case 'compact':
      return {
        margin: s.xl,
        classPadX: s.sm + 4,
        classPadY: s.xs + 2,
        classGapX: 64,
        classGapY: s.lg + s.xs,
      };
    default:
      return {
        margin: s.xl,
        classPadX: s.md - 2,
        classPadY: s.sm,
        classGapX: 80,
        classGapY: s.xl,
      };
  }
}

export function bindClassTheme(contract: ThemeContract): ClassTheme {
  const { palette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;
  const geo = densityLayout(density, s);
  const nodeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;
  const arrowSize = Math.round(typography.scale.base * 1.0);
  const lineHeight = Math.round(typography.scale.base * 1.6);

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    classPadX: geo.classPadX,
    classPadY: geo.classPadY,
    minClassWidth: 180,
    compartmentDividerStroke: palette.border,
    compartmentDividerWidth: 1,
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
    memberFontSize: typography.scale.base,
    memberFontWeight: typography.weights.medium,
    memberTextColor: palette.ink,
    edgeStroke: palette.borderStrong,
    edgeStrokeWidth: nodeStrokeWidth,
    edgeDash: '6,4',
    arrowSize,
    classGapX: geo.classGapX,
    classGapY: geo.classGapY,
    lineHeight,
    edgeLabelFontSize: typography.scale.sm,
    edgeLabelColor: palette.inkMuted,
    cardinalityFontSize: typography.scale.sm,
    cardinalityColor: palette.inkMuted,
  };
}
