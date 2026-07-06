import type { BaseIR } from '../../../contracts/index.js';

export interface BlockNode {
  readonly id: string;
  readonly label: string;
  readonly span: number;
}

export interface BlockEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface BlockDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly columns: number;
  readonly blocks: readonly BlockNode[];
  readonly edges: readonly BlockEdge[];
}
