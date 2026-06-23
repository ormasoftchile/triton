import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { SequenceDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutSequence } from './layout.js';
import * as parser from './parser.js';

export type { SequenceDocument, SeqParticipant, SeqMessage, SeqNote, SeqEvent } from './ir.js';

export const sequence: DiagramModule<SequenceDocument> = {
  parseMermaid(input: string): SequenceDocument {
    return parser.parse(input) as SequenceDocument;
  },

  parseYaml(input: string): SequenceDocument {
    return JSON.parse(input) as SequenceDocument;
  },

  async layout(ir: SequenceDocument, theme: ResolvedTheme): Promise<LayoutResult> {
    return layoutSequence(ir, theme);
  },
};
