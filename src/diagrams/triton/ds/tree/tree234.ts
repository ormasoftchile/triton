/**
 * @file diagrams/tree/tree234.ts — 2-3-4 Tree diagram module.
 *
 * Characteristics:
 *   1. 2-nodes have 1 key and 2 children.
 *   2. 3-nodes have 2 keys and 3 children.
 *   3. 4-nodes have 3 keys and 4 children.
 *   4. All leaves reside at the exact same depth.
 *   5. Preemptive 4-node splitting on insertion.
 */

import type {
  DiagramModule,
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import type { BaseIR } from '../../../../contracts/diagram.js';
import { treeLayout, type TreeNodeInput } from '../../../../graph/tree.js';
import { connectSlots } from '../../../../graph/connect.js';
import { measureText } from '../../../../text/metrics.js';
import { pen } from '../../../../scene/build.js';
import { applyOverlays } from '../../../../overlay/apply.js';
import { rhu, rhuInt } from '../../../../util/round.js';

interface Node234 {
  keys: number[];
  children: Node234[];
}

function insert234(root: Node234, key: number): Node234 {
  if (root.keys.length === 3) {
    const newRoot: Node234 = { keys: [], children: [root] };
    splitChild(newRoot, 0);
    insertNonFull(newRoot, key);
    return newRoot;
  }
  insertNonFull(root, key);
  return root;
}

function splitChild(parent: Node234, index: number): void {
  const full = parent.children[index]!;
  const right: Node234 = {
    keys: [full.keys[2]!],
    children: full.children.length > 0 ? full.children.slice(2) : [],
  };
  const upKey = full.keys[1]!;
  full.keys = [full.keys[0]!];
  if (full.children.length > 0) {
    full.children = full.children.slice(0, 2);
  }

  parent.children.splice(index + 1, 0, right);
  parent.keys.splice(index, 0, upKey);
}

function insertNonFull(node: Node234, key: number): void {
  let i = node.keys.length - 1;

  if (node.children.length === 0) {
    // Leaf node: insert in sorted order
    while (i >= 0 && key < node.keys[i]!) i--;
    if (i >= 0 && node.keys[i] === key) return; // duplicate
    node.keys.splice(i + 1, 0, key);
    return;
  }

  // Internal node: find child
  while (i >= 0 && key < node.keys[i]!) i--;
  i++;

  if (node.children[i]!.keys.length === 3) {
    splitChild(node, i);
    if (key > node.keys[i]!) {
      i++;
    } else if (key === node.keys[i]!) {
      return;
    }
  }

  insertNonFull(node.children[i]!, key);
}

export interface Tree234Node {
  readonly id: string;
  readonly keys: readonly number[];
  readonly children: readonly string[];
}

export interface Tree234Document extends BaseIR {
  readonly title?: string | undefined;
  readonly nodes: readonly Tree234Node[];
}

export function buildTree234(input: string): Tree234Document {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let title: string | undefined;
  const filteredLines: string[] = [];

  for (const line of lines) {
    if (/^(2-3-4tree|234tree)\b/i.test(line)) continue;

    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }
    filteredLines.push(line);
  }

  const clean = filteredLines.join('\n');
  const numbers = (clean.match(/-?\d+/g) ?? []).map(Number);

  if (numbers.length === 0) {
    return {
      version: '1.0',
      metadata: title ? { title } : {},
      ...(title ? { title } : {}),
      nodes: [],
    };
  }

  let root: Node234 = { keys: [], children: [] };
  for (const n of numbers) {
    if (root.keys.length === 0 && root.children.length === 0) {
      root.keys.push(n);
    } else {
      root = insert234(root, n);
    }
  }

  const nodes: Tree234Node[] = [];
  let idCount = 1;

  const emit = (n: Node234): string => {
    const id = `n234_${idCount++}`;
    const childIds: string[] = [];
    for (const c of n.children) {
      childIds.push(emit(c));
    }
    nodes.push({
      id,
      keys: n.keys,
      children: childIds,
    });
    return id;
  };

  emit(root);

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    ...(title ? { title } : {}),
    nodes,
  };
}

// ─── Layout & Rendering ──────────────────────────────────────────────────────

const ARROW_ID = 'tree234-arrow';

export function layoutTree234(ir: Tree234Document, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing, edges } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;

  if (ir.nodes.length === 0) {
    const scene: Scene = {
      viewBox: { x: 0, y: 0, width: 140, height: 90 },
      background: palette.background,
      elements: [],
    };
    return { scene, anchors: {} };
  }

  // Measure nodes
  const sizes = new Map<string, { width: number; height: number; cellWidths: number[] }>();

  for (const node of ir.nodes) {
    const cellWidths = node.keys.map((k) => Math.max(measureText(String(k), font).width + 24, 38));
    const width = cellWidths.reduce((sum, w) => sum + w, 0);
    const height = font + 20;
    sizes.set(node.id, { width, height, cellWidths });
  }

  const inputs: TreeNodeInput[] = ir.nodes.map((n) => ({
    id: n.id,
    width: sizes.get(n.id)!.width,
    height: sizes.get(n.id)!.height,
    children: n.children,
  }));

  // Map child to parent for anchor clearance
  const parentMap = new Map<string, string>();
  for (const node of ir.nodes) {
    for (const cid of node.children) {
      parentMap.set(cid, node.id);
    }
  }

  const placed = treeLayout(inputs, {
    direction: 'TB',
    levelGap: 66,
    siblingGap: 24,
    margin,
  });

  const titleH = ir.title ? typography.titleFontSize + 24 : 0;
  const box = (id: string) => {
    const b = placed.boxes.get(id)!;
    return { x: b.x, y: b.y + titleH, width: b.width, height: b.height };
  };

  const elements: SceneElement[] = [];

  if (ir.title) {
    elements.push(
      p.text(
        ir.title,
        placed.width / 2,
        margin + typography.titleFontSize,
        typography.titleFontSize + 2,
        palette.text,
        { anchor: 'middle', weight: 'bold' },
      ),
    );
  }

  // 1. Edges originating from key divider slots
  for (const node of ir.nodes) {
    const pb = box(node.id);
    const cellWidths = sizes.get(node.id)!.cellWidths;
    const childCount = node.children.length;

    node.children.forEach((cid, cIdx) => {
      const cb = box(cid);
      let startX: number;

      if (childCount === cellWidths.length + 1) {
        if (cIdx === 0) {
          startX = pb.x;
        } else if (cIdx === childCount - 1) {
          startX = pb.x + pb.width;
        } else {
          let curX = pb.x;
          for (let j = 0; j < cIdx; j++) curX += cellWidths[j]!;
          startX = curX;
        }
      } else {
        const { start } = connectSlots(pb, cb);
        startX = start.x;
      }

      elements.push(
        p.path(
          `M ${rhu(startX)} ${rhu(pb.y + pb.height)} L ${rhu(cb.x + cb.width / 2)} ${rhu(cb.y)}`,
          palette.textMuted,
          1.5,
          { markerEnd: ARROW_ID },
        ),
      );
    });
  }

  // 2. Nodes
  for (const node of ir.nodes) {
    const b = box(node.id);
    const cellWidths = sizes.get(node.id)!.cellWidths;
    const nodeType = node.keys.length === 1 ? '2-node' : node.keys.length === 2 ? '3-node' : '4-node';

    // Outer card
    elements.push(p.rect(b, palette.surface, palette.primary, 1.6, { rx: 4 }));

    // Internal cell dividers and values
    let sx = b.x;
    node.keys.forEach((k, idx) => {
      const cw = cellWidths[idx]!;
      if (idx > 0) {
        elements.push(
          p.path(`M ${rhu(sx)} ${rhu(b.y)} L ${rhu(sx)} ${rhu(b.y + b.height)}`, palette.primary, 1),
        );
      }
      elements.push(
        p.text(
          String(k),
          rhu(sx + cw / 2),
          rhu(b.y + b.height / 2 + font * 0.35),
          font,
          palette.text,
          { anchor: 'middle', weight: 'bold' },
        ),
      );
      sx += cw;
    });

    // Tag placement: root is placed above, child nodes placed below so incoming connectors to top-center are unobstructed
    const tagY = !parentMap.has(node.id) ? b.y - 8 : b.y + b.height + 12;
    elements.push(
      p.text(nodeType, rhu(b.x + b.width / 2), rhu(tagY), smallFont - 2, palette.textMuted, {
        anchor: 'middle',
      }),
    );
  }

  const s = edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);

  const defs = [
    `<marker id="${ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.textMuted}" /></marker>`,
  ];

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  for (const node of ir.nodes) {
    anchors[node.id] = { bounds: box(node.id) };
  }

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: 0, y: 0, width: rhuInt(placed.width), height: rhuInt(placed.height + titleH) },
      background: palette.background,
      elements,
      defs,
    },
    ir.overlays,
    theme,
  );

  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const tree234: DiagramModule<Tree234Document> = {
  parseMermaid: buildTree234,
  parseYaml: (input) => JSON.parse(input) as Tree234Document,
  layout: (ir: Tree234Document, theme: ResolvedTheme): LayoutResult => layoutTree234(ir, theme),
};
