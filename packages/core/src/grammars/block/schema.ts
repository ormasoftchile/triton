/**
 * @file grammars/block/schema.ts — Zod schema for BlockDocument.
 */

import { z } from 'zod';

const blockItemSchema = z.object({
  id: z.string().min(1, 'Block item id must not be empty'),
  label: z.string(),
  shape: z.enum(['rect', 'rounded', 'circle', 'diamond', 'flag', 'space']),
  span: z.number().int().positive('Block item span must be >= 1'),
  isSpace: z.boolean(),
  group: z.string().optional(),
  order: z.number().int().optional(),
});

const blockGroupSchema = z.object({
  id: z.string().min(1, 'Block group id must not be empty'),
  label: z.string().min(1, 'Block group label must not be empty'),
  span: z.number().int().positive('Block group span must be >= 1'),
  childIds: z.array(z.string().min(1)),
  group: z.string().optional(),
  order: z.number().int().optional(),
});

const blockArrowSchema = z.object({
  from: z.string().min(1, 'Block arrow source must not be empty'),
  to: z.string().min(1, 'Block arrow target must not be empty'),
  label: z.string().optional(),
});

const blockMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const blockDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: blockMetadataSchema,
    columns: z.number().int().positive('columns must be >= 1'),
    items: z.array(blockItemSchema),
    groups: z.array(blockGroupSchema),
    arrows: z.array(blockArrowSchema),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (let i = 0; i < doc.items.length; i++) {
      const item = doc.items[i]!;
      if (ids.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'id'],
          message: `Duplicate block item id: '${item.id}'`,
        });
      }
      ids.add(item.id);
    }

    for (let i = 0; i < doc.groups.length; i++) {
      const group = doc.groups[i]!;
      if (ids.has(group.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['groups', i, 'id'],
          message: `Duplicate block group id: '${group.id}'`,
        });
      }
      ids.add(group.id);
    }
  });

export type BlockDocumentInput = z.input<typeof blockDocumentSchema>;
