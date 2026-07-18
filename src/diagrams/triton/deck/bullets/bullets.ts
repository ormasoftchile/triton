/**
 * @file diagrams/triton/deck/bullets/bullets.ts — staged bullet list.
 *
 * A PowerPoint-style vertical bullet list, and the FIRST citizen of Triton's
 * reveal-native "deck" family. Each item is wrapped in its own `<g id="…">`
 * group and gets one reveal step, so a presentation host (Deckpilot) can reveal
 * the list one bullet at a time.
 *
 * The reveal choreography is emitted as a RevealTrack on the LayoutResult. It
 * is PURE DATA: the static SVG (via renderSync) renders identically and carries
 * no reveal manifest — only the interactive render path serializes it.
 *
 * Line-based mini-syntax:
 *   bullets
 *     title Agenda
 *     effect slide            # global default reveal effect (fade|slide|grow|draw)
 *     group 2                 # reveal items in chunks of N per step
 *     Introduction
 *     The problem
 *     + and its cost          # `+` joins this item into the PREVIOUS step
 *     Our approach @grow      # trailing `@<effect>` overrides this step's effect
 *     Results
 *
 * A leading `-` or `*` marker on an item line is optional and stripped.
 *
 * Reveal choreography (interactive path only):
 *   - Default: one step per item.
 *   - `group N`: items are chunked N-per-step.
 *   - `+` prefix: force-merge an item into the current step (overrides chunking).
 *   - Step effect precedence: first item's `@effect` > global `effect` > 'fade'.
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement,
  NodeAnchorRegistry, RevealEffect,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';

const REVEAL_EFFECTS: readonly RevealEffect[] = ['fade', 'slide', 'grow', 'draw'];

function asEffect(token: string): RevealEffect | undefined {
  const t = token.toLowerCase() as RevealEffect;
  return REVEAL_EFFECTS.includes(t) ? t : undefined;
}

export interface BulletsDoc {
  title?: string;
  items: string[];
  /** Global default reveal effect for every step. */
  effect?: RevealEffect;
  /** Reveal items in chunks of this many per step (>= 1). */
  group?: number;
  /** Parallel to `items`: true when the item joins the PREVIOUS reveal step. */
  joins: boolean[];
  /** Parallel to `items`: per-item reveal-effect override (undefined = inherit). */
  effects: (RevealEffect | undefined)[];
  version: string;
  metadata: Record<string, unknown>;
}

/** Split into trimmed, non-empty lines, with any leading `---…---` frontmatter block removed. */
function sourceLines(input: string): string[] {
  // Theme injection (e.g. from Deckpilot) prepends a `---\ntheme: …\n---` block.
  // Unlike keyword-driven diagrams, bullets treats each line as an item, so the
  // frontmatter must be stripped or it would leak in as bullet items.
  const body = input.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  return body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

/**
 * Parse a leading `---…---` YAML-ish frontmatter block into a flat key/value
 * map. Only simple `key: value` lines are recognized. Triton's frontend reads
 * `metadata.theme` to resolve the diagram theme, so this is how a host-injected
 * or author-written `theme:` reaches the theme resolver. Returns `{}` when there
 * is no frontmatter.
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

export function parseBullets(input: string): BulletsDoc {
  let title: string | undefined;
  let effect: RevealEffect | undefined;
  let group: number | undefined;
  const items: string[] = [];
  const joins: boolean[] = [];
  const effects: (RevealEffect | undefined)[] = [];

  for (const line of sourceLines(input)) {
    const lower = line.toLowerCase();
    if (lower === 'bullets') continue;                 // header
    if (lower.startsWith('title ')) { title = line.slice(6).trim(); continue; }
    if (lower.startsWith('effect ')) { effect = asEffect(line.slice(7).trim()) ?? effect; continue; }
    if (lower.startsWith('group ')) {
      const n = parseInt(line.slice(6).trim(), 10);
      if (Number.isFinite(n) && n >= 1) group = n;
      continue;
    }

    // Item line. A leading `+` joins into the previous step.
    let text = line;
    const join = /^\+\s+/.test(text);
    if (join) text = text.replace(/^\+\s+/, '');
    // Strip an optional leading list marker.
    text = text.replace(/^[-*]\s+/, '');
    // A trailing `@<effect>` token overrides this step's effect.
    let itemEffect: RevealEffect | undefined;
    const m = text.match(/\s+@(\w+)\s*$/);
    if (m) {
      const e = asEffect(m[1] ?? '');
      if (e) { itemEffect = e; text = text.slice(0, m.index ?? 0).trimEnd(); }
    }

    items.push(text);
    joins.push(join);
    effects.push(itemEffect);
  }

  return {
    ...(title !== undefined ? { title } : {}),
    ...(effect !== undefined ? { effect } : {}),
    ...(group !== undefined ? { group } : {}),
    items, joins, effects, version: '1.0', metadata: frontmatterMeta(input),
  };
}

export function layoutBullets(doc: BulletsDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;

  const rowH = rhu(font * 1.9);
  const markerR = Math.max(3, rhu(font / 6));
  const markerCx = margin + markerR;                 // dot centre x
  const textX = margin + markerR * 2 + 14;           // label start x
  const titleH = doc.title ? typography.titleFontSize + 16 : 0;
  const top = margin + titleH;

  const elements: SceneElement[] = [];
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};

  let maxTextW = 0;
  doc.items.forEach((item, i) => {
    const w = measureText(item, font).width;
    if (w > maxTextW) maxTextW = w;

    const rowY = top + i * rowH;
    const cy = rowY + rowH / 2;

    const dot = p.circle({ x: markerCx, y: rhu(cy) }, markerR, palette.primary, palette.primary, 0);
    const label = p.text(item, textX, rhu(cy + font * 0.34), font, palette.text, { anchor: 'start' });

    elements.push(p.group([dot, label], { id: `bullet-${i}` }));
    anchors[`bullet-${i}`] = { bounds: { x: margin, y: rowY, width: rhu(textX - margin + w), height: rowH } };
  });

  // ── Reveal choreography ──────────────────────────────────────────────────
  // Group items into steps: `+`-prefixed items merge into the current step,
  // otherwise `group N` chunks items N-per-step (default N=1 → one per item).
  type MutStep = { index: number; enter: string[]; effect: RevealEffect; label: string };
  const chunk = doc.group && doc.group >= 1 ? doc.group : 1;
  const steps: MutStep[] = [];
  let inStep = 0;
  doc.items.forEach((item, i) => {
    const id = `bullet-${i}`;
    let startNew: boolean;
    if (steps.length === 0) startNew = true;
    else if (doc.joins[i]) startNew = false;
    else startNew = inStep >= chunk;

    if (startNew) {
      steps.push({
        index: steps.length + 1,
        enter: [id],
        effect: doc.effects[i] ?? doc.effect ?? 'fade',
        label: item,
      });
      inStep = 1;
    } else {
      const last = steps[steps.length - 1]!;
      last.enter.push(id);
      inStep++;
    }
  });

  if (doc.title) {
    elements.unshift(
      p.text(doc.title, margin, rhu(margin + typography.titleFontSize), typography.titleFontSize, palette.text, { weight: 'bold' }),
    );
  }

  const width = rhu(textX + maxTextW + margin);
  const height = rhu(top + Math.max(doc.items.length, 1) * rowH + margin);

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width, height },
    background: palette.background,
    elements,
  };

  return {
    scene,
    anchors: anchors as NodeAnchorRegistry,
    reveal: { steps },
  };
}

export const bullets: DiagramModule<BulletsDoc> = {
  parseMermaid(input: string): BulletsDoc {
    return parseBullets(input);
  },
  parseYaml(input: string): BulletsDoc {
    return JSON.parse(input) as BulletsDoc;
  },
  layout(ir: BulletsDoc, theme: ResolvedTheme): LayoutResult {
    return layoutBullets(ir, theme);
  },
};
