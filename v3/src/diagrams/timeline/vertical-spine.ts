/**
 * @file diagrams/timeline/vertical-spine.ts — Vertical central-spine layout.
 *
 * Time axis runs TOP (earliest) → BOTTOM (latest). A central vertical spine
 * line sits at canvas mid-x. Entries (milestones + activities, keyed by their
 * start date) are sorted by (ordinal, id) and placed down the spine, alternating
 * RIGHT (even index) / LEFT (odd index). Each entry draws a node marker on the
 * spine, a horizontal connector, and a content card (date + title + description).
 *
 * Uses the GENERAL utilities: time/dates (ordinals, parsing, formatting) and
 * text/metrics + text/wrap (card sizing). Styling reads only the shared theme
 * tokens (palette/typography/spacing) — status maps to the semantic palette
 * (done→success, active→primary, blocked→error, default→secondary).
 *
 * Determinism: round-half-up coordinates, stable (ordinal, id) sort, no clock.
 */

import type { TimelineDocument, Activity, Milestone } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { compileOverlays } from '../../overlay/compiler.js';
import { layoutOverlays } from '../../overlay/layout.js';
import { measureText } from '../../text/metrics.js';
import { wrapText } from '../../text/wrap.js';
import {
  parseIRDate, coerceLeft, dateToOrdinal, formatMilestoneDate,
} from '../../time/dates.js';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rhuInt(v: number): number { return Math.floor(v + 0.5); }

interface SpineEntry {
  id: string;
  label: string;
  dateStr: string;
  ord: number;
  description?: string;
  type: 'milestone' | 'activity';
  statusHint?: string;
  dotColor: string;
}

/** Distinct hues for a narrative spine (each entry visually separable). */
const CATEGORICAL = [
  '#7C3AED', '#0EA5A8', '#D97706', '#5B4FCF',
  '#DB2777', '#2563EB', '#16A34A', '#CA8A04',
];

/** Day-ordinal of an IR date's period-start (for vertical ordering). */
function startOrd(date: string): number {
  try {
    const [y, m, d] = coerceLeft(parseIRDate(date));
    return dateToOrdinal(y, m, d);
  } catch {
    return 0;
  }
}

/** Human date string, precision-aware. */
function formatEntryDate(date: string): string {
  try {
    const p = parseIRDate(date);
    switch (p.precision) {
      case 'day':     return formatMilestoneDate(p.year, p.month ?? 1, p.day ?? 1);
      case 'month':   return `${MONTH_ABBR[(p.month ?? 1) - 1] ?? ''} ${p.year}`;
      case 'quarter': return `Q${p.quarter ?? ''} ${p.year}`;
      case 'half':    return `H${p.half ?? ''} ${p.year}`;
      case 'year':    return String(p.year);
    }
  } catch { /* fall through */ }
  return date;
}

export function layoutVerticalSpine(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const margin = spacing.diagramMargin;

  // ── Build unified entry list ──────────────────────────────────────────────
  const entries: SpineEntry[] = [];
  for (const m of ir.milestones as readonly Milestone[]) {
    entries.push({
      id: m.id, label: m.label, dateStr: formatEntryDate(m.date),
      ord: startOrd(m.date),
      ...(m.description ? { description: m.description } : {}),
      type: 'milestone', dotColor: palette.primary,
    });
  }
  for (const a of ir.activities as readonly Activity[]) {
    entries.push({
      id: a.id, label: a.label, dateStr: formatEntryDate(a.start),
      ord: startOrd(a.start),
      ...(a.description ? { description: a.description } : {}),
      ...(a.status ? { statusHint: a.status } : {}),
      type: 'activity', dotColor: palette.primary,
    });
  }
  entries.sort((p, q) => (p.ord - q.ord) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));

  // Assign colours after ordering: active/blocked keep semantic colour,
  // everything else cycles a categorical palette so each entry is distinct.
  entries.forEach((e, i) => {
    e.dotColor = e.statusHint === 'active'  ? palette.primary
               : e.statusHint === 'blocked' ? palette.error
               : CATEGORICAL[i % CATEGORICAL.length]!;
  });

  // ── Geometry constants ────────────────────────────────────────────────────
  const cardW       = 260;
  const cardPad     = 12;
  const spineGap    = 48;             // gap between spine and nearest card edge
  const rowGap      = 22;
  const dotR        = 7;
  const innerW      = cardW - 2 * cardPad;
  const titleSize   = typography.baseFontSize;
  const dateSize    = typography.smallFontSize;
  const descSize    = typography.smallFontSize;
  const titleLH     = rhuInt(titleSize * 1.3);
  const lineLH      = rhuInt(descSize * 1.35);

  const spineX      = rhuInt(margin + cardW + spineGap);
  const leftCardR   = spineX - spineGap;            // right edge of left-column cards
  const rightCardL  = spineX + spineGap;            // left edge of right-column cards
  const totalW      = rhuInt(rightCardL + cardW + margin);

  const subtitle    = typeof ir.metadata.subtitle === 'string' ? ir.metadata.subtitle : undefined;
  const headerH     = ir.metadata.title
    ? typography.titleFontSize + (subtitle ? typography.baseFontSize + 10 : 0) + 24
    : 0;
  let y             = margin + headerH + 8;
  const startY      = y;
  // Pre-compute each entry's wrapped text + card height
  interface Placed extends SpineEntry {
    titleLines: string[]; descLines: string[]; cardH: number;
  }
  const placed: Placed[] = entries.map(e => {
    const titleLines = wrapText(e.label, titleSize, innerW, 3).lines;
    const descLines  = e.description ? wrapText(e.description, descSize, innerW, 3).lines : [];
    const cardH = rhuInt(
      cardPad + (dateSize * 1.3) + 4
      + titleLines.length * titleLH
      + (descLines.length ? 4 + descLines.length * lineLH : 0)
      + cardPad,
    );
    return { ...e, titleLines, descLines, cardH };
  });

  const elements: SceneElement[] = [];

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push({
      type: 'text', content: ir.metadata.title,
      position: { x: rhuInt(totalW / 2), y: margin + typography.titleFontSize },
      fontSize: typography.titleFontSize, fontFamily: typography.fontFamily,
      fontWeight: 'bold', fill: palette.text, anchor: 'middle',
    });
    if (subtitle) {
      elements.push({
        type: 'text', content: subtitle,
        position: { x: rhuInt(totalW / 2), y: margin + typography.titleFontSize + typography.baseFontSize + 8 },
        fontSize: typography.baseFontSize, fontFamily: typography.fontFamily,
        fill: palette.textMuted, anchor: 'middle',
      });
    }
  }

  // ── Place entries down the spine ──────────────────────────────────────────
  let lastNodeY = startY;
  placed.forEach((e, i) => {
    const onRight = i % 2 === 0;
    const nodeY   = rhuInt(y + e.cardH / 2);
    const cardX   = onRight ? rightCardL : leftCardR - cardW;
    const cardY   = rhuInt(y);

    // Connector (spine → card)
    const connX2 = onRight ? rightCardL : leftCardR;
    elements.push({
      type: 'path', d: `M ${spineX} ${nodeY} L ${connX2} ${nodeY}`,
      stroke: palette.border, strokeWidth: 1.5,
    });

    // Card background
    elements.push({
      type: 'rect',
      bounds: { x: cardX, y: cardY, width: cardW, height: e.cardH },
      fill: palette.surface, stroke: palette.border, strokeWidth: 1, rx: 8,
    });
    // Status accent stripe on the spine-facing edge
    const stripeX = onRight ? cardX : cardX + cardW - 3;
    elements.push({
      type: 'rect',
      bounds: { x: stripeX, y: cardY, width: 3, height: e.cardH },
      fill: e.dotColor, stroke: e.dotColor, strokeWidth: 0,
    });

    // Card text
    const textX = cardX + cardPad;
    let ty = cardY + cardPad + dateSize;
    elements.push({
      type: 'text', content: e.dateStr, position: { x: textX, y: ty },
      fontSize: dateSize, fontFamily: typography.fontFamily,
      fontWeight: 'bold', fill: e.dotColor, anchor: 'start',
    });
    ty += 4 + titleLH - (titleLH - titleSize);
    for (const line of e.titleLines) {
      elements.push({
        type: 'text', content: line, position: { x: textX, y: ty },
        fontSize: titleSize, fontFamily: typography.fontFamily,
        fontWeight: 'bold', fill: palette.text, anchor: 'start',
      });
      ty += titleLH;
    }
    if (e.descLines.length) {
      ty += 2;
      for (const line of e.descLines) {
        elements.push({
          type: 'text', content: line, position: { x: textX, y: ty },
          fontSize: descSize, fontFamily: typography.fontFamily,
          fill: palette.textMuted, anchor: 'start',
        });
        ty += lineLH;
      }
    }

    // Node marker on spine (diamond for milestone, circle for activity)
    if (e.type === 'milestone') {
      const r = dotR + 1;
      elements.push({
        type: 'path',
        d: `M ${spineX} ${nodeY - r} L ${spineX + r} ${nodeY} L ${spineX} ${nodeY + r} L ${spineX - r} ${nodeY} Z`,
        fill: e.dotColor, stroke: palette.background, strokeWidth: 2,
      });
    } else {
      elements.push({
        type: 'circle', center: { x: spineX, y: nodeY }, radius: dotR,
        fill: e.dotColor, stroke: palette.background, strokeWidth: 2,
      });
    }

    lastNodeY = nodeY;
    y += e.cardH + rowGap;
  });

  // ── Spine line (drawn under everything via unshift) ───────────────────────
  elements.unshift({
    type: 'path', d: `M ${spineX} ${startY} L ${spineX} ${lastNodeY}`,
    stroke: palette.border, strokeWidth: 2.5,
  });

  const totalH = rhuInt(y - rowGap + margin);

  let scene: Scene = {
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  };

  // ── Overlays ──────────────────────────────────────────────────────────────
  if (ir.overlays && ir.overlays.length > 0) {
    const compiled = compileOverlays(ir.overlays);
    const { elements: overlayEls, viewBox } = layoutOverlays(compiled, scene, theme);
    scene = { ...scene, elements: [...scene.elements, ...overlayEls], viewBox };
  }

  return { scene, anchors: {} };
}
