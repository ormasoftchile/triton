import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { ErDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutEr } from './layout.js';
import * as parser from './parser.js';

export type { ErDocument, ErEntity, ErAttribute, ErRelation } from './ir.js';

export const er: DiagramModule<ErDocument> = {
  parseMermaid(input: string): ErDocument {
    return parser.parse(input) as ErDocument;
  },

  parseYaml(input: string): ErDocument {
    return JSON.parse(input) as ErDocument;
  },

  async layout(ir: ErDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutEr(ir, theme);
  },
};
