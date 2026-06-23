/**
 * Overlay Compiler — Converts raw parsed overlay directives into
 * Annotation[] and Legend for attachment to Scene.
 *
 * This is the shared layer. Each diagram's grammar captures overlay
 * syntax as raw data (RawNote, RawLegend), and this module converts
 * them into the Scene-level types.
 *
 * Grammar rules are intentionally thin — they capture structure
 * but don't resolve positions (that happens at layout time).
 */

import type { Annotation, Legend, LegendCorner, LegendEntry } from '../scene/types.js';

// ─── Raw types emitted by grammar rules ────────────────────────────────────────

/** What the grammar's NoteDirective rule produces */
export interface RawNote {
  type: 'note';
  text: string;
  /** Element ID or label this note references */
  target: string;
  /** Optional explicit offset from the target */
  offset?: { dx: number; dy: number };
}

/** What the grammar's LegendBlock rule produces */
export interface RawLegend {
  type: 'legend';
  corner: string;
  title?: string;
  entries: Array<{ key: string; value: string }>;
}

/** Union of all overlay directives a grammar can emit */
export type RawOverlay = RawNote | RawLegend;

// ─── Compilation ───────────────────────────────────────────────────────────────

export interface CompiledOverlays {
  annotations: Annotation[];
  legend?: Legend;
}

/**
 * Compile raw overlay directives from grammar output into Scene-level types.
 *
 * Position resolution for notes is deferred — the layout function must
 * resolve target element IDs to actual positions. The annotation's
 * `anchor.elementId` carries the reference forward.
 */
export function compileOverlays(raw: RawOverlay[]): CompiledOverlays {
  const annotations: Annotation[] = [];
  let legend: Legend | undefined;

  for (const item of raw) {
    switch (item.type) {
      case 'note': {
        const dx = item.offset?.dx ?? 0;
        const dy = item.offset?.dy ?? -60;
        annotations.push({
          id: `note-${slugify(item.target)}-${annotations.length}`,
          text: item.text,
          // Position is relative offset from target — layout resolves absolute
          position: { x: dx, y: dy },
          anchor: { elementId: item.target },
        });
        break;
      }
      case 'legend': {
        const corner = parseLegendCorner(item.corner);
        legend = {
          title: item.title,
          entries: item.entries,
          corner,
        };
        break;
      }
    }
  }

  return { annotations, legend };
}

// ─── Shared Peggy grammar snippet ─────────────────────────────────────────────
//
// Copy these rules into each diagram's .peggy file.
// They produce RawNote / RawLegend objects that compileOverlays() consumes.
//
// ── NoteDirective ──────────────────────────────────────────────────────────
//
//   NoteDirective
//     = _ "note" __ text:QuotedString __ "at" __ target:Identifier
//       offset:NoteOffset? _ Comment? NL {
//         return { type: 'note', text, target, offset: offset || undefined };
//       }
//
//   NoteOffset
//     = __ "offset" __ dx:SignedInt _ "," _ dy:SignedInt {
//         return { dx, dy };
//       }
//
//   SignedInt
//     = sign:"-"? digits:$[0-9]+ { return parseInt((sign || '') + digits, 10); }
//
// ── LegendBlock ────────────────────────────────────────────────────────────
//
//   LegendBlock
//     = _ "legend" __ corner:LegendCorner title:(_ QuotedString)? _ NL
//       entries:LegendEntryLine*
//       _ "end" _ NL? {
//         return {
//           type: 'legend',
//           corner,
//           title: title ? title[1] : undefined,
//           entries,
//         };
//       }
//
//   LegendCorner
//     = "bottom-right" / "bottom-left" / "top-right" / "top-left"
//
//   LegendEntryLine
//     = _ key:$[^:\n]+ _ ":" _ value:$[^\n]+ NL {
//         return { key: key.trim(), value: value.trim() };
//       }
//

// ─── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'note';
}

function parseLegendCorner(raw: string): LegendCorner {
  const valid: LegendCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  return valid.includes(raw as LegendCorner) ? (raw as LegendCorner) : 'bottom-right';
}
