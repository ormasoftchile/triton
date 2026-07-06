/**
 * @file diagrams/timeline/timeline-columns.ts — Mermaid-faithful section columns.
 *
 * Colored SECTION header bands across the top; under each, PERIOD columns (one
 * per distinct date) tinted to the section colour; under each period, EVENT
 * boxes stacked vertically. A horizontal axis line separates headers from events.
 *
 * v3 data model note: core links events→sections via track===sectionId, but v3
 * keeps sections separate (with date ranges). We reconstruct membership by
 * date-containment: each entry joins the latest section whose start ≤ entry date.
 *
 * Self-contained 8-hue palette (the Mermaid look) — a layout-local constant,
 * not a theme token. Built on GENERAL time/dates + text/wrap modules.
 */

import type { TimelineDocument, Activity, Milestone, Section } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { rhuInt } from '../../../util/round.js';
import { pen } from '../../../scene/build.js';
import { wrapText } from '../../../text/wrap.js';
import { startOrdinal, formatDate } from '../../../time/dates.js';

interface SectionColors {
  header: string; period: string; event: string;
  headerText: string; eventText: string; eventBorder: string;
}

const SECTION_PALETTE: SectionColors[] = [
  { header: '#5368D4', period: '#3F52B5', event: '#EEF0FC', headerText: '#FFFFFF', eventText: '#1E2D8A', eventBorder: '#BBBFEA' },
  { header: '#E07825', period: '#C46010', event: '#FEF1E4', headerText: '#FFFFFF', eventText: '#7A3A00', eventBorder: '#E8C09A' },
  { header: '#27A565', period: '#1A8A50', event: '#E4F7EF', headerText: '#FFFFFF', eventText: '#0B4D2C', eventBorder: '#A8DFC5' },
  { header: '#9B3A9A', period: '#7E2480', event: '#F6E8F6', headerText: '#FFFFFF', eventText: '#520050', eventBorder: '#D8A8D8' },
  { header: '#1FA8C0', period: '#1288A0', event: '#E0F4F8', headerText: '#FFFFFF', eventText: '#084E60', eventBorder: '#A0D8E4' },
  { header: '#B03068', period: '#901848', event: '#F8E0EA', headerText: '#FFFFFF', eventText: '#580028', eventBorder: '#E0A8C0' },
  { header: '#7A8000', period: '#606400', event: '#F0F0D0', headerText: '#FFFFFF', eventText: '#3A3C00', eventBorder: '#C8C880' },
  { header: '#2E6098', period: '#1E4878', event: '#D8E8F5', headerText: '#FFFFFF', eventText: '#102840', eventBorder: '#90B8D8' },
];

const SECTION_HDR_H = 38;
const PERIOD_HDR_H  = 30;
const EVENT_BOX_H   = 38;
const EVENT_BOX_GAP = 4;
const EVENT_AREA_PAD = 8;
const COL_PAD_H     = 5;
const MIN_COL_W     = 120;
const MARGIN        = 32;

const leftOrd = startOrdinal;
const fmtPeriod = (date: string): string => formatDate(date, 'axis');

interface Period { date: string; ord: number; events: string[]; }
interface Sec    { label: string; startOrd: number; periods: Period[]; }

export function layoutTimelineColumns(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography } = theme;

  // ── Reconstruct section → period → event tree ──────────────────────────────
  const irSections = (ir.sections ?? []) as readonly Section[];
  const baseSecs: Sec[] = (irSections.length
    ? irSections.map(s => ({ label: s.label, startOrd: leftOrd(s.start), periods: [] as Period[] }))
    : [{ label: ir.metadata.title ?? 'Timeline', startOrd: -Infinity, periods: [] as Period[] }]
  ).sort((a, b) => a.startOrd - b.startOrd);

  const assignSection = (ord: number): Sec => {
    let chosen = baseSecs[0]!;
    for (const s of baseSecs) if (s.startOrd <= ord) chosen = s;
    return chosen;
  };

  // entries (milestones + activities) keyed by their start date
  interface Entry { date: string; label: string; }
  const entries: Entry[] = [];
  for (const m of ir.milestones as readonly Milestone[]) entries.push({ date: m.date, label: m.label });
  for (const a of ir.activities as readonly Activity[]) entries.push({ date: a.start, label: a.label });

  for (const e of entries) {
    const ord = leftOrd(e.date);
    const sec = assignSection(ord);
    let period = sec.periods.find(p => p.date === e.date);
    if (!period) { period = { date: e.date, ord, events: [] }; sec.periods.push(period); }
    period.events.push(e.label);
  }
  // sort periods within each section by ordinal; drop empty sections
  const sections = baseSecs.filter(s => s.periods.length > 0);
  for (const s of sections) s.periods.sort((a, b) => a.ord - b.ord);

  const totalPeriods = sections.reduce((n, s) => n + s.periods.length, 0);
  const maxEvents = sections.reduce((m, s) => Math.max(m, s.periods.reduce((p, per) => Math.max(p, per.events.length), 0)), 0);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const colW    = MIN_COL_W;
  const canvasW = rhuInt(Math.max(totalPeriods, 1) * colW + MARGIN * 2);
  const titleH  = ir.metadata.title ? typography.titleFontSize + 18 : 8;
  const eventAreaH = rhuInt(EVENT_AREA_PAD + maxEvents * EVENT_BOX_H + Math.max(0, maxEvents - 1) * EVENT_BOX_GAP + EVENT_AREA_PAD);

  const sectionBandTopY = MARGIN + titleH;
  const periodHdrTopY   = sectionBandTopY + SECTION_HDR_H;
  const periodHdrBotY   = periodHdrTopY + PERIOD_HDR_H;
  const AXIS_GAP        = 16;                       // clear space between headers and axis line
  const axisLineY       = periodHdrBotY + AXIS_GAP;
  const eventsTopY      = axisLineY + EVENT_AREA_PAD;
  const canvasH         = rhuInt(axisLineY + eventAreaH + MARGIN);

  const elements: SceneElement[] = [];
  const p = pen(theme);

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push(p.text(ir.metadata.title, rhuInt(canvasW / 2), MARGIN + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold', anchor: 'middle' }));
  }

  // ── Section bands + period columns + events ─────────────────────────────────
  const eventFont = typography.smallFontSize;
  let cursorX = MARGIN;
  sections.forEach((section, si) => {
    const colors   = SECTION_PALETTE[si % SECTION_PALETTE.length]!;
    const sectionW = rhuInt(colW * section.periods.length);

    // Section header band
    elements.push(p.rect({ x: cursorX, y: sectionBandTopY, width: sectionW, height: SECTION_HDR_H }, colors.header, colors.header, 0));
    elements.push(p.text(section.label, cursorX + sectionW / 2, sectionBandTopY + SECTION_HDR_H / 2 + eventFont * 0.35, typography.baseFontSize, colors.headerText, { weight: 'bold', anchor: 'middle' }));

    // Period columns
    section.periods.forEach((period, pi) => {
      const px = cursorX + pi * colW;

      // Period header box (touches neighbours; thin divider drawn between columns)
      elements.push(p.rect({ x: px, y: periodHdrTopY, width: colW, height: PERIOD_HDR_H }, colors.period, colors.period, 0));
      if (pi > 0) {
        elements.push(p.path(`M ${px} ${periodHdrTopY} L ${px} ${periodHdrTopY + PERIOD_HDR_H}`, colors.header, 1));
      }
      elements.push(p.text(fmtPeriod(period.date), px + colW / 2, periodHdrTopY + PERIOD_HDR_H / 2 + eventFont * 0.35, eventFont, colors.headerText, { weight: 'bold', anchor: 'middle' }));

      // Event boxes
      period.events.forEach((label, ei) => {
        const ey = eventsTopY + ei * (EVENT_BOX_H + EVENT_BOX_GAP);
        elements.push(p.rect({ x: px + COL_PAD_H, y: ey, width: colW - 2 * COL_PAD_H, height: EVENT_BOX_H }, colors.event, colors.eventBorder, 1, { rx: 5 }));
        const lines = wrapText(label, eventFont, colW - 2 * COL_PAD_H - 8, 2).lines;
        const lineH = rhuInt(eventFont * 1.25);
        const startY = ey + EVENT_BOX_H / 2 - ((lines.length - 1) * lineH) / 2 + eventFont * 0.35;
        lines.forEach((ln, li) => {
          elements.push(p.text(ln, px + colW / 2, startY + li * lineH, eventFont, colors.eventText, { anchor: 'middle' }));
        });
      });
    });

    cursorX += sectionW;
  });

  // ── Axis line with arrowhead ────────────────────────────────────────────────
  const axisEndX = cursorX;
  elements.push(p.path(`M ${MARGIN} ${axisLineY} L ${axisEndX} ${axisLineY}`, palette.textMuted, 2));
  elements.push(p.path(`M ${axisEndX} ${axisLineY} L ${axisEndX - 8} ${axisLineY - 4} L ${axisEndX - 8} ${axisLineY + 4} Z`, palette.textMuted, 0, { fill: palette.textMuted }));

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: canvasW, height: canvasH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
