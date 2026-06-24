import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { PacketDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutPacket } from './layout.js';
import * as parser from './parser.js';

export type { PacketDocument, PacketField } from './ir.js';

export const packet: DiagramModule<PacketDocument> = {
  parseMermaid(input: string): PacketDocument {
    return parser.parse(input) as PacketDocument;
  },

  parseYaml(input: string): PacketDocument {
    return JSON.parse(input) as PacketDocument;
  },

  layout(ir: PacketDocument, theme: ResolvedTheme): LayoutResult {
    return layoutPacket(ir, theme);
  },
};
