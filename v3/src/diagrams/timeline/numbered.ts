/**
 * @file diagrams/timeline/numbered.ts — Horizontal numbered-circle infographic.
 *
 * The "our-timeline" T1 look: a straight horizontal axis through evenly spaced
 * large numbered circles (01, 02, 03…). Each node's date + title callout
 * alternates ABOVE / BELOW the axis, connected by a short vertical edging line.
 * Highlighted (active) nodes are filled; the rest are hollow rings.
 *
 * Built on the shared kernel (collectEntries, formatDate, pen, util/round).
 * Deterministic; no clock.
 */

import type { TimelineDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { wrapText } from '../../text/wrap.js';
import { formatDate } from '../../time/dates.js';
import { collectEntries } from './shared.js';
import { rhu, rhuInt } from '../../util/round.js';

export function layoutNumbered(ir: TimelineDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const entries = collectEntries(ir);
  const n = Math.max(entries.length, 1);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const circleR   = 34;
  const numFont   = rhuInt(typography.titleFontSize + 2);
  const dateFont  = typography.smallFontSize;
  const titleFont = typography.baseFontSize;
  const innerW    = 150;                        // max wrapped title width
  const titleLH   = rhuInt(titleFont * 1.3);
  const connLen   = 16;                         // edging-line length from circle to callout
  const dateGap   = 6;

  // Pre-wrap titles to size the callout stacks.
  const placed = entries.map(e => ({
    ...e,
    dateStr: formatDate(e.date, 'full'),
    titleLines: wrapText(e.label, titleFont, innerW, 2).lines,
  }));
  const maxTitleLines = Math.max(1, ...placed.map(e => e.titleLines.length));
  const calloutH = connLen + dateFont + dateGap + maxTitleLines * titleLH + 8;

  const subtitle = typeof ir.metadata.subtitle === 'string' ? ir.metadata.subtitle : undefined;
  const headerH  = ir.metadata.title
    ? typography.titleFontSize + (subtitle ? typography.baseFontSize + 10 : 0) + 22
    : 0;

  const axisY    = margin + headerH + calloutH + circleR;
  const pitch    = Math.max(innerW + 30, circleR * 2 + 60);
  const leftX    = margin + 24;
  const nodeX    = (i: number): number => leftX + i * pitch + circleR;
  const totalW   = rhuInt(nodeX(n - 1) + circleR + 24 + margin);
  const totalH   = rhuInt(axisY + circleR + calloutH + margin);

  const elements: SceneElement[] = [];

  // ── Document title (centered) ──────────────────────────────────────────────
  if (ir.metadata.title) {
    elements.push(p.text(ir.metadata.title, rhuInt(totalW / 2), margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold', anchor: 'middle' }));
    if (subtitle) {
      elements.push(p.text(subtitle, rhuInt(totalW / 2), margin + typography.titleFontSize + typography.baseFontSize + 8, typography.baseFontSize, palette.textMuted, { anchor: 'middle' }));
    }
  }

  // ── Axis line ──────────────────────────────────────────────────────────────
  elements.push(p.path(`M ${rhu(margin)} ${rhu(axisY)} L ${rhu(totalW - margin)} ${rhu(axisY)}`, palette.border, 2));

  // ── Nodes + alternating callouts ───────────────────────────────────────────
  placed.forEach((e, i) => {
    const x = nodeX(i);
    const above = i % 2 === 1;                  // node 2 (index 1) goes up, like the reference
    const filled = e.status === 'active';
    const ringColor = palette.primary;
    const numColor  = filled ? '#FFFFFF' : palette.primary;

    // Edging line (alternating side) — drawn under the circle.
    const connFrom = above ? axisY - circleR : axisY + circleR;
    const connTo   = above ? connFrom - connLen : connFrom + connLen;
    elements.push(p.path(`M ${rhu(x)} ${rhu(connFrom)} L ${rhu(x)} ${rhu(connTo)}`, palette.primary, 1.5));

    // Circle node.
    elements.push(p.circle({ x: rhu(x), y: rhu(axisY) }, circleR, filled ? palette.primary : palette.background, ringColor, 3));
    elements.push(p.text(String(i + 1).padStart(2, '0'), rhu(x), rhu(axisY + numFont * 0.35), numFont, numColor, { weight: 'bold', anchor: 'middle' }));

    // Callout: date (near) + title (far), stacked away from the axis.
    if (above) {
      const dateY = connTo - dateGap;
      elements.push(p.text(e.dateStr, rhu(x), rhu(dateY), dateFont, palette.textMuted, { anchor: 'middle' }));
      let ty = dateY - dateFont - 2;
      for (let li = e.titleLines.length - 1; li >= 0; li--) {
        elements.push(p.text(e.titleLines[li]!, rhu(x), rhu(ty), titleFont, palette.primary, { weight: 'bold', anchor: 'middle' }));
        ty -= titleLH;
      }
    } else {
      const dateY = connTo + dateFont + 2;
      elements.push(p.text(e.dateStr, rhu(x), rhu(dateY), dateFont, palette.textMuted, { anchor: 'middle' }));
      let ty = dateY + titleLH;
      for (const ln of e.titleLines) {
        elements.push(p.text(ln, rhu(x), rhu(ty), titleFont, palette.primary, { weight: 'bold', anchor: 'middle' }));
        ty += titleLH;
      }
    }
  });

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
