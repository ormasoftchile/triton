import type { DiagramModule, LayoutResult } from '../../../contracts/index.js';
import type { C4Document } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { layoutC4 } from './layout.js';
import * as parser from './parser.js';

export type { C4Document, C4Node, C4Boundary, C4Rel } from './ir.js';

export const c4: DiagramModule<C4Document> = {
  parseMermaid(input: string): C4Document {
    return parser.parse(input) as C4Document;
  },

  parseYaml(input: string): C4Document {
    return JSON.parse(input) as C4Document;
  },

  layout(ir: C4Document, theme: ResolvedTheme): LayoutResult {
    return layoutC4(ir, theme);
  },
};
