/**
 * @file diagrams/mindmap/layout.ts — Right-growing tidy tree (mindmap).
 *
 * Depth maps to x (root at left), a post-order sweep assigns leaf rows and
 * centres parents on their children. Depth-1 branches take distinct categorical
 * hues that descendants inherit; curved connectors link parent→child.
 */

import type { MindmapDocument, MindNode } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { categoricalHue } from '../../palette/categorical.js';
import { measureText } from '../../text/metrics.js';
import { rhu, rhuInt } from '../../util/round.js';

interface Placed { label: string; depth: number; x: number; y: number; w: number; hue: string; children: Placed[]; }

export function layoutMindmap(ir: MindmapDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  if (!ir.root) {
    return { scene: { viewBox: { x: 0, y: 0, width: 100, height: 60 }, background: palette.background, elements: [] }, anchors: {} };
  }

  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;
  const rowGap   = 30;
  const levelGap = 70;
  const titleH   = ir.metadata.title ? typography.titleFontSize + 14 : 0;

  const fontFor = (d: number): number => (d === 0 ? typography.titleFontSize : d === 1 ? font : smallFont);
  const widthFor = (label: string, d: number): number => measureText(label, fontFor(d)) .width + (d === 0 ? 40 : 28);

  // Assign x by depth, y by post-order leaf sweep.
  let leafCursor = margin + titleH + 20;
  const place = (node: MindNode, depth: number, hue: string): Placed => {
    const kids = node.children.map((c, i) => place(c, depth + 1, depth === 0 ? categoricalHue(i) : hue));
    let y: number;
    if (kids.length === 0) { y = leafCursor; leafCursor += rowGap; }
    else { y = (kids[0]!.y + kids[kids.length - 1]!.y) / 2; }
    return { label: node.label, depth, x: 0, y, w: widthFor(node.label, depth), hue, children: kids };
  };
  const root = place(ir.root, 0, palette.primary);

  // Column x: per-depth max width + level gaps.
  const all = flat(root);
  const depthMax = maxDepth(root);
  const maxW: number[] = [];
  for (const n of all) maxW[n.depth] = Math.max(maxW[n.depth] ?? 0, n.w);
  const colStart: number[] = [margin];
  for (let d = 1; d <= depthMax; d++) colStart[d] = colStart[d - 1]! + (maxW[d - 1] ?? 0) + levelGap;
  for (const n of all) n.x = colStart[n.depth]!;

  const elements: SceneElement[] = [];
  if (ir.metadata.title) elements.push(p.text(ir.metadata.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Connectors (under nodes) ───────────────────────────────────────────────
  const drawEdges = (n: Placed): void => {
    for (const c of n.children) {
      const x1 = n.x + n.w, y1 = n.y, x2 = c.x, y2 = c.y;
      const mx = (x1 + x2) / 2;
      elements.push(p.path(`M ${rhu(x1)} ${rhu(y1)} C ${rhu(mx)} ${rhu(y1)}, ${rhu(mx)} ${rhu(y2)}, ${rhu(x2)} ${rhu(y2)}`, c.hue, 2));
      drawEdges(c);
    }
  };
  drawEdges(root);

  // ── Nodes ──────────────────────────────────────────────────────────────────
  const drawNode = (n: Placed): void => {
    const h = (n.depth === 0 ? 44 : n.depth === 1 ? 34 : 26);
    const cy = n.y;
    if (n.depth === 0) {
      elements.push(p.rect({ x: rhu(n.x), y: rhu(cy - h / 2), width: rhu(n.w), height: h }, palette.primary, palette.primary, 0, { rx: h / 2 }));
      elements.push(p.text(n.label, rhuInt(n.x + n.w / 2), rhu(cy + fontFor(0) * 0.35), fontFor(0), '#FFFFFF', { weight: 'bold', anchor: 'middle' }));
    } else if (n.depth === 1) {
      elements.push(p.rect({ x: rhu(n.x), y: rhu(cy - h / 2), width: rhu(n.w), height: h }, n.hue, n.hue, 0, { rx: 8 }));
      elements.push(p.text(n.label, rhuInt(n.x + n.w / 2), rhu(cy + font * 0.35), font, '#FFFFFF', { weight: 'bold', anchor: 'middle' }));
    } else {
      elements.push(p.rect({ x: rhu(n.x), y: rhu(cy - h / 2), width: rhu(n.w), height: h }, palette.surface, n.hue, 1.4, { rx: 6 }));
      elements.push(p.text(n.label, rhuInt(n.x + n.w / 2), rhu(cy + smallFont * 0.35), smallFont, palette.text, { anchor: 'middle' }));
    }
    for (const c of n.children) drawNode(c);
  };
  drawNode(root);

  const totalW = rhuInt(Math.max(...all.map(n => n.x + n.w)) + margin);
  const totalH = rhuInt(leafCursor + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}

function flat(n: Placed, acc: Placed[] = []): Placed[] { acc.push(n); for (const c of n.children) flat(c, acc); return acc; }
function maxDepth(n: Placed): number { return n.children.length ? Math.max(...n.children.map(maxDepth)) : n.depth; }
