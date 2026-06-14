/**
 * @file frontend/mermaid/index.ts — Mermaid front-end entry point.
 *
 * Implements the dual front-end architecture described in §15 (15-frontend.tex):
 *
 *   Mermaid DSL text
 *     → detect diagram type
 *     → dispatch to grammar parser          (Path A)
 *     → Domain IR (FlowDocument / …)
 *     → buildXxxScene + themeOverride
 *     → Scene IR
 *     → sceneToSvg / svgToPng              (existing kernel, unchanged)
 *
 * Tier-0 Increment-1 coverage:
 *   ✅  flowchart / graph     (full parser, FlowDocument, dark-flow gallery)
 *   🔜  sequenceDiagram       (throws "not yet supported" with clear message)
 *   🔜  gantt                 (throws "not yet supported")
 *   🔜  timeline              (throws "not yet supported")
 *   🔜  mindmap               (throws "not yet supported")
 *
 * PUBLIC EXPORTS (re-exported from packages/core/src/index.ts):
 *   detectDiagramType, parseMermaid, renderMermaid
 *   DiagramKind, MermaidParseResult, MermaidRenderOptions, MermaidRenderResult
 */

import type { Scene } from '../../scene.js';
import { sceneHash as computeSceneHash } from '../../scene.js';

import {
  buildFlowScene,
  renderFlowDocument,
  resolveFlowTheme,
} from '../../grammars/flow/index.js';
import type { FlowDocument, FlowTheme } from '../../grammars/flow/index.js';

import { preprocessMermaid } from './utils.js';
import { parseFlowchartInternal } from './flowchart.js';

// ---------------------------------------------------------------------------
// Diagram kind
// ---------------------------------------------------------------------------

/**
 * The set of diagram types recognised by the Mermaid front-end.
 * Matches the Mermaid 2026 diagram family (see §16 mermaid-compat.tex).
 */
export type DiagramKind =
  | 'flowchart'
  | 'sequence'
  | 'gantt'
  | 'timeline'
  | 'mindmap'
  | 'unknown';

// ---------------------------------------------------------------------------
// detectDiagramType
// ---------------------------------------------------------------------------

/**
 * Detect the Mermaid diagram type from raw text.
 *
 * Algorithm:
 *   1. Strip frontmatter (--- … ---) and directive/comment lines.
 *   2. Scan lines from top; first non-empty, non-comment line is the header.
 *   3. Match the header's leading keyword:
 *        flowchart | graph  → 'flowchart'
 *        sequenceDiagram    → 'sequence'
 *        gantt              → 'gantt'
 *        timeline           → 'timeline'
 *        mindmap            → 'mindmap'
 *        anything else      → 'unknown'
 *
 * Case-insensitive. Handles diagrams with or without frontmatter.
 */
export function detectDiagramType(text: string): DiagramKind {
  const { body } = preprocessMermaid(text);

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(flowchart|graph)\s+/i.test(trimmed)) return 'flowchart';
    if (/^sequencediagram\b/i.test(trimmed)) return 'sequence';
    if (/^gantt\s*$/i.test(trimmed)) return 'gantt';
    if (/^timeline\s*$/i.test(trimmed)) return 'timeline';
    if (/^mindmap\s*$/i.test(trimmed)) return 'mindmap';

    // First non-empty line did not match any known keyword
    return 'unknown';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// parseMermaid
// ---------------------------------------------------------------------------

/**
 * Parse result returned by `parseMermaid`.
 * The `doc` field is currently typed as `FlowDocument`; it will become a
 * grammar-specific union type as sequence / gantt / timeline / mindmap parsers
 * are added in later increments.
 */
export interface MermaidParseResult {
  kind: DiagramKind;
  /**
   * The grammar-specific Domain IR document.
   * Tier-0 Inc-1: always FlowDocument (only flowchart is implemented).
   */
  doc: FlowDocument;
  /**
   * Non-fatal parse warnings — skipped lines, deferred shapes/features,
   * degradation notices. Always present (empty array when clean).
   */
  warnings: string[];
}

/**
 * Parse Mermaid text and return the appropriate grammar's Domain IR.
 *
 * Tier-0 Inc-1: only `flowchart` diagrams are supported. All other diagram
 * types throw a clear error with the unsupported type name, so callers can
 * implement graceful fallback or surfacing to the user.
 *
 * @throws {Error} for any diagram type other than 'flowchart' (clearly labeled
 *                 "Tier 0 Inc 1 — not yet supported").
 */
export function parseMermaid(text: string): MermaidParseResult {
  const kind = detectDiagramType(text);

  if (kind === 'flowchart') {
    const { doc, warnings } = parseFlowchartInternal(text);
    return { kind, doc, warnings };
  }

  const label = kind === 'unknown' ? 'unrecognised diagram type' : `"${kind}"`;
  throw new Error(
    `[Tier 0 Inc 1] ${label} is not yet supported by the Mermaid front-end. ` +
      `Only "flowchart" / "graph" is implemented in Tier-0 Increment-1. ` +
      `Support for ${kind === 'unknown' ? 'additional diagram types' : `"${kind}"`} is planned for later increments.`,
  );
}

// ---------------------------------------------------------------------------
// renderMermaid
// ---------------------------------------------------------------------------

/** Output format for renderMermaid. */
export type MermaidRenderFormat = 'svg' | 'png';

/** Options for renderMermaid. */
export interface MermaidRenderOptions {
  /**
   * Render format.
   * 'svg'  → sync, returns svg string.
   * 'png'  → sync (resvg backend), returns png bytes.
   * Default: 'svg'.
   */
  format?: MermaidRenderFormat;
  /**
   * Theme name override. Supersedes any theme in frontmatter or %%{init}%%.
   * Must be a registered Flow theme name (e.g. 'default-flow', 'dark-flow').
   */
  theme?: string;
}

/** Result object returned by renderMermaid. */
export interface MermaidRenderResult {
  kind: DiagramKind;
  /** The Domain IR document (FlowDocument for flowchart). */
  doc: FlowDocument;
  /** The Scene IR produced by the layout engine. */
  scene: Scene;
  /** SHA-256 hash of the Scene for determinism checks. */
  sceneHash: string;
  /** Non-fatal parse warnings (skipped lines, deferred features). */
  warnings: string[];
  /** SVG string (present when format='svg'). */
  svg?: string;
  /** PNG bytes (present when format='png'). */
  png?: Uint8Array;
}

/**
 * Parse Mermaid text, lay out the diagram, and serialise to SVG or PNG.
 *
 * Pipeline:
 *   text → preprocessMermaid → parseFlowchartInternal → FlowDocument
 *        → theme resolution (options.theme > frontmatter > directive > default)
 *        → direction → FlowTheme.orientation patch
 *        → buildFlowScene(doc, themeOverride)
 *        → sceneToSvg / svgToPng
 *
 * Theme precedence (highest wins):
 *   options.theme > frontmatter `theme:` field > %%{init: {"theme":…}}%% > 'default-flow'
 *
 * Direction:
 *   LR / RL → FlowTheme.orientation = 'LR' (RL reverse not yet rendered; deferred)
 *   TD / TB / BT → FlowTheme.orientation = 'TB' (deferred in layout; renders as LR)
 *
 * Tier-0 Inc-1: only flowchart is supported. Other types throw as in parseMermaid.
 *
 * @returns MermaidRenderResult (sync for svg + resvg-png; async currently unused).
 * @throws {Error} for unsupported diagram types.
 */
export function renderMermaid(
  text: string,
  options: MermaidRenderOptions = {},
): MermaidRenderResult {
  const kind = detectDiagramType(text);

  if (kind !== 'flowchart') {
    const label = kind === 'unknown' ? 'unrecognised diagram type' : `"${kind}"`;
    throw new Error(
      `[Tier 0 Inc 1] ${label} is not yet supported by the Mermaid front-end. ` +
        `Only "flowchart" / "graph" is implemented in Tier-0 Increment-1.`,
    );
  }

  // ── Parse ──────────────────────────────────────────────────────────────
  const { doc, direction, warnings, frontmatter } = parseFlowchartInternal(text);

  // ── Theme resolution ───────────────────────────────────────────────────
  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const themeName = options.theme ?? fmTheme ?? doc.metadata.theme;
  const baseTheme = resolveFlowTheme(themeName);

  // Apply direction to theme orientation.
  // TD/TB/BT: set orientation='TB'. Layout engine defers TB; renders as LR.
  const orientation: FlowTheme['orientation'] =
    direction === 'TD' || direction === 'TB' || direction === 'BT' ? 'TB' : 'LR';

  const themeOverride: FlowTheme = { ...baseTheme, orientation };

  // Apply resolved theme name to doc metadata for schema compliance
  const finalDoc: FlowDocument = {
    ...doc,
    metadata: {
      ...doc.metadata,
      ...(themeName !== undefined ? { theme: themeName } : {}),
    },
  };

  // ── Build scene ────────────────────────────────────────────────────────
  const scene = buildFlowScene(finalDoc, themeOverride);
  const hash = computeSceneHash(scene);

  // ── Serialise ──────────────────────────────────────────────────────────
  const format = options.format ?? 'svg';
  const renderResult = renderFlowDocument(finalDoc, { format }, themeOverride);

  if (renderResult instanceof Promise) {
    // Currently only Skia backend returns a Promise; we don't use it here.
    // This branch is unreachable for format='svg'|'png' with default resvg backend.
    throw new Error(
      '[renderMermaid] Async render result is not supported in Tier-0 Inc-1. ' +
        'Use format="svg" or format="png" (resvg backend).',
    );
  }

  return {
    kind,
    doc: finalDoc,
    scene,
    sceneHash: hash,
    warnings,
    svg: renderResult.svg,
    png: renderResult.png,
  };
}
