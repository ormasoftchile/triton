import type { DiagramModule, LayoutResult } from '../../../contracts/index.js';
import type { JourneyDocument } from './ir.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { layoutJourney } from './layout.js';
import * as parser from './parser.js';

export type { JourneyDocument, JourneySection, JourneyTask } from './ir.js';

export const journey: DiagramModule<JourneyDocument> = {
  parseMermaid(input: string): JourneyDocument {
    return parser.parse(input) as JourneyDocument;
  },

  parseYaml(input: string): JourneyDocument {
    return JSON.parse(input) as JourneyDocument;
  },

  layout(ir: JourneyDocument, theme: ResolvedTheme): LayoutResult {
    return layoutJourney(ir, theme);
  },
};
