/**
 * @file grammars/sequence/schema.ts — Zod schema for SequenceDocument.
 *
 * Validates:
 *  - Participant ids are unique.
 *  - Message from/to reference declared participant ids.
 *  - Message order is present (non-negative integer) and unique across all messages.
 *  - At least one participant is declared.
 *  - Activations: participant ref declared; from_order ≤ to_order; range within
 *    the messages' order range [minOrder, maxOrder].
 *  - Fragments: participant refs declared; from_order ≤ to_order; range within
 *    the messages' order range.
 *  - Fragment sections (alt): each section fromOrder ≤ toOrder; sections lie
 *    within the fragment's [from_order, to_order]; sections are sorted by
 *    fromOrder (non-descending).
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
// Fragment (increment-2; cross-field rules enforced in sequenceDefinitionSchema)
// ---------------------------------------------------------------------------

const fragmentSectionSchema = z
  .object({
    guard: z.string().optional(),
    fromOrder: z.number().int().min(0),
    toOrder: z.number().int().min(0),
  })
  .refine((s) => s.fromOrder <= s.toOrder, {
    message: 'Fragment section fromOrder must be ≤ toOrder',
  });

const fragmentSchema = z.object({
  kind: z.enum(['loop', 'alt', 'opt', 'par', 'critical', 'break']),
  label: z.string().min(1),
  from_order: z.number().int().min(0),
  to_order: z.number().int().min(0),
  participants: z.array(z.string()).optional(),
  sections: z.array(fragmentSectionSchema).optional(),
});

const sequenceNoteSchema = z.object({
  afterOrder: z.number().int().min(-1),
  placement: z.enum(['over', 'left', 'right']),
  participants: z.array(z.string().min(1)).min(1),
  text: z.string().min(1),
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
    autonumber: z.boolean().optional(),
    notes: z.array(sequenceNoteSchema).optional(),
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

    // Message order must be unique
    const orderSet = new Set<number>();
    for (const msg of def.messages) {
      if (orderSet.has(msg.order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate message order: ${msg.order} — each message must have a unique order value`,
        });
      }
      orderSet.add(msg.order);
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

    // Note participant refs must be declared
    for (const note of def.notes ?? []) {
      for (const pid of note.participants) {
        if (!ids.has(pid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Note references unknown participant id '${pid}'`,
          });
        }
      }
    }

    // Compute messages' order range (only when messages are present)
    const orders = def.messages.map((m) => m.order);
    const minOrder = orders.length > 0 ? Math.min(...orders) : undefined;
    const maxOrder = orders.length > 0 ? Math.max(...orders) : undefined;

    // Activation participant refs must be declared; order range must be within messages' range
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
      if (minOrder !== undefined && act.from_order < minOrder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Activation for participant '${act.participant}' has from_order (${act.from_order}) below the minimum message order (${minOrder})`,
        });
      }
      if (maxOrder !== undefined && act.to_order > maxOrder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Activation for participant '${act.participant}' has to_order (${act.to_order}) above the maximum message order (${maxOrder})`,
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
      if (minOrder !== undefined && frag.from_order < minOrder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Fragment '${frag.kind}' has from_order (${frag.from_order}) below the minimum message order (${minOrder})`,
        });
      }
      if (maxOrder !== undefined && frag.to_order > maxOrder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Fragment '${frag.kind}' has to_order (${frag.to_order}) above the maximum message order (${maxOrder})`,
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
      // Fragment sections: within fragment bounds and sorted by fromOrder
      const sections = frag.sections ?? [];
      for (let si = 0; si < sections.length; si++) {
        const sec = sections[si]!;
        if (sec.fromOrder < frag.from_order) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Fragment '${frag.kind}' section[${si}] fromOrder (${sec.fromOrder}) is below fragment from_order (${frag.from_order})`,
          });
        }
        if (sec.toOrder > frag.to_order) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Fragment '${frag.kind}' section[${si}] toOrder (${sec.toOrder}) is above fragment to_order (${frag.to_order})`,
          });
        }
        if (si > 0) {
          const prev = sections[si - 1]!;
          if (sec.fromOrder < prev.fromOrder) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Fragment '${frag.kind}' sections must be sorted by fromOrder; section[${si}].fromOrder (${sec.fromOrder}) < section[${si - 1}].fromOrder (${prev.fromOrder})`,
            });
          }
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
