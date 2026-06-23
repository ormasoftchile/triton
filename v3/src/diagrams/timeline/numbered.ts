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
  const dateGap   = 6;
  const calloutGap = circleR + 14;              // clearance from circle to first callout line

  // Pre-wrap titles to size the callout stacks.
  const placed = entries.map(e => ({
    ...e,
    dateStr: formatDate(e.date, 'full'),
    titleLines: wrapText(e.label, titleFont, innerW, 2).lines,
  }));
  const maxTitleLines = Math.max(1, ...placed.map(e => e.titleLines.length));
  const calloutH = calloutGap + dateFont + dateGap + maxTitleLines * titleLH + 10;

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

  // ── Weaving spine: a continuous horizontal line that arcs AROUND each node, ─
  //    alternating over/under (opposite the callout side) — the "edging line".
  const arcR = circleR + 5;
  let spine = `M ${rhu(margin)} ${rhu(axisY)}`;
  const apexes: Array<{ x: number; y: number }> = [];
  placed.forEach((_e, i) => {
    const x = nodeX(i);
    const lineAbove = i % 2 === 1;              // same side as the callout
    const sweep = lineAbove ? 0 : 1;            // 0 = arc up/over, 1 = arc down/under
    spine += ` L ${rhu(x - arcR)} ${rhu(axisY)} A ${arcR} ${arcR} 0 0 ${sweep} ${rhu(x + arcR)} ${rhu(axisY)}`;
    apexes.push({ x, y: lineAbove ? axisY - arcR : axisY + arcR });
  });
  spine += ` L ${rhu(totalW - margin)} ${rhu(axisY)}`;
  elements.push(p.path(spine, palette.border, 2));

  // Dot at each arc apex (the spine's min/max around each node).
  for (const a of apexes) elements.push(p.circle({ x: rhu(a.x), y: rhu(a.y) }, 4, palette.primary, palette.background, 1.5));

  // ── Nodes + alternating callouts ───────────────────────────────────────────
  placed.forEach((e, i) => {
    const x = nodeX(i);
    const above = i % 2 === 1;                  // node 2 (index 1) callout goes up, like the reference
    const filled = e.status === 'active';
    const numColor  = filled ? '#FFFFFF' : palette.primary;

    // Circle node (drawn over the spine).
    elements.push(p.circle({ x: rhu(x), y: rhu(axisY) }, circleR, filled ? palette.primary : palette.background, palette.primary, 3));
    elements.push(p.text(String(i + 1).padStart(2, '0'), rhu(x), rhu(axisY + numFont * 0.35), numFont, numColor, { weight: 'bold', anchor: 'middle' }));

    // Callout: date (near) + title (far), stacked away from the axis.
    if (above) {
      const dateY = axisY - calloutGap;
      elements.push(p.text(e.dateStr, rhu(x), rhu(dateY), dateFont, palette.textMuted, { anchor: 'middle' }));
      let ty = dateY - dateFont - dateGap;
      for (let li = e.titleLines.length - 1; li >= 0; li--) {
        elements.push(p.text(e.titleLines[li]!, rhu(x), rhu(ty), titleFont, palette.primary, { weight: 'bold', anchor: 'middle' }));
        ty -= titleLH;
      }
    } else {
      const dateY = axisY + calloutGap;
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
