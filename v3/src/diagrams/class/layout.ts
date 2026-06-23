/**
 * @file diagrams/class/layout.ts — UML class diagram.
 *
 * Classes render as three-compartment boxes (name/stereotype, attributes,
 * methods); placement uses the shared layered kernel (inheritance points up).
 * Relationships draw as straight connectors clipped to box borders with
 * UML end markers (triangle / diamond / arrow) plus cardinality + labels.
 */

import type { ClassDocument, ClassBox, RelEnd } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { measureText } from '../../text/metrics.js';
import { layeredLayout, type GraphNode, type GraphEdge } from '../../graph/layered.js';
import { borderPoint } from '../../graph/connect.js';
import { rhu, rhuInt } from '../../util/round.js';

export function layoutClass(ir: ClassDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const memFont = typography.smallFontSize;
  const nameFont = typography.baseFontSize;
  const lineH = rhuInt(memFont * 1.6);
  const headH = rhuInt(nameFont * 1.6);

  // ── Box sizing ─────────────────────────────────────────────────────────────
  const sizeOf = (c: ClassBox): { w: number; h: number; attrH: number } => {
    const texts = [c.name, ...(c.stereotype ? [`«${c.stereotype}»`] : []), ...c.attributes.map(m => m.text), ...c.methods.map(m => m.text)];
    const w = Math.max(130, ...texts.map(t => measureText(t, memFont).width + 24));
    const stereoH = c.stereotype ? memFont + 4 : 0;
    const attrH = c.attributes.length * lineH + 8;
    const methH = c.methods.length * lineH + 8;
    const h = headH + stereoH + attrH + methH;
    return { w, h, attrH: headH + stereoH + attrH };
  };
  const sizes = new Map(ir.classes.map(c => [c.name, sizeOf(c)]));

  const nodes: GraphNode[] = ir.classes.map(c => ({ id: c.name, width: sizes.get(c.name)!.w, height: sizes.get(c.name)!.h }));
  const edges: GraphEdge[] = ir.relations.map(r =>
    r.leftHead === 'triangle' ? { from: r.right, to: r.left } : { from: r.left, to: r.right });
  const laid = layeredLayout(nodes, edges, { direction: 'TB', layerGap: 64, nodeGap: 46, margin });

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Relationships (under boxes) ────────────────────────────────────────────
  for (const r of ir.relations) {
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 + yOff };
    const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 + yOff };
    const pa = borderPoint({ ...a, y: a.y + yOff }, bc.x, bc.y);
    const pb = borderPoint({ ...b, y: b.y + yOff }, ac.x, ac.y);
    elements.push(p.path(`M ${rhu(pa.x)} ${rhu(pa.y)} L ${rhu(pb.x)} ${rhu(pb.y)}`, palette.textMuted, 1.3, r.dashed ? { dash: '6 4' } : {}));
    elements.push(...endMarker(p, pa, bc, r.leftHead, palette));
    elements.push(...endMarker(p, pb, ac, r.rightHead, palette));
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    if (r.label) elements.push(p.text(r.label, rhuInt(mx), rhuInt(my - 4), memFont, palette.textMuted, { anchor: 'middle' }));
    if (r.leftCard)  elements.push(p.text(r.leftCard, rhu(pa.x + 6), rhu(pa.y - 4), memFont, palette.textMuted));
    if (r.rightCard) elements.push(p.text(r.rightCard, rhu(pb.x + 6), rhu(pb.y - 4), memFont, palette.textMuted));
  }

  // ── Class boxes ────────────────────────────────────────────────────────────
  for (const c of ir.classes) {
    const box = laid.boxes.get(c.name)!;
    const s = sizes.get(c.name)!;
    const x = box.x, y = box.y + yOff;
    elements.push(p.rect({ x: rhu(x), y: rhu(y), width: rhu(s.w), height: rhu(s.h) }, palette.surface, palette.border, 1.4, { rx: 4 }));

    // Header
    let ty = y + nameFont + 6;
    elements.push(p.text(c.name, rhuInt(x + s.w / 2), rhu(ty), nameFont, palette.text, { weight: 'bold', anchor: 'middle' }));
    if (c.stereotype) { ty += memFont + 2; elements.push(p.text(`«${c.stereotype}»`, rhuInt(x + s.w / 2), rhu(ty), memFont, palette.textMuted, { anchor: 'middle' })); }
    const headerBottom = y + headH + (c.stereotype ? memFont + 4 : 0);
    elements.push(p.path(`M ${rhu(x)} ${rhu(headerBottom)} L ${rhu(x + s.w)} ${rhu(headerBottom)}`, palette.border, 1));

    // Attributes
    let ay = headerBottom + lineH - 4;
    for (const m of c.attributes) { elements.push(p.text(m.text, rhu(x + 8), rhu(ay), memFont, palette.text)); ay += lineH; }
    const attrBottom = y + s.attrH;
    elements.push(p.path(`M ${rhu(x)} ${rhu(attrBottom)} L ${rhu(x + s.w)} ${rhu(attrBottom)}`, palette.border, 1));

    // Methods
    let my2 = attrBottom + lineH - 4;
    for (const m of c.methods) { elements.push(p.text(m.text, rhu(x + 8), rhu(my2), memFont, palette.text)); my2 += lineH; }
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

/** Draw a UML relationship end marker at `at`, pointing from `toward` into the box. */
function endMarker(
  p: ReturnType<typeof pen>,
  at: { x: number; y: number },
  toward: { x: number; y: number },
  type: RelEnd,
  palette: ResolvedTheme['palette'],
): SceneElement[] {
  if (type === 'none') return [];
  const ang = Math.atan2(at.y - toward.y, at.x - toward.x); // points outward from box centre toward marker
  const back = ang + Math.PI; // into the box
  const at2 = (len: number, spread: number) => ({
    x: at.x + Math.cos(back + spread) * len,
    y: at.y + Math.sin(back + spread) * len,
  });
  const tip = `${rhu(at.x)} ${rhu(at.y)}`;

  if (type === 'arrow') {
    const a = at2(12, 0.4), b = at2(12, -0.4);
    return [p.path(`M ${rhu(a.x)} ${rhu(a.y)} L ${tip} L ${rhu(b.x)} ${rhu(b.y)}`, palette.textMuted, 1.4)];
  }
  if (type === 'triangle') {
    const a = at2(14, 0.45), b = at2(14, -0.45);
    return [p.path(`M ${tip} L ${rhu(a.x)} ${rhu(a.y)} L ${rhu(b.x)} ${rhu(b.y)} Z`, palette.textMuted, 1.3, { fill: palette.background })];
  }
  // diamonds
  const near = at2(11, 0);
  const a = at2(8, 0.9), b = at2(8, -0.9);
  const fill = type === 'diamondF' ? palette.textMuted : palette.background;
  return [p.path(`M ${tip} L ${rhu(a.x)} ${rhu(a.y)} L ${rhu(near.x)} ${rhu(near.y)} L ${rhu(b.x)} ${rhu(b.y)} Z`, palette.textMuted, 1.3, { fill })];
}
