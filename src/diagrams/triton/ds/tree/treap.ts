/**
 * @file diagrams/tree/treap.ts — Treap (Cartesian Tree / BST + Heap) diagram module.
 *
 * Characteristics:
 *   1. Each node carries a (Key, Priority) pair.
 *   2. Keys satisfy Binary Search Tree (BST) ordering.
 *   3. Priorities satisfy Max-Heap ordering.
 *   4. Supports algorithmic insertion with automated heap rotations.
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
import { measureText } from '../../../../text/metrics.js';
import { pen } from '../../../../scene/build.js';
import { applyOverlays } from '../../../../overlay/apply.js';
import { rhu, rhuInt } from '../../../../util/round.js';

interface TreapInternalNode {
  key: number | string;
  priority: number;
  left: TreapInternalNode | null;
  right: TreapInternalNode | null;
}

function rotateRight(y: TreapInternalNode): TreapInternalNode {
  const x = y.left!;
  y.left = x.right;
  x.right = y;
  return x;
}

function rotateLeft(x: TreapInternalNode): TreapInternalNode {
  const y = x.right!;
  x.right = y.left;
  y.left = x;
  return y;
}

function insertTreap(node: TreapInternalNode | null, key: number | string, priority: number): TreapInternalNode {
  if (!node) return { key, priority, left: null, right: null };

  if (key < node.key) {
    node.left = insertTreap(node.left, key, priority);
    if (node.left.priority > node.priority) {
      node = rotateRight(node);
    }
  } else if (key > node.key) {
    node.right = insertTreap(node.right, key, priority);
    if (node.right.priority > node.priority) {
      node = rotateLeft(node);
    }
  }
  return node;
}

export interface TreapNode {
  readonly id: string;
  readonly key: string;
  readonly priority: number;
  readonly children: readonly string[];
}

export interface TreapDocument extends BaseIR {
  readonly title?: string | undefined;
  readonly nodes: readonly TreapNode[];
}

export function buildTreap(input: string): TreapDocument {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let title: string | undefined;
  const pairs: { key: number | string; priority: number }[] = [];
  const manualLines: string[] = [];

  for (const line of lines) {
    if (/^treap\b/i.test(line)) continue;

    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    // Match (K:50, P:85) or (50, 85) or insert 50:85
    const pairMatches = line.matchAll(/\(?\s*(?:k\s*:\s*)?(-?\d+|[a-zA-Z]+)\s*[,:]\s*(?:p\s*:\s*)?(-?\d+)\s*\)?/gi);
    let matchedAny = false;
    for (const m of pairMatches) {
      matchedAny = true;
      const rawK = m[1]!;
      const key = /^-?\d+$/.test(rawK) ? Number(rawK) : rawK;
      const priority = Number(m[2]);
      pairs.push({ key, priority });
    }

    if (!matchedAny) manualLines.push(line);
  }

  if (pairs.length > 0) {
    let root: TreapInternalNode | null = null;
    for (const p of pairs) {
      root = insertTreap(root, p.key, p.priority);
    }

    const nodes: TreapNode[] = [];
    let idCount = 1;

    const emit = (n: TreapInternalNode): string => {
      const id = `t_${idCount++}`;
      const children: string[] = [];
      if (n.left) children.push(emit(n.left));
      if (n.right) children.push(emit(n.right));

      nodes.push({
        id,
        key: String(n.key),
        priority: n.priority,
        children,
      });
      return id;
    };

    if (root) emit(root);

    return {
      version: '1.0',
      metadata: title ? { title } : {},
      ...(title ? { title } : {}),
      nodes,
    };
  }

  // Parse explicit manual lines
  const nodes: TreapNode[] = [];
  for (const line of manualLines) {
    const arrowIdx = line.indexOf('->');
    const decl = arrowIdx >= 0 ? line.slice(0, arrowIdx).trim() : line.trim();
    const targets = arrowIdx >= 0 ? line.slice(arrowIdx + 2).trim().split(/[,;\s]+/).filter(Boolean) : [];

    const bracketMatch = decl.match(/\[(.*?)\]/);
    let id = '';
    let key = '';
    let priority = 0;

    if (bracketMatch) {
      id = decl.slice(0, bracketMatch.index).trim();
      const content = bracketMatch[1]!.trim();
      const m = content.match(/^(.*?)(?:,\s*p\s*:\s*(\d+))?$/i);
      key = m ? m[1]!.trim() : content;
      priority = m && m[2] ? Number(m[2]) : 50;
    } else {
      const parts = decl.split(/\s+/);
      id = parts[0]!;
      key = parts[1] ?? id;
      priority = parts[2] ? Number(parts[2]) : 50;
    }

    if (!id) id = `t_${nodes.length + 1}`;

    nodes.push({
      id,
      key,
      priority,
      children: targets,
    });
  }

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    ...(title ? { title } : {}),
    nodes,
  };
}

// ─── Layout & Rendering ──────────────────────────────────────────────────────

const ARROW_ID = 'treap-arrow';

export function layoutTreap(ir: TreapDocument, theme: ResolvedTheme): LayoutResult {
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

  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of ir.nodes) {
    const keyW = measureText(node.key, font).width;
    const prioW = measureText(String(node.priority), smallFont - 1).width + 12;
    const w = Math.max(keyW + prioW + 28, 68);
    const h = 38;
    sizes.set(node.id, { width: w, height: h });
  }

  const inputs: TreeNodeInput[] = ir.nodes.map((n) => ({
    id: n.id,
    width: sizes.get(n.id)!.width,
    height: sizes.get(n.id)!.height,
    children: n.children,
  }));

  const placed = treeLayout(inputs, {
    direction: 'TB',
    levelGap: 52,
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

  // 1. Edges
  for (const node of ir.nodes) {
    const pb = box(node.id);
    for (const cid of node.children) {
      const cb = box(cid);
      elements.push(
        p.path(
          `M ${rhu(pb.x + pb.width / 2)} ${rhu(pb.y + pb.height)} L ${rhu(cb.x + cb.width / 2)} ${rhu(cb.y)}`,
          palette.textMuted,
          1.5,
          { markerEnd: ARROW_ID },
        ),
      );
    }
  }

  // 2. Nodes
  for (const node of ir.nodes) {
    const b = box(node.id);

    // Pill container
    elements.push(p.rect(b, palette.surface, palette.primary, 1.6, { rx: b.height / 2 }));

    // Key text
    const keyX = b.x + (b.width - 24) / 2;
    elements.push(
      p.text(
        node.key,
        rhu(keyX),
        rhu(b.y + b.height / 2 + font * 0.35),
        font,
        palette.text,
        { anchor: 'middle', weight: 'bold' },
      ),
    );

    // Priority badge (small pill circle on the right)
    const prioText = String(node.priority);
    const prioW = measureText(prioText, smallFont - 1).width + 10;
    const prioH = 16;
    const prioX = b.x + b.width - prioW - 4;
    const prioY = b.y + (b.height - prioH) / 2;

    elements.push(
      p.rect(
        { x: rhu(prioX), y: rhu(prioY), width: rhu(prioW), height: prioH },
        palette.primary,
        palette.primary,
        1,
        { rx: prioH / 2 },
      ),
    );
    elements.push(
      p.text(
        prioText,
        rhu(prioX + prioW / 2),
        rhu(prioY + prioH / 2 + (smallFont - 1) * 0.35),
        smallFont - 1,
        '#FFFFFF',
        { anchor: 'middle', weight: 'bold' },
      ),
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

export const treap: DiagramModule<TreapDocument> = {
  parseMermaid: buildTreap,
  parseYaml: (input) => JSON.parse(input) as TreapDocument,
  layout: (ir: TreapDocument, theme: ResolvedTheme): LayoutResult => layoutTreap(ir, theme),
};
