import type { BaseIR } from '../../../contracts/index.js';

export interface PacketField {
  readonly start: number;
  readonly end: number;
  readonly label: string;
}

export interface PacketDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly fields: readonly PacketField[];
}
