import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { RequirementDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutRequirement } from './layout.js';
import * as parser from './parser.js';

export type { RequirementDocument, ReqNode, ReqRelation, ReqField } from './ir.js';

export const requirement: DiagramModule<RequirementDocument> = {
  parseMermaid(input: string): RequirementDocument {
    return parser.parse(input) as RequirementDocument;
  },

  parseYaml(input: string): RequirementDocument {
    return JSON.parse(input) as RequirementDocument;
  },

  layout(ir: RequirementDocument, theme: ResolvedTheme): LayoutResult {
    return layoutRequirement(ir, theme);
  },
};
