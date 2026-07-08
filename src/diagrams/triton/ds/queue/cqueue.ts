/**
 * @file diagrams/queue/cqueue.ts — Circular (ring-buffer) queue.
 *
 * Same horizontal strip as the linear queue, but a curved wrap-around arrow
 * arcs over the strip from the REAR cell back to the FRONT cell — the modular
 * (ring) continuity. `front`/`rear` markers sit beneath their cells and may
 * wrap independently. This is the strip-plus-wrap rendering (not a true radial
 * ring): the intended look of the reference's top-right panel.
 *
 * Value-driven mini-syntax:
 *   cqueue
 *     title ring buffer
 *     capacity 6
 *     cells _ B C D _ _       // `_` (or `.`) is an empty slot
 *     front 1
 *     rear 3
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../../scene/strip.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';
import {
  ARROW_FWD,
  arrowDefs,
  finalizeStripScene,
  lines,
  parseAxisToken,
  pointerBelow,
  pointerToSlot,
  type StripOrientation,
} from './shared.js';

export interface CQueueDoc {
  title?: string;
  capacity: number;
  cells: (string | null)[];
  front?: number;
  rear?: number;
  axis?: StripOrientation;
}

const EMPTY = new Set(['_', '.', '-']);

function parse(input: string): CQueueDoc {
  let title: string | undefined;
  let cells: (string | null)[] = [];
  let capacity: number | undefined;
  let front: number | undefined;
  let rear: number | undefined;
  let axis: StripOrientation = 'horizontal';

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'cqueue') { continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'capacity') { const n = Number(t[1]); if (Number.isFinite(n)) capacity = n; continue; }
    if (t[0] === 'cells' || t[0] === 'items') { cells = t.slice(1).map(v => (EMPTY.has(v) ? null : v)); continue; }
    if (t[0] === 'front') { const n = Number(t[1]); if (Number.isFinite(n)) front = n; continue; }
    if (t[0] === 'rear') { const n = Number(t[1]); if (Number.isFinite(n)) rear = n; continue; }
    if (t[0] === 'axis') { axis = parseAxisToken(t[1], axis); continue; }
  }

  const cap = capacity ?? cells.length;
  // pad / clamp cells to capacity
  const padded: (string | null)[] = Array.from({ length: cap }, (_, i) => cells[i] ?? null);
  // infer front/rear from occupancy when not given
  const firstFilled = padded.findIndex(c => c !== null);
  let lastFilled = -1;
  for (let i = 0; i < padded.length; i++) if (padded[i] !== null) lastFilled = i;
  const f = front ?? (firstFilled >= 0 ? firstFilled : 0);
  const r = rear ?? (lastFilled >= 0 ? lastFilled : 0);

  return {
    ...(title !== undefined ? { title } : {}),
    capacity: cap,
    cells: padded,
    front: f,
    rear: r,
    axis,
  };
}

export function layoutCQueue(doc: CQueueDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 40;
  const total = doc.capacity;
  const labelW = doc.cells.map(c => (c ? measureText(c, font).width : 0));
  const cellW = Math.max(46, ...labelW.map(w => w + 24));
  const axis: StripOrientation = doc.axis === 'vertical' ? 'vertical' : 'horizontal';
  const horizontal = axis === 'horizontal';

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const arcH = 44;                        // room for the wrap arc above the strip
  const origin = horizontal
    ? { x: margin, y: margin + titleH + arcH }
    : { x: margin + arcH, y: margin + titleH };

  const cellInputs: StripCell[] = doc.cells.map((v, i) => (
    v !== null
      ? { label: v, index: String(i) }
      : { fill: palette.background, index: String(i) }
  ));
  const strip = buildStrip(p, theme, cellInputs, { origin, cellWidth: cellW, cellHeight: cellH, orientation: axis });

  const elements: SceneElement[] = [...strip.elements];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // wrap arc: rear cell top → up and over → front cell top, pointing into front
  const rearSlot = strip.slots[doc.rear ?? 0];
  const frontSlot = strip.slots[doc.front ?? 0];
  if (rearSlot && frontSlot) {
    if (horizontal) {
      const rx = rearSlot.x + rearSlot.width / 2;
      const fx = frontSlot.x + frontSlot.width / 2;
      const yTop = origin.y;                 // strip top edge
      const apexY = origin.y - arcH + 8;
      const d = `M ${rhu(rx)} ${rhu(yTop)} C ${rhu(rx)} ${rhu(apexY)}, ${rhu(fx)} ${rhu(apexY)}, ${rhu(fx)} ${rhu(yTop)}`;
      elements.push(p.path(d, palette.primary, 1.5, { markerEnd: ARROW_FWD }));
      const midX = (rx + fx) / 2;
      elements.push(p.text(`mod ${total}`, midX, apexY - 2, typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
    } else {
      const ry = rearSlot.y + rearSlot.height / 2;
      const fy = frontSlot.y + frontSlot.height / 2;
      const xLeft = origin.x;
      const apexX = origin.x - arcH + 8;
      const d = `M ${rhu(xLeft)} ${rhu(ry)} C ${rhu(apexX)} ${rhu(ry)}, ${rhu(apexX)} ${rhu(fy)}, ${rhu(xLeft)} ${rhu(fy)}`;
      elements.push(p.path(d, palette.primary, 1.5, { markerEnd: ARROW_FWD }));
      const midY = (ry + fy) / 2;
      elements.push(p.text(`mod ${total}`, apexX - 4, midY + 4, typography.smallFontSize, palette.textMuted, { anchor: 'end' }));
    }
  }

  // front / rear pointers below
  if (frontSlot && rearSlot) {
    const same = (doc.front ?? 0) === (doc.rear ?? 0);
    const front = horizontal
      ? pointerBelow(p, theme, frontSlot, 'front', palette.secondary, 0)
      : pointerToSlot(p, theme, frontSlot, 'front', palette.secondary, 'right', 0);
    const rear = horizontal
      ? pointerBelow(p, theme, rearSlot, 'rear', palette.primary, same ? 1 : 0)
      : pointerToSlot(p, theme, rearSlot, 'rear', palette.primary, 'right', same ? 1 : 0);
    elements.push(...front.elements, ...rear.elements);
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  strip.slots.forEach((slot, i) => { anchors[`c${i}`] = { bounds: slot }; });

  const finalized = finalizeStripScene(elements, anchors, theme, [arrowDefs(palette.primary)]);
  return { scene: finalized.scene, anchors: finalized.anchors as NodeAnchorRegistry };
}

export const cqueue: DiagramModule<CQueueDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutCQueue(ir, theme);
  },
};
