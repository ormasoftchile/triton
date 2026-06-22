import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { RadarDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutRadar } from './layout.js';
import * as parser from './parser.js';

export type { RadarDocument, RadarAxis, RadarCurve } from './ir.js';

export const radar: DiagramModule<RadarDocument> = {
  parseMermaid(input: string): RadarDocument {
    return parser.parse(input) as RadarDocument;
  },

  parseYaml(input: string): RadarDocument {
    return JSON.parse(input) as RadarDocument;
  },

  async layout(ir: RadarDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutRadar(ir, theme);
  },
};
