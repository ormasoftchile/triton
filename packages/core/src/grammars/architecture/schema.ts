/**
 * @file grammars/architecture/schema.ts — Zod schema for ArchitectureDocument.
 */

import { z } from 'zod';

const portSideSchema = z.enum(['L', 'R', 'T', 'B']);
const arrowTypeSchema = z.enum(['none', 'arrow', 'arrow-left', 'arrow-both']);

const archServiceSchema = z.object({
  id: z.string().min(1, 'Architecture service id must not be empty'),
  icon: z.string().min(1, 'Architecture service icon must not be empty'),
  title: z.string().min(1, 'Architecture service title must not be empty'),
  parentGroup: z.string().optional(),
});

const archGroupSchema = z.object({
  id: z.string().min(1, 'Architecture group id must not be empty'),
  icon: z.string().min(1, 'Architecture group icon must not be empty'),
  title: z.string().min(1, 'Architecture group title must not be empty'),
  parentGroup: z.string().optional(),
});

const archJunctionSchema = z.object({
  id: z.string().min(1, 'Architecture junction id must not be empty'),
  parentGroup: z.string().optional(),
});

const archEdgeSchema = z.object({
  fromId: z.string().min(1, 'Architecture edge source id must not be empty'),
  fromSide: portSideSchema,
  toId: z.string().min(1, 'Architecture edge target id must not be empty'),
  toSide: portSideSchema,
  arrowType: arrowTypeSchema,
});

const architectureMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const architectureDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: architectureMetadataSchema,
    services: z.array(archServiceSchema),
    groups: z.array(archGroupSchema),
    junctions: z.array(archJunctionSchema),
    edges: z.array(archEdgeSchema),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    const register = (kind: 'services' | 'groups' | 'junctions', id: string, index: number): void => {
      if (ids.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [kind, index, 'id'],
          message: `Duplicate architecture id: '${id}'`,
        });
        return;
      }
      ids.add(id);
    };

    doc.services.forEach((service, index) => register('services', service.id, index));
    doc.groups.forEach((group, index) => register('groups', group.id, index));
    doc.junctions.forEach((junction, index) => register('junctions', junction.id, index));

    const groupIds = new Set(doc.groups.map((group) => group.id));
    const checkParent = (kind: 'services' | 'groups' | 'junctions', parentGroup: string | undefined, index: number): void => {
      if (parentGroup && !groupIds.has(parentGroup)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [kind, index, 'parentGroup'],
          message: `Unknown parentGroup '${parentGroup}'`,
        });
      }
    };

    doc.services.forEach((service, index) => checkParent('services', service.parentGroup, index));
    doc.groups.forEach((group, index) => checkParent('groups', group.parentGroup, index));
    doc.junctions.forEach((junction, index) => checkParent('junctions', junction.parentGroup, index));

    doc.edges.forEach((edge, index) => {
      if (!ids.has(edge.fromId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index, 'fromId'],
          message: `Unknown architecture edge source '${edge.fromId}'`,
        });
      }
      if (!ids.has(edge.toId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', index, 'toId'],
          message: `Unknown architecture edge target '${edge.toId}'`,
        });
      }
    });
  });

export type ArchitectureDocumentInput = z.input<typeof architectureDocumentSchema>;
