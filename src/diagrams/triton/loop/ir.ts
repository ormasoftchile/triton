import type { BaseIR } from '../../../contracts/index.js';

export interface LoopStep {
  readonly label: string;
  readonly desc?: string;
  readonly isFocal?: boolean;
}

export interface LoopDocument extends BaseIR {
  readonly hub?: string;
  readonly steps: readonly LoopStep[];
}
