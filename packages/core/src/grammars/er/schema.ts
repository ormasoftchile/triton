/**
 * @file grammars/er/schema.ts — Zod schema for ERDocument.
 */

import { z } from 'zod';

const erAttributeSchema = z.object({
  type: z.string().min(1, 'Attribute type must not be empty'),
  name: z.string().min(1, 'Attribute name must not be empty'),
  keys: z.array(z.enum(['PK', 'FK', 'UK'])).optional(),
  comment: z.string().optional(),
});

const erEntitySchema = z.object({
  name: z.string().min(1, 'Entity name must not be empty'),
  attributes: z.array(erAttributeSchema),
});

const erRelationshipSchema = z.object({
  entityA: z.string().min(1, 'Relationship entityA must not be empty'),
  entityB: z.string().min(1, 'Relationship entityB must not be empty'),
  cardinalityA: z.enum(['zero-or-one', 'exactly-one', 'zero-or-many', 'one-or-many']),
  cardinalityB: z.enum(['zero-or-one', 'exactly-one', 'zero-or-many', 'one-or-many']),
  identifying: z.boolean(),
  label: z.string().min(1, 'Relationship label must not be empty'),
});

const erMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const erDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: erMetadataSchema,
    entities: z.array(erEntitySchema),
    relationships: z.array(erRelationshipSchema),
  })
  .superRefine((doc, ctx) => {
    const names = new Set<string>();
    for (let i = 0; i < doc.entities.length; i++) {
      const entity = doc.entities[i]!;
      if (names.has(entity.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entities', i, 'name'],
          message: `Duplicate entity name: '${entity.name}'`,
        });
      }
      names.add(entity.name);
    }

    for (let i = 0; i < doc.relationships.length; i++) {
      const relationship = doc.relationships[i]!;
      if (!names.has(relationship.entityA)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relationships', i, 'entityA'],
          message: `Relationship at index ${i} references unknown entity '${relationship.entityA}' in field 'entityA'`,
        });
      }
      if (!names.has(relationship.entityB)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relationships', i, 'entityB'],
          message: `Relationship at index ${i} references unknown entity '${relationship.entityB}' in field 'entityB'`,
        });
      }
    }
  });

export type ErDocumentInput = z.input<typeof erDocumentSchema>;
