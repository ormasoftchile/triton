/**
 * Flowchart Layout — Positions nodes and edges into a Scene.
 *
 * Simplified implementation: places nodes in a grid (Sugiyama stub).
 * Uses shared routing for edge paths.
 */

import type { FlowDocument } from './ir.js';
import type { Scene, SceneElement, Annotation, Legend } from '../../scene/types.js';
import type { ResolvedTheme } from '../../theme/types.js';
import { computeRoute } from '../../routing/index.js';
import { compileOverlays } from '../../scene/compile-overlays.js';

export function layoutFlowchart(ir: FlowDocument, theme: ResolvedTheme): Scene {
  const { spacing, palette, typography, edges: edgeTheme } = theme;
  const elements: SceneElement[] = [];

  const nodeWidth = 120;
  const nodeHeight = 40;
  const colGap = spacing.nodeGap;
  const rowGap = spacing.nodeGap;
  const margin = spacing.diagramMargin;

  // Compile overlays from IR (if present)
  const { annotations, legend } = ir.overlays
    ? compileOverlays(ir.overlays)
    : { annotations: [] as Annotation[], legend: undefined as Legend | undefined };

  // Reserve space for legend before placing nodes
  const legendReserve = legend ? computeLegendReserve(legend, theme) : { right: 0, bottom: 0, left: 0, top: 0 };

  // Simple layered placement: 1 column, top-to-bottom
  // (real impl would use Sugiyama rank assignment)
  const nodePositions = new Map<string, { x: number; y: number }>();

  const isLR = ir.direction === 'LR' || ir.direction === 'RL';
  let col = 0;
  let row = 0;
  const maxPerRank = isLR ? 1 : 3; // LR: 1 per column; TD: 3 per row

  for (const node of ir.nodes) {
    const x = margin + (isLR ? col * (nodeWidth + colGap) : row * (nodeWidth + colGap));
    const y = margin + (isLR ? row * (nodeHeight + rowGap) : col * (nodeHeight + rowGap));
    nodePositions.set(node.id, { x, y });

    // Node shape
    const rx = node.shape === 'rounded-rect' || node.shape === 'stadium' ? 8 : node.shape === 'circle' ? nodeHeight / 2 : 0;
    if (node.shape === 'diamond') {
      const cx = x + nodeWidth / 2;
      const cy = y + nodeHeight / 2;
      const hw = nodeWidth / 2 - 4;
      const hh = nodeHeight / 2 - 2;
      elements.push({
        type: 'path',
        d: `M ${cx} ${cy - hh} L ${cx + hw} ${cy} L ${cx} ${cy + hh} L ${cx - hw} ${cy} Z`,
        fill: palette.surface,
        stroke: palette.border,
        strokeWidth: 1.5,
      });
    } else {
      elements.push({
        type: 'rect',
        bounds: { x, y, width: nodeWidth, height: nodeHeight },
        fill: palette.surface,
        stroke: palette.border,
        strokeWidth: 1.5,
        rx, ry: rx,
      });
    }

    // Label
    elements.push({
      type: 'text',
      content: node.label,
      position: { x: x + nodeWidth / 2, y: y + nodeHeight / 2 + 5 },
      fontSize: typography.baseFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.text,
      anchor: 'middle',
    });

    col++;
    if (col >= maxPerRank) { col = 0; row++; }
  }

  // Edges
  for (const edge of ir.edges) {
    const fromPos = nodePositions.get(edge.from);
    const toPos = nodePositions.get(edge.to);
    if (!fromPos || !toPos) continue;

    // Anchor at center-bottom → center-top (for TD) or center-right → center-left (for LR)
    const from = isLR
      ? { x: fromPos.x + nodeWidth, y: fromPos.y + nodeHeight / 2 }
      : { x: fromPos.x + nodeWidth / 2, y: fromPos.y + nodeHeight };
    const to = isLR
      ? { x: toPos.x, y: toPos.y + nodeHeight / 2 }
      : { x: toPos.x + nodeWidth / 2, y: toPos.y };

    const route = computeRoute(from, to, { style: 'bezier', obstacles: [], padding: 8, tension: 0.4 });

    const dasharray = edge.style === 'dotted' ? '4 3' : undefined;
    elements.push({
      type: 'path',
      d: route.path,
      stroke: palette.primary,
      strokeWidth: edgeTheme.strokeWidth,
      strokeDasharray: dasharray,
      markerEnd: 'arrowhead',
    });

    // Edge label
    if (edge.label) {
      elements.push({
        type: 'text',
        content: edge.label,
        position: route.labelPosition,
        fontSize: edgeTheme.labelFontSize,
        fontFamily: typography.fontFamily,
        fill: palette.textMuted,
        anchor: 'middle',
      });
    }
  }

  // ViewBox — account for legend reserved space
  const maxX = Math.max(...[...nodePositions.values()].map(p => p.x)) + nodeWidth + margin + legendReserve.right;
  const maxY = Math.max(...[...nodePositions.values()].map(p => p.y)) + nodeHeight + margin + legendReserve.bottom;

  // Resolve annotation positions from node positions
  const resolvedAnnotations = resolveAnnotations(annotations, nodePositions, nodeWidth, nodeHeight);

  return {
    viewBox: { x: 0, y: 0, width: maxX, height: maxY },
    background: palette.background,
    elements,
    defs: [
      `<marker id="arrowhead" markerWidth="${edgeTheme.arrowSize}" markerHeight="${edgeTheme.arrowSize}" refX="${edgeTheme.arrowSize}" refY="${edgeTheme.arrowSize / 2}" orient="auto"><path d="M 0 0 L ${edgeTheme.arrowSize} ${edgeTheme.arrowSize / 2} L 0 ${edgeTheme.arrowSize}" fill="${palette.primary}" /></marker>`,
    ],
    annotations: resolvedAnnotations.length > 0 ? resolvedAnnotations : undefined,
    legend,
  };
}

// ─── Overlay Helpers ───────────────────────────────────────────────────────────

/**
 * Resolve annotation positions: convert relative offsets from target element
 * into absolute positions using the node position map.
 */
function resolveAnnotations(
  annotations: Annotation[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number,
): Annotation[] {
  return annotations.map(anno => {
    if ('elementId' in anno.anchor) {
      // Try exact match, then lowercased (grammar sanitizes IDs to lowercase)
      const pos = nodePositions.get(anno.anchor.elementId)
        || nodePositions.get(anno.anchor.elementId.toLowerCase());
      if (pos) {
        // Resolve: annotation position is offset from target node center
        const targetCenter = { x: pos.x + nodeWidth / 2, y: pos.y + nodeHeight / 2 };
        return {
          ...anno,
          position: {
            x: targetCenter.x + anno.position.x,
            y: targetCenter.y + anno.position.y,
          },
          anchor: { point: targetCenter },
        };
      }
    }
    return anno;
  });
}

/**
 * Compute extra margin to reserve for a legend block in a corner.
 */
function computeLegendReserve(
  legend: Legend,
  theme: ResolvedTheme,
): { top: number; right: number; bottom: number; left: number } {
  const charWidth = theme.typography.baseFontSize * 0.5;
  const rowHeight = 20;
  const padding = 10;
  const gap = 20;

  const maxKeyLen = Math.max(...legend.entries.map(e => e.key.length), 0);
  const maxValLen = Math.max(...legend.entries.map(e => e.value.length), 0);
  const titleLen = legend.title ? legend.title.length : 0;
  const width = Math.max((maxKeyLen + maxValLen + 3) * charWidth, titleLen * charWidth * 1.1, 140) + padding * 2;
  const height = (legend.title ? rowHeight + 4 : 0) + legend.entries.length * rowHeight + padding * 2;

  const reserve = { top: 0, right: 0, bottom: 0, left: 0 };
  if (legend.corner.includes('right')) reserve.right = width + gap;
  if (legend.corner.includes('left')) reserve.left = width + gap;
  if (legend.corner.includes('bottom')) reserve.bottom = height + gap;
  if (legend.corner.includes('top')) reserve.top = height + gap;

  return reserve;
}
