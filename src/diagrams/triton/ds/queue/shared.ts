/**
 * @file diagrams/queue/shared.ts — Shared helpers for the queue family.
 *
 * Queue variants (linear, circular, deque, priority) are cell-strip diagrams
 * built on the same kernel (`scene/strip.buildStrip`). They share: two
 * fixed-direction arrowhead markers (forward + reverse, so a deque can draw a
 * double-headed arrow without relying on the renderer-specific
 * `auto-start-reverse` orientation), and a `front`/`rear` pointer-below-cell
 * helper. Pure + deterministic — geometry is a function of inputs only.
 */

import type { SceneElement, ResolvedTheme, Rect } from '../../../../contracts/index.js';
import type { Pen } from '../../../../scene/build.js';
import { rhu } from '../../../../util/round.js';

export { lines } from '../struct/shared.js';

/** Forward arrowhead (apex along travel direction) — use as `markerEnd`. */
export const ARROW_FWD = 'queue-arrow-fwd';
/** Reverse arrowhead (apex against travel direction) — use as `markerStart`. */
export const ARROW_REV = 'queue-arrow-rev';

/**
 * Both arrowhead markers in the given colour.
 * `ARROW_FWD` points in the path's travel direction (markerEnd); `ARROW_REV`
 * points opposite it (markerStart) so a single straight segment can carry two
 * outward-pointing heads — the deque case.
 */
export function arrowDefs(color: string): string {
  return (
    `<marker id="${ARROW_FWD}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto">` +
    `<path d="M0 0 L8 4 L0 8 z" fill="${color}" /></marker>` +
    `<marker id="${ARROW_REV}" markerWidth="9" markerHeight="9" refX="2" refY="4" orient="auto">` +
    `<path d="M8 0 L0 4 L8 8 z" fill="${color}" /></marker>`
  );
}

/**
 * A labelled pointer beneath a strip cell: a short vertical arrow rising into
 * the cell's bottom edge with the name below it. Mirrors `array.ts` pointers.
 * `stack` shifts the label down a row so two pointers on the same cell (e.g.
 * front == rear on a one-element queue) do not collide.
 */
export function pointerBelow(
  p: Pen,
  theme: ResolvedTheme,
  slot: Rect,
  name: string,
  color: string,
  stack = 0,
): { elements: SceneElement[]; bottom: number } {
  const font = theme.typography.baseFontSize;
  const cx = slot.x + slot.width / 2;
  const yTop = slot.y + slot.height + 4;
  const yBot = slot.y + slot.height + 30 + stack * (font + 6);
  const labelY = yBot + font;
  return {
    elements: [
      p.path(`M ${rhu(cx)} ${rhu(yBot)} L ${rhu(cx)} ${rhu(yTop)}`, color, 1.5, { markerEnd: ARROW_FWD }),
      p.text(name, cx, labelY, font, color, { anchor: 'middle', weight: 'bold' }),
    ],
    bottom: labelY + 4,
  };
}
