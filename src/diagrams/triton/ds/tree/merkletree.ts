/**
 * @file diagrams/tree/merkletree.ts — Merkle Tree (Cryptographic Hash Tree) diagram module.
 *
 * Characteristics:
 *   1. Leaf nodes store raw data blocks (e.g., Transactions) and their computed hashes H(Data).
 *   2. Internal nodes store concatenated cryptographic parent hashes H(Left || Right).
 *   3. The top node is the Merkle Root.
 *   4. Supports `proof <target>` or `verify <target>` to visually highlight the
 *      Merkle Audit Path (the leaf, intermediate sibling hashes, and path to root).
 *   5. Supports both automatic hashing from `data D1 D2 D3 ...` and explicit manual tree authoring.
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

// Simple deterministic hash helper for visual mock-ups (produces clean 8-char hex string)
function mockHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

export interface MerkleNode {
  readonly id: string;
  readonly hash: string;
  readonly data?: string | undefined;
  readonly isLeaf: boolean;
  readonly isRoot?: boolean | undefined;
  readonly isProof?: boolean | undefined;
  readonly isProofSibling?: boolean | undefined;
  readonly children: readonly string[];
}

export interface MerkleTreeDocument extends BaseIR {
  readonly title?: string | undefined;
  readonly nodes: readonly MerkleNode[];
  readonly proofTarget?: string | undefined;
}

export function buildMerkleTree(input: string): MerkleTreeDocument {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let title: string | undefined;
  let proofTarget: string | undefined;
  let compact = false;
  let maxWidth: number | undefined;
  let direction: 'TB' | 'LR' | undefined;
  const dataItems: string[] = [];
  const manualLines: string[] = [];

  for (const line of lines) {
    if (/^merkletree\b/i.test(line)) continue;

    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    const proofMatch = line.match(/^(proof|verify)\s+(.+)$/i);
    if (proofMatch) {
      proofTarget = proofMatch[2]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    const compactMatch = line.match(/^(layout\s+compact|compact\s*(true)?|compact)\b/i);
    if (compactMatch) {
      compact = true;
      continue;
    }

    const maxWidthMatch = line.match(/^max-?width\s+(\d+)/i);
    if (maxWidthMatch) {
      maxWidth = Number(maxWidthMatch[1]);
      compact = true;
      continue;
    }

    const dirMatch = line.match(/^direction\s+(TD|TB|LR)/i);
    if (dirMatch) {
      direction = dirMatch[1] === 'LR' ? 'LR' : 'TB';
      continue;
    }

    const dataMatch = line.match(/^data\s+(.+)$/i);
    if (dataMatch) {
      const items = dataMatch[1]!.match(/"([^"]+)"|'([^']+)'|(\S+)/g) ?? [];
      for (const item of items) {
        dataItems.push(item.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    manualLines.push(line);
  }

  const extraMeta: Record<string, unknown> = {
    ...(compact ? { compact: true } : {}),
    ...(maxWidth !== undefined ? { maxWidth } : {}),
    ...(direction ? { direction } : {}),
  };

  if (dataItems.length > 0) {
    return buildAlgorithmicMerkleTree(dataItems, title, proofTarget, extraMeta);
  }

  return parseExplicitMerkleTree(manualLines.join('\n'), title, proofTarget, extraMeta);
}

function buildAlgorithmicMerkleTree(
  dataItems: string[],
  title?: string,
  proofTarget?: string,
  extraMeta?: Record<string, unknown>,
): MerkleTreeDocument {
  // Ensure power of 2 by duplicating last element if needed
  const leaves = [...dataItems];
  while ((leaves.length & (leaves.length - 1)) !== 0 || leaves.length < 2) {
    leaves.push(leaves[leaves.length - 1]!);
  }

  interface TempNode {
    id: string;
    hash: string;
    data?: string | undefined;
    isLeaf: boolean;
    children: TempNode[];
  }

  let currentLevel: TempNode[] = leaves.map((data, idx) => ({
    id: `leaf_${idx}`,
    hash: mockHash(`data:${data}`),
    data,
    isLeaf: true,
    children: [],
  }));

  const allNodes: TempNode[] = [...currentLevel];
  let levelIdx = 1;

  while (currentLevel.length > 1) {
    const nextLevel: TempNode[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]!;
      const right = currentLevel[i + 1] ?? left;
      const combinedHash = mockHash(`${left.hash}+${right.hash}`);
      const parentNode: TempNode = {
        id: `node_${levelIdx}_${i / 2}`,
        hash: combinedHash,
        isLeaf: false,
        children: [left, right],
      };
      nextLevel.push(parentNode);
      allNodes.push(parentNode);
    }
    currentLevel = nextLevel;
    levelIdx++;
  }

  const root = currentLevel[0]!;

  // Mark proof path if requested
  const proofNodes = new Set<string>();
  const proofSiblings = new Set<string>();

  if (proofTarget) {
    // Find target leaf
    const targetLeaf = allNodes.find(
      (n) => n.isLeaf && (n.data === proofTarget || n.id === proofTarget || n.hash.startsWith(proofTarget)),
    );
    if (targetLeaf) {
      let cur: TempNode | undefined = targetLeaf;
      proofNodes.add(cur.id);

      while (cur && cur.id !== root.id) {
        const targetId: string = cur.id;
        const parent: TempNode | undefined = allNodes.find((p: TempNode): boolean =>
          p.children.some((c: TempNode): boolean => c.id === targetId),
        );
        if (parent) {
          proofNodes.add(parent.id);
          const sibling = parent.children.find((c: TempNode): boolean => c.id !== targetId);
          if (sibling) proofSiblings.add(sibling.id);
          cur = parent;
        } else {
          break;
        }
      }
    }
  }

  const nodes: MerkleNode[] = allNodes.map((n) => ({
    id: n.id,
    hash: n.hash,
    ...(n.data ? { data: n.data } : {}),
    isLeaf: n.isLeaf,
    ...(n.id === root.id ? { isRoot: true } : {}),
    ...(proofNodes.has(n.id) ? { isProof: true } : {}),
    ...(proofSiblings.has(n.id) ? { isProofSibling: true } : {}),
    children: n.children.map((c) => c.id),
  }));

  return {
    version: '1.0',
    metadata: { ...(title ? { title } : {}), ...(extraMeta ?? {}) },
    ...(title ? { title } : {}),
    ...(proofTarget ? { proofTarget } : {}),
    nodes,
  };
}

function parseExplicitMerkleTree(
  input: string,
  title?: string,
  proofTarget?: string,
  extraMeta?: Record<string, unknown>,
): MerkleTreeDocument {
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const nodes: MerkleNode[] = [];

  for (const line of lines) {
    const isLeaf = /^leaf\b/i.test(line);
    const isRoot = /^root\b/i.test(line);
    const clean = line.replace(/^(root|leaf|node)\s+/i, '');

    const arrowIdx = clean.indexOf('->');
    const decl = arrowIdx >= 0 ? clean.slice(0, arrowIdx).trim() : clean;
    const targets = arrowIdx >= 0 ? clean.slice(arrowIdx + 2).trim().split(/[,;\s]+/).filter(Boolean) : [];

    const bracketMatch = decl.match(/\[(.*?)\]/);
    let id = '';
    let hash = '';
    let data: string | undefined;

    if (bracketMatch) {
      id = decl.slice(0, bracketMatch.index).trim();
      const content = bracketMatch[1]!.trim();
      if (content.includes(':')) {
        const parts = content.split(':');
        hash = parts[0]!.trim();
        data = parts[1]!.trim().replace(/^["']|["']$/g, '');
      } else {
        hash = content;
      }
    } else {
      const parts = decl.split(/\s+/);
      id = parts[0]!;
      hash = parts[1] ?? mockHash(id);
    }

    if (!id) id = `m_${nodes.length + 1}`;

    nodes.push({
      id,
      hash,
      ...(data ? { data } : {}),
      isLeaf: isLeaf || targets.length === 0,
      ...(isRoot ? { isRoot: true } : {}),
      children: targets,
    });
  }

  return {
    version: '1.0',
    metadata: { ...(title ? { title } : {}), ...(extraMeta ?? {}) },
    ...(title ? { title } : {}),
    ...(proofTarget ? { proofTarget } : {}),
    nodes,
  };
}

// ─── Layout & Rendering ──────────────────────────────────────────────────────

const ARROW_ID = 'merkle-arrow';
const PROOF_ARROW_ID = 'merkle-proof-arrow';

export function layoutMerkleTree(ir: MerkleTreeDocument, theme: ResolvedTheme): LayoutResult {
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

  const isCompact =
    ir.metadata['compact'] === true ||
    ir.metadata['layout'] === 'compact' ||
    String(ir.metadata['compact']) === 'true';

  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of ir.nodes) {
    const hashLabel = isCompact ? node.hash.slice(0, 6) : `hash: ${node.hash.slice(0, 8)}`;
    const dataLabel = node.data ? (isCompact ? node.data : `data: ${node.data}`) : undefined;
    const w = isCompact
      ? Math.max(
          measureText(hashLabel, smallFont - 1).width + 16,
          dataLabel ? measureText(dataLabel, smallFont - 1).width + 16 : 0,
          56,
        )
      : Math.max(
          measureText(hashLabel, smallFont).width + 24,
          dataLabel ? measureText(dataLabel, smallFont).width + 24 : 0,
          100,
        );
    const h = node.data ? (isCompact ? 40 : 48) : (isCompact ? 28 : 36);
    sizes.set(node.id, { width: w, height: h });
  }

  const inputs: TreeNodeInput[] = ir.nodes.map((n) => ({
    id: n.id,
    width: sizes.get(n.id)!.width,
    height: sizes.get(n.id)!.height,
    children: n.children,
  }));

  const placed = treeLayout(inputs, {
    direction: (ir.metadata['direction'] as 'TB' | 'LR') ?? 'TB',
    levelGap: isCompact ? 36 : 52,
    siblingGap: isCompact ? 10 : 24,
    margin,
  });

  const titleH = ir.metadata['title'] ? typography.titleFontSize + 24 : 0;
  const box = (id: string) => {
    const b = placed.boxes.get(id)!;
    return { x: b.x, y: b.y + titleH, width: b.width, height: b.height };
  };

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

  // 1. Edges
  for (const node of ir.nodes) {
    const pb = box(node.id);
    for (const cid of node.children) {
      const cb = box(cid);
      const childNode = ir.nodes.find((n) => n.id === cid);
      const isProofEdge = node.isProof && childNode?.isProof;

      const stroke = isProofEdge ? palette.primary : palette.textMuted;
      const strokeWidth = isProofEdge ? 2.2 : 1.5;
      const marker = isProofEdge ? PROOF_ARROW_ID : ARROW_ID;

      elements.push(
        p.path(
          `M ${rhu(pb.x + pb.width / 2)} ${rhu(pb.y + pb.height)} L ${rhu(cb.x + cb.width / 2)} ${rhu(cb.y)}`,
          stroke,
          strokeWidth,
          { markerEnd: marker },
        ),
      );
    }
  }

  // 2. Nodes
  for (const node of ir.nodes) {
    const b = box(node.id);

    let fill = palette.surface;
    let stroke = palette.border;
    let strokeWidth = 1.5;

    if (node.isRoot) {
      stroke = palette.primary;
      strokeWidth = 2.0;
    }
    if (node.isProof) {
      fill = palette.surface;
      stroke = palette.primary;
      strokeWidth = 2.4;
    } else if (node.isProofSibling) {
      stroke = palette.secondary ?? palette.primary;
      strokeWidth = 1.8;
    }

    // Card rect
    elements.push(p.rect(b, fill, stroke, strokeWidth, { rx: isCompact ? 4 : 6 }));

    // Hash text
    const hashText = isCompact ? node.hash.slice(0, 6) : node.hash.slice(0, 8);
    const hashY = node.data
      ? isCompact
        ? b.y + 14
        : b.y + 18
      : b.y + b.height / 2 + (isCompact ? smallFont - 1 : smallFont) * 0.35;

    elements.push(
      p.text(
        hashText,
        rhu(b.x + b.width / 2),
        rhu(hashY),
        isCompact ? smallFont - 1 : smallFont,
        palette.text,
        { anchor: 'middle', weight: node.isRoot || node.isProof ? 'bold' : 'normal' },
      ),
    );

    // Data text & divider (if leaf with data)
    if (node.data) {
      const dataText = isCompact ? node.data : `data: ${node.data}`;
      const divY = isCompact ? b.y + 22 : b.y + 28;
      elements.push(
        p.path(`M ${rhu(b.x)} ${rhu(divY)} L ${rhu(b.x + b.width)} ${rhu(divY)}`, stroke, 1),
      );
      elements.push(
        p.text(
          dataText,
          rhu(b.x + b.width / 2),
          rhu(divY + (isCompact ? 11 : 14)),
          isCompact ? smallFont - 2 : smallFont - 1,
          palette.textMuted,
          { anchor: 'middle' },
        ),
      );
    }

    // Role Badges (Root / Proof / Sibling)
    let badgeText: string | undefined;
    let badgeColor = palette.primary;

    if (node.isRoot) {
      badgeText = 'ROOT';
      badgeColor = palette.primary;
    } else if (node.isProof) {
      badgeText = 'VERIFY';
      badgeColor = palette.primary;
    } else if (node.isProofSibling) {
      badgeText = 'SIBLING HASH';
      badgeColor = palette.secondary ?? palette.textMuted;
    }

    if (badgeText) {
      const bw = measureText(badgeText, smallFont - 2).width + 8;
      const bh = 13;
      const bx = b.x + b.width - bw - 4;
      const by = b.y - bh / 2;

      elements.push(
        p.rect(
          { x: rhu(bx), y: rhu(by), width: rhu(bw), height: bh },
          palette.background,
          badgeColor,
          1,
          { rx: 3 },
        ),
      );
      elements.push(
        p.text(
          badgeText,
          rhu(bx + bw / 2),
          rhu(by + bh / 2 + (smallFont - 2) * 0.35),
          smallFont - 2,
          badgeColor,
          { anchor: 'middle', weight: 'bold' },
        ),
      );
    }
  }

  // 3. Dynamic markers
  const s = edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);

  const defs = [
    `<marker id="${ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.textMuted}" /></marker>`,
    `<marker id="${PROOF_ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
  ];

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  for (const node of ir.nodes) {
    const b = box(node.id);
    anchors[node.id] = { bounds: b };
    if (node.data) anchors[`data_${node.data}`] = { bounds: b };
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

export const merkletree: DiagramModule<MerkleTreeDocument> = {
  parseMermaid: buildMerkleTree,
  parseYaml: (input) => JSON.parse(input) as MerkleTreeDocument,
  layout: (ir: MerkleTreeDocument, theme: ResolvedTheme): LayoutResult => layoutMerkleTree(ir, theme),
};
