/**
 * @file grammars/sequence/schema.ts — Zod schema for SequenceDocument.
 *
 * Validates:
 *  - Participant ids are unique.
 *  - Message from/to reference declared participant ids.
 *  - Message order is present (non-negative integer).
 *  - At least one participant is declared.
 *
 * Cross-entity reference checks (activations referencing order values,
 * fragment overlap validation) are in the schema for structural checks and
 * would belong to a validate.ts counterpart for semantic checks.
 *
 * Mirrors the style of packages/core/src/schema.ts (zod + refinements).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

/** Kebab-case id: must start with a letter, then letters/digits/hyphens. */
const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, {
    message: 'id must match ^[a-z][a-z0-9-]*$ (e.g. "client", "auth-server")',
  });

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

const participantSchema = z.object({
  id: idSchema,
  label: z.string().min(1, 'Participant label must not be empty'),
  kind: z
    .enum(['actor', 'object', 'boundary', 'control', 'entity', 'database'])
    .optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

const messageSchema = z.object({
  id: idSchema.optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1, 'Message label must not be empty'),
  order: z
    .number()
    .int('Message order must be an integer')
    .min(0, 'Message order must be ≥ 0'),
  kind: z.enum(['sync', 'async', 'reply']).optional(),
});

// ---------------------------------------------------------------------------
// Activation (increment-2; accepted but not enforced deeply)
// ---------------------------------------------------------------------------

const activationSchema = z.object({
  participant: z.string().min(1),
  from_order: z.number().int().min(0),
  to_order: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Fragment (increment-2; accepted but not enforced deeply)
// ---------------------------------------------------------------------------

const fragmentSchema = z.object({
  kind: z.enum(['loop', 'alt', 'opt', 'par', 'critical', 'break']),
  label: z.string().min(1),
  from_order: z.number().int().min(0),
  to_order: z.number().int().min(0),
  participants: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const sequenceMetadataSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  theme: z.string().optional(),
});

// ---------------------------------------------------------------------------
// SequenceDefinition
// ---------------------------------------------------------------------------

const sequenceDefinitionSchema = z
  .object({
    participants: z
      .array(participantSchema)
      .min(1, 'Sequence must declare at least one participant'),
    messages: z.array(messageSchema),
    activations: z.array(activationSchema).optional(),
    fragments: z.array(fragmentSchema).optional(),
  })
  .superRefine((def, ctx) => {
    // Participant ids must be unique
    const ids = new Set<string>();
    for (const p of def.participants) {
      if (ids.has(p.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate participant id: '${p.id}'`,
        });
      }
      ids.add(p.id);
    }

    // Message from/to must reference declared participant ids
    for (const msg of def.messages) {
      if (!ids.has(msg.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Message at order ${msg.order} references unknown participant id '${msg.from}' in field 'from'`,
        });
      }
      if (!ids.has(msg.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Message at order ${msg.order} references unknown participant id '${msg.to}' in field 'to'`,
        });
      }
    }

    // Activation participant refs must be declared
    for (const act of def.activations ?? []) {
      if (!ids.has(act.participant)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Activation references unknown participant id '${act.participant}'`,
        });
      }
      if (act.from_order > act.to_order) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Activation for participant '${act.participant}' has from_order (${act.from_order}) > to_order (${act.to_order})`,
        });
      }
    }

    // Fragment validation
    for (const frag of def.fragments ?? []) {
      if (frag.from_order > frag.to_order) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Fragment '${frag.kind}' has from_order (${frag.from_order}) > to_order (${frag.to_order})`,
        });
      }
      for (const pid of frag.participants ?? []) {
        if (!ids.has(pid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Fragment '${frag.kind}' references unknown participant id '${pid}'`,
          });
        }
      }
    }
  });

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

export const sequenceDocumentSchema = z.object({
  version: z.string().min(1, 'version is required'),
  metadata: sequenceMetadataSchema,
  sequence: sequenceDefinitionSchema,
});

export type SequenceDocumentInput = z.input<typeof sequenceDocumentSchema>;
