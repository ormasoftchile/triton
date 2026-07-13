/**
 * @file diagrams/ds/hashmap/hashmap.ts — Hash map with separate chaining.
 *
 * A vertical strip of buckets. Each non-empty bucket points right to a chain
 * of key→value entries (a singly linked list), reusing the slot/pointer
 * kernel idiom from the linked-list struct. Buckets can be numbered or labeled
 * with arbitrary strings, and empty buckets show their configured label.
 *
 * Value-driven mini-syntax:
 *   hashmap
 *     title users
 *     buckets name, email, phone
 *     bucket name: alice->1, bob->2  // two chained entries
 *     bucket phone: carol->3
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
export interface HashChain { index: number | string; entries: HashEntry[]; }

export interface HashmapDoc {
  title?: string;
  buckets: number;
  bucketLabels: string[];
  chains: HashChain[];
}

function parseEntries(spec: string): HashEntry[] {
  return spec.split(',').map(s => s.trim()).filter(Boolean).map(pair => {
    const m = pair.match(/^(.*?)\s*(?:->|=>|:|=)\s*(.*)$/);
    if (m) return { key: m[1]!.trim(), value: m[2]!.trim() };
    return { key: pair, value: '' };
  });
}

function parseBucketLabels(spec: string): string[] {
  const labels: string[] = [];
  let current = '';
  let inQuotes = false;
  let escaping = false;

  for (const ch of spec) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (inQuotes && ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ',') {
      const label = current.trim();
      if (label) labels.push(label);
      current = '';
      continue;
    }
    current += ch;
  }

  if (inQuotes) throw new Error(`Unterminated bucket label: ${spec}`);
  const tail = current.trim();
  if (tail) labels.push(tail);
  return labels;
}

function splitBucketDirective(spec: string): { id: string; entries: string } | null {
  let inQuotes = false;
  let escaping = false;

  for (let i = 0; i < spec.length; i++) {
    const ch = spec[i]!;
    if (escaping) {
      escaping = false;
      continue;
    }
    if (inQuotes && ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ':') {
      return { id: spec.slice(0, i).trim(), entries: spec.slice(i + 1).trim() };
    }
  }

  return null;
}

function parseBucketId(spec: string): number | string {
  const [label = ''] = parseBucketLabels(spec);
  return /^\d+$/.test(label) ? Number(label) : label;
}

function normalizeDoc(doc: { title?: string | undefined; buckets?: number | undefined; bucketLabels?: string[] | undefined; chains?: HashChain[] | undefined }): HashmapDoc {
  const chains = doc.chains ?? [];
  const bucketLabels = [...(doc.bucketLabels ?? [])];
  for (const chain of chains) {
    if (typeof chain.index === 'string' && !bucketLabels.includes(chain.index)) bucketLabels.push(chain.index);
  }

  const maxIdx = chains.reduce((mx, c) => typeof c.index === 'number' ? Math.max(mx, c.index) : mx, -1);
  const numericBucketCount = Math.max(doc.buckets ?? 0, maxIdx + 1, 1);
  if (bucketLabels.length === 0) {
    for (let i = 0; i < numericBucketCount; i++) bucketLabels.push(String(i));
  } else {
    while (bucketLabels.length < numericBucketCount) bucketLabels.push(String(bucketLabels.length));
  }

  return {
    ...(doc.title !== undefined ? { title: doc.title } : {}),
    buckets: bucketLabels.length,
    bucketLabels,
    chains,
  };
}

function parse(input: string): HashmapDoc {
  let title: string | undefined;
  let bucketCount: number | undefined;
  let explicitBucketLabels: string[] | undefined;
  const chains: HashChain[] = [];

  for (const line of lines(input)) {
    const t = line.split(/\s+/);
    if (t[0] === 'hashmap') { continue; }
    if (t[0] === 'title') { title = line.slice(5).trim(); continue; }
    if (t[0] === 'buckets') {
      const spec = line.slice(7).trim();
      if (!spec) continue;
      if (/^\d+$/.test(spec)) {
        bucketCount = Number(spec);
        explicitBucketLabels = undefined;
      } else {
        explicitBucketLabels = parseBucketLabels(spec);
      }
      continue;
    }
    if (t[0] === 'bucket') {
      const parsed = splitBucketDirective(line.slice(6).trim());
      if (parsed) chains.push({ index: parseBucketId(parsed.id), entries: parseEntries(parsed.entries) });
    }
  }

  return normalizeDoc({ title, buckets: bucketCount, bucketLabels: explicitBucketLabels, chains });
}

function bucketKey(id: number | string): string {
  return typeof id === 'number' ? `n:${id}` : `s:${id}`;
}

export function layoutHashmap(doc: HashmapDoc, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const cellH = 38;
  const idxW = Math.max(46, ...doc.bucketLabels.map(label => measureText(label, font).width + 24));
  const entryH = 30;
  const entryGap = 30;
  const chainGap = 36;                     // bucket strip → first entry

  const titleH = doc.title ? typography.titleFontSize + 14 : 0;
  const origin = { x: margin, y: margin + titleH };

  const elements: SceneElement[] = [];
  if (doc.title) {
    elements.push(p.text(doc.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // bucket label column (vertical strip)
  const slotById = new Map<string, { row: number; bounds: { x: number; y: number; width: number; height: number } }>();
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  for (let i = 0; i < doc.buckets; i++) {
    const slot = { x: origin.x, y: origin.y + i * cellH, width: idxW, height: cellH };
    const label = doc.bucketLabels[i] ?? String(i);
    slotById.set(bucketKey(i), { row: i, bounds: slot });
    if (!slotById.has(bucketKey(label))) slotById.set(bucketKey(label), { row: i, bounds: slot });
    anchors[`b${i}`] = { bounds: slot };
    elements.push(p.rect(slot, palette.surface, palette.border, 1.5, { rx: 3 }));
    elements.push(p.text(label, slot.x + slot.width / 2, slot.y + slot.height / 2 + font * 0.35, font, palette.textMuted, { anchor: 'middle', weight: 'bold' }));
  }

  const chainStartX = origin.x + idxW + chainGap;
  let maxRight = chainStartX;

  for (const chain of doc.chains) {
    const slotRef = slotById.get(bucketKey(chain.index));
    if (!slotRef || chain.entries.length === 0) continue;
    const { bounds: slot, row } = slotRef;
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
      anchors[`b${row}e${j}`] = { bounds: box };
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
    return { version: '1.0', metadata: {}, ...normalizeDoc(JSON.parse(input) as Partial<HashmapDoc>) };
  },
  layout(ir, theme: ResolvedTheme): LayoutResult {
    return layoutHashmap(ir, theme);
  },
};
