import { z } from 'zod';

import type { JourneyDocument, JourneyMetadata, JourneySection, JourneyTask } from './types.js';

const journeyTaskSchema: z.ZodType<JourneyTask> = z.object({
  name: z.string(),
  score: z.number().min(1).max(5),
  actors: z.array(z.string()),
});

const journeySectionSchema: z.ZodType<JourneySection> = z.object({
  name: z.string(),
  tasks: z.array(journeyTaskSchema),
});

const journeyMetadataSchema: z.ZodType<JourneyMetadata> = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

export const journeyDocumentSchema: z.ZodType<JourneyDocument> = z.object({
  version: z.string(),
  metadata: journeyMetadataSchema,
  sections: z.array(journeySectionSchema),
  preambleTasks: z.array(journeyTaskSchema),
});

export type JourneyDocumentInput = z.input<typeof journeyDocumentSchema>;
