/**
 * @file diagrams/tree/bplustree.ts — Dedicated B+ tree diagram module.
 *
 * Characteristics of B+ Trees:
 *   1. All data entries (keys) are stored only in leaf nodes.
 *   2. Internal nodes contain only routing / separator keys.
 *   3. Leaf splits use "copy-up" semantics (the median key is promoted to the
 *      parent while remaining as the first key of the right leaf).
 *   4. Internal splits use "push-up" semantics (the median key is promoted to the
 *      parent and removed from the internal node).
 *   5. All leaf nodes reside at the exact same rank/depth and are linked via
 *      ordered horizontal sibling pointers (L_i -> L_{i+1}).
 *   6. Sibling pointers do not affect the hierarchical tree layout (constraint=false).
 *   7. Supports both algorithmic value-driven insertion (`order N insert ...`)
 *      and explicit manual authoring with custom page IDs, keys, and notes.
 */

import type {
  DiagramModule,
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import type { TreeDocument, TreeNode } from './ir.js';
import { treeLayout, type TreeNodeInput } from '../../../../graph/tree.js';
import { connectSlots } from '../../../../graph/connect.js';
import { measureText } from '../../../../text/metrics.js';
import { pen } from '../../../../scene/build.js';
import { applyOverlays } from '../../../../overlay/apply.js';
import { rhu, rhuInt } from '../../../../util/round.js';

// ─── B+ Tree Internal Data Structures for Algorithmic Insertion ──────────────

interface BPlusInternal {
  readonly isLeaf: false;
  keys: number[];
  children: (BPlusInternal | BPlusLeaf)[];
  pageId?: string | undefined;
}

interface BPlusLeaf {
  readonly isLeaf: true;
  keys: number[];
  next: BPlusLeaf | null;
  prev: BPlusLeaf | null;
  pageId?: string | undefined;
}

type BPlusNode = BPlusInternal | BPlusLeaf;

interface SplitResult {
  readonly upKey: number;
  readonly rightChild: BPlusNode;
}

/**
 * Recursive B+ tree insertion.
 * - Leaves use copy-up: the separator key remains in the right leaf.
 * - Internal nodes use push-up: the separator key is removed from the internal node.
 */
function insertBPlus(node: BPlusNode, key: number, order: number): SplitResult | null {
  if (node.isLeaf) {
    // 1. Insert key in sorted order into leaf
    let i = node.keys.length - 1;
    while (i >= 0 && key < node.keys[i]!) i--;
    if (i >= 0 && node.keys[i] === key) return null; // duplicate key, ignore
    node.keys.splice(i + 1, 0, key);

    // 2. Check overflow (max keys in leaf is order - 1)
    if (node.keys.length <= order - 1) return null;

    // 3. Copy-up split: median key is copied up and retained in right leaf
    const mid = Math.floor(node.keys.length / 2);
    const upKey = node.keys[mid]!;
    const rightLeaf: BPlusLeaf = {
      isLeaf: true,
      keys: node.keys.slice(mid), // includes upKey
      next: node.next,
      prev: node,
    };
    if (node.next) node.next.prev = rightLeaf;
    node.next = rightLeaf;
    node.keys = node.keys.slice(0, mid);

    return { upKey, rightChild: rightLeaf };
  }

  // Internal node: find child branch
  let i = 0;
  while (i < node.keys.length && key >= node.keys[i]!) i++;

  const split = insertBPlus(node.children[i]!, key, order);
  if (!split) return null;

  // Insert promoted key and new child pointer
  node.keys.splice(i, 0, split.upKey);
  node.children.splice(i + 1, 0, split.rightChild);

  // Check internal node overflow (max keys is order - 1)
  if (node.keys.length <= order - 1) return null;

  // Push-up split: median key is removed from internal node and promoted
  const mid = Math.floor(node.keys.length / 2);
  const upKey = node.keys[mid]!;
  const rightInternal: BPlusInternal = {
    isLeaf: false,
    keys: node.keys.slice(mid + 1), // excludes upKey
    children: node.children.slice(mid + 1),
  };
  node.keys = node.keys.slice(0, mid);
  node.children = node.children.slice(0, mid + 1);

  return { upKey, rightChild: rightInternal };
}

// ─── IR Types for B+ Tree ───────────────────────────────────────────────────

export interface BPlusTreeNode extends TreeNode {
  readonly isLeaf?: boolean | undefined;
  readonly pageId?: string | undefined;
}

export interface BPlusTreeNote {
  readonly target: 'internal' | 'root' | 'leaves' | 'leaf' | string;
  readonly text: string;
}

export interface BPlusTreeDocument extends TreeDocument {
  readonly nodes: readonly BPlusTreeNode[];
  readonly bidirectionalLeaves?: boolean | undefined;
  readonly notes?: readonly BPlusTreeNote[] | undefined;
}

// ─── Parser / Builder ────────────────────────────────────────────────────────

/**
 * Parse and compile B+ tree input into a BPlusTreeDocument.
 */
export function buildBPlusTree(input: string): BPlusTreeDocument {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let title: string | undefined;
  const filteredLines: string[] = [];
  const notes: BPlusTreeNote[] = [];
  let bidirectional = false;

  for (const line of lines) {
    if (/^(b\+?tree|bplustree)$/i.test(line)) {
      continue;
    }
    const headerWithArgs = line.match(/^(b\+?tree|bplustree)\s+(.+)$/i);
    if (headerWithArgs) {
      filteredLines.push(headerWithArgs[2]!.trim());
      continue;
    }

    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }
    if (/^(bidirectional|doubly-linked|doublyLinked)\b/i.test(line)) {
      bidirectional = true;
      continue;
    }

    const noteMatch = line.match(/^note\s+(\w+)\s+["']?([^"']+)["']?$/i);
    if (noteMatch) {
      notes.push({ target: noteMatch[1]!.toLowerCase(), text: noteMatch[2]!.trim() });
      continue;
    }

    filteredLines.push(line);
  }

  const cleanInput = filteredLines.join('\n');

  // Check if input is explicit/manual tree authoring (contains `->`, `leaf`, `page`, or indented lines without `insert`)
  const isExplicit =
    filteredLines.some((l) => l.includes('->') || /^leaf\b/i.test(l) || /^page\b/i.test(l)) ||
    (input.includes('\n  ') && !/\binsert\b/i.test(input) && !/\border\b/i.test(input));

  if (isExplicit) {
    return parseExplicitBPlusTree(cleanInput, title, bidirectional, notes);
  }

  return buildAlgorithmicBPlusTree(cleanInput, title, bidirectional, notes);
}

/**
 * Algorithmic value-driven B+ tree builder.
 */
function buildAlgorithmicBPlusTree(
  input: string,
  title?: string,
  bidirectional?: boolean,
  notes?: readonly BPlusTreeNote[],
): BPlusTreeDocument {
  const orderMatch = input.match(/order\s+(\d+)/i);
  const order = Math.max(3, orderMatch ? Number(orderMatch[1]) : 3);
  const afterOrder = input.replace(/order\s+\d+/i, '').replace(/insert/gi, '');
  const keys = (afterOrder.match(/-?\d+/g) ?? []).map(Number);

  if (keys.length === 0) {
    return {
      version: '1.0',
      metadata: title ? { title } : {},
      direction: 'TB',
      nodes: [],
      ...(bidirectional ? { bidirectionalLeaves: true } : {}),
      ...(notes && notes.length > 0 ? { notes } : {}),
    };
  }

  let root: BPlusNode = {
    isLeaf: true,
    keys: [],
    next: null,
    prev: null,
  };

  for (const k of keys) {
    const split = insertBPlus(root, k, order);
    if (split) {
      root = {
        isLeaf: false,
        keys: [split.upKey],
        children: [root, split.rightChild],
      };
    }
  }

  let internalCount = 1;
  let leafCount = 1;
  const nodes: BPlusTreeNode[] = [];

  const emit = (n: BPlusNode): string => {
    if (n.isLeaf) {
      const pageId = `L${leafCount++}`;
      const id = `leaf_${pageId}`;
      nodes.push({
        id,
        label: n.keys.join(' | '),
        kinds: ['strip', 'leaf'],
        pageId,
        isLeaf: true,
        children: [],
      });
      return id;
    }

    const pageId = `P${internalCount++}`;
    const id = `page_${pageId}`;
    const childIds: string[] = [];
    for (const c of n.children) {
      childIds.push(emit(c));
    }
    nodes.push({
      id,
      label: n.keys.join(' | '),
      kinds: ['strip', 'internal'],
      pageId,
      isLeaf: false,
      children: childIds,
    });
    return id;
  };

  emit(root);

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    direction: 'TB',
    nodes,
    ...(bidirectional ? { bidirectionalLeaves: true } : {}),
    ...(notes && notes.length > 0 ? { notes } : {}),
  };
}

/**
 * Parse manual/explicit B+ tree definitions.
 */
function parseExplicitBPlusTree(
  input: string,
  title?: string,
  bidirectional?: boolean,
  notes?: readonly BPlusTreeNote[],
): BPlusTreeDocument {
  const nodes: BPlusTreeNode[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const isStatementSyntax = lines.some((l) => l.includes('->'));

  if (isStatementSyntax) {
    const rawNodes = new Map<
      string,
      { id: string; label: string; pageId?: string | undefined; isLeaf: boolean; children: string[] }
    >();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const isLeafDecl = /^leaf\b/i.test(trimmed);
      const isPageDecl = /^page\b/i.test(trimmed);
      const cleanLine = trimmed.replace(/^(page|leaf|node)\s+/i, '');

      const arrowIdx = cleanLine.indexOf('->');
      const declPart = arrowIdx >= 0 ? cleanLine.slice(0, arrowIdx).trim() : cleanLine;
      const targetsPart = arrowIdx >= 0 ? cleanLine.slice(arrowIdx + 2).trim() : '';

      let label = '';
      let id = '';
      let pageId: string | undefined;

      const bracketMatch = declPart.match(/\[(.*?)\]/);
      const quoteMatch = declPart.match(/"(.*?)"/);
      if (bracketMatch) {
        label = bracketMatch[1]!.replace(/\s*\|\s*/g, ' | ').trim();
        id = declPart.slice(0, bracketMatch.index).trim();
      } else if (quoteMatch) {
        label = quoteMatch[1]!.replace(/\s*\|\s*/g, ' | ').trim();
        id = declPart.slice(0, quoteMatch.index).trim();
      } else {
        const parts = declPart.split(/\s+/);
        id = parts[0]!;
        label = parts.slice(1).join(' | ');
      }

      if (!id) id = `n${rawNodes.size + 1}`;
      pageId = id;

      const children = targetsPart
        ? targetsPart
            .split(/[,;\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const isLeaf = isLeafDecl || (children.length === 0 && !isPageDecl);

      rawNodes.set(id, {
        id,
        label: label || id,
        pageId,
        isLeaf,
        children,
      });
    }

    for (const raw of rawNodes.values()) {
      nodes.push({
        id: raw.id,
        label: raw.label,
        kinds: raw.isLeaf ? ['strip', 'leaf'] : ['strip', 'internal'],
        ...(raw.pageId ? { pageId: raw.pageId } : {}),
        isLeaf: raw.isLeaf,
        children: raw.children,
      });
    }
  } else {
    // Indentation-based tree parsing
    const rawLines = lines.map((l) => {
      const indent = l.search(/\S|$/);
      const content = l.trim();
      return { indent, content };
    });

    const stack: { indent: number; id: string }[] = [];
    rawLines.forEach((ln, idx) => {
      const id = `n${idx}`;
      while (stack.length > 0 && stack[stack.length - 1]!.indent >= ln.indent) stack.pop();
      const parent = stack.length > 0 ? stack[stack.length - 1] : undefined;

      let content = ln.content;
      let isLeaf = false;
      let pageId: string | undefined;

      const attrMatch = content.match(/\{(.*?)\}/);
      if (attrMatch) {
        const attrStr = attrMatch[1]!;
        if (/\bleaf\s*:\s*true\b/i.test(attrStr) || /\bleaf\b/i.test(attrStr)) isLeaf = true;
        const pageMatch = attrStr.match(/page\s*:\s*["']?([^"',}]+)["']?/i);
        const idMatch = attrStr.match(/id\s*:\s*["']?([^"',}]+)["']?/i);
        if (pageMatch) pageId = pageMatch[1]!.trim();
        else if (idMatch) pageId = idMatch[1]!.trim();
        content = content.replace(/\{.*?\}/, '').trim();
      }

      const bracketMatch = content.match(/\[(.*?)\]/);
      const label = bracketMatch ? bracketMatch[1]!.trim() : content.trim();

      nodes.push({
        id,
        label: label.replace(/\s*\|\s*/g, ' | '),
        kinds: isLeaf ? ['strip', 'leaf'] : ['strip', 'internal'],
        ...(pageId ? { pageId } : {}),
        isLeaf,
        children: [],
      });

      if (parent) {
        const pNode = nodes.find((n) => n.id === parent.id);
        if (pNode) {
          (pNode.children as string[]).push(id);
        }
      }

      stack.push({ indent: ln.indent, id });
    });

    for (const node of nodes) {
      if (node.children.length === 0) {
        (node as any).isLeaf = true;
        if (!node.kinds.includes('leaf')) {
          (node as any).kinds = ['strip', 'leaf'];
        }
      }
    }
  }

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    direction: 'TB',
    nodes,
    ...(bidirectional ? { bidirectionalLeaves: true } : {}),
    ...(notes && notes.length > 0 ? { notes } : {}),
  };
}

// ─── Layout & Rendering ──────────────────────────────────────────────────────

const ARROW_ID = 'bplus-arrow';
const ARROW_START_ID = 'bplus-arrow-start';
const TREE_ARROW_ID = 'bplus-tree-arrow';
const NOTE_ARROW_ID = 'bplus-note-arrow';

/** Split a `a | b | c` strip label into per-key cells with measured widths. */
function stripCells(label: string, font: number): { key: string; width: number }[] {
  return label
    .split('|')
    .map((s) => s.trim())
    .map((key) => ({
      key,
      width: Math.max(measureText(key, font).width + 24, 40),
    }));
}

/**
 * Layout and render a B+ Tree diagram.
 */
export function layoutBPlusTree(ir: BPlusTreeDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing, edges } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;

  if (ir.nodes.length === 0) {
    const scene: Scene = {
      viewBox: { x: 0, y: 0, width: 120, height: 80 },
      background: palette.background,
      elements: [],
    };
    return { scene, anchors: {} };
  }

  // 1. Measure all nodes
  const sizes = new Map<string, { width: number; height: number }>();
  const isLeafNode = new Map<string, boolean>();

  for (const node of ir.nodes) {
    const isLeaf = Boolean(node.isLeaf || node.children.length === 0 || node.kinds.includes('leaf'));
    isLeafNode.set(node.id, isLeaf);

    const cells = stripCells(node.label, font);
    const width = cells.reduce((sum, c) => sum + c.width, 0);
    const height = font + 22;
    sizes.set(node.id, { width, height });
  }

  // 2. Perform tidy tree hierarchy placement
  const inputs: TreeNodeInput[] = ir.nodes.map((n) => ({
    id: n.id,
    width: sizes.get(n.id)!.width,
    height: sizes.get(n.id)!.height,
    children: n.children,
  }));

  const placed = treeLayout(inputs, {
    direction: ir.direction,
    levelGap: 68,
    siblingGap: 38, // generous gap for horizontal sibling pointer arrows
    margin,
  });

  const titleH = ir.metadata['title'] ? typography.titleFontSize + 24 : 0;

  // 3. Same-Rank Leaf Alignment: Ensure all leaves share the exact same baseline Y
  const leafIds = ir.nodes.filter((n) => isLeafNode.get(n.id)).map((n) => n.id);
  const leafBoxes = leafIds.map((id) => placed.boxes.get(id)).filter(Boolean);
  const maxLeafY = leafBoxes.length > 0 ? Math.max(...leafBoxes.map((b) => b!.y)) : 0;

  // Adjust boxes for title offset and leaf alignment
  const adjustedBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const node of ir.nodes) {
    const b = placed.boxes.get(node.id)!;
    const isLeaf = isLeafNode.get(node.id);
    const y = (isLeaf && maxLeafY > 0 ? maxLeafY : b.y) + titleH;
    adjustedBoxes.set(node.id, { x: b.x, y, width: b.width, height: b.height });
  }

  const box = (id: string) => adjustedBoxes.get(id)!;

  const elements: SceneElement[] = [];

  // Title
  if (titleH > 0) {
    elements.push(
      p.text(
        String(ir.metadata['title']),
        placed.width / 2,
        margin + typography.titleFontSize,
        typography.titleFontSize + 2,
        palette.text,
        { anchor: 'middle', weight: 'bold' },
      ),
    );
  }

  // 4. Render Hierarchical Parent -> Child Edges (Slots Originating from Keys / Dividers)
  for (const node of ir.nodes) {
    const pb = box(node.id);
    const cells = stripCells(node.label, font);
    const childCount = node.children.length;

    node.children.forEach((cid, cIdx) => {
      const cb = box(cid);
      let startX: number;

      // In B+ trees, an internal node with k keys has k+1 child pointers:
      // Pointer 0: left corner
      // Pointer 1..k-1: dividers between keys
      // Pointer k: right corner
      if (childCount === cells.length + 1) {
        if (cIdx === 0) {
          startX = pb.x;
        } else if (cIdx === childCount - 1) {
          startX = pb.x + pb.width;
        } else {
          let curX = pb.x;
          for (let j = 0; j < cIdx; j++) {
            curX += cells[j]!.width;
          }
          startX = curX;
        }
      } else {
        const { start } = connectSlots(pb, cb);
        startX = start.x;
      }

      const startY = pb.y + pb.height;
      const endX = cb.x + cb.width / 2;
      const endY = cb.y;

      elements.push(
        p.path(
          `M ${rhu(startX)} ${rhu(startY)} L ${rhu(endX)} ${rhu(endY)}`,
          palette.textMuted,
          1.5,
          {
            markerEnd: TREE_ARROW_ID,
          },
        ),
      );
    });
  }

  // 5. Render Ordered Sibling Pointers Between Leaves (constraint=false)
  // Sort leaves by their X coordinate to guarantee left-to-right chain
  const sortedLeaves = [...leafIds].sort((a, b) => box(a).x - box(b).x);

  for (let i = 0; i < sortedLeaves.length - 1; i++) {
    const curId = sortedLeaves[i]!;
    const nextId = sortedLeaves[i + 1]!;
    const curBox = box(curId);
    const nextBox = box(nextId);

    const startX = curBox.x + curBox.width;
    const startY = curBox.y + curBox.height / 2;
    const endX = nextBox.x;
    const endY = nextBox.y + nextBox.height / 2;

    if (endX > startX + 2) {
      elements.push(
        p.path(
          `M ${rhu(startX)} ${rhu(startY)} L ${rhu(endX)} ${rhu(endY)}`,
          palette.primary,
          1.5,
          {
            markerEnd: ARROW_ID,
            ...(ir.bidirectionalLeaves ? { markerStart: ARROW_START_ID } : {}),
          },
        ),
      );
    }
  }

  // 6. Render Nodes (Strips with Cells and Clean Header Subtitles)
  for (const node of ir.nodes) {
    const b = box(node.id);
    const isLeaf = isLeafNode.get(node.id);

    const fill = palette.surface;
    const stroke = isLeaf ? palette.primary : palette.border;
    const strokeWidth = isLeaf ? 1.8 : 1.5;

    // Outer node card
    elements.push(p.rect(b, fill, stroke, strokeWidth, { rx: 4 }));

    // Internal cell dividers and key labels
    let sx = b.x;
    const cells = stripCells(node.label, font);
    cells.forEach((cell, idx) => {
      if (idx > 0) {
        elements.push(
          p.path(`M ${rhu(sx)} ${rhu(b.y)} L ${rhu(sx)} ${rhu(b.y + b.height)}`, stroke, 1),
        );
      }
      elements.push(
        p.text(
          cell.key,
          rhu(sx + cell.width / 2),
          rhu(b.y + b.height / 2 + font * 0.35),
          font,
          palette.text,
          { anchor: 'middle', weight: 'bold' },
        ),
      );
      sx += cell.width;
    });

    // Clean text header above the node (e.g. `internal node` or `leaf`)
    const headerLabel =
      node.badge ??
      (node.pageId && !node.pageId.startsWith('n') && !node.pageId.startsWith('l') && !node.pageId.startsWith('p')
        ? node.pageId
        : isLeaf
          ? 'leaf'
          : 'internal node');

    if (headerLabel) {
      elements.push(
        p.text(
          headerLabel,
          rhu(b.x + b.width / 2),
          rhu(b.y - 7),
          smallFont,
          isLeaf ? palette.primary : palette.textMuted,
          { anchor: 'middle', weight: 'normal' },
        ),
      );
    }
  }

  // 7. Render Explanatory Notes & Callout Arrows (if specified)
  const rootNode = ir.nodes.find((n) => !isLeafNode.get(n.id)) ?? ir.nodes[0];
  const rootBox = rootNode ? box(rootNode.id) : undefined;
  let extraBottomH = 0;
  let extraRightW = 0;

  if (ir.notes && ir.notes.length > 0) {
    for (const note of ir.notes) {
      if ((note.target === 'internal' || note.target === 'root') && rootBox) {
        // Annotation on top-right of root
        const noteX = rootBox.x + rootBox.width + 48;
        const noteY = rootBox.y - 2;
        extraRightW = Math.max(extraRightW, measureText(note.text, smallFont).width + 60);

        elements.push(
          p.text(note.text, rhu(noteX), rhu(noteY), smallFont, palette.textMuted, {
            anchor: 'start',
          }),
        );
        // Callout arrow pointing from note to right edge of internal node
        elements.push(
          p.path(
            `M ${rhu(noteX - 6)} ${rhu(noteY - 4)} L ${rhu(rootBox.x + rootBox.width + 4)} ${rhu(rootBox.y + rootBox.height / 2)}`,
            palette.textMuted,
            1.2,
            { markerEnd: NOTE_ARROW_ID },
          ),
        );
      } else if (note.target === 'leaves' || note.target === 'leaf' || note.target === 'data') {
        // Annotation below the linked leaves
        const leafH = sizes.get(leafIds[0] ?? '')?.height ?? 34;
        const noteY = maxLeafY + leafH + titleH + 34;
        const noteX = placed.width / 2;
        extraBottomH = Math.max(extraBottomH, 48);

        elements.push(
          p.text(note.text, rhu(noteX), rhu(noteY), smallFont, palette.textMuted, {
            anchor: 'middle',
          }),
        );
        // Curved arc arrow above the text indicating the leaf scan chain
        const arcStart = noteX - 80;
        const arcEnd = noteX + 80;
        const arcMidY = noteY - 14;
        elements.push(
          p.path(
            `M ${rhu(arcStart)} ${rhu(arcMidY)} Q ${rhu(noteX)} ${rhu(arcMidY + 10)} ${rhu(arcEnd)} ${rhu(arcMidY)}`,
            palette.textMuted,
            1.2,
            { markerEnd: NOTE_ARROW_ID },
          ),
        );
      }
    }
  }

  // 8. Node Anchor Registry for Poster Cross-linking
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> =
    {};
  for (const node of ir.nodes) {
    const b = box(node.id);
    anchors[node.id] = { bounds: b };
    if (node.pageId) {
      anchors[node.pageId] = { bounds: b };
      anchors[`page_${node.pageId}`] = { bounds: b };
      anchors[`leaf_${node.pageId}`] = { bounds: b };
    }
  }

  // 9. Dynamic Arrowhead Marker Definitions
  const s = edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);

  const defs = [
    `<marker id="${ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
    `<marker id="${ARROW_START_ID}" markerWidth="${s}" markerHeight="${sH}" refX="1" refY="${sMidY}" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
    `<marker id="${TREE_ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.textMuted}" /></marker>`,
    `<marker id="${NOTE_ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.textMuted}" /></marker>`,
  ];

  const totalH = rhuInt(maxLeafY + (sizes.get(leafIds[0] ?? '')?.height ?? 34) + margin * 2 + titleH + extraBottomH);
  const totalW = rhuInt(placed.width + extraRightW);

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: 0, y: 0, width: totalW, height: totalH },
      background: palette.background,
      elements,
      defs,
    },
    ir.overlays,
    theme,
  );

  return { scene, anchors: anchors as NodeAnchorRegistry };
}

// ─── Module Export ───────────────────────────────────────────────────────────

export const bplustree: DiagramModule<BPlusTreeDocument> = {
  parseMermaid: buildBPlusTree,
  parseYaml: (input) => JSON.parse(input) as BPlusTreeDocument,
  layout: (ir: BPlusTreeDocument, theme: ResolvedTheme): LayoutResult =>
    layoutBPlusTree(ir, theme),
};
