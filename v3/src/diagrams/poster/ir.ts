import type { BaseIR } from '../../contracts/index.js';
import type { FlowDocument } from '../flowchart/ir.js';
import type { TimelineDocument } from '../timeline/ir.js';

// ─── Cell Content ─────────────────────────────────────────────────────────────

export interface FlowCell     { readonly kind: 'flow';     readonly doc: FlowDocument }
export interface TimelineCell { readonly kind: 'timeline'; readonly doc: TimelineDocument }
export interface TextCell     { readonly kind: 'text';     readonly text: string }
export interface StatCell     { readonly kind: 'stat';     readonly value: string; readonly label?: string }

export type CellContent = FlowCell | TimelineCell | TextCell | StatCell;

// ─── Grid ─────────────────────────────────────────────────────────────────────

export interface PosterCell {
  readonly id: string;
  readonly title?: string;
  readonly row?: number;
  readonly col?: number;
  readonly rowSpan?: number;
  readonly colSpan?: number;
  readonly content: CellContent;
}

export interface PosterGrid {
  readonly columns: number;
  readonly rows?: number;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface PosterDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly grid: PosterGrid;
  readonly cells: readonly PosterCell[];
}
