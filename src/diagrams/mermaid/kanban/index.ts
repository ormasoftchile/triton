import type { DiagramModule, LayoutResult } from '../../../contracts/index.js';
import type { KanbanDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { layoutKanban } from './layout.js';
import * as parser from './parser.js';

export type { KanbanDocument, KanbanColumn, KanbanCard } from './ir.js';

export const kanban: DiagramModule<KanbanDocument> = {
  parseMermaid(input: string): KanbanDocument {
    return parser.parse(input) as KanbanDocument;
  },

  parseYaml(input: string): KanbanDocument {
    return JSON.parse(input) as KanbanDocument;
  },

  layout(ir: KanbanDocument, theme: ResolvedTheme): LayoutResult {
    return layoutKanban(ir, theme);
  },
};
