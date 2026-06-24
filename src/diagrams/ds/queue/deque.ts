/**
 * @file diagrams/queue/deque.ts — Double-ended queue (deque).
 *
 * A horizontal cell strip with a double-headed arrow at BOTH ends: insert and
 * remove are legal at the front (left) and the rear (right). `front`/`rear`
 * markers sit beneath the end cells.
 *
 * Value-driven mini-syntax:
 *   deque A B C D
 *   deque
 *     title work-stealing deque
 *     cells A B C D
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../scene/strip.js';
import { measureText } from '../../../text/metrics.js';
import { rhu } from '../../../util/round.js';
import { ARROW_FWD, ARROW_REV, arrowDefs, lines, pointerBelow } from './shared.js';

export interface DequeDoc {
  title?: string;
  cells: string[];
}

function parse(input: string): DequeDoc {
  let title: string | undefined;
  let cells: string[] = [];
  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'deque') { if (t.length > 1) cells = t.slice(1); continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'cells' || t[0] === 'items') { cells = t.slice(1); continue; }
  }
  return { ...(title !== undefined ? { title } : {}), cells };
}

export function layoutDeque(doc: DequeDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 40;
  const n = doc.cells.length;
  const cellW = Math.max(46, ...doc.cells.map(c => measureText(c, font).width + 24));

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const topH = font + 14;                  // room for the push/pop captions
  const sideGap = 56;                      // room for the double-headed end arrows
  const origin = { x: margin + sideGap, y: margin + titleH + topH };

  const cellInputs: StripCell[] = doc.cells.map(v => ({ label: v }));
  const strip = buildStrip(p, theme, cellInputs, { origin, cellWidth: cellW, cellHeight: cellH });

  const elements: SceneElement[] = [...strip.elements];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  const midY = origin.y + cellH / 2;
  const leftEdge = origin.x;
  const rightEdge = origin.x + n * cellW;

  // double-headed arrow at the FRONT (left)
  elements.push(p.path(`M ${rhu(leftEdge)} ${rhu(midY)} L ${rhu(margin)} ${rhu(midY)}`, palette.primary, 1.5, { markerStart: ARROW_REV, markerEnd: ARROW_FWD }));
  elements.push(p.text('push / pop', leftEdge - sideGap / 2, origin.y - 8, font, palette.primary, { anchor: 'middle', weight: 'bold' }));

  // double-headed arrow at the REAR (right)
  elements.push(p.path(`M ${rhu(rightEdge)} ${rhu(midY)} L ${rhu(rightEdge + sideGap)} ${rhu(midY)}`, palette.primary, 1.5, { markerStart: ARROW_REV, markerEnd: ARROW_FWD }));
  elements.push(p.text('push / pop', rightEdge + sideGap / 2, origin.y - 8, font, palette.primary, { anchor: 'middle', weight: 'bold' }));

  // front / rear pointers
  let bottom = origin.y + cellH;
  if (n > 0) {
    const frontSlot = strip.slots[0]!;
    const rearSlot = strip.slots[n - 1]!;
    const same = n === 1;
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

export const deque: DiagramModule<DequeDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutDeque(ir, theme);
  },
};
