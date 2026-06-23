/**
 * @file graph/tree.ts — Tidy hierarchical (tree) placement.
 *
 * Centered-parent subtree packing: every parent is centered over the block its
 * descendants occupy, sibling subtrees never overlap, and node sizes may vary.
 * Shared by the decorated-tree diagrams (avl, rbtree, btree, radix, segtree,
 * heap, plan). Edge routing is left to callers (connect the returned boxes).
 *
 * Deterministic: stable child order, no clock, no randomness.
 */

export interface TreeNodeInput {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Child node ids, in draw order (left→right for TB, top→bottom for LR). */
  readonly children: readonly string[];
}

export interface TreeOptions {
  /** 'TB' stacks depth top→bottom (siblings spread horizontally); 'LR' rotates. */
  readonly direction?: 'TB' | 'LR';
  /** Gap between consecutive depths (px). */
  readonly levelGap?: number;
  /** Gap between sibling subtrees (px). */
  readonly siblingGap?: number;
  /** Outer margin (px). */
  readonly margin?: number;
}

export interface TreeBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TreeResult {
  readonly boxes: Map<string, TreeBox>;
  readonly width: number;
  readonly height: number;
}

export function treeLayout(nodes: readonly TreeNodeInput[], options: TreeOptions = {}): TreeResult {
  const direction  = options.direction ?? 'TB';
  const levelGap   = options.levelGap ?? 56;
  const siblingGap = options.siblingGap ?? 28;
  const margin     = options.margin ?? 32;
  const horizontal = direction === 'LR';

  if (nodes.length === 0) return { boxes: new Map(), width: margin * 2, height: margin * 2 };

  const byId = new Map<string, TreeNodeInput>(nodes.map(n => [n.id, n]));
  const crossOf = (n: TreeNodeInput): number => (horizontal ? n.height : n.width);
  const alongOf = (n: TreeNodeInput): number => (horizontal ? n.width : n.height);

  // Roots = nodes never referenced as a child.
  const childIds = new Set<string>();
  for (const n of nodes) for (const c of n.children) childIds.add(c);
  const roots = nodes.filter(n => !childIds.has(n.id));

  // Depth of every node (BFS from roots; stable).
  const depth = new Map<string, number>();
  const queue: string[] = roots.map(r => { depth.set(r.id, 0); return r.id; });
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    const d = depth.get(id)!;
    for (const c of byId.get(id)!.children) {
      if (!depth.has(c)) { depth.set(c, d + 1); queue.push(c); }
    }
  }
  const maxDepth = Math.max(...depth.values());

  // Along-axis band per depth = max along-extent at that depth.
  const levelAlong = Array.from({ length: maxDepth + 1 }, () => 0);
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    levelAlong[d] = Math.max(levelAlong[d]!, alongOf(n));
  }
  const levelStart: number[] = [];
  let acc = margin;
  for (let d = 0; d <= maxDepth; d++) { levelStart[d] = acc; acc += levelAlong[d]! + levelGap; }
  const alongTotal = acc - levelGap + margin;

  // Subtree cross-extent (memoized).
  const subCross = new Map<string, number>();
  const computeCross = (id: string): number => {
    const cached = subCross.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id)!;
    let own = crossOf(node);
    if (node.children.length > 0) {
      const childrenCross = node.children.reduce((s, c, i) => s + computeCross(c) + (i > 0 ? siblingGap : 0), 0);
      own = Math.max(own, childrenCross);
    }
    subCross.set(id, own);
    return own;
  };

  const crossPos = new Map<string, number>(); // cross-axis top-left of each node
  const assign = (id: string, u0: number): void => {
    const node = byId.get(id)!;
    const sc = computeCross(id);
    const center = u0 + sc / 2;
    crossPos.set(id, center - crossOf(node) / 2);
    if (node.children.length === 0) return;
    const childrenCross = node.children.reduce((s, c, i) => s + computeCross(c) + (i > 0 ? siblingGap : 0), 0);
    let cursor = u0 + (sc - childrenCross) / 2;
    for (const c of node.children) {
      assign(c, cursor);
      cursor += computeCross(c) + siblingGap;
    }
  };

  // Place each root forest block left→right (cross axis).
  let cursor = margin;
  for (const r of roots) {
    assign(r.id, cursor);
    cursor += computeCross(r.id) + siblingGap;
  }
  const crossTotal = cursor - siblingGap + margin;

  const boxes = new Map<string, TreeBox>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    const u = crossPos.get(n.id)!;
    const v = levelStart[d]! + (levelAlong[d]! - alongOf(n)) / 2;
    const x = horizontal ? v : u;
    const y = horizontal ? u : v;
    boxes.set(n.id, { id: n.id, x, y, width: n.width, height: n.height });
  }

  return {
    boxes,
    width:  horizontal ? alongTotal : crossTotal,
    height: horizontal ? crossTotal : alongTotal,
  };
}
