import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { PacketTheme } from './theme.js';

function tintColor(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tr = Math.round(r + (255 - r) * t);
  const tg = Math.round(g + (255 - g) * t);
  const tb = Math.round(b + (255 - b) * t);
  return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

function packetDensityGeo(density: Density, md: number, lg: number, xl: number) {
  switch (density) {
    case 'compact':
      return { margin: md, rowHeight: 32, bitLabelHeight: 16, rowGap: 2 };
    case 'comfortable':
      return { margin: xl, rowHeight: 48, bitLabelHeight: 24, rowGap: 6 };
    default:
      return { margin: lg, rowHeight: 40, bitLabelHeight: 20, rowGap: 4 };
  }
}

export function bindPacketTheme(contract: ThemeContract): PacketTheme {
  const { palette, dataPalette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;
  const geo = packetDensityGeo(density, s.md, s.lg, s.xl);

  const primary = dataPalette.categorical[0] ?? palette.accent;
  const secondary = dataPalette.categorical[1] ?? dataPalette.sequential.mid;

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    marginLeft: geo.margin,
    marginRight: geo.margin,
    marginTop: geo.margin - 4,
    marginBottom: geo.margin - 4,
    totalWidth: 920,
    bitsPerRow: 32,
    rowHeight: geo.rowHeight,
    bitLabelHeight: geo.bitLabelHeight,
    rowGap: geo.rowGap,
    fieldFill: tintColor(primary, 0.80),
    altFieldFill: tintColor(secondary, 0.80),
    fieldStroke: palette.border,
    fieldStrokeWidth: Math.round(shape.strokeScale * 10) / 10,
    fieldFontSize: typography.scale.sm + 2,
    fieldFontWeight: typography.weights.semibold,
    fieldTextColor: palette.ink,
    bitLabelFontSize: typography.scale.xs + 1,
    bitLabelColor: palette.inkMuted,
    titleFontSize: typography.scale.md,
    titleFontWeight: typography.weights.bold,
    titleColor: palette.ink,
  };
}
