/**
 * @file grammars/class/layout.ts — Class Grammar layout engine.
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
import type { NodeAnchorRegistry, RenderWithAnchors } from '../../anchors.js';

import type { ClassDef, ClassDocument, ClassMember, ClassRelationship } from './types.js';
import type { ClassTheme } from './theme.js';
import { resolveClassTheme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

function normalize(dx: number, dy: number): { dx: number; dy: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { dx: 1, dy: 0 };
  return { dx: dx / len, dy: dy / len };
}

interface SizedClass {
  cls: ClassDef;
  attributes: ClassMember[];
  methods: ClassMember[];
  width: number;
  height: number;
  titleHeight: number;
  attributeHeight: number;
  methodHeight: number;
}

interface PlacedClass extends SizedClass {
  row: number;
  col: number;
  x: number;
  y: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

interface Point {
  x: number;
  y: number;
}

function normalizeTypeText(text: string): string {
  return text.replace(/~([^~]+)~/g, '<$1>').trim();
}

function formatMember(member: ClassMember): string {
  const visibility = member.visibility ?? '';
  const modifiers = member.modifiers?.length ? `${member.modifiers.join(' ')} ` : '';
  if (member.isMethod) {
    const params = normalizeTypeText(member.params ?? '');
    const returnText = member.type ? `: ${normalizeTypeText(member.type)}` : '';
    return `${visibility}${modifiers}${member.name}(${params})${returnText}`;
  }
  const typeText = member.type ? `: ${normalizeTypeText(member.type)}` : '';
  return `${visibility}${modifiers}${member.name}${typeText}`;
}

function measureClass(cls: ClassDef, tk: ClassTheme): SizedClass {
  const attributes = cls.members.filter((member) => !member.isMethod);
  const methods = cls.members.filter((member) => member.isMethod);

  const nameWidth = rhuInt(measureText(cls.name, tk.titleFontSize).width);
  const stereotypeWidth = cls.stereotype
    ? rhuInt(measureText(cls.stereotype, tk.stereotypeFontSize).width)
    : 0;

  let memberWidth = 0;
  for (const member of cls.members) {
    memberWidth = Math.max(memberWidth, rhuInt(measureText(formatMember(member), tk.memberFontSize).width));
  }

  const width = rhuInt(
    Math.max(Math.max(nameWidth, stereotypeWidth), memberWidth) + 2 * tk.classPadX,
  );
  const finalWidth = Math.max(width, tk.minClassWidth);

  const titleHeight = rhuInt(
    tk.titleFontSize * 1.6 + 2 * tk.classPadY + (cls.stereotype ? tk.stereotypeFontSize * 1.4 : 0),
  );
  const attributeHeight =
    attributes.length > 0 ? rhuInt(attributes.length * tk.lineHeight + 2 * tk.classPadY) : 0;
  const methodHeight =
    methods.length > 0 ? rhuInt(methods.length * tk.lineHeight + 2 * tk.classPadY) : 0;

  return {
    cls,
    attributes,
    methods,
    width: finalWidth,
    height: rhuInt(titleHeight + attributeHeight + methodHeight),
    titleHeight,
    attributeHeight,
    methodHeight,
  };
}

function buildClassPrimitives(box: PlacedClass, tk: ClassTheme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];

  const outerRect: RectPrimitive = {
    kind: 'rect',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    fill: tk.bodyFill,
    stroke: tk.bodyStroke,
    strokeWidth: tk.bodyStrokeWidth,
    rx: tk.titleRx,
  };
  primitives.push(outerRect);

  const titleRect: RectPrimitive = {
    kind: 'rect',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.titleHeight,
    fill: tk.titleFill,
    stroke: tk.titleStroke,
    strokeWidth: tk.titleStrokeWidth,
    rx: tk.titleRx,
  };
  primitives.push(titleRect);

  let dividerY = box.y + box.titleHeight;
  if (box.attributeHeight > 0 || box.methodHeight > 0) {
    primitives.push({
      kind: 'line',
      x1: box.x,
      y1: dividerY,
      x2: box.right,
      y2: dividerY,
      stroke: tk.compartmentDividerStroke,
      strokeWidth: tk.compartmentDividerWidth,
    } satisfies LinePrimitive);
  }

  if (box.attributeHeight > 0 && box.methodHeight > 0) {
    dividerY = box.y + box.titleHeight + box.attributeHeight;
    primitives.push({
      kind: 'line',
      x1: box.x,
      y1: dividerY,
      x2: box.right,
      y2: dividerY,
      stroke: tk.compartmentDividerStroke,
      strokeWidth: tk.compartmentDividerWidth,
    } satisfies LinePrimitive);
  }

  if (box.cls.stereotype) {
    primitives.push({
      kind: 'text',
      x: box.cx,
      y: rhuInt(box.y + tk.classPadY + tk.stereotypeFontSize * 0.8),
      text: box.cls.stereotype,
      fontFamily: tk.fontFamily,
      fontSize: tk.stereotypeFontSize,
      fontWeight: 500,
      fill: tk.stereotypeColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
  }

  const titleBaseline = box.cls.stereotype
    ? rhuInt(box.y + tk.classPadY + tk.stereotypeFontSize * 1.4 + tk.titleFontSize * 0.85)
    : rhuInt(box.y + tk.classPadY + tk.titleFontSize * 0.95);

  primitives.push({
    kind: 'text',
    x: box.cx,
    y: titleBaseline,
    text: box.cls.name,
    fontFamily: tk.fontFamily,
    fontSize: tk.titleFontSize,
    fontWeight: tk.titleFontWeight,
    fill: tk.titleTextColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  } satisfies TextPrimitive);

  let sectionTop = box.y + box.titleHeight;
  if (box.attributeHeight > 0) {
    let y = rhuInt(sectionTop + tk.classPadY + tk.memberFontSize * 0.85);
    for (const member of box.attributes) {
      primitives.push({
        kind: 'text',
        x: rhuInt(box.x + tk.classPadX),
        y,
        text: formatMember(member),
        fontFamily: tk.fontFamily,
        fontSize: tk.memberFontSize,
        fontWeight: tk.memberFontWeight,
        fill: tk.memberTextColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
      y = rhuInt(y + tk.lineHeight);
    }
    sectionTop += box.attributeHeight;
  }

  if (box.methodHeight > 0) {
    let y = rhuInt(sectionTop + tk.classPadY + tk.memberFontSize * 0.85);
    for (const member of box.methods) {
      primitives.push({
        kind: 'text',
        x: rhuInt(box.x + tk.classPadX),
        y,
        text: formatMember(member),
        fontFamily: tk.fontFamily,
        fontSize: tk.memberFontSize,
        fontWeight: tk.memberFontWeight,
        fill: tk.memberTextColor,
        textAnchor: 'start',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
      y = rhuInt(y + tk.lineHeight);
    }
  }

  return primitives;
}

function diamondMarker(tip: Point, dir: Point, tk: ClassTheme, fill: string): PathPrimitive {
  const half = tk.arrowSize * 0.6;
  const px = -dir.y;
  const py = dir.x;
  const center = { x: tip.x + dir.x * tk.arrowSize, y: tip.y + dir.y * tk.arrowSize };
  const far = { x: tip.x + dir.x * 2 * tk.arrowSize, y: tip.y + dir.y * 2 * tk.arrowSize };

  const d = [
    `M ${rhuInt(tip.x)} ${rhuInt(tip.y)}`,
    `L ${rhuInt(center.x + px * half)} ${rhuInt(center.y + py * half)}`,
    `L ${rhuInt(far.x)} ${rhuInt(far.y)}`,
    `L ${rhuInt(center.x - px * half)} ${rhuInt(center.y - py * half)}`,
    'Z',
  ].join(' ');

  return {
    kind: 'path',
    d,
    fill,
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
    strokeLinecap: 'round',
  };
}

function triangleMarker(tip: Point, dir: Point, tk: ClassTheme): PathPrimitive {
  const half = tk.arrowSize * 0.6;
  const px = -dir.y;
  const py = dir.x;
  const base = { x: tip.x - dir.x * tk.arrowSize, y: tip.y - dir.y * tk.arrowSize };

  const d = [
    `M ${rhuInt(tip.x)} ${rhuInt(tip.y)}`,
    `L ${rhuInt(base.x + px * half)} ${rhuInt(base.y + py * half)}`,
    `L ${rhuInt(base.x - px * half)} ${rhuInt(base.y - py * half)}`,
    'Z',
  ].join(' ');

  return {
    kind: 'path',
    d,
    fill: tk.background,
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
    strokeLinecap: 'round',
  };
}

function openArrowMarker(tip: Point, dir: Point, tk: ClassTheme): PathPrimitive {
  const half = tk.arrowSize * 0.6;
  const px = -dir.y;
  const py = dir.x;
  const base = { x: tip.x - dir.x * tk.arrowSize, y: tip.y - dir.y * tk.arrowSize };

  const d = [
    `M ${rhuInt(base.x + px * half)} ${rhuInt(base.y + py * half)}`,
    `L ${rhuInt(tip.x)} ${rhuInt(tip.y)}`,
    `L ${rhuInt(base.x - px * half)} ${rhuInt(base.y - py * half)}`,
  ].join(' ');

  return {
    kind: 'path',
    d,
    fill: 'none',
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
    strokeLinecap: 'round',
  };
}

function selectPorts(from: PlacedClass, to: PlacedClass): { start: Point; end: Point } {
  if (from.col === to.col) {
    if (from.cy <= to.cy) {
      return {
        start: { x: from.cx, y: from.bottom },
        end: { x: to.cx, y: to.y },
      };
    }
    return {
      start: { x: from.cx, y: from.y },
      end: { x: to.cx, y: to.bottom },
    };
  }

  if (from.cx < to.cx) {
    return {
      start: { x: from.right, y: from.cy },
      end: { x: to.x, y: to.cy },
    };
  }

  return {
    start: { x: from.x, y: from.cy },
    end: { x: to.right, y: to.cy },
  };
}

function buildStraightRelationship(
  relationship: ClassRelationship,
  fromBox: PlacedClass,
  toBox: PlacedClass,
  tk: ClassTheme,
): { lines: ScenePrimitive[]; markers: ScenePrimitive[]; labels: ScenePrimitive[] } {
  const { start, end } = selectPorts(fromBox, toBox);
  const unit = normalize(end.x - start.x, end.y - start.y);
  const perp = { x: -unit.dy, y: unit.dx };
  const dir = { x: unit.dx, y: unit.dy };

  let startInset = 0;
  let endInset = 0;
  if (relationship.kind === 'composition' || relationship.kind === 'aggregation') {
    startInset = tk.arrowSize * 2;
  }
  if (
    relationship.kind === 'inheritance' ||
    relationship.kind === 'realization' ||
    relationship.kind === 'association' ||
    relationship.kind === 'dependency'
  ) {
    endInset = tk.arrowSize;
  }

  const lineStart = {
    x: start.x + dir.x * startInset,
    y: start.y + dir.y * startInset,
  };
  const lineEnd = {
    x: end.x - dir.x * endInset,
    y: end.y - dir.y * endInset,
  };

  const line: LinePrimitive = {
    kind: 'line',
    x1: rhuInt(lineStart.x),
    y1: rhuInt(lineStart.y),
    x2: rhuInt(lineEnd.x),
    y2: rhuInt(lineEnd.y),
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
  };
  if (relationship.kind === 'realization' || relationship.kind === 'dependency') {
    line.dashArray = tk.edgeDash;
  }

  const markers: ScenePrimitive[] = [];
  if (relationship.kind === 'composition') {
    markers.push(diamondMarker(start, dir, tk, tk.edgeStroke));
  } else if (relationship.kind === 'aggregation') {
    markers.push(diamondMarker(start, dir, tk, tk.background));
  } else if (relationship.kind === 'inheritance' || relationship.kind === 'realization') {
    markers.push(triangleMarker(end, dir, tk));
  } else if (relationship.kind === 'association' || relationship.kind === 'dependency') {
    markers.push(openArrowMarker(end, dir, tk));
  }

  const labels: ScenePrimitive[] = [];
  if (relationship.fromCardinality) {
    labels.push({
      kind: 'text',
      x: rhuInt(start.x + dir.x * 12 + perp.x * 8),
      y: rhuInt(start.y + dir.y * 12 + perp.y * 8),
      text: relationship.fromCardinality,
      fontFamily: tk.fontFamily,
      fontSize: tk.cardinalityFontSize,
      fontWeight: 500,
      fill: tk.cardinalityColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }
  if (relationship.toCardinality) {
    labels.push({
      kind: 'text',
      x: rhuInt(end.x - dir.x * 12 + perp.x * 8),
      y: rhuInt(end.y - dir.y * 12 + perp.y * 8),
      text: relationship.toCardinality,
      fontFamily: tk.fontFamily,
      fontSize: tk.cardinalityFontSize,
      fontWeight: 500,
      fill: tk.cardinalityColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }
  if (relationship.label) {
    const midX = (start.x + end.x) / 2 - perp.x * 10;
    const midY = (start.y + end.y) / 2 - perp.y * 10;
    labels.push({
      kind: 'text',
      x: rhuInt(midX),
      y: rhuInt(midY),
      text: relationship.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.edgeLabelFontSize,
      fontWeight: 500,
      fill: tk.edgeLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }

  return {
    lines: [line],
    markers,
    labels,
  };
}

function buildSelfRelationship(
  relationship: ClassRelationship,
  box: PlacedClass,
  tk: ClassTheme,
): { lines: ScenePrimitive[]; markers: ScenePrimitive[]; labels: ScenePrimitive[] } {
  const start = { x: box.right, y: rhuInt(box.cy - 14) };
  const end = { x: box.right, y: rhuInt(box.cy + 14) };
  const elbow = rhuInt(box.right + Math.max(32, tk.arrowSize * 3));
  const d = [
    `M ${start.x} ${start.y}`,
    `C ${elbow} ${rhuInt(start.y - 18)} ${elbow} ${rhuInt(end.y + 18)} ${end.x} ${end.y}`,
  ].join(' ');
  const line: PathPrimitive = {
    kind: 'path',
    d,
    fill: 'none',
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
    strokeLinecap: 'round',
  };
  if (relationship.kind === 'realization' || relationship.kind === 'dependency') {
    line.dashArray = tk.edgeDash;
  }

  const markers: ScenePrimitive[] = [];
  if (relationship.kind === 'composition') {
    markers.push(diamondMarker(start, { x: 1, y: 0 }, tk, tk.edgeStroke));
  } else if (relationship.kind === 'aggregation') {
    markers.push(diamondMarker(start, { x: 1, y: 0 }, tk, tk.background));
  } else if (relationship.kind === 'inheritance' || relationship.kind === 'realization') {
    markers.push(triangleMarker(end, { x: -1, y: 0 }, tk));
  } else if (relationship.kind === 'association' || relationship.kind === 'dependency') {
    markers.push(openArrowMarker(end, { x: -1, y: 0 }, tk));
  }

  const labels: ScenePrimitive[] = [];
  if (relationship.label) {
    labels.push({
      kind: 'text',
      x: rhuInt(elbow),
      y: box.cy,
      text: relationship.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.edgeLabelFontSize,
      fontWeight: 500,
      fill: tk.edgeLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }
  if (relationship.fromCardinality) {
    labels.push({
      kind: 'text',
      x: rhuInt(start.x + 16),
      y: rhuInt(start.y - 10),
      text: relationship.fromCardinality,
      fontFamily: tk.fontFamily,
      fontSize: tk.cardinalityFontSize,
      fontWeight: 500,
      fill: tk.cardinalityColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }
  if (relationship.toCardinality) {
    labels.push({
      kind: 'text',
      x: rhuInt(end.x + 16),
      y: rhuInt(end.y + 10),
      text: relationship.toCardinality,
      fontFamily: tk.fontFamily,
      fontSize: tk.cardinalityFontSize,
      fontWeight: 500,
      fill: tk.cardinalityColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }

  return {
    lines: [line],
    markers,
    labels,
  };
}

export function layoutClass(doc: ClassDocument, themeOverride?: ClassTheme): RenderWithAnchors<Scene> {
  const tk = themeOverride ?? resolveClassTheme(doc.metadata.theme);

  if (doc.classes.length === 0) {
    return {
      scene: {
        width: rhuInt(tk.marginLeft + tk.marginRight),
        height: rhuInt(tk.marginTop + tk.marginBottom),
        background: tk.background,
        primitives: [],
      },
      anchors: {},
    };
  }

  const sized = doc.classes.map((cls) => measureClass(cls, tk));
  const rows = Math.ceil(sized.length / 2);
  const colCount = sized.length > rows ? 2 : 1;
  const maxColWidth = sized.reduce((acc, item) => Math.max(acc, item.width), 0);
  const maxRowHeight = sized.reduce((acc, item) => Math.max(acc, item.height), 0);

  const placed: PlacedClass[] = sized.map((item, index) => {
    const col = index < rows ? 0 : 1;
    const row = col === 0 ? index : index - rows;
    const cellX = rhuInt(tk.marginLeft + col * (maxColWidth + tk.classGapX));
    const cellY = rhuInt(tk.marginTop + row * (maxRowHeight + tk.classGapY));
    const x = rhuInt(cellX + (maxColWidth - item.width) / 2);
    const y = rhuInt(cellY + (maxRowHeight - item.height) / 2);
    return {
      ...item,
      row,
      col,
      x,
      y,
      right: rhuInt(x + item.width),
      bottom: rhuInt(y + item.height),
      cx: rhuInt(x + item.width / 2),
      cy: rhuInt(y + item.height / 2),
    };
  });

  const classById = new Map<string, PlacedClass>();
  for (const item of placed) classById.set(item.cls.id, item);

  const edgeLines: ScenePrimitive[] = [];
  const edgeMarkers: ScenePrimitive[] = [];
  const edgeLabels: ScenePrimitive[] = [];

  for (const relationship of doc.relationships) {
    const fromBox = classById.get(relationship.from);
    const toBox = classById.get(relationship.to);
    if (!fromBox || !toBox) continue;

    const built =
      fromBox.cls.id === toBox.cls.id
        ? buildSelfRelationship(relationship, fromBox, tk)
        : buildStraightRelationship(relationship, fromBox, toBox, tk);
    edgeLines.push(...built.lines);
    edgeMarkers.push(...built.markers);
    edgeLabels.push(...built.labels);
  }

  const classPrimitives: ScenePrimitive[] = [];
  for (const item of placed) {
    classPrimitives.push(...buildClassPrimitives(item, tk));
  }

  const width = rhuInt(
    tk.marginLeft + colCount * maxColWidth + (colCount - 1) * tk.classGapX + tk.marginRight,
  );
  const height = rhuInt(
    tk.marginTop + rows * maxRowHeight + (rows - 1) * tk.classGapY + tk.marginBottom,
  );

  // ── Node-anchor registry (sidecar — §30b Phase A) ─────────────────────────
  // Index by BOTH the display name (cls.name, as authored in the source) and
  // the sanitized id (cls.id, lowercase) so that link statements can reference
  // class nodes using the original capitalisation they were declared with.
  const anchors: NodeAnchorRegistry = {};
  for (const item of placed) {
    const anchor = { id: item.cls.name, x: item.x, y: item.y, w: item.width, h: item.height };
    anchors[item.cls.name] = anchor;
    if (item.cls.id !== item.cls.name) {
      anchors[item.cls.id] = { ...anchor, id: item.cls.id };
    }
  }

  return {
    scene: {
      width,
      height,
      background: tk.background,
      primitives: [...edgeLines, ...classPrimitives, ...edgeMarkers, ...edgeLabels],
    },
    anchors,
  };
}
