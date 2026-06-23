import type { BaseIR } from '../../contracts/index.js';

export interface SeqParticipant {
  readonly id: string;
  readonly label: string;
  readonly isActor: boolean;
}

export type SeqHead = 'arrow' | 'open' | 'cross' | 'async';

export interface SeqMessage {
  readonly kind: 'message';
  readonly from: string;
  readonly to: string;
  readonly text: string;
  readonly line: 'solid' | 'dashed';
  readonly head: SeqHead;
  readonly activateTarget?: boolean;
  readonly deactivateSource?: boolean;
}

export interface SeqNote {
  readonly kind: 'note';
  readonly placement: 'over' | 'left' | 'right';
  readonly participants: readonly string[];
  readonly text: string;
}

export interface SeqFragmentStart {
  readonly kind: 'frag-start';
  readonly type: string;       // alt | opt | loop | par | critical | break
  readonly label: string;
}
export interface SeqFragmentElse { readonly kind: 'frag-else'; readonly label: string }
export interface SeqFragmentEnd  { readonly kind: 'frag-end' }

export type SeqEvent = SeqMessage | SeqNote | SeqFragmentStart | SeqFragmentElse | SeqFragmentEnd;

export interface SequenceDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly participants: readonly SeqParticipant[];
  readonly events: readonly SeqEvent[];
  readonly autonumber: boolean;
}
