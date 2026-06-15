import type { ThemeContract } from '../../theme-contract/types.js';
import type { RadialThemeOpts, BranchColors } from './layoutRadial.js';

function tintColor(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tr = Math.round(r + (255 - r) * t);
  const tg = Math.round(g + (255 - g) * t);
  const tb = Math.round(b + (255 - b) * t);
  return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tr = Math.round(r * (1 - t));
  const tg = Math.round(g * (1 - t));
  const tb = Math.round(b * (1 - t));
  return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

function branchColorsFromHex(hex: string): BranchColors {
  return {
    fill: tintColor(hex, 0.82),
    edge: hex,
    stroke: hex,
    text: darkenColor(hex, 0.35),
  };
}

export function bindMindmapTheme(contract: ThemeContract): RadialThemeOpts {
  const { palette, dataPalette, typography } = contract;

  const branchPalette: BranchColors[] = dataPalette.categorical.map((color) =>
    branchColorsFromHex(color),
  );

  return {
    background: palette.surface,
    fontFamily: `${typography.family}, ${typography.fallback}`,
    rootFill: palette.accent,
    rootTextColor: palette.inkInverse,
    branchPalette,
  };
}
