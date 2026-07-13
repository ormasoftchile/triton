import type {
  CompiledOverlays,
  Annotation,
  Legend,
  Scene,
  SceneElement,
  SceneGroup,
  Rect,
  Point,
  ResolvedTheme,
} from '../contracts/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const ANNO_MIN_W   = 100;
const ANNO_MAX_W   = 200;
const ANNO_PAD     = 10;
const ANNO_FOLD    = 10;
const LEGEND_MIN_W = 140;
const LEGEND_ROW_H = 20;
const LEGEND_PAD   = 10;
const LEGEND_MARGIN = 12;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface OverlayResult {
  /** Additional elements to append to the scene's elements list. */
  elements: SceneElement[];
  /** Expanded viewBox that encompasses all overlay geometry. */
  viewBox: Rect;
}

/**
 * Lay out compiled overlays (annotations + legend) relative to an existing scene.
 *
 * Diagram layout functions call this internally after positioning all nodes/edges.
 * The returned elements are appended to the scene's element list. The returned
 * viewBox replaces the scene's viewBox if it has expanded.
 */
export function layoutOverlays(
  compiled: CompiledOverlays,
  scene: Scene,
  theme: ResolvedTheme,
): OverlayResult {
  const result: SceneElement[] = [];
  let viewBox: Rect = { ...scene.viewBox };

  // Build element-id → bounding box map for annotation anchor resolution
  const boundsMap = new Map<string, Rect>();
  for (const el of scene.elements) {
    collectGroupBounds(el, 0, 0, boundsMap);
  }

  for (const anno of compiled.annotations) {
    const laid = layoutAnnotation(anno, boundsMap, theme);
    if (laid) {
      result.push(laid.group);
      viewBox = expandViewBox(viewBox, laid.bounds);
    }
  }

  if (compiled.legend) {
    const laid = layoutLegend(compiled.legend, viewBox, theme);
    result.push(laid.group);
    viewBox = expandViewBox(viewBox, laid.bounds);
  }

  return { elements: result, viewBox };
}

// ─── Annotation ───────────────────────────────────────────────────────────────

function layoutAnnotation(
  anno: Annotation,
  boundsMap: Map<string, Rect>,
  theme: ResolvedTheme,
): { group: SceneGroup; bounds: Rect } | null {
  const { palette, typography } = theme;

  // Resolve absolute anchor point
  let anchorPt: Point;
  let boxOrigin: Point;

  if ('elementId' in anno.anchor) {
    const elBounds = boundsMap.get(anno.anchor.elementId);
    if (!elBounds) return null;
    anchorPt = { x: elBounds.x + elBounds.width / 2, y: elBounds.y };
    boxOrigin = { x: anchorPt.x + anno.position.x, y: anchorPt.y + anno.position.y };
  } else {
    anchorPt = anno.anchor.point;
    boxOrigin = anno.position;
  }

  // Measure text
  const charW  = typography.baseFontSize * 0.52;
  const maxW   = anno.width ?? ANNO_MAX_W;
  const lines  = wrapText(anno.text, maxW, charW);
  const textW  = Math.max(ANNO_MIN_W, Math.min(maxW, Math.max(...lines.map(l => l.length * charW)) + ANNO_PAD * 2));
  const lineH  = typography.baseFontSize * typography.lineHeight;
  const boxW   = textW;
  const boxH   = lines.length * lineH + ANNO_PAD * 2;
  const { x, y } = boxOrigin;

  // Connector: dashed line from closest box-edge point to anchor
  const connStart = closestEdgePoint({ x, y, width: boxW, height: boxH }, anchorPt);

  const children: SceneElement[] = [
    // Connector
    {
      type: 'path',
      d: `M ${connStart.x} ${connStart.y} L ${anchorPt.x} ${anchorPt.y}`,
      stroke: palette.border,
      strokeWidth: 1,
      strokeDasharray: '4 3',
    },
    // Box body with folded corner
    {
      type: 'path',
      d: `M ${x} ${y} L ${x + boxW - ANNO_FOLD} ${y} L ${x + boxW} ${y + ANNO_FOLD} L ${x + boxW} ${y + boxH} L ${x} ${y + boxH} Z`,
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
    },
    // Fold triangle
    {
      type: 'path',
      d: `M ${x + boxW - ANNO_FOLD} ${y} L ${x + boxW - ANNO_FOLD} ${y + ANNO_FOLD} L ${x + boxW} ${y + ANNO_FOLD} Z`,
      fill: palette.border,
      stroke: palette.border,
      strokeWidth: 1,
    },
  ];

  // Text lines
  for (let i = 0; i < lines.length; i++) {
    children.push({
      type: 'text',
      content: lines[i] ?? '',
      position: { x: x + ANNO_PAD, y: y + ANNO_PAD + typography.baseFontSize + i * lineH },
      fontSize: typography.baseFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.text,
    });
  }

  const bx = Math.min(x, anchorPt.x);
  const by = Math.min(y, anchorPt.y);
  const bounds: Rect = {
    x: bx,
    y: by,
    width:  Math.max(boxW, Math.abs(anchorPt.x - x)) + Math.max(0, x - bx),
    height: Math.max(boxH, Math.abs(anchorPt.y - y)) + Math.max(0, y - by),
  };

  return { group: { type: 'group', id: anno.id, children }, bounds };
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function layoutLegend(
  legend: Legend,
  viewBox: Rect,
  theme: ResolvedTheme,
): { group: SceneGroup; bounds: Rect } {
  const { palette, typography } = theme;
  const titleH = legend.title ? LEGEND_ROW_H + 4 : 0;
  const boxH   = LEGEND_PAD * 2 + titleH + legend.entries.length * LEGEND_ROW_H;
  const boxW   = Math.max(
    legend.width ?? LEGEND_MIN_W,
    ...(legend.title ? [legend.title.length * typography.baseFontSize * 0.55 + LEGEND_PAD * 2] : []),
    ...legend.entries.map(e =>
      (e.key.length + e.value.length + 3) * typography.smallFontSize * 0.52 + LEGEND_PAD * 2,
    ),
  );

  const c = legend.corner;
  const x = (c === 'top-left'  || c === 'bottom-left')
    ? viewBox.x + LEGEND_MARGIN
    : viewBox.x + viewBox.width - boxW - LEGEND_MARGIN;
  const y = (c === 'top-left'  || c === 'top-right')
    ? viewBox.y + LEGEND_MARGIN
    : viewBox.y + viewBox.height - boxH - LEGEND_MARGIN;

  const children: SceneElement[] = [
    { type: 'rect', bounds: { x, y, width: boxW, height: boxH }, fill: palette.background, stroke: palette.border, strokeWidth: 1, rx: 4 },
  ];

  let rowY = y + LEGEND_PAD;

  if (legend.title) {
    children.push({ type: 'text', content: legend.title, position: { x: x + LEGEND_PAD, y: rowY + typography.baseFontSize }, fontSize: typography.baseFontSize, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
    rowY += LEGEND_ROW_H + 4;
    children.push({ type: 'path', d: `M ${x + 4} ${rowY - 2} L ${x + boxW - 4} ${rowY - 2}`, stroke: palette.border, strokeWidth: 1 });
  }

  for (const entry of legend.entries) {
    children.push({ type: 'text', content: entry.key, position: { x: x + LEGEND_PAD, y: rowY + typography.smallFontSize }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fontWeight: 'bold', fill: palette.text });
    children.push({ type: 'text', content: entry.value, position: { x: x + boxW / 2 + 4, y: rowY + typography.smallFontSize }, fontSize: typography.smallFontSize, fontFamily: typography.fontFamily, fill: palette.textMuted });
    rowY += LEGEND_ROW_H;
  }

  return {
    group: { type: 'group', children },
    bounds: { x, y, width: boxW, height: boxH },
  };
}

// ─── Scene Tree Walking ───────────────────────────────────────────────────────

/** Walk the element tree collecting id → bounding box for every named group. */
function collectGroupBounds(
  el: SceneElement,
  ox: number,
  oy: number,
  map: Map<string, Rect>,
): void {
  if (el.type !== 'group') return;

  const [tx, ty] = parseTranslate(el.transform);
  const nx = ox + tx;
  const ny = oy + ty;

  if (el.id) {
    const childBounds = el.children
      .map(c => elementBoundsAt(c, nx, ny))
      .filter((b): b is Rect => b !== null);
    if (childBounds.length > 0) map.set(el.id, unionRects(childBounds));
  }

  for (const child of el.children) {
    collectGroupBounds(child, nx, ny, map);
  }
}

function elementBoundsAt(el: SceneElement, ox: number, oy: number): Rect | null {
  switch (el.type) {
    case 'rect':
      return { x: el.bounds.x + ox, y: el.bounds.y + oy, width: el.bounds.width, height: el.bounds.height };
    case 'circle':
      return { x: el.center.x - el.radius + ox, y: el.center.y - el.radius + oy, width: el.radius * 2, height: el.radius * 2 };
    case 'text':
      return { x: el.position.x + ox, y: el.position.y - el.fontSize + oy, width: el.content.length * el.fontSize * 0.5, height: el.fontSize * 1.4 };
    case 'group': {
      const [tx, ty] = parseTranslate(el.transform);
      const kids = el.children.map(c => elementBoundsAt(c, ox + tx, oy + ty)).filter((b): b is Rect => b !== null);
      return kids.length > 0 ? unionRects(kids) : null;
    }
    case 'path':
      return null;
    case 'icon':
      return { x: el.x + ox, y: el.y + oy, width: el.size, height: el.size };
  }
}

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

function parseTranslate(transform: string | undefined): [number, number] {
  if (!transform) return [0, 0];
  const m = transform.match(/translate\(\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)\s*\)/);
  return m ? [parseFloat(m[1]!), parseFloat(m[2]!)] : [0, 0];
}

function closestEdgePoint(box: Rect, target: Point): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) * box.height > Math.abs(dy) * box.width) {
    const sx = dx > 0 ? 1 : -1;
    const ex = cx + sx * box.width / 2;
    const ey = cy + (Math.abs(dx) > 0 ? (dy / Math.abs(dx)) * (box.width / 2) : 0);
    return { x: ex, y: clamp(ey, box.y, box.y + box.height) };
  } else {
    const sy = dy > 0 ? 1 : -1;
    const ey = cy + sy * box.height / 2;
    const ex = cx + (Math.abs(dy) > 0 ? (dx / Math.abs(dy)) * (box.height / 2) : 0);
    return { x: clamp(ex, box.x, box.x + box.width), y: ey };
  }
}

function wrapText(text: string, maxWidth: number, charWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length * charWidth > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function expandViewBox(vb: Rect, bounds: Rect): Rect {
  const x      = Math.min(vb.x, bounds.x);
  const y      = Math.min(vb.y, bounds.y);
  const right  = Math.max(vb.x + vb.width,  bounds.x + bounds.width);
  const bottom = Math.max(vb.y + vb.height, bounds.y + bounds.height);
  return { x, y, width: right - x, height: bottom - y };
}

function unionRects(rects: Rect[]): Rect {
  const x      = Math.min(...rects.map(r => r.x));
  const y      = Math.min(...rects.map(r => r.y));
  const right  = Math.max(...rects.map(r => r.x + r.width));
  const bottom = Math.max(...rects.map(r => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
