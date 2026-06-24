/**
 * @file diagrams/tree/layout.ts — Decorated tree layout.
 *
 * Sizes each node from its label/info, runs the shared tidy tree placement
 * (graph/tree), then renders nodes per their decoration kinds (circle / pill /
 * rect, with colour states, corner badges, info sub-lines) and links parents to
 * children with edge labels. Produces a node-anchor registry so trees are
 * linkable inside posters.
 */

import type { TreeDocument, TreeNode } from './ir.js';
import type {
  Scene, SceneElement, LayoutResult, NodeAnchorRegistry, ResolvedTheme, Color,
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { treeLayout, type TreeNodeInput } from '../../../graph/tree.js';
import { connectSlots } from '../../../graph/connect.js';
import { measureText } from '../../../text/metrics.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { rhu } from '../../../util/round.js';

const RED = '#d64545', BLACK = '#2b2b2b', SCAN = '#2f80ed', JOIN = '#9b51e0';

interface NodeStyle {
  readonly shape: 'circle' | 'pill' | 'rect' | 'strip';
  readonly fill: Color;
  readonly stroke: Color;
  readonly text: Color;
}

/** Split a `a | b | c` strip label into per-key cells with measured widths. */
function stripCells(label: string, font: number): { key: string; width: number }[] {
  return label.split('|').map(s => s.trim()).map(key => ({
    key, width: Math.max(measureText(key, font).width + 18, 34),
  }));
}

function nodeStyle(kinds: readonly string[], theme: ResolvedTheme): NodeStyle {
  const { palette } = theme;
  const has = (k: string): boolean => kinds.includes(k);
  const shape: NodeStyle['shape'] =
    has('strip') ? 'strip'
    : has('leaf') || has('pill') ? 'pill'
    : has('circle') || has('red') || has('black') || has('dot') ? 'circle'
    : 'rect';
  if (has('red'))    return { shape, fill: RED, stroke: RED, text: '#ffffff' };
  if (has('black'))  return { shape, fill: BLACK, stroke: BLACK, text: '#ffffff' };
  if (has('active') || has('primary')) return { shape, fill: palette.primary, stroke: palette.primary, text: '#ffffff' };
  if (has('scan'))   return { shape, fill: palette.surface, stroke: SCAN, text: palette.text };
  if (has('join'))   return { shape, fill: palette.surface, stroke: JOIN, text: palette.text };
  if (has('build') || has('muted')) return { shape, fill: palette.surface, stroke: palette.textMuted, text: palette.text };
  return { shape, fill: palette.surface, stroke: palette.primary, text: palette.text };
}

/** Build the muted info sub-line from a node's parsed attributes. */
function infoLine(node: TreeNode): string | undefined {
  return node.info;
}

function badgeColor(badge: string, theme: ResolvedTheme): Color {
  const n = Number(badge);
  if (!Number.isNaN(n)) {
    if (n === 0) return theme.palette.success;
    if (Math.abs(n) === 1) return theme.palette.primary;
    return theme.palette.error;
  }
  return theme.palette.primary;
}

export function layoutTree(ir: TreeDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;

  if (ir.nodes.length === 0) {
    const scene: Scene = { viewBox: { x: 0, y: 0, width: 120, height: 80 }, background: palette.background, elements: [] };
    return { scene, anchors: {} };
  }

  // ─── Size every node from its content ───
  const style = new Map<string, NodeStyle>();
  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of ir.nodes) {
    const st = nodeStyle(node.kinds, theme);
    style.set(node.id, st);
    const info = infoLine(node);
    const labelW = measureText(node.label, font).width;
    const infoW = info ? measureText(info, smallFont).width : 0;
    const contentW = Math.max(labelW, infoW);
    if (st.shape === 'strip') {
      const width = stripCells(node.label, font).reduce((s, c) => s + c.width, 0);
      sizes.set(node.id, { width, height: font + 16 });
    } else if (st.shape === 'circle') {
      const side = Math.max(contentW + 18, font + 22, 42);
      sizes.set(node.id, { width: side, height: side });
    } else {
      const width = contentW + 28;
      const height = (info ? font + smallFont + 8 : font + 16);
      sizes.set(node.id, { width, height });
    }
  }

  const inputs: TreeNodeInput[] = ir.nodes.map(n => ({
    id: n.id, width: sizes.get(n.id)!.width, height: sizes.get(n.id)!.height, children: n.children,
  }));
  const placed = treeLayout(inputs, { direction: ir.direction, levelGap: 52, siblingGap: 28, margin });

  const titleH = ir.metadata['title'] ? typography.titleFontSize + 18 : 0;
  const box = (id: string) => {
    const b = placed.boxes.get(id)!;
    return { x: b.x, y: b.y + titleH, width: b.width, height: b.height };
  };

  const elements: SceneElement[] = [];
  if (titleH > 0) {
    elements.push(p.text(String(ir.metadata['title']), placed.width / 2, margin + typography.titleFontSize,
      typography.titleFontSize, palette.text, { anchor: 'middle', weight: 'bold' }));
  }

  // ─── Edges first (parent → child), so nodes draw over them ───
  const byId = new Map(ir.nodes.map(n => [n.id, n]));
  for (const node of ir.nodes) {
    const pb = box(node.id);
    for (const cid of node.children) {
      const cb = box(cid);
      const { start, end } = connectSlots(pb, cb);
      elements.push(p.path(`M ${rhu(start.x)} ${rhu(start.y)} L ${rhu(end.x)} ${rhu(end.y)}`, palette.textMuted, 1.5));
      const child = byId.get(cid)!;
      if (child.edgeLabel) {
        const mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2;
        const w = measureText(child.edgeLabel, smallFont).width + 8;
        elements.push(p.rect({ x: mx - w / 2, y: my - 9, width: w, height: 16 }, palette.background, palette.background, 0, { rx: 3 }));
        elements.push(p.text(child.edgeLabel, mx, my + 3, smallFont, palette.primary, { anchor: 'middle', weight: 'bold' }));
      }
    }
  }

  // ─── Nodes ───
  for (const node of ir.nodes) {
    const b = box(node.id);
    const st = style.get(node.id)!;
    const info = infoLine(node);
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;

    if (st.shape === 'strip') {
      elements.push(p.rect(b, st.fill, st.stroke, 2, { rx: 4 }));
      let sx = b.x;
      stripCells(node.label, font).forEach((cell, idx) => {
        if (idx > 0) elements.push(p.path(`M ${rhu(sx)} ${rhu(b.y)} L ${rhu(sx)} ${rhu(b.y + b.height)}`, st.stroke, 1));
        elements.push(p.text(cell.key, rhu(sx + cell.width / 2), rhu(b.y + b.height / 2 + font * 0.35), font, st.text, { anchor: 'middle', weight: 'bold' }));
        sx += cell.width;
      });
    } else if (st.shape === 'circle') {
      elements.push(p.circle({ x: cx, y: cy }, b.width / 2, st.fill, st.stroke, 2));
    } else {
      const rx = st.shape === 'pill' ? b.height / 2 : 8;
      elements.push(p.rect(b, st.fill, st.stroke, 2, { rx }));
    }

    if (st.shape !== 'strip') {
      if (info) {
        elements.push(p.text(node.label, cx, b.y + font + 4, font, st.text, { anchor: 'middle', weight: 'bold' }));
        elements.push(p.text(info, cx, b.y + font + smallFont + 6, smallFont, st.fill === palette.surface ? palette.textMuted : '#ffffff', { anchor: 'middle' }));
      } else {
        elements.push(p.text(node.label, cx, cy + font * 0.35, font, st.text, { anchor: 'middle', weight: 'bold' }));
      }
    }

    if (node.badge !== undefined) {
      const bc = badgeColor(node.badge, theme);
      elements.push(p.circle({ x: b.x + b.width - 3, y: b.y + 3 }, 9, palette.background, bc, 1.5));
      elements.push(p.text(node.badge, b.x + b.width - 3, b.y + 7, smallFont, bc, { anchor: 'middle', weight: 'bold' }));
    }
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  for (const node of ir.nodes) anchors[node.id] = { bounds: box(node.id) };

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: placed.width, height: placed.height + titleH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: anchors as NodeAnchorRegistry };
}
