import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { GitGraphTheme } from './theme.js';

function gitDensityGeo(density: Density, md: number, lg: number, xl: number) {
  switch (density) {
    case 'compact':
      return { margin: md, laneSize: 72, commitGapX: 72 };
    case 'comfortable':
      return { margin: xl, laneSize: 100, commitGapX: 100 };
    default:
      return { margin: lg, laneSize: 88, commitGapX: 92 };
  }
}

export function bindGitGraphTheme(contract: ThemeContract): GitGraphTheme {
  const { palette, dataPalette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;
  const geo = gitDensityGeo(density, s.md, s.lg, s.xl);

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    branchColors: dataPalette.categorical,
    branchStrokeWidth: Math.round(3 * shape.strokeScale * 10) / 10,
    branchLaneSize: geo.laneSize,
    branchLabelFontSize: typography.scale.sm + 2,
    branchLabelFontWeight: typography.weights.bold,
    branchLabelColor: palette.ink,
    branchLabelWidth: Math.round(geo.laneSize * 1.55),
    commitRadius: Math.round(8 * shape.strokeScale),
    commitStrokeWidth: Math.round(2 * shape.strokeScale * 10) / 10,
    commitLabelFontSize: typography.scale.xs + 2,
    commitLabelColor: palette.inkMuted,
    commitLabelOffsetY: s.lg,
    tagFill: palette.surfacePanel,
    tagStroke: palette.borderStrong,
    tagFontSize: typography.scale.xs,
    tagFontWeight: typography.weights.bold,
    tagColor: palette.ink,
    tagPadX: s.xs + 4,
    tagPadY: s.xxs + 2,
    tagOffsetY: s.lg - 2,
    highlightFill: palette.statusActive.fill,
    reverseFill: palette.muted,
    mergeEdgeStrokeWidth: Math.round(2 * shape.strokeScale * 10) / 10,
    commitGapX: geo.commitGapX,
  };
}
