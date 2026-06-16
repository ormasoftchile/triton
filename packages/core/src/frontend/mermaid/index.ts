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
import type { Cell, SceneCellContent } from '../../composition/index.js';
import type { CompositionTheme } from '../../composition/theme.js';

import { parsePosterInternal, buildCompositionThemeFor } from './poster.js';
import type { PosterDocument, PosterLink } from './poster.js';
import type { NodeAnchorRegistry } from '../../anchors.js';

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
// renderPoster — poster DSL renderer (§17.2 superset)
// ---------------------------------------------------------------------------

/**
 * Render a `poster` DSL document into SVG or PNG.
 *
 * Algorithm:
 *  1. Parse poster DSL → PosterDocument (cells + theme + grid + links)
 *  2. For each cell: detect type, build Scene+Anchors via renderCellSceneWithAnchors()
 *     — unknown types or render failures produce a warning and skip the cell
 *  3. Assemble a CompositionDocument with SceneCellContent cells
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

  const cells: Cell[] = [];
  // Map from "row,col" key → local-space NodeAnchorRegistry
  const cellAnchors = new Map<string, NodeAnchorRegistry>();

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
        content: sceneContent,
      };
      cells.push(cell);
      cellAnchors.set(`${cellDef.row},${cellDef.col}`, result.anchors);
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

  const compDoc = {
    version: '1.0',
    metadata: { title: doc.title, theme: themeName },
    grid: { columns: doc.columns, rows: doc.rows },
    cells,
  };

  const { scene: baseScene, cellTransforms } = layoutCompositionFull(compDoc, compositionTheme);

  // Build poster-space anchor map: key = "row,col", value = transformed registry
  const posterAnchors = new Map<string, NodeAnchorRegistry>();
  for (const ct of cellTransforms) {
    const key = `${ct.row},${ct.col}`;
    const localAnchors = cellAnchors.get(key) ?? {};
    const transformed: NodeAnchorRegistry = {};
    for (const [id, anchor] of Object.entries(localAnchors)) {
      transformed[id] = {
        id,
        x: anchor.x * ct.scale + ct.dx,
        y: anchor.y * ct.scale + ct.dy,
        w: anchor.w * ct.scale,
        h: anchor.h * ct.scale,
      };
    }
    posterAnchors.set(key, transformed);
  }

  // Resolve and draw overlay links
  const overlayPrimitives = resolveAndDrawLinks(doc.links, posterAnchors, warnings, compositionTheme);

  // Merge overlay primitives on top of the base scene
  const scene: Scene = overlayPrimitives.length > 0
    ? {
        ...baseScene,
        primitives: [...baseScene.primitives, ...overlayPrimitives],
      }
    : baseScene;

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
  };
}

// ---------------------------------------------------------------------------
// resolveAndDrawLinks — cross-diagram overlay edge rendering (§30b Phase A)
// ---------------------------------------------------------------------------

/** Choose the best port side on `anchor` when connecting toward `targetCx, targetCy`. */
function chooseSide(anchor: { x: number; y: number; w: number; h: number }, targetCx: number, targetCy: number): { px: number; py: number } {
  const cx = anchor.x + anchor.w / 2;
  const cy = anchor.y + anchor.h / 2;
  const dx = targetCx - cx;
  const dy = targetCy - cy;

  // Prefer horizontal side if |dx| > |dy| (adjusted for aspect)
  if (Math.abs(dx) * (anchor.h / Math.max(anchor.w, 1)) >= Math.abs(dy)) {
    if (dx >= 0) {
      return { px: anchor.x + anchor.w, py: cy }; // E
    } else {
      return { px: anchor.x, py: cy }; // W
    }
  } else {
    if (dy >= 0) {
      return { px: cx, py: anchor.y + anchor.h }; // S
    } else {
      return { px: cx, py: anchor.y }; // N
    }
  }
}

/** Build a filled arrowhead triangle pointing at `tip` from `tailDir`. */
function arrowhead(tip: { x: number; y: number }, tailDir: { x: number; y: number }, color: string): PathPrimitive {
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

/**
 * Resolve all `link` statements to poster-space anchor coordinates and emit
 * Scene primitives for the overlay edges + arrowheads + labels.
 *
 * Unresolvable links (missing cell, missing node) emit a WARNING and are skipped.
 */
function resolveAndDrawLinks(
  links: PosterLink[],
  posterAnchors: Map<string, NodeAnchorRegistry>,
  warnings: string[],
  theme: CompositionTheme,
): ScenePrimitive[] {
  if (links.length === 0) return [];

  const overlayColor = '#E05B4B'; // warm red — clearly distinct from diagram ink
  const overlayDash  = '6,4';
  const overlayStrokeWidth = 2;

  const primitives: ScenePrimitive[] = [];

  for (const link of links) {
    const fromKey = `${link.fromCell.row},${link.fromCell.col}`;
    const toKey   = `${link.toCell.row},${link.toCell.col}`;

    const fromRegistry = posterAnchors.get(fromKey);
    const toRegistry   = posterAnchors.get(toKey);

    if (!fromRegistry) {
      warnings.push(
        `[poster] link: source cell [${link.fromCell.row},${link.fromCell.col}] not found or has no anchors — link skipped.`,
      );
      continue;
    }
    if (!toRegistry) {
      warnings.push(
        `[poster] link: target cell [${link.toCell.row},${link.toCell.col}] not found or has no anchors — link skipped.`,
      );
      continue;
    }

    const srcAnchor = fromRegistry[link.fromNodeId]
      // Case-insensitive fallback — handles grammars that sanitize IDs to lowercase
      ?? Object.values(fromRegistry).find(
           (a) => a.id.toLowerCase() === link.fromNodeId.toLowerCase(),
         );
    const tgtAnchor = toRegistry[link.toNodeId]
      ?? Object.values(toRegistry).find(
           (a) => a.id.toLowerCase() === link.toNodeId.toLowerCase(),
         );

    if (!srcAnchor) {
      warnings.push(
        `[poster] link: node "${link.fromNodeId}" not found in cell [${link.fromCell.row},${link.fromCell.col}] (anchors: ${Object.keys(fromRegistry).join(', ')}) — link skipped.`,
      );
      continue;
    }
    if (!tgtAnchor) {
      warnings.push(
        `[poster] link: node "${link.toNodeId}" not found in cell [${link.toCell.row},${link.toCell.col}] (anchors: ${Object.keys(toRegistry).join(', ')}) — link skipped.`,
      );
      continue;
    }

    // Center coords for port selection
    const srcCx = srcAnchor.x + srcAnchor.w / 2;
    const srcCy = srcAnchor.y + srcAnchor.h / 2;
    const tgtCx = tgtAnchor.x + tgtAnchor.w / 2;
    const tgtCy = tgtAnchor.y + tgtAnchor.h / 2;

    const srcPort = chooseSide(srcAnchor, tgtCx, tgtCy);
    const tgtPort = chooseSide(tgtAnchor, srcCx, srcCy);

    const isDashed = link.edgeStyle === '-..' || link.edgeStyle === '-.-' || link.edgeStyle === '-.->';
    const isDirected = link.edgeStyle === '-->' || link.edgeStyle === '-.->';

    // Edge line
    const edgeLine: ScenePrimitive = {
      kind: 'line',
      x1: srcPort.px,
      y1: srcPort.py,
      x2: tgtPort.px,
      y2: tgtPort.py,
      stroke: overlayColor,
      strokeWidth: overlayStrokeWidth,
      dashArray: isDashed ? overlayDash : '8,4',
      opacity: 0.92,
    };
    primitives.push(edgeLine);

    // Arrowhead at target (for directed edges)
    if (isDirected) {
      const dx = tgtPort.px - srcPort.px;
      const dy = tgtPort.py - srcPort.py;
      primitives.push(arrowhead({ x: tgtPort.px, y: tgtPort.py }, { x: dx, y: dy }, overlayColor));
    }

    // Label at midpoint
    if (link.label) {
      const midX = (srcPort.px + tgtPort.px) / 2;
      const midY = (srcPort.py + tgtPort.py) / 2;
      const labelFontSize = 11;
      const labelPad = 4;
      const approxW = link.label.length * labelFontSize * 0.55 + 2 * labelPad;
      const approxH = labelFontSize * 1.4 + 2 * labelPad;

      // Label background pill
      primitives.push({
        kind: 'rect',
        x: midX - approxW / 2,
        y: midY - approxH / 2,
        width: approxW,
        height: approxH,
        fill: '#FFFFFF',
        stroke: overlayColor,
        strokeWidth: 1,
        rx: 3,
      });

      // Label text
      primitives.push({
        kind: 'text',
        x: midX,
        y: midY,
        text: link.label,
        fontFamily: theme.textFont?.family ?? 'Georgia, serif',
        fontSize: labelFontSize,
        fontWeight: 400,
        fill: overlayColor,
        textAnchor: 'middle',
        dominantBaseline: 'central',
      });
    }
  }

  return primitives;
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
 */
function renderCellSceneWithAnchors(
  cellText: string,
  themeName: string,
): { scene: Scene; anchors: NodeAnchorRegistry } | null {
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
