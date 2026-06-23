/**
 * Diagram Module Contract
 *
 * Every diagram type in src/diagrams/<type>/ MUST follow this shape:
 *
 * Required files:
 *   ir.ts           — Canonical IR types (TypeScript interfaces)
 *   index.ts        — Public API: { parseMermaid, parseYaml, layout }
 *
 * Optional files:
 *   grammar.peggy   — PEG grammar (Mermaid syntax → raw AST)
 *   parser.js       — AUTO-GENERATED from grammar.peggy (do not edit)
 *   parser.d.ts     — AUTO-GENERATED type declarations
 *   schema.ts       — JSON Schema / Zod for YAML validation
 *   compiler.ts     — AST → IR transforms (if grammar output ≠ IR)
 *
 * Pipeline (identical for every diagram type):
 *
 *   ┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌───────┐
 *   │ Mermaid Text│────▶│ parser.js│────▶│   IR     │────▶│ Scene │
 *   └─────────────┘     └──────────┘     └──────────┘     └───────┘
 *                                              ▲
 *   ┌─────────────┐     ┌──────────┐          │
 *   │  YAML Input │────▶│ schema.ts│──────────┘
 *   └─────────────┘     └──────────┘
 *
 * Special case — Poster (composition):
 *   Poster's layout() receives resolved child Scenes, not raw text.
 *   It delegates parsing/layout to child diagram modules, then arranges
 *   the resulting Scenes in a grid.
 */

import type { Scene } from '../scene/types.js';
import type { ResolvedTheme } from '../theme/types.js';

/**
 * Every diagram module must satisfy this interface.
 *
 * The generic `IR` is the diagram-specific intermediate representation.
 * For poster, IR includes references to child diagram IRs.
 */
export interface DiagramModule<IR> {
  /** Parse Mermaid text into the canonical IR. */
  parseMermaid(input: string): IR;

  /** Validate and parse YAML into the canonical IR. */
  parseYaml(input: string): IR;

  /** Layout the IR into a renderable Scene. */
  layout(ir: IR, theme: ResolvedTheme): Scene;
}

/**
 * Theme tokens that every diagram's layout() can rely on.
 * The ResolvedTheme is shared — no diagram gets "special" theme keys
 * unless they're documented in the base contract.
 *
 * This ensures uniformity: changing `theme.palette.primary` affects
 * flowchart edges, timeline connectors, and poster borders identically.
 */
export type { ResolvedTheme } from '../theme/types.js';

