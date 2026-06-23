import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { StateDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutState } from './layout.js';
import * as parser from './parser.js';

export type { StateDocument, StateNode, StateTransition } from './ir.js';

export const state: DiagramModule<StateDocument> = {
  parseMermaid(input: string): StateDocument {
    return parser.parse(input) as StateDocument;
  },

  parseYaml(input: string): StateDocument {
    return JSON.parse(input) as StateDocument;
  },

  async layout(ir: StateDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutState(ir, theme);
  },
};
