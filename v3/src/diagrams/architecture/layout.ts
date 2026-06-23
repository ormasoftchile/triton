/**
 * @file diagrams/architecture/layout.ts — Cloud architecture diagram.
 *
 * Services place via the shared layered kernel; group boxes wrap their members;
 * edges connect side-anchored ports (L/R/T/B) with an orthogonal connector.
 */

import type { ArchitectureDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult, Rect } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { categoricalHue } from '../../palette/categorical.js';
import { measureText } from '../../text/metrics.js';
import { layeredLayout, type GraphNode, type GraphEdge } from '../../graph/layered.js';
import { rhu, rhuInt } from '../../util/round.js';

const ARROW_ID = 'arch-arrow';

function port(r: Rect, side: string): { x: number; y: number } {
  switch (side.toUpperCase()) {
    case 'L': return { x: r.x, y: r.y + r.height / 2 };
    case 'R': return { x: r.x + r.width, y: r.y + r.height / 2 };
    case 'T': return { x: r.x + r.width / 2, y: r.y };
    default:  return { x: r.x + r.width / 2, y: r.y + r.height };
  }
}

export function layoutArchitecture(ir: ArchitectureDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;

  const svcW = 130, svcH = 56;
  const nodes: GraphNode[] = ir.services.map(s => ({ id: s.id, width: svcW, height: svcH }));
  const edges: GraphEdge[] = ir.edges.map(e => ({ from: e.from, to: e.to }));
  const laid = layeredLayout(nodes, edges, { direction: 'LR', layerGap: 90, nodeGap: 44, margin: margin + 26 });

  const titleH = ir.metadata.title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;
  const rectOf = (id: string): Rect | undefined => { const b = laid.boxes.get(id); return b ? { x: b.x, y: b.y + yOff, width: b.width, height: b.height } : undefined; };

  const elements: SceneElement[] = [];
  if (ir.metadata.title) elements.push(p.text(ir.metadata.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Group boxes ────────────────────────────────────────────────────────────
  ir.groups.forEach((g, gi) => {
    const members = ir.services.filter(s => s.group === g.id).map(s => rectOf(s.id)).filter((r): r is Rect => !!r);
    if (members.length === 0) return;
    const pad = 20;
    const minX = Math.min(...members.map(r => r.x)) - pad;
    const minY = Math.min(...members.map(r => r.y)) - pad - 14;
    const maxX = Math.max(...members.map(r => r.x + r.width)) + pad;
    const maxY = Math.max(...members.map(r => r.y + r.height)) + pad;
    const hue = categoricalHue(gi);
    elements.push(p.rect({ x: rhu(minX), y: rhu(minY), width: rhu(maxX - minX), height: rhu(maxY - minY) }, hue + '14', hue, 1.4, { rx: 10 }));
    elements.push(p.text(g.label, rhu(minX + 12), rhu(minY + 16), typography.smallFontSize, hue, { weight: 'bold' }));
  });

  // ── Edges (side-anchored) ──────────────────────────────────────────────────
  for (const e of ir.edges) {
    const a = rectOf(e.from), b = rectOf(e.to);
    if (!a || !b) continue;
    const pa = port(a, e.fromSide), pb = port(b, e.toSide);
    const horiz = e.fromSide.toUpperCase() === 'L' || e.fromSide.toUpperCase() === 'R';
    const mid = horiz ? `L ${rhu((pa.x + pb.x) / 2)} ${rhu(pa.y)} L ${rhu((pa.x + pb.x) / 2)} ${rhu(pb.y)}` : `L ${rhu(pa.x)} ${rhu((pa.y + pb.y) / 2)} L ${rhu(pb.x)} ${rhu((pa.y + pb.y) / 2)}`;
    elements.push(p.path(`M ${rhu(pa.x)} ${rhu(pa.y)} ${mid} L ${rhu(pb.x)} ${rhu(pb.y)}`, palette.primary, 1.6, { markerEnd: ARROW_ID }));
  }

  // ── Service nodes ──────────────────────────────────────────────────────────
  ir.services.forEach((s, i) => {
    const r = rectOf(s.id)!;
    const hue = categoricalHue(i);
    elements.push(p.rect({ x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: rhu(r.height) }, palette.surface, palette.border, 1.4, { rx: 8 }));
    elements.push(p.rect({ x: rhu(r.x), y: rhu(r.y), width: rhu(r.width), height: 8 }, hue, hue, 0, { rx: 4 }));
    elements.push(p.text(s.label, rhuInt(r.x + r.width / 2), rhu(r.y + r.height / 2 + 6 + font * 0.35), font, palette.text, { weight: 'bold', anchor: 'middle' }));
    elements.push(p.text(s.icon, rhuInt(r.x + r.width / 2), rhu(r.y + r.height - 6), typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
  });

  const allR = ir.services.map(s => rectOf(s.id)!);
  const totalW = rhuInt(Math.max(...allR.map(r => r.x + r.width)) + margin + 26);
  const totalH = rhuInt(Math.max(...allR.map(r => r.y + r.height)) + margin + 26);
  const defs = [`<marker id="${ARROW_ID}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill="${palette.primary}" /></marker>`];

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
    defs,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
