/**
 * @file diagrams/er/layout.ts — Entity-relationship diagram.
 *
 * Entities render as header + typed-attribute tables; placement uses the shared
 * layered kernel. Relationships connect entity borders with crow's-foot
 * cardinality markers (one = tick, many = foot, zero = circle).
 */

import type { ErDocument, ErEntity } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { measureText } from '../../text/metrics.js';
import { layeredLayout, routeEdge, type GraphNode, type GraphEdge } from '../../graph/layered.js';
import { borderPoint } from '../../graph/connect.js';
import { rhu, rhuInt } from '../../util/round.js';

export function layoutEr(ir: ErDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const nameFont = typography.baseFontSize;
  const rowFont  = typography.smallFontSize;
  const rowH     = rhuInt(rowFont * 1.7);
  const headH    = rhuInt(nameFont * 1.8);

  const sizeOf = (e: ErEntity): { w: number; h: number } => {
    const rowText = (a: ErEntity['attributes'][number]) => `${a.type}  ${a.name}${a.key ? '  ' + a.key : ''}`;
    const w = Math.max(140, measureText(e.name, nameFont).width + 28, ...e.attributes.map(a => measureText(rowText(a), rowFont).width + 28));
    const h = headH + e.attributes.length * rowH + (e.attributes.length ? 6 : 0);
    return { w, h };
  };
  const sizes = new Map(ir.entities.map(e => [e.name, sizeOf(e)]));

  const nodes: GraphNode[] = ir.entities.map(e => ({ id: e.name, width: sizes.get(e.name)!.w, height: sizes.get(e.name)!.h }));
  const edges: GraphEdge[] = ir.relations.map(r => ({ from: r.left, to: r.right }));
  const laid = layeredLayout(nodes, edges, { direction: 'TB', layerGap: 70, nodeGap: 50, margin });

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Relationships ──────────────────────────────────────────────────────────
  const allBoxes = [...laid.boxes.values()];
  for (const r of ir.relations) {
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 + yOff };
    const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 + yOff };
    const pa = borderPoint({ ...a, y: a.y + yOff }, bc.x, bc.y);
    const pb = borderPoint({ ...b, y: b.y + yOff }, ac.x, ac.y);
    const { path } = routeEdge(a, b, allBoxes, yOff);
    elements.push(p.path(path, palette.textMuted, 1.3, r.dashed ? { dash: '6 4' } : {}));
    elements.push(...crowFoot(p, pa, bc, r.leftCard, palette));
    elements.push(...crowFoot(p, pb, ac, r.rightCard, palette));
    if (r.label) {
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const w = measureText(r.label, rowFont).width + 8;
      elements.push(p.rect({ x: rhu(mx - w / 2), y: rhu(my - rowFont), width: rhu(w), height: rowFont + 4 }, palette.background, palette.background, 0));
      elements.push(p.text(r.label, rhuInt(mx), rhu(my - 1), rowFont, palette.textMuted, { anchor: 'middle' }));
    }
  }

  // ── Entities ───────────────────────────────────────────────────────────────
  for (const e of ir.entities) {
    const box = laid.boxes.get(e.name)!;
    const s = sizes.get(e.name)!;
    const x = box.x, y = box.y + yOff;
    elements.push(p.rect({ x: rhu(x), y: rhu(y), width: rhu(s.w), height: rhu(s.h) }, palette.surface, palette.border, 1.4, { rx: 4 }));
    elements.push(p.rect({ x: rhu(x), y: rhu(y), width: rhu(s.w), height: headH }, palette.primary, palette.border, 1.4, { rx: 4 }));
    elements.push(p.text(e.name, rhuInt(x + s.w / 2), rhu(y + headH / 2 + nameFont * 0.35), nameFont, '#FFFFFF', { weight: 'bold', anchor: 'middle' }));
    let ry = y + headH + rowH - 5;
    for (const a of e.attributes) {
      elements.push(p.text(`${a.type}  ${a.name}`, rhu(x + 8), rhu(ry), rowFont, palette.text));
      if (a.key) elements.push(p.text(a.key, rhu(x + s.w - 8), rhu(ry), rowFont, palette.secondary, { anchor: 'end', weight: 'bold' }));
      ry += rowH;
    }
  }

  const totalW = rhuInt(laid.width + margin);
  const totalH = rhuInt(laid.height + yOff + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}

/** Crow's-foot cardinality marker at `at`, line heading toward `toward`. */
function crowFoot(
  p: ReturnType<typeof pen>,
  at: { x: number; y: number },
  toward: { x: number; y: number },
  card: string,
  palette: ResolvedTheme['palette'],
): SceneElement[] {
  const len = Math.hypot(toward.x - at.x, toward.y - at.y) || 1;
  const ux = (toward.x - at.x) / len, uy = (toward.y - at.y) / len;          // unit toward other entity
  const px = -uy, py = ux;                                                    // perpendicular
  const at2 = (d: number, s: number) => ({ x: at.x + ux * d + px * s, y: at.y + uy * d + py * s });
  const out: SceneElement[] = [];
  const color = palette.textMuted;

  const many = /[}{]/.test(card);
  const zero = /o/.test(card);
  const one  = /\|/.test(card);

  if (many) {
    const base = at2(14, 0);
    const a = at2(0, 6), b = at2(0, -6);
    out.push(p.path(`M ${rhu(base.x)} ${rhu(base.y)} L ${rhu(a.x)} ${rhu(a.y)}`, color, 1.2));
    out.push(p.path(`M ${rhu(base.x)} ${rhu(base.y)} L ${rhu(b.x)} ${rhu(b.y)}`, color, 1.2));
    out.push(p.path(`M ${rhu(base.x)} ${rhu(base.y)} L ${rhu(at.x)} ${rhu(at.y)}`, color, 1.2));
  } else if (one) {
    const c1 = at2(10, 6), c2 = at2(10, -6);
    out.push(p.path(`M ${rhu(c1.x)} ${rhu(c1.y)} L ${rhu(c2.x)} ${rhu(c2.y)}`, color, 1.3));
  }
  if (zero) {
    const c = at2(many ? 20 : 16, 0);
    out.push(p.circle({ x: rhu(c.x), y: rhu(c.y) }, 4, palette.background, color, 1.2));
  } else if (one && !many) {
    const c1 = at2(15, 5), c2 = at2(15, -5);
    out.push(p.path(`M ${rhu(c1.x)} ${rhu(c1.y)} L ${rhu(c2.x)} ${rhu(c2.y)}`, color, 1.3));
  }
  return out;
}
