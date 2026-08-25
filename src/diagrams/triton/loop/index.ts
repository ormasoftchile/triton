import type { DiagramModule } from '../../../contracts/index.js';
import type { LoopDocument } from './ir.js';
import { parseLoop } from './parser.js';
import { layoutLoop } from './layout.js';

export const loop: DiagramModule<LoopDocument> = {
  parseMermaid: parseLoop,
  parseYaml(input: string): LoopDocument {
    return JSON.parse(input) as LoopDocument;
  },
  layout: layoutLoop,
};
