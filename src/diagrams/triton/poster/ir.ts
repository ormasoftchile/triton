import type { BaseIR, CrossLink, DiagramKind } from '../../../contracts/index.js';

// ─── Cell Content ─────────────────────────────────────────────────────────────

/** A cell whose content is any registered diagram type. */
export interface DiagramCell  { readonly kind: 'diagram'; readonly diagramKind: DiagramKind; readonly doc: BaseIR }
export interface TextCell     { readonly kind: 'text';     readonly text: string }
export interface StatCell     { readonly kind: 'stat';     readonly value: string; readonly label?: string }

export type CellContent = DiagramCell | TextCell | StatCell;

// ─── Grid ─────────────────────────────────────────────────────────────────────

export interface PosterCell {
  readonly id: string;
  readonly title?: string;
  readonly row?: number;
  readonly col?: number;
  readonly rowSpan?: number;
  readonly colSpan?: number;
  /** Optional per-cell theme name; falls back to the poster theme when absent. */
  readonly theme?: string;
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
  /** Cross-diagram links declared at this poster level. */
  readonly links?: readonly CrossLink[];
}
