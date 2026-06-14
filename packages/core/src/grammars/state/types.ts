/**
 * @file grammars/state/types.ts — State Grammar Domain IR.
 */

export type PseudostateKind = 'start' | 'end' | 'fork' | 'join' | 'choice';

export interface StateNode {
  id: string;
  /** Legacy single text field kept for compatibility with Mermaid-derived inputs. */
  label?: string;
  /** Optional explicit display label used by `state "Label" as Foo`. */
  displayLabel?: string;
  /** Optional description/secondary text used by `Foo : description`. */
  description?: string;
  isPseudo?: PseudostateKind;
  children?: StateNode[];
  note?: string;
  notePosition?: 'left' | 'right';
}

export interface StateTransition {
  from: string;
  to: string;
  label?: string;
}

export interface StateMetadata {
  title?: string;
  theme?: string;
}

export interface StateDocument {
  version: string;
  metadata: StateMetadata;
  states: StateNode[];
  transitions: StateTransition[];
}
