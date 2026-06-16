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
 * Tier-0 / Tier-1 / Tier-3 coverage:
 *   ✅  flowchart / graph     (FlowDocument,          dark-flow gallery)
 *   ✅  sequenceDiagram       (SequenceDocument,      bytebytego-sequence gallery)
 *   ✅  gantt                 (IRDocument,            roadmap theme)
 *   ✅  timeline              (IRDocument,            consulting theme, vertical-spine)
 *   ✅  mindmap               (TreeDocument,          dark-tree theme)
 *   ✅  classDiagram          (ClassDocument,         UML compartment layout)
 *   ✅  stateDiagram          (StateDocument,         pseudostate state-machine layout)
 *   ✅  erDiagram             (ErDocument,            crow's-foot entity layout)
 *   ✅  C4Context / C4Container / C4Component / C4Dynamic / C4Deployment
 *                            (C4Document,            software architecture layout)
 *   ✅  requirementDiagram    (RequirementDocument,   compartment box + «kind» edge pills)
 *   ✅  kanban                (KanbanDocument,        column board with stacked cards)
 *   ✅  poster                (PosterDocument,        §17.2 multi-diagram composition — SUPERSET-ONLY)
 *
 * PUBLIC EXPORTS (re-exported from packages/core/src/index.ts):
 *   detectDiagramType, parseMermaid, renderMermaid
 *   DiagramKind, MermaidParseResult, MermaidRenderOptions, MermaidRenderResult
 */

import type { Scene, ScenePrimitive, PathPrimitive } from '../../scene.js';
import { sceneHash as computeSceneHash } from '../../scene.js';
import { sceneToSvg } from '../../render/svg.js';
import { svgToPng }   from '../../render/png.js';

import { CONTRACT_THEMES, isContractTheme, resolveContractTheme } from '../../theme-contract/index.js';
import type { Density } from '../../theme-contract/index.js';
import { bindTimelineTheme } from '../../themes/index.js';
import { buildScene, renderDocument } from '../../render/index.js';
import { bindFlowTheme }         from '../../grammars/flow/contract-binding.js';
import { bindSequenceTheme }     from '../../grammars/sequence/contract-binding.js';
import { bindChartTheme }        from '../../grammars/chart/contract-binding.js';
import { bindClassTheme }        from '../../grammars/class/contract-binding.js';
import { bindStateTheme }        from '../../grammars/state/contract-binding.js';
import { bindErTheme }           from '../../grammars/er/contract-binding.js';
import { bindC4Theme }           from '../../grammars/c4/contract-binding.js';
import { bindSankeyTheme }       from '../../grammars/sankey/contract-binding.js';
import { bindGitGraphTheme }     from '../../grammars/gitgraph/contract-binding.js';
import { bindJourneyTheme }      from '../../grammars/journey/contract-binding.js';
import { bindKanbanTheme }       from '../../grammars/kanban/contract-binding.js';
import { bindMindmapTheme }      from '../../grammars/tree/contract-binding.js';
import { bindPacketTheme }       from '../../grammars/packet/contract-binding.js';
import { bindRequirementTheme }  from '../../grammars/requirement/contract-binding.js';
import { bindBlockTheme }        from '../../grammars/block/contract-binding.js';
import { bindArchitectureTheme } from '../../grammars/architecture/contract-binding.js';

import { layoutCompositionFull } from '../../composition/index.js';
import type { Cell, SceneCellContent, CellTransform } from '../../composition/index.js';
import type { CompositionTheme } from '../../composition/theme.js';

import { parsePosterInternal, buildCompositionThemeFor } from './poster.js';
import type { PosterDocument, PosterLink, TraceRecord } from './poster.js';
import type { NodeAnchor, NodeAnchorRegistry } from '../../anchors.js';

// Geometry-quality kernel — feedback-driven route selection (during layout) +
// objective defect report (post render).  Pure & deterministic.
import { pickBestRoute, polylineToSegments, computeAestheticScores, detectDefects } from '../../geometry/index.js';
import type {
  Box as KernelBox,
  BoxWithId as KernelBoxWithId,
  Segment as KernelSegment,
  RouteCandidate,
  RouteContext,
  LabeledGeometry,
  LabeledEdge as OverlayEdge,
} from '../../geometry/index.js';

/** Overlay geometry captured by the router for the post-render quality gate. */
interface OverlayGeometry {
  nodes: KernelBoxWithId[];
  labels: KernelBoxWithId[];
  edges: OverlayEdge[];
}

import {
  buildFlowScene,
  buildFlowSceneWithAnchors,
  renderFlowDocument,
  resolveFlowTheme,
} from '../../grammars/flow/index.js';
import type { FlowDocument, FlowTheme } from '../../grammars/flow/index.js';

import {
  buildClassScene,
  buildClassSceneWithAnchors,
  renderClassDocument,
  resolveClassTheme,
} from '../../grammars/class/index.js';
import type { ClassDocument } from '../../grammars/class/index.js';

import {
  buildStateScene,
  buildStateSceneWithAnchors,
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
import { parseRequirementDiagramInternal } from './requirement.js';
import { parseKanbanDiagramInternal } from './kanban.js';

import {
  buildRequirementScene,
  renderRequirementDocument,
  resolveRequirementTheme,
} from '../../grammars/requirement/index.js';
import type { RequirementDocument } from '../../grammars/requirement/index.js';

import {
  buildKanbanScene,
  renderKanbanDocument,
  resolveKanbanTheme,
} from '../../grammars/kanban/index.js';
import type { KanbanDocument } from '../../grammars/kanban/index.js';
import {
  buildBlockScene,
  renderBlockDocument,
  resolveBlockTheme,
} from '../../grammars/block/index.js';
import type { BlockDocument } from '../../grammars/block/index.js';
import {
  buildPacketScene,
  renderPacketDocument,
  resolvePacketTheme,
} from '../../grammars/packet/index.js';
import type { PacketDocument } from '../../grammars/packet/index.js';
import {
  buildArchitectureScene,
  renderArchitectureDocument,
  resolveArchitectureTheme,
} from '../../grammars/architecture/index.js';
import type { ArchitectureDocument } from '../../grammars/architecture/index.js';
import { parseBlockDiagramInternal } from './block.js';
import { parsePacketDiagramInternal } from './packet.js';
import { parseArchitectureDiagramInternal } from './architecture.js';

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
  | 'requirementDiagram'
  | 'kanban'
  | 'block'
  | 'packet'
  | 'architecture'
  | 'poster'
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
    if (/^requirementdiagram\b/i.test(trimmed)) return 'requirementDiagram';
    if (/^kanban\b/i.test(trimmed)) return 'kanban';
    if (/^block-beta\b/i.test(trimmed)) return 'block';
    if (/^packet-beta\b/i.test(trimmed)) return 'packet';
    if (/^architecture(?:-beta)?\b/i.test(trimmed)) return 'architecture';
    if (/^poster\b/i.test(trimmed)) return 'poster';

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
  doc: FlowDocument | SequenceDocument | IRDocument | TreeDocument | ClassDocument | StateDocument | ErDocument | C4Document | ChartDocument | JourneyDocument | GitGraphDocument | SankeyDocument | RequirementDocument | KanbanDocument | BlockDocument | PacketDocument | ArchitectureDocument | PosterDocument;
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

  if (kind === 'requirementDiagram') {
    const { doc, warnings } = parseRequirementDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'kanban') {
    const { doc, warnings } = parseKanbanDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'block') {
    const { doc, warnings } = parseBlockDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'packet') {
    const { doc, warnings } = parsePacketDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'architecture') {
    const { doc, warnings } = parseArchitectureDiagramInternal(text);
    return { kind, doc, warnings };
  }

  if (kind === 'poster') {
    const { doc, warnings } = parsePosterInternal(text);
    return { kind, doc, warnings };
  }

  throw new Error(
    `[Tier 0] Unrecognised diagram type. The Mermaid front-end supports: ` +
      `flowchart, graph, sequenceDiagram, gantt, timeline, mindmap, classDiagram, stateDiagram, erDiagram, ` +
      `c4Context, c4Container, c4Component, c4Dynamic, c4Deployment, pie, xychart-beta, quadrantChart, radar, radar-beta, journey, gitGraph, sankey-beta, requirementDiagram, kanban, block-beta, packet-beta, architecture-beta, architecture, poster.`,
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
  doc: FlowDocument | SequenceDocument | IRDocument | TreeDocument | ClassDocument | StateDocument | ErDocument | C4Document | ChartDocument | JourneyDocument | GitGraphDocument | SankeyDocument | RequirementDocument | KanbanDocument | BlockDocument | PacketDocument | ArchitectureDocument | PosterDocument;
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
  /**
   * For posters with cross-diagram overlay edges: the labelled geometry of the
   * committed overlay (node boxes + label boxes + routed edge segments).  Used
   * by the post-render visual-quality gate to re-verify the final scene with
   * the geometry kernel.  Absent for diagrams without an overlay.
   */
  qualityGeometry?: LabeledGeometry;
}

// ---------------------------------------------------------------------------
// Config-surface helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a value is a Density literal.
 * Called for both frontmatter and directive values.
 */
function isValidDensity(v: unknown): v is Density {
  return v === 'compact' || v === 'normal' || v === 'comfortable';
}

/**
 * Safely extract a `themeOverrides` object from an arbitrary value.
 * Returns undefined for null, arrays, non-objects, and missing values.
 */
function getValidOverrides(v: unknown): Record<string, unknown> | undefined {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Merge two override objects: frontmatter overrides take precedence over
 * directive overrides (shallow merge at the top level; the deep-merge
 * inside resolveContractTheme handles nested structure).
 * Returns undefined if both are undefined or empty.
 */
function mergeConfigOverrides(
  fmOverrides: Record<string, unknown> | undefined,
  directiveOverrides: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!fmOverrides && !directiveOverrides) return undefined;
  if (!directiveOverrides) return fmOverrides;
  if (!fmOverrides) return directiveOverrides;
  // Frontmatter wins over directive for overlapping keys
  return { ...directiveOverrides, ...fmOverrides };
}

/** Valid timeline layout strings accepted via config-surface. */
const VALID_TIMELINE_LAYOUTS = new Set([
  'horizontal', 'vertical-spine', 'serpentine', 'roadmap', 'timeline-columns',
]);

/**
 * Resolve the user-specified layout for a timeline/gantt diagram.
 * Falls back to the provided default if the value is invalid.
 * Emits a warning into the warnings array for unknown values.
 */
function resolveTimelineLayout(
  rawLayout: unknown,
  fallback: 'timeline-columns' | 'gantt',
  warnings: string[],
): 'horizontal' | 'vertical-spine' | 'serpentine' | 'roadmap' | 'gantt' | 'timeline-columns' {
  if (typeof rawLayout !== 'string' || !rawLayout) return fallback;
  if (VALID_TIMELINE_LAYOUTS.has(rawLayout)) {
    return rawLayout as 'horizontal' | 'vertical-spine' | 'serpentine' | 'roadmap' | 'timeline-columns';
  }
  if (rawLayout === 'gantt') return 'gantt';
  warnings.push(
    `[config-surface] Unknown layout "${rawLayout}" — using "${fallback}". ` +
    `Valid timeline layouts: timeline-columns, vertical-spine, serpentine, roadmap, horizontal.`,
  );
  return fallback;
}

/**
 * Parse Mermaid text, lay out the diagram, and serialise to SVG or PNG.
 *
 * Theme precedence (highest wins):
 *   options.theme > frontmatter `theme:` field > %%{init: {"theme":…}}%% > grammar default
 *
 * Config-surface keys (frontmatter or %%{init}%%, frontmatter wins):
 *   layout:        layout variant for multi-layout components (e.g. timeline)
 *   density:       'compact' | 'normal' | 'comfortable' — overrides contract theme density
 *   themeOverrides: object of token patches applied onto the resolved ThemeContract
 *   spineSpacing:  'even' | 'time' — vertical-spine spacing mode for timeline diagrams;
 *                  'even' prevents height explosion over long time spans (multi-decade data)
 *
 * Mermaid front-end coverage includes flowchart, sequenceDiagram, gantt, timeline, mindmap, classDiagram, stateDiagram, erDiagram, and the C4 family.
 * Superset-only: poster — §17.2 multi-diagram composition.
 *
 * @throws {Error} for unrecognised diagram types.
 */
export function renderMermaid(
  text: string,
  options: MermaidRenderOptions = {},
): MermaidRenderResult {
  const kind = detectDiagramType(text);

  // ── poster (SUPERSET-ONLY §17.2) ─────────────────────────────────────────
  if (kind === 'poster') {
    return renderPoster(text, options);
  }

  // Extract directive-level config (%%{init}%%) once.
  // Frontmatter fields come from each grammar's parser return value.
  const {
    directiveLayout,
    directiveDensity,
    directiveThemeOverrides,
  } = preprocessMermaid(text);

  // ── sequenceDiagram ────────────────────────────────────────────────────
  if (kind === 'sequence') {
    const { doc, warnings, frontmatter } = parseSequenceInternal(text);

    const fmTheme  = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme;

    // Config-surface: density + overrides
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const fmOverrides = getValidOverrides(frontmatter['themeOverrides']);
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(fmOverrides, directiveThemeOverrides);

    // Contract-binding path: derive SequenceTheme from Tier-2 contract if applicable.
    const seqTheme = isContractTheme(themeName)
      ? bindSequenceTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveSequenceTheme(themeName);

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

    // Config-surface: density + overrides (layout ignored for flowchart — direction comes from header)
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const fmOverrides = getValidOverrides(frontmatter['themeOverrides']);
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(fmOverrides, directiveThemeOverrides);

    // Contract-binding path: derive FlowTheme from Tier-2 contract if applicable.
    const baseTheme = isContractTheme(themeName)
      ? bindFlowTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveFlowTheme(themeName);

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

    // Config-surface: density + overrides applied via resolvedTheme when contract active
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const fmOverrides = getValidOverrides(frontmatter['themeOverrides']);
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(fmOverrides, directiveThemeOverrides);
    const hasConfig   = density !== undefined || (overrides !== undefined && Object.keys(overrides).length > 0);

    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: themeName, layout: 'gantt' },
    };

    const format = options.format ?? 'svg';

    let renderResult: ReturnType<typeof renderDocument>;
    let scene: ReturnType<typeof buildScene>;

    if (hasConfig && isContractTheme(themeName)) {
      const resolvedTheme = bindTimelineTheme(resolveContractTheme(themeName, { density, overrides }));
      renderResult = renderDocument(finalDoc, { format, layout: 'gantt', resolvedTheme });
      scene        = buildScene(finalDoc, { layout: 'gantt', resolvedTheme });
    } else {
      renderResult = renderDocument(finalDoc, { format, theme: themeName, layout: 'gantt' });
      scene        = buildScene(finalDoc, { theme: themeName, layout: 'gantt' });
    }

    const hash = computeSceneHash(scene);

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

    // Config-surface: layout selection
    const fmLayout  = typeof frontmatter['layout'] === 'string' ? frontmatter['layout'] : undefined;
    const timelineLayout = resolveTimelineLayout(
      fmLayout ?? directiveLayout,
      'timeline-columns',
      warnings,
    );

    // Config-surface: spineSpacing — 'even' | 'time'.
    // Prevents pathological height explosion for vertical-spine over long time spans.
    // Frontmatter value wins over any option passed programmatically.
    const fmSpineSpacing = frontmatter['spineSpacing'];
    const spineSpacing: 'even' | 'time' | undefined =
      fmSpineSpacing === 'even' || fmSpineSpacing === 'time' ? fmSpineSpacing : undefined;

    // Config-surface: density + overrides applied via resolvedTheme when contract active
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const fmOverrides = getValidOverrides(frontmatter['themeOverrides']);
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(fmOverrides, directiveThemeOverrides);
    const hasConfig   = density !== undefined || (overrides !== undefined && Object.keys(overrides).length > 0);

    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: themeName, layout: timelineLayout },
    };

    const format = options.format ?? 'svg';

    let renderResult: ReturnType<typeof renderDocument>;
    let scene: ReturnType<typeof buildScene>;

    if (hasConfig && isContractTheme(themeName)) {
      // Apply density + overrides via Tier-2 contract binding, bypassing legacy registry.
      const resolvedTheme = bindTimelineTheme(resolveContractTheme(themeName, { density, overrides }));
      renderResult = renderDocument(finalDoc, { format, layout: timelineLayout, spineSpacing, resolvedTheme });
      scene        = buildScene(finalDoc, { layout: timelineLayout, spineSpacing, resolvedTheme });
    } else {
      // Standard path: theme name dispatched through resolveTheme (handles legacy + contract names).
      renderResult = renderDocument(finalDoc, { format, theme: themeName, layout: timelineLayout, spineSpacing });
      scene        = buildScene(finalDoc, { theme: themeName, layout: timelineLayout, spineSpacing });
    }

    const hash = computeSceneHash(scene);

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
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme;

    // Config-surface: density + overrides
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const fmOverrides = getValidOverrides(frontmatter['themeOverrides']);
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(fmOverrides, directiveThemeOverrides);

    const finalDoc: TreeDocument = {
      ...doc,
      metadata: { ...doc.metadata, theme: 'mindmap-radial' },
    };

    const format = options.format ?? 'svg';
    const radialOpts = isContractTheme(themeName)
      ? bindMindmapTheme(resolveContractTheme(themeName, { density, overrides }))
      : undefined;
    const renderResult = renderTreeDocumentRadial(finalDoc, { format }, radialOpts);

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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const classTheme = isContractTheme(themeName)
      ? bindClassTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveClassTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const stateTheme = isContractTheme(themeName)
      ? bindStateTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveStateTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const erTheme = isContractTheme(themeName)
      ? bindErTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveErTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const c4Theme = isContractTheme(themeName)
      ? bindC4Theme(resolveContractTheme(themeName, { density, overrides }))
      : resolveC4Theme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const chartTheme = isContractTheme(themeName)
      ? bindChartTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveChartTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const chartTheme = isContractTheme(themeName)
      ? bindChartTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveChartTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const chartTheme = isContractTheme(themeName)
      ? bindChartTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveChartTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const chartTheme = isContractTheme(themeName)
      ? bindChartTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveChartTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const journeyTheme = isContractTheme(themeName)
      ? bindJourneyTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveJourneyTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const gitGraphTheme = isContractTheme(themeName)
      ? bindGitGraphTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveGitGraphTheme(themeName);
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
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const sankeyTheme = isContractTheme(themeName)
      ? bindSankeyTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveSankeyTheme(themeName);
    const finalDoc: SankeyDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildSankeyScene(finalDoc, sankeyTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderSankeyDocument(finalDoc, { format }, sankeyTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for sankey.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── requirementDiagram ─────────────────────────────────────────────────
  if (kind === 'requirementDiagram') {
    const { doc, warnings, frontmatter } = parseRequirementDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-requirement';
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const reqTheme = isContractTheme(themeName)
      ? bindRequirementTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveRequirementTheme(themeName);
    const finalDoc: RequirementDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildRequirementScene(finalDoc, reqTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderRequirementDocument(finalDoc, { format }, reqTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for requirementDiagram.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── kanban ─────────────────────────────────────────────────────────────
  if (kind === 'kanban') {
    const { doc, warnings, frontmatter } = parseKanbanDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-kanban';
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const kanbanTheme = isContractTheme(themeName)
      ? bindKanbanTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveKanbanTheme(themeName);
    const finalDoc: KanbanDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildKanbanScene(finalDoc, kanbanTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderKanbanDocument(finalDoc, { format }, kanbanTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for kanban.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── block-beta ──────────────────────────────────────────────────────────
  if (kind === 'block') {
    const { doc, warnings, frontmatter } = parseBlockDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-block';
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const blockTheme = isContractTheme(themeName)
      ? bindBlockTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveBlockTheme(themeName);
    const finalDoc: BlockDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildBlockScene(finalDoc, blockTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderBlockDocument(finalDoc, { format }, blockTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for block-beta.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── packet-beta ─────────────────────────────────────────────────────────
  if (kind === 'packet') {
    const { doc, warnings, frontmatter } = parsePacketDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-packet';
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const packetTheme = isContractTheme(themeName)
      ? bindPacketTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolvePacketTheme(themeName);
    const finalDoc: PacketDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildPacketScene(finalDoc, packetTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderPacketDocument(finalDoc, { format }, packetTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for packet-beta.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── architecture-beta ───────────────────────────────────────────────────
  if (kind === 'architecture') {
    const { doc, warnings, frontmatter } = parseArchitectureDiagramInternal(text);
    const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
    const themeName = options.theme ?? fmTheme ?? doc.metadata.theme ?? 'default-architecture';
    const fmDensity   = isValidDensity(frontmatter['density']) ? frontmatter['density'] : undefined;
    const density     = fmDensity ?? (isValidDensity(directiveDensity) ? directiveDensity : undefined);
    const overrides   = mergeConfigOverrides(getValidOverrides(frontmatter['themeOverrides']), directiveThemeOverrides);
    const architectureTheme = isContractTheme(themeName)
      ? bindArchitectureTheme(resolveContractTheme(themeName, { density, overrides }))
      : resolveArchitectureTheme(themeName);
    const finalDoc: ArchitectureDocument = { ...doc, metadata: { ...doc.metadata, theme: themeName } };
    const scene = buildArchitectureScene(finalDoc, architectureTheme);
    const hash = computeSceneHash(scene);
    const format = options.format ?? 'svg';
    const renderResult = renderArchitectureDocument(finalDoc, { format }, architectureTheme);
    if (renderResult instanceof Promise) throw new Error('[renderMermaid] Async not supported for architecture-beta.');
    return { kind, doc: finalDoc, scene, sceneHash: hash, warnings, svg: renderResult.svg, png: renderResult.png };
  }

  // ── Unknown ────────────────────────────────────────────────────────────
  throw new Error(
    `[Tier 0] Unrecognised diagram type. The Mermaid front-end supports: ` +
      `flowchart, graph, sequenceDiagram, gantt, timeline, mindmap, classDiagram, stateDiagram, erDiagram, ` +
      `c4Context, c4Container, c4Component, c4Dynamic, c4Deployment, pie, xychart-beta, quadrantChart, radar, radar-beta, journey, gitGraph, sankey-beta, requirementDiagram, kanban, block-beta, packet-beta, architecture-beta, architecture.`,
  );
}

// ---------------------------------------------------------------------------
// Aesthetic-driven composition layout selection — enumerate-score-pick (2026-06)
// ---------------------------------------------------------------------------
//
// The layout selection algorithm lifts the proven enumerate-score-pick pattern
// from overlay routing up to composition layout:
//
//   C0 = as-authored (the exact grid/spans from the DSL)
//   C1 = trace-ordered ROW: cells ordered left-to-right following the dominant
//        trace hop sequence, so each hop connects adjacent cells → straight
//        horizontal routes with no crossings.
//   C2 = trace-ordered COLUMN: same order, stacked top-to-bottom.
//
// For each candidate the full layout+routing pipeline runs deterministically.
// The aesthetic overall score + egregious defect count determine the winner.
// C0 is preferred on near-ties (epsilon = 0.02) to respect well-authored posters.
// ---------------------------------------------------------------------------

/**
 * Candidate cell arrangement: a remapping of original cell positions to a new
 * grid configuration.  C0 uses an empty positionMap (identity).
 */
interface PosterArrangement {
  name: string;
  columns: number;
  rows?: number;
  /** Original "row,col" key → new grid position (+ optional span override). */
  positionMap: Map<string, { row: number; col: number; colSpan?: number; rowSpan?: number }>;
}

/** Epsilon for C0 tie-break preference: non-C0 must exceed C0 by this margin. */
const LAYOUT_EPSILON = 0.02;

/**
 * Derive topological cell visit order from link hop pairs.
 *
 * Builds a directed graph of cells (each node = "row,col" key, each directed
 * edge = one link's fromCell → toCell hop).  Kahn's topological sort with
 * authored-order tie-breaking returns cells in the dominant trace-visit sequence.
 * Falls back to authored order on cycles.
 */
function deriveCellTraceOrder(
  links: PosterLink[],
  authoredKeys: string[],
): string[] {
  if (links.length === 0) return [...authoredKeys];

  const allKeys = new Set<string>(authoredKeys);
  const outEdges = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const link of links) {
    const fk = `${link.fromCell.row},${link.fromCell.col}`;
    const tk = `${link.toCell.row},${link.toCell.col}`;
    allKeys.add(fk);
    allKeys.add(tk);
    if (!outEdges.has(fk)) outEdges.set(fk, new Set());
    outEdges.get(fk)!.add(tk);
  }

  for (const k of allKeys) inDegree.set(k, 0);
  for (const [, outs] of outEdges) {
    for (const to of outs) inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }

  const authoredIdx = new Map<string, number>(authoredKeys.map((k, i) => [k, i]));
  const byAuthored = (a: string, b: string): number =>
    (authoredIdx.get(a) ?? 9999) - (authoredIdx.get(b) ?? 9999);

  // Initial queue: zero in-degree nodes in authored order.
  const queue: string[] = [...allKeys].filter((k) => (inDegree.get(k) ?? 0) === 0).sort(byAuthored);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    const outs = [...(outEdges.get(node) ?? [])].sort(byAuthored);
    for (const to of outs) {
      const d = (inDegree.get(to) ?? 0) - 1;
      inDegree.set(to, d);
      if (d === 0) {
        const insertAt = queue.findIndex((q) => byAuthored(q, to) > 0);
        if (insertAt === -1) queue.push(to);
        else queue.splice(insertAt, 0, to);
      }
    }
  }

  // Cycle detected — fall back to authored order.
  if (sorted.length < allKeys.size) return [...authoredKeys];

  // Keep only authored cell keys, in trace-derived order.
  return sorted.filter((k) => authoredKeys.includes(k));
}

/**
 * Build the bounded candidate set: C0, C1, C2.
 * Returns only [C0] when the poster has no links (nothing to optimise).
 */
function buildCandidateArrangements(
  cells: Cell[],
  links: PosterLink[],
  docColumns: number,
): PosterArrangement[] {
  const c0: PosterArrangement = { name: 'C0', columns: docColumns, positionMap: new Map() };
  if (links.length === 0 || cells.length <= 1) return [c0];

  const authoredKeys = cells.map((c) => `${c.row ?? 0},${c.col ?? 0}`);
  const traceOrder = deriveCellTraceOrder(links, authoredKeys);
  if (traceOrder.length <= 1) return [c0];

  // C1: trace-ordered ROW (left-to-right).
  const c1Map = new Map<string, { row: number; col: number; colSpan?: number; rowSpan?: number }>();
  traceOrder.forEach((k, i) => c1Map.set(k, { row: 0, col: i, colSpan: 1, rowSpan: 1 }));

  // C2: trace-ordered COLUMN (top-to-bottom).
  const c2Map = new Map<string, { row: number; col: number; colSpan?: number; rowSpan?: number }>();
  traceOrder.forEach((k, i) => c2Map.set(k, { row: i, col: 0, colSpan: 1, rowSpan: 1 }));

  const candidates: PosterArrangement[] = [
    c0,
    { name: 'C1', columns: traceOrder.length, rows: 1, positionMap: c1Map },
    { name: 'C2', columns: 1, rows: traceOrder.length, positionMap: c2Map },
  ];

  // C3: hub-sidebar — the most-connected through-cell (hub) sits at col=1 with rowSpan=N,
  // while the other cells stack vertically at col=0. This lets each hop exit the hub's
  // LEFT edge (unblocked) or enter from adjacent col=0 cells on clean h-right routes.
  if (traceOrder.length >= 3) {
    const hasInbound = new Set<string>();
    const hasOutbound = new Set<string>();
    const connectivity = new Map<string, number>(authoredKeys.map((k) => [k, 0]));
    for (const link of links) {
      const fk = `${link.fromCell.row},${link.fromCell.col}`;
      const tk = `${link.toCell.row},${link.toCell.col}`;
      connectivity.set(fk, (connectivity.get(fk) ?? 0) + 1);
      connectivity.set(tk, (connectivity.get(tk) ?? 0) + 1);
      hasOutbound.add(fk);
      hasInbound.add(tk);
    }
    const throughCells = authoredKeys.filter((k) => hasInbound.has(k) && hasOutbound.has(k));
    if (throughCells.length > 0) {
      const hubKey = throughCells.sort(
        (a, b) => (connectivity.get(b) ?? 0) - (connectivity.get(a) ?? 0),
      )[0]!;
      const nonHubKeys = traceOrder.filter((k) => k !== hubKey);
      if (nonHubKeys.length >= 2) {
        const c3Map = new Map<string, { row: number; col: number; colSpan?: number; rowSpan?: number }>();
        c3Map.set(hubKey, { row: 0, col: 1, colSpan: 1, rowSpan: nonHubKeys.length });
        nonHubKeys.forEach((k, i) => c3Map.set(k, { row: i, col: 0, colSpan: 1, rowSpan: 1 }));
        candidates.push({ name: 'C3', columns: 2, rows: nonHubKeys.length, positionMap: c3Map });

        // C4: hub-sidebar REVERSED — same hub at col=1, but non-hub cells stacked in
        // REVERSE trace order (destination at row=0, source at row=N-1). Routes travel
        // upward through the gutter, reducing staircase crossings when traces go bottom→hub→top.
        const reversedNonHub = [...nonHubKeys].reverse();
        const c4Map = new Map<string, { row: number; col: number; colSpan?: number; rowSpan?: number }>();
        c4Map.set(hubKey, { row: 0, col: 1, colSpan: 1, rowSpan: reversedNonHub.length });
        reversedNonHub.forEach((k, i) => c4Map.set(k, { row: i, col: 0, colSpan: 1, rowSpan: 1 }));
        candidates.push({ name: 'C4', columns: 2, rows: reversedNonHub.length, positionMap: c4Map });
      }
    }
  }

  return candidates;
}

/**
 * Apply an arrangement to cells, anchor maps, and links, producing remapped
 * versions ready for layoutCompositionFull + resolveAndDrawLinks.
 */
function applyArrangement(
  arr: PosterArrangement,
  authoredCells: Cell[],
  localAnchors: Map<string, NodeAnchorRegistry>,
  localObstacles: Map<string, NodeAnchorRegistry>,
  links: PosterLink[],
  title: string,
  themeName: string,
): {
  compDoc: { version: string; metadata: { title: string; theme: string }; grid: { columns: number; rows?: number }; cells: Cell[] };
  mappedAnchors: Map<string, NodeAnchorRegistry>;
  mappedObstacles: Map<string, NodeAnchorRegistry>;
  mappedLinks: PosterLink[];
} {
  const { positionMap, columns, rows } = arr;

  const newCells: Cell[] = authoredCells.map((cell) => {
    const origKey = `${cell.row ?? 0},${cell.col ?? 0}`;
    const np = positionMap.get(origKey);
    if (!np) return cell;
    return {
      ...cell,
      row: np.row,
      col: np.col,
      ...(np.colSpan !== undefined ? { colSpan: np.colSpan } : {}),
      ...(np.rowSpan !== undefined ? { rowSpan: np.rowSpan } : {}),
    };
  });

  const mappedAnchors = new Map<string, NodeAnchorRegistry>();
  const mappedObstacles = new Map<string, NodeAnchorRegistry>();
  for (const [origKey, reg] of localAnchors) {
    const np = positionMap.get(origKey);
    mappedAnchors.set(np ? `${np.row},${np.col}` : origKey, reg);
  }
  for (const [origKey, reg] of localObstacles) {
    const np = positionMap.get(origKey);
    mappedObstacles.set(np ? `${np.row},${np.col}` : origKey, reg);
  }

  const mappedLinks: PosterLink[] = links.map((link) => {
    const fk = `${link.fromCell.row},${link.fromCell.col}`;
    const tk = `${link.toCell.row},${link.toCell.col}`;
    const fnp = positionMap.get(fk);
    const tnp = positionMap.get(tk);
    return {
      ...link,
      fromCell: fnp ? { row: fnp.row, col: fnp.col } : link.fromCell,
      toCell:   tnp ? { row: tnp.row, col: tnp.col } : link.toCell,
    };
  });

  return {
    compDoc: {
      version: '1.0',
      metadata: { title, theme: themeName },
      grid: { columns, ...(rows !== undefined ? { rows } : {}) },
      cells: newCells,
    },
    mappedAnchors,
    mappedObstacles,
    mappedLinks,
  };
}

/**
 * Score a candidate arrangement by running the full layout + routing pipeline
 * and computing egregious-defect count + aesthetic overall score.
 *
 * Errors (e.g. unresolvable links) return worst-case scores so the candidate
 * is safely skipped by pickBestArrangement.
 */
function scorePosterCandidate(
  arr: PosterArrangement,
  authoredCells: Cell[],
  localAnchors: Map<string, NodeAnchorRegistry>,
  localObstacles: Map<string, NodeAnchorRegistry>,
  links: PosterLink[],
  traces: TraceRecord[],
  title: string,
  themeName: string,
  layoutTheme: CompositionTheme,
  categoricalPalette: string[],
): { egregiousDefects: number; overall: number } {
  try {
    const { compDoc, mappedAnchors, mappedObstacles, mappedLinks } = applyArrangement(
      arr, authoredCells, localAnchors, localObstacles, links, title, themeName,
    );

    const { scene: candScene, cellTransforms } = layoutCompositionFull(compDoc, layoutTheme);

    // Transform local anchors/obstacles to poster (scene) space.
    const pAnchors = new Map<string, NodeAnchorRegistry>();
    const pObstacles = new Map<string, NodeAnchorRegistry>();
    for (const ct of cellTransforms) {
      const key = `${ct.row},${ct.col}`;
      const xform = (local: NodeAnchorRegistry): NodeAnchorRegistry => {
        const out: NodeAnchorRegistry = {};
        for (const [id, a] of Object.entries(local)) {
          out[id] = {
            id,
            x: a.x * ct.scale + ct.dx,
            y: a.y * ct.scale + ct.dy,
            w: a.w * ct.scale,
            h: a.h * ct.scale,
          };
        }
        return out;
      };
      pAnchors.set(key, xform(mappedAnchors.get(key) ?? {}));
      pObstacles.set(key, xform(mappedObstacles.get(key) ?? {}));
    }

    const slack = mappedLinks.length * 18 + 16 + 60;
    const candCanvas: KernelBox = { x: 0, y: 0, w: candScene.width, h: candScene.height + slack };

    // Run routing (suppressing warnings — scoring pass only).
    const { geometry } = resolveAndDrawLinks(
      mappedLinks, traces, pAnchors, pObstacles,
      cellTransforms, [], layoutTheme, categoricalPalette, candCanvas,
    );

    if (geometry.edges.length === 0 && mappedLinks.length > 0) {
      // No links resolved — score as defective.
      return { egregiousDefects: mappedLinks.length, overall: 0 };
    }

    const qualGeo: LabeledGeometry = {
      nodes: geometry.nodes,
      labels: geometry.labels,
      edges: geometry.edges,
      canvas: { x: 0, y: 0, w: candScene.width, h: candScene.height },
    };

    const defectReport = detectDefects(qualGeo);
    const aesthetic   = computeAestheticScores(qualGeo);
    return { egregiousDefects: defectReport.defects.length, overall: aesthetic.overall };
  } catch {
    return { egregiousDefects: 999, overall: 0 };
  }
}

/**
 * Pick the best arrangement index.
 *
 * Rules (in priority order):
 *  1. Zero egregious defects is a hard requirement; if no candidate achieves
 *     this, C0 (as-authored, index 0) is returned as the safest fallback.
 *  2. Among zero-defect candidates, pick the one with the highest aesthetic
 *     overall score.
 *  3. C0 gets a preference margin of LAYOUT_EPSILON (0.02): a non-C0 candidate
 *     must score strictly above C0.overall + LAYOUT_EPSILON to win.  This
 *     ensures well-authored posters are not altered by tiny rounding differences.
 */
function pickBestArrangement(
  scores: Array<{ egregiousDefects: number; overall: number }>,
): number {
  const c0 = scores[0] ?? { egregiousDefects: 999, overall: 0 };

  // Collect zero-defect candidates.
  const cleanIndices = scores
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.egregiousDefects === 0)
    .map(({ i }) => i);

  // No clean candidate — keep C0 (safest fallback).
  if (cleanIndices.length === 0) return 0;
  if (cleanIndices.length === 1) return cleanIndices[0]!;

  // Multiple clean candidates — pick highest overall, C0 preferred on near-ties.
  let bestIdx = cleanIndices[0]!;
  let bestOverall = scores[bestIdx]!.overall;

  for (const i of cleanIndices.slice(1)) {
    const candOverall = scores[i]!.overall;
    if (bestIdx === 0) {
      // Current best is C0 — challenger needs LAYOUT_EPSILON advantage.
      if (candOverall > c0.overall + LAYOUT_EPSILON) {
        bestIdx = i;
        bestOverall = candOverall;
      }
    } else {
      // Already past C0 — take the strictly better non-C0 candidate.
      if (candOverall > bestOverall) {
        bestIdx = i;
        bestOverall = candOverall;
      }
    }
  }

  return bestIdx;
}

// ---------------------------------------------------------------------------
// renderPoster — poster DSL renderer (§17.2 superset)
// ---------------------------------------------------------------------------

/**
 * Render a `poster` DSL document into SVG or PNG.
 *
 * Algorithm:
 *  1. Parse poster DSL → PosterDocument (cells + theme + grid + links)
 *  2. For each cell: detect type, build Scene+Anchors via renderCellSceneWithAnchors()
 *     — unknown types or render failures produce a warning and skip the cell
 *  3. Enumerate candidate cell arrangements (C0/C1/C2); score each with the
 *     aesthetic kernel; pick the best (zero defects + highest overall, C0 preferred
 *     on near-ties) — aesthetic-driven layout selection (2026-06)
 *  4. Call layoutCompositionFull() → { scene, cellTransforms }
 *  5. Transform local anchors → poster-space anchors using cellTransforms
 *  6. Resolve link endpoints; draw overlay edges in poster space
 *  7. Serialise to SVG or PNG
 *
 * Theme coherence: every cell is rendered with the same contract theme,
 * so the whole board shares one design system (navy/white for executive, etc.)
 */
function renderPoster(text: string, options: MermaidRenderOptions): MermaidRenderResult {
  const { doc, warnings } = parsePosterInternal(text);

  const themeName = options.theme ?? doc.theme ?? 'executive';
  const compositionTheme = buildCompositionThemeFor(themeName);

  // Categorical palette for trace colouring (§30b.8 — data palette)
  const categoricalPalette: string[] = isContractTheme(themeName)
    ? resolveContractTheme(themeName).dataPalette.categorical
    : ['#1F497D', '#2E86AB', '#4CAF82', '#D97706', '#7C3AED', '#0891B2'];

  const cells: Cell[] = [];
  // Map from "row,col" key → local-space NodeAnchorRegistry (addressable targets)
  const cellAnchors = new Map<string, NodeAnchorRegistry>();
  // Map from "row,col" key → local-space full obstacle set (includes pseudo-states)
  const cellObstacles = new Map<string, NodeAnchorRegistry>();

  for (const cellDef of doc.cells) {
    const cellText = `${cellDef.typeHeader}\n${cellDef.body}`;

    try {
      const result = renderCellSceneWithAnchors(cellText, themeName);
      if (result === null) {
        warnings.push(
          `[poster] Cell [${cellDef.row},${cellDef.col}] type "${cellDef.typeHeader}" is not supported in poster cells — skipped.`,
        );
        continue;
      }

      const sceneContent: SceneCellContent = { kind: 'scene', scene: result.scene };
      const cell: Cell = {
        id: `cell-${cellDef.row}-${cellDef.col}`,
        row: cellDef.row,
        col: cellDef.col,
        ...(cellDef.colSpan && cellDef.colSpan > 1 ? { colSpan: cellDef.colSpan } : {}),
        ...(cellDef.rowSpan && cellDef.rowSpan > 1 ? { rowSpan: cellDef.rowSpan } : {}),
        content: sceneContent,
      };
      cells.push(cell);
      const key = `${cellDef.row},${cellDef.col}`;
      cellAnchors.set(key, result.anchors);
      // Use grammar-supplied obstacles (includes pseudo-states); fall back to anchors.
      cellObstacles.set(key, result.obstacles ?? result.anchors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(
        `[poster] Cell [${cellDef.row},${cellDef.col}] "${cellDef.typeHeader}" failed to render — skipped. ${msg}`,
      );
    }
  }

  if (cells.length === 0) {
    throw new Error('[poster] All cells failed to render — cannot produce a poster.');
  }

  // When the poster carries cross-diagram edges, widen the inter-cell gaps so a
  // real routing channel (the "gutter") opens between cells.  Overlay threads
  // route orthogonally through this gutter — short, direct, PCB-style connectors
  // — and trace/link labels sit in the clear gutter space, never over a node.
  // Cell content is vertically centred so a tall spanning hub sits balanced
  // beside a stack of shorter cells (this only affects link/trace posters).
  const ROUTING_GUTTER = 72;
  const layoutTheme: CompositionTheme = doc.links.length > 0
    ? { ...compositionTheme, gap: Math.max(compositionTheme.gap, ROUTING_GUTTER), cellVAlign: 'center' }
    : compositionTheme;

  // ── Aesthetic-driven layout selection (2026-06): enumerate → score → pick ──
  // Build ~3 candidate arrangements (C0=as-authored, C1=trace-ordered row,
  // C2=trace-ordered column), run the full layout+routing pipeline for each,
  // and pick the one with zero egregious defects and the highest aesthetic
  // overall score.  C0 is preferred on near-ties (epsilon = 0.02) so
  // well-authored posters are not altered by small rounding differences.
  const candidates = buildCandidateArrangements(cells, doc.links, doc.columns);
  const candidateScores: Array<{ egregiousDefects: number; overall: number }> = [];

  if (candidates.length > 1) {
    for (const arr of candidates) {
      candidateScores.push(
        scorePosterCandidate(
          arr, cells, cellAnchors, cellObstacles,
          doc.links, doc.traces, doc.title, themeName, layoutTheme, categoricalPalette,
        ),
      );
    }
  }

  let activeArrangement = candidates[0]!;
  if (candidateScores.length >= 2) {
    const bestIdx = pickBestArrangement(candidateScores);
    activeArrangement = candidates[bestIdx]!;
    if (bestIdx !== 0) {
      warnings.push(
        `[poster] aesthetic-layout: ${activeArrangement.name} selected ` +
        `(overall ${candidateScores[bestIdx]!.overall.toFixed(3)} vs ` +
        `C0 ${candidateScores[0]!.overall.toFixed(3)})`,
      );
    }
  }

  // Apply the winning arrangement → compDoc + remapped anchors/links.
  const {
    compDoc,
    mappedAnchors: winnerAnchors,
    mappedObstacles: winnerObstacles,
    mappedLinks: winnerLinks,
  } = applyArrangement(
    activeArrangement, cells, cellAnchors, cellObstacles, doc.links, doc.title, themeName,
  );

  const { scene: baseScene, cellTransforms } = layoutCompositionFull(compDoc, layoutTheme);

  // Build poster-space anchor map: key = "row,col", value = transformed registry (addressable targets)
  const posterAnchors = new Map<string, NodeAnchorRegistry>();
  // Build poster-space obstacle map: key = "row,col", value = transformed full obstacle set
  const posterObstacles = new Map<string, NodeAnchorRegistry>();
  for (const ct of cellTransforms) {
    const key = `${ct.row},${ct.col}`;
    const transformReg = (local: NodeAnchorRegistry): NodeAnchorRegistry => {
      const out: NodeAnchorRegistry = {};
      for (const [id, anchor] of Object.entries(local)) {
        out[id] = {
          id,
          x: anchor.x * ct.scale + ct.dx,
          y: anchor.y * ct.scale + ct.dy,
          w: anchor.w * ct.scale,
          h: anchor.h * ct.scale,
        };
      }
      return out;
    };
    posterAnchors.set(key, transformReg(winnerAnchors.get(key) ?? {}));
    posterObstacles.set(key, transformReg(winnerObstacles.get(key) ?? {}));
  }

  // Resolve and draw overlay edges (links + desugared trace hops).  The router
  // is feedback-driven: for each hop it ENUMERATES a fixed candidate set, SCORES
  // each with the geometry kernel (heavily penalising routes that stab a
  // non-endpoint node or drop a label on a box), and PICKS the lowest-cost
  // candidate deterministically — a direct gutter hop when one is clean, else
  // the bottom-margin bus.  `busBottomY` is the lowest Y any bus lane reached
  // (0 when no hop used the bus).  The scoring canvas is generous downward so
  // legitimate bus routes are not penalised as out-of-bounds.
  const BUS_SCORING_SLACK = winnerLinks.length * 18 + 16 + 60;
  const scoringCanvas: KernelBox = {
    x: 0,
    y: 0,
    w: baseScene.width,
    h: baseScene.height + BUS_SCORING_SLACK,
  };
  const { primitives: overlayPrimitives, busBottomY, geometry: overlayGeometry } = resolveAndDrawLinks(
    winnerLinks,
    doc.traces,
    posterAnchors,
    posterObstacles,
    cellTransforms,
    warnings,
    layoutTheme,
    categoricalPalette,
    scoringCanvas,
  );

  // Extend the canvas only if a bus-fallback lane reached below the cell area.
  const BUS_EXTRA_BOT = 12;
  const extraH = busBottomY > 0
    ? Math.max(0, busBottomY + BUS_EXTRA_BOT - baseScene.height)
    : 0;
  const busScene = extraH > 0 ? extendCanvasHeight(baseScene, extraH) : baseScene;

  // Build trace legend (emitted at bottom of canvas, below any bus channel)
  const { legendPrims, legendH } = buildTraceLegend(
    doc.traces,
    categoricalPalette,
    busScene.width,
    busScene.height,
    layoutTheme,
  );

  // Merge overlay + legend on top of the (possibly bus-extended) scene
  const allOverlay = [...overlayPrimitives, ...legendPrims];
  const scene: Scene = allOverlay.length > 0
    ? {
        ...busScene,
        primitives: [...busScene.primitives, ...allOverlay],
        height: busScene.height + legendH,
      }
    : busScene;

  // Final overlay geometry, with the canvas set to the committed scene bounds.
  const qualityGeometry: LabeledGeometry | undefined = winnerLinks.length > 0
    ? {
        nodes: overlayGeometry.nodes,
        labels: overlayGeometry.labels,
        edges: overlayGeometry.edges,
        canvas: { x: 0, y: 0, w: scene.width, h: scene.height },
      }
    : undefined;

  const hash  = computeSceneHash(scene);
  const format = options.format ?? 'svg';

  let svg: string | undefined;
  let png: Uint8Array | undefined;

  if (format === 'svg') {
    svg = sceneToSvg(scene);
  } else {
    const svgStr = sceneToSvg(scene);
    png = svgToPng(svgStr);
  }

  return {
    kind: 'poster',
    doc,
    scene,
    sceneHash: hash,
    warnings,
    svg,
    png,
    ...(qualityGeometry ? { qualityGeometry } : {}),
  };
}

// ---------------------------------------------------------------------------
// resolveAndDrawLinks — orthogonal bus routing (§30b routing rewrite 2026-06)
// ---------------------------------------------------------------------------
// Route all cross-cell overlay edges through a horizontal "bus" channel in the
// whitespace below the poster cells.  Each edge follows an orthogonal U-path:
//
//   (1) Exit the source node at its bottom-centre port, going downward.
//   (2) Travel vertically to the assigned bus-lane Y (below all cell boxes).
//   (3) Travel horizontally along the lane to the target node's centre X.
//   (4) Travel vertically upward into the target node's bottom-centre port.
//
// This guarantees no segment ever crosses a cell interior or an unrelated node.
// Labels are placed at the midpoint of the horizontal bus segment.
//
// Lane assignment (deterministic):
//   - All hops of one trace share a single lane (by traceIndex).
//   - Each standalone link gets its own lane.
//   - Order: traces first (by traceIndex asc), then standalone links (by
//     declaration index asc), giving a stable lane numbering across re-runs.
// ---------------------------------------------------------------------------

/**
 * Extend the canvas background rect (first primitive) and the scene height by
 * `extraH` pixels.  Returns the base scene unchanged when extraH ≤ 0.
 */
function extendCanvasHeight(scene: Scene, extraH: number): Scene {
  if (extraH <= 0) return scene;
  const newH = scene.height + extraH;
  return {
    ...scene,
    height: newH,
    primitives: scene.primitives.map((p, idx) => {
      if (idx === 0 && p.kind === 'rect' && p.x === 0 && p.y === 0) {
        return { ...p, height: newH };
      }
      return p;
    }),
  };
}

/** Build a filled arrowhead triangle with tip at `tip`, pointing in direction `tailDir`. */
function arrowhead(
  tip: { x: number; y: number },
  tailDir: { x: number; y: number },
  color: string,
): PathPrimitive {
  const len = Math.sqrt(tailDir.x * tailDir.x + tailDir.y * tailDir.y);
  const ux = len > 0.001 ? tailDir.x / len : 1;
  const uy = len > 0.001 ? tailDir.y / len : 0;
  const arrowSize = 9;
  const halfW = 4;
  const base = { x: tip.x - ux * arrowSize, y: tip.y - uy * arrowSize };
  const lp = { x: base.x - uy * halfW, y: base.y + ux * halfW };
  const rp = { x: base.x + uy * halfW, y: base.y - ux * halfW };
  return {
    kind: 'path',
    d: `M ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${lp.x.toFixed(2)} ${lp.y.toFixed(2)} L ${rp.x.toFixed(2)} ${rp.y.toFixed(2)} Z`,
    fill: color,
    stroke: 'none',
    strokeWidth: 0,
  };
}

/** Emit a label pill (background rect + text) centred at (cx, cy). */
function labelPill(
  cx: number, cy: number,
  text: string,
  color: string,
  theme: CompositionTheme,
): ScenePrimitive[] {
  const fontSize = 11;
  const pad = 4;
  const approxW = text.length * fontSize * 0.55 + 2 * pad;
  const approxH = fontSize * 1.4 + 2 * pad;

  return [
    {
      kind: 'rect',
      x: cx - approxW / 2,
      y: cy - approxH / 2,
      width: approxW,
      height: approxH,
      fill: '#FFFFFF',
      stroke: color,
      strokeWidth: 1,
      rx: 3,
    },
    {
      kind: 'text',
      x: cx,
      y: cy,
      text,
      fontFamily: theme.textFont?.family ?? 'Georgia, serif',
      fontSize,
      fontWeight: 400,
      fill: color,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    },
  ];
}

/**
 * Emit the scene primitives for an already-chosen orthogonal route polyline.
 *
 * Generic over route shape (direct gutter hop or bottom-margin bus U-route) —
 * the route geometry was already SELECTED by the geometry kernel
 * (`pickBestRoute`) so this function only renders it.  The arrowhead lands on
 * the final vertex pointing along the last segment; the label pill sits at the
 * centre of `labelBox` (always pre-validated to be clear of nodes).
 */
function emitRoutePolyline(
  points: { x: number; y: number }[],
  labelBox: { x: number; y: number; w: number; h: number } | undefined,
  isDashed: boolean,
  isDirected: boolean,
  color: string,
  strokeWidth: number,
  label: string | undefined,
  theme: CompositionTheme,
): ScenePrimitive[] {
  const prims: ScenePrimitive[] = [];
  const DASH = '6,4';

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  prims.push({
    kind: 'path',
    d,
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    opacity: 0.95,
    ...(isDashed ? { dashArray: DASH } : {}),
  });

  if (isDirected && points.length >= 2) {
    const tip = points[points.length - 1]!;
    const prev = points[points.length - 2]!;
    prims.push(arrowhead(tip, { x: tip.x - prev.x, y: tip.y - prev.y }, color));
  }

  if (label && labelBox) {
    const cx = labelBox.x + labelBox.w / 2;
    const cy = labelBox.y + labelBox.h / 2;
    prims.push(...labelPill(cx, cy, label, color, theme));
  }

  return prims;
}

// ---------------------------------------------------------------------------
// Candidate-route enumeration + kernel-scored selection (§ geometry kernel)
// ---------------------------------------------------------------------------
// The router no longer commits a route from a first-match heuristic.  Instead,
// for every hop it ENUMERATES a fixed, deterministic candidate set (the direct
// gutter routes through each viable boundary-port pair, plus the bottom-bus
// fallback), SCORES each with the pure geometry kernel — heavily penalising a
// route that stabs a non-endpoint node or drops a label on a node — and PICKS
// the lowest-cost candidate with a stable tie-break.  A route that crosses a
// node can therefore NEVER be chosen when a clean alternative exists.
// ---------------------------------------------------------------------------

interface CellRect { x: number; y: number; w: number; h: number; }

type RouteShape = 'h-right' | 'h-left' | 'v-down' | 'v-up' | 'bus';

/** Label pill geometry for a route, mirroring `labelPill`'s sizing exactly. */
function labelBoxAt(cx: number, cy: number, text: string | undefined): KernelBox | undefined {
  if (!text) return undefined;
  const fontSize = 11;
  const pad = 4;
  const w = text.length * fontSize * 0.55 + 2 * pad;
  const h = fontSize * 1.4 + 2 * pad;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * A single enumerated candidate.  `build(offset)` reconstructs the route's
 * polyline (and label box) with a lane offset applied to the gutter centre-line
 * — used so parallel traces in the same gutter separate into lanes after the
 * kernel has chosen each hop's shape.
 */
interface HopCandidate extends RouteCandidate {
  shape: RouteShape;
  gutterKey: string;
  laneGroupKey: string;
  isDashed: boolean;
  isDirected: boolean;
  color: string;
  build: (offset: number) => { points: { x: number; y: number }[]; labelBox?: KernelBox };
}

/**
 * Build the fixed candidate set for one hop.  Direction candidates are emitted
 * only when the target cell genuinely lies in that direction; the bottom-bus
 * fallback is always present so every hop has at least one routable option.
 */
function enumerateHopCandidates(
  s: NodeAnchor, t: NodeAnchor,
  srcCell: CellRect, tgtCell: CellRect,
  globalCellBot: number,
  fromId: string, toId: string,
  laneGroupKey: string,
  label: string | undefined,
  isDashed: boolean, isDirected: boolean, color: string,
  busBaseY: number,
): HopCandidate[] {
  const srcCx = s.x + s.w / 2, srcCy = s.y + s.h / 2;
  const tgtCx = t.x + t.w / 2, tgtCy = t.y + t.h / 2;
  const EPS = 1;
  const candidates: HopCandidate[] = [];
  let rank = 0;

  const mk = (
    shape: RouteShape,
    gutterKey: string,
    build: (offset: number) => { points: { x: number; y: number }[]; labelBox?: KernelBox },
  ): HopCandidate => {
    const { points, labelBox } = build(0);
    return {
      shape, gutterKey, laneGroupKey, isDashed, isDirected, color,
      build, points, labelBox, fromId, toId, rank: rank++,
    };
  };

  // Direct horizontal gutter — target to the RIGHT.
  if (tgtCell.x >= srcCell.x + srcCell.w - EPS) {
    const gx0 = (srcCell.x + srcCell.w + tgtCell.x) / 2;
    candidates.push(mk('h-right', `hx:${Math.round(gx0)}`, (off) => {
      const gx = gx0 + off;
      return {
        points: [
          { x: s.x + s.w, y: srcCy },
          { x: gx, y: srcCy },
          { x: gx, y: tgtCy },
          { x: t.x, y: tgtCy },
        ],
        labelBox: labelBoxAt(gx, (srcCy + tgtCy) / 2, label),
      };
    }));
    // Near-source variant: the vertical gutter sits just past the source cell's right
    // edge.  For non-adjacent targets (cells in between), this keeps the vertical
    // segment inside the actual gap between source and its immediate right neighbour
    // rather than inside an intermediate cell.  Lower-rank than the midpoint variant;
    // the kernel picks this when the midpoint route has a higher throughNode cost.
    const gxNear = srcCell.x + srcCell.w + 8;
    if (Math.round(gxNear) !== Math.round(gx0)) { // skip when degenerate duplicate
      candidates.push(mk('h-right', `hx:${Math.round(gxNear)}`, (off) => {
        const gx = gxNear + off;
        return {
          points: [
            { x: s.x + s.w, y: srcCy },
            { x: gx, y: srcCy },
            { x: gx, y: tgtCy },
            { x: t.x, y: tgtCy },
          ],
          labelBox: labelBoxAt(gx, (srcCy + tgtCy) / 2, label),
        };
      }));
    }
    // Alternate-port variants: exit at the TOP-RIGHT or BOTTOM-RIGHT corner of
    // the source node instead of the centre-right edge.
    //
    // Motivation: when a sibling node lives in the SAME cell as the source and
    // occupies the same y-range (e.g. SessionCache immediately to the right of
    // AuthController in a class diagram), the centre-exit segment passes through
    // that sibling's interior and gets the full `throughNode` penalty (×1000).
    // The bus fallback may also be blocked (e.g. TokenService directly below
    // AuthController).  In that situation ALL existing candidates get penalised
    // and the kernel is forced to pick the "least bad" defective route.
    //
    // `segmentIntersectsBox` uses strict interior semantics: a horizontal segment
    // at exactly y = sibling.y (the sibling's TOP boundary) clips to a region
    // whose midpoint lies on the boundary, not strictly inside — so it returns
    // false.  Exiting at y = s.y (top edge of the source node) therefore avoids
    // any same-row sibling whose top y equals the source's top y.  Similarly,
    // y = s.y + s.h avoids a sibling whose bottom y equals the source's bottom y.
    //
    // These candidates have higher ranks (lower priority) so they win only when
    // the centre-exit route is genuinely blocked by a same-cell sibling.
    candidates.push(mk('h-right', `hx:${Math.round(gx0)}`, (off) => {
      const gx = gx0 + off;
      return {
        points: [
          { x: s.x + s.w, y: s.y },
          { x: gx, y: s.y },
          { x: gx, y: tgtCy },
          { x: t.x, y: tgtCy },
        ],
        labelBox: labelBoxAt(gx, (s.y + tgtCy) / 2, label),
      };
    }));
    candidates.push(mk('h-right', `hx:${Math.round(gx0)}`, (off) => {
      const gx = gx0 + off;
      return {
        points: [
          { x: s.x + s.w, y: s.y + s.h },
          { x: gx, y: s.y + s.h },
          { x: gx, y: tgtCy },
          { x: t.x, y: tgtCy },
        ],
        labelBox: labelBoxAt(gx, (s.y + s.h + tgtCy) / 2, label),
      };
    }));
    if (Math.round(gxNear) !== Math.round(gx0)) {
      candidates.push(mk('h-right', `hx:${Math.round(gxNear)}`, (off) => {
        const gx = gxNear + off;
        return {
          points: [
            { x: s.x + s.w, y: s.y },
            { x: gx, y: s.y },
            { x: gx, y: tgtCy },
            { x: t.x, y: tgtCy },
          ],
          labelBox: labelBoxAt(gx, (s.y + tgtCy) / 2, label),
        };
      }));
      candidates.push(mk('h-right', `hx:${Math.round(gxNear)}`, (off) => {
        const gx = gxNear + off;
        return {
          points: [
            { x: s.x + s.w, y: s.y + s.h },
            { x: gx, y: s.y + s.h },
            { x: gx, y: tgtCy },
            { x: t.x, y: tgtCy },
          ],
          labelBox: labelBoxAt(gx, (s.y + s.h + tgtCy) / 2, label),
        };
      }));
    }
  }

  // Direct horizontal gutter — target to the LEFT.
  if (tgtCell.x + tgtCell.w <= srcCell.x + EPS) {
    const gx0 = (tgtCell.x + tgtCell.w + srcCell.x) / 2;
    candidates.push(mk('h-left', `hx:${Math.round(gx0)}`, (off) => {
      const gx = gx0 + off;
      return {
        points: [
          { x: s.x, y: srcCy },
          { x: gx, y: srcCy },
          { x: gx, y: tgtCy },
          { x: t.x + t.w, y: tgtCy },
        ],
        labelBox: labelBoxAt(gx, (srcCy + tgtCy) / 2, label),
      };
    }));
    // Near-source variant (symmetric to h-right-near).
    const gxNear = srcCell.x - 8;
    if (Math.round(gxNear) !== Math.round(gx0)) {
      candidates.push(mk('h-left', `hx:${Math.round(gxNear)}`, (off) => {
        const gx = gxNear + off;
        return {
          points: [
            { x: s.x, y: srcCy },
            { x: gx, y: srcCy },
            { x: gx, y: tgtCy },
            { x: t.x + t.w, y: tgtCy },
          ],
          labelBox: labelBoxAt(gx, (srcCy + tgtCy) / 2, label),
        };
      }));
    }
    // Alternate-port variants for h-left: exit at TOP-LEFT or BOTTOM-LEFT corner.
    // Symmetric to the h-right alternate-port variants above — avoids same-row
    // siblings in the source cell that share the source node's y-range.
    candidates.push(mk('h-left', `hx:${Math.round(gx0)}`, (off) => {
      const gx = gx0 + off;
      return {
        points: [
          { x: s.x, y: s.y },
          { x: gx, y: s.y },
          { x: gx, y: tgtCy },
          { x: t.x + t.w, y: tgtCy },
        ],
        labelBox: labelBoxAt(gx, (s.y + tgtCy) / 2, label),
      };
    }));
    candidates.push(mk('h-left', `hx:${Math.round(gx0)}`, (off) => {
      const gx = gx0 + off;
      return {
        points: [
          { x: s.x, y: s.y + s.h },
          { x: gx, y: s.y + s.h },
          { x: gx, y: tgtCy },
          { x: t.x + t.w, y: tgtCy },
        ],
        labelBox: labelBoxAt(gx, (s.y + s.h + tgtCy) / 2, label),
      };
    }));
    if (Math.round(gxNear) !== Math.round(gx0)) {
      candidates.push(mk('h-left', `hx:${Math.round(gxNear)}`, (off) => {
        const gx = gxNear + off;
        return {
          points: [
            { x: s.x, y: s.y },
            { x: gx, y: s.y },
            { x: gx, y: tgtCy },
            { x: t.x + t.w, y: tgtCy },
          ],
          labelBox: labelBoxAt(gx, (s.y + tgtCy) / 2, label),
        };
      }));
      candidates.push(mk('h-left', `hx:${Math.round(gxNear)}`, (off) => {
        const gx = gxNear + off;
        return {
          points: [
            { x: s.x, y: s.y + s.h },
            { x: gx, y: s.y + s.h },
            { x: gx, y: tgtCy },
            { x: t.x + t.w, y: tgtCy },
          ],
          labelBox: labelBoxAt(gx, (s.y + s.h + tgtCy) / 2, label),
        };
      }));
    }
  }

  // Direct vertical gutter — target BELOW.
  if (tgtCell.y >= srcCell.y + srcCell.h - EPS) {
    const gy0 = (srcCell.y + srcCell.h + tgtCell.y) / 2;
    candidates.push(mk('v-down', `vy:${Math.round(gy0)}`, (off) => {
      const gy = gy0 + off;
      return {
        points: [
          { x: srcCx, y: s.y + s.h },
          { x: srcCx, y: gy },
          { x: tgtCx, y: gy },
          { x: tgtCx, y: t.y },
        ],
        labelBox: labelBoxAt((srcCx + tgtCx) / 2, gy, label),
      };
    }));
  }

  // Direct vertical gutter — target ABOVE.
  if (tgtCell.y + tgtCell.h <= srcCell.y + EPS) {
    const gy0 = (tgtCell.y + tgtCell.h + srcCell.y) / 2;
    candidates.push(mk('v-up', `vy:${Math.round(gy0)}`, (off) => {
      const gy = gy0 + off;
      return {
        points: [
          { x: srcCx, y: s.y },
          { x: srcCx, y: gy },
          { x: tgtCx, y: gy },
          { x: tgtCx, y: t.y + t.h },
        ],
        labelBox: labelBoxAt((srcCx + tgtCx) / 2, gy, label),
      };
    }));
  }

  // Bottom-margin bus fallback — center entry (always available).
  // The bus drops below all cells and rises into the target's bottom-centre.
  // For targets with a pseudo-state (e.g. end-bullseye) directly below the node,
  // the centre-X entry may pass through that pseudo-state; the left/right entry
  // variants below provide clean alternatives the kernel can score against.
  candidates.push(mk('bus', 'bus', (off) => {
    const busY = busBaseY + off;
    return {
      points: [
        { x: srcCx, y: s.y + s.h },
        { x: srcCx, y: busY },
        { x: tgtCx, y: busY },
        { x: tgtCx, y: t.y + t.h },
      ],
      labelBox: labelBoxAt((srcCx + tgtCx) / 2, busY, label),
    };
  }));

  // Bus left-entry: rises into the target's bottom-left.  For targets whose
  // centre-bottom is blocked by a pseudo-state (end-bullseye at tgtCx), this
  // enters at the left edge of the target box, which is typically clear.
  const busEntryLeft = t.x + 4;
  candidates.push(mk('bus', 'bus', (off) => {
    const busY = busBaseY + off;
    return {
      points: [
        { x: srcCx,       y: s.y + s.h },
        { x: srcCx,       y: busY },
        { x: busEntryLeft, y: busY },
        { x: busEntryLeft, y: t.y + t.h },
      ],
      labelBox: labelBoxAt((srcCx + busEntryLeft) / 2, busY, label),
    };
  }));

  // Bus right-entry: symmetric to bus-left, enters at the target's bottom-right.
  const busEntryRight = t.x + t.w - 4;
  candidates.push(mk('bus', 'bus', (off) => {
    const busY = busBaseY + off;
    return {
      points: [
        { x: srcCx,        y: s.y + s.h },
        { x: srcCx,        y: busY },
        { x: busEntryRight, y: busY },
        { x: busEntryRight, y: t.y + t.h },
      ],
      labelBox: labelBoxAt((srcCx + busEntryRight) / 2, busY, label),
    };
  }));

  return candidates;
}

/**
 * Resolve all `link` statements (including trace-desugared hops) to poster-space
 * coordinates and emit overlay-edge primitives.
 *
 * Feedback-driven routing (geometry kernel): each hop enumerates a fixed
 * candidate set (`enumerateHopCandidates`), the pure kernel SCORES every
 * candidate against ALL node boxes / committed edges / committed labels
 * (`scoreRoute`), and the lowest-cost candidate is committed deterministically
 * (`pickBestRoute`).  Parallel hops sharing a gutter are then separated into
 * lanes by a stable offset.  The function also returns the committed
 * `LabeledGeometry` (node + label boxes + routed edge segments) so the same
 * kernel can re-verify the final scene as a post-render gate.
 *
 * Returns the emitted primitives, `busBottomY` (lowest bus-lane Y, or 0), and
 * the labelled geometry of the overlay.  Unresolvable links WARN and are skipped.
 */
function resolveAndDrawLinks(
  links: PosterLink[],
  traces: TraceRecord[],
  posterAnchors: Map<string, NodeAnchorRegistry>,
  posterObstacles: Map<string, NodeAnchorRegistry>,
  cellTransforms: CellTransform[],
  warnings: string[],
  theme: CompositionTheme,
  categoricalPalette: string[],
  canvas: KernelBox,
): { primitives: ScenePrimitive[]; busBottomY: number; geometry: OverlayGeometry } {
  if (links.length === 0) {
    return { primitives: [], busBottomY: 0, geometry: { nodes: [], labels: [], edges: [] } };
  }

  const STANDALONE_COLOR = '#E05B4B';
  const STROKE_WIDTH     = 2;
  const GUTTER_PITCH     = 20;
  const BUS_MARGIN_TOP   = 16;
  const BUS_LANE_PITCH   = 18;

  // Trace-index → colour map (declaration order → categorical palette).
  const n = Math.max(1, categoricalPalette.length);
  const traceColorMap = new Map<number, string>();
  traces.forEach((_t, i) => {
    const base = categoricalPalette[i % n]!;
    traceColorMap.set(i, i < n ? base : lightenHex(base, 0.18));
  });

  // Cell rectangles + ALL node boxes in poster space (for kernel scoring).
  // CRITICAL: nodeBoxes is built from posterObstacles (the FULL rendered-node set,
  // including pseudo-states such as start/end bullseyes) — NOT from posterAnchors
  // (addressable targets only).  Using only anchors was the root cause of the
  // link-poster blind-spot bug: the end-state bullseye was excluded from anchors
  // (not a valid link target), so it was also excluded from obstacles, making the
  // kernel blind to routes passing straight through it (2026-06-16 regression fix).
  const cellRectByKey = new Map<string, CellRect>();
  for (const ct of cellTransforms) {
    cellRectByKey.set(`${ct.row},${ct.col}`, { x: ct.cellX, y: ct.cellY, w: ct.cellW, h: ct.cellH });
  }
  const nodeBoxes: KernelBoxWithId[] = [];
  for (const [key, registry] of posterObstacles) {
    for (const anchor of Object.values(registry)) {
      nodeBoxes.push({ id: `${key}:${anchor.id}`, x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h });
    }
  }
  const globalCellBot = [...cellRectByKey.values()].reduce((m, r) => Math.max(m, r.y + r.h), 0);
  const busBaseY = globalCellBot + BUS_MARGIN_TOP;
  const lengthScale = Math.hypot(canvas.w, canvas.h) || 1;

  // ── Pass 1: resolve endpoints + kernel-pick a shape per hop ────────────────
  interface Chosen {
    cand: HopCandidate;
    label: string | undefined;
  }
  const chosen: Chosen[] = [];
  const committedEdges: KernelSegment[][] = [];
  const committedLabels: KernelBox[] = [];

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!;
    const fromKey = `${link.fromCell.row},${link.fromCell.col}`;
    const toKey   = `${link.toCell.row},${link.toCell.col}`;

    const fromRegistry = posterAnchors.get(fromKey);
    const toRegistry   = posterAnchors.get(toKey);
    if (!fromRegistry) {
      warnings.push(`[poster] link: source cell [${link.fromCell.row},${link.fromCell.col}] not found or has no anchors — link skipped.`);
      continue;
    }
    if (!toRegistry) {
      warnings.push(`[poster] link: target cell [${link.toCell.row},${link.toCell.col}] not found or has no anchors — link skipped.`);
      continue;
    }

    const srcAnchor = fromRegistry[link.fromNodeId]
      ?? Object.values(fromRegistry).find((a) => a.id.toLowerCase() === link.fromNodeId.toLowerCase());
    const tgtAnchor = toRegistry[link.toNodeId]
      ?? Object.values(toRegistry).find((a) => a.id.toLowerCase() === link.toNodeId.toLowerCase());
    if (!srcAnchor) {
      warnings.push(`[poster] link: node "${link.fromNodeId}" not found in cell [${link.fromCell.row},${link.fromCell.col}] (anchors: ${Object.keys(fromRegistry).join(', ')}) — link skipped.`);
      continue;
    }
    if (!tgtAnchor) {
      warnings.push(`[poster] link: node "${link.toNodeId}" not found in cell [${link.toCell.row},${link.toCell.col}] (anchors: ${Object.keys(toRegistry).join(', ')}) — link skipped.`);
      continue;
    }

    const srcCell = cellRectByKey.get(fromKey)!;
    const tgtCell = cellRectByKey.get(toKey)!;
    const fromId  = `${fromKey}:${srcAnchor.id}`;
    const toId    = `${toKey}:${tgtAnchor.id}`;

    const isDashed   = link.edgeStyle === '-..' || link.edgeStyle === '-.-' || link.edgeStyle === '-.->';
    const isDirected = link.edgeStyle === '-->' || link.edgeStyle === '-.->';
    const color = link.traceIndex !== undefined
      ? (traceColorMap.get(link.traceIndex) ?? STANDALONE_COLOR)
      : STANDALONE_COLOR;
    const laneGroupKey = link.traceIndex !== undefined ? `t${link.traceIndex}` : `s${i}`;

    const candidates = enumerateHopCandidates(
      srcAnchor, tgtAnchor, srcCell, tgtCell, globalCellBot,
      fromId, toId, laneGroupKey, link.label,
      isDashed, isDirected, color, busBaseY,
    );

    const ctx: RouteContext = {
      nodes: nodeBoxes,
      committedEdges,
      committedLabels,
      canvas,
      lengthScale,
    };
    const best = pickBestRoute(candidates, ctx);
    const cand = best.candidate as HopCandidate;
    chosen.push({ cand, label: link.label });

    // Commit (offset-free) geometry so later hops are scored against it.
    committedEdges.push(polylineToSegments(cand.points));
    if (cand.labelBox) committedLabels.push(cand.labelBox);
  }

  // ── Pass 2: deterministic lane assignment within shared gutters / bus ──────
  const gutterLanes = new Map<string, Map<string, number>>();
  const busLanes = new Map<string, number>();
  let nextBusLane = 0;
  const assign = (predicate: (c: HopCandidate) => boolean) => {
    for (const { cand } of chosen) {
      if (!predicate(cand)) continue;
      if (cand.shape === 'bus') {
        if (!busLanes.has(cand.laneGroupKey)) busLanes.set(cand.laneGroupKey, nextBusLane++);
      } else {
        let lanes = gutterLanes.get(cand.gutterKey);
        if (!lanes) { lanes = new Map(); gutterLanes.set(cand.gutterKey, lanes); }
        if (!lanes.has(cand.laneGroupKey)) lanes.set(cand.laneGroupKey, lanes.size);
      }
    }
  };
  assign((c) => c.laneGroupKey.startsWith('t')); // traces first (stable order)
  assign((c) => c.laneGroupKey.startsWith('s')); // then standalone links

  // ── Pass 3: emit with lane offsets + collect final geometry ────────────────
  const primitives: ScenePrimitive[] = [];
  const edges: OverlayEdge[] = [];
  const labels: KernelBoxWithId[] = [];
  let busBottomY = 0;
  let edgeSeq = 0;

  for (const { cand, label } of chosen) {
    let offset = 0;
    if (cand.shape === 'bus') {
      const laneIdx = busLanes.get(cand.laneGroupKey) ?? 0;
      offset = laneIdx * BUS_LANE_PITCH;
    } else {
      const lanes = gutterLanes.get(cand.gutterKey)!;
      const lane = lanes.get(cand.laneGroupKey) ?? 0;
      const count = lanes.size;
      offset = (lane - (count - 1) / 2) * GUTTER_PITCH;
    }

    const { points, labelBox } = cand.build(offset);

    if (cand.shape === 'bus') {
      busBottomY = Math.max(busBottomY, busBaseY + offset);
    }

    primitives.push(...emitRoutePolyline(
      points, labelBox, cand.isDashed, cand.isDirected, cand.color, STROKE_WIDTH, label, theme,
    ));

    const edgeId = `${cand.fromId}->${cand.toId}#${edgeSeq++}`;
    edges.push({ id: edgeId, fromId: cand.fromId, toId: cand.toId, segments: polylineToSegments(points) });
    if (label && labelBox) labels.push({ id: edgeId, x: labelBox.x, y: labelBox.y, w: labelBox.w, h: labelBox.h });
  }

  return {
    primitives,
    busBottomY,
    geometry: { nodes: nodeBoxes, labels, edges },
  };
}

/**
 * Build the trace legend strip — a horizontal row of colour swatches + names + type pills.
 * Placed at the bottom of the poster canvas, starting at `yStart`.
 *
 * Returns the legend primitives and the total height added to the canvas.
 */
function buildTraceLegend(
  traces: TraceRecord[],
  categoricalPalette: string[],
  canvasWidth: number,
  yStart: number,
  theme: CompositionTheme,
): { legendPrims: ScenePrimitive[]; legendH: number } {
  const namedTraces = traces.filter((t) => t.name);
  if (namedTraces.length === 0) return { legendPrims: [], legendH: 0 };

  const LEGEND_PAD_TOP = 14;
  const LEGEND_PAD_BOT = 14;
  const ROW_H          = 22;
  const SWATCH_W       = 18;
  const SWATCH_H       = 12;
  const FONT_SIZE      = 12;
  const PILL_FONT_SIZE = 10;
  const PILL_PAD_X     = 6;
  const PILL_PAD_Y     = 3;
  const ITEM_GAP       = 20; // horizontal gap between legend items
  const LEGEND_MARGIN  = 18; // left margin

  const n = Math.max(1, categoricalPalette.length);
  const legendH = LEGEND_PAD_TOP + ROW_H + LEGEND_PAD_BOT;
  const legendY = yStart;

  const prims: ScenePrimitive[] = [];

  // Legend background band
  prims.push({
    kind: 'rect',
    x: 0,
    y: legendY,
    width: canvasWidth,
    height: legendH,
    fill: theme.canvasBackground,
    stroke: theme.cellBorder?.color ?? '#CBD5E1',
    strokeWidth: 1,
    rx: 0,
  });

  // Thin rule at top of legend
  prims.push({
    kind: 'line',
    x1: 0, y1: legendY,
    x2: canvasWidth, y2: legendY,
    stroke: theme.cellBorder?.color ?? '#CBD5E1',
    strokeWidth: 1,
    opacity: 0.5,
  });

  // "Traces:" label — use textFont color (readable on canvas background)
  const labelColor = theme.textFont?.color ?? '#334155';
  prims.push({
    kind: 'text',
    x: LEGEND_MARGIN,
    y: legendY + LEGEND_PAD_TOP + ROW_H / 2,
    text: 'Traces:',
    fontFamily: theme.textFont?.family ?? 'Georgia, serif',
    fontSize: FONT_SIZE,
    fontWeight: 600,
    fill: labelColor,
    textAnchor: 'start',
    dominantBaseline: 'central',
  });

  // Measure "Traces: " label width (approx)
  let itemX = LEGEND_MARGIN + 'Traces: '.length * FONT_SIZE * 0.6 + 4;

  namedTraces.forEach((trace, i) => {
    const traceIdx = traces.indexOf(trace);
    const base = categoricalPalette[traceIdx % n]!;
    const color = traceIdx < n ? base : lightenHex(base, 0.18);
    const rowCy = legendY + LEGEND_PAD_TOP + ROW_H / 2;

    // Colour swatch
    prims.push({
      kind: 'rect',
      x: itemX,
      y: rowCy - SWATCH_H / 2,
      width: SWATCH_W,
      height: SWATCH_H,
      fill: color,
      rx: 2,
    });
    itemX += SWATCH_W + 6;

    // Trace name
    const nameW = trace.name.length * FONT_SIZE * 0.58 + 4;
    prims.push({
      kind: 'text',
      x: itemX,
      y: rowCy,
      text: trace.name,
      fontFamily: theme.textFont?.family ?? 'Georgia, serif',
      fontSize: FONT_SIZE,
      fontWeight: 400,
      fill: labelColor,
      textAnchor: 'start',
      dominantBaseline: 'central',
    });
    itemX += nameW;

    // Type pill (if typed trace)
    if (trace.type) {
      const pillText = `«${trace.type}»`;
      const pillW = pillText.length * PILL_FONT_SIZE * 0.6 + 2 * PILL_PAD_X;
      const pillH = PILL_FONT_SIZE * 1.4 + 2 * PILL_PAD_Y;
      itemX += 6;

      prims.push({
        kind: 'rect',
        x: itemX,
        y: rowCy - pillH / 2,
        width: pillW,
        height: pillH,
        fill: lightenHex(color, 0.55),
        stroke: color,
        strokeWidth: 1,
        rx: 4,
      });
      prims.push({
        kind: 'text',
        x: itemX + pillW / 2,
        y: rowCy,
        text: pillText,
        fontFamily: theme.textFont?.family ?? 'Georgia, serif',
        fontSize: PILL_FONT_SIZE,
        fontWeight: 400,
        fill: color,
        textAnchor: 'middle',
        dominantBaseline: 'central',
      });
      itemX += pillW;
    }

    itemX += ITEM_GAP;
    // Wrap to next row if overflowing (not implemented — single-row legend)
    void i;
  });

  return { legendPrims: prims, legendH };
}

/**
 * Lighten a hex colour by the given fraction (0–1).
 * Used for trace palette wrapping and legend pill backgrounds.
 */
function lightenHex(hex: string, fraction: number): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * fraction));
  const lg = Math.min(255, Math.round(g + (255 - g) * fraction));
  const lb = Math.min(255, Math.round(b + (255 - b) * fraction));
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// renderCellSceneWithAnchors — render one cell to Scene + NodeAnchorRegistry
// ---------------------------------------------------------------------------

/**
 * Render a single embedded diagram cell to a Scene and its NodeAnchorRegistry.
 *
 * Returns `null` for unsupported or self-referential types ('poster', 'unknown').
 * Throws on parse or render errors so the caller can catch + warn + skip.
 *
 * Grammars that do not yet export anchors return `{ scene, anchors: {} }`.
 *
 * `obstacles` is the FULL set of rendered node boxes for that cell (including
 * pseudo-states for the state grammar).  The composition layer uses this as the
 * kernel's obstacle set so routes never pass through rendered-but-not-addressable
 * nodes (e.g. the end-state bullseye).  Defaults to `anchors` when absent.
 */
function renderCellSceneWithAnchors(
  cellText: string,
  themeName: string,
): { scene: Scene; anchors: NodeAnchorRegistry; obstacles?: NodeAnchorRegistry } | null {
  const cellKind = detectDiagramType(cellText);

  switch (cellKind) {
    case 'flowchart': {
      const { doc, direction } = parseFlowchartInternal(cellText);
      const baseTheme = isContractTheme(themeName)
        ? bindFlowTheme(resolveContractTheme(themeName))
        : resolveFlowTheme(themeName);
      const orientation: FlowTheme['orientation'] =
        direction === 'TD' || direction === 'TB' || direction === 'BT' ? 'TB' : 'LR';
      return buildFlowSceneWithAnchors(doc, { ...baseTheme, orientation });
    }

    case 'classDiagram': {
      const { doc } = parseClassDiagramInternal(cellText);
      const classTheme = isContractTheme(themeName)
        ? bindClassTheme(resolveContractTheme(themeName))
        : resolveClassTheme(themeName ?? 'default-class');
      return buildClassSceneWithAnchors(doc, classTheme);
    }

    case 'stateDiagram': {
      const { doc } = parseStateDiagramInternal(cellText);
      const stateTheme = isContractTheme(themeName)
        ? bindStateTheme(resolveContractTheme(themeName))
        : resolveStateTheme(themeName ?? 'default-state');
      return buildStateSceneWithAnchors(doc, stateTheme);
    }

    default: {
      // Fall through to plain renderCellScene for other grammars — empty anchors
      const scene = renderCellScene(cellText, themeName);
      if (scene === null) return null;
      return { scene, anchors: {} };
    }
  }
}

// ---------------------------------------------------------------------------
// renderCellScene — render one embedded diagram cell to a Scene
// ---------------------------------------------------------------------------

/**
 * Render a single embedded diagram (identified by its full text — type header
 * + body) with the given theme and return the resulting Scene.
 *
 * Returns `null` for unsupported or self-referential types ('poster', 'unknown').
 * Throws on parse or render errors so the caller can catch + warn + skip.
 */
function renderCellScene(cellText: string, themeName: string): Scene | null {
  const cellKind = detectDiagramType(cellText);

  switch (cellKind) {
    case 'flowchart': {
      const { doc, direction } = parseFlowchartInternal(cellText);
      const baseTheme = isContractTheme(themeName)
        ? bindFlowTheme(resolveContractTheme(themeName))
        : resolveFlowTheme(themeName);
      const orientation: FlowTheme['orientation'] =
        direction === 'TD' || direction === 'TB' || direction === 'BT' ? 'TB' : 'LR';
      return buildFlowScene(doc, { ...baseTheme, orientation });
    }

    case 'sequence': {
      const { doc } = parseSequenceInternal(cellText);
      const seqTheme = isContractTheme(themeName)
        ? bindSequenceTheme(resolveContractTheme(themeName))
        : resolveSequenceTheme(themeName);
      return buildSequenceScene(doc, seqTheme);
    }

    case 'mindmap': {
      const { doc } = parseMindmapInternal(cellText);
      const radialOpts = isContractTheme(themeName)
        ? bindMindmapTheme(resolveContractTheme(themeName))
        : undefined;
      const finalDoc = { ...doc, metadata: { ...doc.metadata, theme: 'mindmap-radial' as const } };
      const result = renderTreeDocumentRadial(finalDoc, { format: 'svg' }, radialOpts);
      return result.scene;
    }

    case 'xychart': {
      const { doc } = parseXYChartDiagramInternal(cellText);
      const chartTheme = isContractTheme(themeName)
        ? bindChartTheme(resolveContractTheme(themeName))
        : resolveChartTheme(themeName ?? 'default-chart');
      return buildChartScene(doc, chartTheme);
    }

    case 'pie': {
      const { doc } = parsePieDiagramInternal(cellText);
      const chartTheme = isContractTheme(themeName)
        ? bindChartTheme(resolveContractTheme(themeName))
        : resolveChartTheme(themeName ?? 'default-chart');
      return buildChartScene(doc, chartTheme);
    }

    case 'quadrantChart': {
      const { doc } = parseQuadrantDiagramInternal(cellText);
      const chartTheme = isContractTheme(themeName)
        ? bindChartTheme(resolveContractTheme(themeName))
        : resolveChartTheme(themeName ?? 'default-chart');
      return buildChartScene(doc, chartTheme);
    }

    case 'radar': {
      const { doc } = parseRadarDiagramInternal(cellText);
      const chartTheme = isContractTheme(themeName)
        ? bindChartTheme(resolveContractTheme(themeName))
        : resolveChartTheme(themeName ?? 'default-chart');
      return buildChartScene(doc, chartTheme);
    }

    case 'gantt': {
      const { doc } = parseGanttInternal(cellText);
      const finalDoc = { ...doc, metadata: { ...doc.metadata, layout: 'gantt' as const } };
      if (isContractTheme(themeName)) {
        const resolvedTheme = bindTimelineTheme(resolveContractTheme(themeName));
        return buildScene(finalDoc, { layout: 'gantt', resolvedTheme });
      }
      return buildScene(finalDoc, { theme: themeName, layout: 'gantt' });
    }

    case 'timeline': {
      const { doc } = parseTimelineInternal(cellText);
      const finalDoc = { ...doc, metadata: { ...doc.metadata, layout: 'timeline-columns' as const } };
      if (isContractTheme(themeName)) {
        const resolvedTheme = bindTimelineTheme(resolveContractTheme(themeName));
        return buildScene(finalDoc, { layout: 'timeline-columns', resolvedTheme });
      }
      return buildScene(finalDoc, { theme: themeName, layout: 'timeline-columns' });
    }

    case 'classDiagram': {
      const { doc } = parseClassDiagramInternal(cellText);
      const classTheme = isContractTheme(themeName)
        ? bindClassTheme(resolveContractTheme(themeName))
        : resolveClassTheme(themeName ?? 'default-class');
      return buildClassScene(doc, classTheme);
    }

    case 'stateDiagram': {
      const { doc } = parseStateDiagramInternal(cellText);
      const stateTheme = isContractTheme(themeName)
        ? bindStateTheme(resolveContractTheme(themeName))
        : resolveStateTheme(themeName ?? 'default-state');
      return buildStateScene(doc, stateTheme);
    }

    case 'erDiagram': {
      const { doc } = parseErDiagramInternal(cellText);
      const erTheme = isContractTheme(themeName)
        ? bindErTheme(resolveContractTheme(themeName))
        : resolveErTheme(themeName ?? 'default-er');
      return buildErScene(doc, erTheme);
    }

    case 'c4Context':
    case 'c4Container':
    case 'c4Component':
    case 'c4Dynamic':
    case 'c4Deployment': {
      const { doc } = parseC4DiagramInternal(cellText);
      const c4Theme = isContractTheme(themeName)
        ? bindC4Theme(resolveContractTheme(themeName))
        : resolveC4Theme(themeName ?? 'default-c4');
      return buildC4Scene(doc, c4Theme);
    }

    case 'journey': {
      const { doc } = parseJourneyDiagramInternal(cellText);
      const journeyTheme = isContractTheme(themeName)
        ? bindJourneyTheme(resolveContractTheme(themeName))
        : resolveJourneyTheme(themeName ?? 'default-journey');
      return buildJourneyScene(doc, journeyTheme);
    }

    case 'gitGraph': {
      const { doc } = parseGitGraphDiagramInternal(cellText);
      const gitTheme = isContractTheme(themeName)
        ? bindGitGraphTheme(resolveContractTheme(themeName))
        : resolveGitGraphTheme(themeName ?? 'default-gitgraph');
      return buildGitGraphScene(doc, gitTheme);
    }

    case 'sankey': {
      const { doc } = parseSankeyDiagramInternal(cellText);
      const sankeyTheme = isContractTheme(themeName)
        ? bindSankeyTheme(resolveContractTheme(themeName))
        : resolveSankeyTheme(themeName ?? 'default-sankey');
      return buildSankeyScene(doc, sankeyTheme);
    }

    case 'kanban': {
      const { doc } = parseKanbanDiagramInternal(cellText);
      const kanbanTheme = isContractTheme(themeName)
        ? bindKanbanTheme(resolveContractTheme(themeName))
        : resolveKanbanTheme(themeName ?? 'default-kanban');
      return buildKanbanScene(doc, kanbanTheme);
    }

    case 'requirementDiagram': {
      const { doc } = parseRequirementDiagramInternal(cellText);
      const reqTheme = isContractTheme(themeName)
        ? bindRequirementTheme(resolveContractTheme(themeName))
        : resolveRequirementTheme(themeName ?? 'default-requirement');
      return buildRequirementScene(doc, reqTheme);
    }

    case 'block': {
      const { doc } = parseBlockDiagramInternal(cellText);
      const blockTheme = isContractTheme(themeName)
        ? bindBlockTheme(resolveContractTheme(themeName))
        : resolveBlockTheme(themeName ?? 'default-block');
      return buildBlockScene(doc, blockTheme);
    }

    case 'packet': {
      const { doc } = parsePacketDiagramInternal(cellText);
      const packetTheme = isContractTheme(themeName)
        ? bindPacketTheme(resolveContractTheme(themeName))
        : resolvePacketTheme(themeName ?? 'default-packet');
      return buildPacketScene(doc, packetTheme);
    }

    case 'architecture': {
      const { doc } = parseArchitectureDiagramInternal(cellText);
      const archTheme = isContractTheme(themeName)
        ? bindArchitectureTheme(resolveContractTheme(themeName))
        : resolveArchitectureTheme(themeName ?? 'default-architecture');
      return buildArchitectureScene(doc, archTheme);
    }

    // Nested posters and unknown types are not supported as cell content
    case 'poster':
    case 'unknown':
    default:
      return null;
  }
}
