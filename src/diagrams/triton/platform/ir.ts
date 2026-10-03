import type { BaseIR } from '../../../contracts/index.js';

export interface PlatformCard {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: string;
  readonly span?: number;
}

export interface PlatformGrid {
  readonly columns: number;
  readonly cards: readonly PlatformCard[];
}

export interface PlatformBranch {
  readonly title?: string;
  readonly cards: readonly PlatformCard[];
}

export interface PlatformBox {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: string;
  readonly grid?: PlatformGrid;
  readonly cards?: readonly PlatformCard[];
  readonly branch?: PlatformBranch;
  readonly dock?: 'top' | 'bottom';
}

export interface PlatformTier {
  readonly id: string;
  readonly title: string;
  readonly items: readonly (PlatformCard | PlatformBox)[];
}

export interface PlatformLegendItem {
  readonly key: string;
  readonly label: string;
  readonly shape: 'square' | 'circle' | 'diamond';
  readonly color: string;
}

export interface PlatformBus {
  readonly from: string;
  readonly to: readonly string[];
  readonly label?: string;
  readonly animation?: 'stream' | 'particle' | 'march' | 'flow' | 'none';
  readonly tokenShape?: 'square' | 'circle' | 'diamond';
  readonly tokenColor?: string;
}

export interface PlatformDocument extends BaseIR {
  readonly figure?: string;
  readonly title?: string;
  readonly desc?: string;
  readonly legend?: readonly PlatformLegendItem[];
  readonly tiers: readonly PlatformTier[];
  readonly buses: readonly PlatformBus[];
}
