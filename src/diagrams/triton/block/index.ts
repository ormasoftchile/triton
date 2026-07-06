import type { DiagramModule, LayoutResult } from '../../../contracts/index.js';
import type { BlockDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { layoutBlock } from './layout.js';
import * as parser from './parser.js';

export type { BlockDocument, BlockNode, BlockEdge } from './ir.js';

export const block: DiagramModule<BlockDocument> = {
  parseMermaid(input: string): BlockDocument {
    return parser.parse(input) as BlockDocument;
  },

  parseYaml(input: string): BlockDocument {
    return JSON.parse(input) as BlockDocument;
  },

  layout(ir: BlockDocument, theme: ResolvedTheme): LayoutResult {
    return layoutBlock(ir, theme);
  },
};
