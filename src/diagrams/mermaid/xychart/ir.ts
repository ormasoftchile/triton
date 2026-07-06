import type { BaseIR } from '../../../contracts/index.js';

export type XYSeriesKind = 'bar' | 'line';

export interface XYSeries {
  readonly kind: XYSeriesKind;
  readonly values: readonly number[];
}

export interface XYChartDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  /** Categorical x-axis labels (one per data point). */
  readonly categories: readonly string[];
  readonly yLabel?: string;
  /** Explicit y range; when absent the layout derives it from the data. */
  readonly yMin?: number;
  readonly yMax?: number;
  readonly series: readonly XYSeries[];
}
