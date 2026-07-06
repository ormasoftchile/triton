/**
 * @file diagrams/ds/hashmap/hashmap.ts — Hash map with separate chaining.
 *
 * A vertical strip of buckets indexed 0..n-1. Each non-empty bucket points
 * right to a chain of key→value entries (a singly linked list), reusing the
 * slot/pointer kernel idiom from the linked-list struct. Empty buckets show
 * just their index.
 *
 * Value-driven mini-syntax:
 *   hashmap
 *     title users
 *     buckets 5
 *     bucket 0: alice->1, bob->2     // two chained entries
 *     bucket 2: carol->3
 *     bucket 4: dave->4
 *
 * Entry separators: `,` between entries; `->`, `=>`, `:` or `=` between
 * key and value.
 */

import type {
  DiagramModule, ResolvedTheme, LayoutResult, Scene, SceneElement, NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import { pen } from '../../../../scene/build.js';
import { measureText } from '../../../../text/metrics.js';
import { rhu } from '../../../../util/round.js';
import { ARROW_ID, arrowDef, lines } from '../struct/shared.js';

export interface HashEntry { key: string; value: string; }
export interface HashChain { index: number; entries: HashEntry[]; }

export interface HashmapDoc {
  title?: string;
  buckets: number;
  chains: HashChain[];
}

function parseEntries(spec: string): HashEntry[] {
  return spec.split(',').map(s => s.trim()).filter(Boolean).map(pair => {
    const m = pair.match(/^(.*?)\s*(?:->|=>|:|=)\s*(.*)$/);
    if (m) return { key: m[1]!.trim(), value: m[2]!.trim() };
    return { key: pair, value: '' };
  });
}

function parse(input: string): HashmapDoc {
  let title: string | undefined;
  let bucketCount: number | undefined;
  const chains: HashChain[] = [];

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'hashmap') { continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'buckets') { const n = Number(t[1]); if (Number.isFinite(n)) bucketCount = n; continue; }
    if (t[0] === 'bucket') {
      const m = line.match(/^bucket\s+(\d+)\s*:\s*(.*)$/);
      if (m) chains.push({ index: Number(m[1]), entries: parseEntries(m[2]!) });
    }
  }

  const maxIdx = chains.reduce((mx, c) => Math.max(mx, c.index), -1);
  const buckets = Math.max(bucketCount ?? maxIdx + 1, maxIdx + 1, 1);
  return { ...(title !== undefined ? { title } : {}), buckets, chains };
}

export function layoutHashmap(doc: HashmapDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 38;
  const idxW = 46;
  const entryH = 30;
  const entryGap = 30;
  const chainGap = 36;                     // bucket strip → first entry

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const origin = { x: margin, y: margin + titleH };

  const elements: SceneElement[] = [];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // bucket index column (vertical strip)
  const slots: { x: number; y: number; width: number; height: number }[] = [];
  for (let i = 0; i < doc.buckets; i++) {
    const slot = { x: origin.x, y: origin.y + i * cellH, width: idxW, height: cellH };
    slots.push(slot);
    elements.push(p.rect(slot, palette.surface, palette.border, 1.5, { rx: 3 }));
    elements.push(p.text(String(i), slot.x + slot.width / 2, slot.y + slot.height / 2 + font * 0.35, font, palette.textMuted, { anchor: 'middle', weight: 'bold' }));
  }

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  slots.forEach((slot, i) => { anchors[`b${i}`] = { bounds: slot }; });

  const chainStartX = origin.x + idxW + chainGap;
  let maxRight = chainStartX;

  for (const chain of doc.chains) {
    const slot = slots[chain.index];
    if (!slot || chain.entries.length === 0) continue;
    const cy = slot.y + slot.height / 2;
    let x = chainStartX;
    let fromX = slot.x + slot.width;
    chain.entries.forEach((e, j) => {
      const label = e.value ? `${e.key} : ${e.value}` : e.key;
      const w = measureText(label, font).width + 22;
      const box = { x, y: cy - entryH / 2, width: w, height: entryH };
      // pointer into this entry
      elements.push(p.path(`M ${rhu(fromX)} ${rhu(cy)} L ${rhu(x - 3)} ${rhu(cy)}`, palette.primary, 1.5, { markerEnd: ARROW_ID }));
      elements.push(p.rect(box, palette.surface, palette.border, 1.5, { rx: 4 }));
      elements.push(p.text(label, x + w / 2, cy + font * 0.35, font, palette.text, { anchor: 'middle', weight: 'bold' }));
      anchors[`b${chain.index}e${j}`] = { bounds: box };
      fromX = x + w;
      x = fromX + entryGap;
      maxRight = Math.max(maxRight, fromX);
    });
  }

  const width = maxRight + margin;
  const height = origin.y + doc.buckets * cellH + margin;
  const scene: Scene = {
    viewBox: { x: 0, y: 0, width, height },
    background: palette.background,
    elements,
    defs: [arrowDef(palette.primary)],
  };
  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const hashmap: DiagramModule<HashmapDoc & { version: string; metadata: Record<string, unknown> }> = {
  parseMermaid(input: string) {
    return { version: '1.0', metadata: {}, ...parse(input) };
  },
  parseYaml(input: string) {
    return JSON.parse(input);
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutHashmap(ir, theme);
  },
};
