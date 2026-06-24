/**
 * @file diagrams/struct/array.ts — Contiguous array (cell strip + pointers).
 *
 * Value-driven mini-syntax:
 *   array 5 8 13 21 34        // cells on the header line, or:
 *   array
 *     title nums
 *     cells 5 8 13 21 34
 *     index                   // show the index row
 *     ptr i -> 2              // a named pointer into cell 2
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../scene/strip.js';
import { measureText } from '../../../text/metrics.js';
import { rhu } from '../../../util/round.js';
import { ARROW_ID, arrowDef, lines } from './shared.js';

interface ArrayDoc {
  title?: string;
  cells: string[];
  index: boolean;
  ptrs: { name: string; idx: number }[];
}

function parse(input: string): ArrayDoc {
  let title: string | undefined;
  let cells: string[] = [];
  let index = false;
  const ptrs: { name: string; idx: number }[] = [];

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'array') { if (t.length > 1) cells = t.slice(1); continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'cells') { cells = t.slice(1); continue; }
    if (t[0] === 'index') { index = true; continue; }
    if (t[0] === 'ptr') {
      const m = line.match(/^ptr\s+(\S+)\s*->\s*(\d+)/);
      if (m) ptrs.push({ name: m[1]!, idx: Number(m[2]) });
    }
  }
  return { ...(title !== undefined ? { title } : {}), cells, index, ptrs };
}

export function layoutArray(doc: ArrayDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 40;
  const cellW = Math.max(40, ...doc.cells.map(c => measureText(c, font).width + 24));

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const indexH = doc.index ? typography.smallFontSize + 8 : 0;
  const origin = { x: margin, y: margin + titleH + indexH };

  const cellInputs: StripCell[] = doc.cells.map((v, i) => ({
    label: v, ...(doc.index ? { index: String(i) } : {}),
  }));
  const strip = buildStrip(p, theme, cellInputs, { origin, cellWidth: cellW, cellHeight: cellH });

  const elements: SceneElement[] = [...strip.elements];
  if (doc.title) {
    elements.push(p.text(doc.title, origin.x, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // pointers below the strip
  let maxPtrBottom = origin.y + cellH;
  for (const ptr of doc.ptrs) {
    const slot = strip.slots[ptr.idx];
    if (!slot) continue;
    const cx = slot.x + slot.width / 2;
    const yTop = slot.y + cellH + 4;
    const yBot = slot.y + cellH + 34;
    elements.push(p.path(`M ${rhu(cx)} ${rhu(yBot)} L ${rhu(cx)} ${rhu(yTop)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));
    elements.push(p.text(ptr.name, cx, yBot + 14, font, palette.primary, { anchor: 'middle', weight: 'bold' }));
    maxPtrBottom = Math.max(maxPtrBottom, yBot + 18);
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  strip.slots.forEach((slot, i) => { anchors[`c${i}`] = { bounds: slot }; });

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: strip.bounds.width + margin * 2, height: maxPtrBottom + margin },
    background: palette.background,
    elements,
    defs: [arrowDef(palette.primary)],
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const array: DiagramModule<ArrayDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutArray(ir, theme);
  },
};
