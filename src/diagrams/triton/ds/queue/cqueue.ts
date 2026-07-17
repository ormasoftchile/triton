/**
 * @file diagrams/queue/cqueue.ts — Circular (ring-buffer) queue.
 *
 * Same horizontal strip as the linear queue, but an orthogonal wrap-around
 * connector routes from the REAR cell back to the FRONT cell — the modular
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
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry, Rect,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../../scene/strip.js';
import { measureText } from '../../../../text/metrics.js';
import { routeConnectors } from '../../../../crosslink/connectors.js';
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

  const rearSlot = strip.slots[doc.rear ?? 0];
  const frontSlot = strip.slots[doc.front ?? 0];
  const anchors: Record<string, { bounds: Rect }> = {};
  strip.slots.forEach((slot, i) => { anchors[`c${i}`] = { bounds: slot }; });
  if (frontSlot) anchors.front = { bounds: frontSlot };
  if (rearSlot) anchors.rear = { bounds: rearSlot };

  // Implicit wrap connector: rear slot → front slot, routed through the shared
  // connector seam with wall hints that keep the channel outboard.
  if (rearSlot && frontSlot) {
    const selfLoop = (doc.front ?? 0) === (doc.rear ?? 0);
    const connectorAnchors = selfLoop
      ? selfLoopWrapAnchors(frontSlot, horizontal)
      : strip.slots.reduce<Record<string, { bounds: Rect }>>((acc, slot, i) => {
        acc[`c${i}`] = { bounds: slot };
        return acc;
      }, {});
    const fromKey = selfLoop ? '__rearWrap' : `c${doc.rear ?? 0}`;
    const toKey = selfLoop ? '__frontWrap' : `c${doc.front ?? 0}`;
    const connectorResult = routeConnectors({
      anchors: connectorAnchors,
      connectors: [{
        fromKey,
        toKey,
        direction: 'directed',
        style: 'solid',
        label: `mod ${total}`,
        routing: 'orthogonal',
        exitWall: horizontal ? 'N' : 'W',
        entryWall: horizontal ? 'N' : 'W',
        animation: 'none',
        props: {
          color: palette.primary,
          routePadding: arcH - 8,
          labelPlacement: 'path-midpoint',
        },
      }],
      theme,
    });
    const connectorElements = connectorResult.elements.map(element =>
      element.type === 'path' && element.markerEnd?.startsWith('triton-crosslink-arrow-')
        ? { ...element, markerEnd: ARROW_FWD, strokeWidth: 1.5 }
        : element,
    );
    const linkPaths = connectorElements.filter(e => e.type !== 'text');
    const linkLabels = connectorElements.filter(e => e.type === 'text');
    elements.push(...linkPaths, ...linkLabels);
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

  const finalized = finalizeStripScene(elements, anchors, theme, [arrowDefs(palette.primary)]);
  return { scene: finalized.scene, anchors: finalized.anchors as NodeAnchorRegistry };
}

function selfLoopWrapAnchors(slot: Rect, horizontal: boolean): Record<string, { bounds: Rect }> {
  if (horizontal) {
    return {
      __rearWrap: { bounds: { x: slot.x + slot.width / 2, y: slot.y, width: slot.width / 2, height: slot.height } },
      __frontWrap: { bounds: { x: slot.x, y: slot.y, width: slot.width / 2, height: slot.height } },
    };
  }
  return {
    __rearWrap: { bounds: { x: slot.x, y: slot.y + slot.height / 2, width: slot.width, height: slot.height / 2 } },
    __frontWrap: { bounds: { x: slot.x, y: slot.y, width: slot.width, height: slot.height / 2 } },
  };
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
