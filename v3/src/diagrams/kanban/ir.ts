import type { BaseIR } from '../../contracts/index.js';

export interface KanbanCard {
  readonly id?: string;
  readonly text: string;
}

export interface KanbanColumn {
  readonly label: string;
  readonly cards: readonly KanbanCard[];
}

export interface KanbanDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly columns: readonly KanbanColumn[];
}
