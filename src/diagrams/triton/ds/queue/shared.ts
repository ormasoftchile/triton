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

import type { Scene, SceneElement, ResolvedTheme, Rect, TextAnchor } from '../../../../contracts/index.js';
import type { Pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';

export { lines } from '../struct/shared.js';

export type StripOrientation = 'horizontal' | 'vertical';
export type PointerSide = 'top' | 'right' | 'bottom' | 'left';

/** Forward arrowhead (apex along travel direction) — use as `markerEnd`. */
export const ARROW_FWD = 'queue-arrow-fwd';
/** Reverse arrowhead (apex against travel direction) — use as `markerStart`. */
export const ARROW_REV = 'queue-arrow-rev';

export function parseAxisToken(token: string | undefined, fallback: StripOrientation): StripOrientation {
  return token === 'horizontal' || token === 'vertical' ? token : fallback;
}

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
  const pointer = pointerToSlot(p, theme, slot, name, color, 'bottom', stack);
  return { elements: pointer.elements, bottom: pointer.outerEdge };
}

export function pointerToSlot(
  p: Pen,
  theme: ResolvedTheme,
  slot: Rect,
  name: string,
  color: string,
  side: PointerSide,
  stack = 0,
): { elements: SceneElement[]; outerEdge: number } {
  const font = theme.typography.baseFontSize;
  const laneGap = font + 6;
  const arrowLen = 30;
  const labelGap = 6;
  const cx = slot.x + slot.width / 2;
  const cy = slot.y + slot.height / 2;

  if (side === 'bottom' || side === 'top') {
    const s = side === 'bottom' ? 1 : -1;
    const laneX = cx;
    const edgeY = side === 'bottom' ? slot.y + slot.height + 4 : slot.y - 4;
    const tailY = edgeY + s * (arrowLen + stack * laneGap);
    const labelY = tailY + s * (labelGap + (s > 0 ? font : 0));
    return {
      elements: [
        p.path(`M ${rhu(laneX)} ${rhu(tailY)} L ${rhu(laneX)} ${rhu(edgeY)}`, color, 1.5, { markerEnd: ARROW_FWD }),
        p.text(name, laneX, labelY, font, color, { anchor: 'middle', weight: 'bold' }),
      ],
      outerEdge: s > 0 ? labelY + 4 : labelY - font - 4,
    };
  }

  const s = side === 'right' ? 1 : -1;
  const laneY = cy + stack * laneGap;
  const edgeX = side === 'right' ? slot.x + slot.width + 4 : slot.x - 4;
  const tailX = edgeX + s * arrowLen;
  const labelX = tailX + s * labelGap;
  const anchor: TextAnchor = s > 0 ? 'start' : 'end';
  return {
    elements: [
      p.path(`M ${rhu(tailX)} ${rhu(laneY)} L ${rhu(edgeX)} ${rhu(laneY)}`, color, 1.5, { markerEnd: ARROW_FWD }),
      p.text(name, labelX, laneY + 4, font, color, { anchor, weight: 'bold' }),
    ],
    outerEdge: labelX,
  };
}

export function finalizeStripScene(
  elements: readonly SceneElement[],
  anchors: Record<string, { bounds: Rect }>,
  theme: ResolvedTheme,
  defs?: readonly string[],
): { scene: Scene; anchors: Record<string, { bounds: Rect }> } {
  const margin = theme.spacing.diagramMargin;
  const contentBounds = boundsForElements(elements);
  const dx = margin - contentBounds.x;
  const dy = margin - contentBounds.y;
  const shiftedElements = translateElements(elements, dx, dy);
  const shiftedAnchors = translateAnchors(anchors, dx, dy);
  return {
    scene: {
      viewBox: {
        x: 0,
        y: 0,
        width: rhu(contentBounds.width + margin * 2),
        height: rhu(contentBounds.height + margin * 2),
      },
      background: theme.palette.background,
      elements: shiftedElements,
      ...(defs !== undefined ? { defs } : {}),
    },
    anchors: shiftedAnchors,
  };
}

export function boundsForElements(elements: readonly SceneElement[]): Rect {
  const bounds = elements.map(boundsForElement).filter((b): b is Rect => b !== undefined);
  if (bounds.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...bounds.map(b => b.x));
  const minY = Math.min(...bounds.map(b => b.y));
  const maxX = Math.max(...bounds.map(b => b.x + b.width));
  const maxY = Math.max(...bounds.map(b => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsForElement(element: SceneElement): Rect | undefined {
  switch (element.type) {
    case 'rect':
      return element.bounds;
    case 'circle':
      return {
        x: element.center.x - element.radius,
        y: element.center.y - element.radius,
        width: element.radius * 2,
        height: element.radius * 2,
      };
    case 'path':
      return boundsForPath(element.d, element.strokeWidth);
    case 'text':
      return boundsForText(element);
    case 'group':
      return boundsForElements(element.children);
  }
}

function boundsForText(text: Extract<SceneElement, { type: 'text' }>): Rect {
  const measured = measureText(text.content, text.fontSize);
  const x = text.anchor === 'middle'
    ? text.position.x - measured.width / 2
    : text.anchor === 'end'
      ? text.position.x - measured.width
      : text.position.x;
  return {
    x,
    y: text.position.y - text.fontSize,
    width: measured.width,
    height: text.fontSize * 1.25,
  };
}

function boundsForPath(d: string, strokeWidth: number): Rect {
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
  if (nums.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const pad = strokeWidth / 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function translateElements(elements: readonly SceneElement[], dx: number, dy: number): SceneElement[] {
  return elements.map(element => translateElement(element, dx, dy));
}

function translateElement(element: SceneElement, dx: number, dy: number): SceneElement {
  switch (element.type) {
    case 'rect':
      return { ...element, bounds: translateRect(element.bounds, dx, dy) };
    case 'circle':
      return { ...element, center: { x: rhu(element.center.x + dx), y: rhu(element.center.y + dy) } };
    case 'path':
      return { ...element, d: translatePathD(element.d, dx, dy) };
    case 'text':
      return { ...element, position: { x: rhu(element.position.x + dx), y: rhu(element.position.y + dy) } };
    case 'group':
      return { ...element, children: translateElements(element.children, dx, dy) };
    case 'icon':
      return { ...element, x: rhu(element.x + dx), y: rhu(element.y + dy) };
  }
}

function translateAnchors(anchors: Record<string, { bounds: Rect }>, dx: number, dy: number): Record<string, { bounds: Rect }> {
  return Object.fromEntries(
    Object.entries(anchors).map(([key, anchor]) => [key, { bounds: translateRect(anchor.bounds, dx, dy) }]),
  );
}

function translateRect(rect: Rect, dx: number, dy: number): Rect {
  return { x: rhu(rect.x + dx), y: rhu(rect.y + dy), width: rect.width, height: rect.height };
}

function translatePathD(d: string, dx: number, dy: number): string {
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, value => {
    const delta = i++ % 2 === 0 ? dx : dy;
    return String(rhu(Number(value) + delta));
  });
}
