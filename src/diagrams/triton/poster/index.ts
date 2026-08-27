import type {
  DiagramModule,
  LayoutResult,
  LayoutOptions,
  DiagramKind,
} from '../../../contracts/index.js';
import type { PosterNote, NotePosition } from './ir.js';
import type { PosterDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import type { CrossLink } from '../../../contracts/crosslink.js';
import { layoutPoster } from './layout.js';
import { getModule } from '../../../frontend/registry.js';
import { matchMermaid } from '../../../frontend/detect.js';
import * as parser from './parser.js';

export type {
  PosterDocument,
  PosterCell,
  PosterGrid,
  PosterScaleMode,
  CellContent,
  DiagramCell,
  TextCell,
  StatCell,
} from './ir.js';

export const poster: DiagramModule<PosterDocument> = {
  parseMermaid(input: string): PosterDocument {
    const raw = parser.parse(input) as any;
    const cells = raw.cells.map((c: any) => {
      const { rawContent, caption, notes } = extractCellAnnotations(c.rawContent as string);
      const content = parseCell({ ...c, rawContent });
      return {
        id: c.id,
        title: c.title,
        content,
        colSpan: c.span?.colSpan,
        rowSpan: c.span?.rowSpan,
        theme: c.theme,
        ...(caption ? { caption } : {}),
        ...(notes.length > 0 ? { notes } : {}),
      };
    });

    const explicitLinks: CrossLink[] = raw.links ?? [];

    const allLinks = [...explicitLinks];

    return {
      version: raw.version ?? '1.0',
      metadata: { ...raw.metadata },
      grid: raw.grid,
      cells,
      ...(allLinks.length > 0 ? { links: allLinks } : {}),
    };
  },

  parseYaml(input: string): PosterDocument {
    return JSON.parse(input) as PosterDocument;
  },

  layout(ir: PosterDocument, theme: ResolvedTheme, options?: LayoutOptions): LayoutResult {
    return layoutPoster(ir, theme);
  },
};

const DEFAULT_HEADERS: Partial<Record<DiagramKind, string>> = {
  block: 'block-beta\n',
  packet: 'packet-beta\n',
  architecture: 'architecture-beta\n',
  flowchart: 'flowchart TD\n',
  sequence: 'sequenceDiagram\n',
  state: 'stateDiagram-v2\n',
  class: 'classDiagram\n',
  er: 'erDiagram\n',
  gitgraph: 'gitGraph\n',
  gantt: 'gantt\n',
  journey: 'journey\n',
  pie: 'pie\n',
  quadrant: 'quadrantChart\n',
  requirement: 'requirementDiagram\n',
  c4: 'C4Context\n',
  sankey: 'sankey-beta\n',
  timeline: 'timeline\n',
  mindmap: 'mindmap\n',
  kanban: 'kanban\n',
  xychart: 'xychart-beta\n',
  radar: 'radar-beta\n',
  tree: 'tree\n',
  plan: 'plan\n',
  list: 'list\n',
  fishbone: 'fishbone\n',
  pyramid: 'pyramid\n',
  loop: 'loop\n',
  topology: 'topology\n',
  bplustree: 'bplustree\n',
  'b+tree': 'bplustree\n',
  btree: 'btree\n',
  merkletree: 'merkletree\n',
  lsmtree: 'lsmtree\n',
  behaviortree: 'behaviortree\n',
  quadtree: 'quadtree\n',
  treap: 'treap\n',
  '234tree': '234tree\n',
  '2-3-4tree': '234tree\n',
};

function canonicalDiagramKind(rawKind: string): DiagramKind | undefined {
  if (!rawKind) return undefined;
  const k = rawKind.trim();
  const lower = k.toLowerCase();

  // Exact canonical match first
  if (getModule(lower as DiagramKind)) return lower as DiagramKind;

  // Direct match using detect's matchMermaid (handles C4Context, stateDiagram, packet, block, etc.)
  const matched = matchMermaid(k) ?? matchMermaid(lower);
  if (matched && getModule(matched)) return matched;

  // Specific common aliases
  if (lower === 'flow') return 'flowchart';
  if (lower.startsWith('block')) return 'block';
  if (lower.startsWith('packet')) return 'packet';
  if (lower.startsWith('arch')) return 'architecture';
  if (lower.startsWith('seq')) return 'sequence';
  if (lower.startsWith('state')) return 'state';
  if (lower.startsWith('class')) return 'class';
  if (lower.startsWith('er')) return 'er';
  if (lower.startsWith('git')) return 'gitgraph';
  if (lower.startsWith('quadtree')) return 'quadtree';
  if (lower.startsWith('quad')) return 'quadrant';
  if (lower.startsWith('req')) return 'requirement';
  if (lower.startsWith('sankey')) return 'sankey';
  if (lower.startsWith('radar')) return 'radar';
  if (lower.startsWith('xychart')) return 'xychart';
  if (lower.startsWith('mind')) return 'mindmap';
  if (lower.startsWith('time')) return 'timeline';
  if (lower.startsWith('bplus') || lower === 'b+tree') return 'bplustree';
  if (lower.startsWith('btree')) return 'btree';
  if (lower.startsWith('merkle')) return 'merkletree';
  if (lower.startsWith('lsm')) return 'lsmtree';
  if (lower.startsWith('behavior')) return 'behaviortree';
  if (lower.startsWith('treap')) return 'treap';
  if (lower.startsWith('234') || lower.startsWith('2-3-4')) return '234tree';
  if (lower.startsWith('kan')) return 'kanban';

  return undefined;
}

function ensureDiagramHeader(kind: DiagramKind, rawContent: string): string {
  const trimmed = rawContent.trimStart();
  if (!trimmed) return rawContent;

  // If the body already starts with a recognized keyword that matches this kind, keep as is
  const detected = matchMermaid(trimmed);
  if (detected === kind) return rawContent;

  const defaultHeader = DEFAULT_HEADERS[kind];
  if (defaultHeader) {
    return defaultHeader + rawContent;
  }

  // Data structure types (array, avl, queue, stack, etc.)
  if (!trimmed.startsWith(kind)) {
    return `${kind} ${rawContent}`;
  }

  return rawContent;
}

function parseCell(raw: any): import('./ir.js').CellContent {
  const kind: string | null | undefined = raw.kind;
  const inferredKind = inferCellKind(raw.rawContent);
  let rawKind = (kind || inferredKind || '').trim();

  // If inferred as text and no explicit :: kind, check if an explicit id matches a diagram kind (e.g. `cell packet-beta` or `cell flow`)
  if ((!rawKind || rawKind === 'text') && !kind && raw.explicitId) {
    const fromId = canonicalDiagramKind(raw.explicitId);
    if (fromId) {
      rawKind = fromId;
    }
  }

  // Poster-specific primitives (no diagram module needed)
  if (rawKind === 'stat') {
    const [value, label] = raw.rawContent.split('|').map((s: string) => s.trim());
    return { kind: 'stat', value: value ?? '', label };
  }
  if (rawKind === 'text') {
    return { kind: 'text', text: raw.rawContent.trim() };
  }

  // Normalise aliases / variants to canonical DiagramKind
  const diagramKind = canonicalDiagramKind(rawKind);

  const module = diagramKind ? getModule(diagramKind) : undefined;
  if (!module || !diagramKind) {
    // Unknown diagram kind — degrade to text
    return { kind: 'text', text: raw.rawContent.trim() };
  }

  // Ensure appropriate header keyword if missing when explicit :: kind is declared
  const preparedContent = ensureDiagramHeader(diagramKind, raw.rawContent);

  // Ensure trailing newline — sub-parsers (PEG grammars) require it
  const content = preparedContent.endsWith('\n') ? preparedContent : preparedContent + '\n';
  return { kind: 'diagram', diagramKind, doc: module.parseMermaid(content) };
}

function inferCellKind(rawContent: string): string | null {
  const trimmed = rawContent.trimStart();
  if (!trimmed.trim()) return 'text';

  const diagramKind = matchMermaid(trimmed);
  if (diagramKind) return diagramKind;

  if (trimmed.includes('|')) return 'stat';
  return 'text';
}

// ─── Cell Annotation Extraction ──────────────────────────────────────────────

const CAPTION_RE = /^[ \t]*caption[ \t]+"([^"]*)"[ \t]*$/;
const NOTE_RE =
  /^[ \t]*note[ \t]+"([^"]*)"(?:[ \t]+at[ \t]+(top-left|top-right|bottom-left|bottom-right|center))?[ \t]*$/;

/**
 * Strip `caption "..."` and `note "..." [at position]` directives from
 * a cell's raw content and return them as structured fields.
 */
function extractCellAnnotations(rawContent: string): {
  rawContent: string;
  caption: string | undefined;
  notes: PosterNote[];
} {
  const inputLines = rawContent.split('\n');
  const outLines: string[] = [];
  let caption: string | undefined;
  const notes: PosterNote[] = [];

  for (const line of inputLines) {
    const cm = line.match(CAPTION_RE);
    if (cm) {
      caption = cm[1];
      continue;
    }
    const nm = line.match(NOTE_RE);
    if (nm) {
      notes.push({ text: nm[1]!, ...(nm[2] ? { position: nm[2] as NotePosition } : {}) });
      continue;
    }
    outLines.push(line);
  }

  return { rawContent: outLines.join('\n'), caption, notes };
}
