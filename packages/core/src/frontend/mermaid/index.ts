/**
 * @file frontend/mermaid/index.ts — Mermaid front-end entry point.
 *
 * Implements the dual front-end architecture described in §15 (15-frontend.tex):
 *
 *   Mermaid DSL text
 *     → detect diagram type
 *     → dispatch to grammar parser          (Path A)
 *     → Domain IR (FlowDocument / SequenceDocument / …)
 *     → buildXxxScene + themeOverride
 *     → Scene IR
 *     → sceneToSvg / svgToPng              (existing kernel, unchanged)
 *
 * Tier-0 coverage:
 *   ✅  flowchart / graph     (full parser, FlowDocument, dark-flow gallery)
 *   ✅  sequenceDiagram       (full parser, SequenceDocument, bytebytego-sequence gallery)
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

import {
  buildSequenceScene,
  renderSequenceDocument,
  resolveSequenceTheme,
} from '../../grammars/sequence/index.js';
import type { SequenceDocument } from '../../grammars/sequence/index.js';

import { preprocessMermaid } from './utils.js';
import { parseFlowchartInternal } from './flowchart.js';
import { parseSequenceInternal } from './sequence.js';

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
 * The `doc` field holds the grammar-specific Domain IR document — either a
 * FlowDocument (flowchart) or a SequenceDocument (sequence).
 * Narrow by `kind` to get the concrete type.
 */
export interface MermaidParseResult {
  kind: DiagramKind;
  /**
   * The grammar-specific Domain IR document.
   * - kind === 'flowchart' → FlowDocument
   * - kind === 'sequence'  → SequenceDocument
   */
  doc: FlowDocument | SequenceDocument;
  /**
   * Non-fatal parse warnings — skipped lines, deferred shapes/features,
   * degradation notices. Always present (empty array when clean).
   */
  warnings: string[];
}

/**
 * Parse Mermaid text and return the appropriate grammar's Domain IR.
 *
 * Dispatches to:
 *   - parseFlowchartInternal  for 'flowchart' / 'graph'
 *   - parseSequenceInternal   for 'sequenceDiagram'
 *
 * All other diagram types throw a clear error.
 *
 * @throws {Error} for unsupported diagram types (gantt, timeline, mindmap, unknown).
 */
export function parseMermaid(text: string): MermaidParseResult {
  const kind = detectDiagramType(text);

  if (kind === 'flowchart') {
    const { doc, warnings } = parseFlowchartInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'sequence') {
    const { doc, warnings } = parseSequenceInternal(text);
    return { kind, doc, warnings };
  }

  const label = kind === 'unknown' ? 'unrecognised diagram type' : `"${kind}"`;
  throw new Error(
    `[Tier 0] ${label} is not yet supported by the Mermaid front-end. ` +
      `"flowchart" / "graph" and "sequenceDiagram" are implemented. ` +
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
  /** The Domain IR document (FlowDocument for flowchart, SequenceDocument for sequence). */
  doc: FlowDocument | SequenceDocument;
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
 * Dispatches:
 *   flowchart  → parseFlowchartInternal → buildFlowScene → renderFlowDocument
 *   sequence   → parseSequenceInternal  → buildSequenceScene → renderSequenceDocument
 *
 * Theme precedence (highest wins):
 *   options.theme > frontmatter `theme:` field > %%{init: {"theme":…}}%% > grammar default
 *
 * Tier-0: flowchart and sequenceDiagram are implemented. Other types throw.
 *
 * @throws {Error} for unsupported diagram types.
 */
export function renderMermaid(
  text: string,
  options: MermaidRenderOptions = {},
): MermaidRenderResult {
  const kind = detectDiagramType(text);

  // ── sequenceDiagram ────────────────────────────────────────────────────
  if (kind === 'sequence') {
    const { doc, warnings, frontmatter } = parseSequenceInternal(text);

    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme;
    const seqTheme = resolveSequenceTheme(themeName);

    const finalDoc: SequenceDocument = {
      ...doc,
      metadata: {
        ...doc.metadata,
        ...(themeName !== undefined ? { theme: themeName } : {}),
      },
    };

    const scene = buildSequenceScene(finalDoc, seqTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';

    const renderResult = renderSequenceDocument(finalDoc, { format }, seqTheme);
    if (renderResult instanceof Promise) {
      throw new Error(
        '[renderMermaid] Async render result is not supported. Use format="svg" or format="png".',
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

  // ── flowchart ──────────────────────────────────────────────────────────
  if (kind === 'flowchart') {
    const { doc, direction, warnings, frontmatter } = parseFlowchartInternal(text);

    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme;
    const baseTheme = resolveFlowTheme(themeName);

    const orientation: FlowTheme['orientation'] =
      direction === 'TD' || direction === 'TB' || direction === 'BT' ? 'TB' : 'LR';
    const themeOverride: FlowTheme = { ...baseTheme, orientation };

    const finalDoc: FlowDocument = {
      ...doc,
      metadata: {
        ...doc.metadata,
        ...(themeName !== undefined ? { theme: themeName } : {}),
      },
    };

    const scene = buildFlowScene(finalDoc, themeOverride);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderFlowDocument(finalDoc, { format }, themeOverride);

    if (renderResult instanceof Promise) {
      throw new Error(
        '[renderMermaid] Async render result is not supported in Tier-0. ' +
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

  // ── Unsupported ────────────────────────────────────────────────────────
  const label = kind === 'unknown' ? 'unrecognised diagram type' : `"${kind}"`;
  throw new Error(
    `[Tier 0] ${label} is not yet supported by the Mermaid front-end. ` +
      `"flowchart" / "graph" and "sequenceDiagram" are implemented.`,
  );
}
