/**
 * @file grammars/class/schema.ts — Zod schema for ClassDocument.
 */

import { z } from 'zod';

const classMemberSchema = z.object({
  visibility: z.enum(['+', '-', '#', '~']).optional(),
  name: z.string().min(1, 'Member name must not be empty'),
  type: z.string().optional(),
  isMethod: z.boolean(),
  params: z.string().optional(),
  modifiers: z.array(z.enum(['abstract', 'static'])).optional(),
});

const classDefSchema = z.object({
  id: z.string().min(1, 'Class id must not be empty'),
  name: z.string().min(1, 'Class name must not be empty'),
  stereotype: z.string().optional(),
  members: z.array(classMemberSchema),
});

const classRelationshipSchema = z.object({
  from: z.string().min(1, 'Relationship from must reference a class id'),
  to: z.string().min(1, 'Relationship to must reference a class id'),
  kind: z.enum(['inheritance', 'realization', 'composition', 'aggregation', 'association', 'dependency']),
  fromCardinality: z.string().optional(),
  toCardinality: z.string().optional(),
  label: z.string().optional(),
});

const classMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const classDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: classMetadataSchema,
    classes: z.array(classDefSchema),
    relationships: z.array(classRelationshipSchema),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (let i = 0; i < doc.classes.length; i++) {
      const cls = doc.classes[i]!;
      if (ids.has(cls.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['classes', i, 'id'],
          message: `Duplicate class id: '${cls.id}'`,
        });
      }
      ids.add(cls.id);
    }

    for (let i = 0; i < doc.relationships.length; i++) {
      const rel = doc.relationships[i]!;
      if (!ids.has(rel.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relationships', i, 'from'],
          message: `Relationship at index ${i} references unknown class id '${rel.from}' in field 'from'`,
        });
      }
      if (!ids.has(rel.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relationships', i, 'to'],
          message: `Relationship at index ${i} references unknown class id '${rel.to}' in field 'to'`,
        });
      }
    }
  });

export type ClassDocumentInput = z.input<typeof classDocumentSchema>;
