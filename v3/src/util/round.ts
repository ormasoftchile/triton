/**
 * @file util/round.ts — Deterministic round-half-up helpers.
 *
 * Layout coordinates round half up (toward +∞) so output is locale- and
 * platform-stable. Shared by every layout engine; never use Math.round (which
 * rounds half to even in some runtimes) for scene geometry.
 */

/** Round half up to the nearest integer. */
export function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

/** Round half up to `decimals` places (default 2) — for sub-pixel path data. */
export function rhu(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.floor(v * f + 0.5) / f;
}
