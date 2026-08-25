import type { DiagramModule } from '../../../contracts/index.js';
import type { FishboneDocument } from './ir.js';
import { parseFishbone } from './parser.js';
import { layoutFishbone } from './layout.js';

export const fishbone: DiagramModule<FishboneDocument> = {
  parseMermaid: parseFishbone,
  parseYaml(input: string): FishboneDocument {
    return JSON.parse(input) as FishboneDocument;
  },
  layout: layoutFishbone,
};
