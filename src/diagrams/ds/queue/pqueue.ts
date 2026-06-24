/**
 * @file diagrams/queue/pqueue.ts — Priority queue.
 *
 * A VERTICAL stack of cells ordered by priority (highest at the top). Each cell
 * is shaded by its priority — a deterministic tint of the theme's primary
 * accent (strongest at the top) — and shows its priority value on the right.
 *
 * Value-driven mini-syntax:
 *   pqueue
 *     title scheduler
 *     item Deploy 9
 *     item Build 5
 *     item Lint 2
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry, Color,
} from '../../../contracts/index.js';
import { pen } from '../../../scene/build.js';
import { buildStrip, type StripCell } from '../../../scene/strip.js';
import { measureText } from '../../../text/metrics.js';
import { lines } from './shared.js';

export interface PQItem {
  label: string;
  priority: number;
}

export interface PQueueDoc {
  title?: string;
  items: PQItem[];
}

function parse(input: string): PQueueDoc {
  let title: string | undefined;
  const items: PQItem[] = [];

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'pqueue') { continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'item') {
      // `item <label words...> <priority>` — trailing token is the priority.
      const rest = line.slice(4).trim();
      const m = rest.match(/^(.*?)\s+(-?\d+(?:\.\d+)?)\s*$/);
      if (m) items.push({ label: m[1]!.trim(), priority: Number(m[2]) });
      else if (rest) items.push({ label: rest, priority: 0 });
    }
  }
  return { ...(title !== undefined ? { title } : {}), items };
}

/** Parse `#rgb` / `#rrggbb` into [r,g,b], or null if not a hex colour. */
function parseHex(c: string): [number, number, number] | null {
  const s = c.trim();
  const m3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m3) return [parseInt(m3[1]! + m3[1]!, 16), parseInt(m3[2]! + m3[2]!, 16), parseInt(m3[3]! + m3[3]!, 16)];
  const m6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m6) return [parseInt(m6[1]!, 16), parseInt(m6[2]!, 16), parseInt(m6[3]!, 16)];
  return null;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/** Linear mix of two hex colours at t∈[0,1]; falls back to `a` if non-hex. */
function mixHex(a: Color, b: Color, t: number): Color {
  const ca = parseHex(a), cb = parseHex(b);
  if (!ca || !cb) return a;
  const r = ca[0] + (cb[0] - ca[0]) * t;
  const g = ca[1] + (cb[1] - ca[1]) * t;
  const bl = ca[2] + (cb[2] - ca[2]) * t;
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

export function layoutPQueue(doc: PQueueDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 38;

  // Highest priority first; ties keep input order (stable).
  const items = doc.items
    .map((it, i) => ({ ...it, i }))
    .sort((a, b) => (b.priority - a.priority) || (a.i - b.i));

  const priorities = items.map(it => it.priority);
  const max = priorities.length ? Math.max(...priorities) : 0;
  const min = priorities.length ? Math.min(...priorities) : 0;
  const span = max - min;

  const labelW = Math.max(40, ...items.map(it => measureText(it.label, font).width));
  const prioW = Math.max(24, ...items.map(it => measureText(String(it.priority), font).width));
  const padX = 14;
  const cellW = labelW + prioW + padX * 3;

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const origin = { x: margin, y: margin + titleH };

  // Shade: highest → near primary (t small), lowest → near surface (t large).
  const cellInputs: StripCell[] = items.map(it => {
    const norm = span === 0 ? 1 : (it.priority - min) / span;
    const t = 0.15 + (1 - norm) * 0.65;           // 0.15 (top) … 0.80 (bottom)
    return { fill: mixHex(palette.primary, palette.surface, t) };
  });

  const strip = buildStrip(p, theme, cellInputs, {
    origin, cellWidth: cellW, cellHeight: cellH, orientation: 'vertical',
  });

  const elements: SceneElement[] = [...strip.elements];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // Overlay: label (left) + priority value (right) per cell.
  items.forEach((it, i) => {
    const slot = strip.slots[i]!;
    const cy = slot.y + slot.height / 2 + font * 0.35;
    elements.push(p.text(it.label, slot.x + padX, cy, font, palette.text, { weight: 'bold' }));
    elements.push(p.text(String(it.priority), slot.x + slot.width - padX, cy, font, palette.text, { anchor: 'end', weight: 'bold' }));
  });

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  strip.slots.forEach((slot, i) => { anchors[`c${i}`] = { bounds: slot }; });

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: cellW + margin * 2, height: origin.y + items.length * cellH + margin },
    background: palette.background,
    elements,
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const pqueue: DiagramModule<PQueueDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutPQueue(ir, theme);
  },
};
