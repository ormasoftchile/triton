import type { BaseIR } from '../../../contracts/index.js';

export interface FishboneCause {
  readonly label: string;
  readonly subcauses?: readonly string[];
}

export interface FishboneCategory {
  readonly name: string;
  readonly causes: readonly FishboneCause[];
}

export interface FishboneDocument extends BaseIR {
  readonly effect: string;
  readonly categories: readonly FishboneCategory[];
}
