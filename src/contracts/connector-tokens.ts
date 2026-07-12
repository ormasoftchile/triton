/**
 * Connector Token → Style Map
 *
 * SINGLE SOURCE OF TRUTH for the arrow-token vocabulary shared by both the
 * poster grammar and the flowchart grammar.  Any token that appears here has
 * exactly the meaning given; neither grammar may contradict these mappings.
 *
 * Origin column:
 *   Mermaid — token exists in Mermaid with identical semantics (superset rule).
 *   Triton  — new token added by Triton; Mermaid has no such token.
 *
 * Full 5×3 matrix (style × direction):
 *
 *             Directed   Undirected   Bidirectional   Origin
 *  Solid      -->        ---          <-->            Mermaid
 *  Dotted     -.->       -.-          <-.->           Mermaid
 *  Thick      ==>        ===          <==>            Mermaid
 *  Dashed     -_->       -_-          <-_->           Triton
 *  Wavy       -~->       -~-          <-~->           Triton
 *
 * Additional Mermaid marker tokens (flowchart only, endpoint shapes):
 *   --o  directed, solid, endMarker=circle
 *   --x  directed, solid, endMarker=cross
 *
 * PEG ordering rule: longer / extension tokens MUST be listed BEFORE shorter
 * ones so that ordered-choice matches correctly (e.g. -_-> before -_-).
 */

import type { CrossLinkEdgeStyle, CrossLinkEndpointMarker } from './crosslink.js';

export type ConnectorDirection = 'directed' | 'undirected' | 'bidirectional';

export interface ConnectorTokenDescriptor {
  readonly direction: ConnectorDirection;
  readonly style: CrossLinkEdgeStyle;
  readonly startMarker: CrossLinkEndpointMarker;
  readonly endMarker: CrossLinkEndpointMarker;
}

/** Canonical token → descriptor mapping. */
export const CONNECTOR_TOKEN_MAP: Readonly<Record<string, ConnectorTokenDescriptor>> = {
  // ── Bidirectional (list before directed so PEG ordered-choice matches `<-->` before `-->`) ──
  '<-->':   { direction: 'bidirectional', style: 'solid',  startMarker: 'arrow', endMarker: 'arrow' },
  '<-.->':  { direction: 'bidirectional', style: 'dotted', startMarker: 'arrow', endMarker: 'arrow' },
  '<==>':   { direction: 'bidirectional', style: 'thick',  startMarker: 'arrow', endMarker: 'arrow' },
  '<-_->':  { direction: 'bidirectional', style: 'dashed', startMarker: 'arrow', endMarker: 'arrow' },
  '<-~->':  { direction: 'bidirectional', style: 'wavy',   startMarker: 'arrow', endMarker: 'arrow' },

  // ── Directed ──────────────────────────────────────────────────────────────
  '-->':    { direction: 'directed', style: 'solid',  startMarker: 'none', endMarker: 'arrow'  },
  '-.->' : { direction: 'directed', style: 'dotted', startMarker: 'none', endMarker: 'arrow'  },
  '==>':    { direction: 'directed', style: 'thick',  startMarker: 'none', endMarker: 'arrow'  },
  '-_->':   { direction: 'directed', style: 'dashed', startMarker: 'none', endMarker: 'arrow'  },
  '-~->':   { direction: 'directed', style: 'wavy',   startMarker: 'none', endMarker: 'arrow'  },

  // ── Undirected ────────────────────────────────────────────────────────────
  '---':    { direction: 'undirected', style: 'solid',  startMarker: 'none', endMarker: 'none' },
  '-.-':    { direction: 'undirected', style: 'dotted', startMarker: 'none', endMarker: 'none' },
  '===':    { direction: 'undirected', style: 'thick',  startMarker: 'none', endMarker: 'none' },
  '-_-':    { direction: 'undirected', style: 'dashed', startMarker: 'none', endMarker: 'none' },
  '-~-':    { direction: 'undirected', style: 'wavy',   startMarker: 'none', endMarker: 'none' },

  // ── Mermaid endpoint-marker tokens (flowchart only) ──────────────────────
  '--o':    { direction: 'directed', style: 'solid', startMarker: 'none', endMarker: 'circle' },
  '--x':    { direction: 'directed', style: 'solid', startMarker: 'none', endMarker: 'cross'  },
} as const;

/** Infix → style lookup (for grammar rule sharing). */
export const CONNECTOR_INFIX_STYLE: Readonly<Record<string, CrossLinkEdgeStyle>> = {
  '--':  'solid',
  '-.-': 'dotted',
  '==':  'thick',
  '-_-': 'dashed',
  '-~-': 'wavy',
} as const;
