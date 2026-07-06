import type { BaseIR } from '../../../contracts/index.js';

export type StateKind = 'normal' | 'start' | 'end' | 'choice';

export interface StateNode {
  readonly id: string;
  readonly label: string;
  readonly kind: StateKind;
}

export interface StateTransition {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface StateComposite {
  readonly id: string;
  readonly label: string;
  readonly nodeIds: readonly string[];
}

export interface StateDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly states: readonly StateNode[];
  readonly transitions: readonly StateTransition[];
  readonly composites?: readonly StateComposite[];
}
