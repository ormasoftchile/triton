import type { BaseIR } from '../../../contracts/index.js';

export interface PyramidTier {
  readonly label: string;
  readonly value?: string | number;
  readonly sublabel?: string;
  readonly isFocal?: boolean;
}

export interface PyramidDocument extends BaseIR {
  readonly direction: 'pyramid' | 'funnel';
  readonly tiers: readonly PyramidTier[];
}
