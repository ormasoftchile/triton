/**
 * @file diagrams/journey/layout.ts — User-journey satisfaction map.
 *
 * Tasks are placed left→right; vertical position encodes the satisfaction
 * score (1 low … 5 high). A path connects consecutive task nodes; section
 * bands span their tasks. Node colour maps the score onto the semantic palette
 * (low → error, high → success).
 */

import type { JourneyDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { categoricalHue } from '../../palette/categorical.js';
import { rhu, rhuInt } from '../../util/round.js';

const SCORE_MIN = 1;
const SCORE_MAX = 5;

export function layoutJourney(ir: JourneyDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const scoreColor = (s: number): string => {
    if (s <= 1.5) return palette.error;
    if (s <= 2.5) return palette.warning;
    if (s <= 3.5) return palette.secondary;
    if (s <= 4.5) return palette.primary;
    return palette.success;
  };

  // Flatten tasks (keep section spans).
  interface Flat { label: string; score: number; actors: readonly string[]; section: number; }
  const flat: Flat[] = [];
  ir.sections.forEach((sec, si) => sec.tasks.forEach(t => flat.push({ label: t.label, score: t.score, actors: t.actors, section: si })));
  const n = Math.max(flat.length, 1);

  const title  = ir.metadata.title;
  const titleH = title ? typography.titleFontSize + 16 : 0;

  const sectionBandH = 30;
  const plotLeft   = margin + 30;
  const plotTop    = margin + titleH + sectionBandH + 16;
  const plotH      = 240;
  const plotBottom = plotTop + plotH;
  const step       = 150;
  const plotW      = step * n;
  const plotRight  = plotLeft + plotW;

  const taskX  = (i: number): number => plotLeft + (i + 0.5) * step;
  const scoreY = (s: number): number => rhu(plotBottom - ((Math.max(SCORE_MIN, Math.min(SCORE_MAX, s)) - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * plotH);

  const elements: SceneElement[] = [];

  if (title) {
    elements.push(p.text(title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));
  }

  // ── Satisfaction gridlines (1..5) ─────────────────────────────────────────
  for (let s = SCORE_MIN; s <= SCORE_MAX; s++) {
    const y = scoreY(s);
    elements.push(p.path(`M ${plotLeft} ${y} L ${plotRight} ${y}`, palette.border, 1, { opacity: 0.4 }));
    elements.push(p.text(String(s), plotLeft - 10, y + typography.smallFontSize * 0.35, typography.smallFontSize, palette.textMuted, { anchor: 'end' }));
  }

  // ── Section bands ─────────────────────────────────────────────────────────
  ir.sections.forEach((sec, si) => {
    const idxs = flat.map((f, i) => ({ f, i })).filter(({ f }) => f.section === si).map(({ i }) => i);
    if (idxs.length === 0) return;
    const x0 = taskX(idxs[0]!) - step / 2;
    const x1 = taskX(idxs[idxs.length - 1]!) + step / 2;
    const hue = categoricalHue(si);
    elements.push(p.rect({ x: rhu(x0), y: margin + titleH, width: rhu(x1 - x0 - 6), height: sectionBandH }, hue, hue, 0, { rx: 6 }));
    elements.push(p.text(sec.label, rhuInt((x0 + x1) / 2 - 3), margin + titleH + sectionBandH / 2 + typography.baseFontSize * 0.35, typography.baseFontSize, '#FFFFFF', { weight: 'bold', anchor: 'middle' }));
  });

  // ── Journey path ──────────────────────────────────────────────────────────
  const nodePts = flat.map((f, i) => ({ x: rhu(taskX(i)), y: scoreY(f.score) }));
  if (nodePts.length > 1) {
    elements.push(p.path(`M ${nodePts.map(pt => `${pt.x} ${pt.y}`).join(' L ')}`, palette.textMuted, 2, { opacity: 0.6 }));
  }

  // ── Task nodes + labels + actors ──────────────────────────────────────────
  flat.forEach((f, i) => {
    const x = rhu(taskX(i)), y = scoreY(f.score);
    const color = scoreColor(f.score);
    elements.push(p.circle({ x, y }, 16, color, palette.background, 2));
    elements.push(p.text(String(f.score), x, y + typography.baseFontSize * 0.35, typography.baseFontSize, '#FFFFFF', { weight: 'bold', anchor: 'middle' }));
    elements.push(p.text(f.label, x, plotBottom + typography.smallFontSize + 10, typography.smallFontSize, palette.text, { anchor: 'middle', weight: 'bold' }));
    f.actors.forEach((a, ai) => {
      elements.push(p.text(a, x, plotBottom + typography.smallFontSize + 10 + (ai + 1) * (typography.smallFontSize + 4), typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
    });
  });

  const maxActors = Math.max(1, ...flat.map(f => f.actors.length));
  const totalW = rhuInt(plotRight + margin);
  const totalH = rhuInt(plotBottom + typography.smallFontSize + 10 + (maxActors + 1) * (typography.smallFontSize + 4) + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
