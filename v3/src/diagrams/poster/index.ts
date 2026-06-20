import type { DiagramModule } from '../../contracts/index.js';
import type { PosterDocument } from './ir.js';
import type { Scene } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutPoster } from './layout.js';
import { flowchart } from '../flowchart/index.js';
import { timeline } from '../timeline/index.js';
import * as parser from './parser.js';

export type { PosterDocument, PosterCell, PosterGrid, CellContent, FlowCell, TimelineCell, TextCell, StatCell } from './ir.js';

export const poster: DiagramModule<PosterDocument> = {
  parseMermaid(input: string): PosterDocument {
    const raw = parser.parse(input) as any;
    const cells = raw.cells.map((c: any) => {
      const content = parseCell(c);
      return { id: c.id, title: c.title, content, colSpan: c.span?.colSpan, rowSpan: c.span?.rowSpan };
    });
    return {
      version:  raw.version ?? '1.0',
      metadata: { ...raw.metadata },
      grid:     raw.grid,
      cells,
    };
  },

  parseYaml(input: string): PosterDocument {
    return JSON.parse(input) as PosterDocument;
  },

  async layout(ir: PosterDocument, theme: ResolvedTheme): Promise<Scene> {
    return layoutPoster(ir, theme);
  },
};

function parseCell(raw: any): import('./ir.js').CellContent {
  switch (raw.kind) {
    case 'flow':
    case 'flowchart':
      return { kind: 'flow', doc: flowchart.parseMermaid(raw.rawContent) };
    case 'timeline':
      return { kind: 'timeline', doc: timeline.parseMermaid(raw.rawContent) };
    case 'stat': {
      const [value, label] = raw.rawContent.split('|').map((s: string) => s.trim());
      return { kind: 'stat', value: value ?? '', label };
    }
    case 'text':
    default:
      return { kind: 'text', text: raw.rawContent.trim() };
  }
}
