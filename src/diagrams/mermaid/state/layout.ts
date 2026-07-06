/**
 * @file diagrams/state/layout.ts — UML state machine.
 *
 * States place via the shared layered kernel; transitions draw as arrows
 * clipped to node borders with optional labels. Pseudo-states render specially:
 * start (filled dot), end (ringed dot), choice (diamond).
 */

import type { StateDocument, StateNode } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { measureText } from '../../../text/metrics.js';
import { layeredLayout, routeEdge, type GraphNode, type GraphEdge } from '../../../graph/layered.js';
import { borderPoint } from '../../../graph/connect.js';
import { rhu, rhuInt } from '../../../util/round.js';

const ARROW_ID = 'state-arrow';

export function layoutState(ir: StateDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;

  const sizeOf = (s: StateNode): { w: number; h: number } => {
    if (s.kind === 'start' || s.kind === 'end') return { w: 22, h: 22 };
    if (s.kind === 'choice') return { w: 34, h: 34 };
    return { w: Math.max(76, measureText(s.label, font).width + 28), h: 38 };
  };
  const sizes = new Map(ir.states.map(s => [s.id, sizeOf(s)]));

  const nodes: GraphNode[] = ir.states.map(s => ({ id: s.id, width: sizes.get(s.id)!.w, height: sizes.get(s.id)!.h }));
  const edges: GraphEdge[] = ir.transitions.map(t => ({ from: t.from, to: t.to }));
  const laid = layeredLayout(nodes, edges, { direction: 'TB', layerGap: 56, nodeGap: 40, margin });

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Composite containers (bounding boxes around members) ──────────────────
  const composites = ir.composites ?? [];
  const containerRect = new Map<string, { x: number; y: number; width: number; height: number }>();
  const hidden = new Set<string>();      // composite node ids hidden in favour of their container
  for (const comp of composites) {
    const memberIdSet = new Set(comp.nodeIds);
    const rects = comp.nodeIds.map(id => laid.boxes.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
    if (rects.length === 0) continue;
    const pad = 16;
    let minX = Math.min(...rects.map(r => r.x)) - pad;
    let minY = Math.min(...rects.map(r => r.y)) - pad - 14 + yOff;
    let maxX = Math.max(...rects.map(r => r.x + r.width)) + pad;
    let maxY = Math.max(...rects.map(r => r.y + r.height)) + pad + yOff;

    // Clamp boundary so it does not encroach on non-member nodes that share the
    // same y-range. This prevents the container from overlapping sibling nodes.
    for (const [id, box] of laid.boxes) {
      if (memberIdSet.has(id) || hidden.has(id)) continue;
      const nmMinY = box.y;
      const nmMaxY = box.y + box.height;
      const rawMinY = Math.min(...rects.map(r => r.y)) - pad;
      const rawMaxY = Math.max(...rects.map(r => r.y + r.height)) + pad;
      // Skip if no y-overlap with the composite boundary range.
      if (nmMaxY <= rawMinY || nmMinY >= rawMaxY) continue;
      // Non-member overlaps in y — ensure the x boundary stays clear.
      const nmLeft = box.x, nmRight = box.x + box.width;
      const memberCentreX = (Math.min(...rects.map(r => r.x)) + Math.max(...rects.map(r => r.x + r.width))) / 2;
      if (nmLeft < maxX && nmRight > minX) {
        if (nmRight <= memberCentreX) {
          // Non-member is left of members — push our left boundary right.
          minX = Math.max(minX, nmRight + 4);
        } else {
          // Non-member is right of members — push our right boundary left.
          maxX = Math.min(maxX, nmLeft - 4);
        }
      }
    }

    const rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    containerRect.set(comp.id, rect);
    hidden.add(comp.id);
    elements.push(p.rect({ x: rhu(minX), y: rhu(minY), width: rhu(rect.width), height: rhu(rect.height) }, palette.surface, palette.primary, 1.4, { rx: 10, opacity: 0.5 }));
    elements.push(p.text(comp.label, rhu(minX + 12), rhu(minY + 16), typography.smallFontSize, palette.text, { weight: 'bold' }));
  }

  // Resolve a node's effective rect (container for composites, box otherwise).
  const rectFor = (id: string): { x: number; y: number; width: number; height: number } | undefined => {
    const c = containerRect.get(id);
    if (c) return c;
    const b = laid.boxes.get(id);
    return b ? { x: b.x, y: b.y + yOff, width: b.width, height: b.height } : undefined;
  };

  // ── Transitions ────────────────────────────────────────────────────────────
  const allBoxes = [...laid.boxes.values()];
  for (const t of ir.transitions) {
    const a = rectFor(t.from), b = rectFor(t.to);
    if (!a || !b) continue;
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const pa = borderPoint(a, bc.x, bc.y);
    const pb = borderPoint(b, ac.x, ac.y);
    // Use routed path for obstacle avoidance; fall back to straight for
    // composite-to-member transitions where one endpoint is inside a container.
    const fromBox = laid.boxes.get(t.from), toBox = laid.boxes.get(t.to);
    let edgePath: string;
    if (fromBox && toBox) {
      ({ path: edgePath } = routeEdge(fromBox, toBox, allBoxes, yOff));
    } else {
      edgePath = `M ${rhu(pa.x)} ${rhu(pa.y)} L ${rhu(pb.x)} ${rhu(pb.y)}`;
    }
    elements.push(p.path(edgePath, palette.textMuted, 1.4, { markerEnd: ARROW_ID }));
    if (t.label) {
      let mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      // Only shift label outside a composite boundary if exactly one endpoint
      // belongs to that composite (cross-boundary edge). Inner transitions
      // (both endpoints inside) keep their labels inside the boundary.
      for (const [compId, cr] of containerRect) {
        const comp = composites.find(c => c.id === compId);
        if (!comp) continue;
        const fromInside = comp.nodeIds.includes(t.from);
        const toInside   = comp.nodeIds.includes(t.to);
        if (fromInside && toInside) continue;   // inner: no shift needed
        if (!fromInside && !toInside) continue; // unrelated: no shift needed
        // Cross-boundary: shift label outside if midpoint landed inside.
        if (mx > cr.x && mx < cr.x + cr.width && my > cr.y && my < cr.y + cr.height) {
          my = cr.y - typography.smallFontSize - 4;
          break;
        }
      }
      const w = measureText(t.label, typography.smallFontSize).width + 8;
      elements.push(p.rect({ x: rhu(mx - w / 2), y: rhu(my - typography.smallFontSize), width: rhu(w), height: typography.smallFontSize + 4 }, palette.background, palette.background, 0));
      elements.push(p.text(t.label, rhuInt(mx), rhu(my - 1), typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────
  for (const s of ir.states) {
    if (hidden.has(s.id)) continue;
    const box = laid.boxes.get(s.id)!;
    const x = box.x, y = box.y + yOff;
    const cx = x + box.width / 2, cy = y + box.height / 2;
    if (s.kind === 'start') {
      elements.push(p.circle({ x: rhu(cx), y: rhu(cy), }, 8, palette.text, palette.text, 0));
    } else if (s.kind === 'end') {
      elements.push(p.circle({ x: rhu(cx), y: rhu(cy) }, 10, 'none', palette.text, 1.5));
      elements.push(p.circle({ x: rhu(cx), y: rhu(cy) }, 5, palette.text, palette.text, 0));
    } else if (s.kind === 'choice') {
      const r = box.width / 2;
      elements.push(p.path(`M ${rhu(cx)} ${rhu(cy - r)} L ${rhu(cx + r)} ${rhu(cy)} L ${rhu(cx)} ${rhu(cy + r)} L ${rhu(cx - r)} ${rhu(cy)} Z`, palette.border, 1.4, { fill: palette.surface }));
    } else {
      elements.push(p.rect({ x: rhu(x), y: rhu(y), width: rhu(box.width), height: rhu(box.height) }, palette.surface, palette.primary, 1.4, { rx: 10 }));
      elements.push(p.text(s.label, rhuInt(cx), rhu(cy + font * 0.35), font, palette.text, { anchor: 'middle', weight: 'bold' }));
    }
  }

  const totalW = rhuInt(laid.width + margin);
  const totalH = rhuInt(laid.height + yOff + margin);
  const defs = [`<marker id="${ARROW_ID}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill="${palette.textMuted}" /></marker>`];

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
    defs,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
