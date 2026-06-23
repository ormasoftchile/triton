/**
 * @file diagrams/struct/shared.ts — Shared helpers for the strip/memory family.
 */

export const ARROW_ID = 'struct-arrow';

/** A small filled arrowhead marker def in the given colour. */
export function arrowDef(color: string): string {
  return `<marker id="${ARROW_ID}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="${color}" /></marker>`;
}

/** Tokens on the keyword line and directive lines, trimmed and split. */
export function lines(input: string): string[] {
  return input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}
