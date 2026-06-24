import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { ArchitectureDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutArchitecture } from './layout.js';
import * as parser from './parser.js';

export type { ArchitectureDocument, ArchService, ArchGroup, ArchEdge } from './ir.js';

export const architecture: DiagramModule<ArchitectureDocument> = {
  parseMermaid(input: string): ArchitectureDocument {
    return parser.parse(input) as ArchitectureDocument;
  },

  parseYaml(input: string): ArchitectureDocument {
    return JSON.parse(input) as ArchitectureDocument;
  },

  layout(ir: ArchitectureDocument, theme: ResolvedTheme): LayoutResult {
    return layoutArchitecture(ir, theme);
  },
};
