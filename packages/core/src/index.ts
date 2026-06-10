/**
 * @timeline-compiler/core — public entry point.
 *
 * Re-exports the complete public API surface.  Consumers import from here.
 */

export type {
  Activity,
  Annotation,
  AnnotationType,
  AxisUnit,
  Diagnostic,
  DiagnosticRange,
  Group,
  ID,
  IRDate,
  IRDocument,
  IncrementalResult,
  Legend,
  LegendEntry,
  Metadata,
  Milestone,
  RenderFormat,
  RenderOptions,
  RenderResult,
  Section,
  Session,
  Status,
  ThemeInfo,
  TimeRange,
  Track,
  ValidationResult,
} from './types.js';

export {
  NotImplementedError,
  compile,
  createSession,
  getSchema,
  listThemes,
  loadIR,
  render,
  validate,
} from './api.js';

export { irDocumentSchema, buildJsonSchema } from './schema.js';
export type { IRDocumentInput } from './schema.js';
