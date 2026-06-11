/**
 * @file types.ts — Public API types for Timeline Compiler.
 *
 * These types mirror the IR contract defined in design/sections/04-ir.tex and the
 * canonical field names in .squad/decisions.md.  They are the single authoritative
 * TypeScript surface for all consumers (CLI, MCP server, VS Code extension).
 *
 * TODO (Phase 1 / Mark): flesh out nested union types, discriminated unions for
 * DateRange, and Zod-inferred types once the schema is tightened in schema.ts.
 */

// ---------------------------------------------------------------------------
// Primitive aliases
// ---------------------------------------------------------------------------

/** Kebab-case document-unique identifier: ^[a-z][a-z0-9-]*$ */
export type ID = string;

/**
 * Temporal value string.  One of:
 *   ISO date (2026-06-09), ISO datetime (2026-06-09T14:00),
 *   Year-month (2026-06), Year only (2026), Quarter (2026-Q2),
 *   Half (2026-H1), Fiscal quarter (FY26-Q2),
 *   Relative (+3m, -2w), Symbolic (now),
 *   Uncertain (tbd, ongoing, unknown, ~2026-Q3)
 */
export type IRDate = string;

/** Visual / presentation status (not a project-management workflow state). */
export type Status =
  | 'planned'
  | 'in-progress'
  | 'done'
  | 'at-risk'
  | 'blocked'
  | 'cancelled'
  | 'tentative';

/** Granularity of the time axis. */
export type AxisUnit = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year';

// ---------------------------------------------------------------------------
// Structural sub-types
// ---------------------------------------------------------------------------

/**
 * A single titled content block within an entry.
 *
 * Used to express multiple named sub-sections inside one entry (e.g.
 * "Subject 1" + body paragraph, then "Subject 2" + body paragraph).
 *
 * - `heading` is optional: a short sub-section title (plain text, no markup).
 * - `text` is required: the paragraph body for this block (non-empty).
 *
 * Rendering precedence vs `description`:
 *   If `blocks` is present and non-empty, renderers SHOULD use `blocks` and
 *   ignore `description`.  If `blocks` is absent or empty, renderers fall back
 *   to `description`.  Both fields MAY coexist in a document (no hard schema
 *   invariant), but authors SHOULD NOT set both — prefer `blocks` for
 *   structured content and `description` for simple single-paragraph entries.
 */
export interface ContentBlock {
  /** Optional sub-section title (e.g. "Subject 1", "Background"). */
  heading?: string;
  /** Paragraph body for this block.  Must be non-empty. */
  text: string;
}

export interface TimeRange {
  start: IRDate;
  end?: IRDate;
}

/**
 * Optional brand/document logo to be placed in the rendered output header.
 *
 * The IR is rendering-agnostic: it names the asset and hints at placement/size.
 * HOW the asset is loaded, encoded, or embedded is entirely the renderer's concern.
 */
export interface LogoSpec {
  /**
   * Asset reference.  Either a filesystem path (relative or absolute) to a
   * PNG, JPEG, or SVG file, OR a `data:` URI containing the image inline.
   *
   * The IR does NOT validate that the path exists or that the data URI is
   * well-formed — that is a rendering/runtime responsibility.  An empty string
   * is structurally invalid (schema enforces min-length 1).
   */
  src: string;
  /**
   * Desired placement in the document header.
   * Omitting leaves the exact default position to the renderer.
   */
  position?: 'top-left' | 'top-right';
  /**
   * Intrinsic-width hint, in points (pt).  Must be positive.
   * If both `width` and `height` are omitted the renderer uses its own defaults
   * (e.g. intrinsic image dimensions or theme-defined logo size).
   */
  width?: number;
  /**
   * Intrinsic-height hint, in points (pt).  Must be positive.
   * If both `width` and `height` are omitted the renderer uses its own defaults.
   */
  height?: number;
}

export interface Metadata {
  title: string;
  subtitle?: string;
  author?: string;
  created?: IRDate;
  updated?: IRDate;
  time_range: TimeRange;
  axis_unit?: AxisUnit;
  /** Theme identifier resolved by the renderer. */
  theme?: string;
  /** BCP-47 locale for date formatting. */
  locale?: string;
  /** Reference date for `now` and relative dates.  Renderers must NOT use system clock. */
  today?: IRDate;
  /** Calendar month (1–12) on which the fiscal year begins. */
  fiscal_year_start?: number;
  description?: string;
  /**
   * Optional brand or document logo.  When present, the renderer places the
   * image in the document header according to `position` (defaulting to its
   * own placement heuristic when omitted).
   */
  logo?: LogoSpec;
}

export interface Track {
  id: ID;
  label: string;
  description?: string;
  color?: string;
  group?: ID;
  index?: number;
  collapsed?: boolean;
}

export interface Group {
  id: ID;
  label: string;
  description?: string;
  parent?: ID;
  children?: ID[];
  members?: ID[];
  color?: string;
}

export interface Activity {
  id: ID;
  label: string;
  track: ID;
  /** Mutually exclusive with span. */
  start?: IRDate;
  /** Mutually exclusive with span.  Omitting is equivalent to `ongoing`. */
  end?: IRDate;
  /** Single-unit shorthand — mutually exclusive with start/end. */
  span?: IRDate;
  status?: Status;
  /** Completion fraction in [0, 1]. */
  progress?: number;
  category?: string;
  /** A named icon from the built-in icon registry (e.g. "star", "flag"). */
  icon?: string;
  /** Explicit fill/accent color override.  Any valid CSS color string (e.g. "#FF8800", "coral"). */
  color?: string;
  description?: string;
  /**
   * Structured multi-block content.  When present and non-empty, renderers
   * SHOULD use `blocks` in preference to `description`.
   * @see ContentBlock for the description-vs-blocks rendering precedence.
   */
  blocks?: ContentBlock[];
  group?: ID;
  url?: string;
  tags?: string[];
  /** TODO (Phase 1): typed extension metadata */
  metadata?: Record<string, unknown>;
}

export interface Milestone {
  id: ID;
  label: string;
  date: IRDate;
  track?: ID;
  status?: Status;
  category?: string;
  icon?: string;
  color?: string;
  description?: string;
  /**
   * Structured multi-block content.  When present and non-empty, renderers
   * SHOULD use `blocks` in preference to `description`.
   * @see ContentBlock for the description-vs-blocks rendering precedence.
   */
  blocks?: ContentBlock[];
  group?: ID;
  url?: string;
  tags?: string[];
  /** TODO (Phase 1): typed extension metadata */
  metadata?: Record<string, unknown>;
}

export type AnnotationType =
  | 'today-marker'
  | 'callout'
  | 'bracket'
  | 'period'
  | 'note'
  | 'connector';

export interface Annotation {
  type: AnnotationType;
  id?: ID;
  target?: ID;
  targets?: ID[];
  date?: IRDate;
  start?: IRDate;
  end?: IRDate;
  text?: string;
  label?: string;
  position?: 'above' | 'below' | 'left' | 'right';
  style?: string;
}

export interface Section {
  id: ID;
  label: string;
  time_range?: TimeRange;
  tracks?: ID[];
  description?: string;
  page_break?: boolean;
}

export interface LegendEntry {
  key: string;
  label: string;
  description?: string;
  category?: boolean;
}

export interface Legend {
  show?: boolean;
  position?: string;
  title?: string;
  entries?: LegendEntry[];
}

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

/** Top-level Timeline IR document (§4, design/sections/04-ir.tex). */
export interface IRDocument {
  version: string;
  metadata: Metadata;
  tracks: Track[];
  groups?: Group[];
  activities: Activity[];
  milestones?: Milestone[];
  annotations?: Annotation[];
  sections?: Section[];
  legend?: Legend;
}

// ---------------------------------------------------------------------------
// Diagnostics & validation
// ---------------------------------------------------------------------------

export interface DiagnosticRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

/**
 * A single diagnostic message.  `path` is a JSON Pointer (RFC 6901) into the IR
 * document, e.g. `/activities/0/track`.  `code` is a machine-readable error code
 * matching the invariant names from §4 (e.g. `UNIQUE_IDS`, `SPAN_START_CONFLICT`).
 */
export interface Diagnostic {
  path: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  range?: DiagnosticRange;
}

export interface ValidationResult {
  valid: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export type RenderFormat = 'svg' | 'png';

export interface RenderOptions {
  theme?: string;
  format: RenderFormat;
  /** Output tier (1 = basic, 2 = full-fidelity, 3 = premium). */
  tier?: number;
  /**
   * Layout family.  Defaults to 'horizontal'.
   *   'horizontal'     — time axis left→right, track rows, T2/T4/T6 targets.
   *   'vertical-spine' — central vertical spine, alternating L/R entries, T1/T3/T5 targets.
   */
  layout?: 'horizontal' | 'vertical-spine';
  /**
   * Rendering backend.  Defaults to 'svg'.
   *   'svg'  — deterministic SVG → resvg PNG (default; SVG golden stays byte-identical).
   *   'skia' — canvaskit-wasm Skia raster backend; enables art effects (glow, shadow,
   *             gradient/cloud background).  Async: renderDocument returns Promise when
   *             backend='skia' and format='png'.
   *
   * Cross-backend pixel identity is NOT promised.  Skia determinism is per
   * pinned canvaskit-wasm version.
   */
  backend?: 'svg' | 'skia';
  /**
   * Override the theme's `spineSpacing` token for vertical-spine renders.
   *   'time' — time-proportional placement with automatic gap-compression guard.
   *   'even' — uniform placement regardless of time gaps (infographic style).
   * Has no effect on horizontal layout.  When set, takes precedence over the
   * theme's own `spineSpacing` declaration.
   */
  spineSpacing?: 'time' | 'even';
}

export interface RenderResult {
  format: RenderFormat;
  /** SVG output as a string (always populated for format:'svg'; also populated for format:'png' as the intermediate). */
  svg?: string;
  /** PNG output as bytes (populated for format:'png'). */
  png?: Uint8Array;
  /** Deterministic hash of the rendered scene — changes iff visual output changes. */
  sceneHash: string;
}

// ---------------------------------------------------------------------------
// Incremental / live-preview session
// ---------------------------------------------------------------------------

export interface IncrementalResult {
  svg: string;
  diagnostics: Diagnostic[];
  /** Whether the SVG changed since the last update() call. */
  changed: boolean;
}

/**
 * Live-preview session for editor integrations.
 *
 * TRANSPARENCY CONTRACT: consumers (CLI, MCP, VS Code extension) import this
 * interface and call it IN-PROCESS — no process spawning.  SVG is a string.
 * Diagnostics map 1:1 to vscode.Diagnostic objects.
 */
export interface Session {
  update(text: string): IncrementalResult;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export interface ThemeInfo {
  id: string;
  title: string;
  /** Minimum tier required to use this theme. */
  tier: number;
}
