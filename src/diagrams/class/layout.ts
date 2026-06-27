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
import { layeredLayout, routeEdge, type GraphNode, type GraphEdge, type NodeBox } from '../../graph/layered.js';
import { borderPoint } from '../../graph/connect.js';
import { rhu, rhuInt } from '../../util/round.js';

// ── Port-assignment helpers (module-level) ─────────────────────────────────

type Wall = 'top' | 'bottom' | 'left' | 'right';

const MIN_PORT_GAP = 32;
const WALL_MARGIN  = 16;

/**
 * Cascade algorithm: given N ideal positions (pre-sorted ascending) in [lo, hi],
 * return N positions that respect minGap while staying as close to ideals as possible.
 * Falls back to even distribution when the required span exceeds the available space.
 */
function cascadePorts(ideals: number[], lo: number, hi: number, minGap: number): number[] {
  const n = ideals.length;
  if (n === 0) return [];
  if (n === 1) return [Math.max(lo, Math.min(hi, ideals[0]!))];
  if ((n - 1) * minGap > hi - lo) {
    const step = (hi - lo) / (n + 1);
    return Array.from({ length: n }, (_, i) => lo + step * (i + 1));
  }
  const pos = ideals.map(v => Math.max(lo, Math.min(hi, v)));
  for (let iter = 0; iter < 5; iter++) {
    let changed = false;
    for (let i = 1; i < n; i++) {
      const minI = pos[i - 1]! + minGap;
      if (pos[i]! < minI) { pos[i] = minI; changed = true; }
    }
    for (let i = n - 1; i >= 0; i--) {
      const maxI = i === n - 1 ? hi : pos[i + 1]! - minGap;
      if (pos[i]! > maxI) { pos[i] = maxI; changed = true; }
    }
    if (pos[0]! < lo) { pos[0] = lo; changed = true; }
    if (!changed) break;
  }
  return pos;
}

/**
 * Compute port points for one (box, wall) group of edges.
 * Edges are sorted by their opposite-end node centre along the wall axis
 * (crossing-minimisation), then spread via cascade to enforce MIN_PORT_GAP.
 * Returns Map<relationIndex, {x,y}>.
 */
function assignGroupPorts(
  box: NodeBox,
  wall: Wall,
  group: Array<{ ri: number; sourceCenter: number }>,
  yOff: number,
): Map<number, { x: number; y: number }> {
  const result = new Map<number, { x: number; y: number }>();
  if (group.length === 0) return result;

  const sorted = [...group].sort((a, b) => a.sourceCenter - b.sourceCenter);

  let wallBase: number, wallLen: number, fixedCoord: number, isHorizontal: boolean;
  switch (wall) {
    case 'top':
      wallBase = box.x; wallLen = box.width; fixedCoord = box.y + yOff; isHorizontal = true; break;
    case 'bottom':
      wallBase = box.x; wallLen = box.width; fixedCoord = box.y + yOff + box.height; isHorizontal = true; break;
    case 'left':
      wallBase = box.y + yOff; wallLen = box.height; fixedCoord = box.x; isHorizontal = false; break;
    default: // 'right'
      wallBase = box.y + yOff; wallLen = box.height; fixedCoord = box.x + box.width; isHorizontal = false; break;
  }

  const lo = wallBase + WALL_MARGIN;
  const hi = wallBase + wallLen - WALL_MARGIN;
  const ideals = sorted.map(e => Math.max(lo, Math.min(hi, e.sourceCenter)));
  const positions = cascadePorts(ideals, lo, hi, MIN_PORT_GAP);

  for (let i = 0; i < sorted.length; i++) {
    const p = positions[i]!;
    result.set(sorted[i]!.ri, isHorizontal ? { x: p, y: fixedCoord } : { x: fixedCoord, y: p });
  }
  return result;
}

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
  const LAYER_GAP = 64;
  const laid = layeredLayout(nodes, edges, { direction: 'TB', layerGap: LAYER_GAP, nodeGap: 46, margin });

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 14 : 0;
  const yOff = titleH;

  const elements: SceneElement[] = [];
  if (title) elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Relationships (under boxes) ────────────────────────────────────────────
  const allBoxes = [...laid.boxes.values()];

  const approachWall = (from: NodeBox, to: NodeBox): Wall => {
    if (from.y + from.height <= to.y) return 'top';
    if (to.y + to.height     <= from.y) return 'bottom';
    const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
    const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
    if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'top' : 'bottom';
    return dx >= 0 ? 'left' : 'right';
  };

  const wallPoint = (box: NodeBox, wall: Wall, t: number, yOff_: number): { x: number; y: number } => {
    const bx = box.x, by = box.y + yOff_, bw = box.width, bh = box.height;
    switch (wall) {
      case 'top':    return { x: bx + t * bw, y: by };
      case 'bottom': return { x: bx + t * bw, y: by + bh };
      case 'left':   return { x: bx,           y: by + t * bh };
      case 'right':  return { x: bx + bw,      y: by + t * bh };
    }
  };

  // ── Port assignment: arrival ports (toPortMap2) ────────────────────────────
  // Group edges by (targetId, wall). Sort each group by source-center along the
  // wall axis → crossing-free order. Spread with cascade to enforce MIN_PORT_GAP.
  const toGroupAccum = new Map<string, Array<{ ri: number; sourceCenter: number }>>();
  for (let ri = 0; ri < ir.relations.length; ri++) {
    const r = ir.relations[ri]!;
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;
    const wall = approachWall(a, b);
    const key = `${b.id}:${wall}`;
    const sourceCenter = (wall === 'top' || wall === 'bottom')
      ? a.x + a.width / 2
      : a.y + a.height / 2 + yOff;
    if (!toGroupAccum.has(key)) toGroupAccum.set(key, []);
    toGroupAccum.get(key)!.push({ ri, sourceCenter });
  }
  const toPortMap2 = new Map<string, Map<number, { x: number; y: number }>>();
  for (const [key, group] of toGroupAccum) {
    const nodeId = key.split(':')[0]!;
    const wall = key.split(':')[1] as Wall;
    toPortMap2.set(key, assignGroupPorts(laid.boxes.get(nodeId)!, wall, group, yOff));
  }

  // ── Port assignment: departure ports (fromPortMap2) ────────────────────────
  // Departure wall of A toward B = approachWall(b, a). Sort by target-center.
  const fromGroupAccum = new Map<string, Array<{ ri: number; sourceCenter: number }>>();
  for (let ri = 0; ri < ir.relations.length; ri++) {
    const r = ir.relations[ri]!;
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;
    const wall = approachWall(b, a);
    const key = `${a.id}:${wall}`;
    const targetCenter = (wall === 'top' || wall === 'bottom')
      ? b.x + b.width / 2
      : b.y + b.height / 2 + yOff;
    if (!fromGroupAccum.has(key)) fromGroupAccum.set(key, []);
    fromGroupAccum.get(key)!.push({ ri, sourceCenter: targetCenter });
  }
  const fromPortMap2 = new Map<string, Map<number, { x: number; y: number }>>();
  for (const [key, group] of fromGroupAccum) {
    const nodeId = key.split(':')[0]!;
    const wall = key.split(':')[1] as Wall;
    fromPortMap2.set(key, assignGroupPorts(laid.boxes.get(nodeId)!, wall, group, yOff));
  }

  // Arrowhead direction: point just outside the wall in the edge's travel direction.
  const wallDir = (wall: Wall, pt: { x: number; y: number }): { x: number; y: number } => {
    switch (wall) {
      case 'top':    return { x: pt.x,     y: pt.y - 1 };
      case 'bottom': return { x: pt.x,     y: pt.y + 1 };
      case 'left':   return { x: pt.x - 1, y: pt.y     };
      case 'right':  return { x: pt.x + 1, y: pt.y     };
    }
  };

  for (let ri = 0; ri < ir.relations.length; ri++) {
    const r = ir.relations[ri]!;
    const a = laid.boxes.get(r.left), b = laid.boxes.get(r.right);
    if (!a || !b) continue;

    // Arrival port: cascade-assigned position on target wall.
    const toWall = approachWall(a, b);
    const toPt = toPortMap2.get(`${b.id}:${toWall}`)?.get(ri) ?? wallPoint(b, toWall, 0.5, yOff);

    // Departure port: cascade-assigned position on source wall, aimed at toPt.
    const fromWall = approachWall(b, a);
    const fromPt = fromPortMap2.get(`${a.id}:${fromWall}`)?.get(ri)
      ?? borderPoint({ ...a, y: a.y + yOff }, toPt.x, toPt.y);

    const bends = laid.edgeBends.get(ri);
    let safePath: string;
    let labelMid: { x: number; y: number };

    if (bends && bends.length > 0) {
      let laneX    = bends[0]!.x;
      const exitY  = bends[0]!.y + yOff;

      // Degenerate case: dummy landed in the same block chain as source/target,
      // collapsing the skip lane to the same x as both endpoints. The 5-segment
      // path would draw a straight vertical line through intermediate nodes.
      const LANE_DEGENERATE_THRESHOLD = 8;
      const laneIsDegenerate = Math.abs(laneX - fromPt.x) < LANE_DEGENERATE_THRESHOLD
                            && Math.abs(laneX - toPt.x)   < LANE_DEGENERATE_THRESHOLD;
      if (laneIsDegenerate) {
        // Collect boxes that sit strictly between source and target vertically.
        const minY = Math.min(fromPt.y, toPt.y);
        const maxY = Math.max(fromPt.y, toPt.y);
        const intermediateBoxes = allBoxes.filter(bx => {
          const boxTop    = bx.y + yOff;
          const boxBottom = bx.y + yOff + bx.height;
          return boxTop > minY && boxBottom < maxY;
        });
        if (intermediateBoxes.length > 0) {
          laneX = Math.max(...intermediateBoxes.map(bx => bx.x + bx.width)) + 16;
        }
        // else: no intermediate nodes — straight vertical is fine, keep fromPt.x
      }
      const entryY = toPt.y - LAYER_GAP / 2;
      safePath = [
        `M ${rhu(fromPt.x)} ${rhu(fromPt.y)}`,
        `L ${rhu(fromPt.x)} ${rhu(exitY)}`,
        `L ${rhu(laneX)}    ${rhu(exitY)}`,
        `L ${rhu(laneX)}    ${rhu(entryY)}`,
        `L ${rhu(toPt.x)}   ${rhu(entryY)}`,
        `L ${rhu(toPt.x)}   ${rhu(toPt.y)}`,
      ].join(' ');
      labelMid = { x: laneX, y: (exitY + entryY) / 2 };
    } else {
      const routed = routeEdge(a, b, allBoxes, yOff, fromPt, toPt, true);
      safePath = routed.path || `M ${fromPt.x} ${fromPt.y} L ${toPt.x} ${toPt.y}`;
      labelMid = routed.labelMidpoint;
    }
    elements.push(p.path(safePath, palette.textMuted, 1.3, r.dashed ? { dash: '6 4' } : {}));

    // Arrowhead direction from wall: axis-aligned, independent of path geometry.
    elements.push(...endMarker(p, fromPt, wallDir(fromWall, fromPt), r.leftHead, palette));
    elements.push(...endMarker(p, toPt,   wallDir(toWall,   toPt),   r.rightHead, palette));

    const mx = labelMid.x, my = labelMid.y;
    if (r.label) elements.push(p.text(r.label, rhuInt(mx), rhuInt(my - 4), memFont, palette.textMuted, { anchor: 'middle' }));
    const cardOffset = (wall: Wall, pt: { x: number; y: number }): { cx: number; cy: number } => {
      switch (wall) {
        case 'top':    return { cx: pt.x + 10, cy: pt.y - 10 };
        case 'bottom': return { cx: pt.x + 10, cy: pt.y + 10 };
        case 'left':   return { cx: pt.x - 10, cy: pt.y - 10 };
        default:       return { cx: pt.x + 10, cy: pt.y - 10 };
      }
    };
    if (r.leftCard)  { const o = cardOffset(fromWall, fromPt); elements.push(p.text(r.leftCard,  rhu(o.cx), rhu(o.cy), memFont, palette.textMuted)); }
    if (r.rightCard) { const o = cardOffset(toWall,   toPt);   elements.push(p.text(r.rightCard, rhu(o.cx), rhu(o.cy), memFont, palette.textMuted)); }
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
