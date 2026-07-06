import type { DiagramModule, LayoutResult } from '../../../contracts/index.js';
import type { QuadrantDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { layoutQuadrant } from './layout.js';
import * as parser from './parser.js';

export type { QuadrantDocument, QuadrantPoint } from './ir.js';

export const quadrant: DiagramModule<QuadrantDocument> = {
  parseMermaid(input: string): QuadrantDocument {
    return parser.parse(input) as QuadrantDocument;
  },

  parseYaml(input: string): QuadrantDocument {
    return JSON.parse(input) as QuadrantDocument;
  },

  layout(ir: QuadrantDocument, theme: ResolvedTheme): LayoutResult {
    return layoutQuadrant(ir, theme);
  },
};
