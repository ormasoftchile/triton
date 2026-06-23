import type { DiagramModule, LayoutResult, LayoutOptions } from '../../contracts/index.js';
import type { TimelineDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutTimeline } from './layout.js';
import * as parser from './parser.js';

export type { TimelineDocument, Track, Activity, Milestone, Section, TimelineLayout, ActivityStatus } from './ir.js';

/** Parse in strict Mermaid-compatible mode — extension syntax throws. */
export function parseMermaidStrict(input: string): TimelineDocument {
  return parser.parse(input, { extensions: false }) as TimelineDocument;
}

export const timeline: DiagramModule<TimelineDocument> = {
  parseMermaid(input: string): TimelineDocument {
    const raw = parser.parse(input, { extensions: true }) as any;
    return {
      ...raw,
      overlays: raw.overlays?.length > 0 ? raw.overlays : undefined,
    };
  },

  parseYaml(input: string): TimelineDocument {
    // TODO: replace with schema validation
    return JSON.parse(input) as TimelineDocument;
  },

  async layout(ir: TimelineDocument, theme: ResolvedTheme, options?: LayoutOptions): Promise<LayoutResult> {
    return layoutTimeline(ir, theme);
  },
};
