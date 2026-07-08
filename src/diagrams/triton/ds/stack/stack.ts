/**
 * @file diagrams/ds/stack/stack.ts — LIFO stack (vertical cell strip + top marker).
 *
 * A vertical run of cells. The most-recently-pushed item sits at the TOP
 * (smallest y); push and pop both happen at the top. A `top` pointer points
 * into the top-of-stack cell from the left; a `capacity` larger than the
 * filled count shows empty slots above the top (the stack grows upward).
 *
 * Value-driven mini-syntax:
 *   stack A B C D                 // push order; D is on top
 *   stack
 *     title call stack
 *     cells main parse layout     // layout is on top
 *     capacity 6                  // 3 empty slots above
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../../scene/strip.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';
import { finalizeStripScene, parseAxisToken, pointerToSlot, type StripOrientation } from '../queue/shared.js';
import { ARROW_ID, arrowDef, lines } from '../struct/shared.js';

export interface StackDoc {
  title?: string;
  /** Push order — the last element is the top of the stack. */
  cells: string[];
  capacity?: number;
  axis?: StripOrientation;
}

function parse(input: string): StackDoc {
  let title: string | undefined;
  let cells: string[] = [];
  let capacity: number | undefined;
  let axis: StripOrientation = 'vertical';

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'stack') { if (t.length > 1) cells = t.slice(1); continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'cells' || t[0] === 'items') { cells = t.slice(1); continue; }
    if (t[0] === 'capacity') { const n = Number(t[1]); if (Number.isFinite(n)) capacity = n; continue; }
    if (t[0] === 'axis') { axis = parseAxisToken(t[1], axis); continue; }
  }
  return { ...(title !== undefined ? { title } : {}), cells, ...(capacity !== undefined ? { capacity } : {}), axis };
}

export function layoutStack(doc: StackDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 38;
  const filled = doc.cells.length;
  const total = Math.max(filled, doc.capacity ?? filled, 1);
  const empty = total - filled;
  const cellW = Math.max(64, ...doc.cells.map(c => measureText(c, font).width + 28));
  const axis: StripOrientation = doc.axis === 'horizontal' ? 'horizontal' : 'vertical';
  const horizontal = axis === 'horizontal';

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const topH = font + 18;                  // room for the push / pop caption
  const sideGap = 64;                      // room for the `top` pointer on the left
  const origin = horizontal
    ? { x: margin, y: margin + titleH + topH }
    : { x: margin + sideGap, y: margin + titleH + topH };

  // Top-of-stack drawn at the top: empty slots first, then filled cells in
  // reverse push order (last pushed is topmost).
  const display: (string | null)[] = [
    ...Array.from({ length: empty }, () => null),
    ...[...doc.cells].reverse(),
  ];
  const cellInputs: StripCell[] = display.map(v => (
    v !== null ? { label: v } : { fill: palette.background }
  ));
  const strip = buildStrip(p, theme, cellInputs, {
    origin, cellWidth: cellW, cellHeight: cellH, orientation: axis,
  });

  const elements: SceneElement[] = [...strip.elements];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  const topSlot = filled > 0 ? strip.slots[empty]! : strip.slots[0];
  const actionX = topSlot ? topSlot.x + topSlot.width / 2 : origin.x + cellW / 2;
  elements.push(p.text('push / pop', actionX, origin.y - 9, font, palette.primary, { anchor: 'middle', weight: 'bold' }));
  elements.push(p.path(`M ${rhu(actionX)} ${rhu(origin.y - topH + 8)} L ${rhu(actionX)} ${rhu(origin.y)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));

  // `top` pointer — points into the top-of-stack cell
  if (filled > 0) {
    if (horizontal) {
      const top = pointerToSlot(p, theme, topSlot!, 'top', palette.secondary, 'bottom', 0);
      elements.push(...top.elements);
    } else {
      const cyTop = topSlot!.y + topSlot!.height / 2;
      elements.push(p.path(`M ${rhu(origin.x - sideGap + 8)} ${rhu(cyTop)} L ${rhu(origin.x)} ${rhu(cyTop)}`, palette.secondary, 1.5, { markerEnd: ARROW_ID }));
      elements.push(p.text('top', origin.x - sideGap + 6, cyTop - 6, font, palette.secondary, { anchor: 'start', weight: 'bold' }));
    }
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  strip.slots.forEach((slot, i) => { anchors[`c${i}`] = { bounds: slot }; });

  const finalized = finalizeStripScene(elements, anchors, theme, [arrowDef(palette.primary)]);
  return { scene: finalized.scene, anchors: finalized.anchors as NodeAnchorRegistry };
}

export const stack: DiagramModule<StackDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutStack(ir, theme);
  },
};
