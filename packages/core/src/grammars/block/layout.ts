/**
 * @file grammars/block/layout.ts — Block Diagram layout engine.
 */

import type { PathPrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';

import type { BlockDocument, BlockGroup, BlockItem, BlockShape } from './types.js';
import type { BlockTheme } from './theme.js';
import { resolveBlockTheme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

function tokenWidth(span: number, tk: BlockTheme): number {
  return rhuInt(span * tk.cellWidth + Math.max(0, span - 1) * tk.cellGapX);
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureText(candidate, fontSize).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

interface TokenPlacement {
  id: string;
  kind: 'item' | 'group';
  span: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScopeLayout {
  width: number;
  height: number;
  placements: TokenPlacement[];
}

interface GroupMeasure {
  width: number;
  height: number;
  innerYOffset: number;
  childLayout: ScopeLayout;
}

interface RenderContext {
  primitives: ScenePrimitive[];
  boxes: Map<string, { x: number; y: number; width: number; height: number; shape: BlockShape }>;
}

const GROUP_LABEL_PAD_TOP = 18;
const GROUP_LABEL_GAP = 8;
const GROUP_BOTTOM_PAD = 8;
const TEXT_PAD_X = 8;

export function layoutBlock(doc: BlockDocument, themeOverride?: BlockTheme): Scene {
  const tk = themeOverride ?? resolveBlockTheme(doc.metadata.theme);
  const columns = Math.max(1, doc.columns);
  const itemsById = new Map(doc.items.map((item) => [item.id, item]));
  const groupsById = new Map(doc.groups.map((group) => [group.id, group]));
  const measuredGroups = new Map<string, GroupMeasure>();

  function orderedChildIds(groupId?: string): string[] {
    if (groupId) {
      const group = groupsById.get(groupId);
      return group?.childIds ?? [];
    }

    const topTokens: Array<{ id: string; order: number }> = [];
    for (const item of doc.items) {
      if (!item.group) topTokens.push({ id: item.id, order: item.order ?? Number.MAX_SAFE_INTEGER });
    }
    for (const group of doc.groups) {
      if (!group.group) topTokens.push({ id: group.id, order: group.order ?? Number.MAX_SAFE_INTEGER });
    }
    topTokens.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return topTokens.map((t) => t.id);
  }

  function measureScope(tokenIds: string[], scopeColumns: number): ScopeLayout {
    const placements: TokenPlacement[] = [];
    const rowHeights: number[] = [];
    let row = 0;
    let col = 0;

    for (const id of tokenIds) {
      const item = itemsById.get(id);
      const group = groupsById.get(id);
      if (!item && !group) continue;

      const rawSpan = Math.max(1, item?.span ?? group?.span ?? 1);
      const span = Math.min(rawSpan, Math.max(1, scopeColumns));
      const width = tokenWidth(span, tk);
      const height = item ? tk.cellHeight : measureGroup(group!.id).height;

      if (col > 0 && col + span > scopeColumns) {
        row += 1;
        col = 0;
      }

      placements.push({ id, kind: item ? 'item' : 'group', span, row, col, x: 0, y: 0, width, height });
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);

      col += span;
      if (col >= scopeColumns) {
        row += 1;
        col = 0;
      }
    }

    let y = 0;
    const rowTops = rowHeights.map((h, idx) => {
      const top = y;
      y = rhuInt(y + h + (idx < rowHeights.length - 1 ? tk.cellGapY : 0));
      return top;
    });

    for (const placement of placements) {
      placement.x = rhuInt(placement.col * (tk.cellWidth + tk.cellGapX));
      placement.y = rowTops[placement.row] ?? 0;
    }

    const height = rowHeights.length === 0 ? 0 : rhuInt(rowTops[rowHeights.length - 1]! + rowHeights[rowHeights.length - 1]!);
    const width = tokenWidth(scopeColumns, tk);
    return { width, height, placements };
  }

  function measureGroup(groupId: string): GroupMeasure {
    const cached = measuredGroups.get(groupId);
    if (cached) return cached;

    const group = groupsById.get(groupId);
    if (!group) {
      const empty = { width: tokenWidth(1, tk), height: tk.cellHeight, innerYOffset: GROUP_LABEL_PAD_TOP, childLayout: { width: tokenWidth(1, tk), height: 0, placements: [] } };
      measuredGroups.set(groupId, empty);
      return empty;
    }

    const childLayout = measureScope(group.childIds, Math.max(1, group.span));
    const width = tokenWidth(Math.max(1, group.span), tk);
    const innerYOffset = rhuInt(GROUP_LABEL_PAD_TOP + tk.groupLabelFontSize + GROUP_LABEL_GAP);
    const height = rhuInt(innerYOffset + childLayout.height + GROUP_BOTTOM_PAD);
    const measured = { width, height, innerYOffset, childLayout };
    measuredGroups.set(groupId, measured);
    return measured;
  }

  function pushCenteredText(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    fontWeight: number | string,
    fill: string,
    ctx: RenderContext,
  ): void {
    const lines = wrapText(text, fontSize, Math.max(20, width - TEXT_PAD_X * 2));
    const lineHeight = fontSize * 1.2;
    const top = y + height / 2 - (lines.length * lineHeight) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.primitives.push({
        kind: 'text',
        x: rhuInt(x + width / 2),
        y: rhuInt(top + i * lineHeight + fontSize * 0.9),
        text: lines[i]!,
        fontFamily: tk.fontFamily,
        fontSize,
        fontWeight,
        fill,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }
  }

  function renderItem(item: BlockItem, placement: TokenPlacement, originX: number, originY: number, ctx: RenderContext): void {
    if (item.isSpace) return;
    const x = rhuInt(originX + placement.x);
    const y = rhuInt(originY + placement.y);
    const width = placement.width;
    const height = tk.cellHeight;

    if (item.shape === 'circle') {
      const r = rhuInt(Math.min(width, height) / 2 - tk.blockStrokeWidth);
      ctx.primitives.push({
        kind: 'circle',
        cx: rhuInt(x + width / 2),
        cy: rhuInt(y + height / 2),
        r,
        fill: tk.circleFill,
        stroke: tk.circleStroke,
        strokeWidth: tk.blockStrokeWidth,
      });
    } else if (item.shape === 'diamond') {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const d = [
        `M ${rhuInt(cx)} ${rhuInt(y)}`,
        `L ${rhuInt(x + width)} ${rhuInt(cy)}`,
        `L ${rhuInt(cx)} ${rhuInt(y + height)}`,
        `L ${rhuInt(x)} ${rhuInt(cy)}`,
        'Z',
      ].join(' ');
      ctx.primitives.push({
        kind: 'path',
        d,
        fill: tk.diamondFill,
        stroke: tk.diamondStroke,
        strokeWidth: tk.blockStrokeWidth,
      } satisfies PathPrimitive);
    } else {
      ctx.primitives.push({
        kind: 'rect',
        x,
        y,
        width,
        height,
        fill: tk.blockFill,
        stroke: tk.blockStroke,
        strokeWidth: tk.blockStrokeWidth,
        rx: item.shape === 'rounded' ? rhuInt(height / 2) : tk.blockRx,
      });
    }

    pushCenteredText(item.label, x, y, width, height, tk.blockFontSize, tk.blockFontWeight, tk.blockTextColor, ctx);
    ctx.boxes.set(item.id, { x, y, width, height, shape: item.shape });
  }

  function renderGroup(group: BlockGroup, placement: TokenPlacement, originX: number, originY: number, ctx: RenderContext): void {
    const measure = measureGroup(group.id);
    const x = rhuInt(originX + placement.x);
    const y = rhuInt(originY + placement.y);
    const width = placement.width;
    const height = measure.height;

    ctx.primitives.push({
      kind: 'rect',
      x,
      y,
      width,
      height,
      fill: tk.groupFill,
      stroke: tk.groupStroke,
      strokeWidth: 1,
      rx: tk.blockRx,
    });

    ctx.primitives.push({
      kind: 'text',
      x: rhuInt(x + 8),
      y: rhuInt(y + GROUP_LABEL_PAD_TOP),
      text: group.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.groupLabelFontSize,
      fontWeight: 600,
      fill: tk.groupLabelColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);

    renderScope(measure.childLayout, x, y + measure.innerYOffset, ctx);
    ctx.boxes.set(group.id, { x, y, width, height, shape: 'rect' });
  }

  function renderScope(scope: ScopeLayout, originX: number, originY: number, ctx: RenderContext): void {
    for (const placement of scope.placements) {
      const item = itemsById.get(placement.id);
      if (item) {
        renderItem(item, placement, originX, originY, ctx);
        continue;
      }
      const group = groupsById.get(placement.id);
      if (group) renderGroup(group, placement, originX, originY, ctx);
    }
  }

  function edgePoint(box: { x: number; y: number; width: number; height: number; shape: BlockShape }, dx: number, dy: number) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const len = Math.hypot(dx, dy) || 1;
    if (box.shape === 'circle') {
      const r = Math.min(box.width, box.height) / 2;
      return { x: cx + (dx / len) * r, y: cy + (dy / len) * r };
    }
    const hw = box.width / 2;
    const hh = box.height / 2;
    const scale = 1 / Math.max(Math.abs(dx) / Math.max(hw, 1), Math.abs(dy) / Math.max(hh, 1));
    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  const rootLayout = measureScope(orderedChildIds(), columns);
  const ctx: RenderContext = { primitives: [], boxes: new Map() };
  renderScope(rootLayout, tk.marginLeft, tk.marginTop, ctx);

  for (const arrow of doc.arrows) {
    const fromBox = ctx.boxes.get(arrow.from);
    const toBox = ctx.boxes.get(arrow.to);
    if (!fromBox || !toBox) continue;

    const fromCx = fromBox.x + fromBox.width / 2;
    const fromCy = fromBox.y + fromBox.height / 2;
    const toCx = toBox.x + toBox.width / 2;
    const toCy = toBox.y + toBox.height / 2;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;
    const len = Math.hypot(dx, dy) || 1;
    const sourceEdge = edgePoint(fromBox, dx, dy);
    const targetEdge = edgePoint(toBox, -dx, -dy);
    const ux = dx / len;
    const uy = dy / len;
    const startX = rhuInt(sourceEdge.x + ux * 10);
    const startY = rhuInt(sourceEdge.y + uy * 10);
    const tipX = rhuInt(targetEdge.x);
    const tipY = rhuInt(targetEdge.y);
    const endX = rhuInt(targetEdge.x - ux * 10);
    const endY = rhuInt(targetEdge.y - uy * 10);

    ctx.primitives.push({
      kind: 'line',
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      stroke: tk.arrowStroke,
      strokeWidth: tk.arrowStrokeWidth,
    });

    const ah = 8;
    const angle = Math.atan2(tipY - startY, tipX - startX);
    const headX1 = tipX - ah * Math.cos(angle - Math.PI / 6);
    const headY1 = tipY - ah * Math.sin(angle - Math.PI / 6);
    const headX2 = tipX - ah * Math.cos(angle + Math.PI / 6);
    const headY2 = tipY - ah * Math.sin(angle + Math.PI / 6);
    ctx.primitives.push({
      kind: 'path',
      d: `M ${tipX} ${tipY} L ${rhuInt(headX1)} ${rhuInt(headY1)} L ${rhuInt(headX2)} ${rhuInt(headY2)} Z`,
      fill: tk.arrowStroke,
      stroke: tk.arrowStroke,
      strokeWidth: 1,
    } satisfies PathPrimitive);

    if (arrow.label) {
      ctx.primitives.push({
        kind: 'text',
        x: rhuInt((startX + endX) / 2),
        y: rhuInt((startY + endY) / 2 - 6),
        text: arrow.label,
        fontFamily: tk.fontFamily,
        fontSize: tk.arrowFontSize,
        fontWeight: 500,
        fill: tk.arrowLabelColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }
  }

  return {
    width: rhuInt(tk.marginLeft + rootLayout.width + tk.marginRight),
    height: rhuInt(tk.marginTop + rootLayout.height + tk.marginBottom),
    background: tk.background,
    primitives: ctx.primitives,
  };
}
