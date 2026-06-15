import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { SankeyTheme } from './theme.js';

function sankeyDensityGeo(density: Density, sm: number, md: number, lg: number, xl: number) {
  switch (density) {
    case 'compact':
      return { marginTop: sm, marginBottom: sm, marginLeft: md, marginRight: sm, contentHeight: 400, columnGapX: 150 };
    case 'comfortable':
      return { marginTop: xl, marginBottom: md, marginLeft: lg, marginRight: lg, contentHeight: 520, columnGapX: 200 };
    default:
      return { marginTop: md, marginBottom: md, marginLeft: lg, marginRight: md, contentHeight: 480, columnGapX: 180 };
  }
}

export function bindSankeyTheme(contract: ThemeContract): SankeyTheme {
  const { palette, dataPalette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;
  const geo = sankeyDensityGeo(density, s.sm, s.md, s.lg, s.xl);

  const nodePalette = [
    ...dataPalette.categorical,
    dataPalette.sequential.mid,
    dataPalette.sequential.high,
    dataPalette.diverging.positive,
    dataPalette.diverging.negative,
  ];

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.marginLeft,
    marginRight: geo.marginRight,
    marginTop: geo.marginTop,
    marginBottom: geo.marginBottom,
    nodeBarWidth: Math.round(shape.strokeScale * 18),
    nodeBarMinHeight: 4,
    nodeGapY: s.sm + 4,
    labelFontSize: typography.scale.sm + 2,
    labelFontWeight: typography.weights.semibold,
    labelColor: palette.ink,
    labelGap: s.xs + 4,
    contentHeight: geo.contentHeight,
    columnGapX: geo.columnGapX,
    ribbonOpacity: 0.45,
    ribbonStrokeWidth: Math.round(shape.strokeScale * 0.5 * 10) / 10,
    showNodeValues: true,
    nodePalette,
  };
}
