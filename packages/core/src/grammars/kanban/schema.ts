/**
 * @file grammars/kanban/schema.ts — Zod schema for KanbanDocument.
 */

import { z } from 'zod';

const kanbanCardMetadataSchema = z
  .record(z.string(), z.string().optional())
  .optional();

const kanbanCardSchema = z.object({
  id: z.string().min(1, 'Card id must not be empty'),
  label: z.string().min(1, 'Card label must not be empty'),
  metadata: kanbanCardMetadataSchema,
});

const kanbanColumnSchema = z.object({
  id: z.string().min(1, 'Column id must not be empty'),
  label: z.string().min(1, 'Column label must not be empty'),
  cards: z.array(kanbanCardSchema),
});

const kanbanMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const kanbanDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: kanbanMetadataSchema,
    columns: z.array(kanbanColumnSchema),
  })
  .superRefine((doc, ctx) => {
    const colIds = new Set<string>();
    for (let i = 0; i < doc.columns.length; i++) {
      const col = doc.columns[i]!;
      if (colIds.has(col.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['columns', i, 'id'],
          message: `Duplicate column id: '${col.id}'`,
        });
      }
      colIds.add(col.id);
    }
  });

export type KanbanDocumentInput = z.input<typeof kanbanDocumentSchema>;
