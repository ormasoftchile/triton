/**
 * Diagram
 *
 * The contract every diagram type must satisfy.
 *
 * Parsing and layout are defined as separate interfaces.
 * This segregation matters:
 *
 *   DiagramParser<IR>       — knows how to turn text into an IR.
 *                             Testable in isolation; no theme required.
 *
 *   DiagramLayoutEngine<IR> — knows how to turn an IR into a Scene.
 *                             Testable in isolation with a fixture IR.
 *
 *   DiagramModule<IR>       — the full module: composes both.
 *                             This is the type diagram directories export.
 *
 * Callers that only need to parse (e.g. a linter, a validator) depend on
 * DiagramParser. Callers that only need to render a pre-built IR (e.g. a
 * server receiving JSON) depend on DiagramLayoutEngine. The full pipeline
 * depends on DiagramModule.
 */

import type { Scene } from './scene.js';
import type { ResolvedTheme, ThemeInput } from './theme.js';
import type { RawOverlay } from './overlay.js';
import type { LayoutResult, LayoutOptions } from './anchors.js';

// ─── Base IR ──────────────────────────────────────────────────────────────────

/**
 * The minimum shape every diagram IR must satisfy.
 *
 * All diagram-specific IR interfaces extend BaseIR. This ensures:
 *   - Every IR carries uniform metadata (version, title, etc.)
 *   - Every IR can carry overlays (notes, legends) without the pipeline
 *     needing to know the concrete diagram type.
 *   - Every IR can express per-diagram theme overrides parsed from
 *     frontmatter, applied by the pipeline before layout() is called.
 */
export interface BaseIR {
  readonly version: string;
  readonly metadata: { readonly [key: string]: unknown };
  /** Overlays declared in the diagram source (notes, legends). */
  readonly overlays?: readonly RawOverlay[];
  /**
   * Per-diagram theme overrides parsed from frontmatter.
   * Applied on top of global theme + module defaults before layout().
   */
  readonly themeOverride?: ThemeInput;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export interface DiagramParser<IR extends BaseIR> {
  /**
   * Parse Mermaid-syntax text into the canonical IR.
   * Throws a descriptive error on invalid input.
   */
  parseMermaid(input: string): IR;

  /**
   * Validate and parse YAML text into the canonical IR.
   * Throws a descriptive error on invalid or schema-violating input.
   */
  parseYaml(input: string): IR;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export interface DiagramLayoutEngine<IR extends BaseIR> {
  /**
   * Transform a validated IR into a fully resolved, renderable LayoutResult.
   *
   * Returns both the renderable Scene and the node anchor registry.
   * Non-linkable diagram types return an empty anchors registry {}.
   *
   * Synchronous: every Triton layout engine computes its geometry in-process
   * with no deferred work (no font-metric I/O, no WASM, no fetching). Keeping
   * layout sync lets the frontend expose a synchronous render path
   * (renderSync) for hosts that need it (e.g. the markdown-it preview plugin),
   * while the async render() wrapper remains for existing callers.
   *
   * The returned Scene is complete — all overlay geometry has been
   * incorporated into Scene.elements before it is returned.
   *
   * @param options - Optional layout constraints (port hints) from the
   *   composition layer during negotiation passes. Absent on first pass.
   */
  layout(ir: IR, theme: ResolvedTheme, options?: LayoutOptions): LayoutResult;
}

// ─── Full Module ──────────────────────────────────────────────────────────────

/**
 * The complete diagram module interface — parsing and layout together.
 * Every src/diagrams/<type>/index.ts exports a value satisfying this.
 */
export interface DiagramModule<IR extends BaseIR> extends DiagramParser<IR>, DiagramLayoutEngine<IR> {
  /**
   * Optional per-diagram theme defaults.
   * Applied on top of the global theme but below ir.themeOverride:
   *
   *   result = global ← defaultThemeOverride ← ir.themeOverride
   */
  readonly defaultThemeOverride?: ThemeInput;
}

// ─── Diagram Kind Registry ────────────────────────────────────────────────────

/**
 * The exhaustive set of diagram types recognised by Triton.
 *
 * This is the single source of truth for valid diagram kind strings.
 * The frontend detector, the CLI, and the API all narrow to this type.
 *
 * Adding a new diagram type requires adding it here first — before any
 * implementation exists. This makes the set of intended diagrams explicit.
 */
export type DiagramKind =
  | 'flowchart'
  | 'timeline'
  | 'poster'
  | 'sequence'
  | 'mindmap'
  | 'state'
  | 'class'
  | 'er'
  | 'gantt'
  | 'c4'
  | 'sankey'
  | 'kanban'
  | 'requirement'
  | 'gitgraph'
  | 'packet'
  | 'block'
  | 'architecture'
  | 'pie'
  | 'xychart'
  | 'quadrant'
  | 'radar'
  | 'journey'
  | 'tree'
  | 'plan'
  | 'avl'
  | 'rbtree'
  | 'btree'
  | 'radix'
  | 'segtree'
  | 'heap'
  | 'array'
  | 'linkedlist'
  | 'memory'
  | 'page'
  | 'topology';

/** The two input formats Triton accepts. */
export type InputFormat = 'mermaid' | 'yaml';
