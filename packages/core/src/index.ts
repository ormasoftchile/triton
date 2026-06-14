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

// Class grammar (fourth multi-grammar architecture entry point — UML class compartments)
export {
  buildClassScene,
  renderClassDocument,
  classDocumentSchema,
  defaultClassTheme,
  darkClassTheme,
  resolveClassTheme,
  CLASS_THEME_REGISTRY,
} from './grammars/class/index.js';
export type {
  ClassDocument,
  ClassMetadata,
  ClassDef,
  ClassMember,
  ClassRelationship,
  ClassDocumentInput,
  ClassRenderOptions,
  ClassRenderResult,
  ClassTheme,
} from './grammars/class/index.js';

// State grammar (fifth multi-grammar architecture entry point — UML state machines)
export {
  buildStateScene,
  renderStateDocument,
  stateDocumentSchema,
  defaultStateTheme,
  darkStateTheme,
  resolveStateTheme,
  STATE_THEME_REGISTRY,
} from './grammars/state/index.js';
export type {
  StateDocument,
  StateMetadata,
  StateNode,
  StateTransition,
  PseudostateKind,
  StateDocumentInput,
  StateRenderOptions,
  StateRenderResult,
  StateTheme,
} from './grammars/state/index.js';

// ER grammar (sixth multi-grammar architecture entry point — crow's-foot entities)
export {
  buildErScene,
  renderErDocument,
  erDocumentSchema,
  defaultErTheme,
  darkErTheme,
  resolveErTheme,
  ER_THEME_REGISTRY,
} from './grammars/er/index.js';
export type {
  ErDocument,
  ErMetadata,
  ErEntity,
  ErAttribute,
  ErRelationship,
  ErCardinality,
  ErDocumentInput,
  ErRenderOptions,
  ErRenderResult,
  ErTheme,
} from './grammars/er/index.js';

// C4 grammar (seventh multi-grammar architecture entry point — software architecture diagrams)
export {
  buildC4Scene,
  renderC4Document,
  c4DocumentSchema,
  defaultC4Theme,
  darkC4Theme,
  resolveC4Theme,
  C4_THEME_REGISTRY,
} from './grammars/c4/index.js';
export type {
  C4Document,
  C4Metadata,
  C4Element,
  C4ElementKind,
  C4Boundary,
  C4Rel,
  C4RelKind,
  C4DiagramKind,
  C4DocumentInput,
  C4RenderOptions,
  C4RenderResult,
  C4Theme,
} from './grammars/c4/index.js';

// Scene-transform kernel helper (used by composition layer)
export { translateAndScale, embedSceneInRect, transformPathD } from './scene-transform.js';

// Composition grammar (eighth entry point — multi-panel poster layout)
export {
  buildCompositionScene,
  renderCompositionDocument,
  compositionDocumentSchema,
  defaultCompositionTheme,
  resolveCompositionTheme,
  COMPOSITION_THEME_REGISTRY,
} from './composition/index.js';
export type {
  CompositionDocument,
  Cell,
  CellContent,
  FlowCellContent,
  TreeCellContent,
  SequenceCellContent,
  StatCellContent,
  TextCellContent,
  TitleCellContent,
  CompositionDocumentInput,
  CompositionRenderOptions,
  CompositionRenderResult,
  CompositionTheme,
} from './composition/index.js';


// Chart grammar (ninth multi-grammar architecture entry point — grammar-of-graphics)
export {
  buildChartScene,
  renderChartDocument,
  defaultChartTheme,
  darkChartTheme,
  resolveChartTheme,
  CHART_THEME_REGISTRY,
} from './grammars/chart/index.js';
export type {
  ChartDocument,
  ChartEncoding,
  FieldEncoding,
  ChartConfig,
  ChartTheme,
  ChartRenderOptions,
  ChartRenderResult,
} from './grammars/chart/index.js';

// Mermaid front-end (Tier-0 Inc-1): text → Domain IR → Scene → backends
// Path A of the dual front-end architecture (§15 frontend.tex).
export {
  detectDiagramType,
  parseMermaid,
  renderMermaid,
} from './frontend/mermaid/index.js';
export type {
  DiagramKind,
  MermaidParseResult,
  MermaidRenderOptions,
  MermaidRenderFormat,
  MermaidRenderResult,
} from './frontend/mermaid/index.js';
export { parseFlowchart } from './frontend/mermaid/flowchart.js';
export { parseClassDiagram } from './frontend/mermaid/class.js';
export { parseStateDiagram } from './frontend/mermaid/state.js';
export { parseErDiagram } from './frontend/mermaid/er.js';
export { parseC4Diagram } from './frontend/mermaid/c4.js';
export { parsePieDiagram } from './frontend/mermaid/pie.js';
export { parseXYChartDiagram } from './frontend/mermaid/xychart.js';
