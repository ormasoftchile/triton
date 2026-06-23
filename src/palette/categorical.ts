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

/** Eight distinct hues, ordered for maximum adjacent contrast. */
export const CATEGORICAL_HUES: readonly string[] = [
  '#7C3AED', '#0EA5A8', '#D97706', '#5B4FCF',
  '#DB2777', '#2563EB', '#16A34A', '#CA8A04',
];

/** Hue at `index`, wrapping the cycle. */
export function categoricalHue(index: number): string {
  const n = CATEGORICAL_HUES.length;
  return CATEGORICAL_HUES[((index % n) + n) % n]!;
}
