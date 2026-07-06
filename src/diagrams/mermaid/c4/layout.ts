/**
 * @file diagrams/c4/layout.ts — C4 context/container diagram.
 *
 * Nodes (Person/System, optionally _Ext) place via the shared layered kernel;
 * boundaries draw as labeled dashed containers around their descendant nodes
 * (outer first). Relationships are arrows with label + optional technology.
 */

import type { C4Document, C4Node } from './ir.js';
import type { Scene, SceneElement, LayoutResult, Rect } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { measureText } from '../../../text/metrics.js';
import { wrapText } from '../../../text/wrap.js';
import { layeredLayout, routeEdge, type GraphNode, type GraphEdge } from '../../../graph/layered.js';
import { borderPoint } from '../../../graph/connect.js';
import { rhu, rhuInt } from '../../../util/round.js';

const ARROW_ID = 'c4-arrow';
const NODE_W = 180;

export function layoutC4(ir: C4Document, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.smallFontSize;

  const isPerson = (k: C4Node['kind']) => k === 'person' || k === 'person_ext';
  const isExt    = (k: C4Node['kind']) => k.endsWith('_ext');

  // Pre-wrap + size.
  const prep = new Map<string, { labelLines: string[]; descrLines: string[]; h: number }>();
  for (const n of ir.nodes) {
    const labelLines = wrapText(n.label, typography.baseFontSize, NODE_W - 20, 2).lines;
    const descrLines = n.descr ? wrapText(n.descr, font, NODE_W - 20, 3).lines : [];
    const h = 14 + labelLines.length * rhuInt(typography.baseFontSize * 1.25) + 4 + descrLines.length * rhuInt(font * 1.3) + 14 + (isPerson(n.kind) ? 10 : 0);
    prep.set(n.id, { labelLines, descrLines, h });
  }

  const nodes: GraphNode[] = ir.nodes.map(n => ({ id: n.id, width: NODE_W, height: prep.get(n.id)!.h }));
  const edges: GraphEdge[] = ir.rels.map(r => ({ from: r.from, to: r.to }));
  const laid = layeredLayout(nodes, edges, { direction: 'TB', layerGap: 80, nodeGap: 50, margin: margin + 24 });

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 16 : 0;
  const yOff = titleH + 12;

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Boundaries (outer first) ───────────────────────────────────────────────
  const sorted = [...ir.boundaries].sort((a, b) => a.depth - b.depth);
  for (const bnd of sorted) {
    const rects = bnd.nodeIds.map(id => laid.boxes.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
    if (rects.length === 0) continue;
    const pad = 18 + bnd.depth * 4;
    const minX = Math.min(...rects.map(r => r.x)) - pad;
    const minY = Math.min(...rects.map(r => r.y)) - pad - 16 + yOff;
    const maxX = Math.max(...rects.map(r => r.x + r.width)) + pad;
    const maxY = Math.max(...rects.map(r => r.y + r.height)) + pad + yOff;
    const bx = rhu(minX), by = rhu(minY), bw = rhu(maxX - minX), bh = rhu(maxY - minY);
    elements.push(p.path(`M ${bx} ${by} h ${bw} v ${bh} h ${-bw} Z`, palette.textMuted, 1.3, { dash: '7 5' }));
    elements.push(p.text(bnd.label, rhu(minX + 10), rhu(minY + 16), font, palette.textMuted, { weight: 'bold' }));
  }

  // ── Relationships ──────────────────────────────────────────────────────────
  const allBoxes = [...laid.boxes.values()];
  for (const r of ir.rels) {
    const a = laid.boxes.get(r.from), b = laid.boxes.get(r.to);
    if (!a || !b) continue;
    const ao = { ...a, y: a.y + yOff }, bo = { ...b, y: b.y + yOff };
    const ac = { x: ao.x + ao.width / 2, y: ao.y + ao.height / 2 };
    const bc = { x: bo.x + bo.width / 2, y: bo.y + bo.height / 2 };
    const pa = borderPoint(ao, bc.x, bc.y);
    const pb = borderPoint(bo, ac.x, ac.y);
    const { path, labelMidpoint } = routeEdge(a, b, allBoxes, yOff);
    elements.push(p.path(path, palette.textMuted, 1.4, { ...(r.ext ? { dash: '6 4' } : {}), markerEnd: ARROW_ID }));
    const mx = labelMidpoint.x, my = labelMidpoint.y;
    const lbl = r.tech ? `${r.label ?? ''} [${r.tech}]` : (r.label ?? '');
    if (lbl) {
      const w = measureText(lbl, font).width + 8;
      elements.push(p.rect({ x: rhu(mx - w / 2), y: rhu(my - font), width: rhu(w), height: font + 4 }, palette.background, palette.background, 0));
      elements.push(p.text(lbl, rhuInt(mx), rhu(my - 1), font, palette.textMuted, { anchor: 'middle' }));
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────
  for (const n of ir.nodes) {
    const box = laid.boxes.get(n.id)!;
    const pr = prep.get(n.id)!;
    const x = box.x, y = box.y + yOff, w = NODE_W, h = box.height;
    const fill = isExt(n.kind) ? palette.surface : (isPerson(n.kind) ? palette.secondary : palette.primary);
    const txt = isExt(n.kind) ? palette.text : '#FFFFFF';
    const rx = isPerson(n.kind) ? 16 : 6;
    elements.push(p.rect({ x: rhu(x), y: rhu(y), width: w, height: rhu(h) }, fill, isExt(n.kind) ? palette.textMuted : fill, isExt(n.kind) ? 1.4 : 0, { rx }));
    let ty = y + 16;
    for (const ln of pr.labelLines) { elements.push(p.text(ln, rhuInt(x + w / 2), rhu(ty), typography.baseFontSize, txt, { weight: 'bold', anchor: 'middle' })); ty += rhuInt(typography.baseFontSize * 1.25); }
    elements.push(p.text(`[${n.kind.replace('_', ' ')}]`, rhuInt(x + w / 2), rhu(ty), font, isExt(n.kind) ? palette.textMuted : '#FFFFFF', { anchor: 'middle' }));
    ty += rhuInt(font * 1.3) + 2;
    for (const ln of pr.descrLines) { elements.push(p.text(ln, rhuInt(x + w / 2), rhu(ty), font, isExt(n.kind) ? palette.textMuted : '#FFFFFF', { anchor: 'middle', opacity: 0.9 })); ty += rhuInt(font * 1.3); }
  }

  const allRects: Rect[] = ir.nodes.map(n => { const b = laid.boxes.get(n.id)!; return { x: b.x, y: b.y + yOff, width: b.width, height: b.height }; });
  const totalW = rhuInt(Math.max(laid.width, ...allRects.map(r => r.x + r.width)) + margin + 24);
  const totalH = rhuInt(Math.max(...allRects.map(r => r.y + r.height)) + margin + 24);
  const defs = [`<marker id="${ARROW_ID}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill="${palette.textMuted}" /></marker>`];

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
    defs,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
