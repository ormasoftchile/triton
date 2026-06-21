import type { DiagramModule, LayoutResult, LayoutOptions, DiagramKind } from '../../contracts/index.js';
import type { PosterDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import type { CrossLink, TraceRecord } from '../../contracts/crosslink.js';
import { layoutPoster } from './layout.js';
import { getModule } from '../../frontend/registry.js';
import * as parser from './parser.js';

export type { PosterDocument, PosterCell, PosterGrid, CellContent, DiagramCell, TextCell, StatCell } from './ir.js';

export const poster: DiagramModule<PosterDocument> = {
  parseMermaid(input: string): PosterDocument {
    const raw = parser.parse(input) as any;
    const cells = raw.cells.map((c: any) => {
      const content = parseCell(c);
      return { id: c.id, title: c.title, content, colSpan: c.span?.colSpan, rowSpan: c.span?.rowSpan };
    });

    const traces: TraceRecord[] = raw.traces ?? [];
    const explicitLinks: CrossLink[] = raw.links ?? [];

    // Desugar traces into atomic CrossLinks (N hops → N-1 directed links)
    // Skip intra-cell hops — the internal diagram already shows those connections.
    const traceLinks: CrossLink[] = [];
    for (const trace of traces) {
      for (let i = 0; i < trace.hops.length - 1; i++) {
        const from = trace.hops[i]!;
        const to   = trace.hops[i + 1]!;
        // Same cell? Skip — not a cross-diagram link.
        if (from.cellPath.join('.') === to.cellPath.join('.')) continue;
        traceLinks.push({
          from,
          to,
          direction: 'directed',
          style: 'solid',
          traceId: trace.id,
        });
      }
    }

    // Deduplicate: if an explicit link has the same from/to as a trace link, drop the trace one
    const explicitKeys = new Set(
      explicitLinks.map(l => `${[...l.from.cellPath, l.from.nodeId].join('.')}→${[...l.to.cellPath, l.to.nodeId].join('.')}`)
    );
    const dedupedTraceLinks = traceLinks.filter(l => {
      const key = `${[...l.from.cellPath, l.from.nodeId].join('.')}→${[...l.to.cellPath, l.to.nodeId].join('.')}`;
      return !explicitKeys.has(key);
    });

    const allLinks = [...explicitLinks, ...dedupedTraceLinks];

    return {
      version:  raw.version ?? '1.0',
      metadata: { ...raw.metadata },
      grid:     raw.grid,
      cells,
      ...(allLinks.length > 0 ? { links: allLinks } : {}),
      ...(traces.length > 0 ? { traces } : {}),
    };
  },

  parseYaml(input: string): PosterDocument {
    return JSON.parse(input) as PosterDocument;
  },

  async layout(ir: PosterDocument, theme: ResolvedTheme, options?: LayoutOptions): Promise<LayoutResult> {
    return layoutPoster(ir, theme);
  },
};

function parseCell(raw: any): import('./ir.js').CellContent {
  const kind: string = raw.kind;

  // Poster-specific primitives (no diagram module needed)
  if (kind === 'stat') {
    const [value, label] = raw.rawContent.split('|').map((s: string) => s.trim());
    return { kind: 'stat', value: value ?? '', label };
  }
  if (kind === 'text') {
    return { kind: 'text', text: raw.rawContent.trim() };
  }

  // Normalise aliases to canonical DiagramKind
  const diagramKind: DiagramKind = kind === 'flow' ? 'flowchart' : kind as DiagramKind;

  const module = getModule(diagramKind);
  if (!module) {
    // Unknown diagram kind — degrade to text
    return { kind: 'text', text: raw.rawContent.trim() };
  }

  // Ensure trailing newline — sub-parsers (PEG grammars) require it
  const content = raw.rawContent.endsWith('\n') ? raw.rawContent : raw.rawContent + '\n';
  return { kind: 'diagram', diagramKind, doc: module.parseMermaid(content) };
}
