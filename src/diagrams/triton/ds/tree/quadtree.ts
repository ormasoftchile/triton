/**
 * @file diagrams/tree/quadtree.ts — Spatial Quadtree diagram module.
 *
 * Visualizes 2D space recursive partitioning:
 *   - 2D Spatial Partitioning Grid (NW, NE, SW, SE quadrants with data points).
 *   - 4-ary Hierarchy Tree with branch pointers to sub-quadrants.
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

export interface QuadPoint {
  readonly x: number;
  readonly y: number;
  readonly label?: string | undefined;
}

export interface QuadNode {
  readonly id: string;
  readonly label: string;
  readonly bounds: { x: number; y: number; w: number; h: number };
  readonly points: readonly QuadPoint[];
  readonly children: readonly string[];
}

export interface QuadTreeDocument extends BaseIR {
  readonly title?: string | undefined;
  readonly bounds: { x: number; y: number; w: number; h: number };
  readonly capacity: number;
  readonly nodes: readonly QuadNode[];
}

export function buildQuadTree(input: string): QuadTreeDocument {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let title: string | undefined;
  let capacity = 1;
  let bounds = { x: 0, y: 0, w: 100, h: 100 };
  const rawPoints: QuadPoint[] = [];
  const manualLines: string[] = [];

  for (const line of lines) {
    if (/^quadtree\b/i.test(line)) continue;

    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    const capMatch = line.match(/^capacity\s+(\d+)/i);
    if (capMatch) {
      capacity = Math.max(1, Number(capMatch[1]));
      continue;
    }

    const boundsMatch = line.match(/^bounds\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i);
    if (boundsMatch) {
      bounds = {
        x: Number(boundsMatch[1]),
        y: Number(boundsMatch[2]),
        w: Number(boundsMatch[3]),
        h: Number(boundsMatch[4]),
      };
      continue;
    }

    const insertMatch = line.match(/^insert\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)(?:\s+["']?([^"']+)["']?)?/i);
    if (insertMatch) {
      rawPoints.push({
        x: Number(insertMatch[1]),
        y: Number(insertMatch[2]),
        ...(insertMatch[3] ? { label: insertMatch[3] } : {}),
      });
      continue;
    }

    manualLines.push(line);
  }

  if (rawPoints.length > 0) {
    return buildAlgorithmicQuadTree(rawPoints, bounds, capacity, title);
  }

  return parseExplicitQuadTree(manualLines.join('\n'), bounds, title);
}

function buildAlgorithmicQuadTree(
  points: QuadPoint[],
  bounds: { x: number; y: number; w: number; h: number },
  capacity: number,
  title?: string,
): QuadTreeDocument {
  interface InternalQuad {
    id: string;
    label: string;
    b: { x: number; y: number; w: number; h: number };
    pts: QuadPoint[];
    children: InternalQuad[];
  }

  let idCounter = 1;

  function subdivide(box: { x: number; y: number; w: number; h: number }, pts: QuadPoint[], label: string, depth: number): InternalQuad {
    const id = `q_${idCounter++}`;
    if (pts.length <= capacity || depth >= 4) {
      return { id, label, b: box, pts, children: [] };
    }

    const hw = box.w / 2;
    const hh = box.h / 2;
    const nwBox = { x: box.x, y: box.y, w: hw, h: hh };
    const neBox = { x: box.x + hw, y: box.y, w: hw, h: hh };
    const swBox = { x: box.x, y: box.y + hh, w: hw, h: hh };
    const seBox = { x: box.x + hw, y: box.y + hh, w: hw, h: hh };

    const inBox = (p: QuadPoint, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;

    const nwPts = pts.filter((p) => inBox(p, nwBox));
    const nePts = pts.filter((p) => inBox(p, neBox));
    const swPts = pts.filter((p) => inBox(p, swBox));
    const sePts = pts.filter((p) => inBox(p, seBox));

    return {
      id,
      label,
      b: box,
      pts: [],
      children: [
        subdivide(nwBox, nwPts, `${label}-NW`, depth + 1),
        subdivide(neBox, nePts, `${label}-NE`, depth + 1),
        subdivide(swBox, swPts, `${label}-SW`, depth + 1),
        subdivide(seBox, sePts, `${label}-SE`, depth + 1),
      ],
    };
  }

  const root = subdivide(bounds, points, 'Root', 0);
  const flatNodes: QuadNode[] = [];

  function collect(node: InternalQuad) {
    flatNodes.push({
      id: node.id,
      label: node.label,
      bounds: node.b,
      points: node.pts,
      children: node.children.map((c) => c.id),
    });
    for (const c of node.children) collect(c);
  }

  collect(root);

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    ...(title ? { title } : {}),
    bounds,
    capacity,
    nodes: flatNodes,
  };
}

function parseExplicitQuadTree(
  input: string,
  bounds: { x: number; y: number; w: number; h: number },
  title?: string,
): QuadTreeDocument {
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const nodes: QuadNode[] = [];

  for (const line of lines) {
    const clean = line.replace(/^(root|leaf|node)\s+/i, '');
    const arrowIdx = clean.indexOf('->');
    const decl = arrowIdx >= 0 ? clean.slice(0, arrowIdx).trim() : clean;
    const targets = arrowIdx >= 0 ? clean.slice(arrowIdx + 2).trim().split(/[,;\s]+/).filter(Boolean) : [];

    const bracketMatch = decl.match(/\[(.*?)\]/);
    let id = '';
    let label = '';
    if (bracketMatch) {
      id = decl.slice(0, bracketMatch.index).trim();
      label = bracketMatch[1]!.trim();
    } else {
      const parts = decl.split(/\s+/);
      id = parts[0]!;
      label = parts.slice(1).join(' ') || id;
    }

    if (!id) id = `qn_${nodes.length + 1}`;

    nodes.push({
      id,
      label,
      bounds,
      points: [],
      children: targets,
    });
  }

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    ...(title ? { title } : {}),
    bounds,
    capacity: 1,
    nodes,
  };
}

// ─── Layout & Rendering ──────────────────────────────────────────────────────

const ARROW_ID = 'quad-arrow';

export function layoutQuadTree(ir: QuadTreeDocument, theme: ResolvedTheme): LayoutResult {
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

  // 1. Measure tree nodes
  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of ir.nodes) {
    const ptText = node.points.length > 0 ? node.points.map((pt) => pt.label ?? `(${pt.x},${pt.y})`).join(', ') : '';
    const mainW = measureText(node.label, smallFont).width + 24;
    const ptW = ptText ? measureText(ptText, smallFont - 1).width + 24 : 0;
    const w = Math.max(mainW, ptW, 80);
    const h = ptText ? 44 : 32;
    sizes.set(node.id, { width: w, height: h });
  }

  const inputs: TreeNodeInput[] = ir.nodes.map((n) => ({
    id: n.id,
    width: sizes.get(n.id)!.width,
    height: sizes.get(n.id)!.height,
    children: n.children,
  }));

  const treePlaced = treeLayout(inputs, {
    direction: 'TB',
    levelGap: 52,
    siblingGap: 20,
    margin,
  });

  const titleH = ir.title ? typography.titleFontSize + 24 : 0;

  // Spatial Grid Configuration (placed to the left of the tree)
  const gridSize = Math.max(220, Math.min(280, treePlaced.height - 40));
  const gridX = margin;
  const gridY = margin + titleH + 10;
  const treeOffsetX = gridX + gridSize + 40;

  const box = (id: string) => {
    const b = treePlaced.boxes.get(id)!;
    return { x: b.x + treeOffsetX, y: b.y + titleH, width: b.width, height: b.height };
  };

  const elements: SceneElement[] = [];

  // Title
  if (ir.title) {
    elements.push(
      p.text(
        ir.title,
        (treeOffsetX + treePlaced.width) / 2,
        margin + typography.titleFontSize,
        typography.titleFontSize + 2,
        palette.text,
        { anchor: 'middle', weight: 'bold' },
      ),
    );
  }

  // ─── Spatial Grid Render (Left Panel) ───────────────────────────────────────
  elements.push(
    p.text('SPATIAL 2D PARTITION', gridX + gridSize / 2, gridY - 8, smallFont, palette.textMuted, {
      anchor: 'middle',
      weight: 'bold',
    }),
  );

  elements.push(
    p.rect(
      { x: gridX, y: gridY, width: gridSize, height: gridSize },
      palette.surface,
      palette.primary,
      1.8,
      { rx: 6 },
    ),
  );

  const scaleX = gridSize / ir.bounds.w;
  const scaleY = gridSize / ir.bounds.h;

  for (const node of ir.nodes) {
    if (node.children.length > 0) {
      // Subdivide lines
      const midX = gridX + (node.bounds.x + node.bounds.w / 2 - ir.bounds.x) * scaleX;
      const midY = gridY + (node.bounds.y + node.bounds.h / 2 - ir.bounds.y) * scaleY;
      const minX = gridX + (node.bounds.x - ir.bounds.x) * scaleX;
      const maxX = gridX + (node.bounds.x + node.bounds.w - ir.bounds.x) * scaleX;
      const minY = gridY + (node.bounds.y - ir.bounds.y) * scaleY;
      const maxY = gridY + (node.bounds.y + node.bounds.h - ir.bounds.y) * scaleY;

      // Cross lines
      elements.push(p.path(`M ${rhu(midX)} ${rhu(minY)} L ${rhu(midX)} ${rhu(maxY)}`, palette.border, 1.2));
      elements.push(p.path(`M ${rhu(minX)} ${rhu(midY)} L ${rhu(maxX)} ${rhu(midY)}`, palette.border, 1.2));
    }

    // Points inside this leaf
    for (const pt of node.points) {
      const px = gridX + (pt.x - ir.bounds.x) * scaleX;
      const py = gridY + (pt.y - ir.bounds.y) * scaleY;

      elements.push(p.circle({ x: px, y: py }, 4.5, palette.primary, palette.background, 1.5));
      const ptLabel = pt.label ? `${pt.label} (${pt.x},${pt.y})` : `(${pt.x},${pt.y})`;
      elements.push(
        p.text(ptLabel, px + 8, py + 3, smallFont - 2, palette.text, { weight: 'bold' }),
      );
    }
  }

  // ─── Tree Hierarchy Render (Right Panel) ───────────────────────────────────
  // Edges
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

  // Nodes
  for (const node of ir.nodes) {
    const b = box(node.id);
    const isLeaf = node.children.length === 0;

    const stroke = isLeaf ? palette.primary : palette.border;
    elements.push(p.rect(b, palette.surface, stroke, isLeaf ? 1.8 : 1.5, { rx: 4 }));

    const textY = node.points.length > 0 ? b.y + 16 : b.y + b.height / 2 + smallFont * 0.35;
    elements.push(
      p.text(node.label, rhu(b.x + b.width / 2), rhu(textY), smallFont, palette.text, {
        anchor: 'middle',
        weight: 'bold',
      }),
    );

    if (node.points.length > 0) {
      const ptText = node.points.map((pt) => pt.label ?? `(${pt.x},${pt.y})`).join(', ');
      elements.push(
        p.text(ptText, rhu(b.x + b.width / 2), rhu(b.y + 34), smallFont - 1, palette.primary, {
          anchor: 'middle',
        }),
      );
    }
  }

  // Dynamic Markers
  const s = edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);

  const defs = [
    `<marker id="${ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.textMuted}" /></marker>`,
  ];

  const totalW = rhuInt(treeOffsetX + treePlaced.width);
  const totalH = rhuInt(Math.max(gridY + gridSize + margin, treePlaced.height + titleH + margin));

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  for (const node of ir.nodes) {
    anchors[node.id] = { bounds: box(node.id) };
  }

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

export const quadtree: DiagramModule<QuadTreeDocument> = {
  parseMermaid: buildQuadTree,
  parseYaml: (input) => JSON.parse(input) as QuadTreeDocument,
  layout: (ir: QuadTreeDocument, theme: ResolvedTheme): LayoutResult => layoutQuadTree(ir, theme),
};
