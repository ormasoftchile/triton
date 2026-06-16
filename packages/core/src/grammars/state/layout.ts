/**
 * @file grammars/state/layout.ts — State Grammar deterministic layout engine.
 */

import type {
  LinePrimitive,
  MultiTextPrimitive,
  PathPrimitive,
  RectPrimitive,
  Scene,
  ScenePrimitive,
  TextPrimitive,
} from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';
import { splitLabelLines } from '../../util/label-lines.js';
import type { NodeAnchorRegistry, RenderWithAnchors } from '../../anchors.js';

import type { StateDocument, StateNode, StateTransition } from './types.js';
import type { StateTheme } from './theme.js';
import { resolveStateTheme } from './theme.js';

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

type VisualKind = 'regular' | 'start' | 'end' | 'fork' | 'join' | 'choice' | 'composite';

interface MeasuredState {
  node: StateNode;
  visualKind: VisualKind;
  title: string;
  description?: string;
  width: number;
  height: number;
  childStates: MeasuredState[];
  childRowWidth: number;
  childRowHeight: number;
  depth: number;
}

interface PlacedState extends MeasuredState {
  x: number;
  y: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  childrenPlaced: PlacedState[];
  /** Column rank (index in the top-level ordered list); propagated to composite children. */
  rank: number;
}

function resolveText(node: StateNode): { title: string; description?: string } {
  const title = node.displayLabel ?? node.id;
  const description = node.description ?? (node.displayLabel ? undefined : node.label);
  return { title, description: description?.trim() || undefined };
}

function measureState(node: StateNode, tk: StateTheme, depth = 0): MeasuredState {
  const visualKind: VisualKind = node.children?.length
    ? 'composite'
    : node.isPseudo === 'start'
      ? 'start'
      : node.isPseudo === 'end'
        ? 'end'
        : node.isPseudo === 'fork'
          ? 'fork'
          : node.isPseudo === 'join'
            ? 'join'
            : node.isPseudo === 'choice'
              ? 'choice'
              : 'regular';

  const { title, description } = resolveText(node);

  if (visualKind === 'start' || visualKind === 'end') {
    const diameter = rhuInt(tk.pseudoRadius * 2 + tk.pseudoStrokeWidth * 2);
    return {
      node,
      visualKind,
      title,
      width: diameter,
      height: diameter,
      childStates: [],
      childRowWidth: 0,
      childRowHeight: 0,
      depth,
    };
  }

  if (visualKind === 'fork' || visualKind === 'join') {
    return {
      node,
      visualKind,
      title,
      width: tk.forkBarWidth,
      height: tk.forkBarHeight,
      childStates: [],
      childRowWidth: 0,
      childRowHeight: 0,
      depth,
    };
  }

  if (visualKind === 'choice') {
    const size = rhuInt(tk.choiceSize * 2);
    return {
      node,
      visualKind,
      title,
      width: size,
      height: size,
      childStates: [],
      childRowWidth: 0,
      childRowHeight: 0,
      depth,
    };
  }

  if (visualKind === 'composite' && node.children && depth <= 2) {
    const children = node.children.map((child) => measureState(child, tk, depth + 1));
    const childRowWidth = children.reduce(
      (acc, child, index) => acc + child.width + (index > 0 ? tk.stateGapX : 0),
      0,
    );
    const childRowHeight = children.reduce((acc, child) => Math.max(acc, child.height), 0);
    const titleWidth = rhuInt(measureText(title, tk.compositeTitleFontSize).width);
    const padX = tk.compositeBodyPadX;
    const width = Math.max(
      tk.minStateWidth,
      rhuInt(titleWidth + 2 * padX),
      rhuInt(childRowWidth + 2 * padX),
    );
    const height = rhuInt(
      tk.compositeHeaderHeight + 2 * tk.compositeBodyPadY + childRowHeight + tk.compositeBodyPadY,
    );
    return {
      node,
      visualKind,
      title,
      width,
      height,
      childStates: children,
      childRowWidth,
      childRowHeight,
      depth,
    };
  }

  const titleLines = splitLabelLines(title);
  const titleWidth = titleLines.reduce(
    (max, line) => Math.max(max, rhuInt(measureText(line, tk.stateFontSize).width)),
    0,
  );
  const descriptionWidth = description ? rhuInt(measureText(description, tk.descFontSize).width) : 0;
  const width = Math.max(
    tk.minStateWidth,
    rhuInt(Math.max(titleWidth, descriptionWidth) + 2 * tk.statePadX),
  );
  const titleBlock = tk.lineHeight * titleLines.length;
  const height = rhuInt(2 * tk.statePadY + titleBlock + (description ? tk.lineHeight : 0));
  return {
    node,
    visualKind: 'regular',
    title,
    ...(description ? { description } : {}),
    width,
    height,
    childStates: [],
    childRowWidth: 0,
    childRowHeight: 0,
    depth,
  };
}

function placeState(
  measured: MeasuredState,
  x: number,
  y: number,
  tk: StateTheme,
  byId: Map<string, PlacedState>,
  rank = 0,
): PlacedState {
  const placed: PlacedState = {
    ...measured,
    x: rhuInt(x),
    y: rhuInt(y),
    right: rhuInt(x + measured.width),
    bottom: rhuInt(y + measured.height),
    cx: rhuInt(x + measured.width / 2),
    cy: rhuInt(y + measured.height / 2),
    childrenPlaced: [],
    rank,
  };
  byId.set(measured.node.id, placed);

  if (measured.visualKind === 'composite' && measured.childStates.length > 0) {
    let childX = rhuInt(placed.x + tk.compositeBodyPadX);
    const childY = rhuInt(placed.y + tk.compositeHeaderHeight + tk.compositeBodyPadY);
    for (const child of measured.childStates) {
      const childPlaced = placeState(
        child,
        childX,
        childY + (measured.childRowHeight - child.height) / 2,
        tk,
        byId,
        rank,
      );
      placed.childrenPlaced.push(childPlaced);
      childX = rhuInt(childPlaced.right + tk.stateGapX);
    }
  }

  return placed;
}

function circlePath(cx: number, cy: number, r: number): string {
  return [
    `M ${rhuInt(cx - r)} ${rhuInt(cy)}`,
    `A ${r} ${r} 0 1 0 ${rhuInt(cx + r)} ${rhuInt(cy)}`,
    `A ${r} ${r} 0 1 0 ${rhuInt(cx - r)} ${rhuInt(cy)}`,
    'Z',
  ].join(' ');
}

function diamondPath(cx: number, cy: number, half: number): string {
  return [
    `M ${rhuInt(cx)} ${rhuInt(cy - half)}`,
    `L ${rhuInt(cx + half)} ${rhuInt(cy)}`,
    `L ${rhuInt(cx)} ${rhuInt(cy + half)}`,
    `L ${rhuInt(cx - half)} ${rhuInt(cy)}`,
    'Z',
  ].join(' ');
}

function openArrowMarker(tip: Point, dir: Point, tk: StateTheme): PathPrimitive {
  const half = tk.arrowSize * 0.6;
  const px = -dir.y;
  const py = dir.x;
  const base = { x: tip.x - dir.x * tk.arrowSize, y: tip.y - dir.y * tk.arrowSize };
  return {
    kind: 'path',
    d: [
      `M ${rhuInt(base.x + px * half)} ${rhuInt(base.y + py * half)}`,
      `L ${rhuInt(tip.x)} ${rhuInt(tip.y)}`,
      `L ${rhuInt(base.x - px * half)} ${rhuInt(base.y - py * half)}`,
    ].join(' '),
    fill: 'none',
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
    strokeLinecap: 'round',
  };
}

function selectPorts(from: PlacedState, to: PlacedState): { start: Point; end: Point } {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  if (Math.abs(dx) <= Math.max(from.width, to.width) * 0.35) {
    if (dy >= 0) {
      return { start: { x: from.cx, y: from.bottom }, end: { x: to.cx, y: to.y } };
    }
    return { start: { x: from.cx, y: from.y }, end: { x: to.cx, y: to.bottom } };
  }
  if (dx >= 0) {
    return { start: { x: from.right, y: from.cy }, end: { x: to.x, y: to.cy } };
  }
  return { start: { x: from.x, y: from.cy }, end: { x: to.right, y: to.cy } };
}

function buildSideTransition(
  transition: StateTransition,
  from: PlacedState,
  to: PlacedState,
  tk: StateTheme,
  sideTrackX: number,
): { lines: ScenePrimitive[]; markers: ScenePrimitive[]; labels: ScenePrimitive[] } {
  // Route via the left-margin side track to avoid crossing intermediate nodes.
  // Path: from.left → sideTrackX → to.left; arrow points rightward into target.
  const exitX = from.x;
  const exitY = from.cy;
  const enterY = to.cy;
  const tipX = to.x;
  const tipY = to.cy;
  const lineEndX = rhuInt(tipX - tk.arrowSize);

  const path: PathPrimitive = {
    kind: 'path',
    d: [
      `M ${rhuInt(exitX)} ${rhuInt(exitY)}`,
      `L ${rhuInt(sideTrackX)} ${rhuInt(exitY)}`,
      `L ${rhuInt(sideTrackX)} ${rhuInt(enterY)}`,
      `L ${rhuInt(lineEndX)} ${rhuInt(tipY)}`,
    ].join(' '),
    fill: 'none',
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
    strokeLinecap: 'round',
  };

  const marker = openArrowMarker({ x: tipX, y: tipY }, { x: 1, y: 0 }, tk);

  const labels: ScenePrimitive[] = [];
  if (transition.label) {
    const labelY = rhuInt((exitY + enterY) / 2);
    const labelX = rhuInt(sideTrackX + 6);
    // White background rect for readability
    const textWidth = rhuInt(measureText(transition.label, tk.edgeLabelFontSize).width);
    labels.push({
      kind: 'rect',
      x: labelX - 3,
      y: rhuInt(labelY - tk.edgeLabelFontSize * 0.75),
      width: textWidth + 6,
      height: rhuInt(tk.edgeLabelFontSize * 1.5),
      fill: tk.background,
      stroke: 'none',
      strokeWidth: 0,
      rx: 2,
    } satisfies RectPrimitive);
    labels.push({
      kind: 'text',
      x: labelX,
      y: labelY,
      text: transition.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.edgeLabelFontSize,
      fontWeight: 500,
      fill: tk.edgeLabelColor,
      textAnchor: 'start',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  }

  return { lines: [path], markers: [marker], labels };
}

function buildTransition(
  transition: StateTransition,
  from: PlacedState,
  to: PlacedState,
  tk: StateTheme,
  rankByStateId: Map<string, number>,
  sideTrackX: number,
): { lines: ScenePrimitive[]; markers: ScenePrimitive[]; labels: ScenePrimitive[] } {
  if (from.node.id === to.node.id) {
    const start = { x: from.right, y: rhuInt(from.cy - 14) };
    const end = { x: from.right, y: rhuInt(from.cy + 14) };
    const elbow = rhuInt(from.right + Math.max(32, tk.arrowSize * 3));
    const loop: PathPrimitive = {
      kind: 'path',
      d: [
        `M ${start.x} ${start.y}`,
        `C ${elbow} ${rhuInt(start.y - 18)} ${elbow} ${rhuInt(end.y + 18)} ${end.x} ${end.y}`,
      ].join(' '),
      fill: 'none',
      stroke: tk.edgeStroke,
      strokeWidth: tk.edgeStrokeWidth,
      dashArray: tk.edgeDash,
      strokeLinecap: 'round',
    };
    const labels: ScenePrimitive[] = [];
    if (transition.label) {
      labels.push({
        kind: 'text',
        x: elbow,
        y: from.cy,
        text: transition.label,
        fontFamily: tk.fontFamily,
        fontSize: tk.edgeLabelFontSize,
        fontWeight: 500,
        fill: tk.edgeLabelColor,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      } satisfies TextPrimitive);
    }
    return {
      lines: [loop],
      markers: [openArrowMarker(end, { x: -1, y: 0 }, tk)],
      labels,
    };
  }

  const { start, end } = selectPorts(from, to);

  // Skip-routing: if source and target are 2+ ranks apart, route via the left margin
  // to avoid the line passing through (and labelling over) intermediate node boxes.
  const fromRank = rankByStateId.get(from.node.id) ?? 0;
  const toRank = rankByStateId.get(to.node.id) ?? 0;
  if (Math.abs(fromRank - toRank) > 1) {
    return buildSideTransition(transition, from, to, tk, sideTrackX);
  }

  const dir = normalize(end.x - start.x, end.y - start.y);
  const lineEnd = { x: end.x - dir.x * tk.arrowSize, y: end.y - dir.y * tk.arrowSize };
  const line: LinePrimitive = {
    kind: 'line',
    x1: rhuInt(start.x),
    y1: rhuInt(start.y),
    x2: rhuInt(lineEnd.x),
    y2: rhuInt(lineEnd.y),
    stroke: tk.edgeStroke,
    strokeWidth: tk.edgeStrokeWidth,
  };
  const labels: ScenePrimitive[] = [];
  if (transition.label) {
    // Place label at 1/3 from source — keeps it in the upper part of the gap,
    // well clear of the destination node box.
    const t = 0.34;
    const perp = { x: -dir.y, y: dir.x };
    labels.push({
      kind: 'text',
      x: rhuInt(start.x + (end.x - start.x) * t + perp.x * 12),
      y: rhuInt(start.y + (end.y - start.y) * t + perp.y * 12),
      text: transition.label,
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
    markers: [openArrowMarker(end, dir, tk)],
    labels,
  };
}

function buildNotePrimitives(
  state: PlacedState,
  tk: StateTheme,
): { primitives: ScenePrimitive[]; right: number; bottom: number } {
  if (!state.node.note) return { primitives: [], right: state.right, bottom: state.bottom };
  const lines = state.node.note.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const widest = lines.reduce(
    (acc, line) => Math.max(acc, rhuInt(measureText(line, tk.descFontSize).width)),
    0,
  );
  const width = rhuInt(Math.max(120, widest + 2 * tk.statePadX));
  const height = rhuInt(lines.length * tk.lineHeight + 2 * tk.statePadY);
  const x = state.node.notePosition === 'left'
    ? rhuInt(state.x - tk.stateGapX - width)
    : rhuInt(state.right + tk.stateGapX);
  const y = rhuInt(state.y + Math.max(0, (state.height - height) / 2));
  const primitives: ScenePrimitive[] = [
    {
      kind: 'rect',
      x,
      y,
      width,
      height,
      fill: '#fff7d6',
      stroke: tk.stateStroke,
      strokeWidth: 1,
      rx: 8,
    } satisfies RectPrimitive,
  ];
  let textY = rhuInt(y + tk.statePadY + tk.descFontSize * 0.9);
  for (const line of lines) {
    primitives.push({
      kind: 'text',
      x: rhuInt(x + tk.statePadX),
      y: textY,
      text: line,
      fontFamily: tk.fontFamily,
      fontSize: tk.descFontSize,
      fontWeight: 500,
      fill: tk.descTextColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
    textY = rhuInt(textY + tk.lineHeight);
  }
  return { primitives, right: x + width, bottom: y + height };
}

function buildStatePrimitives(state: PlacedState, tk: StateTheme): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];

  if (state.visualKind === 'start') {
    primitives.push({
      kind: 'path',
      d: circlePath(state.cx, state.cy, tk.pseudoRadius),
      fill: tk.pseudoFill,
      stroke: tk.pseudoStroke,
      strokeWidth: tk.pseudoStrokeWidth,
      strokeLinecap: 'round',
    } satisfies PathPrimitive);
  } else if (state.visualKind === 'end') {
    primitives.push({
      kind: 'path',
      d: circlePath(state.cx, state.cy, tk.pseudoRadius),
      fill: tk.background,
      stroke: tk.pseudoStroke,
      strokeWidth: tk.pseudoStrokeWidth,
      strokeLinecap: 'round',
    } satisfies PathPrimitive);
    primitives.push({
      kind: 'path',
      d: circlePath(state.cx, state.cy, tk.pseudoRadius * 0.55),
      fill: tk.pseudoFill,
      stroke: tk.pseudoStroke,
      strokeWidth: 1,
      strokeLinecap: 'round',
    } satisfies PathPrimitive);
  } else if (state.visualKind === 'fork' || state.visualKind === 'join') {
    primitives.push({
      kind: 'rect',
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      fill: tk.forkBarFill,
      rx: 2,
    } satisfies RectPrimitive);
  } else if (state.visualKind === 'choice') {
    primitives.push({
      kind: 'path',
      d: diamondPath(state.cx, state.cy, tk.choiceSize),
      fill: tk.choiceFill,
      stroke: tk.choiceStroke,
      strokeWidth: tk.stateStrokeWidth,
      strokeLinecap: 'round',
    } satisfies PathPrimitive);
  } else if (state.visualKind === 'composite') {
    primitives.push({
      kind: 'rect',
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      fill: tk.compositeFill,
      stroke: tk.compositeStroke,
      strokeWidth: tk.compositeStrokeWidth,
      rx: tk.compositeRx,
    } satisfies RectPrimitive);
    primitives.push({
      kind: 'line',
      x1: state.x,
      y1: rhuInt(state.y + tk.compositeHeaderHeight),
      x2: state.right,
      y2: rhuInt(state.y + tk.compositeHeaderHeight),
      stroke: tk.compositeStroke,
      strokeWidth: 1,
    } satisfies LinePrimitive);
    primitives.push({
      kind: 'text',
      x: rhuInt(state.x + tk.statePadX),
      y: rhuInt(state.y + tk.statePadY + tk.compositeTitleFontSize),
      text: state.title,
      fontFamily: tk.fontFamily,
      fontSize: tk.compositeTitleFontSize,
      fontWeight: 700,
      fill: tk.compositeTitleColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
    for (const child of state.childrenPlaced) primitives.push(...buildStatePrimitives(child, tk));
  } else {
    primitives.push({
      kind: 'rect',
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      fill: tk.stateFill,
      stroke: tk.stateStroke,
      strokeWidth: tk.stateStrokeWidth,
      rx: tk.stateRx,
    } satisfies RectPrimitive);
    const titleLines = splitLabelLines(state.title);
    const titleBaseY = rhuInt(state.y + tk.statePadY + tk.stateFontSize);
    if (titleLines.length > 1) {
      primitives.push({
        kind: 'multitext',
        x: state.cx,
        y: titleBaseY,
        lines: titleLines,
        lineHeight: tk.lineHeight,
        fontFamily: tk.fontFamily,
        fontSize: tk.stateFontSize,
        fontWeight: tk.stateFontWeight,
        fill: tk.stateTextColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      } satisfies MultiTextPrimitive);
    } else {
      primitives.push({
        kind: 'text',
        x: state.cx,
        y: titleBaseY,
        text: state.title,
        fontFamily: tk.fontFamily,
        fontSize: tk.stateFontSize,
        fontWeight: tk.stateFontWeight,
        fill: tk.stateTextColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }
    if (state.description) {
      const dividerY = rhuInt(state.y + tk.statePadY + tk.lineHeight * titleLines.length);
      primitives.push({
        kind: 'line',
        x1: state.x,
        y1: dividerY,
        x2: state.right,
        y2: dividerY,
        stroke: tk.stateStroke,
        strokeWidth: 1,
      } satisfies LinePrimitive);
      primitives.push({
        kind: 'text',
        x: state.cx,
        y: rhuInt(dividerY + tk.statePadY + tk.descFontSize),
        text: state.description,
        fontFamily: tk.fontFamily,
        fontSize: tk.descFontSize,
        fontWeight: 500,
        fill: tk.descTextColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }
  }

  return primitives;
}

function collectPlaced(states: PlacedState[], out: PlacedState[]): void {
  for (const state of states) {
    out.push(state);
    if (state.childrenPlaced.length > 0) collectPlaced(state.childrenPlaced, out);
  }
}

function orderTopLevel(states: StateNode[]): StateNode[] {
  const starts = states.filter((state) => state.id === '__start__' || state.isPseudo === 'start');
  const ends = states.filter((state) => state.id === '__end__' || state.isPseudo === 'end');
  const middle = states.filter((state) => !starts.includes(state) && !ends.includes(state));
  return [...starts, ...middle, ...ends];
}

export function layoutState(doc: StateDocument, themeOverride?: StateTheme): RenderWithAnchors<Scene> {
  const tk = themeOverride ?? resolveStateTheme(doc.metadata.theme);
  if (doc.states.length === 0) {
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

  const measured = orderTopLevel(doc.states).map((state) => measureState(state, tk));
  const maxWidth = measured.reduce((acc, state) => Math.max(acc, state.width), 0);
  const byId = new Map<string, PlacedState>();
  const placedTop: PlacedState[] = [];
  let cursorY = tk.marginTop;
  for (let i = 0; i < measured.length; i++) {
    const state = measured[i]!;
    const x = rhuInt(tk.marginLeft + (maxWidth - state.width) / 2);
    const placed = placeState(state, x, cursorY, tk, byId, i);
    placedTop.push(placed);
    cursorY = rhuInt(placed.bottom + tk.stateGapY);
  }

  // Build rank map: top-level states get their sequential rank; composite children
  // inherit their parent's rank so inner transitions never trigger side-routing.
  const rankByStateId = new Map<string, number>();
  function propagateRank(states: PlacedState[], rank: number): void {
    for (const s of states) {
      rankByStateId.set(s.node.id, rank);
      if (s.childrenPlaced.length > 0) propagateRank(s.childrenPlaced, rank);
    }
  }
  for (const s of placedTop) propagateRank([s], s.rank);

  // Side track sits in the left margin, well clear of all state boxes.
  const sideTrackX = rhuInt(tk.marginLeft / 3);

  const allPlaced: PlacedState[] = [];
  collectPlaced(placedTop, allPlaced);

  const edgeLines: ScenePrimitive[] = [];
  const edgeMarkers: ScenePrimitive[] = [];
  const edgeLabels: ScenePrimitive[] = [];
  for (const transition of doc.transitions) {
    const from = byId.get(transition.from);
    const to = byId.get(transition.to);
    if (!from || !to) continue;
    const built = buildTransition(transition, from, to, tk, rankByStateId, sideTrackX);
    edgeLines.push(...built.lines);
    edgeMarkers.push(...built.markers);
    edgeLabels.push(...built.labels);
  }

  const nodePrimitives: ScenePrimitive[] = [];
  const notePrimitives: ScenePrimitive[] = [];
  let maxRight = tk.marginLeft + maxWidth;
  let maxBottom = cursorY - tk.stateGapY;
  for (const state of placedTop) nodePrimitives.push(...buildStatePrimitives(state, tk));
  for (const state of allPlaced) {
    maxRight = Math.max(maxRight, state.right);
    maxBottom = Math.max(maxBottom, state.bottom);
    const note = buildNotePrimitives(state, tk);
    notePrimitives.push(...note.primitives);
    maxRight = Math.max(maxRight, note.right);
    maxBottom = Math.max(maxBottom, note.bottom);
  }

  // ── Node-anchor registry (sidecar — §30b Phase A) ─────────────────────────
  // Include all placed states (top-level + composite children) by their node id.
  const anchors: NodeAnchorRegistry = {};
  for (const s of allPlaced) {
    anchors[s.node.id] = {
      id: s.node.id,
      x: s.x,
      y: s.y,
      w: s.right - s.x,
      h: s.bottom - s.y,
    };
  }

  return {
    scene: {
      width: rhuInt(maxRight + tk.marginRight),
      height: rhuInt(maxBottom + tk.marginBottom),
      background: tk.background,
      primitives: [...edgeLines, ...nodePrimitives, ...notePrimitives, ...edgeMarkers, ...edgeLabels],
    },
    anchors,
  };
}
