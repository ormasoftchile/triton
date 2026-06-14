/**
 * @file grammars/c4/schema.ts — Zod schema for C4Document.
 */

import { z } from 'zod';

import type { C4Boundary, C4Document, C4Element } from './types.js';

const C4_ELEMENT_KINDS = [
  'Person', 'Person_Ext',
  'System', 'System_Ext', 'SystemDb', 'SystemDb_Ext', 'SystemQueue', 'SystemQueue_Ext',
  'Container', 'Container_Ext', 'ContainerDb', 'ContainerDb_Ext', 'ContainerQueue', 'ContainerQueue_Ext',
  'Component', 'Component_Ext', 'ComponentDb', 'ComponentDb_Ext', 'ComponentQueue', 'ComponentQueue_Ext',
] as const;

const C4_BOUNDARY_KINDS = [
  'Boundary',
  'Enterprise_Boundary',
  'System_Boundary',
  'Container_Boundary',
] as const;

const C4_REL_KINDS = ['Rel', 'BiRel', 'Rel_U', 'Rel_D', 'Rel_L', 'Rel_R', 'Rel_Back'] as const;
const C4_DIAGRAM_KINDS = ['C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'] as const;

const c4ElementSchema: z.ZodType<C4Element> = z.object({
  alias: z.string().min(1, 'Element alias must not be empty'),
  kind: z.enum(C4_ELEMENT_KINDS),
  label: z.string().min(1, 'Element label must not be empty'),
  technology: z.string().optional(),
  description: z.string().optional(),
});

const c4BoundarySchema: z.ZodType<C4Boundary> = z.lazy(() =>
  z.object({
    alias: z.string().min(1, 'Boundary alias must not be empty'),
    label: z.string().min(1, 'Boundary label must not be empty'),
    boundaryKind: z.enum(C4_BOUNDARY_KINDS),
    boundaryType: z.string().optional(),
    children: z.array(z.union([c4ElementSchema, c4BoundarySchema])),
  }),
);

const c4RelSchema = z.object({
  kind: z.enum(C4_REL_KINDS),
  from: z.string().min(1, 'Relationship source alias must not be empty'),
  to: z.string().min(1, 'Relationship target alias must not be empty'),
  label: z.string().min(1, 'Relationship label must not be empty'),
  technology: z.string().optional(),
  order: z.number().int().positive().optional(),
});

const c4MetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
  diagramKind: z.enum(C4_DIAGRAM_KINDS),
});

function addAlias(
  aliases: Set<string>,
  alias: string,
  path: Array<string | number>,
  ctx: z.RefinementCtx,
): void {
  if (aliases.has(alias)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: `Duplicate C4 alias: '${alias}'`,
    });
    return;
  }
  aliases.add(alias);
}

function collectBoundaryAliases(
  boundary: C4Boundary,
  path: Array<string | number>,
  aliases: Set<string>,
  ctx: z.RefinementCtx,
): void {
  addAlias(aliases, boundary.alias, [...path, 'alias'], ctx);

  for (let i = 0; i < boundary.children.length; i++) {
    const child = boundary.children[i]!;
    if ('boundaryKind' in child) {
      collectBoundaryAliases(child, [...path, 'children', i], aliases, ctx);
    } else {
      addAlias(aliases, child.alias, [...path, 'children', i, 'alias'], ctx);
    }
  }
}

export const c4DocumentSchema: z.ZodType<C4Document> = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: c4MetadataSchema,
    elements: z.array(c4ElementSchema),
    boundaries: z.array(c4BoundarySchema),
    rels: z.array(c4RelSchema),
  })
  .superRefine((doc, ctx) => {
    const aliases = new Set<string>();

    for (let i = 0; i < doc.elements.length; i++) {
      addAlias(aliases, doc.elements[i]!.alias, ['elements', i, 'alias'], ctx);
    }

    for (let i = 0; i < doc.boundaries.length; i++) {
      collectBoundaryAliases(doc.boundaries[i]!, ['boundaries', i], aliases, ctx);
    }

    for (let i = 0; i < doc.rels.length; i++) {
      const rel = doc.rels[i]!;
      if (!aliases.has(rel.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rels', i, 'from'],
          message: `Relationship at index ${i} references unknown alias '${rel.from}' in field 'from'`,
        });
      }
      if (!aliases.has(rel.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rels', i, 'to'],
          message: `Relationship at index ${i} references unknown alias '${rel.to}' in field 'to'`,
        });
      }
    }
  });

export type C4DocumentInput = z.input<typeof c4DocumentSchema>;
