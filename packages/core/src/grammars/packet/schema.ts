/**
 * @file grammars/packet/schema.ts — Zod schema for PacketDocument.
 */

import { z } from 'zod';

const packetFieldSchema = z.object({
  startBit: z.number().int().nonnegative('Packet field startBit must be >= 0'),
  endBit: z.number().int().nonnegative('Packet field endBit must be >= 0'),
  label: z.string().min(1, 'Packet field label must not be empty'),
});

const packetMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
  bitsPerRow: z.number().int().positive().optional(),
});

export const packetDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: packetMetadataSchema,
    fields: z.array(packetFieldSchema),
  })
  .superRefine((doc, ctx) => {
    for (let i = 0; i < doc.fields.length; i++) {
      const field = doc.fields[i]!;
      if (field.endBit < field.startBit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', i, 'endBit'],
          message: `Packet field endBit (${field.endBit}) must be >= startBit (${field.startBit})`,
        });
      }
    }
  });

export type PacketDocumentInput = z.input<typeof packetDocumentSchema>;
