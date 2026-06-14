/**
 * @file grammars/er/layout.ts — ER Grammar deterministic layout engine.
 */

import type {
  LinePrimitive,
  PathPrimitive,
  RectPrimitive,
  Scene,
  ScenePrimitive,
  TextPrimitive,
} from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';

import type { ErAttribute, ErCardinality, ErDocument, ErEntity, ErRelationship } from './types.js';
import type { ErTheme } from './theme.js';
import { resolveErTheme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

interface Point {
  x: number;
  y: number;
}

interface SizedEntity {
  entity: ErEntity;
  width: number;
  height: number;
  titleHeight: number;
  bodyHeight: number;
  typeColWidth: number;
  nameColWidth: number;
  keyColWidth: number;
}

interface PlacedEntity extends SizedEntity {
  row: number;
  col: number;
  x: number;
  y: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

function formatKeys(attribute: ErAttribute): string {
  return attribute.keys?.join(',') ?? '';
}

function measureEntity(entity: ErEntity, tk: ErTheme): SizedEntity {
  const titleWidth = rhuInt(measureText(entity.name, tk.titleFontSize).width);
  let typeColWidth = 0;
  let nameColWidth = 0;
  let keyColWidth = 0;
  for (const attribute of entity.attributes) {
    typeColWidth = Math.max(typeColWidth, rhuInt(measureText(attribute.type, tk.attrTypeFontSize).width));
    nameColWidth = Math.max(nameColWidth, rhuInt(measureText(attribute.name, tk.attrNameFontSize).width));
    keyColWidth = Math.max(keyColWidth, rhuInt(measureText(formatKeys(attribute), tk.attrKeyFontSize).width));
  }
  const columnGap = tk.entityPadX;
  const width = Math.max(
    tk.minEntityWidth,
    rhuInt(
      Math.max(titleWidth, typeColWidth + nameColWidth + keyColWidth + columnGap * 2) + 2 * tk.entityPadX,
    ),
  );
  const titleHeight = rhuInt(tk.titleFontSize * 1.6 + 2 * tk.entityPadY);
  const bodyHeight = entity.attributes.length
    ? rhuInt(entity.attributes.length * tk.lineHeight + 2 * tk.entityPadY)
    : rhuInt(tk.lineHeight + 2 * tk.entityPadY);
  return {
    entity,
    width,
    height: rhuInt(titleHeight + bodyHeight),
    titleHeight,
    bodyHeight,
    typeColWidth,
    nameColWidth,
    keyColWidth,
  };
}

function buildEntityPrimitives(box: PlacedEntity, tk: ErTheme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [
    {
      kind: 'rect',
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: tk.bodyFill,
      stroke: tk.bodyStroke,
      strokeWidth: tk.bodyStrokeWidth,
      rx: tk.titleRx,
    } satisfies RectPrimitive,
    {
      kind: 'rect',
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.titleHeight,
      fill: tk.titleFill,
      stroke: tk.titleStroke,
      strokeWidth: tk.titleStrokeWidth,
      rx: tk.titleRx,
    } satisfies RectPrimitive,
    {
      kind: 'line',
      x1: box.x,
      y1: rhuInt(box.y + box.titleHeight),
      x2: box.right,
      y2: rhuInt(box.y + box.titleHeight),
      stroke: tk.compartmentDividerStroke,
      strokeWidth: tk.compartmentDividerWidth,
    } satisfies LinePrimitive,
    {
      kind: 'text',
      x: box.cx,
      y: rhuInt(box.y + tk.entityPadY + tk.titleFontSize),
      text: box.entity.name,
      fontFamily: tk.fontFamily,
      fontSize: tk.titleFontSize,
      fontWeight: tk.titleFontWeight,
      fill: tk.titleTextColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive,
  ];

  let y = rhuInt(box.y + box.titleHeight + tk.entityPadY + tk.attrNameFontSize * 0.9);
  const typeX = rhuInt(box.x + tk.entityPadX);
  const nameX = rhuInt(typeX + box.typeColWidth + tk.entityPadX);
  const keyX = rhuInt(nameX + box.nameColWidth + tk.entityPadX);
  for (const attribute of box.entity.attributes) {
    primitives.push({
      kind: 'text',
      x: typeX,
      y,
      text: attribute.type,
      fontFamily: tk.fontFamily,
      fontSize: tk.attrTypeFontSize,
      fontWeight: 500,
      fill: tk.attrTypeColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
    primitives.push({
      kind: 'text',
      x: nameX,
      y,
      text: attribute.name,
      fontFamily: tk.fontFamily,
      fontSize: tk.attrNameFontSize,
      fontWeight: 600,
      fill: tk.attrNameColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
    const keys = formatKeys(attribute);
    if (keys) {
      primitives.push({
        kind: 'text',
        x: keyX,
        y,
        text: keys,
        fontFamily: tk.fontFamily,
        fontSize: tk.attrKeyFontSize,
        fontWeight: 700,
        fill: tk.attrKeyColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }
    y = rhuInt(y + tk.lineHeight);
  }

  return primitives;
}

function selectPorts(from: PlacedEntity, to: PlacedEntity): { start: Point; end: Point } {
  if (from.col === to.col) {
    if (from.cy <= to.cy) {
      return { start: { x: from.cx, y: from.bottom }, end: { x: to.cx, y: to.y } };
    }
    return { start: { x: from.cx, y: from.y }, end: { x: to.cx, y: to.bottom } };
  }
  if (from.cx < to.cx) {
    return { start: { x: from.right, y: from.cy }, end: { x: to.x, y: to.cy } };
  }
  return { start: { x: from.x, y: from.cy }, end: { x: to.right, y: to.cy } };
}

function circlePath(cx: number, cy: number, r: number): string {
  return [
    `M ${rhuInt(cx - r)} ${rhuInt(cy)}`,
    `A ${r} ${r} 0 1 0 ${rhuInt(cx + r)} ${rhuInt(cy)}`,
    `A ${r} ${r} 0 1 0 ${rhuInt(cx - r)} ${rhuInt(cy)}`,
    'Z',
  ].join(' ');
}

function drawCrowFootEndpoint(p: Point, dir: Point, card: ErCardinality, tk: ErTheme): PathPrimitive[] {
  const primitives: PathPrimitive[] = [];
  const s = tk.crowFootSize;
  const px = -dir.y;
  const py = dir.x;

  function bar(d: number, halfLen: number): PathPrimitive {
    const bx = p.x + dir.x * d;
    const by = p.y + dir.y * d;
    return {
      kind: 'path',
      d: `M ${rhuInt(bx - px * halfLen)} ${rhuInt(by - py * halfLen)} L ${rhuInt(bx + px * halfLen)} ${rhuInt(by + py * halfLen)}`,
      fill: 'none',
      stroke: tk.edgeStroke,
      strokeWidth: tk.edgeStrokeWidth,
      strokeLinecap: 'round',
    };
  }

  function circle(d: number): PathPrimitive {
    const r = s * 0.35;
    const cx = p.x + dir.x * d;
    const cy = p.y + dir.y * d;
    return {
      kind: 'path',
      d: circlePath(cx, cy, r),
      fill: tk.background,
      stroke: tk.edgeStroke,
      strokeWidth: tk.edgeStrokeWidth,
      strokeLinecap: 'round',
    };
  }

  function crowFoot(fanBase: number, fanTip: number): PathPrimitive[] {
    const bx = p.x + dir.x * fanBase;
    const by = p.y + dir.y * fanBase;
    const tip = { x: p.x + dir.x * fanTip, y: p.y + dir.y * fanTip };
    const left = { x: bx + px * s * 0.6 + dir.x * s * 0.3, y: by + py * s * 0.6 + dir.y * s * 0.3 };
    const right = { x: bx - px * s * 0.6 + dir.x * s * 0.3, y: by - py * s * 0.6 + dir.y * s * 0.3 };
    return [
      {
        kind: 'path',
        d: `M ${rhuInt(tip.x)} ${rhuInt(tip.y)} L ${rhuInt(bx)} ${rhuInt(by)}`,
        fill: 'none',
        stroke: tk.edgeStroke,
        strokeWidth: tk.edgeStrokeWidth,
        strokeLinecap: 'round',
      },
      {
        kind: 'path',
        d: `M ${rhuInt(tip.x)} ${rhuInt(tip.y)} L ${rhuInt(left.x)} ${rhuInt(left.y)}`,
        fill: 'none',
        stroke: tk.edgeStroke,
        strokeWidth: tk.edgeStrokeWidth,
        strokeLinecap: 'round',
      },
      {
        kind: 'path',
        d: `M ${rhuInt(tip.x)} ${rhuInt(tip.y)} L ${rhuInt(right.x)} ${rhuInt(right.y)}`,
        fill: 'none',
        stroke: tk.edgeStroke,
        strokeWidth: tk.edgeStrokeWidth,
        strokeLinecap: 'round',
      },
    ];
  }

  switch (card) {
    case 'exactly-one':
      primitives.push(bar(s * 0.5, s * 0.7));
      primitives.push(bar(s * 1.0, s * 0.7));
      break;
    case 'zero-or-one':
      primitives.push(circle(s * 0.45));
      primitives.push(bar(s * 1.0, s * 0.7));
      break;
    case 'zero-or-many':
      primitives.push(circle(s * 0.4));
      primitives.push(...crowFoot(s * 1.0, s * 1.8));
      break;
    case 'one-or-many':
      primitives.push(bar(s * 0.5, s * 0.7));
      primitives.push(...crowFoot(s * 1.0, s * 1.8));
      break;
  }

  return primitives;
}

function buildRelationship(
  relationship: ErRelationship,
  fromBox: PlacedEntity,
  toBox: PlacedEntity,
  tk: ErTheme,
): { lines: ScenePrimitive[]; markers: ScenePrimitive[]; labels: ScenePrimitive[] } {
  const { start, end } = selectPorts(fromBox, toBox);
  const dir = normalize(end.x - start.x, end.y - start.y);
  const reverseDir = { x: -dir.x, y: -dir.y };
  const inset = tk.crowFootSize * 2.2;
  const line: LinePrimitive = {
    kind: 'line',
    x1: rhuInt(start.x + dir.x * inset),
    y1: rhuInt(start.y + dir.y * inset),
    x2: rhuInt(end.x + reverseDir.x * inset),
    y2: rhuInt(end.y + reverseDir.y * inset),
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
  };
  if (!relationship.identifying) line.dashArray = tk.edgeDash;

  const labels: ScenePrimitive[] = [];
  const perp = { x: -dir.y, y: dir.x };
  labels.push({
    kind: 'text',
    x: rhuInt((start.x + end.x) / 2 - perp.x * 12),
    y: rhuInt((start.y + end.y) / 2 - perp.y * 12),
    text: relationship.label,
    fontFamily: tk.fontFamily,
    fontSize: tk.edgeLabelFontSize,
    fontWeight: 600,
    fill: tk.edgeLabelColor,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  } satisfies TextPrimitive);

  return {
    lines: [line],
    markers: [
      ...drawCrowFootEndpoint(start, dir, relationship.cardinalityA, tk),
      ...drawCrowFootEndpoint(end, reverseDir, relationship.cardinalityB, tk),
    ],
    labels,
  };
}

export function layoutEr(doc: ErDocument, themeOverride?: ErTheme): Scene {
  const tk = themeOverride ?? resolveErTheme(doc.metadata.theme);
  if (doc.entities.length === 0) {
    return {
      width: rhuInt(tk.marginLeft + tk.marginRight),
      height: rhuInt(tk.marginTop + tk.marginBottom),
      background: tk.background,
      primitives: [],
    };
  }

  const sized = doc.entities.map((entity) => measureEntity(entity, tk));

  // Compute per-entity degree for relationship-aware placement.
  const degree = new Map<string, number>();
  for (const s of sized) degree.set(s.entity.name, 0);
  for (const r of doc.relationships) {
    degree.set(r.entityA, (degree.get(r.entityA) ?? 0) + 1);
    degree.set(r.entityB, (degree.get(r.entityB) ?? 0) + 1);
  }

  // Sort entities by degree (desc), then name (asc) for deterministic tie-breaking,
  // then assign to the grid in interleaved column order (index%2, floor(index/2)).
  // This clusters high-degree entities near each other, eliminating most diagonals.
  const sorted = [...sized].sort((a, b) => {
    const da = degree.get(a.entity.name) ?? 0;
    const db = degree.get(b.entity.name) ?? 0;
    if (db !== da) return db - da;
    return a.entity.name.localeCompare(b.entity.name);
  });

  const rows = Math.ceil(sorted.length / 2);
  const colCount = sorted.length > rows ? 2 : 1;
  const maxColWidth = sized.reduce((acc, entity) => Math.max(acc, entity.width), 0);
  const maxRowHeight = sized.reduce((acc, entity) => Math.max(acc, entity.height), 0);

  const placed: PlacedEntity[] = sorted.map((entity, idx) => {
    const col = colCount === 1 ? 0 : idx % 2;
    const row = colCount === 1 ? idx : Math.floor(idx / 2);
    const cellX = rhuInt(tk.marginLeft + col * (maxColWidth + tk.entityGapX));
    const cellY = rhuInt(tk.marginTop + row * (maxRowHeight + tk.entityGapY));
    const x = rhuInt(cellX + (maxColWidth - entity.width) / 2);
    const y = rhuInt(cellY + (maxRowHeight - entity.height) / 2);
    return {
      ...entity,
      row,
      col,
      x,
      y,
      right: rhuInt(x + entity.width),
      bottom: rhuInt(y + entity.height),
      cx: rhuInt(x + entity.width / 2),
      cy: rhuInt(y + entity.height / 2),
    };
  });

  const byName = new Map<string, PlacedEntity>();
  for (const entity of placed) byName.set(entity.entity.name, entity);

  const edgeLines: ScenePrimitive[] = [];
  const edgeMarkers: ScenePrimitive[] = [];
  const edgeLabels: ScenePrimitive[] = [];
  for (const relationship of doc.relationships) {
    const from = byName.get(relationship.entityA);
    const to = byName.get(relationship.entityB);
    if (!from || !to) continue;
    const built = buildRelationship(relationship, from, to, tk);
    edgeLines.push(...built.lines);
    edgeMarkers.push(...built.markers);
    edgeLabels.push(...built.labels);
  }

  const entityPrimitives: ScenePrimitive[] = [];
  for (const entity of placed) entityPrimitives.push(...buildEntityPrimitives(entity, tk));

  return {
    width: rhuInt(tk.marginLeft + colCount * maxColWidth + (colCount - 1) * tk.entityGapX + tk.marginRight),
    height: rhuInt(tk.marginTop + rows * maxRowHeight + (rows - 1) * tk.entityGapY + tk.marginBottom),
    background: tk.background,
    primitives: [...edgeLines, ...entityPrimitives, ...edgeMarkers, ...edgeLabels],
  };
}
