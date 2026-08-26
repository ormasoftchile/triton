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
  DiagramModule,
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
  RevealEffect,
  RevealStep,
  ThemePalette,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { wrapText } from '../../../../text/wrap.js';
import { readableText } from '../../../../theme/contrast.js';
import { rhu } from '../../../../util/round.js';

const REVEAL_EFFECTS: readonly RevealEffect[] = ['fade', 'slide', 'grow', 'draw'];

/** Drawing styles. `bullets` is the default and preserves the original look. */
export type ListStyle =
  | 'bullets'
  | 'numbered'
  | 'block'
  | 'box'
  | 'tree'
  | 'chevron'
  | 'process'
  | 'timeline'
  | 'pyramid'
  | 'columns'
  | 'cycle'
  | 'matrix'
  | 'funnel'
  | 'stepup'
  | 'venn';
const LIST_STYLES: readonly ListStyle[] = [
  'bullets',
  'numbered',
  'block',
  'box',
  'tree',
  'chevron',
  'process',
  'timeline',
  'pyramid',
  'columns',
  'cycle',
  'matrix',
  'funnel',
  'stepup',
  'venn',
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
export function cellForIndex(
  i: number,
  flow: ProcessFlow,
  wrap: number,
): { row: number; col: number } {
  switch (flow) {
    case 'ltr':
      return { row: 0, col: i };
    case 'ttb':
      return { row: i, col: 0 };
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

/** Split into non-empty raw lines (leading whitespace PRESERVED), frontmatter removed, supporting line continuations. */
function sourceLines(input: string): string[] {
  // Theme injection (e.g. from Deckpilot) prepends a `---\ntheme: …\n---` block.
  const body = input.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const lines = body.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;
    if (line.trim().length === 0) continue;

    // Line continuation if ending with '\' or '<br>' / '<br/>' / '<br />'
    while (
      (line.trimEnd().endsWith('\\') || /(?:<br\s*\/?>)\s*$/i.test(line)) &&
      i + 1 < lines.length
    ) {
      if (line.trimEnd().endsWith('\\')) {
        line = line.trimEnd().slice(0, -1).trimEnd() + '\n' + lines[i + 1]!.trim();
      } else {
        line = line + '\n' + lines[i + 1]!.trim();
      }
      i++;
    }

    // Pipe continuation: indented line starting with "| "
    while (i + 1 < lines.length && /^\s*\|\s*/.test(lines[i + 1]!)) {
      const nextClean = lines[i + 1]!.replace(/^\s*\|\s*/, '');
      line = line + '\n' + nextClean;
      i++;
    }

    // Quoted multiline block: "Line 1 ...
    if (/^\s*"[^"]*$/.test(line)) {
      while (i + 1 < lines.length) {
        i++;
        line = line + '\n' + lines[i]!;
        if (lines[i]!.includes('"')) break;
      }
      line = line.replace(/^\s*"|"\s*$/g, '');
    }

    out.push(line);
  }

  return out;
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
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
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
    if (lower === 'list') continue; // header
    if (lower.startsWith('title ') && !trimmed.includes('::') && raw.length === 0) {
      title = trimmed.slice(6).trim();
      continue;
    }
    if (lower.startsWith('style ') && !trimmed.includes('::') && raw.length === 0) {
      style = asStyle(trimmed.slice(6).trim()) ?? style;
      continue;
    }
    if (lower.startsWith('reveal ')) {
      reveal = asMode(trimmed.slice(7).trim()) ?? reveal;
      continue;
    }
    if (lower.startsWith('effect ')) {
      effect = asEffect(trimmed.slice(7).trim()) ?? effect;
      continue;
    }
    if (lower.startsWith('group ')) {
      const num = parseInt(trimmed.slice(6).trim(), 10);
      if (Number.isFinite(num) && num >= 1) group = num;
      continue;
    }
    if (lower.startsWith('flow ')) {
      flow = asFlow(trimmed.slice(5).trim()) ?? flow;
      continue;
    }
    if (lower.startsWith('wrap ')) {
      const num = parseInt(trimmed.slice(5).trim(), 10);
      if (Number.isFinite(num) && num >= 1) wrap = num;
      continue;
    }
    if (lower.startsWith('turn ')) {
      turn = asTurn(trimmed.slice(5).trim()) ?? turn;
      continue;
    }

    // Item line. Depth comes from the RAW indentation.
    const indent = indentWidth(line);
    let text = trimmed;
    const join = /^\+\s+/.test(text);
    if (join) text = text.replace(/^\+\s+/, '');
    text = text.replace(/^[-*]\s+/, ''); // optional list marker
    let itemEffect: RevealEffect | undefined;
    const m = text.match(/\s+@(\w+)\s*$/);
    if (m) {
      const e = asEffect(m[1] ?? '');
      if (e) {
        itemEffect = e;
        text = text.slice(0, m.index ?? 0).trimEnd();
      }
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
    items,
    version: '1.0',
    metadata: frontmatterMeta(input),
  };
}

/**
 * Resolve indentation widths into a tree: assign each item a depth and a
 * stable hierarchical id/ordinal. Uses an indent stack so 2-space, 4-space,
 * or tab indentation all work; the first item establishes depth 0.
 */
function assignTree(
  raw: { indent: number; text: string; join: boolean; effect?: RevealEffect }[],
): ListItem[] {
  const stack: number[] = []; // indent widths of the current ancestor chain
  const path: number[] = []; // 0-based sibling index at each depth
  const items: ListItem[] = [];

  for (const r of raw) {
    while (stack.length > 0 && r.indent < stack[stack.length - 1]!) stack.pop();
    if (stack.length === 0 || r.indent > stack[stack.length - 1]!) {
      stack.push(r.indent);
    }
    const depth = stack.length - 1;

    // Update the sibling-index path for id/ordinal assignment.
    if (path.length === depth) {
      path.push(0); // first child at a new deeper level
    } else {
      path.length = depth + 1; // pop back up to this depth
      path[depth] = (path[depth] ?? -1) + 1;
    }

    items.push({
      text: r.text,
      depth,
      id: `item-${path.join('-')}`,
      numberLabel: path.map((num) => num + 1).join('.'),
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
      out.push({
        enter: byDepth.get(depth)!,
        effect: doc.effect ?? 'fade',
        label: `Level ${depth + 1}`,
      });
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
  return depth === 0
    ? Math.max(3, rhu(font / 6))
    : depth === 1
      ? Math.max(2.5, rhu(font / 7))
      : Math.max(2, rhu(font / 8));
}

/**
 * Build a filled arrowhead triangle path string pointing in `dir`.
 * `tx`/`ty` is the TIP (sharpest point); `al` is arrow length along direction, `aw` is half-width.
 */
function arrowTriangle(
  tx: number,
  ty: number,
  dir: 'right' | 'left' | 'down' | 'up',
  al: number,
  aw: number = Math.max(4, rhu(al * 0.55)),
): string {
  switch (dir) {
    case 'right':
      return `M ${rhu(tx - al)} ${rhu(ty - aw)} L ${tx} ${ty} L ${rhu(tx - al)} ${rhu(ty + aw)} Z`;
    case 'left':
      return `M ${rhu(tx + al)} ${rhu(ty - aw)} L ${tx} ${ty} L ${rhu(tx + al)} ${rhu(ty + aw)} Z`;
    case 'down':
      return `M ${rhu(tx - aw)} ${rhu(ty - al)} L ${tx} ${ty} L ${rhu(tx + aw)} ${rhu(ty - al)} Z`;
    case 'up':
      return `M ${rhu(tx - aw)} ${rhu(ty + al)} L ${tx} ${ty} L ${rhu(tx + aw)} ${rhu(ty + al)} Z`;
  }
}

export interface ItemTextLines {
  title?: string | undefined;
  subtitle?: string | undefined;
  titleLines?: string[] | undefined;
  subtitleLines?: string[] | undefined;
  lines: string[];
  maxLineWidth: number;
}

export function getItemLineCount(info: ItemTextLines): number {
  if (info.titleLines !== undefined) {
    return info.titleLines.length + (info.subtitleLines?.length ?? 0);
  }
  return info.lines.length;
}

export function measureItemLines(
  rawText: string,
  font: number,
  smallFont: number,
  maxAutoWrapWidth = 260,
): ItemTextLines {
  const sepIdx = rawText.indexOf('::');
  if (sepIdx !== -1) {
    const rawTitle = rawText.slice(0, sepIdx).trim();
    const rawSubtitle = rawText.slice(sepIdx + 2).trim();

    const titleNorm = rawTitle.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');
    const subNorm = rawSubtitle.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');

    const titleLines = titleNorm
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const subtitleLines = subNorm
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let titleMaxW = 0;
    for (const t of titleLines) {
      titleMaxW = Math.max(titleMaxW, measureText(t, font).width * 1.05);
    }
    let subMaxW = 0;
    for (const s of subtitleLines) {
      subMaxW = Math.max(subMaxW, measureText(s, smallFont).width);
    }

    const firstTitle = titleLines[0];
    const firstSub = subtitleLines.length > 0 ? subtitleLines.join(' ') : undefined;

    return {
      title: firstTitle,
      subtitle: firstSub,
      titleLines: titleLines.length > 0 ? titleLines : undefined,
      subtitleLines: subtitleLines.length > 0 ? subtitleLines : undefined,
      lines: [...titleLines, ...subtitleLines],
      maxLineWidth: Math.max(titleMaxW, subMaxW),
    };
  }

  const normalized = rawText.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');
  const rawLines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const r of rawLines) {
    if (measureText(r, font).width > maxAutoWrapWidth) {
      const wrapped = wrapText(r, font, maxAutoWrapWidth, 6);
      lines.push(...wrapped.lines);
    } else {
      lines.push(r);
    }
  }

  const finalLines = lines.length > 0 ? lines : [rawText];
  const maxLineWidth = finalLines.reduce((m, l) => Math.max(m, measureText(l, font).width), 0);

  return {
    lines: finalLines,
    maxLineWidth,
  };
}

export function renderItemText(
  p: ReturnType<typeof pen>,
  itemInfo: ItemTextLines,
  x: number,
  y: number,
  w: number,
  h: number,
  font: number,
  smallFont: number,
  textColor: string,
  mutedColor: string,
  align: 'start' | 'middle' = 'start',
  paddingLeft = 0,
  defaultBold = false,
): SceneElement[] {
  const elements: SceneElement[] = [];

  if (itemInfo.titleLines !== undefined) {
    const titleLines = itemInfo.titleLines;
    const subLines = itemInfo.subtitleLines ?? [];
    const titleLH = font * 1.25;
    const subLH = smallFont * 1.25;
    const totalH = titleLines.length * titleLH + subLines.length * subLH;
    const startY = y + (h - totalH) / 2 + font * 0.85;

    const titleX = align === 'middle' ? rhu(x + w / 2) : rhu(x + paddingLeft);
    const subX = titleX;

    let curY = startY;
    for (let ti = 0; ti < titleLines.length; ti++) {
      elements.push(
        p.text(titleLines[ti]!, titleX, rhu(curY), font, textColor, {
          weight: 'bold',
          anchor: align,
        }),
      );
      curY += titleLH;
    }

    for (let si = 0; si < subLines.length; si++) {
      elements.push(
        p.text(subLines[si]!, subX, rhu(curY), smallFont, mutedColor, { anchor: align }),
      );
      curY += subLH;
    }

    return elements;
  }

  const lines = itemInfo.lines;
  const count = lines.length;
  const lineH = font * 1.25;

  if (count === 1) {
    const textY = rhu(y + h / 2 + font * 0.34);
    const textX = align === 'middle' ? rhu(x + w / 2) : rhu(x + paddingLeft);
    elements.push(
      p.text(lines[0]!, textX, textY, font, textColor, {
        ...(defaultBold ? { weight: 'bold' } : {}),
        anchor: align,
      }),
    );
    return elements;
  }

  const startY = y + (h - (count - 1) * lineH) / 2 + font * 0.34;
  const textX = align === 'middle' ? rhu(x + w / 2) : rhu(x + paddingLeft);

  for (let li = 0; li < count; li++) {
    const lineY = rhu(startY + li * lineH);
    elements.push(
      p.text(lines[li]!, textX, lineY, font, textColor, {
        ...(defaultBold ? { weight: 'bold' } : {}),
        anchor: align,
      }),
    );
  }

  return elements;
}

export function layoutList(doc: ListDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;
  const indentPx = rhu(font * 1.6);
  const titleH = doc.title ? typography.titleFontSize + 16 : 0;
  const top = margin + titleH;
  const n = Math.max(doc.items.length, 1);

  const elements: SceneElement[] = [];
  const anchors: Record<
    string,
    { bounds: { x: number; y: number; width: number; height: number } }
  > = {};
  let contentRight = 0;
  let height: number;

  if (doc.style === 'block' || doc.style === 'box') {
    const pad = rhu(font * 0.8);
    const gap = rhu(font * 0.6);
    const barW = doc.style === 'box' ? Math.max(3, rhu(font * 0.35)) : 0;
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    const itemHeights = itemInfos.map((info) => {
      const lineCount = getItemLineCount(info);
      return lineCount > 1 ? rhu(lineCount * (font * 1.25) + 2 * pad) : rhu(font * 2.2);
    });

    // First pass: uniform right edge so blocks/boxes align.
    let maxRight = 0;
    doc.items.forEach((it, i) => {
      const x = margin + it.depth * indentPx;
      const tw = itemInfos[i]!.maxLineWidth;
      maxRight = Math.max(maxRight, x + barW + pad + tw + pad);
    });
    contentRight = maxRight;

    let curY = top;
    doc.items.forEach((it, i) => {
      const y = curY;
      const itemH = itemHeights[i]!;
      const x = margin + it.depth * indentPx;
      const w = rhu(contentRight - x);
      const info = itemInfos[i]!;

      const children: SceneElement[] = [
        p.rect({ x, y, width: w, height: itemH }, palette.surface, palette.border, 1, {
          rx: doc.style === 'block' ? 6 : 4,
        }),
      ];
      if (doc.style === 'box') {
        const c = markerColor(it.depth, palette);
        children.push(p.rect({ x, y, width: barW, height: itemH }, c, c, 0, { rx: 2 }));
      }
      children.push(
        ...renderItemText(
          p,
          info,
          x,
          y,
          w,
          itemH,
          font,
          smallFont,
          palette.text,
          palette.textMuted,
          'start',
          barW + pad,
        ),
      );
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: w, height: itemH } };
      curY += itemH + gap;
    });

    height = rhu(curY - gap + margin);
  } else if (doc.style === 'tree') {
    // Top-down org-chart layout of the nested list (a forest of depth-0 roots).
    const pad = rhu(font * 0.8);
    const hGap = rhu(font * 1.2);
    const vGap = rhu(font * 1.8);
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const nodeH = maxLines > 1 ? rhu(maxLines * (font * 1.25) + 2 * pad) : rhu(font * 2.2);
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
      if (kids.length === 0) {
        col[i] = nextCol;
        nextCol += 1;
        return;
      }
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
      children.push(
        p.rect(
          { x, y, width: nodeW, height: nodeH },
          palette.surface,
          stroke,
          it.depth === 0 ? 2 : 1,
          { rx: 6 },
        ),
      );
      children.push(
        ...renderItemText(
          p,
          itemInfos[i]!,
          x,
          y,
          nodeW,
          nodeH,
          font,
          smallFont,
          palette.text,
          palette.textMuted,
          'middle',
        ),
      );
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: nodeW, height: nodeH } };
    });

    height = rhu(top + maxDepth * (nodeH + vGap) + nodeH + margin);
  } else if (doc.style === 'chevron') {
    // Horizontal left→right interlocking arrow blocks.
    const padX = rhu(font * 1.0);
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const boxH = maxLines > 1 ? rhu(maxLines * (font * 1.3) + font * 1.4) : rhu(font * 2.8);
    const notch = rhu(boxH * 0.3);
    const boxW = rhu(maxTextW + 2 * padX + 2 * notch);
    const stepX = rhu(boxW - notch);
    const y = top;
    const cy = rhu(y + boxH / 2);
    const yb = rhu(y + boxH);

    doc.items.forEach((it, i) => {
      const x = rhu(margin + i * stepX);
      const fill = i % 2 === 0 ? palette.primary : palette.secondary;
      const k = notch;
      const tipR = rhu(x + boxW);
      const innerR = rhu(x + boxW - k);
      const d =
        i === 0
          ? `M ${x} ${y} L ${innerR} ${y} L ${tipR} ${cy} L ${innerR} ${yb} L ${x} ${yb} Z`
          : `M ${x} ${y} L ${innerR} ${y} L ${tipR} ${cy} L ${innerR} ${yb} L ${x} ${yb} L ${rhu(x + k)} ${cy} Z`;
      const txtColor = readableText(fill, theme);
      const mutedTxtColor = txtColor === '#ffffff' ? 'rgba(255, 255, 255, 0.8)' : palette.textMuted;
      const children: SceneElement[] = [
        p.path(d, fill, 0, { fill }),
        ...renderItemText(
          p,
          itemInfos[i]!,
          rhu(x + k / 2),
          y,
          rhu(boxW - k),
          boxH,
          font,
          smallFont,
          txtColor,
          mutedTxtColor,
          'middle',
        ),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
      contentRight = Math.max(contentRight, x + boxW);
    });

    height = rhu(top + boxH + margin);
  } else if (doc.style === 'process') {
    const flow = doc.flow ?? 'ltr';
    const padX = rhu(font * 1.0);
    const arrowGap = rhu(font * 1.8);
    const al = Math.max(8, rhu(font * 0.65));
    const aw = Math.max(4.5, rhu(font * 0.35));
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const boxH = maxLines > 1 ? rhu(maxLines * (font * 1.3) + font * 1.4) : rhu(font * 2.8);
    const boxW = rhu(maxTextW + 2 * padX);

    if (flow === 'ltr') {
      const stepX = rhu(boxW + arrowGap);
      const y = top;
      const cy = rhu(y + boxH / 2);

      doc.items.forEach((it, i) => {
        const x = rhu(margin + i * stepX);
        const children: SceneElement[] = [];
        if (i > 0) {
          const ax1 = rhu(x);
          const ax0 = rhu(x - arrowGap);
          children.push(p.path(`M ${ax0} ${cy} L ${rhu(ax1 - al)} ${cy}`, palette.textMuted, 2));
          children.push(
            p.path(arrowTriangle(ax1, cy, 'right', al, aw), palette.textMuted, 0, {
              fill: palette.textMuted,
            }),
          );
        }
        children.push(
          p.rect({ x, y, width: boxW, height: boxH }, palette.surface, palette.primary, 1.5, {
            rx: 6,
          }),
        );
        children.push(
          ...renderItemText(
            p,
            itemInfos[i]!,
            x,
            y,
            boxW,
            boxH,
            font,
            smallFont,
            palette.text,
            palette.textMuted,
            'middle',
          ),
        );
        elements.push(p.group(children, { id: it.id }));
        anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
        contentRight = Math.max(contentRight, x + boxW);
      });

      height = rhu(top + boxH + margin);
    } else {
      // Grid engine: ttb / snake / snake-v.
      const wrap = doc.wrap ?? Math.ceil(Math.sqrt(n));
      const turn = doc.turn ?? 'corridor';
      const elbow = rhu(arrowGap * 0.75);

      const hasTopTurn = flow === 'snake-v' && turn === 'corridor' && n > 2 * wrap;
      const hasBottomTurn = flow === 'snake-v' && turn === 'corridor' && n > wrap;
      const topExtra = hasTopTurn ? rhu(elbow + font * 0.3) : 0;
      const processTop = top + topExtra;

      const cellX = (col: number) => rhu(margin + col * (boxW + arrowGap));
      const cellY = (row: number) => rhu(processTop + row * (boxH + arrowGap));

      let maxRow = 0;

      doc.items.forEach((it, i) => {
        const { row, col } = cellForIndex(i, flow, wrap);
        maxRow = Math.max(maxRow, row);
        const x = cellX(col);
        const y = cellY(row);
        const cx = rhu(x + boxW / 2);
        const cy = rhu(y + boxH / 2);
        const children: SceneElement[] = [];

        if (i > 0) {
          const prev = cellForIndex(i - 1, flow, wrap);
          const prevX = cellX(prev.col);
          const prevY = cellY(prev.row);
          const prevCX = rhu(prevX + boxW / 2);
          const prevCY = rhu(prevY + boxH / 2);

          const isTurn = flow === 'snake' ? prev.row !== row : prev.col !== col;

          if (!isTurn) {
            if (flow === 'ttb') {
              const ty = y;
              children.push(
                p.path(
                  `M ${cx} ${rhu(prevY + boxH)} L ${cx} ${rhu(ty - al)}`,
                  palette.textMuted,
                  2,
                ),
              );
              children.push(
                p.path(arrowTriangle(cx, ty, 'down', al, aw), palette.textMuted, 0, {
                  fill: palette.textMuted,
                }),
              );
            } else if (flow === 'snake') {
              if (row % 2 === 0) {
                children.push(
                  p.path(
                    `M ${rhu(prevX + boxW)} ${cy} L ${rhu(x - al)} ${cy}`,
                    palette.textMuted,
                    2,
                  ),
                );
                children.push(
                  p.path(arrowTriangle(x, cy, 'right', al, aw), palette.textMuted, 0, {
                    fill: palette.textMuted,
                  }),
                );
              } else {
                const tipX = rhu(x + boxW);
                children.push(
                  p.path(`M ${prevX} ${cy} L ${rhu(tipX + al)} ${cy}`, palette.textMuted, 2),
                );
                children.push(
                  p.path(arrowTriangle(tipX, cy, 'left', al, aw), palette.textMuted, 0, {
                    fill: palette.textMuted,
                  }),
                );
              }
            } else {
              if (col % 2 === 0) {
                const ty = y;
                children.push(
                  p.path(
                    `M ${cx} ${rhu(prevY + boxH)} L ${cx} ${rhu(ty - al)}`,
                    palette.textMuted,
                    2,
                  ),
                );
                children.push(
                  p.path(arrowTriangle(cx, ty, 'down', al, aw), palette.textMuted, 0, {
                    fill: palette.textMuted,
                  }),
                );
              } else {
                const tipY = rhu(y + boxH);
                children.push(
                  p.path(`M ${cx} ${prevY} L ${cx} ${rhu(tipY + al)}`, palette.textMuted, 2),
                );
                children.push(
                  p.path(arrowTriangle(cx, tipY, 'up', al, aw), palette.textMuted, 0, {
                    fill: palette.textMuted,
                  }),
                );
              }
            }
          } else if (flow === 'snake') {
            if (turn === 'direct') {
              children.push(
                p.path(
                  `M ${prevCX} ${rhu(prevY + boxH)} L ${prevCX} ${rhu(y - al)}`,
                  palette.textMuted,
                  2,
                ),
              );
              children.push(
                p.path(arrowTriangle(prevCX, y, 'down', al, aw), palette.textMuted, 0, {
                  fill: palette.textMuted,
                }),
              );
            } else if (prev.row % 2 === 0) {
              const rx = rhu(prevX + boxW);
              children.push(
                p.path(
                  `M ${rx} ${prevCY} L ${rhu(rx + elbow)} ${prevCY} L ${rhu(rx + elbow)} ${cy} L ${rhu(rx + al)} ${cy}`,
                  palette.textMuted,
                  2,
                ),
              );
              children.push(
                p.path(arrowTriangle(rx, cy, 'left', al, aw), palette.textMuted, 0, {
                  fill: palette.textMuted,
                }),
              );
              contentRight = Math.max(contentRight, rhu(rx + elbow + margin));
            } else {
              const lx = prevX;
              children.push(
                p.path(
                  `M ${lx} ${prevCY} L ${rhu(lx - elbow)} ${prevCY} L ${rhu(lx - elbow)} ${cy} L ${rhu(lx - al)} ${cy}`,
                  palette.textMuted,
                  2,
                ),
              );
              children.push(
                p.path(arrowTriangle(lx, cy, 'right', al, aw), palette.textMuted, 0, {
                  fill: palette.textMuted,
                }),
              );
            }
          } else {
            if (turn === 'direct') {
              children.push(
                p.path(`M ${rhu(prevX + boxW)} ${cy} L ${rhu(x - al)} ${cy}`, palette.textMuted, 2),
              );
              children.push(
                p.path(arrowTriangle(x, cy, 'right', al, aw), palette.textMuted, 0, {
                  fill: palette.textMuted,
                }),
              );
            } else if (prev.col % 2 === 0) {
              const by = rhu(prevY + boxH);
              children.push(
                p.path(
                  `M ${prevCX} ${by} L ${prevCX} ${rhu(by + elbow)} L ${cx} ${rhu(by + elbow)} L ${cx} ${rhu(by + al)}`,
                  palette.textMuted,
                  2,
                ),
              );
              children.push(
                p.path(arrowTriangle(cx, by, 'up', al, aw), palette.textMuted, 0, {
                  fill: palette.textMuted,
                }),
              );
            } else {
              const ty = prevY;
              children.push(
                p.path(
                  `M ${prevCX} ${ty} L ${prevCX} ${rhu(ty - elbow)} L ${cx} ${rhu(ty - elbow)} L ${cx} ${rhu(ty - al)}`,
                  palette.textMuted,
                  2,
                ),
              );
              children.push(
                p.path(arrowTriangle(cx, ty, 'down', al, aw), palette.textMuted, 0, {
                  fill: palette.textMuted,
                }),
              );
            }
          }
        }

        children.push(
          p.rect({ x, y, width: boxW, height: boxH }, palette.surface, palette.primary, 1.5, {
            rx: 6,
          }),
        );
        children.push(
          ...renderItemText(
            p,
            itemInfos[i]!,
            x,
            y,
            boxW,
            boxH,
            font,
            smallFont,
            palette.text,
            palette.textMuted,
            'middle',
          ),
        );
        elements.push(p.group(children, { id: it.id }));
        anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
        contentRight = Math.max(contentRight, x + boxW);
      });

      const bottomExtra = hasBottomTurn ? elbow : 0;
      height = rhu(processTop + (maxRow + 1) * (boxH + arrowGap) - arrowGap + bottomExtra + margin);
    }
  } else if (doc.style === 'timeline') {
    const dotR = Math.max(5, rhu(font * 0.5));
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const lineH = font * 1.25;
    const labelH = maxLines > 1 ? rhu(maxLines * lineH + font * 0.6) : rhu(font * 1.8);
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
      const ly = above
        ? rhu(axisY - dotR - 8 - (maxLines > 1 ? (maxLines - 1) * lineH : 0))
        : rhu(axisY + dotR + font + 4);
      const info = itemInfos[i]!;

      if (info.titleLines !== undefined) {
        let curY = ly;
        for (const tl of info.titleLines) {
          children.push(
            p.text(tl, cx, curY, font, palette.text, { weight: 'bold', anchor: 'middle' }),
          );
          curY = rhu(curY + lineH);
        }
        if (info.subtitleLines) {
          for (const sl of info.subtitleLines) {
            children.push(
              p.text(sl, cx, curY, smallFont, palette.textMuted, {
                anchor: 'middle',
              }),
            );
            curY = rhu(curY + smallFont * 1.25);
          }
        }
      } else if (info.lines.length > 1) {
        info.lines.forEach((l, li) => {
          children.push(
            p.text(l, cx, rhu(ly + li * lineH), font, palette.text, { anchor: 'middle' }),
          );
        });
      } else {
        children.push(
          p.text(info.lines[0] ?? it.text, cx, ly, font, palette.text, { anchor: 'middle' }),
        );
      }

      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = {
        bounds: {
          x: rhu(cx - stepX / 2),
          y: top,
          width: stepX,
          height: rhu(labelH * 2 + dotR * 2),
        },
      };
      contentRight = Math.max(contentRight, cx + stepX / 2);
    });

    height = rhu(axisY + dotR + font + labelH + margin);
  } else if (doc.style === 'pyramid') {
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const bandH = maxLines > 1 ? rhu(maxLines * (font * 1.3) + font * 1.4) : rhu(font * 2.8);
    const vGap = rhu(font * 0.4);
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
      const txtColor = readableText(fill, theme);
      const mutedTxtColor = txtColor === '#ffffff' ? 'rgba(255, 255, 255, 0.8)' : palette.textMuted;
      const children: SceneElement[] = [
        p.path(d, fill, 0, { fill }),
        ...renderItemText(
          p,
          itemInfos[i]!,
          bl,
          yTop,
          rhu(br - bl),
          bandH,
          font,
          smallFont,
          txtColor,
          mutedTxtColor,
          'middle',
        ),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x: bl, y: yTop, width: rhu(br - bl), height: bandH } };
      contentRight = Math.max(contentRight, cxCenter + baseW / 2);
    });

    height = rhu(top + n * (bandH + vGap) - vGap + margin);
  } else if (doc.style === 'columns') {
    interface Col {
      header: ListItem;
      cells: ListItem[];
    }
    const cols: Col[] = [];
    for (const it of doc.items) {
      if (it.depth === 0 || cols.length === 0) cols.push({ header: it, cells: [] });
      else cols[cols.length - 1]!.cells.push(it);
    }
    const itemInfos = new Map<string, ItemTextLines>();
    doc.items.forEach((it) => {
      itemInfos.set(it.id, measureItemLines(it.text, font, smallFont));
    });

    let maxHeaderLines = 1;
    let maxCellLines = 1;
    cols.forEach((c) => {
      const hInfo = itemInfos.get(c.header.id)!;
      const hCount = getItemLineCount(hInfo);
      maxHeaderLines = Math.max(maxHeaderLines, hCount);
      c.cells.forEach((ce) => {
        const cInfo = itemInfos.get(ce.id)!;
        const cCount = getItemLineCount(cInfo);
        maxCellLines = Math.max(maxCellLines, cCount);
      });
    });

    const headerH =
      maxHeaderLines > 1 ? rhu(maxHeaderLines * (font * 1.3) + font * 1.0) : rhu(font * 2.4);
    const cellH =
      maxCellLines > 1 ? rhu(maxCellLines * (font * 1.25) + font * 0.7) : rhu(font * 2.0);
    const gap = rhu(font * 0.5);
    const colGap = rhu(font * 1.2);
    const padX = rhu(font * 0.9);

    let x = margin;
    let maxCells = 0;
    const colX: number[] = [];
    const colW: number[] = [];
    cols.forEach((c) => {
      let w = itemInfos.get(c.header.id)!.maxLineWidth;
      c.cells.forEach((ce) => {
        w = Math.max(w, itemInfos.get(ce.id)!.maxLineWidth);
      });
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
      const hInfo = itemInfos.get(c.header.id)!;
      const hchildren: SceneElement[] = [
        p.rect(
          { x: cx0, y: top, width: cw, height: headerH },
          palette.primary,
          palette.primary,
          0,
          { rx: 6 },
        ),
        ...renderItemText(
          p,
          hInfo,
          cx0,
          top,
          cw,
          headerH,
          font,
          smallFont,
          readableText(palette.primary, theme),
          'rgba(255, 255, 255, 0.8)',
          'middle',
          0,
          true,
        ),
      ];
      elements.push(p.group(hchildren, { id: c.header.id }));
      anchors[c.header.id] = { bounds: { x: cx0, y: top, width: cw, height: headerH } };

      c.cells.forEach((ce, ri) => {
        const cy0 = rhu(top + headerH + gap + ri * (cellH + gap));
        const cInfo = itemInfos.get(ce.id)!;
        const cch: SceneElement[] = [
          p.rect({ x: cx0, y: cy0, width: cw, height: cellH }, palette.surface, palette.border, 1, {
            rx: 4,
          }),
          ...renderItemText(
            p,
            cInfo,
            cx0,
            cy0,
            cw,
            cellH,
            font,
            smallFont,
            palette.text,
            palette.textMuted,
            'middle',
          ),
        ];
        elements.push(p.group(cch, { id: ce.id }));
        anchors[ce.id] = { bounds: { x: cx0, y: cy0, width: cw, height: cellH } };
      });
    });

    height = rhu(top + headerH + gap + maxCells * (cellH + gap) + margin);
  } else if (doc.style === 'cycle') {
    const pad = rhu(font * 0.9);
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const nodeH = maxLines > 1 ? rhu(maxLines * (font * 1.25) + 2 * pad) : rhu(font * 2.2);
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
          const pa = a1 - 0.12;
          const px = cxC + R * Math.cos(pa);
          const py = cyC + R * Math.sin(pa);
          const dx = ex - px,
            dy = ey - py;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len,
            uy = dy / len;
          const ah = Math.max(6, rhu(font * 0.6));
          const bx = ex - ux * ah,
            by = ey - uy * ah;
          const tri = `M ${rhu(bx - uy * ah * 0.6)} ${rhu(by + ux * ah * 0.6)} L ${ex} ${ey} L ${rhu(bx + uy * ah * 0.6)} ${rhu(by - ux * ah * 0.6)} Z`;
          children.push(p.path(tri, palette.primary, 0, { fill: palette.primary }));
        }
      }

      children.push(
        p.rect({ x, y, width: nodeW, height: nodeH }, palette.surface, palette.primary, 1.5, {
          rx: 8,
        }),
      );
      children.push(
        ...renderItemText(
          p,
          itemInfos[i]!,
          x,
          y,
          nodeW,
          nodeH,
          font,
          smallFont,
          palette.text,
          palette.textMuted,
          'middle',
        ),
      );
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: nodeW, height: nodeH } };
      contentRight = Math.max(contentRight, x + nodeW);
    });

    height = rhu(top + 2 * R + nodeH + margin);
  } else if (doc.style === 'matrix') {
    const quad = [palette.primary, palette.secondary, palette.success, palette.warning];
    const cols = 2;
    const rows = Math.ceil(n / cols);
    const pad = rhu(font * 0.9);
    const gap = rhu(font * 0.5);
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const tileW = rhu(maxTextW + 2 * pad);
    const tileH = maxLines > 1 ? rhu(maxLines * (font * 1.3) + font * 1.8) : rhu(font * 3.2);

    doc.items.forEach((it, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = rhu(margin + c * (tileW + gap));
      const y = rhu(top + r * (tileH + gap));
      const fill = quad[i % quad.length]!;
      const txtColor = readableText(fill, theme);
      const mutedTxtColor = txtColor === '#ffffff' ? 'rgba(255, 255, 255, 0.8)' : palette.textMuted;
      const children: SceneElement[] = [
        p.rect({ x, y, width: tileW, height: tileH }, fill, fill, 0, { rx: 6 }),
        ...renderItemText(
          p,
          itemInfos[i]!,
          x,
          y,
          tileW,
          tileH,
          font,
          smallFont,
          txtColor,
          mutedTxtColor,
          'middle',
          0,
          true,
        ),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: tileW, height: tileH } };
      contentRight = Math.max(contentRight, x + tileW);
    });

    height = rhu(top + rows * (tileH + gap) - gap + margin);
  } else if (doc.style === 'funnel') {
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const bandH = maxLines > 1 ? rhu(maxLines * (font * 1.3) + font * 1.4) : rhu(font * 2.8);
    const vGap = rhu(font * 0.4);
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
      const txtColor = readableText(fill, theme);
      const mutedTxtColor = txtColor === '#ffffff' ? 'rgba(255, 255, 255, 0.8)' : palette.textMuted;
      const children: SceneElement[] = [
        p.path(d, fill, 0, { fill }),
        ...renderItemText(
          p,
          itemInfos[i]!,
          tl,
          yTop,
          rhu(tr - tl),
          bandH,
          font,
          smallFont,
          txtColor,
          mutedTxtColor,
          'middle',
        ),
      ];
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x: tl, y: yTop, width: rhu(tr - tl), height: bandH } };
      contentRight = Math.max(contentRight, cxCenter + baseW / 2);
    });

    height = rhu(top + n * (bandH + vGap) - vGap + margin);
  } else if (doc.style === 'stepup') {
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    let maxLines = 1;
    itemInfos.forEach((info) => {
      maxTextW = Math.max(maxTextW, info.maxLineWidth);
      const lc = getItemLineCount(info);
      maxLines = Math.max(maxLines, lc);
    });
    const boxH = maxLines > 1 ? rhu(maxLines * (font * 1.3) + font * 1.2) : rhu(font * 2.4);
    const gapX = rhu(font * 0.8);
    const stepUp = rhu(boxH * 0.7);
    const boxW = rhu(maxTextW + 2 * rhu(font * 0.9));
    const topmost = top;
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
        children.push(
          p.path(
            `M ${px} ${py} L ${rhu((px + x) / 2)} ${py} L ${rhu((px + x) / 2)} ${cy} L ${x} ${cy}`,
            palette.border,
            1.5,
          ),
        );
      }
      children.push(
        p.rect({ x, y, width: boxW, height: boxH }, palette.surface, palette.primary, 1.5, {
          rx: 6,
        }),
      );
      children.push(
        ...renderItemText(
          p,
          itemInfos[i]!,
          x,
          y,
          boxW,
          boxH,
          font,
          smallFont,
          palette.text,
          palette.textMuted,
          'middle',
        ),
      );
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y, width: boxW, height: boxH } };
      contentRight = Math.max(contentRight, x + boxW);
    });

    height = rhu(top + (n - 1) * stepUp + boxH + margin);
  } else if (doc.style === 'venn') {
    const tint = [
      palette.primary,
      palette.secondary,
      palette.success,
      palette.warning,
      palette.error,
    ];
    const itemInfos = doc.items.map((it) => measureItemLines(it.text, font, smallFont));
    let maxTextW = 0;
    itemInfos.forEach((it) => {
      maxTextW = Math.max(maxTextW, it.maxLineWidth);
    });
    const r = rhu(Math.max(font * 3.4, maxTextW / 2 + font));
    const d = n > 1 ? rhu(r * 0.72) : 0;
    const start = n === 2 ? Math.PI : -Math.PI / 2;
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
      const info = itemInfos[i]!;
      const children: SceneElement[] = [
        p.circle({ x: cx, y: cy }, r, fill, fill, 0, { opacity: 0.5 }),
      ];

      if (info.titleLines !== undefined) {
        const titleLH = font * 1.25;
        const subLH = smallFont * 1.25;
        const totalLines = info.titleLines.length + (info.subtitleLines?.length ?? 0);
        let curY = rhu(ly + font * 0.34 - ((totalLines - 1) * titleLH) / 2);
        for (const tl of info.titleLines) {
          children.push(
            p.text(tl, lx, curY, font, palette.text, {
              weight: 'bold',
              anchor: 'middle',
            }),
          );
          curY = rhu(curY + titleLH);
        }
        if (info.subtitleLines) {
          for (const sl of info.subtitleLines) {
            children.push(
              p.text(sl, lx, curY, smallFont, palette.textMuted, {
                anchor: 'middle',
              }),
            );
            curY = rhu(curY + subLH);
          }
        }
      } else if (info.lines.length > 1) {
        const lineH = font * 1.2;
        const startY = rhu(ly + font * 0.34 - ((info.lines.length - 1) * lineH) / 2);
        info.lines.forEach((l, li) => {
          children.push(
            p.text(l, lx, rhu(startY + li * lineH), font, palette.text, {
              weight: 'bold',
              anchor: 'middle',
            }),
          );
        });
      } else {
        children.push(
          p.text(info.lines[0] ?? it.text, lx, rhu(ly + font * 0.34), font, palette.text, {
            weight: 'bold',
            anchor: 'middle',
          }),
        );
      }

      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = {
        bounds: { x: rhu(cx - r), y: rhu(cy - r), width: rhu(2 * r), height: rhu(2 * r) },
      };
      contentRight = Math.max(contentRight, cx + r);
    });

    height = rhu(top + 2 * (d + r) + margin);
  } else {
    let curY = top;

    doc.items.forEach((it, i) => {
      const info = measureItemLines(it.text, font, smallFont);
      const lineCount = getItemLineCount(info);
      const rowH = lineCount > 1 ? rhu(lineCount * (font * 1.25) + font * 0.4) : rhu(font * 1.9);
      const rowY = curY;
      const cy = lineCount > 1 ? rowY + font * 0.85 : rowY + rowH / 2;
      const x = margin + it.depth * indentPx;
      const children: SceneElement[] = [];
      let textX: number;

      if (doc.style === 'numbered') {
        const label = `${it.numberLabel}.`;
        const numBaseline = lineCount > 1 ? rhu(rowY + font * 0.85) : rhu(cy + font * 0.34);
        children.push(
          p.text(label, x, numBaseline, font, palette.primary, { weight: 'bold', anchor: 'start' }),
        );
        textX = x + measureText(label, font).width + 10;
      } else {
        const r = markerRadius(it.depth, font);
        const c = markerColor(it.depth, palette);
        children.push(p.circle({ x: x + r, y: rhu(cy) }, r, c, c, 0));
        textX = x + r * 2 + 12;
      }

      if (info.titleLines !== undefined) {
        const titleLH = font * 1.25;
        const subLH = smallFont * 1.25;
        let curTextY = rhu(rowY + font * 0.85);

        for (let ti = 0; ti < info.titleLines.length; ti++) {
          children.push(
            p.text(info.titleLines[ti]!, textX, curTextY, font, palette.text, {
              weight: 'bold',
              anchor: 'start',
            }),
          );
          curTextY += titleLH;
        }

        if (info.subtitleLines) {
          for (let si = 0; si < info.subtitleLines.length; si++) {
            children.push(
              p.text(info.subtitleLines[si]!, textX, curTextY, smallFont, palette.textMuted, {
                anchor: 'start',
              }),
            );
            curTextY += subLH;
          }
        }
      } else if (info.lines.length > 1) {
        const lineH = font * 1.25;
        info.lines.forEach((line, li) => {
          const ly = rhu(rowY + font * 0.85 + li * lineH);
          children.push(p.text(line, textX, ly, font, palette.text, { anchor: 'start' }));
        });
      } else {
        const textBaseline = rhu(rowY + rowH / 2 + font * 0.34);
        children.push(
          p.text(info.lines[0] ?? it.text, textX, textBaseline, font, palette.text, {
            anchor: 'start',
          }),
        );
      }

      const tw = info.maxLineWidth;
      contentRight = Math.max(contentRight, textX + tw);
      elements.push(p.group(children, { id: it.id }));
      anchors[it.id] = { bounds: { x, y: rowY, width: rhu(textX - x + tw), height: rowH } };
      curY += rowH;
    });

    height = rhu(curY + margin);
  }

  if (doc.title) {
    elements.unshift(
      p.text(
        doc.title,
        margin,
        rhu(margin + typography.titleFontSize),
        typography.titleFontSize,
        palette.text,
        { weight: 'bold' },
      ),
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
