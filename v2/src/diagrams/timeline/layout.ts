/**
 * Timeline Layout — Positions timeline entities into a Scene.
 *
 * For now implements a simplified horizontal layout.
 * The architecture supports all 6 layout families via the same IR.
 */

import type { TimelineDocument } from './ir.js';
import type { Scene, SceneElement, Annotation, Legend } from '../../scene/types.js';
import type { ResolvedTheme } from '../../theme/types.js';
import { compileOverlays } from '../../scene/compile-overlays.js';

export function layoutTimeline(ir: TimelineDocument, theme: ResolvedTheme): Scene {
  // Dispatch by layout family
  switch (ir.layout) {
    case 'horizontal':
    default:
      return layoutHorizontal(ir, theme);
  }
}

function layoutHorizontal(ir: TimelineDocument, theme: ResolvedTheme): Scene {
  const { spacing, palette, typography } = theme;
  const elements: SceneElement[] = [];

  // Compile overlays from IR
  const { annotations, legend } = ir.overlays
    ? compileOverlays(ir.overlays)
    : { annotations: [] as Annotation[], legend: undefined as Legend | undefined };

  const trackHeight = 40;
  const timelineStartX = spacing.diagramMargin;
  const timelineStartY = spacing.diagramMargin + 30; // after title
  const itemWidth = 120;
  const itemGap = spacing.nodeGap;

  // Title
  if (ir.metadata.title) {
    elements.push({
      type: 'text',
      content: ir.metadata.title,
      position: { x: spacing.diagramMargin, y: 20 },
      fontSize: typography.titleFontSize,
      fontFamily: typography.fontFamily,
      fontWeight: 'bold',
      fill: palette.text,
    });
  }

  // Render milestones along a horizontal axis
  let x = timelineStartX;
  const y = timelineStartY;

  for (const milestone of ir.milestones) {
    // Diamond marker
    const cx = x + itemWidth / 2;
    const cy = y + trackHeight / 2;
    elements.push({
      type: 'path',
      d: `M ${cx} ${cy - 10} L ${cx + 10} ${cy} L ${cx} ${cy + 10} L ${cx - 10} ${cy} Z`,
      fill: palette.primary,
      stroke: palette.border,
      strokeWidth: theme.edges.strokeWidth,
    });

    // Label below
    elements.push({
      type: 'text',
      content: milestone.label,
      position: { x: cx, y: cy + 24 },
      fontSize: typography.baseFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.text,
      anchor: 'middle',
    });

    // Date above
    elements.push({
      type: 'text',
      content: milestone.date,
      position: { x: cx, y: cy - 18 },
      fontSize: typography.smallFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.textMuted,
      anchor: 'middle',
    });

    x += itemWidth + itemGap;
  }

  // Render activities as bars
  let actY = y + trackHeight + 30;
  for (const activity of ir.activities) {
    elements.push({
      type: 'rect',
      bounds: { x: timelineStartX, y: actY, width: itemWidth, height: 28 },
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
      rx: 4,
      ry: 4,
    });

    elements.push({
      type: 'text',
      content: activity.label,
      position: { x: timelineStartX + 8, y: actY + 18 },
      fontSize: typography.baseFontSize,
      fontFamily: typography.fontFamily,
      fill: palette.text,
    });

    actY += 36;
  }

  // Compute viewBox
  const totalWidth = Math.max(x, 200) + spacing.diagramMargin;
  const totalHeight = actY + spacing.diagramMargin;

  return {
    viewBox: { x: 0, y: 0, width: totalWidth, height: totalHeight },
    background: palette.background,
    elements,
    annotations: annotations.length > 0 ? annotations : undefined,
    legend,
  };
}
