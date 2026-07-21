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
 *     style block             # bullets | numbered | block | box | tree
 *                             # chevron | process | timeline | pyramid | columns
 *                             # cycle | matrix | funnel | stepup | venn
 *                             # (default: bullets)
 *     reveal subtree          # sequence | subtree | layer | none            (default: sequence)
 *     title Agenda
 *     effect slide            # global default reveal effect (fade|slide|grow|draw)
 *     group 2                 # reveal items in chunks of N per step (sequence mode)
 *     flow snake              # ltr (default) | ttb | snake | snake-v  (process style only)
 *     wrap 3                  # cells per row/col before turning (snake/snake-v; default: ceil(√n))
 *     turn direct             # corridor (default) | direct  (snake/snake-v turn style)
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
 *   - `none` (aka `all`/`off`/`static`): emit NO reveal track — the diagram is
 *     shown all at once (hosts like Deckpilot skip fragmenting it).
 *   - Step effect precedence: first item's `@effect` > global `effect` > 'fade'.
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement,
  NodeAnchorRegistry, RevealEffect, RevealStep, ThemePalette,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { readableText } from '../../../../theme/contrast.js';
import { rhu } from '../../../../util/round.js';

const REVEAL_EFFECTS: readonly RevealEffect[] = ['fade', 'slide', 'grow', 'draw'];

/** Drawing styles. `bullets` is the default and preserves the original look. */
export type ListStyle =
  | 'bullets' | 'numbered' | 'block' | 'box' | 'tree'
  | 'chevron' | 'process' | 'timeline' | 'pyramid' | 'columns'
  | 'cycle' | 'matrix' | 'funnel' | 'stepup' | 'venn';
const LIST_STYLES: readonly ListStyle[] = [
  'bullets', 'numbered', 'block', 'box', 'tree',
  'chevron', 'process', 'timeline', 'pyramid', 'columns',
  'cycle', 'matrix', 'funnel', 'stepup', 'venn',
];

/** Reveal choreography over the (possibly nested) item tree. */
export type RevealMode = 'sequence' | 'subtree' | 'layer' | 'none';
const REVEAL_MODES: readonly RevealMode[] = ['sequence', 'subtree', 'layer', 'none'];

/** Flow direction for the `process` style. `ltr` is the default and preserves legacy behavior. */
export type ProcessFlow = 'ltr' | 'ttb' | 'snake' | 'snake-v';
export const PROCESS_FLOWS: readonly ProcessFlow[] = ['ltr', 'ttb', 'snake', 'snake-v'];

export function asFlow(token: string): ProcessFlow | undefined {
  const t = token.toLowerCase() as ProcessFlow;
  return PROCESS_FLOWS.includes(t) ? t : undefined;
}

/** Turn-connector style for snake/snake-v flows. `corridor` is the default. */
export type TurnStyle = 'corridor' | 'direct';
export const TURN_STYLES: readonly TurnStyle[] = ['corridor', 'direct'];

export function asTurn(token: string): TurnStyle | undefined {
  const t = token.toLowerCase() as TurnStyle;
  return TURN_STYLES.includes(t) ? t : undefined;
}

/**
 * Returns the grid (row, col) coordinates for item index `i` under the given
 * flow pattern. Pure and unit-testable — all pattern math lives here.
 * Extend this function alone to add new patterns (diagonal, spiral, U-turn…).
 */
export function cellForIndex(i: number, flow: ProcessFlow, wrap: number): { row: number; col: number } {
  switch (flow) {
    case 'ltr': return { row: 0, col: i };
    case 'ttb': return { row: i, col: 0 };
    case 'snake': {
      const row = Math.floor(i / wrap);
      const pos = i % wrap;
      const col = row % 2 === 0 ? pos : wrap - 1 - pos;
      return { row, col };
    }
    case 'snake-v': {
      const col = Math.floor(i / wrap);
      const pos = i % wrap;
      const row = col % 2 === 0 ? pos : wrap - 1 - pos;
      return { row, col };
    }
  }
}

function asEffect(token: string): RevealEffect | undefined {
  const t = token.toLowerCase() as RevealEffect;
  return REVEAL_EFFECTS.includes(t) ? t : undefined;
}
function asStyle(token: string): ListStyle | undefined {
  const t = token.toLowerCase() as ListStyle;
  return LIST_STYLES.includes(t) ? t : undefined;
}
function asMode(token: string): RevealMode | undefined {
  const t = token.toLowerCase();
  // `none` (aka all/off/static) opts the diagram OUT of progressive reveal:
  // no reveal track is emitted, so hosts (e.g. Deckpilot) show it all at once.
  if (t === 'none' || t === 'all' || t === 'off' || t === 'static') return 'none';
  return REVEAL_MODES.includes(t as RevealMode) ? (t as RevealMode) : undefined;
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
  /** Flow direction for `process` style (default: `ltr`). Ignored for other styles. */
  flow?: ProcessFlow;
  /** Cells per row (snake) / per column (snake-v) before turning. Defaults to ceil(√n). */
  wrap?: number;
  /** Turn-connector style for snake/snake-v flows (default: `corridor`). */
  turn?: TurnStyle;
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
  let flow: ProcessFlow = 'ltr';
  let wrap: number | undefined;
  let turn: TurnStyle = 'corridor';

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
    if (lower.startsWith('flow ')) { flow = asFlow(trimmed.slice(5).trim()) ?? flow; continue; }
    if (lower.startsWith('wrap ')) {
      const num = parseInt(trimmed.slice(5).trim(), 10);
      if (Number.isFinite(num) && num >= 1) wrap = num;
      continue;
    }
    if (lower.startsWith('turn ')) { turn = asTurn(trimmed.slice(5).trim()) ?? turn; continue; }

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
    ...(flow !== 'ltr' ? { flow } : {}),
    ...(wrap !== undefined ? { wrap } : {}),
    ...(turn !== 'corridor' ? { turn } : {}),
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

/**
 * Build a filled arrowhead triangle path string pointing in `dir`.
 * `tx`/`ty` is the TIP (sharpest point); `ah` is already-rounded half-size.
 */
function arrowTriangle(tx: number, ty: number, dir: 'right' | 'left' | 'down' | 'up', ah: number): string {
  switch (dir) {
    case 'right': return `M ${rhu(tx - ah)} ${rhu(ty - ah)} L ${tx} ${ty} L ${rhu(tx - ah)} ${rhu(ty + ah)} Z`;
    case 'left':  return `M ${rhu(tx + ah)} ${rhu(ty - ah)} L ${tx} ${ty} L ${rhu(tx + ah)} ${rhu(ty + ah)} Z`;
    case 'down':  return `M ${rhu(tx - ah)} ${rhu(ty - ah)} L ${tx} ${ty} L ${rhu(tx + ah)} ${rhu(ty - ah)} Z`;
    case 'up':    return `M ${rhu(tx - ah)} ${rhu(ty + ah)} L ${tx} ${ty} L ${rhu(tx + ah)} ${rhu(ty + ah)} Z`;
  }
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
  } else if (doc.style === 'chevron') {
    // Horizontal left→right interlocking arrow blocks. Depth is ignored for
    // placement (inherently flat); nesting still yields stable ids.
    const boxH = rhu(font * 2.8);
    const padX = rhu(font * 1.0);
    const notch = rhu(boxH * 0.3);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const boxW = rhu(maxTextW + 2 * padX + 2 * notch);
    const stepX = rhu(boxW - notch);
    const y = top;
    const cy = rhu(y + boxH / 2);
    const yb = rhu(y + boxH);

    doc.items.forEach((it, i) => {
      const x = rhu(margin + i * stepX);
      const cx = rhu(x + boxW / 2);
      const textY = rhu(cy + font * 0.34);
      const fill = i % 2 === 0 ? palette.primary : palette.secondary;
      const k = notch;
      const tipR = rhu(x + boxW);
      const innerR = rhu(x + boxW - k);
      const d = i === 0
        ? `M ${x} ${y} L ${innerR} ${y} L ${tipR} ${cy} L ${innerR} ${yb} L ${x} ${yb} Z`
        : `M ${x} ${y} L ${innerR} ${y} L ${tipR} ${cy} L ${innerR} ${yb} L ${x} ${yb} L ${rhu(x + k)} ${cy} Z`;
      const children: SceneElement[] = [
        p.path(d, fill, 0, { fill }),
        p.text(it.text, rhu(cx + k / 2), textY, font, readableText(fill, theme), { anchor: 'middle' }),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
      contentRight = Math.max(contentRight, x + boxW);
    });

    height = rhu(top + boxH + margin);
  } else if (doc.style === 'process') {
    // Rounded boxes joined by arrow connectors. The `flow` directive controls
    // the geometric path: ltr (default, single row), ttb (single column),
    // snake (row-major boustrophedon), snake-v (column-major boustrophedon).
    // `ltr` is byte-identical to the original layout. Other flows use a uniform
    // grid engine. Depth is ignored for placement; nesting still yields ids.
    const flow = doc.flow ?? 'ltr';
    const boxH = rhu(font * 2.8);
    const padX = rhu(font * 1.0);
    const arrowGap = rhu(font * 1.8);
    const ah = Math.max(4, rhu(font * 0.42));
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const boxW = rhu(maxTextW + 2 * padX);

    if (flow === 'ltr') {
      // Original ltr layout — preserved byte-identically.
      const stepX = rhu(boxW + arrowGap);
      const y = top;
      const cy = rhu(y + boxH / 2);

      doc.items.forEach((it, i) => {
        const x = rhu(margin + i * stepX);
        const cx = rhu(x + boxW / 2);
        const textY = rhu(cy + font * 0.34);
        const children: SceneElement[] = [];
        // Incoming arrow lives in THIS group so it reveals with its target box.
        if (i > 0) {
          const ax1 = rhu(x);
          const ax0 = rhu(x - arrowGap);
          children.push(p.path(`M ${ax0} ${cy} L ${rhu(ax1 - ah)} ${cy}`, palette.textMuted, 2));
          const tri = `M ${rhu(ax1 - ah)} ${rhu(cy - ah)} L ${ax1} ${cy} L ${rhu(ax1 - ah)} ${rhu(cy + ah)} Z`;
          children.push(p.path(tri, palette.textMuted, 0, { fill: palette.textMuted }));
        }
        children.push(p.rect({ x, y, width: boxW, height: boxH }, palette.surface, palette.primary, 1.5, { rx: 6 }));
        children.push(p.text(it.text, cx, textY, font, palette.text, { anchor: 'middle' }));
        elements.push(p.group(children, { id: it.id }));
        anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
        contentRight = Math.max(contentRight, x + boxW);
      });

      height = rhu(top + boxH + margin);
    } else {
      // Grid engine: ttb / snake / snake-v.
      const wrap = doc.wrap ?? Math.ceil(Math.sqrt(n));
      const turn = doc.turn ?? 'corridor';
      const elbow = rhu(arrowGap * 0.4);

      // Pixel top-left of cell at (row, col).
      const cellX = (col: number) => rhu(margin + col * (boxW + arrowGap));
      const cellY = (row: number) => rhu(top + row * (boxH + arrowGap));

      let maxRow = 0;

      doc.items.forEach((it, i) => {
        const { row, col } = cellForIndex(i, flow, wrap);
        maxRow = Math.max(maxRow, row);
        const x = cellX(col);
        const y = cellY(row);
        const cx = rhu(x + boxW / 2);
        const cy = rhu(y + boxH / 2);
        const textY = rhu(cy + font * 0.34);
        const children: SceneElement[] = [];

        // Incoming connector — lives in THIS group so it animates with its box.
        if (i > 0) {
          const prev = cellForIndex(i - 1, flow, wrap);
          const prevX = cellX(prev.col);
          const prevY = cellY(prev.row);
          const prevCX = rhu(prevX + boxW / 2);
          const prevCY = rhu(prevY + boxH / 2);

          // Is this connector a straight segment or a snake turn?
          const isTurn = flow === 'snake' ? prev.row !== row : prev.col !== col;

          if (!isTurn) {
            // Straight connector — direction depends on flow and position.
            if (flow === 'ttb') {
              // Vertical downward arrow.
              const ty = y;
              children.push(p.path(`M ${cx} ${rhu(prevY + boxH)} L ${cx} ${rhu(ty - ah)}`, palette.textMuted, 2));
              children.push(p.path(arrowTriangle(cx, ty, 'down', ah), palette.textMuted, 0, { fill: palette.textMuted }));
            } else if (flow === 'snake') {
              if (row % 2 === 0) {
                // Even row: L→R arrow entering from the left.
                children.push(p.path(`M ${rhu(prevX + boxW)} ${cy} L ${rhu(x - ah)} ${cy}`, palette.textMuted, 2));
                children.push(p.path(arrowTriangle(x, cy, 'right', ah), palette.textMuted, 0, { fill: palette.textMuted }));
              } else {
                // Odd row: R→L arrow entering from the right.
                const tipX = rhu(x + boxW);
                children.push(p.path(`M ${prevX} ${cy} L ${rhu(tipX + ah)} ${cy}`, palette.textMuted, 2));
                children.push(p.path(arrowTriangle(tipX, cy, 'left', ah), palette.textMuted, 0, { fill: palette.textMuted }));
              }
            } else {
              // snake-v straight segment within a column.
              if (col % 2 === 0) {
                // Even col: top→bottom arrow.
                const ty = y;
                children.push(p.path(`M ${cx} ${rhu(prevY + boxH)} L ${cx} ${rhu(ty - ah)}`, palette.textMuted, 2));
                children.push(p.path(arrowTriangle(cx, ty, 'down', ah), palette.textMuted, 0, { fill: palette.textMuted }));
              } else {
                // Odd col: bottom→top arrow.
                const tipY = rhu(y + boxH);
                children.push(p.path(`M ${cx} ${prevY} L ${cx} ${rhu(tipY + ah)}`, palette.textMuted, 2));
                children.push(p.path(arrowTriangle(cx, tipY, 'up', ah), palette.textMuted, 0, { fill: palette.textMuted }));
              }
            }
          } else if (flow === 'snake') {
            // Snake turn: connector between rows (both cells share same column).
            if (turn === 'direct') {
              // Direct: straight down from bottom of prevCell to top of curCell.
              children.push(p.path(`M ${prevCX} ${rhu(prevY + boxH)} L ${prevCX} ${rhu(y - ah)}`, palette.textMuted, 2));
              children.push(p.path(arrowTriangle(prevCX, y, 'down', ah), palette.textMuted, 0, { fill: palette.textMuted }));
            } else if (prev.row % 2 === 0) {
              // Corridor even → odd row: elbow on the RIGHT side (both cells at col wrap-1).
              const rx = rhu(prevX + boxW);
              children.push(p.path(
                `M ${rx} ${prevCY} L ${rhu(rx + elbow)} ${prevCY} L ${rhu(rx + elbow)} ${cy} L ${rhu(rx + ah)} ${cy}`,
                palette.textMuted, 2,
              ));
              children.push(p.path(arrowTriangle(rx, cy, 'left', ah), palette.textMuted, 0, { fill: palette.textMuted }));
              contentRight = Math.max(contentRight, rhu(rx + elbow));
            } else {
              // Corridor odd → even row: elbow on the LEFT side (both cells at col 0).
              const lx = prevX;
              children.push(p.path(
                `M ${lx} ${prevCY} L ${rhu(lx - elbow)} ${prevCY} L ${rhu(lx - elbow)} ${cy} L ${rhu(lx - ah)} ${cy}`,
                palette.textMuted, 2,
              ));
              children.push(p.path(arrowTriangle(lx, cy, 'right', ah), palette.textMuted, 0, { fill: palette.textMuted }));
            }
          } else {
            // snake-v turn: connector between columns (both cells share same row).
            if (turn === 'direct') {
              // Direct: straight across from right of prevCell to left of curCell.
              children.push(p.path(`M ${rhu(prevX + boxW)} ${cy} L ${rhu(x - ah)} ${cy}`, palette.textMuted, 2));
              children.push(p.path(arrowTriangle(x, cy, 'right', ah), palette.textMuted, 0, { fill: palette.textMuted }));
            } else if (prev.col % 2 === 0) {
              // Corridor even → odd col: elbow at the BOTTOM (both cells at row wrap-1).
              const by = rhu(prevY + boxH);
              children.push(p.path(
                `M ${prevCX} ${by} L ${prevCX} ${rhu(by + elbow)} L ${cx} ${rhu(by + elbow)} L ${cx} ${rhu(by + ah)}`,
                palette.textMuted, 2,
              ));
              children.push(p.path(arrowTriangle(cx, by, 'up', ah), palette.textMuted, 0, { fill: palette.textMuted }));
            } else {
              // Corridor odd → even col: elbow at the TOP (both cells at row 0).
              const ty = prevY;
              children.push(p.path(
                `M ${prevCX} ${ty} L ${prevCX} ${rhu(ty - elbow)} L ${cx} ${rhu(ty - elbow)} L ${cx} ${rhu(ty - ah)}`,
                palette.textMuted, 2,
              ));
              children.push(p.path(arrowTriangle(cx, ty, 'down', ah), palette.textMuted, 0, { fill: palette.textMuted }));
            }
          }
        }

        children.push(p.rect({ x, y, width: boxW, height: boxH }, palette.surface, palette.primary, 1.5, { rx: 6 }));
        children.push(p.text(it.text, cx, textY, font, palette.text, { anchor: 'middle' }));
        elements.push(p.group(children, { id: it.id }));
        anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
        contentRight = Math.max(contentRight, x + boxW);
      });

      height = rhu(top + (maxRow + 1) * (boxH + arrowGap) - arrowGap + margin);
    }
  } else if (doc.style === 'timeline') {
    // Horizontal axis with a milestone dot per item; labels alternate
    // above/below the axis to avoid crowding.
    const dotR = Math.max(5, rhu(font * 0.5));
    const labelH = rhu(font * 1.8);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const stepX = rhu(maxTextW + font * 2.4);
    const axisY = rhu(top + labelH);

    doc.items.forEach((it, i) => {
      const cx = rhu(margin + stepX / 2 + i * stepX);
      const children: SceneElement[] = [];
      if (i > 0) {
        const px = rhu(margin + stepX / 2 + (i - 1) * stepX);
        children.push(p.path(`M ${px} ${axisY} L ${cx} ${axisY}`, palette.border, 2));
      }
      children.push(p.circle({ x: cx, y: axisY }, dotR, palette.primary, palette.background, 2));
      const above = i % 2 === 0;
      const ly = above ? rhu(axisY - dotR - 8) : rhu(axisY + dotR + font + 4);
      children.push(p.text(it.text, cx, ly, font, palette.text, { anchor: 'middle' }));
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x: rhu(cx - stepX / 2), y: top, width: stepX, height: rhu(labelH * 2 + dotR * 2) } };
      contentRight = Math.max(contentRight, cx + stepX / 2);
    });

    height = rhu(axisY + dotR + font + labelH + margin);
  } else if (doc.style === 'pyramid') {
    // Vertical stack of trapezoids, apex (narrowest) at top → base (widest).
    const bandH = rhu(font * 2.8);
    const vGap = rhu(font * 0.4);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const baseW = rhu(Math.max(maxTextW * 1.5, font * 14));
    const apexW = rhu(baseW * 0.28);
    const cxCenter = rhu(margin + baseW / 2);
    const widthAt = (frac: number) => apexW + (baseW - apexW) * frac;

    doc.items.forEach((it, i) => {
      const y = top + i * (bandH + vGap);
      const yTop = rhu(y);
      const yBot = rhu(y + bandH);
      const wTop = widthAt(n === 1 ? 1 : i / n);
      const wBot = widthAt(n === 1 ? 1 : (i + 1) / n);
      const tl = rhu(cxCenter - wTop / 2);
      const tr = rhu(cxCenter + wTop / 2);
      const bl = rhu(cxCenter - wBot / 2);
      const br = rhu(cxCenter + wBot / 2);
      const fill = i % 2 === 0 ? palette.primary : palette.secondary;
      const d = `M ${tl} ${yTop} L ${tr} ${yTop} L ${br} ${yBot} L ${bl} ${yBot} Z`;
      const children: SceneElement[] = [
        p.path(d, fill, 0, { fill }),
        p.text(it.text, cxCenter, rhu(y + bandH / 2 + font * 0.34), font, readableText(fill, theme), { anchor: 'middle' }),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x: bl, y: yTop, width: rhu(br - bl), height: bandH } };
      contentRight = Math.max(contentRight, cxCenter + baseW / 2);
    });

    height = rhu(top + n * (bandH + vGap) - vGap + margin);
  } else if (doc.style === 'columns') {
    // Grouped columns: each depth-0 item is a column header; the items that
    // follow (until the next depth-0) become stacked cells beneath it.
    interface Col { header: ListItem; cells: ListItem[] }
    const cols: Col[] = [];
    for (const it of doc.items) {
      if (it.depth === 0 || cols.length === 0) cols.push({ header: it, cells: [] });
      else cols[cols.length - 1]!.cells.push(it);
    }
    const headerH = rhu(font * 2.4);
    const cellH = rhu(font * 2.0);
    const gap = rhu(font * 0.5);
    const colGap = rhu(font * 1.2);
    const padX = rhu(font * 0.9);

    let x = margin;
    let maxCells = 0;
    const colX: number[] = [];
    const colW: number[] = [];
    cols.forEach(c => {
      let w = measureText(c.header.text, font).width;
      c.cells.forEach(ce => { w = Math.max(w, measureText(ce.text, font).width); });
      const cw = rhu(w + 2 * padX);
      colX.push(rhu(x));
      colW.push(cw);
      x += cw + colGap;
      maxCells = Math.max(maxCells, c.cells.length);
    });
    contentRight = rhu(x - colGap);

    cols.forEach((c, ci) => {
      const cx0 = colX[ci]!;
      const cw = colW[ci]!;
      const cxc = rhu(cx0 + cw / 2);
      const hchildren: SceneElement[] = [
        p.rect({ x: cx0, y: top, width: cw, height: headerH }, palette.primary, palette.primary, 0, { rx: 6 }),
        p.text(c.header.text, cxc, rhu(top + headerH / 2 + font * 0.34), font, readableText(palette.primary, theme), { weight: 'bold', anchor: 'middle' }),
      ];
      elements.push(p.group(hchildren, { id: c.header.id }));
      anchors[c.header.id] = { bounds: { x: cx0, y: top, width: cw, height: headerH } };

      c.cells.forEach((ce, ri) => {
        const cy0 = rhu(top + headerH + gap + ri * (cellH + gap));
        const cch: SceneElement[] = [
          p.rect({ x: cx0, y: cy0, width: cw, height: cellH }, palette.surface, palette.border, 1, { rx: 4 }),
          p.text(ce.text, cxc, rhu(cy0 + cellH / 2 + font * 0.34), font, palette.text, { anchor: 'middle' }),
        ];
        elements.push(p.group(cch, { id: ce.id }));
        anchors[ce.id] = { bounds: { x: cx0, y: cy0, width: cw, height: cellH } };
      });
    });

    height = rhu(top + headerH + gap + maxCells * (cellH + gap) + margin);
  } else if (doc.style === 'cycle') {
    // Items arranged clockwise around a ring; a curved arrow along the ring
    // joins each node to the next (and the last back to the first). Each
    // outgoing arc lives in its SOURCE node's group so it reveals with it.
    const pad = rhu(font * 0.9);
    const nodeH = rhu(font * 2.2);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const nodeW = rhu(maxTextW + 2 * pad);
    const chord = nodeW + rhu(font * 2.4);
    const R = n > 1 ? rhu(Math.max(nodeH * 2.4, chord / (2 * Math.sin(Math.PI / n)))) : 0;
    const cxC = rhu(margin + R + nodeW / 2);
    const cyC = rhu(top + R + nodeH / 2);
    const step = (2 * Math.PI) / Math.max(n, 1);
    const gapAng = R > 0 ? Math.min(step * 0.3, (nodeW / 2 + pad) / R) : 0;

    doc.items.forEach((it, i) => {
      const a = -Math.PI / 2 + i * step;
      const ncx = rhu(cxC + R * Math.cos(a));
      const ncy = rhu(cyC + R * Math.sin(a));
      const x = rhu(ncx - nodeW / 2);
      const y = rhu(ncy - nodeH / 2);
      const children: SceneElement[] = [];

      if (n > 1) {
        const a0 = a + gapAng;
        const a1 = a + step - gapAng;
        if (a1 > a0) {
          const sx = rhu(cxC + R * Math.cos(a0));
          const sy = rhu(cyC + R * Math.sin(a0));
          const ex = rhu(cxC + R * Math.cos(a1));
          const ey = rhu(cyC + R * Math.sin(a1));
          children.push(p.path(`M ${sx} ${sy} A ${R} ${R} 0 0 1 ${ex} ${ey}`, palette.primary, 2));
          // Arrowhead tangent to the arc at the target end.
          const pa = a1 - 0.12;
          const px = cxC + R * Math.cos(pa);
          const py = cyC + R * Math.sin(pa);
          const dx = ex - px, dy = ey - py;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const ah = Math.max(6, rhu(font * 0.6));
          const bx = ex - ux * ah, by = ey - uy * ah;
          const tri = `M ${rhu(bx - uy * ah * 0.6)} ${rhu(by + ux * ah * 0.6)} L ${ex} ${ey} L ${rhu(bx + uy * ah * 0.6)} ${rhu(by - ux * ah * 0.6)} Z`;
          children.push(p.path(tri, palette.primary, 0, { fill: palette.primary }));
        }
      }

      children.push(p.rect({ x, y, width: nodeW, height: nodeH }, palette.surface, palette.primary, 1.5, { rx: 8 }));
      children.push(p.text(it.text, ncx, rhu(ncy + font * 0.34), font, palette.text, { anchor: 'middle' }));
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: nodeW, height: nodeH } };
      contentRight = Math.max(contentRight, x + nodeW);
    });

    height = rhu(top + 2 * R + nodeH + margin);
  } else if (doc.style === 'matrix') {
    // Grid of colour-coded quadrant tiles (2 columns → a 2×2 Basic Matrix for
    // four items; more items extend downward as a Grid Matrix).
    const quad = [palette.primary, palette.secondary, palette.success, palette.warning];
    const cols = 2;
    const rows = Math.ceil(n / cols);
    const pad = rhu(font * 0.9);
    const gap = rhu(font * 0.5);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const tileW = rhu(maxTextW + 2 * pad);
    const tileH = rhu(font * 3.2);

    doc.items.forEach((it, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = rhu(margin + c * (tileW + gap));
      const y = rhu(top + r * (tileH + gap));
      const fill = quad[i % quad.length]!;
      const children: SceneElement[] = [
        p.rect({ x, y, width: tileW, height: tileH }, fill, fill, 0, { rx: 6 }),
        p.text(it.text, rhu(x + tileW / 2), rhu(y + tileH / 2 + font * 0.34), font, readableText(fill, theme), { weight: 'bold', anchor: 'middle' }),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: tileW, height: tileH } };
      contentRight = Math.max(contentRight, x + tileW);
    });

    height = rhu(top + rows * (tileH + gap) - gap + margin);
  } else if (doc.style === 'funnel') {
    // Inverted trapezoid stack: widest at the top, narrowing toward the base
    // (also serves as an inverted pyramid).
    const bandH = rhu(font * 2.8);
    const vGap = rhu(font * 0.4);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const baseW = rhu(Math.max(maxTextW * 1.5, font * 14));
    const apexW = rhu(baseW * 0.28);
    const cxCenter = rhu(margin + baseW / 2);
    const widthAt = (frac: number) => apexW + (baseW - apexW) * frac;

    doc.items.forEach((it, i) => {
      const y = top + i * (bandH + vGap);
      const yTop = rhu(y);
      const yBot = rhu(y + bandH);
      const wTop = widthAt(n === 1 ? 1 : (n - i) / n);
      const wBot = widthAt(n === 1 ? 1 : (n - i - 1) / n);
      const tl = rhu(cxCenter - wTop / 2);
      const tr = rhu(cxCenter + wTop / 2);
      const bl = rhu(cxCenter - wBot / 2);
      const br = rhu(cxCenter + wBot / 2);
      const fill = i % 2 === 0 ? palette.primary : palette.secondary;
      const d = `M ${tl} ${yTop} L ${tr} ${yTop} L ${br} ${yBot} L ${bl} ${yBot} Z`;
      const children: SceneElement[] = [
        p.path(d, fill, 0, { fill }),
        p.text(it.text, cxCenter, rhu(y + bandH / 2 + font * 0.34), font, readableText(fill, theme), { anchor: 'middle' }),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x: tl, y: yTop, width: rhu(tr - tl), height: bandH } };
      contentRight = Math.max(contentRight, cxCenter + baseW / 2);
    });

    height = rhu(top + n * (bandH + vGap) - vGap + margin);
  } else if (doc.style === 'stepup') {
    // Ascending staircase: each block sits higher than the previous, joined by
    // an elbow connector (which reveals with its target block).
    const boxH = rhu(font * 2.4);
    const gapX = rhu(font * 0.8);
    const stepUp = rhu(boxH * 0.7);
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const boxW = rhu(maxTextW + 2 * rhu(font * 0.9));
    const topmost = top;                                   // highest block (last)
    const yOf = (i: number) => rhu(topmost + (n - 1 - i) * stepUp);
    const xOf = (i: number) => rhu(margin + i * (boxW + gapX));

    doc.items.forEach((it, i) => {
      const x = xOf(i);
      const y = yOf(i);
      const children: SceneElement[] = [];
      if (i > 0) {
        const px = rhu(xOf(i - 1) + boxW);
        const py = rhu(yOf(i - 1) + boxH / 2);
        const cy = rhu(y + boxH / 2);
        children.push(p.path(`M ${px} ${py} L ${rhu((px + x) / 2)} ${py} L ${rhu((px + x) / 2)} ${cy} L ${x} ${cy}`, palette.border, 1.5));
      }
      children.push(p.rect({ x, y, width: boxW, height: boxH }, palette.surface, palette.primary, 1.5, { rx: 6 }));
      children.push(p.text(it.text, rhu(x + boxW / 2), rhu(y + boxH / 2 + font * 0.34), font, palette.text, { anchor: 'middle' }));
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
      contentRight = Math.max(contentRight, x + boxW);
    });

    height = rhu(top + (n - 1) * stepUp + boxH + margin);
  } else if (doc.style === 'venn') {
    // Overlapping translucent circles clustered radially: 2 → side by side,
    // 3 → the classic triangle, N → an overlapping flower. Labels are pushed
    // into each circle's outer lobe so they clear the shaded intersection.
    const tint = [palette.primary, palette.secondary, palette.success, palette.warning, palette.error];
    let maxTextW = 0;
    doc.items.forEach(it => { maxTextW = Math.max(maxTextW, measureText(it.text, font).width); });
    const r = rhu(Math.max(font * 3.4, maxTextW / 2 + font));
    const d = n > 1 ? rhu(r * 0.72) : 0;                 // centre-ring radius → circles overlap
    const start = n === 2 ? Math.PI : -Math.PI / 2;      // 2 → horizontal, else apex at top
    const cxC = rhu(margin + d + r);
    const cyC = rhu(top + d + r);
    const labelR = d + rhu(r * 0.42);

    doc.items.forEach((it, i) => {
      const ang = start + (i * 2 * Math.PI) / n;
      const cx = rhu(cxC + d * Math.cos(ang));
      const cy = rhu(cyC + d * Math.sin(ang));
      const lx = n === 1 ? cxC : rhu(cxC + labelR * Math.cos(ang));
      const ly = n === 1 ? cyC : rhu(cyC + labelR * Math.sin(ang));
      const fill = tint[i % tint.length]!;
      const children: SceneElement[] = [
        p.circle({ x: cx, y: cy }, r, fill, fill, 0, { opacity: 0.5 }),
        p.text(it.text, lx, rhu(ly + font * 0.34), font, palette.text, { weight: 'bold', anchor: 'middle' }),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x: rhu(cx - r), y: rhu(cy - r), width: rhu(2 * r), height: rhu(2 * r) } };
      contentRight = Math.max(contentRight, cx + r);
    });

    height = rhu(top + 2 * (d + r) + margin);
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

  // `reveal none` opts out of progressive reveal: emit NO reveal track, so the
  // interactive path stays manifest-free and hosts render every item at once.
  const base = { scene, anchors: anchors as NodeAnchorRegistry };
  return doc.reveal === 'none' ? base : { ...base, reveal: { steps: buildSteps(doc) } };
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
