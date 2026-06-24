/**
 * @file diagrams/queue/queue.ts — Linear (FIFO) queue.
 *
 * A horizontal cell strip. Items enter at the REAR (right) via an `enqueue`
 * arrow and leave at the FRONT (left) via a `dequeue` arrow. `front`/`rear`
 * pointers sit beneath the filled cells; a `capacity` larger than the filled
 * count shows trailing empty slots.
 *
 * Value-driven mini-syntax:
 *   queue A B C                 // three filled cells
 *   queue
 *     title task queue
 *     cells A B C
 *     capacity 5                // 2 trailing empty slots
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../scene/strip.js';
import { measureText } from '../../../text/metrics.js';
import { rhu } from '../../../util/round.js';
import { ARROW_FWD, arrowDefs, lines, pointerBelow } from './shared.js';

export interface QueueDoc {
  title?: string;
  cells: string[];
  capacity?: number;
}

function parse(input: string): QueueDoc {
  let title: string | undefined;
  let cells: string[] = [];
  let capacity: number | undefined;

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'queue') { if (t.length > 1) cells = t.slice(1); continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'cells' || t[0] === 'items') { cells = t.slice(1); continue; }
    if (t[0] === 'capacity') { const n = Number(t[1]); if (Number.isFinite(n)) capacity = n; continue; }
  }
  return { ...(title !== undefined ? { title } : {}), cells, ...(capacity !== undefined ? { capacity } : {}) };
}

export function layoutQueue(doc: QueueDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 40;
  const filled = doc.cells.length;
  const total = Math.max(filled, doc.capacity ?? filled);
  const cellW = Math.max(46, ...doc.cells.map(c => measureText(c, font).width + 24));

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const topH = font + 14;                 // room for enqueue / dequeue captions
  const sideGap = 50;                     // room for the end arrows
  const origin = { x: margin + sideGap, y: margin + titleH + topH };

  const cellInputs: StripCell[] = Array.from({ length: total }, (_, i) => (
    i < filled ? { label: doc.cells[i]! } : { fill: palette.background }
  ));
  const strip = buildStrip(p, theme, cellInputs, { origin, cellWidth: cellW, cellHeight: cellH });

  const elements: SceneElement[] = [...strip.elements];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  const midY = origin.y + cellH / 2;
  const leftEdge = origin.x;
  const rightEdge = origin.x + total * cellW;

  // dequeue — leaves at the FRONT (left), pointing out
  elements.push(p.path(`M ${rhu(leftEdge)} ${rhu(midY)} L ${rhu(margin)} ${rhu(midY)}`, palette.primary, 1.5, { markerEnd: ARROW_FWD }));
  elements.push(p.text('dequeue', leftEdge - sideGap / 2, origin.y - 8, font, palette.primary, { anchor: 'middle', weight: 'bold' }));

  // enqueue — enters at the REAR (right), pointing in
  elements.push(p.path(`M ${rhu(rightEdge + sideGap)} ${rhu(midY)} L ${rhu(rightEdge)} ${rhu(midY)}`, palette.primary, 1.5, { markerEnd: ARROW_FWD }));
  elements.push(p.text('enqueue', rightEdge + sideGap / 2, origin.y - 8, font, palette.primary, { anchor: 'middle', weight: 'bold' }));

  // front / rear pointers below the filled span
  let bottom = origin.y + cellH;
  if (filled > 0) {
    const frontSlot = strip.slots[0]!;
    const rearSlot = strip.slots[filled - 1]!;
    const same = filled === 1;
    const front = pointerBelow(p, theme, frontSlot, 'front', palette.secondary, 0);
    const rear = pointerBelow(p, theme, rearSlot, 'rear', palette.primary, same ? 1 : 0);
    elements.push(...front.elements, ...rear.elements);
    bottom = Math.max(front.bottom, rear.bottom);
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  strip.slots.forEach((slot, i) => { anchors[`c${i}`] = { bounds: slot }; });

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: rightEdge + sideGap + margin, height: bottom + margin },
    background: palette.background,
    elements,
    defs: [arrowDefs(palette.primary)],
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const queue: DiagramModule<QueueDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutQueue(ir, theme);
  },
};
