/**
 * @file diagrams/gitgraph/layout.ts — Git commit graph.
 *
 * Branches occupy horizontal lanes; commits sit at sequential x positions.
 * Lane lines, branch-point curves and merge curves connect them; commit dots
 * carry ids and tags. Lane colours come from the categorical hue cycle.
 */

import type { GitgraphDocument } from './ir.js';
import type { Scene, SceneElement, LayoutResult } from '../../contracts/index.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { pen } from '../../scene/build.js';
import { applyOverlays } from '../../overlay/apply.js';
import { categoricalHue } from '../../palette/categorical.js';
import { measureText } from '../../text/metrics.js';
import { rhu, rhuInt } from '../../util/round.js';

export function layoutGitgraph(ir: GitgraphDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;

  const titleH = ir.metadata.title ? typography.titleFontSize + 14 : 0;
  const xGap    = 70;
  const laneGap = 60;
  const leftPad = margin + 70;            // room for lane labels
  const topPad  = margin + titleH + 24;
  const maxX = Math.max(0, ...ir.commits.map(c => c.x));

  const cx = (x: number): number => leftPad + x * xGap;
  const cy = (lane: number): number => topPad + lane * laneGap;
  const hue = (lane: number): string => categoricalHue(lane);

  const elements: SceneElement[] = [];
  if (ir.metadata.title) elements.push(p.text(ir.metadata.title, margin, margin + typography.titleFontSize, typography.titleFontSize, palette.text, { weight: 'bold' }));

  // ── Lane lines + labels ────────────────────────────────────────────────────
  for (let lane = 0; lane < ir.lanes; lane++) {
    const laneCommits = ir.commits.filter(c => c.lane === lane);
    if (laneCommits.length === 0 && lane !== 0) continue;
    const xs = laneCommits.map(c => c.x);
    const bp = ir.branchPoints.find(b => b.lane === lane);
    const startX = bp ? Math.min(bp.x, ...(xs.length ? xs : [bp.x])) : Math.min(0, ...(xs.length ? xs : [0]));
    const endX = xs.length ? Math.max(...xs) : startX;
    elements.push(p.path(`M ${rhu(cx(startX))} ${rhu(cy(lane))} L ${rhu(cx(endX))} ${rhu(cy(lane))}`, hue(lane), 3, { opacity: 0.55 }));
    const name = ir.laneNames[lane];
    if (name) elements.push(p.text(name, margin, rhu(cy(lane) + typography.smallFontSize * 0.35), typography.smallFontSize, hue(lane), { weight: 'bold' }));
  }

  // ── Branch-point curves ────────────────────────────────────────────────────
  for (const b of ir.branchPoints) {
    const x1 = cx(b.parentX), y1 = cy(b.parentLane);
    const x2 = cx(b.x), y2 = cy(b.lane);
    const mx = (x1 + x2) / 2;
    elements.push(p.path(`M ${rhu(x1)} ${rhu(y1)} C ${rhu(mx)} ${rhu(y1)}, ${rhu(mx)} ${rhu(y2)}, ${rhu(x2)} ${rhu(y2)}`, hue(b.lane), 2.5, { opacity: 0.55 }));
  }

  // ── Merge curves ───────────────────────────────────────────────────────────
  for (const c of ir.commits) {
    if (!c.isMerge || c.fromLane === undefined || c.fromX === undefined) continue;
    const x1 = cx(c.fromX), y1 = cy(c.fromLane);
    const x2 = cx(c.x), y2 = cy(c.lane);
    const mx = (x1 + x2) / 2;
    elements.push(p.path(`M ${rhu(x1)} ${rhu(y1)} C ${rhu(mx)} ${rhu(y1)}, ${rhu(mx)} ${rhu(y2)}, ${rhu(x2)} ${rhu(y2)}`, hue(c.fromLane), 2.5, { opacity: 0.6 }));
  }

  // ── Commit dots + ids + tags ───────────────────────────────────────────────
  for (const c of ir.commits) {
    const x = cx(c.x), y = cy(c.lane);
    const col = hue(c.lane);
    if (c.type === 'highlight') {
      elements.push(p.rect({ x: rhu(x - 9), y: rhu(y - 9), width: 18, height: 18 }, palette.warning, palette.background, 2, { rx: 3 }));
    } else if (c.isMerge) {
      elements.push(p.circle({ x: rhu(x), y: rhu(y) }, 9, palette.background, col, 2.5));
      elements.push(p.circle({ x: rhu(x), y: rhu(y) }, 3.5, col, col, 0));
    } else {
      elements.push(p.circle({ x: rhu(x), y: rhu(y) }, 8, col, palette.background, 2));
    }
    elements.push(p.text(c.id, rhu(x), rhu(y + 22), typography.smallFontSize, palette.textMuted, { anchor: 'middle' }));
    if (c.tag) {
      const w = measureText(c.tag, typography.smallFontSize).width + 12;
      elements.push(p.rect({ x: rhu(x - w / 2), y: rhu(y - 34), width: rhu(w), height: 17 }, palette.warning + '22', palette.warning, 1, { rx: 3 }));
      elements.push(p.text(c.tag, rhu(x), rhu(y - 22), typography.smallFontSize, palette.text, { anchor: 'middle', weight: 'bold' }));
    }
  }

  const totalW = rhuInt(cx(maxX) + 80 + margin);
  const totalH = rhuInt(cy(ir.lanes - 1) + laneGap + margin);

  const scene: Scene = applyOverlays({
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
  }, ir.overlays, theme);

  return { scene, anchors: {} };
}
