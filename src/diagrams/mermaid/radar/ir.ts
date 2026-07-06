import type { BaseIR } from '../../../contracts/index.js';

export interface RadarAxis {
  readonly id: string;
  readonly label: string;
}

export interface RadarCurve {
  readonly id: string;
  readonly label: string;
  readonly values: readonly number[];
}

export interface RadarDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly axes: readonly RadarAxis[];
  readonly curves: readonly RadarCurve[];
  readonly min?: number;
  readonly max?: number;
}
