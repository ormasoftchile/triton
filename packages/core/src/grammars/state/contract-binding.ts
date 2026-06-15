/**
 * @file grammars/state/contract-binding.ts — Tier-3 binding: ThemeContract → StateTheme.
 */

import type { ThemeContract } from '../../theme-contract/types.js';
import type { StateTheme } from './theme.js';

export function bindStateTheme(contract: ThemeContract): StateTheme {
  const { palette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;
  const nodeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;
  const arrowSize = Math.round(typography.scale.base * 1.0);
  const lineHeight = Math.round(typography.scale.base * 1.6);

  const [margin, statePadX, statePadY, stateGapX, stateGapY, compositeBodyPadX, compositeBodyPadY] =
    density === 'compact'
      ? [s.xl, s.sm + 4, s.xs + 2, s.lg, s.lg, s.md, s.sm]
      : density === 'comfortable'
        ? [s.xxl, s.md, s.sm + 4, s.lg + s.md, s.md + s.md, s.lg - 2, s.md - 2]
        : [s.xl, s.sm + 6, s.sm, s.lg + s.xs, s.md + s.sm, s.md + 4, s.sm + 4];

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: margin,
    marginRight: margin,
    marginTop: margin,
    marginBottom: margin,
    statePadX,
    statePadY,
    minStateWidth: 160,
    stateFill: palette.surfaceRaised,
    stateStroke: palette.border,
    stateStrokeWidth: nodeStrokeWidth,
    stateRx: shape.cornerRadius,
    stateTextColor: palette.ink,
    stateFontSize: typography.scale.md,
    stateFontWeight: typography.weights.semibold,
    descFontSize: typography.scale.sm,
    descTextColor: palette.inkMuted,
    pseudoRadius: s.sm + 2,
    pseudoFill: palette.ink,
    pseudoStroke: palette.ink,
    pseudoStrokeWidth: nodeStrokeWidth,
    forkBarWidth: 60,
    forkBarHeight: s.sm + 2,
    forkBarFill: palette.ink,
    choiceSize: s.md,
    choiceFill: palette.muted,
    choiceStroke: palette.borderStrong,
    edgeStroke: palette.borderStrong,
    edgeStrokeWidth: nodeStrokeWidth,
    edgeDash: '6,4',
    arrowSize,
    stateGapX,
    stateGapY,
    lineHeight,
    edgeLabelFontSize: typography.scale.sm,
    edgeLabelColor: palette.inkMuted,
    compositeHeaderHeight: s.lg + s.xs,
    compositeFill: palette.surfaceRaised,
    compositeStroke: palette.accent,
    compositeStrokeWidth: nodeStrokeWidth,
    compositeRx: shape.cornerRadius + 2,
    compositeTitleColor: palette.accentStrong,
    compositeTitleFontSize: typography.scale.md,
    compositeBodyPadX,
    compositeBodyPadY,
  };
}
