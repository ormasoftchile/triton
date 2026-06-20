/**
 * Overlay Layout — Shared helpers for annotations and legends.
 *
 * Any diagram's layout() can call these to produce SceneElements
 * for comment blocks and corner legends. The overlays are positioned
 * relative to the existing Scene viewBox.
 */

import type {
  Annotation,
  Legend,
  LegendCorner,
  Point,
  Rect,
  SceneElement,
  SceneGroup,
  Scene,
} from './types.js';
import type { ResolvedTheme } from '../theme/types.js';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ANNOTATION_MIN_WIDTH = 100;
const ANNOTATION_MAX_WIDTH = 200;
const ANNOTATION_PADDING = 10;
const ANNOTATION_FOLD_SIZE = 10;  // folded corner
const LEGEND_MIN_WIDTH = 140;
const LEGEND_ROW_HEIGHT = 20;
const LEGEND_PADDING = 10;
const LEGEND_MARGIN = 12;

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Lay out all overlays (annotations + legend) and return additional
 * elements to append to the scene. Also returns an expanded viewBox
 * if overlays extend beyond the original bounds.
 */
export function layoutOverlays(
  scene: Scene,
  theme: ResolvedTheme,
): { elements: SceneElement[]; viewBox: Rect } {
  const overlayElements: SceneElement[] = [];
  let viewBox = { ...scene.viewBox };

  if (scene.annotations) {
    for (const anno of scene.annotations) {
      const { group, bounds } = layoutAnnotation(anno, theme);
      overlayElements.push(group);
      viewBox = expandViewBox(viewBox, bounds);
    }
  }

  if (scene.legend) {
    const { group, bounds } = layoutLegend(scene.legend, viewBox, theme);
    overlayElements.push(group);
    viewBox = expandViewBox(viewBox, bounds);
  }

  return { elements: overlayElements, viewBox };
}

// ─── Annotation Layout ────────────────────────────────────────────────────────

function layoutAnnotation(
  anno: Annotation,
  theme: ResolvedTheme,
): { group: SceneGroup; bounds: Rect } {
  const { palette, typography } = theme;

  // Measure text (rough: 7px per char at base font size)
  const charWidth = typography.baseFontSize * 0.5;
  const lines = wrapText(anno.text, anno.width || ANNOTATION_MAX_WIDTH, charWidth);
  const textWidth = Math.min(
    anno.width || ANNOTATION_MAX_WIDTH,
    Math.max(ANNOTATION_MIN_WIDTH, Math.max(...lines.map(l => l.length * charWidth)) + ANNOTATION_PADDING * 2),
  );
  const lineHeight = typography.baseFontSize * typography.lineHeight;
  const textHeight = lines.length * lineHeight;
  const boxWidth = textWidth;
  const boxHeight = textHeight + ANNOTATION_PADDING * 2;

  const x = anno.position.x;
  const y = anno.position.y;

  // Anchor point for the connector
  const anchorPt: Point = 'point' in anno.anchor
    ? anno.anchor.point
    : { x: x + boxWidth / 2, y: y + boxHeight }; // fallback — element lookup happens at render

  // Connector: dashed line from annotation box edge to anchor
  const boxCenter: Point = { x: x + boxWidth / 2, y: y + boxHeight / 2 };
  const connectorStart = closestEdgePoint(
    { x, y, width: boxWidth, height: boxHeight },
    anchorPt,
  );

  const children: SceneElement[] = [];

  // Connector line (dashed)
  children.push({
    type: 'path',
    d: `M ${connectorStart.x} ${connectorStart.y} L ${anchorPt.x} ${anchorPt.y}`,
    stroke: palette.textMuted,
    strokeWidth: 1,
    strokeDasharray: '4 3',
  });

  // Box background with folded corner
  const foldPath = [
    `M ${x + ANNOTATION_FOLD_SIZE} ${y}`,
    `L ${x + boxWidth} ${y}`,
    `L ${x + boxWidth} ${y + boxHeight}`,
    `L ${x} ${y + boxHeight}`,
    `L ${x} ${y + ANNOTATION_FOLD_SIZE}`,
    `Z`,
  ].join(' ');
  children.push({
    type: 'path',
    d: foldPath,
    fill: palette.surface,
    stroke: palette.border,
    strokeWidth: 1,
  });

  // Fold triangle
  const foldTriangle = [
    `M ${x} ${y + ANNOTATION_FOLD_SIZE}`,
    `L ${x + ANNOTATION_FOLD_SIZE} ${y + ANNOTATION_FOLD_SIZE}`,
    `L ${x + ANNOTATION_FOLD_SIZE} ${y}`,
  ].join(' ');
  children.push({
    type: 'path',
    d: foldTriangle,
    fill: palette.border,
    stroke: palette.border,
    strokeWidth: 1,
  });

  // Text lines
  for (let i = 0; i < lines.length; i++) {
    children.push({
      type: 'text',
      content: lines[i],
      position: {
        x: x + ANNOTATION_PADDING,
        y: y + ANNOTATION_PADDING + (i + 1) * lineHeight - 3,
      },
      fontSize: typography.smallFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.textMuted,
      anchor: 'start',
    });
  }

  const bounds: Rect = { x, y, width: boxWidth, height: boxHeight };

  return {
    group: { type: 'group', id: `annotation-${anno.id}`, children },
    bounds,
  };
}

// ─── Legend Layout ─────────────────────────────────────────────────────────────

function layoutLegend(
  legend: Legend,
  viewBox: Rect,
  theme: ResolvedTheme,
): { group: SceneGroup; bounds: Rect } {
  const { palette, typography } = theme;

  const charWidth = typography.baseFontSize * 0.5;
  const rowCount = legend.entries.length + (legend.title ? 1 : 0);
  const titleHeight = legend.title ? LEGEND_ROW_HEIGHT + 4 : 0;
  const boxHeight = titleHeight + legend.entries.length * LEGEND_ROW_HEIGHT + LEGEND_PADDING * 2;

  // Compute width from longest entry
  const maxKeyLen = Math.max(...legend.entries.map(e => e.key.length), 0);
  const maxValLen = Math.max(...legend.entries.map(e => e.value.length), 0);
  const titleLen = legend.title ? legend.title.length : 0;
  const contentWidth = Math.max(
    (maxKeyLen + maxValLen + 3) * charWidth,   // key: value
    titleLen * charWidth * 1.1,                 // title
    LEGEND_MIN_WIDTH,
  );
  const boxWidth = legend.width || contentWidth + LEGEND_PADDING * 2;

  // Position in corner
  const pos = cornerPosition(legend.corner, viewBox, boxWidth, boxHeight);
  const x = pos.x;
  const y = pos.y;

  const children: SceneElement[] = [];

  // Background
  children.push({
    type: 'rect',
    bounds: { x, y, width: boxWidth, height: boxHeight },
    fill: palette.background,
    stroke: palette.border,
    strokeWidth: 1.5,
    rx: 2,
    ry: 2,
  });

  let yOffset = y + LEGEND_PADDING;

  // Title
  if (legend.title) {
    children.push({
      type: 'text',
      content: legend.title,
      position: { x: x + boxWidth / 2, y: yOffset + typography.baseFontSize },
      fontSize: typography.baseFontSize,
      fontFamily: typography.fontFamily,
      fontWeight: 'bold',
      fill: palette.text,
      anchor: 'middle',
    });
    yOffset += titleHeight;

    // Divider line under title
    children.push({
      type: 'path',
      d: `M ${x + 4} ${yOffset - 2} L ${x + boxWidth - 4} ${yOffset - 2}`,
      stroke: palette.border,
      strokeWidth: 1,
    });
  }

  // Entries
  const keyX = x + LEGEND_PADDING;
  const valX = x + LEGEND_PADDING + (maxKeyLen + 2) * charWidth;

  for (const entry of legend.entries) {
    yOffset += LEGEND_ROW_HEIGHT;
    children.push({
      type: 'text',
      content: entry.key,
      position: { x: keyX, y: yOffset - 4 },
      fontSize: typography.smallFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.textMuted,
      anchor: 'start',
    });
    children.push({
      type: 'text',
      content: entry.value,
      position: { x: valX, y: yOffset - 4 },
      fontSize: typography.smallFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.text,
      anchor: 'start',
    });
  }

  const bounds: Rect = { x, y, width: boxWidth, height: boxHeight };

  return {
    group: { type: 'group', id: 'legend', children },
    bounds,
  };
}

// ─── Geometry Helpers ──────────────────────────────────────────────────────────

function cornerPosition(
  corner: LegendCorner,
  viewBox: Rect,
  width: number,
  height: number,
): Point {
  const m = LEGEND_MARGIN;
  switch (corner) {
    case 'top-left':
      return { x: viewBox.x + m, y: viewBox.y + m };
    case 'top-right':
      return { x: viewBox.x + viewBox.width - width - m, y: viewBox.y + m };
    case 'bottom-left':
      return { x: viewBox.x + m, y: viewBox.y + viewBox.height - height - m };
    case 'bottom-right':
    default:
      return { x: viewBox.x + viewBox.width - width - m, y: viewBox.y + viewBox.height - height - m };
  }
}

/** Find closest point on rect edge to target point */
function closestEdgePoint(rect: Rect, target: Point): Point {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: rect.y + rect.height };

  const hw = rect.width / 2;
  const hh = rect.height / 2;

  // Scale to find intersection with rect edge
  const scaleX = hw / Math.abs(dx || 1);
  const scaleY = hh / Math.abs(dy || 1);
  const scale = Math.min(scaleX, scaleY);

  return { x: cx + dx * scale, y: cy + dy * scale };
}

function wrapText(text: string, maxWidth: number, charWidth: number): string[] {
  const maxChars = Math.floor(maxWidth / charWidth);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function expandViewBox(vb: Rect, bounds: Rect): Rect {
  const left = Math.min(vb.x, bounds.x);
  const top = Math.min(vb.y, bounds.y);
  const right = Math.max(vb.x + vb.width, bounds.x + bounds.width);
  const bottom = Math.max(vb.y + vb.height, bounds.y + bounds.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
