import type { DiagramModule } from '../../../contracts/index.js';
import type { PyramidDocument } from './ir.js';
import { parsePyramid } from './parser.js';
import { layoutPyramid } from './layout.js';

export const pyramid: DiagramModule<PyramidDocument> = {
  parseMermaid: parsePyramid,
  parseYaml(input: string): PyramidDocument {
    return JSON.parse(input) as PyramidDocument;
  },
  layout: layoutPyramid,
};
