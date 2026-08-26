/**
 * @file palette/categorical.ts — Shared categorical hue cycle.
 *
 * A fixed, deterministic sequence of visually-separable hues for diagrams that
 * colour items by index rather than by semantic status (narrative spines,
 * section bands, pie/chart slices). Index wraps with modulo so any count works.
 *
 * This is intentionally NOT a theme token: it is decorative, diagram-driven
 * colour, independent of the active theme's semantic palette.
 */

import type { ResolvedTheme } from '../contracts/theme.js';

/** Eight distinct hues, ordered for maximum adjacent contrast. */
export const CATEGORICAL_HUES: readonly string[] = [
  '#7C3AED',
  '#0EA5A8',
  '#D97706',
  '#5B4FCF',
  '#DB2777',
  '#2563EB',
  '#16A34A',
  '#CA8A04',
];

/** Monochromatic greyscale hues for light ink-on-paper / minimal presets. */
export const MONOCHROME_LIGHT_HUES: readonly string[] = [
  '#525252',
  '#737373',
  '#404040',
  '#8A8A8A',
  '#262626',
  '#5E5E5E',
];

/** Monochromatic greyscale hues for dark minimal / bw-dark presets. */
export const MONOCHROME_DARK_HUES: readonly string[] = [
  '#D4D4D4',
  '#A3A3A3',
  '#E5E5E5',
  '#8B8B8B',
  '#FAFAFA',
  '#B8B8B8',
];

/** Hue at `index`, wrapping the cycle. Respects monochromatic theme presets when passed. */
export function categoricalHue(index: number, theme?: ResolvedTheme): string {
  if (theme) {
    if (theme.name === 'bw-dark') {
      const n = MONOCHROME_DARK_HUES.length;
      return MONOCHROME_DARK_HUES[((index % n) + n) % n]!;
    }
    if (theme.name === 'bw-light' || theme.name === 'minimal') {
      const n = MONOCHROME_LIGHT_HUES.length;
      return MONOCHROME_LIGHT_HUES[((index % n) + n) % n]!;
    }
  }
  const n = CATEGORICAL_HUES.length;
  return CATEGORICAL_HUES[((index % n) + n) % n]!;
}
