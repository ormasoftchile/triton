/**
 * @file grammars/c4/layout.ts — C4 Grammar deterministic layout engine.
 */

import type {
  PathPrimitive,
  RectPrimitive,
  Scene,
  ScenePrimitive,
  TextPrimitive,
} from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';
import { wrapText } from '../../text-wrap.js';

import type { C4Boundary, C4Document, C4Element, C4Rel } from './types.js';
import type { C4Theme } from './theme.js';
import { resolveC4Theme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

interface Point {
  x: number;
  y: number;
}

type Side = 'left' | 'right' | 'top' | 'bottom';

interface GridPlacement {
  x: number;
  y: number;
  row: number;
  col: number;
}

interface GridMetrics {
  colCount: number;
  rowCount: number;
  totalWidth: number;
  totalHeight: number;
  placements: GridPlacement[];
}

interface ElementPalette {
  fill: string;
  stroke: string;
  textColor: string;
}

interface BoxRef {
  alias: string;
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

interface MeasuredElement {
  itemKind: 'element';
  element: C4Element;
  stereotype: string;
  descriptionLines: string[];
  width: number;
  height: number;
  palette: ElementPalette;
}

interface MeasuredBoundary {
  itemKind: 'boundary';
  boundary: C4Boundary;
  children: MeasuredItem[];
  childGrid: GridMetrics;
  title: string;
  width: number;
  height: number;
}

type MeasuredItem = MeasuredElement | MeasuredBoundary;

interface PlacedElement extends MeasuredElement, BoxRef {}

interface PlacedBoundary extends MeasuredBoundary, BoxRef {
  childrenPlaced: PlacedItem[];
}

type PlacedItem = PlacedElement | PlacedBoundary;

interface TopLevelOrderEntry {
  kind: 'element' | 'boundary';
  alias: string;
}

interface C4DocumentWithOrder extends C4Document {
  __topLevelOrder?: TopLevelOrderEntry[];
}

interface RelBuildResult {
  lines: ScenePrimitive[];
  markers: ScenePrimitive[];
  labels: ScenePrimitive[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ─── element-kind helpers ─────────────────────────────────────────────────────

function baseElementKind(kind: C4Element['kind']): string {
  return kind.replace(/_Ext$/, '');
}

function isExternal(kind: C4Element['kind']): boolean {
  return kind.endsWith('_Ext');
}

function isDb(kind: C4Element['kind']): boolean {
  return kind.includes('Db');
}

function categoryOf(kind: C4Element['kind']): 'person' | 'system' | 'container' | 'component' {
  if (kind.startsWith('Person')) return 'person';
  if (kind.startsWith('System')) return 'system';
  if (kind.startsWith('Container')) return 'container';
  return 'component';
}

function paletteFor(element: C4Element, tk: C4Theme): ElementPalette {
  if (isExternal(element.kind)) {
    return { fill: tk.extFill, stroke: tk.extStroke, textColor: tk.extTextColor };
  }
  switch (categoryOf(element.kind)) {
    case 'person':
      return { fill: tk.personFill, stroke: tk.personStroke, textColor: tk.personTextColor };
    case 'system':
      return { fill: tk.systemFill, stroke: tk.systemStroke, textColor: tk.systemTextColor };
    case 'container':
      return { fill: tk.containerFill, stroke: tk.containerStroke, textColor: tk.containerTextColor };
    case 'component':
    default:
      return { fill: tk.componentFill, stroke: tk.componentStroke, textColor: tk.componentTextColor };
  }
}

function normalizeDescription(text?: string): string | undefined {
  // Collapse whitespace within each segment, but preserve <br> markers as explicit line breaks.
  const normalized = text
    ?.split(/<br\s*\/?>/gi)
    .map((seg) => seg.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return normalized || undefined;
}

function stereotypeFor(element: C4Element): string {
  const kind = baseElementKind(element.kind);
  if (element.technology) return `«${kind}: ${element.technology}»`;
  return `«${kind}»`;
}

// ─── child sort: persons first, sub-boundaries second, systems last ───────────
// This places actors at the top row and the hub system in the center bottom of a
// boundary's grid, which minimises long-distance crossings for standard C4 layouts.

function childSortRank(item: C4Element | C4Boundary): number {
  if ('boundaryKind' in item) return 1;
  if (item.kind.startsWith('Person')) return 0;
  return 2;
}

function sortBoundaryChildren(children: Array<C4Element | C4Boundary>): Array<C4Element | C4Boundary> {
  return [...children].sort((a, b) => {
    const ra = childSortRank(a);
    const rb = childSortRank(b);
    return ra !== rb ? ra - rb : 0; // stable: preserve declaration order within a rank
  });
}

// ─── measurement ─────────────────────────────────────────────────────────────

function measureElement(element: C4Element, tk: C4Theme): MeasuredElement {
  const stereotype = stereotypeFor(element);
  const description = normalizeDescription(element.description);
  // Split on explicit newlines (from <br> markers), then apply word-wrap to each segment.
  const descriptionLines = description
    ? description
        .split('\n')
        .flatMap((seg) => wrapText(seg, tk.descFontSize, tk.descMaxWidth, 8).lines)
    : [];
  const widestDesc = descriptionLines.reduce(
    (acc, line) => Math.max(acc, rhuInt(measureText(line, tk.descFontSize).width)),
    0,
  );
  const stereotypeWidth = rhuInt(measureText(stereotype, tk.stereotypeFontSize).width);
  const nameWidth = rhuInt(measureText(element.label, tk.nameFontSize).width);
  const width = Math.max(
    tk.elementMinWidth,
    rhuInt(Math.max(stereotypeWidth, nameWidth, widestDesc) + 2 * tk.elementPadX),
  );
  const stereoBlock = tk.lineHeight;
  const nameBlock = tk.lineHeight;
  const descBlock = descriptionLines.length * tk.descLineHeight;
  const innerGap = descriptionLines.length > 0 ? 4 : 0;
  const height = rhuInt(2 * tk.elementPadY + stereoBlock + nameBlock + descBlock + innerGap);
  return {
    itemKind: 'element',
    element,
    stereotype,
    descriptionLines,
    width,
    height,
    palette: paletteFor(element, tk),
  };
}

function computeGrid(items: Array<{ width: number; height: number }>, gapX: number, gapY: number): GridMetrics {
  if (items.length === 0) {
    return { colCount: 1, rowCount: 0, totalWidth: 0, totalHeight: 0, placements: [] };
  }
  const colCount = Math.min(3, Math.ceil(Math.sqrt(items.length)));
  const rowCount = Math.ceil(items.length / colCount);
  const colWidths = new Array<number>(colCount).fill(0);
  const rowHeights = new Array<number>(rowCount).fill(0);
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    colWidths[col] = Math.max(colWidths[col] ?? 0, item.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, item.height);
  }
  const colOffsets: number[] = [];
  const rowOffsets: number[] = [];
  let cursorX = 0;
  for (let i = 0; i < colCount; i++) {
    colOffsets.push(cursorX);
    cursorX += (colWidths[i] ?? 0) + (i < colCount - 1 ? gapX : 0);
  }
  let cursorY = 0;
  for (let i = 0; i < rowCount; i++) {
    rowOffsets.push(cursorY);
    cursorY += (rowHeights[i] ?? 0) + (i < rowCount - 1 ? gapY : 0);
  }
  const placements: GridPlacement[] = items.map((item, index) => {
    const col = index % colCount;
    const row = Math.floor(index / colCount);
    const cellW = colWidths[col] ?? item.width;
    const cellH = rowHeights[row] ?? item.height;
    return {
      x: rhuInt((colOffsets[col] ?? 0) + (cellW - item.width) / 2),
      y: rhuInt((rowOffsets[row] ?? 0) + (cellH - item.height) / 2),
      row,
      col,
    };
  });
  return {
    colCount,
    rowCount,
    totalWidth: rhuInt(cursorX),
    totalHeight: rhuInt(cursorY),
    placements,
  };
}

/**
 * Top-level grid: boundaries occupy row 0, elements row 1 (centred beneath).
 * This avoids the long diagonal from an outer element through the enterprise
 * boundary to another outer element on the opposite side.
 */
function computeTopLevelGrid(
  items: MeasuredItem[],
  gapX: number,
  gapY: number,
): { placements: GridPlacement[]; totalWidth: number; totalHeight: number } {
  const boundaryIdxs: number[] = [];
  const elementIdxs: number[] = [];
  items.forEach((item, i) => {
    if (item.itemKind === 'boundary') boundaryIdxs.push(i);
    else elementIdxs.push(i);
  });

  if (boundaryIdxs.length === 0 || elementIdxs.length === 0) {
    const g = computeGrid(items, gapX, gapY);
    return { placements: g.placements, totalWidth: g.totalWidth, totalHeight: g.totalHeight };
  }

  const bRow = computeGrid(boundaryIdxs.map((i) => items[i]!), gapX, gapY);
  const eRow = computeGrid(elementIdxs.map((i) => items[i]!), gapX, gapY);

  const totalWidth = Math.max(bRow.totalWidth, eRow.totalWidth);
  const totalHeight = rhuInt(bRow.totalHeight + gapY + eRow.totalHeight);

  const placements: GridPlacement[] = new Array(items.length);
  const bOffX = rhuInt((totalWidth - bRow.totalWidth) / 2);
  boundaryIdxs.forEach((origIdx, k) => {
    const p = bRow.placements[k]!;
    placements[origIdx] = { x: rhuInt(bOffX + p.x), y: p.y, row: 0, col: k };
  });
  const eOffX = rhuInt((totalWidth - eRow.totalWidth) / 2);
  const eOffY = rhuInt(bRow.totalHeight + gapY);
  elementIdxs.forEach((origIdx, k) => {
    const p = eRow.placements[k]!;
    placements[origIdx] = { x: rhuInt(eOffX + p.x), y: rhuInt(eOffY + p.y), row: 1, col: k };
  });

  return { placements, totalWidth: rhuInt(totalWidth), totalHeight };
}

function boundaryTitle(boundary: C4Boundary): string {
  return boundary.boundaryType ? `${boundary.label} · ${boundary.boundaryType}` : boundary.label;
}

function measureBoundary(boundary: C4Boundary, tk: C4Theme): MeasuredBoundary {
  // Sort children for better placement before measuring
  const sorted = sortBoundaryChildren(boundary.children);
  const children = sorted.map((child) =>
    'boundaryKind' in child ? measureBoundary(child, tk) : measureElement(child, tk),
  );
  const childGrid = computeGrid(children, tk.boundaryGapX, tk.boundaryGapY);
  const title = boundaryTitle(boundary);
  const titleWidth = rhuInt(measureText(title, tk.boundaryLabelFontSize).width);
  const width = Math.max(
    rhuInt(titleWidth + 2 * tk.boundaryPadX),
    rhuInt(childGrid.totalWidth + 2 * tk.boundaryPadX),
  );
  const height = rhuInt(
    tk.boundaryHeaderHeight + tk.boundaryPadY + childGrid.totalHeight + tk.boundaryPadY,
  );
  return { itemKind: 'boundary', boundary, children, childGrid, title, width, height };
}

function placeMeasuredItem(
  item: MeasuredItem,
  x: number,
  y: number,
  byAlias: Map<string, BoxRef>,
  tk: C4Theme,
): PlacedItem {
  if (item.itemKind === 'element') {
    const placed: PlacedElement = {
      ...item,
      alias: item.element.alias,
      x: rhuInt(x),
      y: rhuInt(y),
      width: item.width,
      height: item.height,
      right: rhuInt(x + item.width),
      bottom: rhuInt(y + item.height),
      cx: rhuInt(x + item.width / 2),
      cy: rhuInt(y + item.height / 2),
    };
    byAlias.set(placed.alias, placed);
    return placed;
  }

  const placedBoundary: PlacedBoundary = {
    ...item,
    alias: item.boundary.alias,
    x: rhuInt(x),
    y: rhuInt(y),
    width: item.width,
    height: item.height,
    right: rhuInt(x + item.width),
    bottom: rhuInt(y + item.height),
    cx: rhuInt(x + item.width / 2),
    cy: rhuInt(y + item.height / 2),
    childrenPlaced: [],
  };
  byAlias.set(placedBoundary.alias, placedBoundary);

  const childOriginX = rhuInt(placedBoundary.x + tk.boundaryPadX);
  const childOriginY = rhuInt(placedBoundary.y + tk.boundaryHeaderHeight + tk.boundaryPadY);
  for (let i = 0; i < item.children.length; i++) {
    const child = item.children[i]!;
    const placement = item.childGrid.placements[i]!;
    placedBoundary.childrenPlaced.push(
      placeMeasuredItem(child, childOriginX + placement.x, childOriginY + placement.y, byAlias, tk),
    );
  }
  return placedBoundary;
}

// ─── primitive builders ───────────────────────────────────────────────────────

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${rhuInt(x + r)} ${rhuInt(y)}`,
    `L ${rhuInt(x + width - r)} ${rhuInt(y)}`,
    `A ${r} ${r} 0 0 1 ${rhuInt(x + width)} ${rhuInt(y + r)}`,
    `L ${rhuInt(x + width)} ${rhuInt(y + height - r)}`,
    `A ${r} ${r} 0 0 1 ${rhuInt(x + width - r)} ${rhuInt(y + height)}`,
    `L ${rhuInt(x + r)} ${rhuInt(y + height)}`,
    `A ${r} ${r} 0 0 1 ${rhuInt(x)} ${rhuInt(y + height - r)}`,
    `L ${rhuInt(x)} ${rhuInt(y + r)}`,
    `A ${r} ${r} 0 0 1 ${rhuInt(x + r)} ${rhuInt(y)}`,
    'Z',
  ].join(' ');
}

function dbArcPath(box: BoxRef, tk: C4Theme): string {
  const y = box.y + tk.dbArcHeight;
  return [
    `M ${rhuInt(box.x)} ${rhuInt(y)}`,
    `C ${rhuInt(box.x + box.width * 0.25)} ${rhuInt(box.y)} ${rhuInt(box.x + box.width * 0.75)} ${rhuInt(box.y)} ${rhuInt(box.right)} ${rhuInt(y)}`,
  ].join(' ');
}

function buildElementPrimitives(box: PlacedElement, tk: C4Theme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [
    {
      kind: 'rect',
      x: box.x, y: box.y, width: box.width, height: box.height,
      fill: box.palette.fill, stroke: box.palette.stroke, strokeWidth: 1.5, rx: tk.elementRx,
    } satisfies RectPrimitive,
    {
      kind: 'text',
      x: box.cx, y: rhuInt(box.y + tk.elementPadY + tk.stereotypeFontSize),
      text: box.stereotype, fontFamily: tk.fontFamily, fontSize: tk.stereotypeFontSize,
      fontWeight: 500,
      fill: isExternal(box.element.kind) ? box.palette.textColor : tk.stereotypeColor,
      textAnchor: 'middle', dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive,
    {
      kind: 'text',
      x: box.cx, y: rhuInt(box.y + tk.elementPadY + tk.lineHeight + tk.nameFontSize),
      text: box.element.label, fontFamily: tk.fontFamily, fontSize: tk.nameFontSize,
      fontWeight: tk.nameFontWeight, fill: box.palette.textColor,
      textAnchor: 'middle', dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive,
  ];
  let descY = rhuInt(box.y + tk.elementPadY + tk.lineHeight + tk.lineHeight + tk.descFontSize + 4);
  for (const line of box.descriptionLines) {
    primitives.push({
      kind: 'text', x: box.cx, y: descY, text: line, fontFamily: tk.fontFamily,
      fontSize: tk.descFontSize, fontWeight: 500, fill: box.palette.textColor,
      textAnchor: 'middle', dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
    descY = rhuInt(descY + tk.descLineHeight);
  }
  if (isDb(box.element.kind)) {
    primitives.push({
      kind: 'path', d: dbArcPath(box, tk), fill: 'none',
      stroke: box.palette.stroke, strokeWidth: 1.3, strokeLinecap: 'round',
    } satisfies PathPrimitive);
  }
  return primitives;
}

function buildBoundaryPrimitives(boundary: PlacedBoundary, tk: C4Theme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [
    {
      kind: 'rect',
      x: boundary.x, y: boundary.y, width: boundary.width, height: boundary.height,
      fill: tk.boundaryFill, opacity: 0.45, rx: tk.boundaryRx,
    } satisfies RectPrimitive,
    {
      kind: 'path',
      d: roundedRectPath(boundary.x, boundary.y, boundary.width, boundary.height, tk.boundaryRx),
      fill: 'none', stroke: tk.boundaryStroke, strokeWidth: tk.boundaryStrokeWidth,
      dashArray: tk.boundaryDash, strokeLinecap: 'round',
    } satisfies PathPrimitive,
    {
      kind: 'text',
      x: rhuInt(boundary.x + tk.boundaryPadX),
      y: rhuInt(boundary.y + tk.boundaryHeaderHeight / 2),
      text: boundary.title, fontFamily: tk.fontFamily, fontSize: tk.boundaryLabelFontSize,
      fontWeight: 700, fill: tk.boundaryLabelColor,
      textAnchor: 'start', dominantBaseline: 'middle',
    } satisfies TextPrimitive,
  ];
  for (const child of boundary.childrenPlaced) {
    primitives.push(...buildPlacedItemPrimitives(child, tk));
  }
  return primitives;
}

function buildPlacedItemPrimitives(item: PlacedItem, tk: C4Theme): ScenePrimitive[] {
  return item.itemKind === 'element'
    ? buildElementPrimitives(item, tk)
    : buildBoundaryPrimitives(item, tk);
}

// ─── orthogonal routing ───────────────────────────────────────────────────────

const PERP_LABEL_OFFSET = 22; // pixels perpendicular to the labelled segment
const PORT_SPACING = 24;      // pixels between adjacent ports on the same box side
const PREF_REROUTE_DELTA = 40; // preferred minimum clearance before searching for midY

function sideDir(side: Side): Point {
  switch (side) {
    case 'left':   return { x: -1, y:  0 };
    case 'right':  return { x:  1, y:  0 };
    case 'top':    return { x:  0, y: -1 };
    case 'bottom': return { x:  0, y:  1 };
  }
}

function portCenter(box: BoxRef, side: Side): Point {
  switch (side) {
    case 'left':   return { x: box.x,     y: box.cy };
    case 'right':  return { x: box.right, y: box.cy };
    case 'top':    return { x: box.cx,    y: box.y  };
    case 'bottom': return { x: box.cx,    y: box.bottom };
  }
}

function portOffsetCoord(box: BoxRef, side: Side, idx: number, total: number): Point {
  const center = portCenter(box, side);
  if (total <= 1) return center;
  const offset = (idx - (total - 1) / 2) * PORT_SPACING;
  if (side === 'left' || side === 'right') {
    return { x: center.x, y: rhuInt(Math.max(box.y + 8, Math.min(box.bottom - 8, center.y + offset))) };
  }
  return { x: rhuInt(Math.max(box.x + 8, Math.min(box.right - 8, center.x + offset))), y: center.y };
}

function selectSides(from: BoxRef, to: BoxRef): { fromSide: Side; toSide: Side } {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) return { fromSide: 'right', toSide: 'left' };
    return { fromSide: 'left', toSide: 'right' };
  }
  if (dy >= 0) return { fromSide: 'bottom', toSide: 'top' };
  return { fromSide: 'top', toSide: 'bottom' };
}

/** True if the axis-aligned segment from (x1,y1)→(x2,y2) intersects box (with margin). */
function segmentIntersectsBox(x1: number, y1: number, x2: number, y2: number, box: BoxRef, pad = 3): boolean {
  if (x1 === x2) {
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    return x1 > box.x - pad && x1 < box.right + pad &&
           minY < box.bottom + pad && maxY > box.y - pad;
  }
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  return y1 > box.y - pad && y1 < box.bottom + pad &&
         minX < box.right + pad && maxX > box.x - pad;
}

function segmentClearsElements(
  x1: number, y1: number, x2: number, y2: number,
  elementBoxes: BoxRef[], skipA: string, skipB: string,
): boolean {
  for (const box of elementBoxes) {
    if (box.alias === skipA || box.alias === skipB) continue;
    if (segmentIntersectsBox(x1, y1, x2, y2, box)) return false;
  }
  return true;
}

interface RelStrategy {
  fromSide: Side;
  toSide:   Side;
  kind:     'hvh' | 'vhv' | 'h' | 'v';
}

/**
 * Determine routing strategy for a rel, possibly switching from horizontal to
 * vertical routing when the natural horizontal path crosses an element box.
 */
function determineRelStrategy(
  from: BoxRef, to: BoxRef, elementBoxes: BoxRef[],
): RelStrategy {
  const { fromSide, toSide } = selectSides(from, to);
  const start = portCenter(from, fromSide);
  const end   = portCenter(to, toSide);
  const sx = start.x, sy = start.y, ex = end.x, ey = end.y;

  const horiz = fromSide === 'left' || fromSide === 'right';

  if (horiz && Math.abs(ey - sy) < 4) return { fromSide, toSide, kind: 'h' };
  if (!horiz && Math.abs(ex - sx) < 4) return { fromSide, toSide, kind: 'v' };

  if (horiz) {
    // Check if segment 1 of H→V→H would cross any element box at sy
    const midX = rhuInt((sx + ex) / 2);
    const horizBlocked = !segmentClearsElements(
      Math.min(sx, midX), sy, Math.max(sx, midX), sy,
      elementBoxes, from.alias, to.alias,
    );
    if (horizBlocked) {
      // Switch to V→H→V, exiting from the top (routing above the obstacle)
      return { fromSide: 'top', toSide: 'top', kind: 'vhv' };
    }
    // Also check if the vertical at midX is blocked, which would force a
    // rightward midX adjustment that may visually graze a neighbouring element.
    // In that case, prefer a clean VHV path instead.
    const vertBlocked = !segmentClearsElements(
      midX, Math.min(sy, ey), midX, Math.max(sy, ey),
      elementBoxes, from.alias, to.alias,
    );
    if (vertBlocked) {
      // Choose VHV direction: if source is above the target, exit from bottom.
      const exitBottom = sy < ey;
      return exitBottom
        ? { fromSide: 'bottom', toSide: 'top',   kind: 'vhv' }
        : { fromSide: 'top',   toSide: 'bottom', kind: 'vhv' };
    }
    return { fromSide, toSide, kind: 'hvh' };
  }
  return { fromSide, toSide, kind: 'vhv' };
}

interface PortPair {
  fromPoint: Point;
  toPoint:   Point;
  fromSide:  Side;
  toSide:    Side;
  strategy:  RelStrategy;
}

/**
 * Pre-compute port coordinates for all rels with distribution.
 * Uses a two-pass approach: first determine routing strategy (and thus actual
 * exit/entry sides), then distribute ports per side.
 */
function computePortPairs(
  rels: C4Rel[],
  byAlias: Map<string, BoxRef>,
  elementBoxes: BoxRef[],
): PortPair[] {
  const strategies: Array<RelStrategy | null> = [];
  const sideCount = new Map<string, number>();
  const sideIdx   = new Map<string, number>();

  for (const rel of rels) {
    const from = byAlias.get(rel.from);
    const to   = byAlias.get(rel.to);
    if (!from || !to) { strategies.push(null); continue; }
    const strat = determineRelStrategy(from, to, elementBoxes);
    strategies.push(strat);
    sideCount.set(`${rel.from}:${strat.fromSide}`, (sideCount.get(`${rel.from}:${strat.fromSide}`) ?? 0) + 1);
    sideCount.set(`${rel.to}:${strat.toSide}`,     (sideCount.get(`${rel.to}:${strat.toSide}`)     ?? 0) + 1);
  }

  const result: PortPair[] = [];
  for (let i = 0; i < rels.length; i++) {
    const rel  = rels[i]!;
    const strat = strategies[i];
    const from = byAlias.get(rel.from);
    const to   = byAlias.get(rel.to);
    if (!strat || !from || !to) {
      result.push({
        fromPoint: { x: 0, y: 0 }, toPoint: { x: 0, y: 0 },
        fromSide: 'right', toSide: 'left',
        strategy: { fromSide: 'right', toSide: 'left', kind: 'hvh' },
      });
      continue;
    }
    const fKey = `${rel.from}:${strat.fromSide}`;
    const tKey = `${rel.to}:${strat.toSide}`;
    const fTotal = sideCount.get(fKey) ?? 1;
    const tTotal = sideCount.get(tKey) ?? 1;
    const fIdx   = sideIdx.get(fKey)   ?? 0;
    const tIdx   = sideIdx.get(tKey)   ?? 0;
    sideIdx.set(fKey, fIdx + 1);
    sideIdx.set(tKey, tIdx + 1);

    result.push({
      fromPoint: portOffsetCoord(from, strat.fromSide, fIdx, fTotal),
      toPoint:   portOffsetCoord(to,   strat.toSide,   tIdx, tTotal),
      fromSide:  strat.fromSide,
      toSide:    strat.toSide,
      strategy:  strat,
    });
  }
  return result;
}

interface OrthogResult {
  d:           string;
  endDir:      Point;
  startDir:    Point;
  labelAnchor: Point;
}

function buildOrthogonalPath(
  start: Point, startSide: Side,
  end: Point,   endSide: Side,
  kind: RelStrategy['kind'],
  elementBoxes: BoxRef[],
  fromAlias: string,
  toAlias:   string,
  asz: number,
): OrthogResult {
  const sx = rhuInt(start.x), sy = rhuInt(start.y);
  const ex = rhuInt(end.x),   ey = rhuInt(end.y);

  const startDir = sideDir(startSide);

  if (kind === 'h') {
    // Nearly-horizontal: short V stub if y differ, then H to arrowhead base.
    const lDir: Point = ex > sx ? { x: 1, y: 0 } : { x: -1, y: 0 };
    const lPathEx = rhuInt(ex - lDir.x * asz);
    const d = Math.abs(ey - sy) > 1
      ? `M ${sx} ${sy} H ${lPathEx} V ${ey}`
      : `M ${sx} ${sy} H ${lPathEx}`;
    const midLabelX = rhuInt((sx + ex) / 2);
    return {
      d,
      endDir: lDir,
      startDir: { x: -lDir.x, y: 0 },
      labelAnchor: { x: midLabelX, y: rhuInt(sy - PERP_LABEL_OFFSET) },
    };
  }

  if (kind === 'v') {
    // Nearly-vertical: V to arrowhead base y, then short H stub if x differ.
    const vDir: Point = ey > sy ? { x: 0, y: 1 } : { x: 0, y: -1 };
    const vPathEy = rhuInt(ey - vDir.y * asz);
    const d = Math.abs(ex - sx) > 1
      ? `M ${sx} ${sy} V ${vPathEy} H ${ex}`
      : `M ${sx} ${sy} V ${vPathEy}`;
    return {
      d,
      endDir: vDir,
      startDir: { x: 0, y: -vDir.y },
      labelAnchor: { x: rhuInt(sx + PERP_LABEL_OFFSET), y: rhuInt((sy + ey) / 2) },
    };
  }

  if (kind === 'hvh') {
    let midX = rhuInt((sx + ex) / 2);
    const vertOK = (mx: number) =>
      segmentClearsElements(mx, Math.min(sy, ey), mx, Math.max(sy, ey), elementBoxes, fromAlias, toAlias);

    if (!vertOK(midX)) {
      for (const step of [10, 20, 30, 40, 60, 80, 100, 140, 200]) {
        const L = rhuInt(Math.min(sx, ex) - step);
        const R = rhuInt(Math.max(sx, ex) + step);
        if (vertOK(L)) { midX = L; break; }
        if (vertOK(R)) { midX = R; break; }
      }
    }

    // Travel direction on the last (horizontal) segment: ex relative to midX.
    const finalEndDirX = ex > midX ? 1 : -1;
    // Path endpoint is one arrowSize before the tip (in travel direction).
    const hvhPathEx = rhuInt(ex - finalEndDirX * asz);

    const len1 = Math.abs(midX - sx), len2 = Math.abs(ey - sy), len3 = Math.abs(ex - midX);
    let labelAnchor: Point;
    if (len2 >= Math.max(len1, len3)) {
      labelAnchor = { x: rhuInt(midX + PERP_LABEL_OFFSET), y: rhuInt((sy + ey) / 2) };
    } else if (len1 >= len3) {
      labelAnchor = { x: rhuInt((sx + midX) / 2), y: rhuInt(sy - PERP_LABEL_OFFSET) };
    } else {
      labelAnchor = { x: rhuInt((midX + ex) / 2), y: rhuInt(ey - PERP_LABEL_OFFSET) };
    }

    return {
      d: `M ${sx} ${sy} H ${midX} V ${ey} H ${hvhPathEx}`,
      endDir: { x: finalEndDirX, y: 0 },
      startDir: { x: -startDir.x, y: 0 },
      labelAnchor,
    };
  }

  // V→H→V routing
  let midY = rhuInt((sy + ey) / 2);
  const goUp = startSide === 'top' || (startSide !== 'bottom' && sy > ey);

  const horizOK = (my: number) =>
    segmentClearsElements(Math.min(sx, ex), my, Math.max(sx, ex), my, elementBoxes, fromAlias, toAlias) &&
    segmentClearsElements(sx, Math.min(sy, my), sx, Math.max(sy, my), elementBoxes, fromAlias, toAlias) &&
    segmentClearsElements(ex, Math.min(my, ey), ex, Math.max(my, ey), elementBoxes, fromAlias, toAlias);

  if (!horizOK(midY)) {
    let found = false;
    // Prefer a comfortable clearance away from the source/target boxes
    for (let delta = PREF_REROUTE_DELTA; delta <= 400; delta += 8) {
      const tryY = goUp
        ? rhuInt(Math.min(sy, ey) - delta)
        : rhuInt(Math.max(sy, ey) + delta);
      if (horizOK(tryY)) { midY = tryY; found = true; break; }
    }
    if (!found) {
      for (let delta = 8; delta < PREF_REROUTE_DELTA; delta += 4) {
        const tryY = goUp
          ? rhuInt(Math.min(sy, ey) - delta)
          : rhuInt(Math.max(sy, ey) + delta);
        if (horizOK(tryY)) { midY = tryY; found = true; break; }
      }
    }
  }

  // Travel direction on the last (vertical) segment: ey relative to midY.
  const finalEndDirY = ey > midY ? 1 : -1;
  const vhvPathEy = rhuInt(ey - finalEndDirY * asz);

  const len1 = Math.abs(midY - sy), len2 = Math.abs(ex - sx), len3 = Math.abs(ey - midY);
  let labelAnchor: Point;
  if (len2 >= Math.max(len1, len3)) {
    // Label on horizontal segment — offset toward interior of diagram
    const perpDir = goUp ? 1 : -1;
    labelAnchor = { x: rhuInt((sx + ex) / 2), y: rhuInt(midY + perpDir * PERP_LABEL_OFFSET) };
  } else if (len1 >= len3) {
    labelAnchor = { x: rhuInt(sx + PERP_LABEL_OFFSET), y: rhuInt((sy + midY) / 2) };
  } else {
    labelAnchor = { x: rhuInt(ex + PERP_LABEL_OFFSET), y: rhuInt((midY + ey) / 2) };
  }

  return {
    d: `M ${sx} ${sy} V ${midY} H ${ex} V ${vhvPathEy}`,
    endDir: { x: 0, y: finalEndDirY },
    startDir: { x: 0, y: -startDir.y },
    labelAnchor,
  };
}

// ─── arrowhead ────────────────────────────────────────────────────────────────

function openArrowMarker(tip: Point, dir: Point, tk: C4Theme): PathPrimitive {
  const half = tk.relArrowSize * 0.6;
  const px = -dir.y, py = dir.x;
  const base = { x: tip.x - dir.x * tk.relArrowSize, y: tip.y - dir.y * tk.relArrowSize };
  return {
    kind: 'path',
    d: [
      `M ${rhuInt(base.x + px * half)} ${rhuInt(base.y + py * half)}`,
      `L ${rhuInt(tip.x)} ${rhuInt(tip.y)}`,
      `L ${rhuInt(base.x - px * half)} ${rhuInt(base.y - py * half)}`,
    ].join(' '),
    fill: 'none',
    stroke: tk.relStroke,
    strokeWidth: tk.relStrokeWidth,
    strokeLinecap: 'round',
  };
}

// ─── label primitives ─────────────────────────────────────────────────────────

function relDisplayLabel(rel: C4Rel): string {
  return rel.order !== undefined ? `${rel.order}. ${rel.label}` : rel.label;
}

/**
 * Check if the label rect centred at `anchor` overlaps any element box
 * (excluding source and target).  If so, shift it clear above the box.
 */
function adjustLabelAnchor(
  anchor: Point, w: number, h: number,
  elementBoxes: BoxRef[], skipA: string, skipB: string,
): Point {
  const lx = anchor.x - w / 2, ly = anchor.y - h / 2;
  for (const box of elementBoxes) {
    if (box.alias === skipA || box.alias === skipB) continue;
    if (lx < box.right && lx + w > box.x && ly < box.bottom && ly + h > box.y) {
      return { x: anchor.x, y: rhuInt(box.y - h / 2 - 6) };
    }
  }
  return anchor;
}

function buildLabelPrimitives(
  rel: C4Rel,
  rawAnchor: Point,
  elementBoxes: BoxRef[],
  fromAlias: string,
  toAlias: string,
  tk: C4Theme,
): { primitives: ScenePrimitive[]; minX: number; minY: number; maxX: number; maxY: number } {
  const main = relDisplayLabel(rel);
  const mainWidth = rhuInt(measureText(main, tk.relLabelFontSize).width);
  const techWidth = rel.technology ? rhuInt(measureText(rel.technology, tk.relTechFontSize).width) : 0;
  const width  = Math.max(mainWidth, techWidth) + 10;
  const height = rel.technology ? 32 : 20;

  const anchor = adjustLabelAnchor(rawAnchor, width, height, elementBoxes, fromAlias, toAlias);

  const x = rhuInt(anchor.x - width / 2);
  const y = rhuInt(anchor.y - height / 2);
  const mainY = rel.technology ? rhuInt(y + 11) : rhuInt(y + height / 2);

  const primitives: ScenePrimitive[] = [
    {
      kind: 'rect', x, y, width, height,
      fill: '#ffffff', stroke: 'none', strokeWidth: 0, rx: 4, opacity: 0.95,
    } satisfies RectPrimitive,
    {
      kind: 'text', x: rhuInt(anchor.x), y: mainY, text: main,
      fontFamily: tk.fontFamily, fontSize: tk.relLabelFontSize, fontWeight: 600,
      fill: tk.relLabelColor, textAnchor: 'middle', dominantBaseline: 'middle',
    } satisfies TextPrimitive,
  ];

  if (rel.technology) {
    primitives.push({
      kind: 'text', x: rhuInt(anchor.x), y: rhuInt(mainY + 14), text: rel.technology,
      fontFamily: tk.fontFamily, fontSize: tk.relTechFontSize, fontWeight: 500,
      fill: tk.relTechColor, textAnchor: 'middle', dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }

  return { primitives, minX: x, minY: y, maxX: x + width, maxY: y + height };
}

// ─── self-relationship ────────────────────────────────────────────────────────

function buildSelfRel(rel: C4Rel, box: BoxRef, elementBoxes: BoxRef[], tk: C4Theme): RelBuildResult {
  const start = { x: box.right, y: rhuInt(box.cy - 16) };
  const end   = { x: box.right, y: rhuInt(box.cy + 16) };
  const elbow = rhuInt(box.right + Math.max(36, tk.relArrowSize * 3));
  const path: PathPrimitive = {
    kind: 'path',
    d: [
      `M ${start.x} ${start.y}`,
      `C ${elbow} ${rhuInt(start.y - 18)} ${elbow} ${rhuInt(end.y + 18)} ${end.x} ${end.y}`,
    ].join(' '),
    fill: 'none', stroke: tk.relStroke, strokeWidth: tk.relStrokeWidth, strokeLinecap: 'round',
  };
  const rawAnchor = { x: elbow, y: box.cy };
  const label  = buildLabelPrimitives(rel, rawAnchor, elementBoxes, box.alias, box.alias, tk);
  const markers: ScenePrimitive[] = [openArrowMarker(end, { x: -1, y: 0 }, tk)];
  if (rel.kind === 'BiRel') markers.push(openArrowMarker(start, { x: 1, y: 0 }, tk));
  return {
    lines: [path], markers, labels: label.primitives,
    minX: Math.min(start.x, end.x, elbow, label.minX),
    minY: Math.min(start.y, end.y, label.minY),
    maxX: Math.max(start.x, end.x, elbow, label.maxX),
    maxY: Math.max(start.y, end.y, label.maxY),
  };
}

// ─── relationship building ────────────────────────────────────────────────────

function buildRelationship(
  rel: C4Rel,
  fromBox: BoxRef,
  toBox:   BoxRef,
  portPair: PortPair,
  elementBoxes: BoxRef[],
  tk: C4Theme,
): RelBuildResult {
  if (fromBox.alias === toBox.alias) {
    return buildSelfRel(rel, fromBox, elementBoxes, tk);
  }

  const { fromPoint, toPoint, fromSide, toSide, strategy } = portPair;
  const isBiRel = rel.kind === 'BiRel';

  // Offset start point for BiRel (arrow at both ends)
  const startDir = sideDir(fromSide);
  const actualStart: Point = isBiRel
    ? { x: rhuInt(fromPoint.x + startDir.x * tk.relArrowSize), y: rhuInt(fromPoint.y + startDir.y * tk.relArrowSize) }
    : fromPoint;

  const ortho = buildOrthogonalPath(
    actualStart, fromSide, toPoint, toSide,
    strategy.kind, elementBoxes, fromBox.alias, toBox.alias, tk.relArrowSize,
  );

  const path: PathPrimitive = {
    kind: 'path', d: ortho.d, fill: 'none',
    stroke: tk.relStroke, strokeWidth: tk.relStrokeWidth,
    strokeLinecap: 'round',
  };

  const label = buildLabelPrimitives(
    rel, ortho.labelAnchor, elementBoxes, fromBox.alias, toBox.alias, tk,
  );

  const markers: ScenePrimitive[] = [openArrowMarker(toPoint, ortho.endDir, tk)];
  if (isBiRel) markers.push(openArrowMarker(fromPoint, { x: -ortho.startDir.x, y: -ortho.startDir.y }, tk));

  return {
    lines: [path], markers, labels: label.primitives,
    minX: Math.min(fromPoint.x, toPoint.x, label.minX),
    minY: Math.min(fromPoint.y, toPoint.y, label.minY),
    maxX: Math.max(fromPoint.x, toPoint.x, label.maxX),
    maxY: Math.max(fromPoint.y, toPoint.y, label.maxY),
  };
}

// ─── structure rendering ──────────────────────────────────────────────────────

function collectStructurePrimitives(items: PlacedItem[], tk: C4Theme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  for (const item of items) primitives.push(...buildPlacedItemPrimitives(item, tk));
  return primitives;
}

function collectElementBoxes(items: PlacedItem[], result: BoxRef[]): void {
  for (const item of items) {
    if (item.itemKind === 'element') {
      result.push(item as BoxRef);
    } else {
      collectElementBoxes(item.childrenPlaced, result);
    }
  }
}

// ─── top-level order ──────────────────────────────────────────────────────────

function topLevelItems(doc: C4DocumentWithOrder): Array<C4Element | C4Boundary> {
  const ordered = doc.__topLevelOrder;
  if (!ordered || ordered.length === 0) return [...doc.boundaries, ...doc.elements];

  const elementByAlias  = new Map(doc.elements.map((e) => [e.alias, e]));
  const boundaryByAlias = new Map(doc.boundaries.map((b) => [b.alias, b]));
  const used = new Set<string>();
  const items: Array<C4Element | C4Boundary> = [];

  for (const entry of ordered) {
    const item = entry.kind === 'element'
      ? elementByAlias.get(entry.alias)
      : boundaryByAlias.get(entry.alias);
    if (item && !used.has(entry.alias)) {
      items.push(item);
      used.add(entry.alias);
    }
  }
  for (const b of doc.boundaries) if (!used.has(b.alias)) items.push(b);
  for (const e of doc.elements)   if (!used.has(e.alias)) items.push(e);
  return items;
}

// ─── main layout ─────────────────────────────────────────────────────────────

export function layoutC4(doc: C4Document, themeOverride?: C4Theme): Scene {
  const tk = themeOverride ?? resolveC4Theme(doc.metadata.theme);
  const roots = topLevelItems(doc as C4DocumentWithOrder);

  if (roots.length === 0) {
    return {
      width:      rhuInt(tk.marginLeft + tk.marginRight),
      height:     rhuInt(tk.marginTop  + tk.marginBottom),
      background: tk.background,
      primitives: [],
    };
  }

  const measured = roots.map((item) =>
    'boundaryKind' in item ? measureBoundary(item, tk) : measureElement(item, tk),
  );

  // Use boundary-aware top-level layout
  const tlGrid = computeTopLevelGrid(measured, tk.elementGapX, tk.elementGapY);

  const byAlias = new Map<string, BoxRef>();
  const placed: PlacedItem[] = [];

  for (let i = 0; i < measured.length; i++) {
    const item = measured[i]!;
    const p    = tlGrid.placements[i]!;
    placed.push(placeMeasuredItem(item, tk.marginLeft + p.x, tk.marginTop + p.y, byAlias, tk));
  }

  // Collect element boxes (not boundaries) for collision-aware routing
  const elementBoxes: BoxRef[] = [];
  collectElementBoxes(placed, elementBoxes);

  let maxRight  = 0;
  let maxBottom = 0;
  for (const item of placed) {
    maxRight  = Math.max(maxRight,  item.right);
    maxBottom = Math.max(maxBottom, item.bottom);
  }

  // Pre-compute port assignments with strategy and distribution
  const portPairs = computePortPairs(doc.rels, byAlias, elementBoxes);

  const edgeLines:   ScenePrimitive[] = [];
  const edgeMarkers: ScenePrimitive[] = [];
  const edgeLabels:  ScenePrimitive[] = [];

  for (let i = 0; i < doc.rels.length; i++) {
    const rel  = doc.rels[i]!;
    const from = byAlias.get(rel.from);
    const to   = byAlias.get(rel.to);
    if (!from || !to) continue;
    const built = buildRelationship(rel, from, to, portPairs[i]!, elementBoxes, tk);
    edgeLines.push(...built.lines);
    edgeMarkers.push(...built.markers);
    edgeLabels.push(...built.labels);
    maxRight  = Math.max(maxRight,  built.maxX);
    maxBottom = Math.max(maxBottom, built.maxY);
  }

  return {
    width:      rhuInt(maxRight  + tk.marginRight),
    height:     rhuInt(maxBottom + tk.marginBottom),
    background: tk.background,
    primitives: [
      ...collectStructurePrimitives(placed, tk),
      ...edgeLines,
      ...edgeMarkers,
      ...edgeLabels,
    ],
  };
}
