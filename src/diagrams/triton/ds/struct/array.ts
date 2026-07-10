/**
 * @file diagrams/struct/array.ts — Contiguous array (cell strip + pointers).
 *
 * Value-driven mini-syntax:
 *   array 5 8 13 21 34        // cells on the header line, or:
 *   array
 *     title nums
 *     cells 5 8 ... 34
 *     axis vertical
 *     index bottom reverse
 *     ptr i -> 2 "slow pointer"
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry, Rect, TextAnchor,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';
import { ARROW_ID, arrowDef, lines, tokenizeDirective } from './shared.js';

export type ArrayAxis = 'horizontal' | 'vertical';
export type ArrayIndexSide = 'before' | 'after';
export type ArrayIndexOrder = 'normal' | 'reverse';

export interface ArrayValueCell {
  readonly kind: 'value';
  readonly value: string;
}

export interface ArrayGapCell {
  readonly kind: 'gap';
}

export type ArrayCell = ArrayValueCell | ArrayGapCell;

export interface ArrayPointerTarget {
  readonly raw: string;
  readonly value?: number;
  readonly anchor?: string;
}

export interface ArrayPointer {
  readonly id: string;
  readonly label?: string;
  readonly target: ArrayPointerTarget;
}

export interface ArrayDoc {
  readonly title?: string;
  readonly axis: ArrayAxis;
  readonly index: {
    readonly show: boolean;
    readonly side: ArrayIndexSide;
    readonly order: ArrayIndexOrder;
  };
  readonly cells: readonly ArrayCell[];
  readonly ptrs: readonly ArrayPointer[];
  /** Logical indices of cells to render with an accent highlight fill. */
  readonly highlights?: readonly number[];
  /** Contiguous range [start, end] (inclusive logical indices) to highlight. */
  readonly window?: { readonly start: number; readonly end: number };
}

interface ArrayIndexMetadata {
  readonly physicalToLogical: readonly (number | null)[];
  readonly indexToPhysical: ReadonlyMap<number, number>;
  readonly nonGapPhysicals: readonly number[];
  readonly gapPhysical?: number;
}

interface ResolvedPointer {
  readonly ptr: ArrayPointer;
  readonly physical: number;
}

interface LabelLaneInput {
  readonly ptrIndex: number;
  readonly start: number;
  readonly end: number;
}

function parse(input: string): ArrayDoc {
  let title: string | undefined;
  let cells: ArrayCell[] = [];
  let axis: ArrayAxis = 'horizontal';
  let indexShow = false;
  let indexSide: ArrayIndexSide = 'before';
  let indexOrder: ArrayIndexOrder = 'normal';
  const ptrs: ArrayPointer[] = [];
  let highlights: number[] | undefined;
  let win: { start: number; end: number } | undefined;

  for (const line of lines(input)) {
    const t = tokenizeDirective(line);
    if (t.length === 0) continue;

    if (t[0] === 'array') {
      if (t.length > 1) cells = parseCells(t.slice(1));
      continue;
    }

    if (t[0] === 'title') {
      title = t.slice(1).join(' ');
      continue;
    }

    if (t[0] === 'cells') {
      cells = parseCells(t.slice(1));
      continue;
    }

    if (t[0] === 'axis') {
      if (t[1] === 'vertical' || t[1] === 'horizontal') axis = t[1];
      continue;
    }

    if (t[0] === 'index') {
      indexShow = true;
      for (const mod of t.slice(1)) {
        if (mod === 'bottom') indexSide = 'after';
        if (mod === 'top') indexSide = 'before';
        if (mod === 'reverse') indexOrder = 'reverse';
      }
      continue;
    }

    if (t[0] === 'highlight') {
      highlights = t.slice(1).map(Number).filter(n => !isNaN(n) && Number.isInteger(n));
      continue;
    }

    if (t[0] === 'window' && t[1]) {
      const m = t[1].match(/^(\d+)-(\d+)$/);
      if (m) win = { start: Number(m[1]), end: Number(m[2]) };
      continue;
    }

    if (t[0] === 'ptr' && t.length >= 4 && t[2] === '->') {
      ptrs.push({ id: t[1]!, target: parsePointerTarget(t[3]!), ...(t[4] !== undefined ? { label: t[4] } : {}) });
    }
  }

  return {
    ...(title !== undefined ? { title } : {}),
    axis,
    index: { show: indexShow, side: indexSide, order: indexOrder },
    cells,
    ptrs,
    ...(highlights !== undefined && highlights.length > 0 ? { highlights } : {}),
    ...(win !== undefined ? { window: win } : {}),
  };
}

function parseCells(tokens: readonly string[]): ArrayCell[] {
  const cells = tokens.map(token => token === '...' ? { kind: 'gap' } as const : { kind: 'value', value: token } as const);
  const gapPositions = cells
    .map((cell, i) => cell.kind === 'gap' ? i : -1)
    .filter(i => i >= 0);

  if (gapPositions.length > 1) throw new Error('Array cells may contain at most one ... gap');
  if (gapPositions.length === 1) {
    const gap = gapPositions[0]!;
    if (gap === 0 || gap === cells.length - 1) throw new Error('Array ... gap must be between concrete cells');
  }

  return cells;
}

function parsePointerTarget(raw: string): ArrayPointerTarget {
  if (/^\d+$/.test(raw)) return { raw, value: Number(raw) };
  if (/^c\d+$/.test(raw) || raw === 'cfirst' || raw === 'clast' || raw === 'cgap') return { raw, anchor: raw };
  return { raw, anchor: raw };
}

function metadataFor(doc: ArrayDoc): ArrayIndexMetadata {
  const physicalToLogical = new Array<number | null>(doc.cells.length).fill(null);
  const indexToPhysical = new Map<number, number>();
  const nonGapPhysicals: number[] = [];
  let gapPhysical: number | undefined;

  doc.cells.forEach((cell, physical) => {
    if (cell.kind === 'gap') {
      gapPhysical = physical;
    } else {
      nonGapPhysicals.push(physical);
    }
  });

  const logicalCount = nonGapPhysicals.length;
  nonGapPhysicals.forEach((physical, rank) => {
    const logical = doc.index.order === 'reverse' ? logicalCount - 1 - rank : rank;
    physicalToLogical[physical] = logical;
    indexToPhysical.set(logical, physical);
  });

  return {
    physicalToLogical,
    indexToPhysical,
    nonGapPhysicals,
    ...(gapPhysical !== undefined ? { gapPhysical } : {}),
  };
}

export function resolveArrayElementAnchorId(doc: ArrayDoc, elementIndex: number): string | undefined {
  const meta = metadataFor(normalizeArrayDoc(doc));
  const logicalCount = meta.nonGapPhysicals.length;

  if (elementIndex < 0) {
    const fromEnd = Math.abs(elementIndex);
    if (fromEnd < 1 || fromEnd > logicalCount) return undefined;
    if (fromEnd === 1) return meta.nonGapPhysicals.length > 0 ? 'clast' : undefined;
    return `c${logicalCount - fromEnd}`;
  }

  if (doc.cells[elementIndex]?.kind === 'gap') return 'cgap';
  return meta.indexToPhysical.has(elementIndex) ? `c${elementIndex}` : undefined;
}

export function layoutArray(inputDoc: ArrayDoc, theme: ResolvedTheme): LayoutResult {
  const doc = normalizeArrayDoc(inputDoc);
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;
  const cellH = 40;
  const cellW = Math.max(40, ...doc.cells.map(c => measureText(c.kind === 'gap' ? '…' : c.value, font).width + 24));
  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const indexBand = doc.index.show ? smallFont + 12 : 0;
  const arrowLen = 30;
  const labelGap = 6;
  const indexPad = 6;
  const horizontal = doc.axis === 'horizontal';
  const meta = metadataFor(doc);
  const resolvedPtrs = doc.ptrs
    .map((ptr): ResolvedPointer | null => {
      const physical = resolvePointerPhysical(ptr.target, doc, meta);
      return physical === undefined ? null : { ptr, physical };
    })
    .filter((ptr): ptr is ResolvedPointer => ptr !== null);

  const labelFont = font;
  const labelLaneGap = labelFont + 8;
  const pointerSide: ArrayIndexSide = doc.index.side === 'before' ? 'after' : 'before';
  const horizontalLanes = horizontal ? assignHorizontalPointerLanes(resolvedPtrs, doc, meta, cellW, labelFont) : [];
  const pointerLaneCount = Math.max(0, ...horizontalLanes.map(l => l + 1));
  const pointerBand = resolvedPtrs.length === 0
    ? 0
    : horizontal
      ? arrowLen + labelGap + labelFont + Math.max(0, pointerLaneCount - 1) * labelLaneGap + 4
      : arrowLen + labelGap + maxPointerLabelWidth(resolvedPtrs, labelFont) + 8;

  const topBand = horizontal
    ? (doc.index.show && doc.index.side === 'before' ? indexBand : 0)
      + (pointerSide === 'before' ? pointerBand : 0)
    : 0;
  const leftBand = !horizontal
    ? (doc.index.show && doc.index.side === 'before' ? smallFont * 2 + indexPad : 0)
      + (pointerSide === 'before' ? pointerBand : 0)
    : 0;
  const origin = {
    x: leftBand,
    y: titleH + topBand,
  };
  const slots = buildSlots(doc.cells.length, origin, cellW, cellH, doc.axis);

  const elements: SceneElement[] = [];
  if (doc.title) {
    elements.push(p.text(doc.title, origin.x, typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  doc.cells.forEach((cell, physical) => {
    const slot = slots[physical]!;
    if (cell.kind === 'gap') {
      elements.push(p.rect(slot, palette.surface, palette.border, 1.5, { rx: 3, opacity: 0.45 }));
      elements.push(p.text('…', slot.x + cellW / 2, slot.y + cellH / 2 + 5, font, palette.textMuted, { anchor: 'middle', weight: 'bold' }));
      return;
    }

    const logicalMaybe = meta.physicalToLogical[physical];
    const logical: number | null = logicalMaybe ?? null;
    const isHighlit = logical !== null && (
      (doc.highlights?.includes(logical) ?? false) ||
      (doc.window !== undefined && logical >= doc.window.start && logical <= doc.window.end)
    );

    if (isHighlit) {
      elements.push(p.rect(slot, palette.primary, palette.primary, 2, { rx: 3, fillOpacity: 0.22 }));
    } else {
      elements.push(p.rect(slot, palette.surface, palette.border, 1.5, { rx: 3 }));
    }
    elements.push(p.text(cell.value, slot.x + cellW / 2, slot.y + cellH / 2 + 5, font, isHighlit ? palette.primary : palette.text, { anchor: 'middle', weight: 'bold' }));

    if (doc.index.show && logical !== null) {
      elements.push(renderIndexText(p, theme, String(logical), slot, cellW, cellH, doc.axis, doc.index.side, indexPad));
    }
  });

  if (horizontal) {
    renderHorizontalPointers(elements, p, theme, resolvedPtrs, slots, pointerSide, horizontalLanes, arrowLen, labelGap, labelLaneGap);
  } else {
    renderVerticalPointers(elements, p, theme, resolvedPtrs, slots, doc.index.side, arrowLen, labelGap);
  }

  const anchors: Record<string, { bounds: Rect }> = {};
  meta.indexToPhysical.forEach((physical, logical) => {
    anchors[`c${logical}`] = { bounds: slots[physical]! };
  });
  if (meta.nonGapPhysicals.length > 0) {
    anchors.cfirst = { bounds: slots[meta.nonGapPhysicals[0]!]! };
    anchors.clast = { bounds: slots[meta.nonGapPhysicals[meta.nonGapPhysicals.length - 1]!]! };
  }
  if (meta.gapPhysical !== undefined) {
    anchors.cgap = { bounds: slots[meta.gapPhysical]! };
  }

  const contentBounds = boundsForElements(elements);
  const dx = margin - contentBounds.x;
  const dy = margin - contentBounds.y;
  const shiftedElements = translateElements(elements, dx, dy);
  const shiftedAnchors = translateAnchors(anchors, dx, dy);
  const scene: Scene = {
    viewBox: {
      x: 0,
      y: 0,
      width: rhu(contentBounds.width + margin * 2),
      height: rhu(contentBounds.height + margin * 2),
    },
    background: palette.background,
    elements: shiftedElements,
    defs: [arrowDef(palette.primary)],
  };
  return { scene, anchors: shiftedAnchors as NodeAnchorRegistry };
}

function normalizeArrayDoc(doc: ArrayDoc | any): ArrayDoc {
  const cells: ArrayCell[] = (doc.cells ?? []).map((cell: string | ArrayCell) =>
    typeof cell === 'string' ? (cell === '...' ? { kind: 'gap' } : { kind: 'value', value: cell }) : cell,
  );
  const index = typeof doc.index === 'boolean'
    ? { show: doc.index, side: 'before' as const, order: 'normal' as const }
    : {
        show: Boolean(doc.index?.show),
        side: doc.index?.side === 'after' ? 'after' as const : 'before' as const,
        order: doc.index?.order === 'reverse' ? 'reverse' as const : 'normal' as const,
      };
  return {
    ...(doc.title !== undefined ? { title: doc.title } : {}),
    axis: doc.axis === 'vertical' ? 'vertical' : 'horizontal',
    index,
    cells,
    ptrs: (doc.ptrs ?? []).map((ptr: any) => {
      if ('idx' in ptr) return { id: ptr.name ?? ptr.id, target: { raw: String(ptr.idx), value: Number(ptr.idx) } };
      return ptr;
    }),
    ...(Array.isArray(doc.highlights) && doc.highlights.length > 0 ? { highlights: doc.highlights as number[] } : {}),
    ...(doc.window !== undefined ? { window: doc.window as { start: number; end: number } } : {}),
  };
}

function buildSlots(count: number, origin: { x: number; y: number }, cellW: number, cellH: number, axis: ArrayAxis): Rect[] {
  return Array.from({ length: count }, (_, i) => ({
    x: origin.x + (axis === 'horizontal' ? i * cellW : 0),
    y: origin.y + (axis === 'horizontal' ? 0 : i * cellH),
    width: cellW,
    height: cellH,
  }));
}

function resolvePointerPhysical(target: ArrayPointerTarget, doc: ArrayDoc, meta: ArrayIndexMetadata): number | undefined {
  if (target.value !== undefined) {
    const physical = meta.indexToPhysical.get(target.value);
    if (physical !== undefined) return physical;
    if (doc.cells[target.value]?.kind === 'gap') return meta.gapPhysical;
    return undefined;
  }

  if (!target.anchor) return undefined;
  if (target.anchor === 'cfirst') return meta.nonGapPhysicals[0];
  if (target.anchor === 'clast') return meta.nonGapPhysicals[meta.nonGapPhysicals.length - 1];
  if (target.anchor === 'cgap') return meta.gapPhysical;
  const cMatch = target.anchor.match(/^c(\d+)$/);
  if (cMatch) return meta.indexToPhysical.get(Number(cMatch[1]));
  return undefined;
}

function renderIndexText(
  p: ReturnType<typeof pen>,
  theme: ResolvedTheme,
  value: string,
  slot: Rect,
  cellW: number,
  cellH: number,
  axis: ArrayAxis,
  side: ArrayIndexSide,
  indexPad: number,
): SceneElement {
  const { palette, typography } = theme;
  if (axis === 'horizontal') {
    const x = slot.x + cellW / 2;
    const y = side === 'before' ? slot.y - 6 : slot.y + cellH + typography.smallFontSize + 4;
    return p.text(value, x, y, typography.smallFontSize, palette.textMuted, { anchor: 'middle' });
  }

  const centerY = slot.y + cellH / 2;
  const x = side === 'before' ? slot.x - indexPad : slot.x + cellW + indexPad;
  const anchor: TextAnchor = side === 'before' ? 'end' : 'start';
  return p.text(value, x, centerY + 4, typography.smallFontSize, palette.textMuted, { anchor });
}

function assignHorizontalPointerLanes(
  ptrs: readonly ResolvedPointer[],
  doc: ArrayDoc,
  meta: ArrayIndexMetadata,
  cellW: number,
  font: number,
): number[] {
  const intervals: LabelLaneInput[] = ptrs.map((ptr, ptrIndex) => {
    const cx = slotCenterX(ptr.physical, cellW);
    const text = pointerLabel(ptr.ptr);
    const width = measureText(text, font).width + 8;
    return { ptrIndex, start: cx - width / 2, end: cx + width / 2 };
  });
  void doc;
  void meta;
  return colorIntervals(intervals);
}

function colorIntervals(intervals: readonly LabelLaneInput[]): number[] {
  const lanes: number[] = new Array(intervals.length).fill(0);
  const laneEnds: number[] = [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);

  for (const interval of sorted) {
    let lane = 0;
    while (laneEnds[lane] !== undefined && interval.start < laneEnds[lane]!) lane++;
    lanes[interval.ptrIndex] = lane;
    laneEnds[lane] = interval.end;
  }

  return lanes;
}

function slotCenterX(physical: number, cellW: number): number {
  return physical * cellW + cellW / 2;
}

function renderHorizontalPointers(
  elements: SceneElement[],
  p: ReturnType<typeof pen>,
  theme: ResolvedTheme,
  ptrs: readonly ResolvedPointer[],
  slots: readonly Rect[],
  side: ArrayIndexSide,
  lanes: readonly number[],
  arrowLen: number,
  labelGap: number,
  laneGap: number,
): void {
  const s = side === 'after' ? 1 : -1;
  const { palette, typography } = theme;
  const targetCounts = countByPointerPhysical(ptrs);
  const seen = new Map<number, number>();

  ptrs.forEach((ptr, i) => {
    const slot = slots[ptr.physical]!;
    const count = targetCounts.get(ptr.physical) ?? 1;
    const ordinal = seen.get(ptr.physical) ?? 0;
    seen.set(ptr.physical, ordinal + 1);
    const attachX = slot.x + slot.width / 2 + centeredLaneOffset(ordinal, count, slot.width);
    const edgeY = s > 0 ? slot.y + slot.height : slot.y;
    const lane = lanes[i] ?? 0;
    const tipY = edgeY;
    const tailY = edgeY + s * (arrowLen + lane * laneGap);
    const labelY = tailY + s * (labelGap + (s > 0 ? typography.baseFontSize : 0));

    elements.push(p.path(`M ${rhu(attachX)} ${rhu(tailY)} L ${rhu(attachX)} ${rhu(tipY)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));
    elements.push(p.text(pointerLabel(ptr.ptr), attachX, labelY, typography.baseFontSize, palette.primary, { anchor: 'middle', weight: 'bold' }));
  });
}

function renderVerticalPointers(
  elements: SceneElement[],
  p: ReturnType<typeof pen>,
  theme: ResolvedTheme,
  ptrs: readonly ResolvedPointer[],
  slots: readonly Rect[],
  indexSide: ArrayIndexSide,
  arrowLen: number,
  labelGap: number,
): void {
  const s = indexSide === 'before' ? 1 : -1;
  const { palette, typography } = theme;
  const columnGap = labelGap + 6;
  const groups = new Map<string, number[]>();

  for (const ptr of ptrs) {
    const key = `${ptr.physical}:${s}`;
    const widths = groups.get(key) ?? [];
    widths.push(measureText(pointerLabel(ptr.ptr), typography.baseFontSize).width);
    groups.set(key, widths);
  }

  const seen = new Map<string, number>();
  ptrs.forEach(ptr => {
    const slot = slots[ptr.physical]!;
    const key = `${ptr.physical}:${s}`;
    const widths = groups.get(key) ?? [];
    const lane = seen.get(key) ?? 0;
    seen.set(key, lane + 1);
    const attachY = slot.y + slot.height / 2 + centeredLaneOffset(lane, widths.length, slot.height);
    const edgeX = s > 0 ? slot.x + slot.width : slot.x;
    const outward = precedingLaneWidth(widths, lane, columnGap);
    const tailX = edgeX + s * (arrowLen + outward);
    const labelX = tailX + s * labelGap;
    const anchor: TextAnchor = s > 0 ? 'start' : 'end';

    elements.push(p.path(`M ${rhu(tailX)} ${rhu(attachY)} L ${rhu(edgeX)} ${rhu(attachY)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));
    elements.push(p.text(pointerLabel(ptr.ptr), labelX, attachY + 4, typography.baseFontSize, palette.primary, { anchor, weight: 'bold' }));
  });
}

function maxPointerLabelWidth(ptrs: readonly ResolvedPointer[], font: number): number {
  return Math.max(0, ...ptrs.map(ptr => measureText(pointerLabel(ptr.ptr), font).width));
}


function countByPointerPhysical(ptrs: readonly ResolvedPointer[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const ptr of ptrs) counts.set(ptr.physical, (counts.get(ptr.physical) ?? 0) + 1);
  return counts;
}

function centeredLaneOffset(lane: number, count: number, span: number): number {
  if (count <= 1) return 0;
  const gap = Math.min(12, span / Math.max(2, count + 1));
  return (lane - (count - 1) / 2) * gap;
}

function precedingLaneWidth(widths: readonly number[], lane: number, gap: number): number {
  let offset = 0;
  for (let i = 0; i < lane; i++) offset += (widths[i] ?? 0) + gap;
  return offset;
}

function boundsForElements(elements: readonly SceneElement[]): Rect {
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

function pointerLabel(ptr: ArrayPointer): string {
  return ptr.label ?? ptr.id;
}

export const array: DiagramModule<ArrayDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    const parsed = JSON.parse(input);
    return { version: parsed.version ?? '1.0', metadata: parsed.metadata ?? {}, ...normalizeArrayDoc(parsed) };
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutArray(ir, theme);
  },
};
