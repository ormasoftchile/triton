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
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../scene/strip.js';
import { measureText } from '../../../text/metrics.js';
import { rhu } from '../../../util/round.js';
import { ARROW_FWD, arrowDefs, lines, pointerBelow } from './shared.js';

export interface CQueueDoc {
  title?: string;
  capacity: number;
  cells: (string | null)[];
  front?: number;
  rear?: number;
}

const EMPTY = new Set(['_', '.', '-']);

function parse(input: string): CQueueDoc {
  let title: string | undefined;
  let cells: (string | null)[] = [];
  let capacity: number | undefined;
  let front: number | undefined;
  let rear: number | undefined;

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'cqueue') { continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'capacity') { const n = Number(t[1]); if (Number.isFinite(n)) capacity = n; continue; }
    if (t[0] === 'cells' || t[0] === 'items') { cells = t.slice(1).map(v => (EMPTY.has(v) ? null : v)); continue; }
    if (t[0] === 'front') { const n = Number(t[1]); if (Number.isFinite(n)) front = n; continue; }
    if (t[0] === 'rear') { const n = Number(t[1]); if (Number.isFinite(n)) rear = n; continue; }
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

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const arcH = 44;                        // room for the wrap arc above the strip
  const origin = { x: margin, y: margin + titleH + arcH };

  const cellInputs: StripCell[] = doc.cells.map((v, i) => (
    v !== null
      ? { label: v, index: String(i) }
      : { fill: palette.background, index: String(i) }
  ));
  const strip = buildStrip(p, theme, cellInputs, { origin, cellWidth: cellW, cellHeight: cellH });

  const elements: SceneElement[] = [...strip.elements];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // wrap arc: rear cell top → up and over → front cell top, pointing into front
  const rearSlot = strip.slots[doc.rear ?? 0];
  const frontSlot = strip.slots[doc.front ?? 0];
  if (rearSlot && frontSlot) {
    const rx = rearSlot.x + rearSlot.width / 2;
    const fx = frontSlot.x + frontSlot.width / 2;
    const yTop = origin.y;                 // strip top edge
    const apexY = origin.y - arcH + 8;
    const d = `M ${rhu(rx)} ${rhu(yTop)} C ${rhu(rx)} ${rhu(apexY)}, ${rhu(fx)} ${rhu(apexY)}, ${rhu(fx)} ${rhu(yTop)}`;
    elements.push(p.path(d, palette.primary, 1.5, { markerEnd: ARROW_FWD }));
    const midX = (rx + fx) / 2;
    elements.push(p.text(`mod ${total}`, midX, apexY - 2, typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
  }

  // front / rear pointers below
  let bottom = origin.y + cellH;
  if (frontSlot && rearSlot) {
    const same = (doc.front ?? 0) === (doc.rear ?? 0);
    const front = pointerBelow(p, theme, frontSlot, 'front', palette.secondary, 0);
    const rear = pointerBelow(p, theme, rearSlot, 'rear', palette.primary, same ? 1 : 0);
    elements.push(...front.elements, ...rear.elements);
    bottom = Math.max(front.bottom, rear.bottom);
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  strip.slots.forEach((slot, i) => { anchors[`c${i}`] = { bounds: slot }; });

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: strip.bounds.width + margin * 2, height: bottom + margin },
    background: palette.background,
    elements,
    defs: [arrowDefs(palette.primary)],
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
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
