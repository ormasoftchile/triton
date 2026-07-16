import type { DiagramModule, LayoutResult, LayoutOptions, DiagramKind } from '../../../contracts/index.js';
import type { PosterNote, NotePosition } from './ir.js';
import type { PosterDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import type { CrossLink } from '../../../contracts/crosslink.js';
import { layoutPoster } from './layout.js';
import { getModule } from '../../../frontend/registry.js';
import { matchMermaid } from '../../../frontend/detect.js';
import * as parser from './parser.js';

export type { PosterDocument, PosterCell, PosterGrid, CellContent, DiagramCell, TextCell, StatCell } from './ir.js';

export const poster: DiagramModule<PosterDocument> = {
  parseMermaid(input: string): PosterDocument {
    const raw = parser.parse(input) as any;
    const cells = raw.cells.map((c: any) => {
      const { rawContent, caption, notes } = extractCellAnnotations(c.rawContent as string);
      const content = parseCell({ ...c, rawContent });
      return {
        id: c.id, title: c.title, content,
        colSpan: c.span?.colSpan, rowSpan: c.span?.rowSpan, theme: c.theme,
        ...(caption ? { caption } : {}),
        ...(notes.length > 0 ? { notes } : {}),
      };
    });

    const explicitLinks: CrossLink[] = raw.links ?? [];

    const allLinks = [...explicitLinks];

    return {
      version:  raw.version ?? '1.0',
      metadata: { ...raw.metadata },
      grid:     raw.grid,
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

function parseCell(raw: any): import('./ir.js').CellContent {
  const kind: string | null | undefined = raw.kind;
  const inferredKind = inferCellKind(raw.rawContent);
  const resolvedKind = kind || inferredKind;

  // Poster-specific primitives (no diagram module needed)
  if (resolvedKind === 'stat') {
    const [value, label] = raw.rawContent.split('|').map((s: string) => s.trim());
    return { kind: 'stat', value: value ?? '', label };
  }
  if (resolvedKind === 'text') {
    return { kind: 'text', text: raw.rawContent.trim() };
  }

  // Normalise aliases to canonical DiagramKind
  const diagramKind: DiagramKind = resolvedKind === 'flow' ? 'flowchart' : resolvedKind as DiagramKind;

  const module = getModule(diagramKind);
  if (!module) {
    // Unknown diagram kind — degrade to text
    return { kind: 'text', text: raw.rawContent.trim() };
  }

  // Ensure trailing newline — sub-parsers (PEG grammars) require it
  const content = raw.rawContent.endsWith('\n') ? raw.rawContent : raw.rawContent + '\n';
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
const NOTE_RE    = /^[ \t]*note[ \t]+"([^"]*)"(?:[ \t]+at[ \t]+(top-left|top-right|bottom-left|bottom-right|center))?[ \t]*$/;

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
    if (cm) { caption = cm[1]; continue; }
    const nm = line.match(NOTE_RE);
    if (nm) { notes.push({ text: nm[1]!, ...(nm[2] ? { position: nm[2] as NotePosition } : {}) }); continue; }
    outLines.push(line);
  }

  return { rawContent: outLines.join('\n'), caption, notes };
}
