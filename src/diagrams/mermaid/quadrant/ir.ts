import type { BaseIR } from '../../../contracts/index.js';

export interface QuadrantPoint {
  readonly label: string;
  /** Normalized 0..1 along the x-axis. */
  readonly x: number;
  /** Normalized 0..1 along the y-axis. */
  readonly y: number;
}

export interface QuadrantDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly xAxisLeft?: string;
  readonly xAxisRight?: string;
  readonly yAxisBottom?: string;
  readonly yAxisTop?: string;
  /** Quadrant labels: index 0..3 → quadrant-1..quadrant-4. */
  readonly quadrants: readonly (string | undefined)[];
  readonly points: readonly QuadrantPoint[];
}
