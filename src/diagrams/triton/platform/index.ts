import type { DiagramModule } from '../../../contracts/index.js';
import type { PlatformDocument } from './ir.js';
import { parsePlatform } from './parser.js';
import { layoutPlatform } from './layout.js';

export const platform: DiagramModule<PlatformDocument> = {
  parseMermaid: parsePlatform,
  parseYaml(input: string): PlatformDocument {
    return JSON.parse(input) as PlatformDocument;
  },
  layout: layoutPlatform,
};
