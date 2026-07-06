/**
 * @file diagrams/sankey/layout.ts — Sankey flow diagram.
 *
 * Nodes are assigned to columns by longest-path depth; node height is
 * proportional to its larger of in/out flow. Links render as filled bezier
 * ribbons whose width encodes value, coloured by source. Deterministic.
 */

import type { SankeyDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { measureText } from '../../../text/metrics.js';
import { rhu, rhuInt } from '../../../util/round.js';

export function layoutSankey(ir: SankeyDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  // ── Nodes + layering ───────────────────────────────────────────────────────
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (n: string) => { if (!seen.has(n)) { seen.add(n); order.push(n); } };
  for (const l of ir.links) { add(l.source); add(l.target); }

  const layer = new Map(order.map(n => [n, 0]));
  for (let pass = 0; pass < order.length; pass++) {
    let changed = false;
    for (const l of ir.links) {
      const want = layer.get(l.source)! + 1;
      if (layer.get(l.target)! < want) { layer.set(l.target, want); changed = true; }
    }
    if (!changed) break;
  }
  const maxLayer = Math.max(0, ...order.map(n => layer.get(n)!));

  const sumOut = new Map<string, number>();
  const sumIn  = new Map<string, number>();
  for (const l of ir.links) {
    sumOut.set(l.source, (sumOut.get(l.source) ?? 0) + l.value);
    sumIn.set(l.target, (sumIn.get(l.target) ?? 0) + l.value);
  }
  const nodeValue = (n: string): number => Math.max(sumOut.get(n) ?? 0, sumIn.get(n) ?? 0);

  // Group by layer (insertion order within layer).
  const byLayer: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of order) byLayer[layer.get(n)!]!.push(n);
  const colSum = byLayer.map(col => col.reduce((s, n) => s + nodeValue(n), 0));
  const maxColSum = Math.max(1, ...colSum);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 16 : 0;
  const plotH  = 480;
  const nodeW  = 18;
  const colGap = 220;
  const nodeGap = 14;
  const unit = (plotH - 0) / maxColSum;
  const plotLeft = margin + 4;
  const plotTop  = margin + titleH + 6;
  const colX = (li: number): number => plotLeft + li * (nodeW + colGap);

  // Node rects + per-node running offsets.
  interface NodeBox { x: number; y: number; h: number; }
  const boxes = new Map<string, NodeBox>();
  byLayer.forEach((col, li) => {
    const totalH = col.reduce((s, n) => s + nodeValue(n) * unit, 0) + (col.length - 1) * nodeGap;
    let y = plotTop + (plotH - totalH) / 2;
    for (const n of col) {
      const h = Math.max(2, nodeValue(n) * unit);
      boxes.set(n, { x: colX(li), y, h });
      y += h + nodeGap;
    }
  });

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Link ribbons (under nodes) ─────────────────────────────────────────────
  const outOff = new Map<string, number>();
  const inOff  = new Map<string, number>();
  const hueOf  = new Map(order.map((n, i) => [n, categoricalHue(i)]));
  for (const l of ir.links) {
    const sb = boxes.get(l.source)!, tb = boxes.get(l.target)!;
    const lh = Math.max(1, l.value * unit);
    const so = outOff.get(l.source) ?? 0; outOff.set(l.source, so + lh);
    const io = inOff.get(l.target) ?? 0; inOff.set(l.target, io + lh);
    const sx = sb.x + nodeW, tx = tb.x;
    const sy0 = sb.y + so, sy1 = sy0 + lh;
    const ty0 = tb.y + io, ty1 = ty0 + lh;
    const mx = (sx + tx) / 2;
    const d = `M ${rhu(sx)} ${rhu(sy0)} C ${rhu(mx)} ${rhu(sy0)}, ${rhu(mx)} ${rhu(ty0)}, ${rhu(tx)} ${rhu(ty0)} `
            + `L ${rhu(tx)} ${rhu(ty1)} C ${rhu(mx)} ${rhu(ty1)}, ${rhu(mx)} ${rhu(sy1)}, ${rhu(sx)} ${rhu(sy1)} Z`;
    elements.push(p.path(d, 'none', 0, { fill: hueOf.get(l.source)!, opacity: 0.4 }));
  }

  // ── Node bars + labels ─────────────────────────────────────────────────────
  byLayer.forEach((col, li) => {
    const lastCol = li === maxLayer;
    for (const n of col) {
      const b = boxes.get(n)!;
      elements.push(p.rect({ x: rhu(b.x), y: rhu(b.y), width: nodeW, height: rhu(b.h) }, hueOf.get(n)!, hueOf.get(n)!, 0, { rx: 2 }));
      const ly = rhu(b.y + b.h / 2 + typography.smallFontSize * 0.35);
      if (lastCol) elements.push(p.text(n, rhu(b.x - 6), ly, typography.smallFontSize, palette.text, { anchor: 'end' }));
      else         elements.push(p.text(n, rhu(b.x + nodeW + 6), ly, typography.smallFontSize, palette.text));
    }
  });

  // Width: account for the last column's left-anchored labels and others' right labels.
  const lastLabelW = Math.max(0, ...byLayer[maxLayer]!.map(n => measureText(n, typography.smallFontSize).width));
  const otherLabelW = 140;
  const totalW = rhuInt(colX(maxLayer) + nodeW + (maxLayer === 0 ? otherLabelW : Math.max(otherLabelW, 0)) + margin);
  const totalH = rhuInt(plotTop + plotH + margin);
  void lastLabelW;

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
