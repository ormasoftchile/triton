/**
 * @file grammars/requirement/schema.ts — Zod schema for RequirementDocument.
 */

import { z } from 'zod';

const requirementKindSchema = z.enum([
  'requirement',
  'functionalRequirement',
  'interfaceRequirement',
  'performanceRequirement',
  'physicalRequirement',
  'designConstraint',
]);

const requirementRiskSchema = z.enum(['high', 'medium', 'low']);
const requirementVerifyMethodSchema = z.enum(['test', 'analysis', 'inspection', 'demonstration']);
const requirementRelKindSchema = z.enum([
  'satisfies',
  'contains',
  'copies',
  'derives',
  'verifies',
  'refines',
  'traces',
]);

const requirementNodeSchema = z.object({
  name: z.string().min(1, 'Requirement name must not be empty'),
  kind: requirementKindSchema,
  id: z.string().optional(),
  text: z.string().optional(),
  risk: requirementRiskSchema.optional(),
  verifymethod: requirementVerifyMethodSchema.optional(),
});

const requirementElementSchema = z.object({
  name: z.string().min(1, 'Element name must not be empty'),
  type: z.string().optional(),
  docref: z.string().optional(),
});

const requirementRelationshipSchema = z.object({
  src: z.string().min(1, 'Relationship src must not be empty'),
  dst: z.string().min(1, 'Relationship dst must not be empty'),
  kind: requirementRelKindSchema,
});

const requirementMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const requirementDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: requirementMetadataSchema,
    requirements: z.array(requirementNodeSchema),
    elements: z.array(requirementElementSchema),
    relationships: z.array(requirementRelationshipSchema),
  })
  .superRefine((doc, ctx) => {
    const allNames = new Set<string>();
    for (let i = 0; i < doc.requirements.length; i++) {
      const r = doc.requirements[i]!;
      if (allNames.has(r.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['requirements', i, 'name'],
          message: `Duplicate node name: '${r.name}'`,
        });
      }
      allNames.add(r.name);
    }
    for (let i = 0; i < doc.elements.length; i++) {
      const e = doc.elements[i]!;
      if (allNames.has(e.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['elements', i, 'name'],
          message: `Duplicate node name: '${e.name}'`,
        });
      }
      allNames.add(e.name);
    }
    for (let i = 0; i < doc.relationships.length; i++) {
      const rel = doc.relationships[i]!;
      if (!allNames.has(rel.src)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relationships', i, 'src'],
          message: `Relationship references unknown node '${rel.src}'`,
        });
      }
      if (!allNames.has(rel.dst)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relationships', i, 'dst'],
          message: `Relationship references unknown node '${rel.dst}'`,
        });
      }
    }
  });

export type RequirementDocumentInput = z.input<typeof requirementDocumentSchema>;
