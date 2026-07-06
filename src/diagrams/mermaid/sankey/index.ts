import type { DiagramModule, LayoutResult } from '../../../contracts/index.js';
import type { SankeyDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { layoutSankey } from './layout.js';
import * as parser from './parser.js';

export type { SankeyDocument, SankeyLink } from './ir.js';

export const sankey: DiagramModule<SankeyDocument> = {
  parseMermaid(input: string): SankeyDocument {
    return parser.parse(input) as SankeyDocument;
  },

  parseYaml(input: string): SankeyDocument {
    return JSON.parse(input) as SankeyDocument;
  },

  layout(ir: SankeyDocument, theme: ResolvedTheme): LayoutResult {
    return layoutSankey(ir, theme);
  },
};
