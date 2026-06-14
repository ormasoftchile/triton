/**
 * @file frontend/mermaid/index.ts — Mermaid front-end entry point.
 *
 * Implements the dual front-end architecture described in §15 (15-frontend.tex):
 *
 *   Mermaid DSL text
 *     → detect diagram type
 *     → dispatch to grammar parser          (Path A)
 *     → Domain IR (FlowDocument / SequenceDocument / IRDocument / TreeDocument / ClassDocument)
 *     → buildXxxScene + themeOverride
 *     → Scene IR
 *     → sceneToSvg / svgToPng              (existing kernel, unchanged)
 *
 * Tier-0 / Tier-1 coverage:
 *   ✅  flowchart / graph     (FlowDocument,     dark-flow gallery)
 *   ✅  sequenceDiagram       (SequenceDocument, bytebytego-sequence gallery)
 *   ✅  gantt                 (IRDocument,       roadmap theme)
 *   ✅  timeline              (IRDocument,       consulting theme, vertical-spine)
 *   ✅  mindmap               (TreeDocument,     dark-tree theme)
 *   ✅  classDiagram          (ClassDocument,    UML compartment layout)
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
  buildClassScene,
  renderClassDocument,
  resolveClassTheme,
} from '../../grammars/class/index.js';
import type { ClassDocument } from '../../grammars/class/index.js';

import {
  buildSequenceScene,
  renderSequenceDocument,
  resolveSequenceTheme,
} from '../../grammars/sequence/index.js';
import type { SequenceDocument } from '../../grammars/sequence/index.js';

import {
  buildTreeScene,
  renderTreeDocument,
  resolveTreeTheme,
} from '../../grammars/tree/index.js';
import type { TreeDocument } from '../../grammars/tree/index.js';

import { buildScene, renderDocument } from '../../render/index.js';
import type { IRDocument } from '../../types.js';

import { preprocessMermaid } from './utils.js';
import { parseFlowchartInternal } from './flowchart.js';
import { parseSequenceInternal } from './sequence.js';
import { parseGanttInternal } from './gantt.js';
import { parseTimelineInternal } from './timeline.js';
import { parseMindmapInternal } from './mindmap.js';
import { parseClassDiagramInternal } from './class.js';

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
  | 'classDiagram'
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
 *   3. Match the header's leading keyword (case-insensitive).
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
    if (/^classdiagram\b/i.test(trimmed)) return 'classDiagram';

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
 * Narrow by `kind` to get the concrete doc type:
 *   'flowchart' → FlowDocument
 *   'sequence'  → SequenceDocument
 *   'gantt'     → IRDocument
 *   'timeline'  → IRDocument
 *   'mindmap'   → TreeDocument
 *   'classDiagram' → ClassDocument
 */
export interface MermaidParseResult {
  kind: DiagramKind;
  doc: FlowDocument | SequenceDocument | IRDocument | TreeDocument | ClassDocument;
  /**
   * Non-fatal parse warnings — skipped lines, deferred shapes/features,
   * degradation notices. Always present (empty array when clean).
   */
  warnings: string[];
}

/**
 * Parse Mermaid text and return the appropriate grammar's Domain IR.
 *
 * Dispatches to the Mermaid grammar parsers. All supported types are handled.
 * `unknown` diagram types throw with a clear error.
 *
 * @throws {Error} for unrecognised diagram type.
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

  if (kind === 'gantt') {
    const { doc, warnings } = parseGanttInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'timeline') {
    const { doc, warnings } = parseTimelineInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'mindmap') {
    const { doc, warnings } = parseMindmapInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'classDiagram') {
    const { doc, warnings } = parseClassDiagramInternal(text);
    return { kind, doc, warnings };
  }

  throw new Error(
    `[Tier 0] Unrecognised diagram type. The Mermaid front-end supports: ` +
      `flowchart, graph, sequenceDiagram, gantt, timeline, mindmap, classDiagram.`,
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
   */
  theme?: string;
}

/** Result object returned by renderMermaid. */
export interface MermaidRenderResult {
  kind: DiagramKind;
  /** The Domain IR document (grammar-specific). */
  doc: FlowDocument | SequenceDocument | IRDocument | TreeDocument | ClassDocument;
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
 * Theme precedence (highest wins):
 *   options.theme > frontmatter `theme:` field > %%{init: {"theme":…}}%% > grammar default
 *
 * Mermaid front-end coverage includes flowchart, sequenceDiagram, gantt, timeline, mindmap, and classDiagram.
 *
 * @throws {Error} for unrecognised diagram types.
 */
export function renderMermaid(
  text: string,
  options: MermaidRenderOptions = {},
): MermaidRenderResult {
  const kind = detectDiagramType(text);

  // ── sequenceDiagram ────────────────────────────────────────────────────
  if (kind === 'sequence') {
    const { doc, warnings, frontmatter } = parseSequenceInternal(text);

    const fmTheme  = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme;
    const seqTheme  = resolveSequenceTheme(themeName);

    const finalDoc: SequenceDocument = {
      ...doc,
      metadata: {
        ...doc.metadata,
        ...(themeName !== undefined ? { theme: themeName } : {}),
      },
    };

    const scene  = buildSequenceScene(finalDoc, seqTheme);
    const hash   = computeSceneHash(scene);
    const format = options.format ?? 'svg';

    const renderResult = renderSequenceDocument(finalDoc, { format }, seqTheme);
    if (renderResult instanceof Promise) {
      throw new Error('[renderMermaid] Async render result is not supported.');
    }

    return {
      kind,
      doc:       finalDoc,
      scene,
      sceneHash: hash,
      warnings,
      svg:       renderResult.svg,
      png:       renderResult.png,
    };
  }

  // ── flowchart ──────────────────────────────────────────────────────────
  if (kind === 'flowchart') {
    const { doc, direction, warnings, frontmatter } = parseFlowchartInternal(text);

    const fmTheme   = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
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

    const scene  = buildFlowScene(finalDoc, themeOverride);
    const hash   = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderFlowDocument(finalDoc, { format }, themeOverride);

    if (renderResult instanceof Promise) {
      throw new Error('[renderMermaid] Async render result is not supported.');
    }

    return {
      kind,
      doc:       finalDoc,
      scene,
      sceneHash: hash,
      warnings,
      svg:       renderResult.svg,
      png:       renderResult.png,
    };
  }

  // ── gantt ──────────────────────────────────────────────────────────────
  if (kind === 'gantt') {
    const { doc, warnings, frontmatter } = parseGanttInternal(text);

    const fmTheme   = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'roadmap';

    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: themeName },
    };

    const format = options.format ?? 'svg';
    const renderResult = renderDocument(finalDoc, { format, theme: themeName, layout: finalDoc.metadata.layout });
    const scene = buildScene(finalDoc, { theme: themeName, layout: finalDoc.metadata.layout });
    const hash  = computeSceneHash(scene);

    return {
      kind,
      doc:       finalDoc,
      scene,
      sceneHash: hash,
      warnings,
      svg:       renderResult.svg,
      png:       renderResult.png,
    };
  }

  // ── timeline ───────────────────────────────────────────────────────────
  if (kind === 'timeline') {
    const { doc, warnings, frontmatter } = parseTimelineInternal(text);

    const fmTheme   = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'consulting';

    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: themeName },
    };

    const format = options.format ?? 'svg';
    const renderResult = renderDocument(finalDoc, { format, theme: themeName, layout: finalDoc.metadata.layout, spineSpacing: 'even' });
    const scene = buildScene(finalDoc, { theme: themeName, layout: finalDoc.metadata.layout, spineSpacing: 'even' });
    const hash  = computeSceneHash(scene);

    return {
      kind,
      doc:       finalDoc,
      scene,
      sceneHash: hash,
      warnings,
      svg:       renderResult.svg,
      png:       renderResult.png,
    };
  }

  // ── mindmap ────────────────────────────────────────────────────────────
  if (kind === 'mindmap') {
    const { doc, warnings, frontmatter } = parseMindmapInternal(text);

    const fmTheme   = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'dark-tree';
    const treeTheme = resolveTreeTheme(themeName);

    const finalDoc: TreeDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: themeName },
    };

    const format = options.format ?? 'svg';
    const renderResult = renderTreeDocument(finalDoc, { format }, treeTheme);
    if (renderResult instanceof Promise) {
      throw new Error('[renderMermaid] Async render result is not supported for mindmap.');
    }
    const scene = buildTreeScene(finalDoc, treeTheme);
    const hash  = computeSceneHash(scene);

    return {
      kind,
      doc:       finalDoc,
      scene,
      sceneHash: hash,
      warnings,
      svg:       renderResult.svg,
      png:       renderResult.png,
    };
  }

  // ── classDiagram ───────────────────────────────────────────────────────
  if (kind === 'classDiagram') {
    const { doc, warnings, frontmatter } = parseClassDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-class';
    const classTheme = resolveClassTheme(themeName);
    const finalDoc: ClassDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildClassScene(finalDoc, classTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderClassDocument(finalDoc, { format }, classTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for classDiagram.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── Unknown ────────────────────────────────────────────────────────────
  throw new Error(
    `[Tier 0] Unrecognised diagram type. The Mermaid front-end supports: ` +
      `flowchart, graph, sequenceDiagram, gantt, timeline, mindmap, classDiagram.`,
  );
}
