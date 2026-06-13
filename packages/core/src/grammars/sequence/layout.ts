/**
 * @file grammars/sequence/layout.ts — Sequence Grammar layout engine.
 *
 * `layoutSequence(doc, themeOverride?)` is DETERMINISTIC-BY-CONSTRUCTION:
 *  - Participants placed left→right by declared order; x computed from measured
 *    label widths + theme geometry tokens.
 *  - Messages sorted by `order` (stable), placed top→down at fixed row heights.
 *  - All coordinates rounded via rhuInt (round-half-up to integer).
 *
 * Emits a Scene (shared kernel IR) using only existing primitives:
 *   rect / circle / text / line / path
 *
 * All styling is READ FROM THE THEME — no hardcoded colors, strokes, or shapes.
 * The defaultSequenceTheme reproduces the original UML look byte-identically.
 */

import type { Scene, ScenePrimitive, LinePrimitive } from '../../scene.js';
import type { SequenceDocument, Participant, Message, Activation, Fragment } from './types.js';
import { measureText } from '../../fonts/metrics.js';
import type { SequenceTheme } from './theme.js';
import { defaultSequenceTheme, resolveSequenceTheme, getIcon } from './theme.js';

// ---------------------------------------------------------------------------
// Rounding helper — §5.1 item 3 (round-half-up, integer)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Participant geometry
// ---------------------------------------------------------------------------

interface ParticipantLayout {
  cx: number;
  colW: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  headerBottom: number;
}

function computeParticipantLayouts(
  participants: Participant[],
  tk: SequenceTheme,
): ParticipantLayout[] {
  const layouts: ParticipantLayout[] = [];
  let cursor = tk.marginH;
  const isCardMode = tk.participantRenderMode === 'card';

  for (const p of participants) {
    const isActor = p.kind === 'actor';
    const measured = measureText(p.label, tk.labelFontSize);
    const textW = rhuInt(measured.width);
    const rawW = textW + 2 * tk.headerPadX;
    const colW = Math.max(rawW, tk.minColWidth);
    const cx = rhuInt(cursor + colW / 2);

    // Card mode: ALL participants get the icon area.
    // Box mode: only 'actor' gets the extra icon height.
    const extraTopH = isCardMode
      ? tk.cardIconAreaSize
      : (isActor ? tk.actorIconHeight : 0);

    const boxH = rhuInt(tk.headerPadY * 2 + tk.labelFontSize * 1.2 + extraTopH);
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
// Stick-figure icon (for 'actor' kind in box mode)
// ---------------------------------------------------------------------------

function actorIconPath(cx: number, topY: number, tk: SequenceTheme): ScenePrimitive {
  const iconH = tk.actorIconHeight;
  const headR = rhuInt(iconH * 0.18);
  const headCY = rhuInt(topY + headR + 2);
  const bodyTop = rhuInt(headCY + headR);
  const bodyBot = rhuInt(headCY + iconH * 0.5);
  const armY = rhuInt(headCY + iconH * 0.28);
  const armHalfW = rhuInt(iconH * 0.22);
  const legSpread = rhuInt(iconH * 0.2);

  const d = [
    `M ${cx} ${headCY - headR}`,
    `A ${headR} ${headR} 0 1 1 ${cx - 0.1} ${headCY - headR}`,
    `Z`,
    `M ${cx} ${bodyTop}`,
    `L ${cx} ${bodyBot}`,
    `M ${cx - armHalfW} ${armY}`,
    `L ${cx + armHalfW} ${armY}`,
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
// Card participant rendering
// ---------------------------------------------------------------------------

/**
 * Render a card-mode participant header (colored rounded card + icon + label).
 * Returns an array of primitives to push.
 */
function renderCardParticipant(
  p: Participant,
  pl: ParticipantLayout,
  tk: SequenceTheme,
): ScenePrimitive[] {
  const prims: ScenePrimitive[] = [];

  // Resolve card color from: p.color override → kind lookup → default → fallback
  const kindKey = p.kind ?? 'object';
  const cardStyle =
    tk.cardKindColors[kindKey] ?? tk.cardKindColors['default'];
  const cardFill = p.color ?? cardStyle?.fill ?? tk.participantBoxFill;
  const textColor = cardStyle?.textColor ?? tk.participantLabelColor;
  const iconColor = cardStyle?.iconColor ?? '#ffffff';

  // Card background
  const cardRect: ScenePrimitive = {
    kind: 'rect',
    x: pl.boxX,
    y: pl.boxY,
    width: pl.boxW,
    height: pl.boxH,
    fill: cardFill,
    rx: tk.participantBoxRx,
    ...(tk.participantBoxStroke !== 'none' && tk.participantBoxStrokeWidth > 0
      ? { stroke: tk.participantBoxStroke, strokeWidth: tk.participantBoxStrokeWidth }
      : {}),
  };
  prims.push(cardRect);

  // Icon glyph (from p.icon, or from cardKindIconMap[kind])
  const iconName = p.icon ?? tk.cardKindIconMap[kindKey] ?? '';
  const iconDef = iconName ? getIcon(iconName) : undefined;

  if (iconDef) {
    const iconSize = tk.cardIconAreaSize;
    const iconScale = iconSize / 24;
    const iconX = rhuInt(pl.cx - iconSize / 2);
    const iconTopY = rhuInt(pl.boxY + tk.headerPadY);
    const iconStrokeW = iconScale > 0 ? 1.5 / iconScale : 1.5;

    for (const pathDef of iconDef.paths) {
      prims.push({
        kind: 'path',
        d: pathDef.d,
        fill: pathDef.fill ? iconColor : 'none',
        stroke: pathDef.stroke !== false ? iconColor : undefined,
        strokeWidth: pathDef.fill ? 0 : iconStrokeW,
        transform: `translate(${iconX},${iconTopY}) scale(${iconScale})`,
      });
    }
  }

  // Label text (bottom portion of card)
  const labelY = rhuInt(pl.boxY + pl.boxH - tk.headerPadY - tk.labelFontSize * 0.3);
  prims.push({
    kind: 'text',
    x: pl.cx,
    y: labelY,
    text: p.label,
    fontFamily: tk.fontFamily,
    fontSize: tk.labelFontSize,
    fontWeight: tk.labelFontWeight,
    fill: textColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  });

  return prims;
}

// ---------------------------------------------------------------------------
// Arrowhead helpers
// ---------------------------------------------------------------------------

function filledArrowHead(
  tipX: number,
  tipY: number,
  dir: 1 | -1,
  sz: number,
  tk: SequenceTheme,
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

function openArrowHead(
  tipX: number,
  tipY: number,
  dir: 1 | -1,
  sz: number,
  tk: SequenceTheme,
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
  tk: SequenceTheme,
  primitives: ScenePrimitive[],
  fromBarOffset: number,
  toBarOffset: number,
  fromColHalfW: number,
  _toColHalfW: number,
): void {
  const isSelf = fromCx === toCx;
  const isSync = !msg.kind || msg.kind === 'sync';
  const isReply = msg.kind === 'reply';
  const isAsync = msg.kind === 'async';

  // Resolve dash pattern for this message kind
  let dash: string | undefined;
  if (isReply) dash = tk.messageLineDashReply;
  else if (isAsync) dash = tk.messageLineDashAsync;
  else dash = tk.messageLineDashSync;

  const sz = tk.arrowHeadSize;
  const stroke = tk.messageLineStroke;
  const sw = tk.messageLineStrokeWidth;

  if (isSelf) {
    const loopStartX = rhuInt(fromCx + fromBarOffset);
    const loopX = rhuInt(loopStartX + tk.selfMsgLoopW);
    const loopYBot = rhuInt(rowY + tk.selfMsgLoopH);

    const segAttrs = { stroke, strokeWidth: sw, ...(dash ? { dashArray: dash } : {}) };
    primitives.push({ kind: 'line', x1: loopStartX, y1: rowY, x2: loopX, y2: rowY, ...segAttrs });
    primitives.push({ kind: 'line', x1: loopX, y1: rowY, x2: loopX, y2: loopYBot, ...segAttrs });
    primitives.push({ kind: 'line', x1: loopX, y1: loopYBot, x2: loopStartX, y2: loopYBot, ...segAttrs });

    const ah = isSync
      ? filledArrowHead(loopStartX, loopYBot, -1, sz, tk)
      : openArrowHead(loopStartX, loopYBot, -1, sz, tk);
    primitives.push(ah);

    // Step badge on self-message (on top-right corner of loop)
    if (tk.showStepNumbers) {
      const badgeX = loopX;
      const badgeY = rowY;
      primitives.push({
        kind: 'circle',
        cx: badgeX,
        cy: badgeY,
        r: tk.stepBadgeRadius,
        fill: tk.stepBadgeFill,
      });
      primitives.push({
        kind: 'text',
        x: badgeX,
        y: badgeY,
        text: String(msg.order),
        fontFamily: tk.fontFamily,
        fontSize: tk.stepBadgeFontSize,
        fontWeight: 700,
        fill: tk.stepBadgeTextColor,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }

    const labelX = rhuInt(loopX + 6);
    const labelY = rhuInt((rowY + loopYBot) / 2);
    primitives.push({
      kind: 'text',
      x: labelX,
      y: labelY,
      text: msg.label,
      fontFamily: tk.fontFamily,
      fontSize: tk.msgFontSize,
      fontWeight: tk.msgFontWeight,
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
  const lineEndX = rhuInt(effectiveToX - dir * sz);

  const lineBase: LinePrimitive = {
    kind: 'line',
    x1: effectiveFromX,
    y1: rowY,
    x2: lineEndX,
    y2: rowY,
    stroke,
    strokeWidth: sw,
    ...(dash ? { dashArray: dash } : {}),
  };
  primitives.push(lineBase);

  const ah = isSync
    ? filledArrowHead(effectiveToX, rowY, dir, sz, tk)
    : openArrowHead(effectiveToX, rowY, dir, sz, tk);
  primitives.push(ah);

  // Step badge at the arrow's source end (stepBadgeOffset pixels along direction).
  // Uses the source participant's box edge (fromCx ± fromColHalfW) rather than
  // the lifeline centre so the badge always lands on the visible dark-background
  // arrow segment in card mode. stepBadgeOffset===0 falls back to legacy ¼-along.
  if (tk.showStepNumbers) {
    const badgeX = tk.stepBadgeOffset > 0
      ? rhuInt(fromCx + dir * (fromColHalfW + tk.stepBadgeOffset))
      : rhuInt(effectiveFromX + (effectiveToX - effectiveFromX) * 0.25);
    primitives.push({
      kind: 'circle',
      cx: badgeX,
      cy: rowY,
      r: tk.stepBadgeRadius,
      fill: tk.stepBadgeFill,
    });
    primitives.push({
      kind: 'text',
      x: badgeX,
      y: rowY,
      text: String(msg.order),
      fontFamily: tk.fontFamily,
      fontSize: tk.stepBadgeFontSize,
      fontWeight: 700,
      fill: tk.stepBadgeTextColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
  }

  const midX = rhuInt((effectiveFromX + effectiveToX) / 2);
  const labelY = rhuInt(rowY - tk.msgLabelYOffset);
  primitives.push({
    kind: 'text',
    x: midX,
    y: labelY,
    text: msg.label,
    fontFamily: tk.fontFamily,
    fontSize: tk.msgFontSize,
    fontWeight: tk.msgFontWeight,
    fill: tk.messageLabelColor,
    textAnchor: 'middle',
    dominantBaseline: 'alphabetic',
  });
}

// ---------------------------------------------------------------------------
// Activation-bar rendering
// ---------------------------------------------------------------------------

function buildOrderToRowY(
  sorted: Array<{ msg: Message; listIdx: number }>,
  headerBottom: number,
  tk: SequenceTheme,
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

function isActiveAt(activations: Activation[], participantId: string, msgOrder: number): boolean {
  return activations.some(
    (a) => a.participant === participantId && a.from_order <= msgOrder && msgOrder <= a.to_order,
  );
}

function renderActivationBars(
  activations: Activation[],
  pIndexById: Map<string, number>,
  pLayouts: ParticipantLayout[],
  orderToRowY: Map<number, number>,
  lastRowY: number,
  tk: SequenceTheme,
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
    const barY = yTop - rhuInt((barH - rawH) / 2);

    primitives.push({
      kind: 'rect',
      x: rhuInt(pl.cx - barHW),
      y: barY,
      width: 2 * barHW,
      height: barH,
      fill: tk.activationBarFill,
      stroke: tk.activationBarStroke,
      strokeWidth: tk.activationBarStrokeWidth,
      rx: tk.activationBarRx,
    });
  }
}

// ---------------------------------------------------------------------------
// Fragment rendering
// ---------------------------------------------------------------------------

function renderFragments(
  fragments: Fragment[],
  pIndexById: Map<string, number>,
  pLayouts: ParticipantLayout[],
  participants: Participant[],
  orderToRowY: Map<number, number>,
  firstRowY: number,
  lastRowY: number,
  canvasW: number,
  tk: SequenceTheme,
  primitives: ScenePrimitive[],
): void {
  const sorted = [...fragments].sort(
    (a, b) => b.to_order - b.from_order - (a.to_order - a.from_order),
  );

  const allLeft = pLayouts[0]!.boxX;
  const lastPL = pLayouts[pLayouts.length - 1]!;
  const allRight = lastPL.boxX + lastPL.boxW;

  for (const frag of sorted) {
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

    primitives.push({
      kind: 'rect',
      x: fragX,
      y: fragYTop,
      width: fragW,
      height: fragH,
      fill: tk.fragFill,
      stroke: tk.fragStroke,
      strokeWidth: tk.fragStrokeWidth,
      rx: tk.fragRx,
    });

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

    primitives.push({
      kind: 'text',
      x: rhuInt(fragX + tabW / 2),
      y: rhuInt(fragYTop + tabH / 2),
      text: frag.kind,
      fontFamily: tk.fontFamily,
      fontSize: tk.fragKeyFontSize,
      fontWeight: tk.fragKeyFontWeight,
      fill: tk.fragTabTextColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });

    // Guard label (section 0 or legacy single label)
    const section0Guard = frag.sections && frag.sections.length > 0
      ? frag.sections[0]!.guard
      : frag.label;

    if (section0Guard) {
      primitives.push({
        kind: 'text',
        x: rhuInt(fragX + tabW + 8),
        y: rhuInt(fragYTop + tabH / 2),
        text: section0Guard,
        fontFamily: tk.fontFamily,
        fontSize: tk.fragLabelFontSize,
        fontWeight: tk.fragLabelFontWeight,
        fill: tk.fragLabelColor,
        textAnchor: 'start',
        dominantBaseline: 'middle',
      });
    }

    // Multi-section dividers (only for fragments with sections.length >= 2)
    if (frag.sections && frag.sections.length >= 2) {
      for (let si = 1; si < frag.sections.length; si++) {
        const sec = frag.sections[si]!;
        const divY = rhuInt((orderToRowY.get(sec.fromOrder) ?? firstRowY) - tk.fragPadY / 2);
        // Dashed horizontal divider line spanning the full fragment width
        primitives.push({
          kind: 'line',
          x1: fragX,
          y1: divY,
          x2: fragXRight,
          y2: divY,
          stroke: tk.fragStroke,
          strokeWidth: tk.fragStrokeWidth,
          dashArray: tk.fragDividerDash,
        });
        // Guard label at top-left of this compartment
        if (sec.guard) {
          primitives.push({
            kind: 'text',
            x: rhuInt(fragX + tk.fragTabPadX),
            y: rhuInt(divY + tk.fragTabPadY + tk.fragLabelFontSize * 0.8),
            text: sec.guard,
            fontFamily: tk.fontFamily,
            fontSize: tk.fragLabelFontSize,
            fontWeight: tk.fragLabelFontWeight,
            fill: tk.fragLabelColor,
            textAnchor: 'start',
            dominantBaseline: 'alphabetic',
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

/**
 * Lay out a SequenceDocument into a Scene.
 *
 * @param doc            Validated SequenceDocument
 * @param themeOverride  Optional explicit theme. When absent, the theme named
 *                       in `doc.metadata.theme` is resolved from the registry;
 *                       falling back to `defaultSequenceTheme`.
 * @returns Scene (backend-agnostic drawing IR)
 */
export function layoutSequence(doc: SequenceDocument, themeOverride?: SequenceTheme): Scene {
  const tk = themeOverride ?? resolveSequenceTheme(doc.metadata?.theme);
  const { participants, messages, activations = [], fragments = [] } = doc.sequence;

  // 1. Participant layout (x-axis)
  const pLayouts = computeParticipantLayouts(participants, tk);

  const pIndexById = new Map<string, number>();
  for (let i = 0; i < participants.length; i++) {
    const pid = participants[i];
    if (pid) pIndexById.set(pid.id, i);
  }

  // 2. Message sort (by order, stable)
  const sorted = messages
    .map((m, listIdx) => ({ msg: m, listIdx }))
    .sort((a, b) => a.msg.order - b.msg.order || a.listIdx - b.listIdx);

  const msgCount = sorted.length;

  // 3. Canvas dimensions
  const headerH = pLayouts.reduce((max, pl) => Math.max(max, pl.boxH), 0);
  const headerBottom = rhuInt(tk.marginTop + headerH);
  const diagramContentH = rhuInt(
    tk.firstMsgGap + Math.max(msgCount, 1) * tk.rowHeight + tk.firstMsgGap,
  );
  const canvasH = rhuInt(headerBottom + diagramContentH + tk.marginBottom);

  const lastPL = pLayouts[pLayouts.length - 1]!;
  const canvasW = rhuInt(lastPL.boxX + lastPL.boxW + tk.marginH);

  // 4. Order→rowY lookup
  const orderToRowY = buildOrderToRowY(sorted, headerBottom, tk);
  const firstRowY = rhuInt(headerBottom + tk.firstMsgGap);
  const lastRowY =
    msgCount > 0
      ? rhuInt(headerBottom + tk.firstMsgGap + (msgCount - 1) * tk.rowHeight)
      : firstRowY;

  const primitives: ScenePrimitive[] = [];

  // 5. Background
  primitives.push({
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvasW,
    height: canvasH,
    fill: tk.background,
  });

  // 6. Fragments — behind everything
  if (fragments.length > 0) {
    renderFragments(
      fragments, pIndexById, pLayouts, participants,
      orderToRowY, firstRowY, lastRowY, canvasW, tk, primitives,
    );
  }

  // 7. Participant headers + lifelines
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]!;
    const pl = pLayouts[i]!;
    const isCardMode = tk.participantRenderMode === 'card';

    if (isCardMode) {
      // Card mode: colored card with icon + label
      for (const prim of renderCardParticipant(p, pl, tk)) {
        primitives.push(prim);
      }
    } else {
      // Box mode: plain rect + optional actor icon + label
      const isActor = p.kind === 'actor';

      const boxFill = p.color ?? tk.participantBoxFill;
      primitives.push({
        kind: 'rect',
        x: pl.boxX,
        y: pl.boxY,
        width: pl.boxW,
        height: pl.boxH,
        fill: boxFill,
        stroke: tk.participantBoxStroke,
        strokeWidth: tk.participantBoxStrokeWidth,
        rx: tk.participantBoxRx,
      });

      if (isActor) {
        const iconTopY = rhuInt(pl.boxY + tk.headerPadY);
        primitives.push(actorIconPath(pl.cx, iconTopY, tk));
      }

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
        fontWeight: tk.labelFontWeight,
        fill: tk.participantLabelColor,
        textAnchor: 'middle',
        dominantBaseline: isActor ? 'alphabetic' : 'middle',
      });
    }

    // Lifeline (only when visible)
    if (tk.lifelineVisible) {
      const lifelineBottom = rhuInt(canvasH - tk.marginBottom);
      primitives.push({
        kind: 'line',
        x1: pl.cx,
        y1: headerBottom,
        x2: pl.cx,
        y2: lifelineBottom,
        stroke: tk.lifelineStroke,
        strokeWidth: tk.lifelineStrokeWidth,
        dashArray: tk.lifelineDash,
      });
    }
  }

  // 8. Activation bars — after lifelines, before messages
  if (activations.length > 0) {
    renderActivationBars(activations, pIndexById, pLayouts, orderToRowY, lastRowY, tk, primitives);
  }

  // 9. Messages — with activation-bar edge attachment
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

    const fromColHalfW = rhuInt((pLayouts[fromIdx] ?? pLayouts[0]!).colW / 2);
    const toColHalfW = rhuInt((pLayouts[toIdx] ?? pLayouts[0]!).colW / 2);

    renderMessage(msg, rowY, fromCx, toCx, tk, primitives, fromBarOffset, toBarOffset, fromColHalfW, toColHalfW);
  }

  return {
    width: canvasW,
    height: canvasH,
    background: tk.background,
    primitives,
  };
}
