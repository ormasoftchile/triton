import type { CirclePrimitive, PathPrimitive, RectPrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';
import { wrapText } from '../../text-wrap.js';

import type { JourneyDocument, JourneyTask } from './types.js';
import type { JourneyTheme } from './theme.js';
import { resolveJourneyTheme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

interface DisplaySection {
  name: string;
  tasks: JourneyTask[];
}

interface SectionLayout {
  section: DisplaySection;
  x: number;
  width: number;
  slotWidth: number;
}

interface TaskLayout {
  task: JourneyTask;
  centerX: number;
  labelLines: string[];
  labelHeight: number;
}

function titleFontSize(tk: JourneyTheme): number {
  return tk.sectionLabelFontSize + 6;
}

function collectActors(doc: JourneyDocument): string[] {
  const seen = new Set<string>();
  const actors: string[] = [];
  const pushTaskActors = (task: JourneyTask): void => {
    for (const actor of task.actors) {
      if (seen.has(actor)) continue;
      seen.add(actor);
      actors.push(actor);
    }
  };
  for (const task of doc.preambleTasks) pushTaskActors(task);
  for (const section of doc.sections) {
    for (const task of section.tasks) pushTaskActors(task);
  }
  return actors;
}

function normalizeSections(doc: JourneyDocument): DisplaySection[] {
  const sections: DisplaySection[] = [];
  if (doc.preambleTasks.length > 0) {
    sections.push({ name: 'Preamble', tasks: doc.preambleTasks });
  }
  for (const section of doc.sections) {
    sections.push({ name: section.name, tasks: section.tasks });
  }
  return sections;
}

function scoreIndex(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score))) - 1;
}

/**
 * Catmull-Rom spline → cubic Bézier path through all points.
 * Produces a smooth curve that passes through every supplied point.
 */
function catmullRomPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1]! : points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = i + 2 < points.length ? points[i + 2]! : points[i + 1]!;
    const cp1x = rhuInt(p1.x + (p2.x - p0.x) / 6);
    const cp1y = rhuInt(p1.y + (p2.y - p0.y) / 6);
    const cp2x = rhuInt(p2.x - (p3.x - p1.x) / 6);
    const cp2y = rhuInt(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Emit SVG path data for a simple face expression inside a circle of radius r
 * centred at (cx, cy).  The expression encoding:
 *   score 4–5 → happy (upward-curving mouth)
 *   score 3   → neutral (horizontal line)
 *   score 1–2 → unhappy (downward-curving mouth)
 */
function facePath(cx: number, cy: number, r: number, score: number): string {
  const s = r / 16; // scale factor relative to design unit = 16
  const ex = rhuInt(s * 5);  // eye x offset
  const ey = rhuInt(s * 5);  // eye y offset (up)
  const mx = rhuInt(s * 6);  // mouth x half-width
  const clamped = Math.max(1, Math.min(5, Math.round(score)));

  // Eyes
  const eyePath = `M ${cx - ex} ${cy - ey} m 0 0 M ${cx + ex} ${cy - ey} m 0 0`;
  void eyePath; // we emit eyes as separate circle primitives

  if (clamped >= 4) {
    // Happy: mouth curves upward
    const my1 = rhuInt(cy + s * 3);
    const cy1 = rhuInt(cy + s * 8);
    return `M ${cx - mx} ${my1} Q ${cx} ${cy1} ${cx + mx} ${my1}`;
  } else if (clamped === 3) {
    // Neutral: straight line
    const my = rhuInt(cy + s * 5);
    return `M ${cx - mx} ${my} L ${cx + mx} ${my}`;
  } else {
    // Unhappy: mouth curves downward
    const my1 = rhuInt(cy + s * 7);
    const cy1 = rhuInt(cy + s * 2);
    return `M ${cx - mx} ${my1} Q ${cx} ${cy1} ${cx + mx} ${my1}`;
  }
}

export function layoutJourney(doc: JourneyDocument, themeOverride?: JourneyTheme): Scene {
  const tk = themeOverride ?? resolveJourneyTheme(doc.metadata.theme);
  const sections = normalizeSections(doc);
  const titleSize = titleFontSize(tk);
  const titleWidth = doc.metadata.title ? rhuInt(measureText(doc.metadata.title, titleSize).width) : 0;
  const labelLineHeight = rhuInt(tk.taskLabelFontSize * 1.35);
  const sectionLabelWidthPadding = 24;

  // ── Actor color map ────────────────────────────────────────────────────────
  const allActors = collectActors(doc);
  const actorColorMap = new Map<string, string>();
  allActors.forEach((actor, i) => {
    actorColorMap.set(actor, tk.actorPalette[i % tk.actorPalette.length] ?? '#94a3b8');
  });

  // ── Section width geometry ─────────────────────────────────────────────────
  const measuredSections = sections.map((section) => {
    const labelWidth = rhuInt(measureText(section.name, tk.sectionLabelFontSize).width);
    const slotWidth = section.tasks.length * tk.taskGapX;
    const width = section.tasks.length > 0
      ? Math.max(slotWidth + tk.sectionGapX, labelWidth + sectionLabelWidthPadding)
      : Math.max(tk.taskGapX, labelWidth + sectionLabelWidthPadding);
    return { section, labelWidth, slotWidth, width };
  });

  const sectionsTotalWidth = measuredSections.reduce((sum, s) => sum + s.width, 0);
  const contentWidthBase = Math.max(sectionsTotalWidth || tk.taskGapX, titleWidth);

  // ── Actor legend width ────────────────────────────────────────────────────
  const dotDiameter = tk.actorDotRadius * 2;
  const legendItemW = (actor: string) =>
    rhuInt(dotDiameter + 6 + measureText(actor, tk.actorFontSize).width + 16);
  const legendItemH = Math.max(dotDiameter, tk.actorFontSize + 2) + 6;
  const legendCols = Math.min(4, Math.max(1, allActors.length));
  const legendColW = allActors.length > 0
    ? Math.max(...allActors.map(legendItemW)) + 12
    : 0;
  const legendTotalW = legendCols * legendColW;

  const sceneContentWidth = Math.max(contentWidthBase, legendTotalW);
  const width = rhuInt(tk.marginLeft + sceneContentWidth + tk.marginRight);
  const sectionsStartX = rhuInt(tk.marginLeft + (sceneContentWidth - sectionsTotalWidth) / 2);

  // ── Vertical geometry ─────────────────────────────────────────────────────
  const titleBlockHeight = doc.metadata.title ? titleSize + 18 : 0;
  const contentTop = rhuInt(tk.marginTop + titleBlockHeight);

  // Task-box dimensions (constant height across all tasks for visual uniformity)
  const taskBoxW = tk.taskGapX - 12;
  const taskBoxPadTop = 8;
  const taskBoxPadBottom = 10;
  const dotRowH = allActors.length > 0 ? dotDiameter + 8 : 0; // actor dot area height

  // First pass: measure all task labels
  const sectionLayouts: SectionLayout[] = [];
  const taskLayouts: TaskLayout[] = [];
  let maxLabelLines = 1;

  let cursorX = sectionsStartX;
  for (const measured of measuredSections) {
    sectionLayouts.push({
      section: measured.section,
      x: cursorX,
      width: measured.width,
      slotWidth: measured.slotWidth,
    });
    if (measured.section.tasks.length > 0) {
      const slotLeft = cursorX + (measured.width - measured.slotWidth) / 2;
      for (let i = 0; i < measured.section.tasks.length; i++) {
        const task = measured.section.tasks[i]!;
        const centerX = rhuInt(slotLeft + tk.taskGapX * (i + 0.5));
        const labelLines = wrapText(task.name, tk.taskLabelFontSize, taskBoxW - 10, 3).lines;
        const resolvedLines = labelLines.length > 0 ? labelLines : [task.name];
        maxLabelLines = Math.max(maxLabelLines, resolvedLines.length);
        const labelHeight = tk.taskLabelFontSize + Math.max(0, resolvedLines.length - 1) * labelLineHeight;
        taskLayouts.push({ task, centerX, labelLines: resolvedLines, labelHeight });
      }
    }
    cursorX += measured.width;
  }

  const maxLabelH = tk.taskLabelFontSize + Math.max(0, maxLabelLines - 1) * labelLineHeight;
  const taskBoxH = taskBoxPadTop + maxLabelH + (dotRowH > 0 ? 6 + dotRowH : 0) + taskBoxPadBottom;

  // Upper band height: section label area + gap + task box + gap above spine
  const sectionLabelAreaH = tk.sectionLabelFontSize + 12;
  const computedUpperBandH = sectionLabelAreaH + 10 + taskBoxH + 8;
  const upperBandH = Math.max(tk.spineY, computedUpperBandH);

  const absoluteSpineY = rhuInt(contentTop + upperBandH);

  // Score → face Y:  faceY = absoluteSpineY + minDrop + (5 - score) * (maxDrop - minDrop) / 4
  const faceY = (score: number): number => {
    const clamped = Math.max(1, Math.min(5, Math.round(score)));
    return rhuInt(absoluteSpineY + tk.minDrop + (5 - clamped) * (tk.maxDrop - tk.minDrop) / 4);
  };

  const maxFaceY = faceY(1); // score 1 is the lowest point
  const curveAreaBottom = maxFaceY + tk.taskRadius + 10;

  // Legend
  const legendTitleH = allActors.length > 0 ? tk.sectionLabelFontSize + 10 : 0;
  const legendRows = allActors.length > 0 ? Math.ceil(allActors.length / legendCols) : 0;
  const legendH = allActors.length > 0 ? legendTitleH + legendRows * legendItemH : 0;
  const legendTop = allActors.length > 0 ? rhuInt(curveAreaBottom + 20) : curveAreaBottom;

  const height = rhuInt((allActors.length > 0 ? legendTop + legendH : curveAreaBottom) + tk.marginBottom);

  const primitives: ScenePrimitive[] = [];

  // ── 1. Title ────────────────────────────────────────────────────────────────
  if (doc.metadata.title) {
    primitives.push({
      kind: 'text',
      x: rhuInt(width / 2),
      y: rhuInt(tk.marginTop + titleSize),
      text: doc.metadata.title,
      fontFamily: tk.fontFamily,
      fontSize: titleSize,
      fontWeight: tk.sectionLabelFontWeight,
      fill: tk.sectionLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
  }

  // ── 2. Section bands (contentTop → absoluteSpineY) ──────────────────────────
  sectionLayouts.forEach((sl, index) => {
    primitives.push({
      kind: 'rect',
      x: rhuInt(sl.x),
      y: contentTop,
      width: rhuInt(sl.width),
      height: rhuInt(absoluteSpineY - contentTop),
      fill: index % 2 === 0 ? tk.sectionBandFill : tk.sectionBandFill2,
      stroke: 'none',
      rx: 12,
    } satisfies RectPrimitive);
    primitives.push({
      kind: 'text',
      x: rhuInt(sl.x + sl.width / 2),
      y: rhuInt(contentTop + tk.sectionLabelFontSize + 8),
      text: sl.section.name,
      fontFamily: tk.fontFamily,
      fontSize: tk.sectionLabelFontSize,
      fontWeight: tk.sectionLabelFontWeight,
      fill: tk.sectionLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
  });

  // ── 3. Spine line + arrowhead ───────────────────────────────────────────────
  if (sectionLayouts.length > 0 || taskLayouts.length > 0) {
    const spineStart = sectionLayouts.length > 0 ? sectionLayouts[0]!.x : tk.marginLeft;
    const lastSl = sectionLayouts[sectionLayouts.length - 1];
    const spineEnd = lastSl ? lastSl.x + lastSl.width + 14 : width - tk.marginRight;

    primitives.push({
      kind: 'line',
      x1: rhuInt(spineStart),
      y1: absoluteSpineY,
      x2: rhuInt(spineEnd),
      y2: absoluteSpineY,
      stroke: tk.spineStroke,
      strokeWidth: tk.spineStrokeWidth,
    });

    // Arrowhead (filled triangle pointing right)
    const ax = rhuInt(spineEnd);
    const ay = absoluteSpineY;
    primitives.push({
      kind: 'path',
      d: `M ${ax} ${ay} L ${ax - 10} ${ay - 5} L ${ax - 10} ${ay + 5} Z`,
      fill: tk.spineStroke,
      stroke: 'none',
    } satisfies PathPrimitive);
  }

  // ── 4. Emotion curve (Catmull-Rom through face points) ─────────────────────
  if (taskLayouts.length > 1) {
    const facePoints = taskLayouts.map(tl => ({ x: tl.centerX, y: faceY(tl.task.score) }));
    primitives.push({
      kind: 'path',
      d: catmullRomPath(facePoints),
      fill: 'none',
      stroke: tk.curveStroke,
      strokeWidth: tk.curveStrokeWidth,
    } satisfies PathPrimitive);
  }

  // ── 5. Per-task: droplines + face circles + face features ──────────────────
  for (const tl of taskLayouts) {
    const fy = faceY(tl.task.score);
    const idx = scoreIndex(tl.task.score);
    const faceColor = tk.scoreFills[idx] ?? tk.scoreFills[2]!;
    const faceStroke = tk.scoreStrokes[idx] ?? tk.scoreStrokes[2]!;

    // Dropline (dashed, from spine to top of face circle)
    primitives.push({
      kind: 'line',
      x1: tl.centerX,
      y1: absoluteSpineY,
      x2: tl.centerX,
      y2: fy - tk.taskRadius,
      stroke: tk.droplineStroke,
      strokeWidth: 1,
      dashArray: tk.droplineDash,
    });

    // Face circle
    primitives.push({
      kind: 'circle',
      cx: tl.centerX,
      cy: fy,
      r: tk.taskRadius,
      fill: faceColor,
      stroke: faceStroke,
      strokeWidth: tk.taskStrokeWidth,
    } satisfies CirclePrimitive);

    // Face features: eyes + mouth
    const eyeR = Math.max(1, rhuInt(tk.taskRadius / 8));
    const eyeOff = rhuInt(tk.taskRadius * 0.28);
    const eyeRise = rhuInt(tk.taskRadius * 0.3);
    primitives.push({
      kind: 'circle',
      cx: tl.centerX - eyeOff,
      cy: fy - eyeRise,
      r: eyeR,
      fill: faceStroke,
      stroke: 'none',
    } satisfies CirclePrimitive);
    primitives.push({
      kind: 'circle',
      cx: tl.centerX + eyeOff,
      cy: fy - eyeRise,
      r: eyeR,
      fill: faceStroke,
      stroke: 'none',
    } satisfies CirclePrimitive);
    primitives.push({
      kind: 'path',
      d: facePath(tl.centerX, fy, tk.taskRadius, tl.task.score),
      fill: 'none',
      stroke: faceStroke,
      strokeWidth: Math.max(1, rhuInt(tk.taskRadius / 9)),
      strokeLinecap: 'round',
    } satisfies PathPrimitive);
  }

  // ── 6. Task boxes + labels + actor indicator dots ──────────────────────────
  for (const tl of taskLayouts) {
    const boxX = rhuInt(tl.centerX - taskBoxW / 2);
    const boxBottom = absoluteSpineY - 6;
    const boxTop = rhuInt(boxBottom - taskBoxH);

    // Box background
    primitives.push({
      kind: 'rect',
      x: boxX,
      y: boxTop,
      width: taskBoxW,
      height: taskBoxH,
      fill: tk.taskBoxFill,
      stroke: tk.taskBoxStroke,
      strokeWidth: tk.taskBoxStrokeWidth,
      rx: tk.taskBoxRadius,
    } satisfies RectPrimitive);

    // Task label
    const labelTopY = rhuInt(boxTop + taskBoxPadTop + tk.taskLabelFontSize);
    if (tl.labelLines.length > 1) {
      primitives.push({
        kind: 'multitext',
        x: tl.centerX,
        y: labelTopY,
        lines: tl.labelLines,
        lineHeight: labelLineHeight,
        fontFamily: tk.fontFamily,
        fontSize: tk.taskLabelFontSize,
        fontWeight: tk.taskLabelFontWeight,
        fill: tk.taskLabelColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      });
    } else {
      primitives.push({
        kind: 'text',
        x: tl.centerX,
        y: labelTopY,
        text: tl.labelLines[0] ?? tl.task.name,
        fontFamily: tk.fontFamily,
        fontSize: tk.taskLabelFontSize,
        fontWeight: tk.taskLabelFontWeight,
        fill: tk.taskLabelColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }

    // Actor indicator dots (small colored circles at bottom of task box)
    if (tl.task.actors.length > 0 && dotRowH > 0) {
      const dotCy = rhuInt(boxBottom - taskBoxPadBottom - tk.actorDotRadius);
      const totalDotW = tl.task.actors.length * dotDiameter + (tl.task.actors.length - 1) * 4;
      let dotCx = rhuInt(tl.centerX - totalDotW / 2 + tk.actorDotRadius);
      for (const actor of tl.task.actors) {
        primitives.push({
          kind: 'circle',
          cx: dotCx,
          cy: dotCy,
          r: tk.actorDotRadius,
          fill: actorColorMap.get(actor) ?? '#94a3b8',
          stroke: 'none',
        } satisfies CirclePrimitive);
        dotCx += dotDiameter + 4;
      }
    }
  }

  // ── 7. Actor legend ─────────────────────────────────────────────────────────
  if (allActors.length > 0) {
    const legendX = rhuInt(tk.marginLeft);

    primitives.push({
      kind: 'text',
      x: legendX,
      y: rhuInt(legendTop + tk.sectionLabelFontSize),
      text: 'Actors',
      fontFamily: tk.fontFamily,
      fontSize: tk.sectionLabelFontSize,
      fontWeight: tk.sectionLabelFontWeight,
      fill: tk.sectionLabelColor,
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);

    allActors.forEach((actor, i) => {
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);
      const itemX = rhuInt(legendX + col * legendColW);
      const itemY = rhuInt(legendTop + legendTitleH + row * legendItemH + legendItemH / 2);

      primitives.push({
        kind: 'circle',
        cx: rhuInt(itemX + tk.actorDotRadius),
        cy: itemY,
        r: tk.actorDotRadius,
        fill: actorColorMap.get(actor) ?? '#94a3b8',
        stroke: 'none',
      } satisfies CirclePrimitive);
      primitives.push({
        kind: 'text',
        x: rhuInt(itemX + dotDiameter + 6),
        y: rhuInt(itemY + 1),
        text: actor,
        fontFamily: tk.fontFamily,
        fontSize: tk.actorFontSize,
        fontWeight: 400,
        fill: tk.actorColor,
        textAnchor: 'start',
        dominantBaseline: 'middle',
      } satisfies TextPrimitive);
    });
  }

  return {
    width,
    height,
    background: tk.background,
    primitives,
  };
}
