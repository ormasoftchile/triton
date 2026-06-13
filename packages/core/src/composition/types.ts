/**
 * @file composition/types.ts — Composition Grammar Domain IR.
 *
 * A CompositionDocument arranges multiple grammar sub-diagrams (and simple
 * content elements) into a single multi-panel poster or infographic.
 *
 * Design: grammar = semantics / theme = style applies here too.
 *   - The IR says "cell A holds a flow diagram titled Pipeline."
 *   - The theme says "render that title in Inter 18 bold white, 1px border, 12px radius."
 *
 * Increment 1: inline grammar documents (ir field) only.
 * Increment 2: ir_file external references (resolved before layout; keeps layout pure).
 * Deferred: nested composition, image cells.
 */

import type { FlowDocument }     from '../grammars/flow/types.js';
import type { TreeDocument }     from '../grammars/tree/types.js';
import type { SequenceDocument } from '../grammars/sequence/types.js';
import type { IRDocument }       from '../types.js';

// ---------------------------------------------------------------------------
// CellContent — discriminated union
// ---------------------------------------------------------------------------

/** A cell whose content is a Flow grammar diagram (inline IR). */
export interface FlowCellContent {
  kind: 'flow';
  doc: FlowDocument;
}

/** A cell whose content is a Tree grammar diagram (inline IR). */
export interface TreeCellContent {
  kind: 'tree';
  doc: TreeDocument;
}

/** A cell whose content is a Sequence grammar diagram (inline IR). */
export interface SequenceCellContent {
  kind: 'sequence';
  doc: SequenceDocument;
}

/** A cell whose content is a Timeline grammar diagram (inline IR). */
export interface TimelineCellContent {
  kind: 'timeline';
  doc: IRDocument;
}

/**
 * A cell whose content is loaded from an external file at render time.
 * `grammar` names the expected grammar; `ir_file` is a relative path from
 * the base directory supplied to `resolveCompositionRefs`.
 * This variant is resolved to the corresponding inline variant before
 * the layout engine runs — the layout stays pure (no file I/O).
 */
export interface RefCellContent {
  kind: 'ref';
  /** Grammar the referenced file must conform to. */
  grammar: 'flow' | 'tree' | 'sequence' | 'timeline';
  /** Relative path to the grammar file (e.g. "./pipeline.flow.yaml"). */
  ir_file: string;
}

/** A cell showing a large numeric/text stat callout with an optional label. */
export interface StatCellContent {
  kind: 'stat';
  /** The stat value to display prominently (e.g. "98.7%", "10x"). */
  value: string;
  /** Optional descriptive label shown beneath the value. */
  label?: string;
}

/** A cell showing a plain text block. */
export interface TextCellContent {
  kind: 'text';
  text: string;
}

/** A cell showing a poster-style title heading. */
export interface TitleCellContent {
  kind: 'title';
  text: string;
}

/**
 * Discriminated union of all supported cell content types.
 * Increment 1 supports inline: flow, tree, sequence, stat, text, title.
 * Increment 2 adds: timeline (inline IRDocument), ref (external ir_file).
 */
export type CellContent =
  | FlowCellContent
  | TreeCellContent
  | SequenceCellContent
  | TimelineCellContent
  | RefCellContent
  | StatCellContent
  | TextCellContent
  | TitleCellContent;

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

/**
 * A positioned slot in the composition grid.
 *
 * Grid coordinates are 0-indexed.  If `row`/`col` are omitted they are
 * assigned in row-major (left-to-right, top-to-bottom) declaration order.
 */
export interface Cell {
  /** Document-unique identifier (kebab-case). */
  id: string;
  /** 0-indexed column position. Default: assigned row-major. */
  col?: number;
  /** 0-indexed row position. Default: assigned row-major. */
  row?: number;
  /** Number of columns this cell spans. Default: 1. */
  colSpan?: number;
  /** Number of rows this cell spans. Default: 1. */
  rowSpan?: number;
  /** Cell title displayed as panel chrome above the content. */
  title?: string;
  /** Cell content (sub-diagram or simple element). */
  content: CellContent;
}

// ---------------------------------------------------------------------------
// CompositionDocument
// ---------------------------------------------------------------------------

export interface CompositionMetadata {
  /** Poster title rendered at the top of the canvas. */
  title?: string;
  /** CompositionTheme name. Default: 'default'. */
  theme?: string;
}

export interface CompositionGrid {
  /** Number of columns. Must be >= 1. */
  columns: number;
  /** Number of rows. Default: ceil(cells.length / columns). */
  rows?: number;
}

/**
 * Root document for the Composition Grammar IR.
 *
 * A composition assembles one or more grammar sub-diagrams into a single
 * multi-panel poster.  Each cell is independently compiled and embedded
 * via translateAndScale so the merged Scene is byte-deterministic.
 */
export interface CompositionDocument {
  /** Spec version (semver, e.g. "1.0"). */
  version: string;
  metadata: CompositionMetadata;
  grid: CompositionGrid;
  cells: Cell[];
}
