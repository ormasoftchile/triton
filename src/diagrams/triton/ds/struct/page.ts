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
import { ARROW_ID, arrowDef, lines, tokenizeDirective } from './shared.js';

interface PageDoc { title?: string; slots?: number; tuples: string[]; }

function parse(input: string): PageDoc {
  let title: string | undefined;
  let slots: number | undefined;
  const tuples: string[] = [];
  for (const line of lines(input)) {
    const t = tokenizeDirective(line);
    if (t[0] === 'page') continue;
    if (t[0] === 'title') { title = t.slice(1).join(' '); continue; }
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
  const SLOT_TOP_GAP = 12, FREE_BAND = 48, MIN_INNER_W = 240, SLOT_FILL_OPACITY = 0.14;

  const tupleWidths = doc.tuples.map(t => Math.max(110, measureText(t, font).width + 24));
  const columnCount = Math.max(slotCount, doc.tuples.length, 1);
  const columnWidths = Array.from({ length: columnCount }, (_, i) => Math.max(SLOT_W, tupleWidths[i] ?? 0));
  const contentW = columnWidths.reduce((sum, width) => sum + width, 0) + (columnCount - 1) * TGAP;
  const innerW = Math.max(contentW, MIN_INNER_W);
  const pageW = innerW + PAD * 2;
  const pageH = HEADER + SLOT_TOP_GAP + SLOT_H + FREE_BAND + TUPLE_H + PAD;
  const contentX = pxForCenteredContent(margin + PAD, innerW, contentW);

  const px = margin, py = margin + titleH;
  const elements: SceneElement[] = [];
  if (doc.title) elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  elements.push(p.rect({ x: px, y: py, width: pageW, height: pageH }, palette.surface, palette.border, 1.5, { rx: 6 }));
  elements.push(p.rect({ x: px, y: py, width: pageW, height: HEADER }, palette.primary, palette.primary, 0, { rx: 0 }));
  elements.push(p.text('PageHeader    freeStart →        ← freeEnd', px + 12, py + 17, small, '#ffffff', { weight: 'bold' }));

  const slotY = py + HEADER + SLOT_TOP_GAP;
  const slotCx: number[] = [];
  const tupleCx: number[] = [];
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  const columnX: number[] = [];
  let x = contentX;
  for (const width of columnWidths) {
    columnX.push(x);
    x += width + TGAP;
  }

  for (let i = 0; i < slotCount; i++) {
    const sx = (columnX[i] ?? contentX) + ((columnWidths[i] ?? SLOT_W) - SLOT_W) / 2;
    const box = { x: sx, y: slotY, width: SLOT_W, height: SLOT_H };
    elements.push(p.rect(box, palette.primary, palette.primary, 1.5, { rx: 3, fillOpacity: SLOT_FILL_OPACITY }));
    elements.push(p.text(`slot${i}`, sx + SLOT_W / 2, slotY + 15, small, palette.primary, { anchor: 'middle', weight: 'bold' }));
    slotCx.push(sx + SLOT_W / 2);
    anchors[`slot${i}`] = { bounds: box };
  }

  const tupleY = slotY + SLOT_H + FREE_BAND;
  const freeLabel = 'free space';
  const freeLabelY = slotY + SLOT_H + FREE_BAND / 2 + font * 0.35;
  const freeLabelX = px + pageW / 2;
  const freeLabelWidth = measureText(freeLabel, font).width;
  const freeLabelBounds = {
    x1: freeLabelX - freeLabelWidth / 2 - 6,
    x2: freeLabelX + freeLabelWidth / 2 + 6,
    y1: freeLabelY - font - 3,
    y2: freeLabelY + 5,
  };
  elements.push(p.text(freeLabel, freeLabelX, freeLabelY, font, palette.textMuted, { anchor: 'middle' }));

  doc.tuples.forEach((tuple, i) => {
    const tupleW = tupleWidths[i]!;
    const tx = (columnX[i] ?? contentX) + ((columnWidths[i] ?? tupleW) - tupleW) / 2;
    const box = { x: tx, y: tupleY, width: tupleW, height: TUPLE_H };
    const cx = tx + tupleW / 2;
    tupleCx.push(cx);
    elements.push(p.rect(box, palette.surface, palette.border, 1.5, { rx: 3 }));
    elements.push(p.text(tuple, cx, tupleY + TUPLE_H / 2 + font * 0.35, font, palette.text, { anchor: 'middle', weight: 'bold' }));
    anchors[`tuple${i}`] = { bounds: box };
  });

  for (let i = 0; i < Math.min(slotCx.length, tupleCx.length); i++) {
    elements.push(p.path(verticalArrow(slotCx[i]!, slotY + SLOT_H, tupleY, freeLabelBounds), palette.textMuted, 1.5, { markerEnd: ARROW_ID }));
  }

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: pageW + margin * 2, height: py + pageH + margin },
    background: palette.background,
    elements,
    defs: [arrowDef(palette.textMuted)],
  };
  // Expose the PageHeader bar as chrome so the poster label de-collision pass
  // keeps cross-link labels from landing on top of it.
  const chromeRects = [{ x: px, y: py, width: pageW, height: HEADER }];
  return { scene, anchors: anchors as NodeAnchorRegistry, chromeRects };
}

function pxForCenteredContent(innerLeft: number, innerW: number, contentW: number): number {
  return innerLeft + Math.max(0, (innerW - contentW) / 2);
}

function verticalArrow(x: number, y1: number, y2: number, avoid?: { x1: number; x2: number; y1: number; y2: number }): string {
  const rx = rhu(x);
  if (avoid && x >= avoid.x1 && x <= avoid.x2 && y1 < avoid.y2 && y2 > avoid.y1) {
    return `M ${rx} ${rhu(y1)} L ${rx} ${rhu(Math.max(y1, avoid.y1))} M ${rx} ${rhu(Math.min(y2, avoid.y2))} L ${rx} ${rhu(y2)}`;
  }
  return `M ${rx} ${rhu(y1)} L ${rx} ${rhu(y2)}`;
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
