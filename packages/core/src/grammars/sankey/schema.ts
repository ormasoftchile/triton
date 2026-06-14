/**
 * @file grammars/sankey/schema.ts — Zod schema for SankeyDocument.
 */

import { z } from 'zod';

import type { SankeyDocument, SankeyLink, SankeyMetadata, SankeyNode } from './types.js';

const sankeyNodeSchema: z.ZodType<SankeyNode> = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number().int().nonnegative(),
});

const sankeyLinkSchema: z.ZodType<SankeyLink> = z.object({
  source: z.string(),
  target: z.string(),
  value: z.number().nonnegative(),
});

const sankeyMetadataSchema: z.ZodType<SankeyMetadata> = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const sankeyDocumentSchema: z.ZodType<SankeyDocument> = z.object({
  version: z.string(),
  metadata: sankeyMetadataSchema,
  nodes: z.array(sankeyNodeSchema),
  links: z.array(sankeyLinkSchema),
});

export type SankeyDocumentInput = z.input<typeof sankeyDocumentSchema>;
