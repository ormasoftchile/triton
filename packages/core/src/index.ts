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
  IRParseError,
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

// Lower-level exports for CLI / MCP / VS Code consumers that want direct access.
export { parseIR } from './load.js';
export { validateDocument } from './validate.js';
export { renderDocument, renderDocumentAsync, buildScene } from './render/index.js';
export { resolveTheme } from './themes/index.js';
export { sceneHash } from './scene.js';
export type { Scene, ScenePrimitive } from './scene.js';

// Layout-quality linter
export { lintScene } from './lint.js';
export type { QualityIssue } from './lint.js';
