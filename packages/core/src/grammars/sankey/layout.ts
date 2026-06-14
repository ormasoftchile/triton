/**
 * @file grammars/sankey/layout.ts — Sankey layout engine.
 *
 * Architecture:
 *   SankeyDocument  →  layoutSankey()  →  Scene
 *
 * Algorithm (all deterministic, no iterative solvers):
 *
 * 1. NODE RANKING  — longest-path-from-any-source topological layering.
 *    Each node is assigned to a column = its maximum depth from any source.
 *    Ties broken by node first-appearance order (stable).
 *    Cycles are broken deterministically by skipping back-edges (first time
 *    a node would be assigned a depth ≤ its already-assigned depth).
 *
 * 2. VALUE SCALE  — a single closed-form linear scale maps flow value → pixels.
 *    The scale is derived from the maximum column throughput (max total in or
 *    out flow for any column) so the tallest column exactly fills contentHeight
 *    minus gaps.
 *
 * 3. VERTICAL PLACEMENT  — nodes within each column are stacked top-to-bottom
 *    in stable first-appearance order (no crossing-minimisation — documented
 *    choice: crossing-min is iterative/non-deterministic; stable order is
 *    reproducible and visually clean for typical Mermaid sankey-beta diagrams).
 *
 * 4. RIBBONS  — each link is a cubic Bezier path from right edge of source bar
 *    to left edge of target bar. Source and target vertical offsets are tracked
 *    per-bar edge so ribbons stack without overlapping their own band.
 *    Fill = source node color at ribbonOpacity; stroke same color at 0.5 px.
 *
 * 5. LABELS  — node name placed:
 *    - Leftmost column: to the left of the bar (anchor end).
 *    - Rightmost column: to the right of the bar (anchor start).
 *    - Middle columns: to the right (anchor start) — or left if more room.
 *    Edge-aware: if label would clip the left or right canvas boundary, flip to
 *    the other side.  Labels are vertically centered on the bar midpoint.
 */

import type { PathPrimitive, RectPrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';

import type { SankeyDocument, SankeyLink, SankeyNode } from './types.js';
import type { SankeyTheme } from './theme.js';
import { resolveSankeyTheme } from './theme.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Step 1 — Node ranking (longest-path topological layering)
// ---------------------------------------------------------------------------

/**
 * Assign each node to a column index (0 = leftmost = sources).
 *
 * Algorithm: iterative longest-path from sources.
 *   - Start all nodes at rank 0.
 *   - Process nodes in first-appearance order (stable).
 *   - For each link (source → target): if rank(target) ≤ rank(source), set
 *     rank(target) = rank(source) + 1 and push target back onto the queue.
 *   - Cycle guard: a node is processed at most N times; on the Nth attempt,
 *     skip (log warning) and leave at current rank. This is the back-edge
 *     cycle break — deterministic because we process in stable order.
 *
 * Returns a Map<nodeId, columnIndex>.
 */
function assignRanks(
  nodes: SankeyNode[],
  links: SankeyLink[],
  warnings: string[],
): Map<string, number> {
  const rank = new Map<string, number>();
  for (const node of nodes) rank.set(node.id, 0);

  const MAX_PASSES = nodes.length + 1;
  const passCount = new Map<string, number>();
  for (const node of nodes) passCount.set(node.id, 0);

  // Process each link: propagate rank through the graph.
  // We repeat until stable (no rank changes) or MAX_PASSES exceeded.
  let changed = true;
  let globalPasses = 0;
  while (changed && globalPasses < MAX_PASSES) {
    changed = false;
    globalPasses++;
    for (const link of links) {
      const srcRank = rank.get(link.source) ?? 0;
      const tgtRank = rank.get(link.target) ?? 0;
      if (tgtRank <= srcRank) {
        const newRank = srcRank + 1;
        const tgtPasses = (passCount.get(link.target) ?? 0) + 1;
        if (tgtPasses > nodes.length) {
          warnings.push(`Cycle detected involving node "${link.target}" — breaking at this edge (deterministic).`);
          continue;
        }
        passCount.set(link.target, tgtPasses);
        rank.set(link.target, newRank);
        changed = true;
      }
    }
  }

  return rank;
}

// ---------------------------------------------------------------------------
// Step 2 — Column throughput + value scale
// ---------------------------------------------------------------------------

/**
 * Compute the value→pixel scale.
 *
 * Scale = (contentHeight - totalGapPx) / maxColumnThroughput
 *
 * maxColumnThroughput = max over all columns of (sum of all node throughputs in that column),
 * where throughput(node) = max(totalIn, totalOut).
 *
 * This ensures the tallest column exactly fills the available height.
 */
function computeScale(
  nodes: SankeyNode[],
  links: SankeyLink[],
  ranks: Map<string, number>,
  numColumns: number,
  contentHeight: number,
  nodeGapY: number,
  nodeBarMinHeight: number,
): number {
  // Per-node throughput maps
  const inFlow = new Map<string, number>();
  const outFlow = new Map<string, number>();
  for (const node of nodes) {
    inFlow.set(node.id, 0);
    outFlow.set(node.id, 0);
  }
  for (const link of links) {
    outFlow.set(link.source, (outFlow.get(link.source) ?? 0) + link.value);
    inFlow.set(link.target, (inFlow.get(link.target) ?? 0) + link.value);
  }

  // Group nodes by column
  const byColumn: Map<number, SankeyNode[]> = new Map();
  for (let c = 0; c < numColumns; c++) byColumn.set(c, []);
  for (const node of nodes) {
    const col = ranks.get(node.id) ?? 0;
    byColumn.get(col)!.push(node);
  }

  let maxThroughput = 0;
  for (let c = 0; c < numColumns; c++) {
    const colNodes = byColumn.get(c) ?? [];
    const n = colNodes.length;
    // total throughput for this column = sum of each node's throughput
    let colTotal = 0;
    for (const node of colNodes) {
      const throughput = Math.max(inFlow.get(node.id) ?? 0, outFlow.get(node.id) ?? 0);
      colTotal += throughput;
    }
    // Available height for bars = contentHeight - gaps between n bars
    const gapTotal = Math.max(0, n - 1) * nodeGapY;
    // The column total throughput must fit in (contentHeight - gapTotal)
    if (colTotal > maxThroughput) maxThroughput = colTotal;
    void gapTotal; // used below in bar sizing
  }

  if (maxThroughput <= 0) return nodeBarMinHeight; // degenerate: all values 0

  // Find the column that is most constrained (needs the largest scale to fill)
  // The scale = (contentHeight - gapTotal) / colTotal  — smallest scale wins
  let scale = Infinity;
  for (let c = 0; c < numColumns; c++) {
    const colNodes = byColumn.get(c) ?? [];
    const n = colNodes.length;
    const gapTotal = Math.max(0, n - 1) * nodeGapY;
    const available = contentHeight - gapTotal;
    if (available <= 0) continue;
    let colTotal = 0;
    for (const node of colNodes) {
      const throughput = Math.max(inFlow.get(node.id) ?? 0, outFlow.get(node.id) ?? 0);
      colTotal += throughput;
    }
    if (colTotal <= 0) continue;
    const s = available / colTotal;
    if (s < scale) scale = s;
  }

  return scale === Infinity ? nodeBarMinHeight : Math.max(scale, nodeBarMinHeight / maxThroughput);
}

// ---------------------------------------------------------------------------
// Layout interfaces
// ---------------------------------------------------------------------------

interface LayoutNode {
  node: SankeyNode;
  col: number;
  /** Bar top y (in content coordinates) */
  y: number;
  /** Bar pixel height */
  height: number;
  /** Bar center y */
  centerY: number;
  /** Canvas x of bar left edge */
  x: number;
  color: string;
  /** Current offset from bar top for ribbon stacking on right edge (out-flows). */
  outY: number;
  /** Current offset from bar top for ribbon stacking on left edge (in-flows). */
  inY: number;
}

// ---------------------------------------------------------------------------
// Main layout entry point
// ---------------------------------------------------------------------------

export function layoutSankey(doc: SankeyDocument, themeOverride?: SankeyTheme): Scene {
  const tk = themeOverride ?? resolveSankeyTheme(doc.metadata.theme);

  const warnings: string[] = [];

  // Build rank map
  const ranks = assignRanks(doc.nodes, doc.links, warnings);

  // Determine number of columns
  const maxRank = doc.nodes.reduce((m, n) => Math.max(m, ranks.get(n.id) ?? 0), 0);
  const numColumns = maxRank + 1;

  // Build per-column node lists (in stable first-appearance order within each column)
  const byColumn: Map<number, SankeyNode[]> = new Map();
  for (let c = 0; c < numColumns; c++) byColumn.set(c, []);
  for (const node of [...doc.nodes].sort((a, b) => a.order - b.order)) {
    const col = ranks.get(node.id) ?? 0;
    byColumn.get(col)!.push(node);
  }

  // Per-node throughput (for bar sizing)
  const inFlow = new Map<string, number>();
  const outFlow = new Map<string, number>();
  for (const node of doc.nodes) {
    inFlow.set(node.id, 0);
    outFlow.set(node.id, 0);
  }
  for (const link of doc.links) {
    outFlow.set(link.source, (outFlow.get(link.source) ?? 0) + link.value);
    inFlow.set(link.target, (inFlow.get(link.target) ?? 0) + link.value);
  }

  // Compute value→pixel scale
  const scale = computeScale(
    doc.nodes,
    doc.links,
    ranks,
    numColumns,
    tk.contentHeight,
    tk.nodeGapY,
    tk.nodeBarMinHeight,
  );

  // Compute column x positions
  // Total content width = numColumns * nodeBarWidth + (numColumns-1) * columnGapX
  const totalContentWidth = numColumns * tk.nodeBarWidth + Math.max(0, numColumns - 1) * tk.columnGapX;

  // Compute label widths to add to margin if labels extend beyond the bars
  // Left column labels go to the left; right column labels go to the right
  // We'll compute actual label widths later, but for margins use a fixed estimate initially.
  const labelReserveLeft = 160;
  const labelReserveRight = 160;

  const canvasWidth = rhuInt(tk.marginLeft + labelReserveLeft + totalContentWidth + labelReserveRight + tk.marginRight);

  // Content area starts at:
  const contentLeft = rhuInt(tk.marginLeft + labelReserveLeft);
  const contentTop = rhuInt(tk.marginTop);

  function colX(col: number): number {
    return rhuInt(contentLeft + col * (tk.nodeBarWidth + tk.columnGapX));
  }

  // Assign node colors by stable global appearance order
  const nodeColorMap = new Map<string, string>();
  for (const node of doc.nodes) {
    nodeColorMap.set(node.id, tk.nodePalette[node.order % tk.nodePalette.length] ?? '#6366f1');
  }

  // Lay out nodes within each column
  const layoutNodes = new Map<string, LayoutNode>();

  for (let c = 0; c < numColumns; c++) {
    const colNodes = byColumn.get(c) ?? [];
    const n = colNodes.length;

    // Compute bar heights
    const barHeights = colNodes.map((node) => {
      const throughput = Math.max(inFlow.get(node.id) ?? 0, outFlow.get(node.id) ?? 0);
      const h = throughput > 0
        ? Math.max(rhuInt(throughput * scale), tk.nodeBarMinHeight)
        : tk.nodeBarMinHeight;
      return h;
    });

    // Total height used
    const totalBarH = barHeights.reduce((s, h) => s + h, 0);
    const totalGapH = Math.max(0, n - 1) * tk.nodeGapY;
    const totalUsed = totalBarH + totalGapH;

    // Center vertically within contentHeight
    const startY = rhuInt(contentTop + Math.max(0, tk.contentHeight - totalUsed) / 2);

    let curY = startY;
    for (let i = 0; i < colNodes.length; i++) {
      const node = colNodes[i]!;
      const h = barHeights[i]!;
      const x = colX(c);
      const color = nodeColorMap.get(node.id) ?? '#6366f1';

      layoutNodes.set(node.id, {
        node,
        col: c,
        y: curY,
        height: h,
        centerY: rhuInt(curY + h / 2),
        x,
        color,
        outY: 0,
        inY: 0,
      });

      curY += h + tk.nodeGapY;
    }
  }

  // ---------------------------------------------------------------------------
  // Build Scene primitives
  // ---------------------------------------------------------------------------

  const primitives: ScenePrimitive[] = [];

  // Title
  const titleHeight = doc.metadata.title ? tk.labelFontSize + 18 : 0;
  if (doc.metadata.title) {
    const titlePrimitive: TextPrimitive = {
      kind: 'text',
      x: rhuInt(canvasWidth / 2),
      y: rhuInt(tk.marginTop / 2 + titleHeight / 2 - 4),
      text: doc.metadata.title,
      fontFamily: tk.fontFamily,
      fontSize: tk.labelFontSize + 4,
      fontWeight: 700,
      fill: tk.labelColor,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    };
    primitives.push(titlePrimitive);
  }

  // ── Ribbons (drawn before bars so bars render on top) ──────────────────

  for (const link of doc.links) {
    const src = layoutNodes.get(link.source);
    const tgt = layoutNodes.get(link.target);
    if (!src || !tgt) continue;
    if (link.value <= 0) continue;

    const ribbonHeight = Math.max(1, rhuInt(link.value * scale));
    const srcColor = src.color;

    // Source right edge x
    const x1 = src.x + tk.nodeBarWidth;
    // Target left edge x
    const x2 = tgt.x;

    // Source y range (stacked from top of bar, tracking outY)
    const y1Top = src.y + src.outY;
    const y1Bot = y1Top + ribbonHeight;
    src.outY += ribbonHeight;

    // Target y range (stacked from top of bar, tracking inY)
    const y2Top = tgt.y + tgt.inY;
    const y2Bot = y2Top + ribbonHeight;
    tgt.inY += ribbonHeight;

    // Cubic Bezier control points at 1/3 and 2/3 of x distance
    const cx1 = rhuInt(x1 + (x2 - x1) / 3);
    const cx2 = rhuInt(x1 + 2 * (x2 - x1) / 3);

    // Path: top curve source→target, then bottom curve target→source (closed fill)
    const d = [
      `M ${x1} ${y1Top}`,
      `C ${cx1} ${y1Top} ${cx2} ${y2Top} ${x2} ${y2Top}`,
      `L ${x2} ${y2Bot}`,
      `C ${cx2} ${y2Bot} ${cx1} ${y1Bot} ${x1} ${y1Bot}`,
      'Z',
    ].join(' ');

    const ribbon: PathPrimitive = {
      kind: 'path',
      d,
      fill: srcColor,
      stroke: srcColor,
      strokeWidth: tk.ribbonStrokeWidth,
      opacity: tk.ribbonOpacity,
    };
    primitives.push(ribbon);
  }

  // ── Node bars ──────────────────────────────────────────────────────────

  for (const ln of layoutNodes.values()) {
    const bar: RectPrimitive = {
      kind: 'rect',
      x: ln.x,
      y: ln.y,
      width: tk.nodeBarWidth,
      height: ln.height,
      fill: ln.color,
      rx: 3,
      opacity: 1,
    };
    primitives.push(bar);
  }

  // ── Labels ─────────────────────────────────────────────────────────────

  for (const ln of layoutNodes.values()) {
    const label = ln.node.label;
    const labelW = rhuInt(measureText(label, tk.labelFontSize).width);
    const isLeftmost = ln.col === 0;
    const isRightmost = ln.col === maxRank;

    let textAnchor: 'start' | 'end';
    let labelX: number;

    if (isLeftmost) {
      // Try to place to the left
      textAnchor = 'end';
      labelX = ln.x - tk.labelGap;
      // Edge guard: label would clip left margin
      if (labelX - labelW < 2) {
        textAnchor = 'start';
        labelX = ln.x + tk.nodeBarWidth + tk.labelGap;
      }
    } else if (isRightmost) {
      // Try to place to the right
      textAnchor = 'start';
      labelX = ln.x + tk.nodeBarWidth + tk.labelGap;
      // Edge guard: label would clip right canvas boundary
      if (labelX + labelW > canvasWidth - 4) {
        textAnchor = 'end';
        labelX = ln.x - tk.labelGap;
      }
    } else {
      // Middle columns: prefer right side
      textAnchor = 'start';
      labelX = ln.x + tk.nodeBarWidth + tk.labelGap;
      if (labelX + labelW > canvasWidth - 4) {
        textAnchor = 'end';
        labelX = ln.x - tk.labelGap;
      }
    }

    const labelY = ln.centerY;

    const labelPrimitive: TextPrimitive = {
      kind: 'text',
      x: rhuInt(labelX),
      y: rhuInt(labelY),
      text: label,
      fontFamily: tk.fontFamily,
      fontSize: tk.labelFontSize,
      fontWeight: tk.labelFontWeight,
      fill: tk.labelColor,
      textAnchor,
      dominantBaseline: 'middle',
    };
    primitives.push(labelPrimitive);
  }

  // ── Canvas dimensions ──────────────────────────────────────────────────

  const canvasHeight = rhuInt(tk.marginTop + titleHeight + tk.contentHeight + tk.marginBottom);

  return {
    width: canvasWidth,
    height: canvasHeight,
    background: tk.background,
    primitives,
  };
}
