/**
 * @file frontend/mermaid/index.ts — Mermaid front-end entry point.
 *
 * Implements the dual front-end architecture described in §15 (15-frontend.tex):
 *
 *   Mermaid DSL text
 *     → detect diagram type
 *     → dispatch to grammar parser          (Path A)
 *     → Domain IR (FlowDocument / SequenceDocument / IRDocument / TreeDocument / ClassDocument / StateDocument / ErDocument)
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
 *   ✅  stateDiagram          (StateDocument,    pseudostate state-machine layout)
 *   ✅  erDiagram             (ErDocument,       crow's-foot entity layout)
 *   ✅  C4Context / C4Container / C4Component / C4Dynamic / C4Deployment
 *                            (C4Document,       software architecture layout)
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
  buildStateScene,
  renderStateDocument,
  resolveStateTheme,
} from '../../grammars/state/index.js';
import type { StateDocument } from '../../grammars/state/index.js';

import {
  buildErScene,
  renderErDocument,
  resolveErTheme,
} from '../../grammars/er/index.js';
import type { ErDocument } from '../../grammars/er/index.js';

import {
  buildC4Scene,
  renderC4Document,
  resolveC4Theme,
} from '../../grammars/c4/index.js';
import type { C4Document } from '../../grammars/c4/index.js';

import {
  buildJourneyScene,
  renderJourneyDocument,
  resolveJourneyTheme,
} from '../../grammars/journey/index.js';
import type { JourneyDocument } from '../../grammars/journey/index.js';

import {
  buildGitGraphScene,
  renderGitGraphDocument,
  resolveGitGraphTheme,
} from '../../grammars/gitgraph/index.js';
import type { GitGraphDocument } from '../../grammars/gitgraph/index.js';

import {
  buildSankeyScene,
  renderSankeyDocument,
  resolveSankeyTheme,
} from '../../grammars/sankey/index.js';
import type { SankeyDocument } from '../../grammars/sankey/index.js';

import {
  buildChartScene,
  renderChartDocument,
  resolveChartTheme,
} from '../../grammars/chart/index.js';
import type { ChartDocument } from '../../grammars/chart/index.js';

import {
  buildSequenceScene,
  renderSequenceDocument,
  resolveSequenceTheme,
} from '../../grammars/sequence/index.js';
import type { SequenceDocument } from '../../grammars/sequence/index.js';

import {
  renderTreeDocumentRadial,
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
import { parseStateDiagramInternal } from './state.js';
import { parseErDiagramInternal } from './er.js';
import { parseC4DiagramInternal } from './c4.js';
import { parseJourneyDiagramInternal } from './journey.js';
import { parseGitGraphDiagramInternal } from './gitgraph.js';
import { parsePieDiagramInternal } from './pie.js';
import { parseQuadrantDiagramInternal } from './quadrant.js';
import { parseRadarDiagramInternal } from './radar.js';
import { parseXYChartDiagramInternal } from './xychart.js';
import { parseSankeyDiagramInternal } from './sankey.js';

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
  | 'stateDiagram'
  | 'erDiagram'
  | 'c4Context'
  | 'c4Container'
  | 'c4Component'
  | 'c4Dynamic'
  | 'c4Deployment'
  | 'pie'
  | 'xychart'
  | 'quadrantChart'
  | 'radar'
  | 'journey'
  | 'gitGraph'
  | 'sankey'
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
    if (/^statediagram(?:-v2)?\b/i.test(trimmed)) return 'stateDiagram';
    if (/^erdiagram\b/i.test(trimmed)) return 'erDiagram';
    if (/^c4context\b/i.test(trimmed)) return 'c4Context';
    if (/^c4container\b/i.test(trimmed)) return 'c4Container';
    if (/^c4component\b/i.test(trimmed)) return 'c4Component';
    if (/^c4dynamic\b/i.test(trimmed)) return 'c4Dynamic';
    if (/^c4deployment\b/i.test(trimmed)) return 'c4Deployment';
    if (/^pie\b/i.test(trimmed)) return 'pie';
    if (/^xychart-beta\b/i.test(trimmed)) return 'xychart';
    if (/^quadrantchart\b/i.test(trimmed)) return 'quadrantChart';
    if (/^radar-beta\b/i.test(trimmed)) return 'radar';
    if (/^radar\b/i.test(trimmed)) return 'radar';
    if (/^journey\s*$/i.test(trimmed)) return 'journey';
    if (/^gitgraph\b/i.test(trimmed)) return 'gitGraph';
    if (/^sankey(?:-beta)?\s*$/i.test(trimmed)) return 'sankey';

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
 *   'mindmap'      → TreeDocument
 *   'classDiagram' → ClassDocument
 *   'stateDiagram' → StateDocument
 *   'erDiagram'    → ErDocument
 *   'c4Context' / 'c4Container' / 'c4Component' / 'c4Dynamic' / 'c4Deployment' → C4Document
 */
export interface MermaidParseResult {
  kind: DiagramKind;
  doc: FlowDocument | SequenceDocument | IRDocument | TreeDocument | ClassDocument | StateDocument | ErDocument | C4Document | ChartDocument | JourneyDocument | GitGraphDocument | SankeyDocument;
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

  if (kind === 'stateDiagram') {
    const { doc, warnings } = parseStateDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'erDiagram') {
    const { doc, warnings } = parseErDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'c4Context' || kind === 'c4Container' || kind === 'c4Component' || kind === 'c4Dynamic' || kind === 'c4Deployment') {
    const { doc, warnings } = parseC4DiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'pie') {
    const { doc, warnings } = parsePieDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'xychart') {
    const { doc, warnings } = parseXYChartDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'quadrantChart') {
    const { doc, warnings } = parseQuadrantDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'radar') {
    const { doc, warnings } = parseRadarDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'journey') {
    const { doc, warnings } = parseJourneyDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'gitGraph') {
    const { doc, warnings } = parseGitGraphDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'sankey') {
    const { doc, warnings } = parseSankeyDiagramInternal(text);
    return { kind, doc, warnings };
  }

  throw new Error(
    `[Tier 0] Unrecognised diagram type. The Mermaid front-end supports: ` +
      `flowchart, graph, sequenceDiagram, gantt, timeline, mindmap, classDiagram, stateDiagram, erDiagram, ` +
      `c4Context, c4Container, c4Component, c4Dynamic, c4Deployment, pie, xychart-beta, quadrantChart, radar, radar-beta, journey, gitGraph, sankey-beta.`,
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
  doc: FlowDocument | SequenceDocument | IRDocument | TreeDocument | ClassDocument | StateDocument | ErDocument | C4Document | ChartDocument | JourneyDocument | GitGraphDocument | SankeyDocument;
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
 * Mermaid front-end coverage includes flowchart, sequenceDiagram, gantt, timeline, mindmap, classDiagram, stateDiagram, erDiagram, and the C4 family.
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
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'consulting';

    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: themeName, layout: 'gantt' },
    };

    const format = options.format ?? 'svg';
    const renderResult = renderDocument(finalDoc, { format, theme: themeName, layout: 'gantt' });
    const scene = buildScene(finalDoc, { theme: themeName, layout: 'gantt' });
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
    const { doc, warnings } = parseMindmapInternal(text);

    const finalDoc: TreeDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: 'mindmap-radial' },
    };

    const format       = options.format ?? 'svg';
    const renderResult = renderTreeDocumentRadial(finalDoc, { format });

    return {
      kind,
      doc:       finalDoc,
      scene:     renderResult.scene,
      sceneHash: renderResult.sceneHash,
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

  // ── stateDiagram ───────────────────────────────────────────────────────
  if (kind === 'stateDiagram') {
    const { doc, warnings, frontmatter } = parseStateDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-state';
    const stateTheme = resolveStateTheme(themeName);
    const finalDoc: StateDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildStateScene(finalDoc, stateTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderStateDocument(finalDoc, { format }, stateTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for stateDiagram.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── erDiagram ──────────────────────────────────────────────────────────
  if (kind === 'erDiagram') {
    const { doc, warnings, frontmatter } = parseErDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-er';
    const erTheme = resolveErTheme(themeName);
    const finalDoc: ErDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildErScene(finalDoc, erTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderErDocument(finalDoc, { format }, erTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for erDiagram.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'c4Context' || kind === 'c4Container' || kind === 'c4Component' || kind === 'c4Dynamic' || kind === 'c4Deployment') {
    const { doc, warnings, frontmatter } = parseC4DiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-c4';
    const c4Theme = resolveC4Theme(themeName);
    const finalDoc: C4Document = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildC4Scene(finalDoc, c4Theme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderC4Document(finalDoc, { format }, c4Theme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for C4 diagrams.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'pie') {
    const { doc, warnings, frontmatter } = parsePieDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? 'default-chart';
    const chartTheme = resolveChartTheme(themeName);
    const finalDoc: ChartDocument = doc;
    const scene = buildChartScene(finalDoc, chartTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderChartDocument(finalDoc, { format }, chartTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for pie.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'xychart') {
    const { doc, warnings, frontmatter } = parseXYChartDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? 'default-chart';
    const chartTheme = resolveChartTheme(themeName);
    const finalDoc: ChartDocument = doc;
    const scene = buildChartScene(finalDoc, chartTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderChartDocument(finalDoc, { format }, chartTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for xychart.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'quadrantChart') {
    const { doc, warnings, frontmatter } = parseQuadrantDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? 'default-chart';
    const chartTheme = resolveChartTheme(themeName);
    const finalDoc: ChartDocument = doc;
    const scene = buildChartScene(finalDoc, chartTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderChartDocument(finalDoc, { format }, chartTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for quadrantChart.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'radar') {
    const { doc, warnings, frontmatter } = parseRadarDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? 'default-chart';
    const chartTheme = resolveChartTheme(themeName);
    const finalDoc: ChartDocument = doc;
    const scene = buildChartScene(finalDoc, chartTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderChartDocument(finalDoc, { format }, chartTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for radar.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'journey') {
    const { doc, warnings, frontmatter } = parseJourneyDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-journey';
    const journeyTheme = resolveJourneyTheme(themeName);
    const finalDoc: JourneyDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildJourneyScene(finalDoc, journeyTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderJourneyDocument(finalDoc, { format }, journeyTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for journey.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'gitGraph') {
    const { doc, warnings, frontmatter } = parseGitGraphDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-gitgraph';
    const gitGraphTheme = resolveGitGraphTheme(themeName);
    const finalDoc: GitGraphDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildGitGraphScene(finalDoc, gitGraphTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderGitGraphDocument(finalDoc, { format }, gitGraphTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for gitGraph.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  if (kind === 'sankey') {
    const { doc, warnings, frontmatter } = parseSankeyDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-sankey';
    const sankeyTheme = resolveSankeyTheme(themeName);
    const finalDoc: SankeyDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildSankeyScene(finalDoc, sankeyTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderSankeyDocument(finalDoc, { format }, sankeyTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for sankey.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── Unknown ────────────────────────────────────────────────────────────
  throw new Error(
    `[Tier 0] Unrecognised diagram type. The Mermaid front-end supports: ` +
      `flowchart, graph, sequenceDiagram, gantt, timeline, mindmap, classDiagram, stateDiagram, erDiagram, ` +
      `c4Context, c4Container, c4Component, c4Dynamic, c4Deployment, pie, xychart-beta, quadrantChart, radar, radar-beta, journey, gitGraph, sankey-beta.`,
  );
}
