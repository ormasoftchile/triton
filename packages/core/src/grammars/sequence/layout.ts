/**
 * @file grammars/sequence/layout.ts — Sequence Grammar layout engine.
 *
 * `layoutSequence(doc)` is DETERMINISTIC-BY-CONSTRUCTION:
 *  - Participants placed left→right by declared order; x computed from measured
 *    label widths + fixed geometry constants.
 *  - Messages sorted by `order` (stable), placed top→down at fixed row heights.
 *  - All coordinates rounded via rhuInt (round-half-up to integer).
 *
 * Emits a Scene (shared kernel IR) using only existing primitives:
 *   rect / text / line / path
 *
 * Increment-2 additions (fully implemented):
 *  - Self-messages: 3-segment rectangular loop with proper dash support.
 *  - Activation bars: thin filled rects centered on lifelines, with message
 *    endpoints attached to bar edges.
 *  - Fragments: labeled rounded rects behind messages, with keyword tab.
 */

import type { Scene, ScenePrimitive, LinePrimitive } from '../../scene.js';
import type { SequenceDocument, Participant, Message, Activation, Fragment } from './types.js';
import { measureText } from '../../fonts/metrics.js';

// ---------------------------------------------------------------------------
// Rounding helper — §5.1 item 3 (round-half-up, integer)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Default theme tokens
// ---------------------------------------------------------------------------

interface SequenceThemeTokens {
  /** Canvas horizontal margin (left and right). */
  marginH: number;
  /** Canvas top margin (above first participant box). */
  marginTop: number;
  /** Canvas bottom margin (below last message row). */
  marginBottom: number;
  /** Horizontal padding inside participant header boxes. */
  headerPadX: number;
  /** Vertical padding inside participant header boxes. */
  headerPadY: number;
  /** Minimum column width for any participant. */
  minColWidth: number;
  /** Gap between adjacent participant columns (edge-to-edge). */
  colGap: number;
  /** Gap from header bottom to first message row. */
  firstMsgGap: number;
  /** Vertical distance between consecutive message rows. */
  rowHeight: number;
  /** Height of the stick-figure icon for 'actor' participants. */
  actorIconHeight: number;
  /** Half-width of the activation bar rect. */
  activationBarHalfW: number;
  /** Fill color for activation bars. */
  activationBarFill: string;
  /** Stroke color for activation bars. */
  activationBarStroke: string;
  /** Minimum height for activation bar (when from_order == to_order). */
  activationBarMinH: number;
  /** Label font size in pixels. */
  labelFontSize: number;
  /** Message label font size in pixels. */
  msgFontSize: number;
  /** Arrowhead size (half-angle base width and depth). */
  arrowHeadSize: number;
  /** Self-message loop extent (rightward offset and descent). */
  selfMsgLoopW: number;
  selfMsgLoopH: number;

  // Fragment geometry
  /** Horizontal padding outside the participant extents for fragment box. */
  fragPadX: number;
  /** Vertical padding above/below message rows for fragment box. */
  fragPadY: number;
  /** Fragment rounded-corner radius. */
  fragRx: number;
  /** Fragment border color. */
  fragStroke: string;
  /** Fragment fill color (light background). */
  fragFill: string;
  /** Font size for the fragment kind keyword tab. */
  fragKeyFontSize: number;
  /** Horizontal padding inside keyword tab. */
  fragTabPadX: number;
  /** Vertical padding inside keyword tab. */
  fragTabPadY: number;
  /** Keyword tab fill color. */
  fragTabFill: string;
  /** Keyword tab text color. */
  fragTabTextColor: string;
  /** Guard label font size. */
  fragLabelFontSize: number;
  /** Guard label text color. */
  fragLabelColor: string;

  // Colors
  background: string;
  participantBoxFill: string;
  participantBoxStroke: string;
  participantLabelColor: string;
  lifelineStroke: string;
  lifelineDash: string;
  messageLineStroke: string;
  messageLabelColor: string;
  arrowFill: string;
  fontFamily: string;
}

const DEFAULTS: SequenceThemeTokens = {
  marginH: 40,
  marginTop: 20,
  marginBottom: 40,
  headerPadX: 16,
  headerPadY: 10,
  minColWidth: 120,
  colGap: 80,
  firstMsgGap: 30,
  rowHeight: 56,
  actorIconHeight: 40,
  activationBarHalfW: 5,
  activationBarFill: '#c5cae9',
  activationBarStroke: '#5c6bc0',
  activationBarMinH: 20,
  labelFontSize: 13,
  msgFontSize: 12,
  arrowHeadSize: 8,
  selfMsgLoopW: 36,
  selfMsgLoopH: 24,
  fragPadX: 12,
  fragPadY: 14,
  fragRx: 6,
  fragStroke: '#7986cb',
  fragFill: '#eff1fb',
  fragKeyFontSize: 11,
  fragTabPadX: 6,
  fragTabPadY: 4,
  fragTabFill: '#5c6bc0',
  fragTabTextColor: '#ffffff',
  fragLabelFontSize: 11,
  fragLabelColor: '#3949ab',
  background: '#ffffff',
  participantBoxFill: '#e8f0fe',
  participantBoxStroke: '#4a6cf7',
  participantLabelColor: '#1a1a2e',
  lifelineStroke: '#9aa3b2',
  lifelineDash: '6,4',
  messageLineStroke: '#2c3e50',
  messageLabelColor: '#2c3e50',
  arrowFill: '#2c3e50',
  fontFamily: 'DejaVu Sans',
};

// ---------------------------------------------------------------------------
// Participant geometry
// ---------------------------------------------------------------------------

interface ParticipantLayout {
  /** Center x of the participant (and lifeline x). */
  cx: number;
  /** Column width (measured label + padding, ≥ minColWidth). */
  colW: number;
  /** Header box top-left x. */
  boxX: number;
  /** Header box top y. */
  boxY: number;
  /** Header box width. */
  boxW: number;
  /** Header box height (includes actor-icon space for actor kind). */
  boxH: number;
  /** Y coordinate of the bottom of the header box. */
  headerBottom: number;
}

function computeParticipantLayouts(
  participants: Participant[],
  tk: SequenceThemeTokens,
): ParticipantLayout[] {
  const layouts: ParticipantLayout[] = [];
  let cursor = tk.marginH;

  for (const p of participants) {
    const isActor = p.kind === 'actor';
    const measured = measureText(p.label, tk.labelFontSize);
    const textW = rhuInt(measured.width);
    const rawW = textW + 2 * tk.headerPadX;
    const colW = Math.max(rawW, tk.minColWidth);
    const cx = rhuInt(cursor + colW / 2);
    const boxH = rhuInt(
      tk.headerPadY * 2 + tk.labelFontSize * 1.2 + (isActor ? tk.actorIconHeight : 0),
    );
    const boxX = rhuInt(cx - colW / 2);
    const boxY = tk.marginTop;

    layouts.push({
      cx,
      colW,
      boxX,
      boxY,
      boxW: colW,
      boxH,
      headerBottom: rhuInt(boxY + boxH),
    });

    cursor = rhuInt(cursor + colW + tk.colGap);
  }

  return layouts;
}

// ---------------------------------------------------------------------------
// Stick-figure icon (for 'actor' kind)
// ---------------------------------------------------------------------------

/**
 * Emits a simple stick-figure path above the participant label area.
 * The figure is centered at (cx, topY + actorIconHeight/2).
 */
function actorIconPath(cx: number, topY: number, tk: SequenceThemeTokens): ScenePrimitive {
  const iconH = tk.actorIconHeight;
  // Proportions (relative to iconH)
  const headR = rhuInt(iconH * 0.18);
  const headCY = rhuInt(topY + headR + 2);
  const bodyTop = rhuInt(headCY + headR);
  const bodyBot = rhuInt(headCY + iconH * 0.5);
  const armY = rhuInt(headCY + iconH * 0.28);
  const armHalfW = rhuInt(iconH * 0.22);
  const legSpread = rhuInt(iconH * 0.2);

  const d = [
    // head circle via two arcs
    `M ${cx} ${headCY - headR}`,
    `A ${headR} ${headR} 0 1 1 ${cx - 0.1} ${headCY - headR}`,
    `Z`,
    // body
    `M ${cx} ${bodyTop}`,
    `L ${cx} ${bodyBot}`,
    // arms
    `M ${cx - armHalfW} ${armY}`,
    `L ${cx + armHalfW} ${armY}`,
    // legs
    `M ${cx} ${bodyBot}`,
    `L ${cx - legSpread} ${rhuInt(bodyBot + iconH * 0.32)}`,
    `M ${cx} ${bodyBot}`,
    `L ${cx + legSpread} ${rhuInt(bodyBot + iconH * 0.32)}`,
  ].join(' ');

  return {
    kind: 'path',
    d,
    fill: 'none',
    stroke: tk.participantBoxStroke,
    strokeWidth: 1.5,
  };
}

// ---------------------------------------------------------------------------
// Arrowhead helpers
// ---------------------------------------------------------------------------

/**
 * Filled triangular arrowhead pointing left (for messages going right→left)
 * or right (for messages going left→right).
 *
 * `dir`: +1 = pointing right, -1 = pointing left
 */
function filledArrowHead(
  tipX: number,
  tipY: number,
  dir: 1 | -1,
  sz: number,
  tk: SequenceThemeTokens,
): ScenePrimitive {
  const base = dir * sz;
  const half = rhuInt(sz * 0.5);
  const d = [
    `M ${tipX} ${tipY}`,
    `L ${rhuInt(tipX - base)} ${rhuInt(tipY - half)}`,
    `L ${rhuInt(tipX - base)} ${rhuInt(tipY + half)}`,
    `Z`,
  ].join(' ');
  return { kind: 'path', d, fill: tk.arrowFill, stroke: 'none', strokeWidth: 0 };
}

/**
 * Open V-shape arrowhead (two lines, no fill).
 * `dir`: +1 = pointing right, -1 = pointing left
 */
function openArrowHead(
  tipX: number,
  tipY: number,
  dir: 1 | -1,
  sz: number,
  tk: SequenceThemeTokens,
): ScenePrimitive {
  const base = dir * sz;
  const half = rhuInt(sz * 0.55);
  const d = [
    `M ${rhuInt(tipX - base)} ${rhuInt(tipY - half)}`,
    `L ${tipX} ${tipY}`,
    `L ${rhuInt(tipX - base)} ${rhuInt(tipY + half)}`,
  ].join(' ');
  return {
    kind: 'path',
    d,
    fill: 'none',
    stroke: tk.arrowFill,
    strokeWidth: 1.5,
    strokeLinecap: 'round',
  };
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

/**
 * Render one message into `primitives`.
 *
 * @param fromBarOffset  horizontal offset added to `fromCx` for activation-bar
 *                       edge attachment (positive = right, negative = left; 0
 *                       when participant has no active bar at this row).
 * @param toBarOffset    same idea for the destination participant.
 */
function renderMessage(
  msg: Message,
  rowY: number,
  fromCx: number,
  toCx: number,
  tk: SequenceThemeTokens,
  primitives: ScenePrimitive[],
  fromBarOffset: number,
  toBarOffset: number,
): void {
  const isSelf = fromCx === toCx;
  const isDashed = msg.kind === 'reply';
  const isSync = !msg.kind || msg.kind === 'sync';
  const sz = tk.arrowHeadSize;
  const stroke = tk.messageLineStroke;
  const sw = 1.5;
  const dash = isDashed ? tk.lifelineDash : undefined;

  if (isSelf) {
    // Self-message: exit right, descend, return left.
    // Exit from the activation-bar right edge when the participant is active.
    const loopStartX = rhuInt(fromCx + fromBarOffset);
    const loopX = rhuInt(loopStartX + tk.selfMsgLoopW);
    const loopYBot = rhuInt(rowY + tk.selfMsgLoopH);

    // Three separate line segments so each can carry dashArray independently.
    const segAttrs = { stroke, strokeWidth: sw, ...(dash ? { dashArray: dash } : {}) };
    // horizontal right
    primitives.push({ kind: 'line', x1: loopStartX, y1: rowY, x2: loopX, y2: rowY, ...segAttrs });
    // vertical down
    primitives.push({ kind: 'line', x1: loopX, y1: rowY, x2: loopX, y2: loopYBot, ...segAttrs });
    // horizontal left (return to bar edge / lifeline)
    primitives.push({ kind: 'line', x1: loopX, y1: loopYBot, x2: loopStartX, y2: loopYBot, ...segAttrs });

    // Arrowhead pointing left at return point
    const ah = isSync
      ? filledArrowHead(loopStartX, loopYBot, -1, sz, tk)
      : openArrowHead(loopStartX, loopYBot, -1, sz, tk);
    primitives.push(ah);

    // Label to the right of the loop, vertically centered on the loop.
    const labelX = rhuInt(loopX + 6);
    const labelY = rhuInt((rowY + loopYBot) / 2);
    primitives.push({
      kind: 'text',
      x: labelX,
      y: labelY,
      text: msg.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.msgFontSize,
      fontWeight: 400,
      fill: tk.messageLabelColor,
      textAnchor: 'start',
      dominantBaseline: 'middle',
    });
    return;
  }

  const goesRight = toCx > fromCx;
  const dir: 1 | -1 = goesRight ? 1 : -1;
  const effectiveFromX = rhuInt(fromCx + fromBarOffset);
  const effectiveToX = rhuInt(toCx + toBarOffset);
  // Leave space for arrowhead at target
  const lineEndX = rhuInt(effectiveToX - dir * sz);

  // Connector line
  const lineBase: LinePrimitive = {
    kind: 'line',
    x1: effectiveFromX,
    y1: rowY,
    x2: lineEndX,
    y2: rowY,
    stroke,
    strokeWidth: sw,
    ...(isDashed ? { dashArray: '6,4' } : {}),
  };
  primitives.push(lineBase);

  // Arrowhead at target
  const ah = isSync
    ? filledArrowHead(effectiveToX, rowY, dir, sz, tk)
    : openArrowHead(effectiveToX, rowY, dir, sz, tk);
  primitives.push(ah);

  // Label centered above the connector midpoint
  const midX = rhuInt((effectiveFromX + effectiveToX) / 2);
  const labelY = rhuInt(rowY - 6);
  primitives.push({
    kind: 'text',
    x: midX,
    y: labelY,
    text: msg.label,
    fontFamily: tk.fontFamily,
    fontSize: tk.msgFontSize,
    fontWeight: 400,
    fill: tk.messageLabelColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  });
}

// ---------------------------------------------------------------------------
// Activation-bar rendering
// ---------------------------------------------------------------------------

/**
 * Build a map from message-order value to its row Y coordinate.
 * Only the first occurrence of each order value is stored.
 */
function buildOrderToRowY(
  sorted: Array<{ msg: Message; listIdx: number }>,
  headerBottom: number,
  tk: SequenceThemeTokens,
): Map<number, number> {
  const map = new Map<number, number>();
  for (let rank = 0; rank < sorted.length; rank++) {
    const entry = sorted[rank]!;
    const rowY = rhuInt(headerBottom + tk.firstMsgGap + rank * tk.rowHeight);
    if (!map.has(entry.msg.order)) {
      map.set(entry.msg.order, rowY);
    }
  }
  return map;
}

/**
 * Returns true when `participantId` has at least one activation covering `msgOrder`.
 */
function isActiveAt(activations: Activation[], participantId: string, msgOrder: number): boolean {
  return activations.some(
    (a) => a.participant === participantId && a.from_order <= msgOrder && msgOrder <= a.to_order,
  );
}

/**
 * Render all activation bars into `primitives`.
 * Bars are emitted after lifelines so they visually overlay the dashed lines.
 */
function renderActivationBars(
  activations: Activation[],
  pIndexById: Map<string, number>,
  pLayouts: ParticipantLayout[],
  orderToRowY: Map<number, number>,
  lastRowY: number,
  tk: SequenceThemeTokens,
  primitives: ScenePrimitive[],
): void {
  const barHW = tk.activationBarHalfW;
  for (const act of activations) {
    const idx = pIndexById.get(act.participant);
    if (idx === undefined) continue;
    const pl = pLayouts[idx];
    if (!pl) continue;

    const yTop = orderToRowY.get(act.from_order) ?? lastRowY;
    const yBot = orderToRowY.get(act.to_order) ?? lastRowY;
    const rawH = yBot - yTop;
    const barH = Math.max(rawH, tk.activationBarMinH);
    const barY = yTop - rhuInt((barH - rawH) / 2); // center if clamped to minimum

    primitives.push({
      kind: 'rect',
      x: rhuInt(pl.cx - barHW),
      y: barY,
      width: 2 * barHW,
      height: barH,
      fill: tk.activationBarFill,
      stroke: tk.activationBarStroke,
      strokeWidth: 1.5,
      rx: 2,
    });
  }
}

// ---------------------------------------------------------------------------
// Fragment rendering
// ---------------------------------------------------------------------------

/**
 * Render all combined fragments (loop/alt/opt/par) into `primitives`.
 * Fragments are emitted BEFORE participant headers/messages so they render
 * behind the rest of the diagram (painter's algorithm).
 *
 * Outer fragments (larger order span) are rendered first so inner fragments
 * appear on top.
 */
function renderFragments(
  fragments: Fragment[],
  pIndexById: Map<string, number>,
  pLayouts: ParticipantLayout[],
  participants: Participant[],
  orderToRowY: Map<number, number>,
  firstRowY: number,
  lastRowY: number,
  canvasW: number,
  tk: SequenceThemeTokens,
  primitives: ScenePrimitive[],
): void {
  // Sort: larger span (outer) renders first so inner fragments paint over them.
  const sorted = [...fragments].sort(
    (a, b) => b.to_order - b.from_order - (a.to_order - a.from_order),
  );

  const allLeft = pLayouts[0]!.boxX;
  const lastPL = pLayouts[pLayouts.length - 1]!;
  const allRight = lastPL.boxX + lastPL.boxW;

  for (const frag of sorted) {
    // Horizontal extent: subset of participants or all participants
    let fragLeft = allLeft;
    let fragRight = allRight;
    if (frag.participants && frag.participants.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      for (const pid of frag.participants) {
        const idx = pIndexById.get(pid);
        if (idx === undefined) continue;
        const pl = pLayouts[idx];
        if (!pl) continue;
        if (pl.boxX < minX) minX = pl.boxX;
        const right = pl.boxX + pl.boxW;
        if (right > maxX) maxX = right;
      }
      if (isFinite(minX)) {
        fragLeft = minX;
        fragRight = maxX;
      }
    }

    const fragX = Math.max(rhuInt(fragLeft - tk.fragPadX), 0);
    const fragXRight = Math.min(rhuInt(fragRight + tk.fragPadX), canvasW);
    const fragW = fragXRight - fragX;

    const yTop = orderToRowY.get(frag.from_order) ?? firstRowY;
    const yBot = orderToRowY.get(frag.to_order) ?? lastRowY;
    const fragYTop = rhuInt(yTop - tk.fragPadY);
    const fragYBot = rhuInt(yBot + tk.fragPadY);
    const fragH = fragYBot - fragYTop;
    if (fragW <= 0 || fragH <= 0) continue;

    // Main fragment rectangle (light fill, visible border)
    primitives.push({
      kind: 'rect',
      x: fragX,
      y: fragYTop,
      width: fragW,
      height: fragH,
      fill: tk.fragFill,
      stroke: tk.fragStroke,
      strokeWidth: 1.5,
      rx: tk.fragRx,
    });

    // Keyword tab (small filled rect in upper-left corner)
    const tabTextW = rhuInt(measureText(frag.kind, tk.fragKeyFontSize).width);
    const tabW = rhuInt(tabTextW + 2 * tk.fragTabPadX);
    const tabH = rhuInt(tk.fragKeyFontSize * 1.4 + 2 * tk.fragTabPadY);

    primitives.push({
      kind: 'rect',
      x: fragX,
      y: fragYTop,
      width: tabW,
      height: tabH,
      fill: tk.fragTabFill,
      rx: tk.fragRx,
    });

    // Kind keyword text inside tab
    primitives.push({
      kind: 'text',
      x: rhuInt(fragX + tabW / 2),
      y: rhuInt(fragYTop + tabH / 2),
      text: frag.kind,
      fontFamily: tk.fontFamily,
      fontSize: tk.fragKeyFontSize,
      fontWeight: 700,
      fill: tk.fragTabTextColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });

    // Guard label text after the tab (if present)
    if (frag.label) {
      primitives.push({
        kind: 'text',
        x: rhuInt(fragX + tabW + 8),
        y: rhuInt(fragYTop + tabH / 2),
        text: frag.label,
        fontFamily: tk.fontFamily,
        fontSize: tk.fragLabelFontSize,
        fontWeight: 400,
        fill: tk.fragLabelColor,
        textAnchor: 'start',
        dominantBaseline: 'middle',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

/**
 * Lay out a SequenceDocument into a Scene.
 *
 * @param doc - Validated SequenceDocument
 * @returns Scene (backend-agnostic drawing IR)
 */
export function layoutSequence(doc: SequenceDocument): Scene {
  const tk = { ...DEFAULTS };
  const { participants, messages, activations = [], fragments = [] } = doc.sequence;

  // ------------------------------------------------------------------
  // 1. Participant layout (x-axis)
  // ------------------------------------------------------------------
  const pLayouts = computeParticipantLayouts(participants, tk);

  // Index participants by id for O(1) lookup
  const pIndexById = new Map<string, number>();
  for (let i = 0; i < participants.length; i++) {
    const pid = participants[i];
    if (pid) pIndexById.set(pid.id, i);
  }

  // ------------------------------------------------------------------
  // 2. Message sort (by order, stable)
  // ------------------------------------------------------------------
  const sorted = messages
    .map((m, listIdx) => ({ msg: m, listIdx }))
    .sort((a, b) => a.msg.order - b.msg.order || a.listIdx - b.listIdx);

  const msgCount = sorted.length;

  // ------------------------------------------------------------------
  // 3. Compute canvas dimensions
  // ------------------------------------------------------------------
  const headerH = pLayouts.reduce((max, pl) => Math.max(max, pl.boxH), 0);
  const headerBottom = rhuInt(tk.marginTop + headerH);
  const diagramContentH = rhuInt(
    tk.firstMsgGap + Math.max(msgCount, 1) * tk.rowHeight + tk.firstMsgGap,
  );
  const canvasH = rhuInt(headerBottom + diagramContentH + tk.marginBottom);

  // Width from last participant right edge + right margin
  // pLayouts is guaranteed non-empty (schema requires ≥1 participant)
  const lastPL = pLayouts[pLayouts.length - 1]!;
  const canvasW = rhuInt(lastPL.boxX + lastPL.boxW + tk.marginH);

  // ------------------------------------------------------------------
  // 4. Build order→rowY lookup (for activations and fragments)
  // ------------------------------------------------------------------
  const orderToRowY = buildOrderToRowY(sorted, headerBottom, tk);
  const firstRowY = rhuInt(headerBottom + tk.firstMsgGap);
  const lastRowY =
    msgCount > 0
      ? rhuInt(headerBottom + tk.firstMsgGap + (msgCount - 1) * tk.rowHeight)
      : firstRowY;

  const primitives: ScenePrimitive[] = [];

  // ------------------------------------------------------------------
  // 5. Background
  // ------------------------------------------------------------------
  primitives.push({
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvasW,
    height: canvasH,
    fill: tk.background,
  });

  // ------------------------------------------------------------------
  // 6. Fragments — rendered FIRST (behind everything)
  // ------------------------------------------------------------------
  if (fragments.length > 0) {
    renderFragments(
      fragments,
      pIndexById,
      pLayouts,
      participants,
      orderToRowY,
      firstRowY,
      lastRowY,
      canvasW,
      tk,
      primitives,
    );
  }

  // ------------------------------------------------------------------
  // 7. Participant headers + lifelines
  // ------------------------------------------------------------------
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]!;
    const pl = pLayouts[i]!;
    const isActor = p.kind === 'actor';

    // Header box
    primitives.push({
      kind: 'rect',
      x: pl.boxX,
      y: pl.boxY,
      width: pl.boxW,
      height: pl.boxH,
      fill: tk.participantBoxFill,
      stroke: tk.participantBoxStroke,
      strokeWidth: 1.5,
      rx: 4,
    });

    // Actor stick-figure icon
    if (isActor) {
      const iconTopY = rhuInt(pl.boxY + tk.headerPadY);
      primitives.push(actorIconPath(pl.cx, iconTopY, tk));
    }

    // Participant label
    const labelY = isActor
      ? rhuInt(pl.boxY + pl.boxH - tk.headerPadY - tk.labelFontSize * 0.2)
      : rhuInt(pl.boxY + pl.boxH / 2);
    primitives.push({
      kind: 'text',
      x: pl.cx,
      y: labelY,
      text: p.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.labelFontSize,
      fontWeight: 700,
      fill: tk.participantLabelColor,
      textAnchor: 'middle',
      dominantBaseline: isActor ? 'alphabetic' : 'middle',
    });

    // Lifeline (dashed vertical line from header bottom to diagram bottom)
    const lifelineBottom = rhuInt(canvasH - tk.marginBottom);
    primitives.push({
      kind: 'line',
      x1: pl.cx,
      y1: headerBottom,
      x2: pl.cx,
      y2: lifelineBottom,
      stroke: tk.lifelineStroke,
      strokeWidth: 1,
      dashArray: tk.lifelineDash,
    });
  }

  // ------------------------------------------------------------------
  // 8. Activation bars — rendered after lifelines, before messages
  // ------------------------------------------------------------------
  if (activations.length > 0) {
    renderActivationBars(
      activations,
      pIndexById,
      pLayouts,
      orderToRowY,
      lastRowY,
      tk,
      primitives,
    );
  }

  // ------------------------------------------------------------------
  // 9. Messages — with activation-bar edge attachment
  // ------------------------------------------------------------------
  const barHW = tk.activationBarHalfW;
  for (let rank = 0; rank < sorted.length; rank++) {
    const entry = sorted[rank]!;
    const { msg } = entry;
    const rowY = rhuInt(headerBottom + tk.firstMsgGap + rank * tk.rowHeight);

    const fromIdx = pIndexById.get(msg.from) ?? 0;
    const toIdx = pIndexById.get(msg.to) ?? 0;
    const fromCx = (pLayouts[fromIdx] ?? pLayouts[0]!).cx;
    const toCx = (pLayouts[toIdx] ?? pLayouts[0]!).cx;

    const isSelf = fromCx === toCx;
    const goesRight = toCx > fromCx;

    const fromActive = activations.length > 0 && isActiveAt(activations, msg.from, msg.order);
    const toActive = activations.length > 0 && isActiveAt(activations, msg.to, msg.order);

    let fromBarOffset: number;
    let toBarOffset: number;

    if (isSelf) {
      fromBarOffset = fromActive ? barHW : 0;
      toBarOffset = fromActive ? barHW : 0;
    } else if (goesRight) {
      fromBarOffset = fromActive ? barHW : 0;
      toBarOffset = toActive ? -barHW : 0;
    } else {
      fromBarOffset = fromActive ? -barHW : 0;
      toBarOffset = toActive ? barHW : 0;
    }

    renderMessage(msg, rowY, fromCx, toCx, tk, primitives, fromBarOffset, toBarOffset);
  }

  return {
    width: canvasW,
    height: canvasH,
    background: tk.background,
    primitives,
  };
}
