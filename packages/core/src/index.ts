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
export type { BuildSceneOptions } from './render/index.js';
export { resolveTheme } from './themes/index.js';
export { sceneHash } from './scene.js';
export type { Scene, ScenePrimitive, ImagePrimitive } from './scene.js';
export { sceneToSvg } from './render/svg.js';

// Layout-quality linter
export { lintScene } from './lint.js';
export type { QualityIssue } from './lint.js';

// Sequence grammar (first multi-grammar architecture entry point)
export {
  buildSequenceScene,
  renderSequenceDocument,
  sequenceDocumentSchema,
  defaultSequenceTheme,
  sequenceByteByteGoTheme,
  resolveSequenceTheme,
  SEQUENCE_THEME_REGISTRY,
} from './grammars/sequence/index.js';
export type {
  SequenceDocument,
  SequenceDocumentInput,
  SequenceRenderOptions,
  SequenceRenderResult,
  Participant,
  Message,
  Activation,
  Fragment,
  SequenceTheme,
  CardKindStyle,
} from './grammars/sequence/index.js';

// Tree grammar (second multi-grammar architecture entry point — BJ+L tidy-tree)
export {
  buildTreeScene,
  renderTreeDocument,
  treeDocumentSchema,
  defaultTreeTheme,
  resolveTreeTheme,
  TREE_THEME_REGISTRY,
} from './grammars/tree/index.js';
export type {
  TreeDocument,
  TreeNode,
  TreeMetadata,
  TreeDefinition,
  TreeDocumentInput,
  TreeRenderOptions,
  TreeRenderResult,
  TreeTheme,
  TreeEdgeStyle,
  TreeOrientation,
} from './grammars/tree/index.js';

// Flow grammar (third multi-grammar architecture entry point — layered DAG layout)
export {
  buildFlowScene,
  renderFlowDocument,
  flowDocumentSchema,
  defaultFlowTheme,
  resolveFlowTheme,
  FLOW_THEME_REGISTRY,
} from './grammars/flow/index.js';
export type {
  FlowDocument,
  FlowNode,
  FlowEdge,
  FlowDefinition,
  FlowMetadata,
  FlowDocumentInput,
  FlowRenderOptions,
  FlowRenderResult,
  FlowTheme,
  FlowOrientation,
  FlowEdgeStyle,
} from './grammars/flow/index.js';
