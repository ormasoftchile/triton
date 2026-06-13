/**
 * @file schema.ts — Zod schema for Timeline IR documents.
 *
 * This is the single source of truth for structural (syntactic/schema) validation.
 * The schema faithfully encodes the IR contract from §4 (design/sections/04-ir.tex):
 * required vs optional fields, enums, ID pattern, and date string shapes.
 *
 * Well-formedness invariants (cross-entity references, date comparisons, cycle
 * detection, etc.) are checked in validate.ts, not here.
 *
 * `buildJsonSchema()` emits a JSON Schema object; `getSchema()` in api.ts depends
 * on this export name and signature — do not rename or change the return type.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

/**
 * Document-unique identifier: ^[a-z][a-z0-9-]*$
 * Lowercase letters, digits, and hyphens; must start with a letter.
 */
const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, {
    message:
      'ID must match ^[a-z][a-z0-9-]*$ — start with a lowercase letter, then lowercase letters, digits, or hyphens only (e.g. "api-v2", "mobile-team")',
  });

/**
 * Temporal value string covering all forms from §4 date model:
 *   ISO date          2026-06-09
 *   ISO datetime      2026-06-09T14:00  or  2026-06-09T14:00:00
 *   Quarter           2026-Q2
 *   Half              2026-H1
 *   Year-month        2026-06
 *   Year              2026
 *   Fiscal quarter    FY26-Q2  (2–4 digit fiscal year suffix)
 *   Relative          +3m  -2w  +1q  +1y  (sign, digits, unit letter)
 *   Symbolic          now
 *   Uncertain         tbd | ongoing | unknown
 *   Approximate       ~2026-Q3  (tilde prefix + any suffix)
 */
const IR_DATE_RE =
  /^(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?|\d{4}-Q[1-4]|\d{4}-H[12]|\d{4}-\d{2}|\d{4}|FY\d{2,4}-Q[1-4]|[+-]\d+[a-z]|now|tbd|ongoing|unknown|~.+)$/;

const irDateSchema = z.string().regex(IR_DATE_RE, {
  message:
    'Date must be ISO (2026-06-09), year-month (2026-06), year (2026), quarter (2026-Q2), half (2026-H1), fiscal quarter (FY26-Q2), relative (+3m), symbolic (now), or uncertain (tbd, ongoing, unknown, ~approx)',
});

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
// IR-date comparison helper (used by axis_breaks validation)
// ---------------------------------------------------------------------------

/**
 * Attempt to convert an IR date string to a UTC millisecond timestamp for
 * ordering comparisons.  Returns `undefined` for formats that cannot be
 * reduced to a concrete instant (symbolic, relative, uncertain, approximate).
 */
function parseIrDateToMs(d: string): number | undefined {
  // ISO date: 2026-06-09
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return Date.UTC(
      parseInt(d.slice(0, 4)),
      parseInt(d.slice(5, 7)) - 1,
      parseInt(d.slice(8, 10)),
    );
  }
  // ISO datetime: 2026-06-09T14:00 or 2026-06-09T14:00:00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(d)) {
    return new Date(d.length === 16 ? d + ':00Z' : d + 'Z').getTime();
  }
  // Year-month: 2026-06
  if (/^\d{4}-\d{2}$/.test(d)) {
    return Date.UTC(parseInt(d.slice(0, 4)), parseInt(d.slice(5, 7)) - 1, 1);
  }
  // Year: 2026
  if (/^\d{4}$/.test(d)) {
    return Date.UTC(parseInt(d), 0, 1);
  }
  // Quarter: 2026-Q1 → Jan 1, Q2 → Apr 1, Q3 → Jul 1, Q4 → Oct 1
  const qm = d.match(/^(\d{4})-Q([1-4])$/);
  if (qm) {
    return Date.UTC(parseInt(qm[1]!), (parseInt(qm[2]!) - 1) * 3, 1);
  }
  // Half: 2026-H1 → Jan 1, 2026-H2 → Jul 1
  const hm = d.match(/^(\d{4})-H([12])$/);
  if (hm) {
    return Date.UTC(parseInt(hm[1]!), parseInt(hm[2]!) === 1 ? 0 : 6, 1);
  }
  // Symbolic / relative / uncertain / approximate → not comparable
  return undefined;
}

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const timeRangeSchema = z.object({
  start: irDateSchema,
  end: irDateSchema.optional(),
});

const logoSchema = z.object({
  /**
   * Filesystem path (PNG/JPEG/SVG) or inline `data:` URI.
   * Existence and URI well-formedness are NOT validated here — rendering concern.
   */
  src: z.string().min(1),
  position: z.enum(['top-left', 'top-right']).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

/**
 * A single titled content block within an entry.
 * `heading` is optional; `text` is required and must be non-empty.
 * See ContentBlock in types.ts for the description-vs-blocks rendering precedence.
 */
const contentBlockSchema = z.object({
  heading: z.string().optional(),
  text: z.string().min(1),
});

/**
 * A single axis-break interval: a [from, to) time range that is collapsed to a
 * small "//" marker on the axis instead of proportional time width.
 *
 * Invariants enforced:
 *   - from < to (when both dates are in a comparable format).
 *   - from ≥ metadata.time_range.start (when comparable).
 *   - to ≤ metadata.time_range.end (when comparable and end is declared).
 *   - Breaks are non-overlapping (when all dates are comparable).
 * Comparisons are skipped for symbolic/relative/approximate dates that cannot
 * be reduced to a concrete timestamp.
 */
const axisBreakSchema = z.object({
  from: irDateSchema,
  to:   irDateSchema,
});

const metadataSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    created: irDateSchema.optional(),
    updated: irDateSchema.optional(),
    time_range: timeRangeSchema,
    axis_unit: axisUnitSchema.optional(),
    theme: z.string().optional(),
    layout: z.enum(['horizontal', 'vertical-spine', 'serpentine', 'roadmap']).optional(),
    locale: z.string().optional(),
    today: irDateSchema.optional(),
    fiscal_year_start: z.number().int().min(1).max(12).optional(),
    description: z.string().optional(),
    logo: logoSchema.optional(),
    /**
     * Opt-in list of time intervals to collapse on the axis.
     * When absent/empty → ZERO behaviour change (byte-identical output).
     */
    axis_breaks: z.array(axisBreakSchema).optional(),
  })
  .superRefine((meta, ctx) => {
    const breaks = meta.axis_breaks;
    if (!breaks || breaks.length === 0) return;

    const rangeStartMs = parseIrDateToMs(meta.time_range.start);
    const rangeEndMs   = meta.time_range.end ? parseIrDateToMs(meta.time_range.end) : undefined;

    // Per-break invariants
    for (let i = 0; i < breaks.length; i++) {
      const b = breaks[i]!;
      const fromMs = parseIrDateToMs(b.from);
      const toMs   = parseIrDateToMs(b.to);

      // from < to
      if (fromMs !== undefined && toMs !== undefined && fromMs >= toMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['axis_breaks', i],
          message: `axis_breaks[${i}]: 'from' (${b.from}) must be strictly before 'to' (${b.to})`,
        });
      }

      // break lies within time_range
      if (fromMs !== undefined && rangeStartMs !== undefined && fromMs < rangeStartMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['axis_breaks', i, 'from'],
          message: `axis_breaks[${i}]: 'from' (${b.from}) is before time_range.start (${meta.time_range.start})`,
        });
      }
      if (toMs !== undefined && rangeEndMs !== undefined && toMs > rangeEndMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['axis_breaks', i, 'to'],
          message: `axis_breaks[${i}]: 'to' (${b.to}) is after time_range.end (${meta.time_range.end})`,
        });
      }
    }

    // Non-overlapping: sort comparable breaks by from, then check adjacent pairs.
    // Sort-tolerant: breaks need not be authored in order — we sort internally.
    const parsedBreaks = breaks
      .map((b, i) => ({
        i,
        fromMs: parseIrDateToMs(b.from),
        toMs:   parseIrDateToMs(b.to),
        fromStr: b.from,
        toStr:   b.to,
      }))
      .filter((b): b is typeof b & { fromMs: number; toMs: number } =>
        b.fromMs !== undefined && b.toMs !== undefined,
      );

    parsedBreaks.sort((a, b) => a.fromMs - b.fromMs);

    for (let i = 0; i < parsedBreaks.length - 1; i++) {
      const curr = parsedBreaks[i]!;
      const next = parsedBreaks[i + 1]!;
      if (curr.toMs > next.fromMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['axis_breaks'],
          message: `axis_breaks overlap: break [${curr.fromStr}, ${curr.toStr}] overlaps with [${next.fromStr}, ${next.toStr}]`,
        });
      }
    }
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
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  blocks: z.array(contentBlockSchema).optional(),
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
  blocks: z.array(contentBlockSchema).optional(),
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
  title: z.string().optional(),
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
