/**
 * @file diagrams/struct/page.ts — Slotted page (storage layout).
 *
 * Value-driven:
 *   page
 *     title heap page
 *     slots 4
 *     tuples (10,Ann) (40,Bob) (50,Cy)
 *
 * Line pointers (slots) indirect to tuples — the classic slotted-page layout
 * that lets tuples move without invalidating their slot ids.
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';
import { ARROW_ID, arrowDef, lines } from './shared.js';

interface PageDoc { title?: string; slots?: number; tuples: string[]; }

function parse(input: string): PageDoc {
  let title: string | undefined;
  let slots: number | undefined;
  const tuples: string[] = [];
  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'page') continue;
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'slots') { slots = Number(t[1]); continue; }
    if (t[0] === 'tuples') { tuples.push(...t.slice(1)); continue; }
  }
  return { ...(title !== undefined ? { title } : {}), ...(slots !== undefined ? { slots } : {}), tuples };
}

export function layoutPage(doc: PageDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const small = typography.smallFontSize;
  const titleH = doc.title ? typography.titleFontSize + 14 : 0;

  const slotCount = doc.slots ?? doc.tuples.length;
  const PAD = 14, HEADER = 26, SLOT_W = 54, SLOT_H = 22, TUPLE_H = 28, TGAP = 18;

  const tupleW = Math.max(110, ...doc.tuples.map(t => measureText(t, font).width + 24));
  const tuplesRowW = doc.tuples.length * tupleW + (doc.tuples.length - 1) * TGAP;
  const slotsRowW = slotCount * (SLOT_W + 8) - 8;
  const innerW = Math.max(tuplesRowW, slotsRowW, 240);
  const pageW = innerW + PAD * 2;
  const pageH = HEADER + 36 + 70 + TUPLE_H + PAD;

  const px = margin, py = margin + titleH;
  const elements: SceneElement[] = [];
  if (doc.title) elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  elements.push(p.rect({ x: px, y: py, width: pageW, height: pageH }, '#fbfbfd', palette.border, 1.5, { rx: 6 }));
  elements.push(p.rect({ x: px, y: py, width: pageW, height: HEADER }, palette.primary, palette.primary, 0, { rx: 0 }));
  elements.push(p.text('PageHeader    freeStart →        ← freeEnd', px + 12, py + 17, small, '#ffffff', { weight: 'bold' }));

  const slotY = py + HEADER + 10;
  const slotCx: number[] = [];
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  for (let i = 0; i < slotCount; i++) {
    const sx = px + PAD + i * (SLOT_W + 8);
    const box = { x: sx, y: slotY, width: SLOT_W, height: SLOT_H };
    elements.push(p.rect(box, '#eef2ff', palette.primary, 1.5, { rx: 3 }));
    elements.push(p.text(`slot${i}`, sx + SLOT_W / 2, slotY + 15, small, palette.primary, { anchor: 'middle', weight: 'bold' }));
    slotCx.push(sx + SLOT_W / 2);
    anchors[`slot${i}`] = { bounds: box };
  }

  elements.push(p.text('free space', px + pageW / 2, py + HEADER + 70, font, palette.textMuted, { anchor: 'middle' }));

  const tupleY = py + pageH - PAD - TUPLE_H;
  doc.tuples.forEach((tuple, i) => {
    const tx = px + PAD + i * (tupleW + TGAP);
    const box = { x: tx, y: tupleY, width: tupleW, height: TUPLE_H };
    elements.push(p.rect(box, palette.surface, palette.border, 1.5, { rx: 3 }));
    elements.push(p.text(tuple, tx + tupleW / 2, tupleY + TUPLE_H / 2 + font * 0.35, font, palette.text, { anchor: 'middle', weight: 'bold' }));
    anchors[`tuple${i}`] = { bounds: box };
    if (i < slotCx.length) {
      elements.push(p.path(`M ${rhu(slotCx[i]!)} ${rhu(slotY + SLOT_H)} L ${rhu(tx + tupleW / 2)} ${rhu(tupleY)}`, palette.textMuted, 1.5, { markerEnd: ARROW_ID }));
    }
  });

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: pageW + margin * 2, height: py + pageH + margin },
    background: palette.background,
    elements,
    defs: [arrowDef(palette.textMuted)],
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const page: DiagramModule<PageDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutPage(ir, theme);
  },
};
