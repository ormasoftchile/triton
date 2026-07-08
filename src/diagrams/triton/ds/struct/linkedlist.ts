/**
 * @file diagrams/struct/linkedlist.ts — Singly linked list (slot + pointer).
 *
 * Value-driven:
 *   linkedlist 3 7 9          // head -> [3|·] -> [7|·] -> [9|/] (null)
 *   linkedlist
 *     title queue
 *     3 7 9
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';
import { ARROW_ID, arrowDef, lines, tokenizeDirective } from './shared.js';

interface ListDoc {
  title?: string;
  values: string[];
}

function parse(input: string): ListDoc {
  let title: string | undefined;
  const values: string[] = [];
  for (const line of lines(input)) {
    const t = tokenizeDirective(line);
    if (t[0] === 'linkedlist') { values.push(...t.slice(1)); continue; }
    if (t[0] === 'title') { title = t.slice(1).join(' '); continue; }
    if (t[0] === 'values' || t[0] === 'nodes') { values.push(...t.slice(1)); continue; }
    values.push(...t);
  }
  return { ...(title !== undefined ? { title } : {}), values };
}

export function layoutList(doc: ListDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const nh = 40, nw = 26, gap = 46;

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const y = margin + titleH;

  const headW = measureText('head', font).width;
  const startX = margin + headW + 38;

  const nodes: { x: number; vw: number; value: string }[] = [];
  let cursor = startX;
  for (const v of doc.values) {
    const vw = Math.max(measureText(v, font).width + 18, 30);
    nodes.push({ x: cursor, vw, value: v });
    cursor += vw + nw + gap;
  }

  const elements: SceneElement[] = [];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // head
  elements.push(p.text('head', margin, y + nh / 2 + font * 0.35, font, palette.textMuted, { weight: 'bold' }));
  if (nodes.length > 0) {
    elements.push(p.path(`M ${rhu(margin + headW + 6)} ${rhu(y + nh / 2)} L ${rhu(nodes[0]!.x - 4)} ${rhu(y + nh / 2)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));
  }

  nodes.forEach((node, i) => {
    const nextX = node.x + node.vw;
    elements.push(p.rect({ x: node.x, y, width: node.vw, height: nh }, palette.surface, palette.border, 1.5, { rx: 4 }));
    elements.push(p.rect({ x: nextX, y, width: nw, height: nh }, '#f1f3f5', palette.border, 1.5, { rx: 4 }));
    elements.push(p.path(`M ${rhu(nextX)} ${rhu(y)} L ${rhu(nextX)} ${rhu(y + nh)}`, palette.border, 1.5));
    elements.push(p.text(node.value, rhu(node.x + node.vw / 2), rhu(y + nh / 2 + font * 0.35), font, palette.text, { anchor: 'middle', weight: 'bold' }));

    const linkCx = nextX + nw / 2, linkCy = y + nh / 2;
    if (i < nodes.length - 1) {
      elements.push(p.circle({ x: linkCx, y: linkCy }, 3, palette.primary, palette.primary, 1));
      elements.push(p.path(`M ${rhu(linkCx)} ${rhu(linkCy)} L ${rhu(nodes[i + 1]!.x - 4)} ${rhu(linkCy)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));
    } else {
      // null slash through the next cell
      elements.push(p.path(`M ${rhu(nextX)} ${rhu(y + nh)} L ${rhu(nextX + nw)} ${rhu(y)}`, palette.textMuted, 1.5));
    }
  });

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  nodes.forEach((node, i) => { anchors[`n${i}`] = { bounds: { x: node.x, y, width: node.vw + nw, height: nh } }; });

  const width = (nodes.length > 0 ? cursor - gap : startX) + margin;
  const scene: Scene = {
    viewBox: { x: 0, y: 0, width, height: y + nh + margin },
    background: palette.background,
    elements,
    defs: [arrowDef(palette.primary)],
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const linkedlist: DiagramModule<ListDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutList(ir, theme);
  },
};
