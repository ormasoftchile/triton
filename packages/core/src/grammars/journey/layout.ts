import type { RectPrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
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

interface Chip {
  label: string;
  width: number;
}

interface ChipRow {
  chips: Chip[];
  width: number;
}

interface TaskLayout {
  task: JourneyTask;
  centerX: number;
  labelLines: string[];
  labelHeight: number;
  chipRows: ChipRow[];
  actorHeight: number;
}

function titleFontSize(tk: JourneyTheme): number {
  return tk.sectionLabelFontSize + 6;
}

function chipHeight(tk: JourneyTheme): number {
  return rhuInt(tk.actorFontSize + 8);
}

function chipGap(): number {
  return 6;
}

function buildChipRows(labels: string[], maxWidth: number, tk: JourneyTheme): ChipRow[] {
  const rows: ChipRow[] = [];
  const gap = chipGap();
  for (const label of labels) {
    const width = rhuInt(measureText(label, tk.actorFontSize).width + 16);
    const chip: Chip = { label, width };
    const row = rows[rows.length - 1];
    if (!row) {
      rows.push({ chips: [chip], width });
      continue;
    }
    const nextWidth = row.width + gap + width;
    if (row.chips.length > 0 && nextWidth > maxWidth) {
      rows.push({ chips: [chip], width });
      continue;
    }
    row.chips.push(chip);
    row.width = nextWidth;
  }
  return rows;
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
  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  return rounded - 1;
}

export function layoutJourney(doc: JourneyDocument, themeOverride?: JourneyTheme): Scene {
  const tk = themeOverride ?? resolveJourneyTheme(doc.metadata.theme);
  const sections = normalizeSections(doc);
  const titleSize = titleFontSize(tk);
  const titleWidth = doc.metadata.title ? rhuInt(measureText(doc.metadata.title, titleSize).width) : 0;
  const labelLineHeight = rhuInt(tk.taskLabelFontSize * 1.35);
  const sectionLabelWidthPadding = 24;

  const measuredSections = sections.map((section) => {
    const labelWidth = rhuInt(measureText(section.name, tk.sectionLabelFontSize).width);
    const slotWidth = section.tasks.length * tk.taskGapX;
    const width = section.tasks.length > 0
      ? Math.max(slotWidth + tk.sectionGapX, labelWidth + sectionLabelWidthPadding)
      : Math.max(tk.taskGapX, labelWidth + sectionLabelWidthPadding);
    return { section, labelWidth, slotWidth, width };
  });

  const sectionsTotalWidth = measuredSections.reduce((sum, section) => sum + section.width, 0);
  const allActors = collectActors(doc);
  const contentWidthBase = Math.max(sectionsTotalWidth || tk.taskGapX, titleWidth);
  const actorLegendRows = buildChipRows(allActors, Math.max(180, Math.min(360, contentWidthBase)), tk);
  const actorLegendWidth = actorLegendRows.reduce((max, row) => Math.max(max, row.width), 0);
  const sceneContentWidth = Math.max(contentWidthBase, actorLegendWidth);
  const width = rhuInt(tk.marginLeft + sceneContentWidth + tk.marginRight);
  const sectionsStartX = rhuInt(tk.marginLeft + (sceneContentWidth - sectionsTotalWidth) / 2);

  const titleBlockHeight = doc.metadata.title ? titleSize + 18 : 0;
  const contentTop = rhuInt(tk.marginTop + titleBlockHeight);
  const spineY = rhuInt(contentTop + tk.spineY);
  const taskLabelBaseY = rhuInt(spineY + tk.taskLabelOffsetY);
  const chipH = chipHeight(tk);
  const taskLayouts: TaskLayout[] = [];
  const sectionLayouts: SectionLayout[] = [];

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
        const labelLines = wrapText(task.name, tk.taskLabelFontSize, tk.taskGapX - 12, 3).lines;
        const resolvedLines = labelLines.length > 0 ? labelLines : [task.name];
        const labelHeight = tk.taskLabelFontSize + Math.max(0, resolvedLines.length - 1) * labelLineHeight;
        const chipRows = buildChipRows(task.actors, tk.taskGapX - 12, tk);
        const actorHeight = chipRows.length > 0
          ? chipH + Math.max(0, chipRows.length - 1) * (chipH + chipGap())
          : 0;
        taskLayouts.push({
          task,
          centerX,
          labelLines: resolvedLines,
          labelHeight,
          chipRows,
          actorHeight,
        });
      }
    }

    cursorX += measured.width;
  }

  let contentBottom = rhuInt(taskLabelBaseY + tk.taskLabelFontSize + tk.scoreBarHeight + 8);
  for (const taskLayout of taskLayouts) {
    const actorStartY = rhuInt(taskLabelBaseY + taskLayout.labelHeight + tk.actorOffsetY);
    const bottom = taskLayout.chipRows.length > 0
      ? actorStartY + taskLayout.actorHeight
      : rhuInt(taskLabelBaseY + taskLayout.labelHeight + 14);
    contentBottom = Math.max(contentBottom, rhuInt(bottom));
  }

  const sectionBandBottom = rhuInt(contentBottom + 16);
  const legendTitleHeight = allActors.length > 0 ? tk.sectionLabelFontSize + 10 : 0;
  const legendHeight = allActors.length > 0
    ? legendTitleHeight + actorLegendRows.length * chipH + Math.max(0, actorLegendRows.length - 1) * chipGap()
    : 0;
  const legendTop = allActors.length > 0 ? rhuInt(sectionBandBottom + 20) : sectionBandBottom;
  const height = rhuInt((allActors.length > 0 ? legendTop + legendHeight : sectionBandBottom) + tk.marginBottom);

  const primitives: ScenePrimitive[] = [];

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

  sectionLayouts.forEach((sectionLayout, index) => {
    primitives.push({
      kind: 'rect',
      x: rhuInt(sectionLayout.x),
      y: contentTop,
      width: rhuInt(sectionLayout.width),
      height: rhuInt(sectionBandBottom - contentTop),
      fill: index % 2 === 0 ? tk.sectionBandFill : tk.sectionBandFill2,
      stroke: 'none',
      rx: 12,
    } satisfies RectPrimitive);
    primitives.push({
      kind: 'text',
      x: rhuInt(sectionLayout.x + sectionLayout.width / 2),
      y: rhuInt(contentTop + tk.sectionLabelFontSize + 4),
      text: sectionLayout.section.name,
      fontFamily: tk.fontFamily,
      fontSize: tk.sectionLabelFontSize,
      fontWeight: tk.sectionLabelFontWeight,
      fill: tk.sectionLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
  });

  if (sectionLayouts.length > 0 || taskLayouts.length > 0) {
    const spineStart = sectionLayouts.length > 0 ? sectionLayouts[0]!.x : tk.marginLeft;
    const spineEnd = sectionLayouts.length > 0
      ? sectionLayouts[sectionLayouts.length - 1]!.x + sectionLayouts[sectionLayouts.length - 1]!.width
      : width - tk.marginRight;
    primitives.push({
      kind: 'line',
      x1: rhuInt(spineStart),
      y1: spineY,
      x2: rhuInt(spineEnd),
      y2: spineY,
      stroke: tk.spineStroke,
      strokeWidth: tk.spineStrokeWidth,
    });
  }

  for (const taskLayout of taskLayouts) {
    const index = scoreIndex(taskLayout.task.score);
    const labelY = taskLabelBaseY;
    const actorStartY = rhuInt(taskLabelBaseY + taskLayout.labelHeight + tk.actorOffsetY);
    const scoreBarY = rhuInt(actorStartY - tk.scoreBarHeight - 8);
    const scoreBarMaxWidth = tk.taskGapX - 32;
    const scoreBarWidth = rhuInt((Math.max(1, Math.min(5, Math.round(taskLayout.task.score))) / 5) * scoreBarMaxWidth);

    primitives.push({
      kind: 'circle',
      cx: taskLayout.centerX,
      cy: spineY,
      r: tk.taskRadius,
      fill: tk.scoreFills[index] ?? tk.scoreFills[2] ?? '#eab308',
      stroke: tk.scoreStrokes[index] ?? tk.scoreStrokes[2] ?? '#a16207',
      strokeWidth: tk.taskStrokeWidth,
    });

    if (taskLayout.labelLines.length > 1) {
      primitives.push({
        kind: 'multitext',
        x: taskLayout.centerX,
        y: labelY,
        lines: taskLayout.labelLines,
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
        x: taskLayout.centerX,
        y: labelY,
        text: taskLayout.labelLines[0] ?? taskLayout.task.name,
        fontFamily: tk.fontFamily,
        fontSize: tk.taskLabelFontSize,
        fontWeight: tk.taskLabelFontWeight,
        fill: tk.taskLabelColor,
        textAnchor: 'middle',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }

    primitives.push({
      kind: 'rect',
      x: rhuInt(taskLayout.centerX - scoreBarMaxWidth / 2),
      y: scoreBarY,
      width: scoreBarMaxWidth,
      height: tk.scoreBarHeight,
      fill: tk.actorChipFill,
      stroke: 'none',
      rx: tk.scoreBarHeight / 2,
      opacity: 0.55,
    } satisfies RectPrimitive);
    primitives.push({
      kind: 'rect',
      x: rhuInt(taskLayout.centerX - scoreBarMaxWidth / 2),
      y: scoreBarY,
      width: scoreBarWidth,
      height: tk.scoreBarHeight,
      fill: tk.scoreFills[index] ?? tk.scoreFills[2] ?? '#eab308',
      stroke: 'none',
      rx: tk.scoreBarHeight / 2,
    } satisfies RectPrimitive);

    taskLayout.chipRows.forEach((row, rowIndex) => {
      let chipX = rhuInt(taskLayout.centerX - row.width / 2);
      const rowY = rhuInt(actorStartY + rowIndex * (chipH + chipGap()));
      row.chips.forEach((chip) => {
        primitives.push({
          kind: 'rect',
          x: chipX,
          y: rowY,
          width: chip.width,
          height: chipH,
          fill: tk.actorChipFill,
          stroke: 'none',
          rx: tk.actorChipRadius,
        } satisfies RectPrimitive);
        primitives.push({
          kind: 'text',
          x: rhuInt(chipX + chip.width / 2),
          y: rhuInt(rowY + chipH / 2 + 1),
          text: chip.label,
          fontFamily: tk.fontFamily,
          fontSize: tk.actorFontSize,
          fontWeight: 500,
          fill: tk.actorColor,
          textAnchor: 'middle',
          dominantBaseline: 'middle',
        } satisfies TextPrimitive);
        chipX += chip.width + chipGap();
      });
    });
  }

  if (allActors.length > 0) {
    const legendWidth = actorLegendRows.reduce((max, row) => Math.max(max, row.width), 0);
    const legendX = rhuInt(width - tk.marginRight - legendWidth);
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

    actorLegendRows.forEach((row, rowIndex) => {
      let chipX = legendX;
      const rowY = rhuInt(legendTop + legendTitleHeight + rowIndex * (chipH + chipGap()));
      row.chips.forEach((chip) => {
        primitives.push({
          kind: 'rect',
          x: chipX,
          y: rowY,
          width: chip.width,
          height: chipH,
          fill: tk.actorChipFill,
          stroke: 'none',
          rx: tk.actorChipRadius,
        } satisfies RectPrimitive);
        primitives.push({
          kind: 'text',
          x: rhuInt(chipX + chip.width / 2),
          y: rhuInt(rowY + chipH / 2 + 1),
          text: chip.label,
          fontFamily: tk.fontFamily,
          fontSize: tk.actorFontSize,
          fontWeight: 500,
          fill: tk.actorColor,
          textAnchor: 'middle',
          dominantBaseline: 'middle',
        } satisfies TextPrimitive);
        chipX += chip.width + chipGap();
      });
    });
  }

  return {
    width,
    height,
    background: tk.background,
    primitives,
  };
}
