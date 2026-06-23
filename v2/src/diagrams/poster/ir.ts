/**
 * PosterDocument — Canonical IR for composition/poster diagrams.
 *
 * A poster arranges multiple child diagrams in a grid.
 * Children are diagram IRs (flowchart, timeline, etc.) that get
 * independently laid out, then embedded into cells.
 */

import type { RawOverlay } from '../../scene/compile-overlays.js';
import type { FlowDocument } from '../flowchart/ir.js';
import type { TimelineDocument } from '../timeline/ir.js';

// ─── Cell Content — Discriminated Union ────────────────────────────────────────

export interface FlowCell {
  kind: 'flow';
  doc: FlowDocument;
}

export interface TimelineCell {
  kind: 'timeline';
  doc: TimelineDocument;
}

export interface TextCell {
  kind: 'text';
  text: string;
}

export interface StatCell {
  kind: 'stat';
  value: string;
  label?: string;
}

export type CellContent = FlowCell | TimelineCell | TextCell | StatCell;

// ─── Grid & Cells ──────────────────────────────────────────────────────────────

export interface PosterCell {
  id: string;
  title?: string;
  row?: number;        // 0-indexed; auto-assigned if omitted
  col?: number;        // 0-indexed; auto-assigned if omitted
  rowSpan?: number;    // default: 1
  colSpan?: number;    // default: 1
  content: CellContent;
}

export interface PosterGrid {
  columns: number;
  rows?: number;       // auto-computed from cells if omitted
}

// ─── Document ──────────────────────────────────────────────────────────────────

export interface PosterDocument {
  version: string;
  metadata: {
    title?: string;
    theme?: string;
    [key: string]: string | undefined;
  };
  grid: PosterGrid;
  cells: PosterCell[];
  overlays?: RawOverlay[];
}
