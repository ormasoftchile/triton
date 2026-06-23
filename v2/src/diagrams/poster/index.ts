/**
 * Poster Diagram Module — Public API.
 */

import type { DiagramModule } from '../contract.js';
import type { PosterDocument } from './ir.js';
import type { Scene } from '../../scene/types.js';
import type { ResolvedTheme } from '../../theme/types.js';
import { layoutPoster } from './layout.js';
import * as parser from './parser.js';
import { timeline } from '../timeline/index.js';
import { flowchart } from '../flowchart/index.js';

export type { PosterDocument, PosterCell, CellContent, PosterGrid } from './ir.js';

export const poster: DiagramModule<PosterDocument> = {
  parseMermaid(input: string): PosterDocument {
    const raw = parser.parse(input) as any;
    // Compile: delegate raw cell content to sub-parsers
    const cells = raw.cells.map((cell: any) => {
      let content;
      // Sub-parsers expect trailing newline
      const src = cell.rawContent.endsWith('\n') ? cell.rawContent : cell.rawContent + '\n';
      switch (cell.kind) {
        case 'flow':
        case 'flowchart': {
          const flowDoc = flowchart.parseMermaid(src);
          content = { kind: 'flow' as const, doc: flowDoc };
          break;
        }
        case 'timeline': {
          const timelineDoc = timeline.parseMermaid(src);
          content = { kind: 'timeline' as const, doc: timelineDoc };
          break;
        }
        case 'stat': {
          const parts = cell.rawContent.split('|').map((s: string) => s.trim());
          content = { kind: 'stat' as const, value: parts[0], label: parts[1] };
          break;
        }
        case 'text':
        default:
          content = { kind: 'text' as const, text: cell.rawContent };
          break;
      }
      return {
        id: cell.id,
        title: cell.title,
        colSpan: cell.span?.colSpan,
        rowSpan: cell.span?.rowSpan,
        content,
      };
    });
    return {
      version: raw.version,
      metadata: raw.metadata,
      grid: raw.grid,
      cells,
    };
  },

  parseYaml(input: string): PosterDocument {
    // TODO: validate against schema
    return JSON.parse(input) as PosterDocument;
  },

  layout(ir: PosterDocument, theme: ResolvedTheme): Scene {
    return layoutPoster(ir, theme);
  },
};
