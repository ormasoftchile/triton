/**
 * @file grammars/kanban/types.ts — Kanban Board Domain IR.
 *
 * Semantic-only IR for Mermaid `kanban` syntax. Visual decisions deferred
 * to KanbanTheme and the layout engine.
 *
 * Mermaid kanban syntax: top-level indented items are COLUMNS, their
 * indented children are CARDS. Cards may carry optional metadata blocks.
 */

export interface KanbanCardMetadata {
  /** Card assignee. */
  assigned?: string;
  /** Priority: 'high' | 'medium' | 'low' or any string. */
  priority?: string;
  /** Ticket reference. */
  ticket?: string;
  /** Any other keys parsed from @{ ... } metadata. */
  [key: string]: string | undefined;
}

export interface KanbanCard {
  /** Card identifier (e.g. "t1" in `t1[Design API]`). */
  id: string;
  /** Display label for the card. */
  label: string;
  /** Optional metadata. */
  metadata?: KanbanCardMetadata;
}

export interface KanbanColumn {
  /** Column id (raw token before optional [label] syntax). */
  id: string;
  /** Display label for the column header. */
  label: string;
  /** Cards in declaration order. */
  cards: KanbanCard[];
}

export interface KanbanMetadata {
  title?: string;
  theme?: string;
}

export interface KanbanDocument {
  version: string;
  metadata: KanbanMetadata;
  /** Columns in declaration order (left to right). */
  columns: KanbanColumn[];
}
