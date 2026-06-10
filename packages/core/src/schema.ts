/**
 * @file schema.ts — Zod schema for Timeline IR documents.
 *
 * This is the single source of truth for structural validation.  Phase 0 schema
 * is intentionally permissive — Phase 1 (Mark) will tighten invariants.
 *
 * `getSchema()` uses zod-to-json-schema to emit a JSON Schema object that the
 * schema package writes to v1/timeline.json.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

const idSchema = z.string().min(1);
const irDateSchema = z.string().min(1);

const statusSchema = z.enum([
  'planned',
  'in-progress',
  'done',
  'at-risk',
  'blocked',
  'cancelled',
  'tentative',
]);

const axisUnitSchema = z.enum(['day', 'week', 'month', 'quarter', 'half', 'year']);

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const timeRangeSchema = z.object({
  start: irDateSchema,
  end: irDateSchema.optional(),
});

const metadataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  created: irDateSchema.optional(),
  updated: irDateSchema.optional(),
  time_range: timeRangeSchema,
  axis_unit: axisUnitSchema.optional(),
  theme: z.string().optional(),
  locale: z.string().optional(),
  today: irDateSchema.optional(),
  fiscal_year_start: z.number().int().min(1).max(12).optional(),
  description: z.string().optional(),
});

const trackSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  group: idSchema.optional(),
  index: z.number().int().nonnegative().optional(),
  collapsed: z.boolean().optional(),
});

const groupSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  parent: idSchema.optional(),
  children: z.array(idSchema).optional(),
  members: z.array(idSchema).optional(),
  color: z.string().optional(),
});

const activitySchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  track: idSchema,
  start: irDateSchema.optional(),
  end: irDateSchema.optional(),
  span: irDateSchema.optional(),
  status: statusSchema.optional(),
  progress: z.number().min(0).max(1).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  group: idSchema.optional(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const milestoneSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  date: irDateSchema,
  track: idSchema.optional(),
  status: statusSchema.optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  group: idSchema.optional(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const annotationTypeSchema = z.enum([
  'today-marker',
  'callout',
  'bracket',
  'period',
  'note',
  'connector',
]);

const annotationSchema = z.object({
  type: annotationTypeSchema,
  id: idSchema.optional(),
  target: idSchema.optional(),
  targets: z.array(idSchema).optional(),
  date: irDateSchema.optional(),
  start: irDateSchema.optional(),
  end: irDateSchema.optional(),
  text: z.string().optional(),
  label: z.string().optional(),
  position: z.enum(['above', 'below', 'left', 'right']).optional(),
  style: z.string().optional(),
});

const sectionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  time_range: timeRangeSchema.optional(),
  tracks: z.array(idSchema).optional(),
  description: z.string().optional(),
  page_break: z.boolean().optional(),
});

const legendEntrySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  category: z.boolean().optional(),
});

const legendSchema = z.object({
  show: z.boolean().optional(),
  position: z.string().optional(),
  entries: z.array(legendEntrySchema).optional(),
});

// ---------------------------------------------------------------------------
// Root document schema
// ---------------------------------------------------------------------------

export const irDocumentSchema = z.object({
  version: z.string().min(1),
  metadata: metadataSchema,
  tracks: z.array(trackSchema).min(1),
  groups: z.array(groupSchema).optional(),
  activities: z.array(activitySchema),
  milestones: z.array(milestoneSchema).optional(),
  annotations: z.array(annotationSchema).optional(),
  sections: z.array(sectionSchema).optional(),
  legend: legendSchema.optional(),
});

export type IRDocumentInput = z.input<typeof irDocumentSchema>;

// ---------------------------------------------------------------------------
// JSON Schema emission
// ---------------------------------------------------------------------------

/**
 * Returns the JSON Schema object for IRDocument.
 * This is the implementation backing `getSchema()` in api.ts.
 */
export function buildJsonSchema(): object {
  return zodToJsonSchema(irDocumentSchema, {
    name: 'IRDocument',
    $refStrategy: 'none',
  }) as object;
}
