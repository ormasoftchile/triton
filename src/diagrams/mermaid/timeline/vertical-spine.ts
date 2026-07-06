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

import type { TimelineDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import { applyOverlays } from '../../../overlay/apply.js';
import { rhuInt } from '../../../util/round.js';
import { pen } from '../../../scene/build.js';
import { measureText } from '../../../text/metrics.js';
import { wrapText } from '../../../text/wrap.js';
import { formatDate } from '../../../time/dates.js';
import { categoricalHue } from '../../../palette/categorical.js';
import { collectEntries } from './shared.js';

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

/** Human date string, precision-aware (milestone style: full day dates). */
const formatEntryDate = (date: string): string => formatDate(date, 'full');

export function layoutVerticalSpine(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const margin = spacing.diagramMargin;

  // ── Build unified entry list (sorted by ordinal, id) ──────────────────────
  const entries: SpineEntry[] = collectEntries(ir).map(e => ({
    id: e.id, label: e.label, dateStr: formatEntryDate(e.date), ord: e.ord,
    ...(e.description ? { description: e.description } : {}),
    type: e.kind,
    ...(e.status ? { statusHint: e.status } : {}),
    dotColor: palette.primary,
  }));

  // Assign colours after ordering: active/blocked keep semantic colour,
  // everything else cycles a categorical palette so each entry is distinct.
  entries.forEach((e, i) => {
    e.dotColor = e.statusHint === 'active'  ? palette.primary
               : e.statusHint === 'blocked' ? palette.error
               : categoricalHue(i);
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
  const p = pen(theme);

  // ── Title ─────────────────────────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push(p.text(ir.metadata.title, rhuInt(totalW / 2), margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold', anchor: 'middle' }));
    if (subtitle) {
      elements.push(p.text(subtitle, rhuInt(totalW / 2), margin + typography.titleFontSize + typography.baseFontSize + 8, typography.baseFontSize, palette.textMuted, { anchor: 'middle' }));
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
    elements.push(p.path(`M ${spineX} ${nodeY} L ${connX2} ${nodeY}`, palette.border, 1.5));

    // Card background
    elements.push(p.rect({ x: cardX, y: cardY, width: cardW, height: e.cardH }, palette.surface, palette.border, 1, { rx: 8 }));
    // Status accent stripe on the spine-facing edge
    const stripeX = onRight ? cardX : cardX + cardW - 3;
    elements.push(p.rect({ x: stripeX, y: cardY, width: 3, height: e.cardH }, e.dotColor, e.dotColor, 0));

    // Card text
    const textX = cardX + cardPad;
    let ty = cardY + cardPad + dateSize;
    elements.push(p.text(e.dateStr, textX, ty, dateSize, e.dotColor, { weight: 'bold', anchor: 'start' }));
    ty += 4 + titleLH - (titleLH - titleSize);
    for (const line of e.titleLines) {
      elements.push(p.text(line, textX, ty, titleSize, palette.text, { weight: 'bold', anchor: 'start' }));
      ty += titleLH;
    }
    if (e.descLines.length) {
      ty += 2;
      for (const line of e.descLines) {
        elements.push(p.text(line, textX, ty, descSize, palette.textMuted, { anchor: 'start' }));
        ty += lineLH;
      }
    }

    // Node marker on spine (diamond for milestone, circle for activity)
    if (e.type === 'milestone') {
      const r = dotR + 1;
      elements.push(p.path(`M ${spineX} ${nodeY - r} L ${spineX + r} ${nodeY} L ${spineX} ${nodeY + r} L ${spineX - r} ${nodeY} Z`, palette.background, 2, { fill: e.dotColor }));
    } else {
      elements.push(p.circle({ x: spineX, y: nodeY }, dotR, e.dotColor, palette.background, 2));
    }

    lastNodeY = nodeY;
    y += e.cardH + rowGap;
  });

  // ── Spine line (drawn under everything via unshift) ───────────────────────
  elements.unshift(p.path(`M ${spineX} ${startY} L ${spineX} ${lastNodeY}`, palette.border, 2.5));

  const totalH = rhuInt(y - rowGap + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
