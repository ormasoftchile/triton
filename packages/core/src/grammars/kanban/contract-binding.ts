import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { KanbanTheme } from './theme.js';

function kanbanDensityGeo(density: Density, md: number, lg: number, xl: number) {
  switch (density) {
    case 'compact':
      return { margin: md, colWidth: 160, colGap: 14, headerHeight: 32, cardPadX: 8, cardPadY: 6, cardGap: 6 };
    case 'comfortable':
      return { margin: xl, colWidth: 200, colGap: 24, headerHeight: 48, cardPadX: 14, cardPadY: 10, cardGap: 10 };
    default:
      return { margin: lg, colWidth: 180, colGap: 20, headerHeight: 40, cardPadX: 10, cardPadY: 8, cardGap: 8 };
  }
}

export function bindKanbanTheme(contract: ThemeContract): KanbanTheme {
  const { palette, dataPalette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;
  const geo = kanbanDensityGeo(density, s.md, s.lg, s.xl);

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    columnWidth: geo.colWidth,
    columnGap: geo.colGap,
    headerHeight: geo.headerHeight,
    headerFontSize: typography.scale.base,
    headerFontWeight: typography.weights.bold,
    headerTextColor: palette.inkInverse,
    headerRx: shape.cornerRadius + 4,
    headerColors: dataPalette.categorical,
    cardPadX: geo.cardPadX,
    cardPadY: geo.cardPadY,
    cardGap: geo.cardGap,
    cardRx: shape.cornerRadius,
    cardFill: palette.surface,
    cardStroke: palette.border,
    cardStrokeWidth: Math.round(shape.strokeScale * 10) / 10,
    cardFontSize: typography.scale.sm,
    cardFontWeight: typography.weights.regular,
    cardTextColor: palette.ink,
    cardMaxWidth: geo.colWidth - geo.cardPadX * 2,
    priorityHighColor: palette.statusError.fill,
    priorityMedColor: palette.statusWarning.fill,
    priorityLowColor: palette.statusSuccess.fill,
    columnFill: palette.surfacePanel,
    columnStroke: palette.border,
    columnStrokeWidth: Math.round(shape.strokeScale * 10) / 10,
    columnRx: shape.cornerRadius + 4,
    columnBottomPad: s.sm + 4,
  };
}
