import type { DiagramModule, LayoutResult } from '../../../contracts/index.js';
import type { ClassDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { layoutClass } from './layout.js';
import * as parser from './parser.js';

export type { ClassDocument, ClassBox, ClassMember, ClassRelation } from './ir.js';

export const classDiagram: DiagramModule<ClassDocument> = {
  parseMermaid(input: string): ClassDocument {
    return parser.parse(input) as ClassDocument;
  },

  parseYaml(input: string): ClassDocument {
    return JSON.parse(input) as ClassDocument;
  },

  layout(ir: ClassDocument, theme: ResolvedTheme): LayoutResult {
    return layoutClass(ir, theme);
  },
};
