/**
 * @file grammars/requirement/layout.ts — Requirement Diagram layout engine.
 *
 * Produces a Scene IR from a RequirementDocument. Layout strategy:
 *   - Nodes (requirements + elements) are placed in a 2-column grid,
 *     analogous to the class diagram layout.
 *   - Each node box: title band (stereotype + bold name) + body compartment
 *     (attribute lines "ID: / Text: / Risk: / Verification:" for requirements;
 *     "Type: / DocRef:" for elements).
 *   - Directed edges drawn between nodes with an open arrowhead at the target.
 *     A centered «kind» pill (rounded rect + label) is placed at the midpoint.
 *
 * Fidelity reference: real Mermaid renders show compartment boxes identical to
 * classDiagram style — title band with stereotype italic above bold name,
 * attribute list below a divider line, edges with «kind» pill labels.
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

import type {
  RequirementDocument,
  RequirementElement,
  RequirementNode,
  RequirementRelKind,
} from './types.js';
import type { RequirementTheme } from './theme.js';
import { resolveRequirementTheme } from './theme.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

function normalize(dx: number, dy: number): { dx: number; dy: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { dx: 1, dy: 0 };
  return { dx: dx / len, dy: dy / len };
}

/** Map requirement kind → «stereotype» label. */
function stereotypeLabel(kind: string): string {
  switch (kind) {
    case 'functionalRequirement':  return '«Functional»';
    case 'interfaceRequirement':   return '«Interface»';
    case 'performanceRequirement': return '«Performance»';
    case 'physicalRequirement':    return '«Physical»';
    case 'designConstraint':       return '«Design Constraint»';
    default:                       return '«Requirement»';
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Sizing types
// ---------------------------------------------------------------------------

type NodeEntry =
  | { kind: 'requirement'; node: RequirementNode; attrs: string[] }
  | { kind: 'element';     node: RequirementElement; attrs: string[] };

interface SizedBox {
  entry: NodeEntry;
  name: string;
  stereotype: string;
  width: number;
  height: number;
  titleHeight: number;
  bodyHeight: number;
}

interface PlacedBox extends SizedBox {
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

// ---------------------------------------------------------------------------
// Build attribute line list for a node
// ---------------------------------------------------------------------------

function requirementAttrs(node: RequirementNode): string[] {
  const lines: string[] = [];
  if (node.id !== undefined)           lines.push(`ID: ${node.id}`);
  if (node.text !== undefined)         lines.push(`Text: ${node.text}`);
  if (node.risk !== undefined)         lines.push(`Risk: ${capitalize(node.risk)}`);
  if (node.verifymethod !== undefined) lines.push(`Verification: ${capitalize(node.verifymethod)}`);
  return lines;
}

function elementAttrs(node: RequirementElement): string[] {
  const lines: string[] = [];
  if (node.type !== undefined)   lines.push(`Type: ${node.type}`);
  if (node.docref !== undefined) lines.push(`DocRef: ${node.docref}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Measure a node box
// ---------------------------------------------------------------------------

function measureBox(entry: NodeEntry, tk: RequirementTheme): SizedBox {
  const isReq = entry.kind === 'requirement';
  const name  = isReq ? entry.node.name : entry.node.name;
  const stereotype = isReq ? stereotypeLabel(entry.node.kind) : '«Element»';
  const attrs = entry.attrs;

  const nameW   = rhuInt(measureText(name, tk.titleFontSize).width);
  const stereoW = rhuInt(measureText(stereotype, tk.stereotypeFontSize).width);

  let attrW = 0;
  for (const line of attrs) {
    attrW = Math.max(attrW, rhuInt(measureText(line, tk.attrFontSize).width));
  }

  const contentW = Math.max(Math.max(nameW, stereoW), attrW) + 2 * tk.nodePadX;
  const width    = Math.max(contentW, tk.minNodeWidth);

  // title band height: stereotype line + name line + padding
  const titleHeight = rhuInt(
    tk.nodePadY + tk.stereotypeFontSize * 1.3 + tk.titleFontSize * 1.3 + tk.nodePadY,
  );

  const bodyHeight = attrs.length > 0
    ? rhuInt(tk.nodePadY + attrs.length * tk.lineHeight + tk.nodePadY)
    : rhuInt(tk.nodePadY * 2);

  return {
    entry,
    name,
    stereotype,
    width,
    height: rhuInt(titleHeight + bodyHeight),
    titleHeight,
    bodyHeight,
  };
}

// ---------------------------------------------------------------------------
// Draw a placed box as scene primitives
// ---------------------------------------------------------------------------

function buildBoxPrimitives(box: PlacedBox, tk: RequirementTheme): ScenePrimitive[] {
  const prims: ScenePrimitive[] = [];

  // Outer rect (body)
  prims.push({
    kind: 'rect',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    fill: tk.bodyFill,
    stroke: tk.bodyStroke,
    strokeWidth: tk.bodyStrokeWidth,
    rx: tk.titleRx,
  } satisfies RectPrimitive);

  // Title band
  prims.push({
    kind: 'rect',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.titleHeight,
    fill: tk.titleFill,
    stroke: tk.titleStroke,
    strokeWidth: tk.titleStrokeWidth,
    rx: tk.titleRx,
  } satisfies RectPrimitive);

  // Divider between title and body
  if (box.bodyHeight > 0) {
    const divY = rhuInt(box.y + box.titleHeight);
    prims.push({
      kind: 'line',
      x1: box.x,
      y1: divY,
      x2: box.right,
      y2: divY,
      stroke: tk.compartmentDividerStroke,
      strokeWidth: tk.compartmentDividerWidth,
    } satisfies LinePrimitive);
  }

  // Stereotype label (italic via font-style handled in SVG backend; we use lighter weight)
  const stereoY = rhuInt(box.y + tk.nodePadY + tk.stereotypeFontSize * 0.9);
  prims.push({
    kind: 'text',
    x: box.cx,
    y: stereoY,
    text: box.stereotype,
    fontFamily: tk.fontFamily,
    fontSize: tk.stereotypeFontSize,
    fontWeight: 400,
    fill: tk.stereotypeColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  } satisfies TextPrimitive);

  // Name (bold)
  const nameY = rhuInt(stereoY + tk.stereotypeFontSize * 0.5 + tk.titleFontSize * 0.9);
  prims.push({
    kind: 'text',
    x: box.cx,
    y: nameY,
    text: box.name,
    fontFamily: tk.fontFamily,
    fontSize: tk.titleFontSize,
    fontWeight: tk.titleFontWeight,
    fill: tk.titleTextColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  } satisfies TextPrimitive);

  // Attribute lines
  let attrY = rhuInt(box.y + box.titleHeight + tk.nodePadY + tk.attrFontSize * 0.85);
  for (const line of box.entry.attrs) {
    prims.push({
      kind: 'text',
      x: rhuInt(box.x + tk.nodePadX),
      y: attrY,
      text: line,
      fontFamily: tk.fontFamily,
      fontSize: tk.attrFontSize,
      fontWeight: tk.attrFontWeight,
      fill: tk.attrTextColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
    attrY = rhuInt(attrY + tk.lineHeight);
  }

  return prims;
}

// ---------------------------------------------------------------------------
// Port selection (same logic as class layout)
// ---------------------------------------------------------------------------

function selectPorts(from: PlacedBox, to: PlacedBox): { start: Point; end: Point } {
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

// ---------------------------------------------------------------------------
// Open arrowhead at target end
// ---------------------------------------------------------------------------

function openArrow(tip: Point, dir: { dx: number; dy: number }, tk: RequirementTheme): PathPrimitive {
  const half = tk.arrowSize * 0.6;
  const px = -dir.dy;
  const py =  dir.dx;
  const base = { x: tip.x - dir.dx * tk.arrowSize, y: tip.y - dir.dy * tk.arrowSize };
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

// ---------------------------------------------------------------------------
// Edge + pill label
// ---------------------------------------------------------------------------

function buildEdgePrimitives(
  src: PlacedBox,
  dst: PlacedBox,
  kind: RequirementRelKind,
  tk: RequirementTheme,
): ScenePrimitive[] {
  const prims: ScenePrimitive[] = [];
  const { start, end } = selectPorts(src, dst);
  const unit = normalize(end.x - start.x, end.y - start.y);
  const endInset = tk.arrowSize;
  const lineEnd = {
    x: end.x - unit.dx * endInset,
    y: end.y - unit.dy * endInset,
  };

  prims.push({
    kind: 'line',
    x1: rhuInt(start.x),
    y1: rhuInt(start.y),
    x2: rhuInt(lineEnd.x),
    y2: rhuInt(lineEnd.y),
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
  } satisfies LinePrimitive);

  prims.push(openArrow(end, unit, tk));

  // «kind» pill at midpoint
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const pillLabel = `«${kind}»`;
  const pillTextW = rhuInt(measureText(pillLabel, tk.pillFontSize).width);
  const pillW  = pillTextW + 2 * tk.pillPadX;
  const pillH  = rhuInt(tk.pillFontSize * 1.2 + 2 * tk.pillPadY);
  const pillX  = rhuInt(midX - pillW / 2);
  const pillY  = rhuInt(midY - pillH / 2);

  // white background pill rect
  prims.push({
    kind: 'rect',
    x: pillX,
    y: pillY,
    width: pillW,
    height: pillH,
    fill: tk.pillFill,
    stroke: tk.pillStroke,
    strokeWidth: tk.pillStrokeWidth,
    rx: tk.pillRx,
  } satisfies RectPrimitive);

  prims.push({
    kind: 'text',
    x: rhuInt(midX),
    y: rhuInt(midY + tk.pillFontSize * 0.35),
    text: pillLabel,
    fontFamily: tk.fontFamily,
    fontSize: tk.pillFontSize,
    fontWeight: 500,
    fill: tk.pillTextColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  } satisfies TextPrimitive);

  return prims;
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

export function layoutRequirement(doc: RequirementDocument, themeOverride?: RequirementTheme): Scene {
  const tk = themeOverride ?? resolveRequirementTheme(doc.metadata.theme);

  // Build node entries list: requirements then elements
  const entries: NodeEntry[] = [
    ...doc.requirements.map((n) => ({ kind: 'requirement' as const, node: n, attrs: requirementAttrs(n) })),
    ...doc.elements.map((n)  => ({ kind: 'element' as const,     node: n, attrs: elementAttrs(n) })),
  ];

  if (entries.length === 0) {
    return {
      width:      rhuInt(tk.marginLeft + tk.marginRight),
      height:     rhuInt(tk.marginTop + tk.marginBottom),
      background: tk.background,
      primitives: [],
    };
  }

  // Measure all boxes
  const sized = entries.map((e) => measureBox(e, tk));

  // 2-column grid layout (same as class grammar)
  const total    = sized.length;
  const rows     = Math.ceil(total / 2);
  const colCount = total > rows ? 2 : 1;

  const maxW = sized.reduce((a, b) => Math.max(a, b.width),  0);
  const maxH = sized.reduce((a, b) => Math.max(a, b.height), 0);

  const placed: PlacedBox[] = sized.map((item, index) => {
    const col = index < rows ? 0 : 1;
    const row = col === 0 ? index : index - rows;
    const cellX = rhuInt(tk.marginLeft + col * (maxW + tk.nodeGapX));
    const cellY = rhuInt(tk.marginTop  + row * (maxH + tk.nodeGapY));
    const x = rhuInt(cellX + (maxW - item.width) / 2);
    const y = rhuInt(cellY + (maxH - item.height) / 2);
    return {
      ...item,
      row, col, x, y,
      right:  rhuInt(x + item.width),
      bottom: rhuInt(y + item.height),
      cx:     rhuInt(x + item.width  / 2),
      cy:     rhuInt(y + item.height / 2),
    };
  });

  // Build name → PlacedBox map
  const byName = new Map<string, PlacedBox>();
  for (const pb of placed) byName.set(pb.name, pb);

  // Render order: edges first (behind boxes), then box bodies, then arrowheads+pills
  const edgeLines:   ScenePrimitive[] = [];
  const edgePills:   ScenePrimitive[] = [];
  const nodePrims:   ScenePrimitive[] = [];

  for (const rel of doc.relationships) {
    const srcBox = byName.get(rel.src);
    const dstBox = byName.get(rel.dst);
    if (!srcBox || !dstBox) continue;
    const ep = buildEdgePrimitives(srcBox, dstBox, rel.kind, tk);
    // line is first primitive, pill + arrowhead are the rest
    if (ep.length > 0) edgeLines.push(ep[0]!);
    edgePills.push(...ep.slice(1));
  }

  for (const pb of placed) {
    nodePrims.push(...buildBoxPrimitives(pb, tk));
  }

  const width  = rhuInt(tk.marginLeft + colCount * maxW + (colCount - 1) * tk.nodeGapX + tk.marginRight);
  const height = rhuInt(tk.marginTop  + rows    * maxH  + (rows    - 1) * tk.nodeGapY  + tk.marginBottom);

  return {
    width,
    height,
    background: tk.background,
    primitives: [...edgeLines, ...nodePrims, ...edgePills],
  };
}
