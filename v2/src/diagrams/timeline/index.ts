/**
 * Timeline Diagram Module — Public API.
 *
 * Pipeline:
 *   Mermaid text → grammar.peggy → compiler → TimelineDocument
 *   YAML text    → schema (validate) → TimelineDocument
 *   TimelineDocument → layout() → Scene
 *
 * Parse modes:
 *   parseMermaid(input)          → full Triton superset (extensions enabled)
 *   parseMermaidStrict(input)    → Mermaid-compatible only (extensions disabled)
 */

import type { DiagramModule } from '../contract.js';
import type { TimelineDocument } from './ir.js';
import type { Scene } from '../../scene/types.js';
import type { ResolvedTheme } from '../../theme/types.js';
import { layoutTimeline } from './layout.js';
import * as parser from './parser.js';

export type { TimelineDocument, Track, Activity, Milestone, Section, TimelineLayout } from './ir.js';

/**
 * Parse in strict Mermaid-compatible mode.
 * Extension syntax (ranges, statuses, milestones, tracks, frontmatter) will
 * cause a parse error — proving we only accept standard Mermaid.
 */
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
    return JSON.parse(input) as TimelineDocument;
  },

  layout(ir: TimelineDocument, theme: ResolvedTheme): Scene {
    return layoutTimeline(ir, theme);
  },
};
