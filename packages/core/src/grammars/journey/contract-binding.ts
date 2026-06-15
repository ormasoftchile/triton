import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { JourneyTheme } from './theme.js';

function lerpHex(from: string, to: string, t: number): string {
  const r = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16);
  const m = (a: number, b: number) => Math.round(a + (b - a) * t);
  const p = (n: number) => n.toString(16).padStart(2, '0');
  return `#${p(m(r(from, 1), r(to, 1)))}${p(m(r(from, 3), r(to, 3)))}${p(m(r(from, 5), r(to, 5)))}`;
}

function journeyDensityGeo(density: Density, md: number, lg: number, xl: number) {
  switch (density) {
    case 'compact':
      return { margin: md, taskGapX: 96, sectionGapX: 16, spineY: 120 };
    case 'comfortable':
      return { margin: xl, taskGapX: 140, sectionGapX: 28, spineY: 168 };
    default:
      return { margin: lg, taskGapX: 120, sectionGapX: 24, spineY: 152 };
  }
}

export function bindJourneyTheme(contract: ThemeContract): JourneyTheme {
  const { palette, dataPalette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;
  const geo = journeyDensityGeo(density, s.md, s.lg, s.xl);
  const div = dataPalette.diverging;

  const scoreFills = [
    div.negative,
    lerpHex(div.negative, div.zero, 0.5),
    lerpHex(div.zero, palette.muted, 0.5),
    lerpHex(div.zero, div.positive, 0.5),
    div.positive,
  ];
  const scoreStrokes = scoreFills.map((fill) => lerpHex(fill, '#000000', 0.25));

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin,
    marginBottom: geo.margin,
    spineY: geo.spineY,
    spineStroke: palette.borderStrong,
    spineStrokeWidth: Math.round(2 * shape.strokeScale * 10) / 10,
    sectionLabelFontSize: typography.scale.base,
    sectionLabelFontWeight: typography.weights.bold,
    sectionLabelColor: palette.ink,
    sectionBandFill: palette.muted,
    sectionBandFill2: palette.surfacePanel,
    taskRadius: s.lg - 4,
    taskStrokeWidth: Math.round(2 * shape.strokeScale * 10) / 10,
    taskLabelFontSize: typography.scale.sm,
    taskLabelFontWeight: typography.weights.semibold,
    taskLabelColor: palette.ink,
    scoreFills,
    scoreStrokes,
    actorFontSize: typography.scale.xs + 2,
    actorColor: palette.inkMuted,
    actorChipFill: palette.surfacePanel,
    actorChipRadius: shape.cornerRadius + 6,
    taskGapX: geo.taskGapX,
    sectionGapX: geo.sectionGapX,
    taskLabelOffsetY: s.xl + 10,
    actorOffsetY: s.md + 10,
    scoreBarHeight: s.xs + 2,
    minDrop: s.md,
    maxDrop: geo.spineY - s.md,
    droplineStroke: palette.border,
    droplineDash: '4,4',
    curveStroke: palette.borderStrong,
    curveStrokeWidth: Math.round(1.5 * shape.strokeScale * 10) / 10,
    taskBoxFill: palette.surface,
    taskBoxStroke: palette.border,
    taskBoxStrokeWidth: Math.round(shape.strokeScale * 10) / 10,
    taskBoxRadius: shape.cornerRadius,
    actorPalette: dataPalette.categorical,
    actorDotRadius: s.xs + 1,
  };
}
