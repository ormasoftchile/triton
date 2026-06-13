/**
 * @file grammars/flow/schema.ts — Zod schema for FlowDocument.
 *
 * Validates:
 *  - version is present (non-empty string).
 *  - Node ids are unique across the nodes list.
 *  - Edge from/to values reference declared node ids.
 *  - Edge ids (when present) are unique across the edges list.
 *  - Node labels are non-empty.
 *
 * Self-loops (from == to) are valid by spec — cycles in flows are legal
 * and handled by the layout engine.
 *
 * Mirrors the style of packages/core/src/grammars/sequence/schema.ts.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

/** Kebab-case id: must start with a letter, then letters/digits/hyphens. */
const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, {
    message: 'id must match ^[a-z][a-z0-9-]*$ (e.g. "query", "embed")',
  });

// ---------------------------------------------------------------------------
// FlowNode
// ---------------------------------------------------------------------------

const flowNodeSchema = z.object({
  id: idSchema,
  label: z.string().min(1, 'Node label must not be empty'),
  kind: z.string().optional(),
  icon: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// FlowEdge
// ---------------------------------------------------------------------------

const flowEdgeSchema = z.object({
  id: idSchema.optional(),
  from: z.string().min(1, 'Edge from must reference a node id'),
  to: z.string().min(1, 'Edge to must reference a node id'),
  label: z.string().optional(),
  kind: z.enum(['sync', 'async']).optional(),
  animated: z.boolean().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const flowMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

// ---------------------------------------------------------------------------
// FlowDefinition — cross-entity checks
// ---------------------------------------------------------------------------

const flowDefinitionSchema = z
  .object({
    nodes: z.array(flowNodeSchema),
    edges: z.array(flowEdgeSchema),
  })
  .superRefine((def, ctx) => {
    // Node ids must be unique
    const ids = new Set<string>();
    for (const n of def.nodes) {
      if (ids.has(n.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node id: '${n.id}'`,
        });
      }
      ids.add(n.id);
    }

    // Edge from/to must reference declared node ids
    for (let i = 0; i < def.edges.length; i++) {
      const e = def.edges[i]!;
      if (!ids.has(e.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge at index ${i} references unknown node id '${e.from}' in field 'from'`,
        });
      }
      if (!ids.has(e.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge at index ${i} references unknown node id '${e.to}' in field 'to'`,
        });
      }
    }

    // Edge ids (when present) must be unique
    const edgeIds = new Set<string>();
    for (let i = 0; i < def.edges.length; i++) {
      const e = def.edges[i]!;
      if (e.id !== undefined) {
        if (edgeIds.has(e.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['edges', i, 'id'],
            message: `Duplicate edge id: '${e.id}'`,
          });
        }
        edgeIds.add(e.id);
      }
    }
  });

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

export const flowDocumentSchema = z.object({
  version: z.string().min(1, 'version is required'),
  metadata: flowMetadataSchema,
  flow: flowDefinitionSchema,
});

export type FlowDocumentInput = z.input<typeof flowDocumentSchema>;
