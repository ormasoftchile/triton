/**
 * @file diagrams/struct/memory.ts — Memory regions with cross-region pointers.
 *
 * Value-driven mini-syntax:
 *   memory
 *     title Stack -> Heap
 *     region STACK
 *       var p -> obj            // a slot holding a reference
 *     region HEAP
 *       object obj : Point : x=1, y=2
 *
 * Exercises connectSlots across region boundaries (the slot-aware pointer).
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry, Rect,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { connectSlots } from '../../../../graph/connect.js';
import { rhu } from '../../../../util/round.js';
import { ARROW_ID, arrowDef, lines } from './shared.js';

interface VarItem { kind: 'var'; name: string; target?: string; }
interface ObjItem { kind: 'object'; id: string; title: string; fields: { k: string; v: string }[]; }
type Item = VarItem | ObjItem;
interface Region { name: string; items: Item[]; }
interface MemoryDoc { title?: string; regions: Region[]; }

function parse(input: string): MemoryDoc {
  let title: string | undefined;
  const regions: Region[] = [];
  let cur: Region | undefined;
  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'memory') continue;
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'region') { cur = { name: line.slice(6).trim(), items: [] }; regions.push(cur); continue; }
    if (!cur) continue;
    if (t[0] === 'var') {
      const m = line.match(/^var\s+(\S+)(?:\s*->\s*(\S+))?/);
      if (m) cur.items.push({ kind: 'var', name: m[1]!, ...(m[2] ? { target: m[2] } : {}) });
      continue;
    }
    if (t[0] === 'object') {
      const parts = line.slice(6).split(':').map(s => s.trim());
      const id = parts[0] ?? 'obj';
      const titleO = parts[1] || id;
      const fields = (parts[2] ?? '').split(',').map(s => s.trim()).filter(Boolean).map(pair => {
        const [k, v] = pair.split('=').map(x => x.trim());
        return { k: k ?? '', v: v ?? '' };
      });
      cur.items.push({ kind: 'object', id, title: titleO, fields });
    }
  }
  return { ...(title !== undefined ? { title } : {}), regions };
}

export function layoutMemory(doc: MemoryDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const small = typography.smallFontSize;
  const titleH = doc.title ? typography.titleFontSize + 14 : 0;

  const HEADER = 26, PAD = 14, GAP = 14, REGION_GAP = 90;

  const itemSize = (item: Item): { w: number; h: number } => {
    if (item.kind === 'var') {
      return { w: Math.max(130, measureText(item.name, font).width + 56), h: 34 };
    }
    const titleW = measureText(item.title, font).width;
    const fieldW = Math.max(0, ...item.fields.map(f => measureText(`${f.k}: ${f.v}`, small).width));
    return { w: Math.max(120, titleW + 24, fieldW + 24), h: 24 + item.fields.length * 20 + 8 };
  };

  const elements: SceneElement[] = [];
  if (doc.title) elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  const idBox = new Map<string, Rect>();
  const anchors: Record<string, { bounds: Rect }> = {};
  const pending: { from: Rect; target: string }[] = [];

  let regionX = margin;
  let maxBottom = margin + titleH;
  const regionTop = margin + titleH;

  for (const region of doc.regions) {
    const sizes = region.items.map(itemSize);
    const innerW = Math.max(80, ...sizes.map(s => s.w));
    const regionW = innerW + PAD * 2;
    const contentH = sizes.reduce((s, sz) => s + sz.h + GAP, 0) - (sizes.length ? GAP : 0);
    const regionH = HEADER + PAD + contentH + PAD;

    elements.push(p.rect({ x: regionX, y: regionTop, width: regionW, height: regionH }, '#fbfbfd', palette.border, 1.5, { rx: 8 }));
    elements.push(p.text(region.name, regionX + 12, regionTop + 17, small, palette.textMuted, { weight: 'bold' }));

    let iy = regionTop + HEADER + PAD;
    region.items.forEach((item, i) => {
      const { h } = sizes[i]!;
      const box: Rect = { x: regionX + PAD, y: iy, width: innerW, height: h };
      if (item.kind === 'var') {
        elements.push(p.rect(box, palette.surface, palette.border, 1.5, { rx: 4 }));
        elements.push(p.text(item.name, box.x + 12, box.y + h / 2 + font * 0.35, font, palette.text, { weight: 'bold' }));
        idBox.set(item.name, box);
        anchors[item.name] = { bounds: box };
        if (item.target) {
          elements.push(p.circle({ x: box.x + box.width - 12, y: box.y + h / 2 }, 3, palette.primary, palette.primary, 1));
          pending.push({ from: box, target: item.target });
        }
      } else {
        elements.push(p.rect(box, palette.surface, palette.primary, 2, { rx: 6 }));
        elements.push(p.text(item.title, box.x + 12, box.y + 18, font, palette.primary, { weight: 'bold' }));
        item.fields.forEach((f, fi) => {
          elements.push(p.text(`${f.k}: ${f.v}`, box.x + 12, box.y + 24 + (fi + 1) * 18, small, palette.text));
        });
        idBox.set(item.id, box);
        anchors[item.id] = { bounds: box };
      }
      iy += h + GAP;
    });

    maxBottom = Math.max(maxBottom, regionTop + regionH);
    regionX += regionW + REGION_GAP;
  }

  // cross-region pointers (resolved after all boxes are placed)
  for (const { from, target } of pending) {
    const key = target.includes('.') ? target.slice(target.indexOf('.') + 1) : target;
    const to = idBox.get(key);
    if (!to) continue;
    const origin: Rect = { x: from.x + from.width - 12, y: from.y + from.height / 2 - 1, width: 2, height: 2 };
    const { start, end } = connectSlots(origin, to);
    elements.push(p.path(`M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));
  }

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: regionX - REGION_GAP + margin, height: maxBottom + margin },
    background: palette.background,
    elements,
    defs: [arrowDef(palette.primary)],
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const memory: DiagramModule<MemoryDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutMemory(ir, theme);
  },
};
