/**
 * @file diagrams/sequence/layout.ts — UML sequence diagram.
 *
 * Participants become equally-spaced columns with dashed lifelines. Events are
 * walked top→down assigning rows: messages draw arrows (with autonumber, self
 * loops, activation bars), fragments draw labeled boxes with else dividers, and
 * notes draw boxes over participants. Deterministic; no clock.
 */

import type { SequenceDocument, SeqMessage, SeqNote } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { measureText } from '../../text/metrics.js';
import { rhu, rhuInt } from '../../util/round.js';

const ARROW_ID = 'seq-arrow';
const OPEN_ID  = 'seq-open';

export function layoutSequence(ir: SequenceDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const parts = ir.participants;
  const idx = new Map(parts.map((pt, i) => [pt.id, i]));

  // ── Column geometry ──────────────────────────────────────────────────────
  const headFont = typography.baseFontSize;
  const headPadX = 14;
  const headH    = 34;
  const colW = Math.max(110, ...parts.map(pt => measureText(pt.label, headFont).width + headPadX * 2 + (pt.isActor ? 8 : 0)));
  const colGap = 60;
  const colPitch = colW + colGap;
  const colX = (i: number): number => margin + i * colPitch + colW / 2;
  const partX = (id: string): number => colX(idx.get(id) ?? 0);

  const titleH = ir.metadata.title ? typography.titleFontSize + 14 : 0;
  const headTop = margin + titleH;
  const bodyTop = headTop + headH + 26;
  const rowGap  = 46;

  const elements: SceneElement[] = [];
  const lifelineEls: SceneElement[] = [];

  if (ir.metadata.title) {
    elements.push(p.text(ir.metadata.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // ── Walk events to assign rows ─────────────────────────────────────────────
  interface Frag { type: string; label: string; top: number; left: number; right: number; elses: Array<{ y: number; label: string }>; }
  const fragStack: Frag[] = [];
  const fragBoxes: Frag[] = [];
  const activations = new Map<string, number[]>();  // id → stack of start-Y
  const actBars: Array<{ x: number; y0: number; y1: number }> = [];

  let y = bodyTop;
  let msgNo = 0;
  const minX = colX(0);
  const maxX = colX(Math.max(parts.length - 1, 0));

  const pushAct = (id: string): void => { (activations.get(id) ?? activations.set(id, []).get(id)!).push(y); };
  const popAct  = (id: string): void => {
    const st = activations.get(id);
    if (st && st.length) { const y0 = st.pop()!; actBars.push({ x: partX(id), y0, y1: y }); }
  };

  for (const ev of ir.events) {
    if (ev.kind === 'message') {
      const m = ev as SeqMessage;
      const x1 = partX(m.from), x2 = partX(m.to);
      const self = m.from === m.to;
      const label = ir.autonumber ? `${++msgNo}. ${m.text}` : m.text;
      const dash = m.line === 'dashed' ? '5 4' : undefined;
      const markerEnd = m.head === 'arrow' ? ARROW_ID : (m.head === 'open' || m.head === 'async') ? OPEN_ID : undefined;

      if (m.activateTarget) pushAct(m.to);

      if (self) {
        const r = 26;
        elements.push(p.text(label, x1 + 12, y - 6, typography.smallFontSize, palette.text));
        elements.push(p.path(`M ${x1} ${rhu(y)} L ${x1 + r} ${rhu(y)} L ${x1 + r} ${rhu(y + 22)} L ${x1} ${rhu(y + 22)}`, palette.text, 1.3, { ...(dash ? { dash } : {}), ...(markerEnd ? { markerEnd } : {}) }));
        y += 22 + rowGap;
      } else {
        const dir = x2 >= x1 ? 1 : -1;
        elements.push(p.text(label, rhuInt((x1 + x2) / 2), y - 7, typography.smallFontSize, palette.text, { anchor: 'middle' }));
        if (m.head === 'cross') {
          elements.push(p.path(`M ${rhu(x1)} ${rhu(y)} L ${rhu(x2 - dir * 6)} ${rhu(y)}`, palette.text, 1.3, dash ? { dash } : {}));
          const cxp = x2 - dir * 6;
          elements.push(p.path(`M ${rhu(cxp - 5)} ${rhu(y - 5)} L ${rhu(cxp + 5)} ${rhu(y + 5)} M ${rhu(cxp - 5)} ${rhu(y + 5)} L ${rhu(cxp + 5)} ${rhu(y - 5)}`, palette.text, 1.5));
        } else {
          elements.push(p.path(`M ${rhu(x1)} ${rhu(y)} L ${rhu(x2)} ${rhu(y)}`, palette.text, 1.3, { ...(dash ? { dash } : {}), ...(markerEnd ? { markerEnd } : {}) }));
        }
        y += rowGap;
      }

      if (m.deactivateSource) popAct(m.from);
    } else if (ev.kind === 'note') {
      const note = ev as SeqNote;
      const xs = note.participants.map(partX);
      const c = xs.reduce((s, v) => s + v, 0) / xs.length;
      const w = Math.max(measureText(note.text, typography.smallFontSize).width + 24, (Math.max(...xs) - Math.min(...xs)) + colW * 0.8);
      const nx = rhu(c - w / 2);
      elements.push(p.rect({ x: nx, y: rhu(y - 6), width: rhu(w), height: 30 }, palette.warning + '22', palette.warning, 1, { rx: 4 }));
      elements.push(p.text(note.text, rhuInt(c), y + 13, typography.smallFontSize, palette.text, { anchor: 'middle' }));
      y += 30 + rowGap - 10;
    } else if (ev.kind === 'frag-start') {
      fragStack.push({ type: ev.type, label: ev.label, top: y - 24, left: minX, right: maxX, elses: [] });
      y += 14;
    } else if (ev.kind === 'frag-else') {
      const f = fragStack[fragStack.length - 1];
      if (f) f.elses.push({ y: y - 18, label: ev.label });
      y += 10;
    } else if (ev.kind === 'frag-end') {
      const f = fragStack.pop();
      if (f) { f.right = maxX; fragBoxes.push({ ...f, top: f.top, left: minX - colW / 2 - 16, right: maxX + colW / 2 + 16 }); }
      y += 6;
    }
  }
  // Close any unclosed activations.
  for (const [id, st] of activations) while (st.length) { const y0 = st.pop()!; actBars.push({ x: partX(id), y0, y1: y }); }

  const bodyBottom = y + 6;

  // ── Fragment boxes (behind messages) ───────────────────────────────────────
  const fragEls: SceneElement[] = [];
  for (const f of fragBoxes) {
    const top = f.top, left = f.left, right = f.right;
    fragEls.push(p.rect({ x: rhu(left), y: rhu(top), width: rhu(right - left), height: rhu(bodyBottom - top) }, 'none', palette.border, 1.2, { rx: 4 }));
    // label tab
    const tabW = measureText(f.type.toUpperCase(), typography.smallFontSize).width + 16;
    fragEls.push(p.rect({ x: rhu(left), y: rhu(top), width: rhu(tabW), height: 18 }, palette.border, palette.border, 0));
    fragEls.push(p.text(f.type.toUpperCase(), rhu(left + 8), rhu(top + 13), typography.smallFontSize, palette.background, { weight: 'bold' }));
    if (f.label) fragEls.push(p.text(`[${f.label}]`, rhu(left + tabW + 8), rhu(top + 13), typography.smallFontSize, palette.text, { weight: 'bold' }));
    for (const e of f.elses) {
      fragEls.push(p.path(`M ${rhu(left)} ${rhu(e.y)} L ${rhu(right)} ${rhu(e.y)}`, palette.border, 1, { dash: '4 3' }));
      if (e.label) fragEls.push(p.text(`[${e.label}]`, rhu(left + 8), rhu(e.y + 13), typography.smallFontSize, palette.text));
    }
  }

  // ── Activation bars ────────────────────────────────────────────────────────
  const actEls: SceneElement[] = actBars.map(b =>
    p.rect({ x: rhu(b.x - 5), y: rhu(b.y0), width: 10, height: rhu(Math.max(8, b.y1 - b.y0)) }, palette.surface, palette.primary, 1, { rx: 1 }));

  // ── Lifelines + participant headers ────────────────────────────────────────
  parts.forEach((pt, i) => {
    const x = colX(i);
    lifelineEls.push(p.path(`M ${rhu(x)} ${rhu(headTop + headH)} L ${rhu(x)} ${rhu(bodyBottom)}`, palette.border, 1, { dash: '3 4' }));
    const hx = rhu(x - colW / 2);
    const fill = pt.isActor ? palette.primary : palette.surface;
    const txtFill = pt.isActor ? '#FFFFFF' : palette.text;
    elements.push(p.rect({ x: hx, y: rhu(headTop), width: rhu(colW), height: headH }, fill, palette.border, 1.2, { rx: 6 }));
    elements.push(p.text(pt.label, rhuInt(x), headTop + headH / 2 + headFont * 0.35, headFont, txtFill, { weight: 'bold', anchor: 'middle' }));
  });

  // Paint order: lifelines, fragments, activation bars, then messages/headers (already in elements).
  const ordered: SceneElement[] = [...lifelineEls, ...fragEls, ...actEls, ...elements];

  const totalW = rhuInt(maxX + colW / 2 + margin);
  const totalH = rhuInt(bodyBottom + margin);

  const defs = [
    `<marker id="${ARROW_ID}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill="${palette.text}" /></marker>`,
    `<marker id="${OPEN_ID}" markerWidth="11" markerHeight="9" refX="9" refY="4.5" orient="auto"><polyline points="0 0, 10 4.5, 0 9" fill="none" stroke="${palette.text}" stroke-width="1.3" /></marker>`,
  ];

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements: ordered,
    defs,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
