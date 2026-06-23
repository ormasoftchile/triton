import type { BaseIR } from '../../contracts/index.js';

export interface SankeyLink {
  readonly source: string;
  readonly target: string;
  readonly value: number;
}

export interface SankeyDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly links: readonly SankeyLink[];
}
