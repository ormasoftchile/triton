/**
 * @file diagrams/requirement/layout.ts — SysML-style requirement diagram.
 *
 * Requirement / element nodes render as titled boxes («kind» + name + fields);
 * placement uses the shared layered kernel. Relationships draw as dashed
 * connectors with the relationship type as the edge label.
 */

import type { RequirementDocument, ReqNode } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { measureText } from '../../text/metrics.js';
import { wrapText } from '../../text/wrap.js';
import { layeredLayout, type GraphNode, type GraphEdge } from '../../graph/layered.js';
import { borderPoint } from '../../graph/connect.js';
import { rhu, rhuInt } from '../../util/round.js';

const ARROW_ID = 'req-arrow';
const BOX_W = 230;

export function layoutRequirement(ir: RequirementDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const nameFont = typography.baseFontSize;
  const fieldFont = typography.smallFontSize;
  const lineH = rhuInt(fieldFont * 1.5);

  // Pre-wrap fields and size boxes.
  const prepared = new Map<string, { lines: string[]; h: number }>();
  const sizeOf = (n: ReqNode): { w: number; h: number } => {
    const lines: string[] = [];
    for (const f of n.fields) {
      const wrapped = wrapText(`${f.key}: ${f.value}`, fieldFont, BOX_W - 20, 3).lines;
      lines.push(...wrapped);
    }
    const headH = rhuInt(nameFont * 1.5) + fieldFont + 8;
    const h = headH + lines.length * lineH + 8;
    prepared.set(n.id, { lines, h });
    return { w: BOX_W, h };
  };
  const sizes = new Map(ir.nodes.map(n => [n.id, sizeOf(n)]));

  const nodes: GraphNode[] = ir.nodes.map(n => ({ id: n.id, width: BOX_W, height: sizes.get(n.id)!.h }));
  const edges: GraphEdge[] = ir.relations.map(r => ({ from: r.from, to: r.to }));
  const laid = layeredLayout(nodes, edges, { direction: 'TB', layerGap: 60, nodeGap: 44, margin });

  const elements: SceneElement[] = [];

  // ── Relationships ──────────────────────────────────────────────────────────
  for (const r of ir.relations) {
    const a = laid.boxes.get(r.from), b = laid.boxes.get(r.to);
    if (!a || !b) continue;
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const pa = borderPoint(a, bc.x, bc.y);
    const pb = borderPoint(b, ac.x, ac.y);
    elements.push(p.path(`M ${rhu(pa.x)} ${rhu(pa.y)} L ${rhu(pb.x)} ${rhu(pb.y)}`, palette.textMuted, 1.3, { dash: '6 4', markerEnd: ARROW_ID }));
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    const w = measureText(`«${r.type}»`, fieldFont).width + 8;
    elements.push(p.rect({ x: rhu(mx - w / 2), y: rhu(my - fieldFont), width: rhu(w), height: fieldFont + 4 }, palette.background, palette.background, 0));
    elements.push(p.text(`«${r.type}»`, rhuInt(mx), rhu(my - 1), fieldFont, palette.secondary, { anchor: 'middle' }));
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────
  for (const n of ir.nodes) {
    const box = laid.boxes.get(n.id)!;
    const prep = prepared.get(n.id)!;
    const { x, y } = box;
    const headH = rhuInt(nameFont * 1.5) + fieldFont + 8;
    elements.push(p.rect({ x: rhu(x), y: rhu(y), width: BOX_W, height: rhu(box.height) }, palette.surface, palette.primary, 1.4, { rx: 6 }));
    elements.push(p.text(`«${n.kind}»`, rhuInt(x + BOX_W / 2), rhu(y + fieldFont + 4), fieldFont, palette.textMuted, { anchor: 'middle' }));
    elements.push(p.text(n.id, rhuInt(x + BOX_W / 2), rhu(y + fieldFont + 6 + nameFont), nameFont, palette.text, { weight: 'bold', anchor: 'middle' }));
    elements.push(p.path(`M ${rhu(x)} ${rhu(y + headH)} L ${rhu(x + BOX_W)} ${rhu(y + headH)}`, palette.border, 1));
    let fy = y + headH + lineH - 3;
    for (const ln of prep.lines) { elements.push(p.text(ln, rhu(x + 10), rhu(fy), fieldFont, palette.text)); fy += lineH; }
  }

  const defs = [`<marker id="${ARROW_ID}" markerWidth="11" markerHeight="9" refX="9" refY="4.5" orient="auto"><polyline points="0 0, 10 4.5, 0 9" fill="none" stroke="${palette.textMuted}" stroke-width="1.3" /></marker>`];

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: rhuInt(laid.width + margin), height: rhuInt(laid.height + margin) },
    background: palette.background,
    elements,
    defs,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
