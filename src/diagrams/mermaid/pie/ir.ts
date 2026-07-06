import type { BaseIR } from '../../../contracts/index.js';

export interface PieSlice {
  readonly label: string;
  readonly value: number;
}

export interface PieDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly slices: readonly PieSlice[];
  /** When true, legend entries include raw values (Mermaid `pie showData`). */
  readonly showData?: boolean;
}
