/**
 * @file diagrams/triton/deck/list/list.ts — staged, styleable list.
 *
 * A PowerPoint-style list object, and the FIRST citizen of Triton's
 * reveal-native "deck" family. A single `style` keyword switches the drawing
 * dramatically (bullets, numbered, block, box …) while the parse and reveal
 * machinery stay shared. Items may be NESTED via indentation, forming a tree;
 * each node gets a stable hierarchical id (`item-0`, `item-0-1`, …) drawn from
 * the same vocabulary as the node-anchor registry, so links/anchors and reveal
 * steps can target any node — including nested ones.
 *
 * The reveal choreography is emitted as a RevealTrack on the LayoutResult. It
 * is PURE DATA: the static SVG (via renderSync) renders identically and carries
 * no reveal manifest — only the interactive render path serializes it.
 *
 * Line-based mini-syntax:
 *   list
 *     style block             # bullets | numbered | block | box | tree  (default: bullets)
 *     reveal subtree          # sequence | subtree | layer               (default: sequence)
 *     title Agenda
 *     effect slide            # global default reveal effect (fade|slide|grow|draw)
 *     group 2                 # reveal items in chunks of N per step (sequence mode)
 *     Introduction
 *     The problem
 *       and a sub-point       # 2-space indent → child of the previous item
 *     + and its cost          # `+` joins this item into the PREVIOUS step
 *     Our approach @grow      # trailing `@<effect>` overrides this step's effect
 *     Results
 *
 * A leading `-` or `*` marker on an item line is optional and stripped.
 * Indentation (spaces or tabs) determines nesting depth.
 *
 * Reveal choreography (interactive path only):
 *   - `sequence` (default): one step per item, in document order.
 *       `group N` chunks items N-per-step; `+` force-merges into the current step.
 *   - `subtree`: one step per top-level (depth-0) item, revealing it together
 *     with all its descendants.
 *   - `layer`: BFS by depth — one step per level (all depth-0, then depth-1 …).
 *   - Step effect precedence: first item's `@effect` > global `effect` > 'fade'.
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement,
  NodeAnchorRegistry, RevealEffect, RevealStep, ThemePalette,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';

const REVEAL_EFFECTS: readonly RevealEffect[] = ['fade', 'slide', 'grow', 'draw'];

/** Drawing styles. `bullets` is the default and preserves the original look. */
export type ListStyle = 'bullets' | 'numbered' | 'block' | 'box' | 'tree';
const LIST_STYLES: readonly ListStyle[] = ['bullets', 'numbered', 'block', 'box', 'tree'];

/** Reveal choreography over the (possibly nested) item tree. */
export type RevealMode = 'sequence' | 'subtree' | 'layer';
const REVEAL_MODES: readonly RevealMode[] = ['sequence', 'subtree', 'layer'];

function asEffect(token: string): RevealEffect | undefined {
  const t = token.toLowerCase() as RevealEffect;
  return REVEAL_EFFECTS.includes(t) ? t : undefined;
}
function asStyle(token: string): ListStyle | undefined {
  const t = token.toLowerCase() as ListStyle;
  return LIST_STYLES.includes(t) ? t : undefined;
}
function asMode(token: string): RevealMode | undefined {
  const t = token.toLowerCase() as RevealMode;
  return REVEAL_MODES.includes(t) ? t : undefined;
}

/** A single, possibly-nested list item. */
export interface ListItem {
  /** Display text, with markers/effect tokens stripped. */
  text: string;
  /** 0-based nesting depth. */
  depth: number;
  /** Stable hierarchical id, e.g. `item-0`, `item-0-1`. */
  id: string;
  /** 1-based dotted ordinal path, e.g. `1`, `1.2`, `2.1.1` (for `numbered`). */
  numberLabel: string;
  /** True when this item joins the PREVIOUS reveal step (`+` prefix). */
  join: boolean;
  /** Per-item reveal-effect override (undefined = inherit). */
  effect?: RevealEffect;
}

export interface ListDoc {
  title?: string;
  /** Resolved drawing style (default: `bullets`). */
  style: ListStyle;
  /** Resolved reveal mode (default: `sequence`). */
  reveal: RevealMode;
  /** Global default reveal effect for every step. */
  effect?: RevealEffect;
  /** Reveal items in chunks of this many per step (>= 1, sequence mode). */
  group?: number;
  items: ListItem[];
  version: string;
  metadata: Record<string, unknown>;
}

/** Number of leading-whitespace columns (tabs count as 2), before trimming. */
function indentWidth(line: string): number {
  const lead = line.match(/^[ \t]*/)?.[0] ?? '';
  return lead.replace(/\t/g, '  ').length;
}

/** Split into non-empty raw lines (leading whitespace PRESERVED), frontmatter removed. */
function sourceLines(input: string): string[] {
  // Theme injection (e.g. from Deckpilot) prepends a `---\ntheme: …\n---` block.
  const body = input.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  return body.split(/\r?\n/).filter(l => l.trim().length > 0);
}

/**
 * Parse a leading `---…---` YAML-ish frontmatter block into a flat key/value
 * map. Triton's frontend reads `metadata.theme` to resolve the diagram theme.
 */
function frontmatterMeta(input: string): Record<string, unknown> {
  const m = input.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return {};
  const meta: Record<string, unknown> = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = value;
  }
  return meta;
}

export function parseList(input: string): ListDoc {
  let title: string | undefined;
  let style: ListStyle = 'bullets';
  let reveal: RevealMode = 'sequence';
  let effect: RevealEffect | undefined;
  let group: number | undefined;

  // Collect raw items with their indentation before resolving depth.
  const raw: { indent: number; text: string; join: boolean; effect?: RevealEffect }[] = [];

  for (const line of sourceLines(input)) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'list') continue;                              // header
    if (lower.startsWith('title ')) { title = trimmed.slice(6).trim(); continue; }
    if (lower.startsWith('style ')) { style = asStyle(trimmed.slice(6).trim()) ?? style; continue; }
    if (lower.startsWith('reveal ')) { reveal = asMode(trimmed.slice(7).trim()) ?? reveal; continue; }
    if (lower.startsWith('effect ')) { effect = asEffect(trimmed.slice(7).trim()) ?? effect; continue; }
    if (lower.startsWith('group ')) {
      const num = parseInt(trimmed.slice(6).trim(), 10);
      if (Number.isFinite(num) && num >= 1) group = num;
      continue;
    }

    // Item line. Depth comes from the RAW indentation.
    const indent = indentWidth(line);
    let text = trimmed;
    const join = /^\+\s+/.test(text);
    if (join) text = text.replace(/^\+\s+/, '');
    text = text.replace(/^[-*]\s+/, '');                          // optional list marker
    let itemEffect: RevealEffect | undefined;
    const m = text.match(/\s+@(\w+)\s*$/);
    if (m) {
      const e = asEffect(m[1] ?? '');
      if (e) { itemEffect = e; text = text.slice(0, m.index ?? 0).trimEnd(); }
    }
    raw.push({ indent, text, join, ...(itemEffect ? { effect: itemEffect } : {}) });
  }

  const items = assignTree(raw);

  return {
    ...(title !== undefined ? { title } : {}),
    style,
    reveal,
    ...(effect !== undefined ? { effect } : {}),
    ...(group !== undefined ? { group } : {}),
    items, version: '1.0', metadata: frontmatterMeta(input),
  };
}

/**
 * Resolve indentation widths into a tree: assign each item a depth and a
 * stable hierarchical id/ordinal. Uses an indent stack so 2-space, 4-space,
 * or tab indentation all work; the first item establishes depth 0.
 */
function assignTree(raw: { indent: number; text: string; join: boolean; effect?: RevealEffect }[]): ListItem[] {
  const stack: number[] = [];   // indent widths of the current ancestor chain
  const path: number[] = [];    // 0-based sibling index at each depth
  const items: ListItem[] = [];

  for (const r of raw) {
    while (stack.length > 0 && r.indent < stack[stack.length - 1]!) stack.pop();
    if (stack.length === 0 || r.indent > stack[stack.length - 1]!) {
      stack.push(r.indent);
    }
    const depth = stack.length - 1;

    // Update the sibling-index path for id/ordinal assignment.
    if (path.length === depth) {
      path.push(0);                       // first child at a new deeper level
    } else {
      path.length = depth + 1;            // pop back up to this depth
      path[depth] = (path[depth] ?? -1) + 1;
    }

    items.push({
      text: r.text,
      depth,
      id: `item-${path.join('-')}`,
      numberLabel: path.map(num => num + 1).join('.'),
      join: r.join,
      ...(r.effect ? { effect: r.effect } : {}),
    });
  }
  return items;
}

// ─── Reveal ─────────────────────────────────────────────────────────────────

function buildSteps(doc: ListDoc): RevealStep[] {
  type Mut = { enter: string[]; effect: RevealEffect; label: string };
  const out: Mut[] = [];

  if (doc.reveal === 'subtree') {
    let cur: Mut | null = null;
    for (const it of doc.items) {
      if (it.depth === 0 || cur === null) {
        cur = { enter: [it.id], effect: it.effect ?? doc.effect ?? 'fade', label: it.text };
        out.push(cur);
      } else {
        cur.enter.push(it.id);
      }
    }
  } else if (doc.reveal === 'layer') {
    // BFS by depth: one step per level (all depth-0, then all depth-1, …).
    const byDepth = new Map<number, string[]>();
    for (const it of doc.items) {
      const arr = byDepth.get(it.depth) ?? [];
      arr.push(it.id);
      byDepth.set(it.depth, arr);
    }
    for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
      out.push({ enter: byDepth.get(depth)!, effect: doc.effect ?? 'fade', label: `Level ${depth + 1}` });
    }
  } else {
    const chunk = doc.group && doc.group >= 1 ? doc.group : 1;
    let inStep = 0;
    for (const it of doc.items) {
      const startNew = out.length === 0 ? true : it.join ? false : inStep >= chunk;
      if (startNew) {
        out.push({ enter: [it.id], effect: it.effect ?? doc.effect ?? 'fade', label: it.text });
        inStep = 1;
      } else {
        out[out.length - 1]!.enter.push(it.id);
        inStep++;
      }
    }
  }

  return out.map((s, i) => ({ index: i + 1, enter: s.enter, effect: s.effect, label: s.label }));
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function markerColor(depth: number, palette: ThemePalette): string {
  return depth === 0 ? palette.primary : depth === 1 ? palette.secondary : palette.textMuted;
}
function markerRadius(depth: number, font: number): number {
  return depth === 0 ? Math.max(3, rhu(font / 6)) : depth === 1 ? Math.max(2.5, rhu(font / 7)) : Math.max(2, rhu(font / 8));
}

export function layoutList(doc: ListDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const indentPx = rhu(font * 1.6);
  const titleH = doc.title ? typography.titleFontSize + 16 : 0;
  const top = margin + titleH;
  const n = Math.max(doc.items.length, 1);

  const elements: SceneElement[] = [];
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  let contentRight = 0;
  let height: number;

  if (doc.style === 'block' || doc.style === 'box') {
    const itemH = rhu(font * 2.2);
    const gap = rhu(font * 0.6);
    const pad = rhu(font * 0.8);
    const barW = doc.style === 'box' ? Math.max(3, rhu(font * 0.35)) : 0;

    // First pass: uniform right edge so blocks/boxes align.
    let maxRight = 0;
    doc.items.forEach(it => {
      const x = margin + it.depth * indentPx;
      const tw = measureText(it.text, font).width;
      maxRight = Math.max(maxRight, x + barW + pad + tw + pad);
    });
    contentRight = maxRight;

    doc.items.forEach((it, i) => {
      const y = top + i * (itemH + gap);
      const x = margin + it.depth * indentPx;
      const w = rhu(contentRight - x);
      const textY = rhu(y + itemH / 2 + font * 0.34);
      const children: SceneElement[] = [
        p.rect({ x, y, width: w, height: itemH }, palette.surface, palette.border, 1, { rx: doc.style === 'block' ? 6 : 4 }),
      ];
      if (doc.style === 'box') {
        const c = markerColor(it.depth, palette);
        children.push(p.rect({ x, y, width: barW, height: itemH }, c, c, 0, { rx: 2 }));
      }
      children.push(p.text(it.text, x + barW + pad, textY, font, palette.text, { anchor: 'start' }));
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: w, height: itemH } };
    });

    height = rhu(top + n * (itemH + gap) - gap + margin);
  } else if (doc.style === 'tree') {
    // Top-down org-chart layout of the nested list (a forest of depth-0 roots).
    const pad = rhu(font * 0.8);
    const nodeH = rhu(font * 2.2);
    const hGap = rhu(font * 1.2);
    const vGap = rhu(font * 1.8);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const nodeW = rhu(maxTextW + 2 * pad);
    const colStep = nodeW + hGap;

    // Derive parent/child structure from the depth ordering.
    const parentOf = new Array<number>(doc.items.length).fill(-1);
    const childrenOf = new Map<number, number[]>();
    const ancestor: number[] = [];
    doc.items.forEach((it, i) => {
      ancestor.length = it.depth;
      const parent = it.depth === 0 ? -1 : ancestor[it.depth - 1]!;
      parentOf[i] = parent;
      const arr = childrenOf.get(parent) ?? [];
      arr.push(i);
      childrenOf.set(parent, arr);
      ancestor[it.depth] = i;
    });

    // Assign columns post-order: leaves take sequential slots, parents centre.
    const col = new Array<number>(doc.items.length).fill(0);
    let nextCol = 0;
    const assign = (i: number): void => {
      const kids = childrenOf.get(i) ?? [];
      if (kids.length === 0) { col[i] = nextCol; nextCol += 1; return; }
      kids.forEach(assign);
      col[i] = (col[kids[0]!]! + col[kids[kids.length - 1]!]!) / 2;
    };
    (childrenOf.get(-1) ?? []).forEach(assign);

    const xOf = (i: number) => rhu(margin + col[i]! * colStep);
    const yOf = (i: number) => rhu(top + doc.items[i]!.depth * (nodeH + vGap));

    let maxDepth = 0;
    doc.items.forEach((it, i) => {
      const x = xOf(i);
      const y = yOf(i);
      const cx = rhu(x + nodeW / 2);
      contentRight = Math.max(contentRight, x + nodeW);
      maxDepth = Math.max(maxDepth, it.depth);

      const children: SceneElement[] = [];
      // Connector to parent lives in the CHILD group so it reveals together.
      if (parentOf[i]! >= 0) {
        const pi = parentOf[i]!;
        const px = rhu(xOf(pi) + nodeW / 2);
        const py = rhu(yOf(pi) + nodeH);
        const midY = rhu((py + y) / 2);
        const d = `M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${y}`;
        children.push(p.path(d, palette.border, 1.5));
      }
      const stroke = it.depth === 0 ? palette.primary : palette.border;
      children.push(p.rect({ x, y, width: nodeW, height: nodeH }, palette.surface, stroke, it.depth === 0 ? 2 : 1, { rx: 6 }));
      children.push(p.text(it.text, cx, rhu(y + nodeH / 2 + font * 0.34), font, palette.text, { anchor: 'middle' }));
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: nodeW, height: nodeH } };
    });

    height = rhu(top + maxDepth * (nodeH + vGap) + nodeH + margin);
  } else {
    const rowH = rhu(font * 1.9);

    doc.items.forEach((it, i) => {
      const rowY = top + i * rowH;
      const cy = rowY + rowH / 2;
      const x = margin + it.depth * indentPx;
      const textBaseline = rhu(cy + font * 0.34);
      const children: SceneElement[] = [];
      let textX: number;

      if (doc.style === 'numbered') {
        const label = `${it.numberLabel}.`;
        children.push(p.text(label, x, textBaseline, font, palette.primary, { weight: 'bold', anchor: 'start' }));
        textX = x + measureText(label, font).width + 10;
      } else {
        const r = markerRadius(it.depth, font);
        const c = markerColor(it.depth, palette);
        children.push(p.circle({ x: x + r, y: rhu(cy) }, r, c, c, 0));
        textX = x + r * 2 + 12;
      }

      children.push(p.text(it.text, textX, textBaseline, font, palette.text, { anchor: 'start' }));
      const tw = measureText(it.text, font).width;
      contentRight = Math.max(contentRight, textX + tw);
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y: rowY, width: rhu(textX - x + tw), height: rowH } };
    });

    height = rhu(top + n * rowH + margin);
  }

  if (doc.title) {
    elements.unshift(
      p.text(doc.title, margin, rhu(margin + typography.titleFontSize), typography.titleFontSize, palette.text, { weight: 'bold' }),
    );
  }

  const width = rhu(contentRight + margin);
  const scene: Scene = {
    viewBox: { x: 0, y: 0, width, height },
    background: palette.background,
    elements,
  };

  return {
    scene,
    anchors: anchors as NodeAnchorRegistry,
    reveal: { steps: buildSteps(doc) },
  };
}

export const list: DiagramModule<ListDoc> = {
  parseMermaid(input: string): ListDoc {
    return parseList(input);
  },
  parseYaml(input: string): ListDoc {
    return JSON.parse(input) as ListDoc;
  },
  layout(ir: ListDoc, theme: ResolvedTheme): LayoutResult {
    return layoutList(ir, theme);
  },
};
