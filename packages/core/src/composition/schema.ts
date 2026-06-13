/**
 * @file composition/schema.ts — Zod schema for CompositionDocument.
 *
 * Validates:
 *  - version is present.
 *  - grid.columns >= 1.
 *  - All cell ids are unique.
 *  - Cell placements (col + colSpan) fit within grid.columns.
 *  - Cell placements (row + rowSpan) fit within grid.rows when grid.rows is
 *    declared.
 *  - Grammar sub-documents validate via their own schemas (delegated).
 *  - No two cells occupy the same grid slot.
 */

import { z } from 'zod';

import { flowDocumentSchema }     from '../grammars/flow/schema.js';
import { treeDocumentSchema }     from '../grammars/tree/schema.js';
import { sequenceDocumentSchema } from '../grammars/sequence/schema.js';
import { irDocumentSchema }       from '../schema.js';

// ---------------------------------------------------------------------------
// CellContent schemas
// ---------------------------------------------------------------------------

const flowCellContentSchema = z.object({
  kind: z.literal('flow'),
  doc: flowDocumentSchema,
});

const treeCellContentSchema = z.object({
  kind: z.literal('tree'),
  doc: treeDocumentSchema,
});

const sequenceCellContentSchema = z.object({
  kind: z.literal('sequence'),
  doc: sequenceDocumentSchema,
});

const timelineCellContentSchema = z.object({
  kind: z.literal('timeline'),
  doc: irDocumentSchema,
});

/**
 * External file reference — resolved by resolveCompositionRefs before layout.
 * The layout engine never sees this variant; after resolution it is replaced
 * with the corresponding inline variant (flow / tree / sequence / timeline).
 */
const refCellContentSchema = z.object({
  kind: z.literal('ref'),
  grammar: z.enum(['flow', 'tree', 'sequence', 'timeline'], {
    errorMap: () => ({
      message: "ref.grammar must be one of: 'flow', 'tree', 'sequence', 'timeline'",
    }),
  }),
  ir_file: z.string().min(1, 'ref.ir_file must be a non-empty relative path'),
});

const statCellContentSchema = z.object({
  kind: z.literal('stat'),
  value: z.string().min(1, 'stat value must not be empty'),
  label: z.string().optional(),
});

const textCellContentSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
});

const titleCellContentSchema = z.object({
  kind: z.literal('title'),
  text: z.string().min(1, 'title text must not be empty'),
});

const cellContentSchema = z.discriminatedUnion('kind', [
  flowCellContentSchema,
  treeCellContentSchema,
  sequenceCellContentSchema,
  timelineCellContentSchema,
  refCellContentSchema,
  statCellContentSchema,
  textCellContentSchema,
  titleCellContentSchema,
]);

// ---------------------------------------------------------------------------
// Cell schema
// ---------------------------------------------------------------------------

const cellSchema = z.object({
  id: z.string().min(1, 'cell id must not be empty'),
  col: z.number().int().min(0).optional(),
  row: z.number().int().min(0).optional(),
  colSpan: z.number().int().min(1).default(1),
  rowSpan: z.number().int().min(1).default(1),
  title: z.string().optional(),
  content: cellContentSchema,
});

// ---------------------------------------------------------------------------
// Grid schema
// ---------------------------------------------------------------------------

const gridSchema = z.object({
  columns: z.number().int().min(1, 'grid.columns must be >= 1'),
  rows: z.number().int().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Metadata schema
// ---------------------------------------------------------------------------

const metadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Root document schema with cross-field validation
// ---------------------------------------------------------------------------

export const compositionDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: metadataSchema,
    grid: gridSchema,
    cells: z.array(cellSchema).min(1, 'cells must have at least one entry'),
  })
  .superRefine((doc, ctx) => {
    const columns = doc.grid.columns;

    // Resolve actual row/col for each cell (row-major defaults)
    let cursor = 0;
    const placedCells: Array<{
      id: string;
      col: number;
      row: number;
      colSpan: number;
      rowSpan: number;
    }> = [];

    for (let idx = 0; idx < doc.cells.length; idx++) {
      const cell = doc.cells[idx]!;
      const colSpan = cell.colSpan ?? 1;
      const rowSpan = cell.rowSpan ?? 1;

      let col: number;
      let row: number;
      if (cell.col !== undefined && cell.row !== undefined) {
        col = cell.col;
        row = cell.row;
      } else {
        col = cursor % columns;
        row = Math.floor(cursor / columns);
        cursor += colSpan;
      }

      placedCells.push({ id: cell.id, col, row, colSpan, rowSpan });

      // col + colSpan must fit within columns
      if (col + colSpan > columns) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cells', idx],
          message: `Cell '${cell.id}': col(${col}) + colSpan(${colSpan}) = ${col + colSpan} exceeds grid.columns(${columns})`,
        });
      }

      // row + rowSpan must fit within grid.rows when declared
      if (doc.grid.rows !== undefined && row + rowSpan > doc.grid.rows) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cells', idx],
          message: `Cell '${cell.id}': row(${row}) + rowSpan(${rowSpan}) = ${row + rowSpan} exceeds grid.rows(${doc.grid.rows})`,
        });
      }
    }

    // Cell ids must be unique
    const ids = new Set<string>();
    for (let idx = 0; idx < doc.cells.length; idx++) {
      const cell = doc.cells[idx]!;
      if (ids.has(cell.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cells', idx, 'id'],
          message: `Duplicate cell id: '${cell.id}'`,
        });
      }
      ids.add(cell.id);
    }

    // No two cells may occupy the same grid slot
    const occupied = new Set<string>();
    for (const pc of placedCells) {
      for (let r = pc.row; r < pc.row + pc.rowSpan; r++) {
        for (let c = pc.col; c < pc.col + pc.colSpan; c++) {
          const key = `${r},${c}`;
          if (occupied.has(key)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Cell '${pc.id}' overlaps with another cell at grid position (row=${r}, col=${c})`,
            });
          }
          occupied.add(key);
        }
      }
    }
  });

export type CompositionDocumentInput = z.input<typeof compositionDocumentSchema>;
