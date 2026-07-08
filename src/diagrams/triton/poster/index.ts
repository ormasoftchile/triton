import type { DiagramModule, LayoutResult, LayoutOptions, DiagramKind } from '../../../contracts/index.js';
import type { PosterDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import type { CrossLink } from '../../../contracts/crosslink.js';
import { layoutPoster } from './layout.js';
import { getModule } from '../../../frontend/registry.js';
import * as parser from './parser.js';

export type { PosterDocument, PosterCell, PosterGrid, CellContent, DiagramCell, TextCell, StatCell } from './ir.js';

export const poster: DiagramModule<PosterDocument> = {
  parseMermaid(input: string): PosterDocument {
    const raw = parser.parse(input) as any;
    const cells = raw.cells.map((c: any) => {
      const content = parseCell(c);
      return { id: c.id, title: c.title, content, colSpan: c.span?.colSpan, rowSpan: c.span?.rowSpan, theme: c.theme };
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
  const trimmed = rawContent.trim();
  if (!trimmed) return 'text';

  const firstLine = trimmed.split(/\r?\n/)[0]!.trim();
  if (!firstLine) return 'text';

  const keyword = firstLine.toLowerCase();
  if (keyword.startsWith('array')) return 'array';
  if (keyword.startsWith('stack')) return 'stack';
  if (keyword.startsWith('queue')) return 'queue';
  if (keyword.startsWith('unionfind')) return 'unionfind';
  if (keyword.startsWith('hashmap')) return 'hashmap';
  if (keyword.startsWith('matrix')) return 'matrix';
  if (keyword.startsWith('heap')) return 'heap';
  if (keyword.startsWith('trie')) return 'trie';
  if (keyword.startsWith('nodegraph')) return 'nodegraph';
  if (keyword.startsWith('plan')) return 'plan';
  if (keyword.startsWith('btree')) return 'btree';
  if (keyword.startsWith('page')) return 'page';
  if (keyword.startsWith('memory')) return 'memory';
  if (keyword.startsWith('linkedlist')) return 'linkedlist';
  if (keyword.startsWith('avl')) return 'avl';
  if (keyword.startsWith('flowchart') || keyword.startsWith('flow ')) return 'flowchart';
  if (keyword.startsWith('timeline')) return 'timeline';
  if (keyword.startsWith('sequence')) return 'sequence';
  if (keyword.startsWith('gantt')) return 'gantt';
  if (keyword.startsWith('state')) return 'state';
  if (keyword.startsWith('class')) return 'class';
  if (keyword.startsWith('er')) return 'er';
  if (keyword.startsWith('journey')) return 'journey';
  if (keyword.startsWith('gitgraph')) return 'gitgraph';
  if (keyword.startsWith('mindmap')) return 'mindmap';
  if (keyword.startsWith('sankey')) return 'sankey';
  if (keyword.startsWith('pie')) return 'pie';
  if (keyword.startsWith('requirement')) return 'requirement';
  if (keyword.startsWith('kanban')) return 'kanban';
  if (keyword.startsWith('quadrant')) return 'quadrant';
  if (keyword.startsWith('xychart')) return 'xychart';
  if (keyword.startsWith('radar')) return 'radar';
  if (trimmed.includes('|')) return 'stat';
  return 'text';
}
