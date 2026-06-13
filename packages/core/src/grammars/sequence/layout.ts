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
 * No new Scene IR primitives are added; the kernel is untouched.
 * Activations and Fragments from the IR are deferred to increment-2.
 */

import type { Scene, ScenePrimitive, LinePrimitive } from '../../scene.js';
import type { SequenceDocument, Participant, Message } from './types.js';
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
  /** Half-width of the activation bar rect (increment-2). */
  activationBarHalfW: number;
  /** Label font size in pixels. */
  labelFontSize: number;
  /** Message label font size in pixels. */
  msgFontSize: number;
  /** Arrowhead size (half-angle base width and depth). */
  arrowHeadSize: number;
  /** Self-message loop extent (rightward offset and descent). */
  selfMsgLoopW: number;
  selfMsgLoopH: number;

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
  labelFontSize: 13,
  msgFontSize: 12,
  arrowHeadSize: 8,
  selfMsgLoopW: 36,
  selfMsgLoopH: 24,
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

function renderMessage(
  msg: Message,
  rowY: number,
  fromCx: number,
  toCx: number,
  tk: SequenceThemeTokens,
  primitives: ScenePrimitive[],
): void {
  const isSelf = fromCx === toCx;
  const isDashed = msg.kind === 'reply';
  const isSync = !msg.kind || msg.kind === 'sync';
  const sz = tk.arrowHeadSize;
  const stroke = tk.messageLineStroke;
  const sw = 1.5;
  const dash = isDashed ? '6,4' : undefined;

  if (isSelf) {
    // Self-message: exit right, descend, return left
    const loopX = rhuInt(fromCx + tk.selfMsgLoopW);
    const loopYBot = rhuInt(rowY + tk.selfMsgLoopH);
    const d = [
      `M ${fromCx} ${rowY}`,
      `L ${loopX} ${rowY}`,
      `L ${loopX} ${loopYBot}`,
      `L ${fromCx} ${loopYBot}`,
    ].join(' ');
    primitives.push({
      kind: 'path',
      d,
      fill: 'none',
      stroke,
      strokeWidth: sw,
      ...(dash ? { strokeLinecap: 'round' } : {}),
      ...(dash ? {} : {}),
    } as ScenePrimitive);
    if (isDashed) {
      // Re-emit as dashed line by using dashArray via a separate path
      primitives.pop();
      primitives.push({
        kind: 'path',
        d,
        fill: 'none',
        stroke,
        strokeWidth: sw,
        strokeLinecap: 'round',
      } as ScenePrimitive);
    }
    // Arrowhead pointing left at return point
    const ah = isSync
      ? filledArrowHead(fromCx, loopYBot, -1, sz, tk)
      : openArrowHead(fromCx, loopYBot, -1, sz, tk);
    primitives.push(ah);

    // Label above the exit segment
    const labelX = rhuInt(fromCx + tk.selfMsgLoopW / 2);
    const labelY = rhuInt(rowY - 5);
    primitives.push({
      kind: 'text',
      x: labelX,
      y: labelY,
      text: msg.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.msgFontSize,
      fontWeight: 400,
      fill: tk.messageLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    });
    return;
  }

  const goesRight = toCx > fromCx;
  const dir: 1 | -1 = goesRight ? 1 : -1;
  // Leave space for arrowhead at target
  const arrowTipX = toCx;
  const lineEndX = rhuInt(arrowTipX - dir * sz);

  // Connector line
  const lineBase: LinePrimitive = {
    kind: 'line',
    x1: fromCx,
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
    ? filledArrowHead(arrowTipX, rowY, dir, sz, tk)
    : openArrowHead(arrowTipX, rowY, dir, sz, tk);
  primitives.push(ah);

  // Label centered above the connector midpoint
  const midX = rhuInt((fromCx + toCx) / 2);
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
  const { participants, messages } = doc.sequence;

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

  const primitives: ScenePrimitive[] = [];

  // ------------------------------------------------------------------
  // 4. Background
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
  // 5. Participant headers + lifelines
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
  // 6. Messages
  // ------------------------------------------------------------------
  for (let rank = 0; rank < sorted.length; rank++) {
    const entry = sorted[rank]!;
    const { msg } = entry;
    const rowY = rhuInt(headerBottom + tk.firstMsgGap + rank * tk.rowHeight);

    const fromIdx = pIndexById.get(msg.from) ?? 0;
    const toIdx = pIndexById.get(msg.to) ?? 0;
    const fromCx = (pLayouts[fromIdx] ?? pLayouts[0]!).cx;
    const toCx = (pLayouts[toIdx] ?? pLayouts[0]!).cx;

    renderMessage(msg, rowY, fromCx, toCx, tk, primitives);
  }

  return {
    width: canvasW,
    height: canvasH,
    background: tk.background,
    primitives,
  };
}
