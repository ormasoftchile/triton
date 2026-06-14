/**
 * @file layout/timeline-columns.ts — Mermaid-faithful section-column layout.
 *
 * Implements the Mermaid `timeline` visual: colored section header bands across
 * the top, evenly-spaced period columns tinted to the section color, event boxes
 * stacked vertically below a horizontal axis line.
 *
 * OPT-IN: gated behind `layout: 'timeline-columns'`.  ALL existing layout
 * families (horizontal, vertical-spine, serpentine, roadmap, gantt) are
 * completely untouched — this is a brand-new code path.
 *
 * FIDELITY TARGET (Mermaid `timeline`)
 *   1. Colored SECTION header bands across the top — each section a distinct color.
 *   2. Under each section, PERIOD columns (box per period) tinted to section color.
 *   3. Under each period, EVENT boxes stacked vertically in the section color palette.
 *   4. Horizontal TIME AXIS line (with arrowhead) separating period headers from events.
 *   5. EVEN column spacing — periods are uniformly-wide columns, NOT time-proportional.
 *
 * OUT-POLISH vs Mermaid
 *   • Clean rounded period / event boxes with subtle stroke.
 *   • Two-line word-wrapped event labels (no truncation until strictly necessary).
 *   • Section column dividers for visual separation.
 *   • Light + dark background compatibility (derives from theme.canvas.backgroundColor).
 *
 * DATA RECONSTRUCTION
 *   The IRDocument from the Mermaid timeline parser stores:
 *     • sections → tracks (one track per section, sectionId = track.id)
 *     • periods  → milestones (milestone.track = sectionId, milestone.date = periodDate)
 *     • events   → activities (activity.track = sectionId, activity.span/start = periodDate)
 *   This layout reconstructs the section/period/event tree from those fields.
 *   No changes to the parser are required.
 *
 * DETERMINISM: all coordinates via rhuInt() (round-half-up).
 * No Date.now(), Math.random(), or locale queries.
 */

import type { IRDocument } from '../types.js';
import type {
  Scene,
  ScenePrimitive,
  TextPrimitive,
  RectPrimitive,
  LinePrimitive,
  PathPrimitive,
} from '../scene.js';
import type { ResolvedTheme } from '../themes/types.js';
import { ptToPx } from '../fonts/metrics.js';
import { wrapText } from '../text-wrap.js';

// ---------------------------------------------------------------------------
// Rounding helper (§5.1 determinism contract)
// ---------------------------------------------------------------------------

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

// ---------------------------------------------------------------------------
// Section color palette (8 distinct hues, Mermaid-inspired)
// ---------------------------------------------------------------------------

interface SectionColors {
  /** Solid fill for the section header band. */
  header: string;
  /** Slightly darker fill for the period column header boxes. */
  period: string;
  /** Light pastel fill for event boxes. */
  event: string;
  /** Text color on header / period boxes (always light for contrast). */
  headerText: string;
  /** Text color inside event boxes (dark for legibility on light background). */
  eventText: string;
  /** Subtle border around event boxes. */
  eventBorder: string;
}

const SECTION_PALETTE: SectionColors[] = [
  // Indigo
  {
    header:      '#5368D4',
    period:      '#3F52B5',
    event:       '#EEF0FC',
    headerText:  '#FFFFFF',
    eventText:   '#1E2D8A',
    eventBorder: '#BBBFEA',
  },
  // Orange
  {
    header:      '#E07825',
    period:      '#C46010',
    event:       '#FEF1E4',
    headerText:  '#FFFFFF',
    eventText:   '#7A3A00',
    eventBorder: '#E8C09A',
  },
  // Emerald
  {
    header:      '#27A565',
    period:      '#1A8A50',
    event:       '#E4F7EF',
    headerText:  '#FFFFFF',
    eventText:   '#0B4D2C',
    eventBorder: '#A8DFC5',
  },
  // Purple
  {
    header:      '#9B3A9A',
    period:      '#7E2480',
    event:       '#F6E8F6',
    headerText:  '#FFFFFF',
    eventText:   '#520050',
    eventBorder: '#D8A8D8',
  },
  // Teal
  {
    header:      '#1FA8C0',
    period:      '#1288A0',
    event:       '#E0F4F8',
    headerText:  '#FFFFFF',
    eventText:   '#084E60',
    eventBorder: '#A0D8E4',
  },
  // Rose
  {
    header:      '#B03068',
    period:      '#901848',
    event:       '#F8E0EA',
    headerText:  '#FFFFFF',
    eventText:   '#580028',
    eventBorder: '#E0A8C0',
  },
  // Olive
  {
    header:      '#7A8000',
    period:      '#606400',
    event:       '#F0F0D0',
    headerText:  '#FFFFFF',
    eventText:   '#3A3C00',
    eventBorder: '#C8C880',
  },
  // Navy
  {
    header:      '#2E6098',
    period:      '#1E4878',
    event:       '#D8E8F5',
    headerText:  '#FFFFFF',
    eventText:   '#102840',
    eventBorder: '#90B8D8',
  },
];

// ---------------------------------------------------------------------------
// Geometric constants
// ---------------------------------------------------------------------------

const MARGIN_TOP     = 40;
const MARGIN_BOTTOM  = 52;
const MARGIN_LR      = 40;
const SECTION_HDR_H  = 40;   // section header band height (px)
const PERIOD_HDR_H   = 32;   // period column header box height (px)
const EVENT_BOX_H    = 38;   // single event box height (px)
const EVENT_BOX_GAP  = 4;    // vertical gap between stacked event boxes (px)
const EVENT_AREA_PAD = 8;    // top/bottom padding inside the events area (px)
const COL_PAD_H      = 4;    // horizontal padding inside each column for event boxes (px)
const MIN_COL_W      = 100;  // minimum column width (px) — wide enough for 2-line labels
const TITLE_FONT_PT  = 18;   // title font size (pt) — override theme for wider canvas
const EVENT_FONT_PX  = 11;   // fixed event label font size (px) — legible, compact

// ---------------------------------------------------------------------------
// Domain model (reconstructed from IRDocument)
// ---------------------------------------------------------------------------

interface ColumnEvent {
  label: string;
}

interface ColumnPeriod {
  label: string;
  events: ColumnEvent[];
}

interface ColumnSection {
  id: string;
  label: string;
  periods: ColumnPeriod[];
}

// ---------------------------------------------------------------------------
// IRDocument → section/period/event reconstruction
// ---------------------------------------------------------------------------

/**
 * Reconstruct the section → period → event tree from an IRDocument produced
 * by the Mermaid timeline parser.
 *
 * Mapping:
 *   sections → doc.sections  (or derived from doc.tracks if sections absent)
 *   periods  → milestones where milestone.track === sectionId
 *   events   → activities where activity.track === sectionId
 *              AND (activity.span || activity.start) === period.date
 *
 * Periods within a section are sorted by date string (lexicographic on IRDate
 * strings — works correctly for year-only "1954", "YYYY-MM", "YYYY-MM-DD").
 * Events within a period preserve parser order (activity insertion order).
 */
function buildSectionTree(ir: IRDocument): ColumnSection[] {
  // Determine section order from doc.sections or doc.tracks
  const sectionIds: string[] = (ir.sections && ir.sections.length > 0)
    ? ir.sections.map((s) => s.id)
    : ir.tracks.map((t) => t.id);

  const sectionLabelById = new Map<string, string>();
  if (ir.sections && ir.sections.length > 0) {
    for (const s of ir.sections) sectionLabelById.set(s.id, s.label);
  }
  for (const t of ir.tracks) {
    if (!sectionLabelById.has(t.id)) sectionLabelById.set(t.id, t.label);
  }

  // Collect milestones per section (→ periods)
  const milestonesPerSection = new Map<string, Array<{ date: string; label: string }>>();
  for (const ms of ir.milestones ?? []) {
    if (!ms.track) continue;
    let arr = milestonesPerSection.get(ms.track);
    if (!arr) { arr = []; milestonesPerSection.set(ms.track, arr); }
    arr.push({ date: ms.date, label: ms.label });
  }

  // Collect activities per (sectionId, periodDate)
  type PeriodKey = string; // `${sectionId}::${periodDate}`
  const eventsPerPeriod = new Map<PeriodKey, ColumnEvent[]>();
  for (const act of ir.activities) {
    const periodDate = act.span ?? act.start;
    if (!periodDate) continue;
    const key: PeriodKey = `${act.track}::${periodDate}`;
    let arr = eventsPerPeriod.get(key);
    if (!arr) { arr = []; eventsPerPeriod.set(key, arr); }
    arr.push({ label: act.label });
  }

  const result: ColumnSection[] = [];

  for (const sectionId of sectionIds) {
    const label     = sectionLabelById.get(sectionId) ?? sectionId;
    const rawPeriods = milestonesPerSection.get(sectionId) ?? [];

    // De-duplicate periods by date (keep first occurrence)
    const seenDates = new Set<string>();
    const uniquePeriods = rawPeriods.filter((p) => {
      if (seenDates.has(p.date)) return false;
      seenDates.add(p.date);
      return true;
    });

    // Sort by date string (lexicographic — correct for year / YYYY-MM / ISO dates)
    uniquePeriods.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

    const periods: ColumnPeriod[] = uniquePeriods.map((p) => ({
      label:  p.label,
      events: eventsPerPeriod.get(`${sectionId}::${p.date}`) ?? [],
    }));

    if (periods.length > 0) {
      result.push({ id: sectionId, label, periods });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

/**
 * Produce a Scene for the Mermaid-faithful section-column timeline layout.
 *
 * Called exclusively via `layout()` when family === 'timeline-columns'.
 * The `theme` parameter is consumed for typography and canvas defaults only;
 * section colors are provided by the internal SECTION_PALETTE.
 */
export function layoutTimelineColumns(
  ir:       IRDocument,
  theme:    ResolvedTheme,
  _baseDir?: string,
): Scene {
  const sections = buildSectionTree(ir);

  const fontFamily = `${theme.typography.fontFamily}, ${theme.typography.fontFamilyFallback}`;

  // ── Column geometry ───────────────────────────────────────────────────────

  const totalPeriods = sections.reduce((s, sec) => s + sec.periods.length, 0);
  if (totalPeriods === 0) {
    // Empty document fallback: return a minimal scene
    return {
      width:      theme.canvas.width,
      height:     120,
      background: theme.canvas.backgroundColor,
      primitives: [],
    };
  }

  const maxEventsPerPeriod = sections.reduce(
    (s, sec) => Math.max(s, sec.periods.reduce((ps, per) => Math.max(ps, per.events.length), 0)),
    0,
  );

  // Canvas width: at least theme default, at least totalPeriods * MIN_COL_W + margins
  const minCanvasW  = rhuInt(totalPeriods * MIN_COL_W + MARGIN_LR * 2);
  const baseCanvasW = Math.max(theme.canvas.width, minCanvasW);
  const colW        = rhuInt((baseCanvasW - MARGIN_LR * 2) / totalPeriods);
  const canvasW     = rhuInt(colW * totalPeriods + MARGIN_LR * 2);

  // Title area
  const titleFontPx   = ptToPx(TITLE_FONT_PT);
  const hasTitle      = !!ir.metadata.title;
  const titleAreaH    = hasTitle ? rhuInt(titleFontPx + 20) : 8;

  // Event area height
  const eventAreaH    = rhuInt(
    EVENT_AREA_PAD
    + maxEventsPerPeriod * EVENT_BOX_H
    + Math.max(0, maxEventsPerPeriod - 1) * EVENT_BOX_GAP
    + EVENT_AREA_PAD,
  );

  // Y coordinates for each horizontal band
  const sectionBandTopY  = MARGIN_TOP + titleAreaH;
  const periodHdrTopY    = sectionBandTopY + SECTION_HDR_H;
  const axisLineY        = periodHdrTopY + PERIOD_HDR_H;
  const eventsTopY       = axisLineY + EVENT_AREA_PAD;
  const canvasH          = rhuInt(axisLineY + eventAreaH + MARGIN_BOTTOM);

  const primitives: ScenePrimitive[] = [];

  // ── Background ────────────────────────────────────────────────────────────

  primitives.push({
    kind:   'rect',
    x:      0,
    y:      0,
    width:  canvasW,
    height: canvasH,
    fill:   theme.canvas.backgroundColor,
    stroke: 'none',
  } as RectPrimitive);

  // ── Title ─────────────────────────────────────────────────────────────────

  if (hasTitle) {
    primitives.push({
      kind:             'text',
      x:                rhuInt(canvasW / 2),
      y:                rhuInt(MARGIN_TOP + titleFontPx),
      text:             ir.metadata.title,
      fontFamily,
      fontSize:         titleFontPx,
      fontWeight:       700,
      fill:             theme.typography.titleColor,
      textAnchor:       'middle',
      dominantBaseline: 'alphabetic',
    } as TextPrimitive);
  }

  // ── Section bands + period columns + event boxes ─────────────────────────

  let cursorX = MARGIN_LR;

  for (let si = 0; si < sections.length; si++) {
    const section   = sections[si]!;
    const colors    = SECTION_PALETTE[si % SECTION_PALETTE.length]!;
    const sectionW  = rhuInt(colW * section.periods.length);

    // ── Section header band ───────────────────────────────────────────────
    primitives.push({
      kind:   'rect',
      x:      rhuInt(cursorX),
      y:      sectionBandTopY,
      width:  sectionW,
      height: SECTION_HDR_H,
      fill:   colors.header,
      stroke: 'none',
      rx:     0,
    } as RectPrimitive);

    // Section label — centered in the band
    const sectionLabelFontPx = ptToPx(theme.typography.fontSizeTrack);
    primitives.push({
      kind:             'text',
      x:                rhuInt(cursorX + sectionW / 2),
      y:                rhuInt(sectionBandTopY + (SECTION_HDR_H + sectionLabelFontPx) / 2),
      text:             section.label,
      fontFamily,
      fontSize:         sectionLabelFontPx,
      fontWeight:       700,
      fill:             colors.headerText,
      textAnchor:       'middle',
      dominantBaseline: 'alphabetic',
    } as TextPrimitive);

    // ── Thin divider between section bands ────────────────────────────────
    if (si > 0) {
      primitives.push({
        kind:        'line',
        x1:          rhuInt(cursorX),
        y1:          sectionBandTopY,
        x2:          rhuInt(cursorX),
        y2:          axisLineY,
        stroke:      'rgba(0,0,0,0.15)',
        strokeWidth: 1,
      } as LinePrimitive);
    }

    // ── Per-period columns ────────────────────────────────────────────────

    for (let pi = 0; pi < section.periods.length; pi++) {
      const period   = section.periods[pi]!;
      const periodX  = rhuInt(cursorX + pi * colW);
      const periodW  = colW;

      // Period header box (slightly darker than section band)
      primitives.push({
        kind:        'rect',
        x:           periodX,
        y:           periodHdrTopY,
        width:       periodW - 1,   // 1 px gap on right edge → column divider effect
        height:      PERIOD_HDR_H,
        fill:        colors.period,
        stroke:      'none',
      } as RectPrimitive);

      // Period label — centered in box
      const periodLabelFontPx = ptToPx(theme.typography.fontSizeAxis + 1);
      primitives.push({
        kind:             'text',
        x:                rhuInt(periodX + (periodW - 1) / 2),
        y:                rhuInt(periodHdrTopY + (PERIOD_HDR_H + periodLabelFontPx) / 2),
        text:             period.label,
        fontFamily,
        fontSize:         periodLabelFontPx,
        fontWeight:       600,
        fill:             colors.headerText,
        textAnchor:       'middle',
        dominantBaseline: 'alphabetic',
      } as TextPrimitive);

      // ── Event boxes ────────────────────────────────────────────────────

      for (let ei = 0; ei < period.events.length; ei++) {
        const event  = period.events[ei]!;
        const boxTop = rhuInt(eventsTopY + ei * (EVENT_BOX_H + EVENT_BOX_GAP));
        const boxX   = rhuInt(periodX + COL_PAD_H);
        const boxW   = periodW - 1 - COL_PAD_H * 2;
        const boxH   = EVENT_BOX_H;

        // Event box background
        primitives.push({
          kind:        'rect',
          x:           boxX,
          y:           boxTop,
          width:       boxW,
          height:      boxH,
          fill:        colors.event,
          stroke:      colors.eventBorder,
          strokeWidth: 1,
          rx:          5,
        } as RectPrimitive);

        // Event label — word-wrapped to 2 lines, centered in box
        const availTextW = Math.max(1, boxW - 8);
        const wrapped    = wrapText(event.label, EVENT_FONT_PX, availTextW, 2);
        const lines      = wrapped.lines.length > 0 ? wrapped.lines : [event.label];
        const lineHeight = rhuInt(EVENT_FONT_PX + 2);
        const totalTextH = lines.length * lineHeight - 2;
        const textStartY = rhuInt(boxTop + (boxH - totalTextH) / 2 + EVENT_FONT_PX * 0.85);

        for (let li = 0; li < lines.length; li++) {
          primitives.push({
            kind:             'text',
            x:                rhuInt(boxX + boxW / 2),
            y:                rhuInt(textStartY + li * lineHeight),
            text:             lines[li]!,
            fontFamily,
            fontSize:         EVENT_FONT_PX,
            fontWeight:       400,
            fill:             colors.eventText,
            textAnchor:       'middle',
            dominantBaseline: 'alphabetic',
          } as TextPrimitive);
        }
      }
    }

    cursorX += sectionW;
  }

  // ── Horizontal axis line + arrowhead ─────────────────────────────────────

  const axisStartX  = MARGIN_LR;
  const axisEndX    = rhuInt(canvasW - MARGIN_LR);
  const arrowTipX   = axisEndX + 12;
  const axisColor   = '#444444';

  primitives.push({
    kind:        'line',
    x1:          axisStartX,
    y1:          axisLineY,
    x2:          arrowTipX,
    y2:          axisLineY,
    stroke:      axisColor,
    strokeWidth: 2,
  } as LinePrimitive);

  // Arrowhead (filled triangle, pointing right)
  primitives.push({
    kind:   'path',
    d:      `M ${arrowTipX} ${axisLineY} L ${arrowTipX - 10} ${axisLineY - 5} L ${arrowTipX - 10} ${axisLineY + 5} Z`,
    fill:   axisColor,
    stroke: 'none',
  } as PathPrimitive);

  return {
    width:      canvasW,
    height:     canvasH,
    background: theme.canvas.backgroundColor,
    primitives,
  };
}
