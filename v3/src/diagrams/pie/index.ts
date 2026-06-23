import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { PieDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutPie } from './layout.js';
import * as parser from './parser.js';

export type { PieDocument, PieSlice } from './ir.js';

export const pie: DiagramModule<PieDocument> = {
  parseMermaid(input: string): PieDocument {
    return parser.parse(input) as PieDocument;
  },

  parseYaml(input: string): PieDocument {
    return JSON.parse(input) as PieDocument;
  },

  async layout(ir: PieDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutPie(ir, theme);
  },
};
