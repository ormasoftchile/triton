import type { PathPrimitive, RectPrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';

import type { GitBranch, GitCommit, GitGraphDocument } from './types.js';
import type { GitGraphTheme } from './theme.js';
import { resolveGitGraphTheme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

interface PositionedBranch extends GitBranch {
  laneIndex: number;
  y: number;
  color: string;
}

interface PositionedCommit {
  commit: GitCommit;
  x: number;
  y: number;
  color: string;
  labelWidth: number;
  tagWidth: number;
  tagHeight: number;
}

// Two-arc circle path used for the REVERSE commit dashed overlay.
function circlePath(cx: number, cy: number, r: number): string {
  const left = rhuInt(cx - r);
  const right = rhuInt(cx + r);
  return `M ${left} ${cy} A ${r} ${r} 0 1 0 ${right} ${cy} A ${r} ${r} 0 1 0 ${left} ${cy}`;
}

/**
 * Cubic "subway-map" S-curve between two points.
 * Works for both branch-off connectors (going down) and merge connectors
 * (going up): the midpoint control points create a smooth S-bend regardless
 * of whether y1 > y0 or y1 < y0.
 */
function cubicBezierPath(x0: number, y0: number, x1: number, y1: number): string {
  const midY = rhuInt((y0 + y1) / 2);
  return `M ${x0} ${y0} C ${x0} ${midY} ${x1} ${midY} ${x1} ${y1}`;
}

/**
 * Rounded-rect with a downward-pointing triangle pointer — used for tag
 * callouts.  `tipY` is the y-coordinate of the triangle's tip (pointing at
 * the commit dot); the body rectangle sits above it.
 */
function tagCalloutPath(cx: number, tipY: number, w: number, h: number, tipH: number): string {
  const x = rhuInt(cx - w / 2);
  const bodyBottom = rhuInt(tipY - tipH);
  const bodyTop = rhuInt(bodyBottom - h);
  const right = x + w;
  const r = 4;
  return [
    `M ${rhuInt(cx - 3)} ${bodyBottom}`,
    `L ${x + r} ${bodyBottom}`,
    `Q ${x} ${bodyBottom} ${x} ${bodyBottom - r}`,
    `L ${x} ${bodyTop + r}`,
    `Q ${x} ${bodyTop} ${x + r} ${bodyTop}`,
    `L ${right - r} ${bodyTop}`,
    `Q ${right} ${bodyTop} ${right} ${bodyTop + r}`,
    `L ${right} ${bodyBottom - r}`,
    `Q ${right} ${bodyBottom} ${right - r} ${bodyBottom}`,
    `L ${rhuInt(cx + 3)} ${bodyBottom}`,
    `L ${cx} ${tipY}`,
    `Z`,
  ].join(' ');
}

function titleFontSize(tk: GitGraphTheme): number {
  return tk.branchLabelFontSize + 6;
}

export function layoutGitGraph(doc: GitGraphDocument, themeOverride?: GitGraphTheme): Scene {
  const tk = themeOverride ?? resolveGitGraphTheme(doc.metadata.theme);
  const titleSize = titleFontSize(tk);

  // Pill-label sizing: honour theme minimum, expand for long branch names.
  const pillPadX = 12;
  const pillPadY = 5;
  const pillLabelWidth = Math.max(
    tk.branchLabelWidth,
    ...doc.branches.map((b) => rhuInt(measureText(b.name, tk.branchLabelFontSize).width + 2 * pillPadX)),
  );
  const pillHeight = rhuInt(tk.branchLabelFontSize + 2 * pillPadY);

  const titleWidth = doc.metadata.title ? rhuInt(measureText(doc.metadata.title, titleSize).width) : 0;

  const sortedBranches = [...doc.branches].sort((a, b) => a.order - b.order);
  const positionedBranches = new Map<string, PositionedBranch>();
  const titleBlockHeight = doc.metadata.title ? titleSize + 18 : 0;
  const contentTop = rhuInt(tk.marginTop + titleBlockHeight);

  sortedBranches.forEach((branch, laneIndex) => {
    const y = rhuInt(contentTop + laneIndex * tk.branchLaneSize + tk.branchLaneSize / 2);
    positionedBranches.set(branch.name, {
      ...branch,
      laneIndex,
      y,
      color: tk.branchColors[laneIndex % tk.branchColors.length] ?? '#4a6cf7',
    });
  });

  const numColumns = doc.commits.length;
  const labelAreaEnd = rhuInt(tk.marginLeft + pillLabelWidth);
  const firstCommitCenterX = rhuInt(labelAreaEnd + tk.commitGapX / 2);
  const positionedCommits = new Map<string, PositionedCommit>();

  doc.commits.forEach((commit, index) => {
    const branch = positionedBranches.get(commit.branch);
    const color = branch?.color ?? tk.branchColors[0] ?? '#4a6cf7';
    const x = rhuInt(firstCommitCenterX + index * tk.commitGapX);
    const y = branch?.y ?? rhuInt(contentTop + tk.branchLaneSize / 2);
    const labelWidth = rhuInt(measureText(commit.id, tk.commitLabelFontSize).width);
    const tagWidth = commit.tag
      ? rhuInt(measureText(commit.tag, tk.tagFontSize).width + 2 * tk.tagPadX)
      : 0;
    const tagHeight = commit.tag ? rhuInt(tk.tagFontSize + 2 * tk.tagPadY) : 0;
    positionedCommits.set(commit.id, { commit, x, y, color, labelWidth, tagWidth, tagHeight });
  });

  // Topology: first and last positioned commit on each branch (in document order).
  const branchFirstCommit = new Map<string, PositionedCommit>();
  const branchLastCommit = new Map<string, PositionedCommit>();
  for (const commit of doc.commits) {
    const pc = positionedCommits.get(commit.id);
    if (!pc) continue;
    if (!branchFirstCommit.has(commit.branch)) branchFirstCommit.set(commit.branch, pc);
    branchLastCommit.set(commit.branch, pc);
  }

  const lastCommit = doc.commits.length > 0 ? positionedCommits.get(doc.commits[doc.commits.length - 1]!.id) : undefined;
  const rightOverhang = lastCommit ? Math.max(lastCommit.labelWidth / 2, lastCommit.tagWidth / 2, tk.commitRadius) : tk.commitGapX / 2;
  const baseWidth = rhuInt(labelAreaEnd + Math.max(1, numColumns) * tk.commitGapX + tk.marginRight);
  const width = Math.max(baseWidth, rhuInt((lastCommit?.x ?? firstCommitCenterX) + rightOverhang + tk.marginRight), rhuInt(titleWidth + tk.marginLeft + tk.marginRight));
  const height = rhuInt(contentTop + Math.max(1, sortedBranches.length) * tk.branchLaneSize + tk.marginBottom);

  const primitives: ScenePrimitive[] = [];

  // ── Title ─────────────────────────────────────────────────────────────────
  if (doc.metadata.title) {
    primitives.push({
      kind: 'text',
      x: rhuInt(width / 2),
      y: rhuInt(tk.marginTop + titleSize),
      text: doc.metadata.title,
      fontFamily: tk.fontFamily,
      fontSize: titleSize,
      fontWeight: tk.branchLabelFontWeight,
      fill: tk.branchLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
  }

  const lanePrimitives: ScenePrimitive[] = [];
  const edgePrimitives: ScenePrimitive[] = [];
  const commitPrimitives: ScenePrimitive[] = [];
  const overlayPrimitives: ScenePrimitive[] = [];
  const pillPrimitives: ScenePrimitive[] = [];
  const labelPrimitives: ScenePrimitive[] = [];

  // ── Branch lane lines ──────────────────────────────────────────────────────
  // Each lane runs only from its first commit to its last (topology-faithful).
  // Empty branches get a minimal stub so they still appear as a lane marker.
  positionedBranches.forEach((branch) => {
    const firstPC = branchFirstCommit.get(branch.name);
    const lastPC  = branchLastCommit.get(branch.name);

    const laneX1 = firstPC ? firstPC.x : labelAreaEnd;
    const laneX2 = lastPC  ? lastPC.x  : labelAreaEnd + 2;

    lanePrimitives.push({
      kind: 'line',
      x1: laneX1,
      y1: branch.y,
      x2: Math.max(laneX1, laneX2),
      y2: branch.y,
      stroke: branch.color,
      strokeWidth: tk.branchStrokeWidth,
      opacity: 1.0,
    });
  });

  // ── Branch-off connectors ──────────────────────────────────────────────────
  // For every non-primary branch, draw a bold S-curve from the parent
  // commit (the "branch point") on the parent lane down to the first commit
  // on the child lane.
  //
  // NOTE: The Mermaid gitGraph IR does NOT record the branch-off parent in
  // commit.parents[] for the first commit on a new branch — it stores [] when
  // the branch has not yet had any commits.  We derive the branch-off parent by
  // looking at the commit immediately before the first child commit in document
  // order that belongs to a different branch.  For merge-style parents we
  // additionally check parents[0] against positionedCommits.
  for (const commit of doc.commits) {
    const positioned = positionedCommits.get(commit.id);
    if (!positioned) continue;

    // Only process the first commit of each branch.
    if (branchFirstCommit.get(commit.branch)?.commit.id !== commit.id) continue;

    const branch = positionedBranches.get(commit.branch);
    // Skip the primary (index 0) branch — it has no parent branch to branch off from.
    if (!branch || branch.laneIndex === 0) continue;

    // Locate the branch-off (parent) commit.
    let branchOffPC: PositionedCommit | undefined;

    // Priority 1: explicit parent on a different branch.
    if (commit.parents.length > 0) {
      const parentPC = positionedCommits.get(commit.parents[0]!);
      if (parentPC && parentPC.commit.branch !== commit.branch) {
        branchOffPC = parentPC;
      }
    }

    // Priority 2: fallback — last commit in document order before this one that
    // is on a different branch.  This covers the common IR gap where the parser
    // emits parents=[] for the first commit on a freshly-created branch.
    if (!branchOffPC) {
      const commitIndex = doc.commits.findIndex((c) => c.id === commit.id);
      for (let k = commitIndex - 1; k >= 0; k--) {
        const prev = doc.commits[k]!;
        if (prev.branch !== commit.branch) {
          branchOffPC = positionedCommits.get(prev.id);
          break;
        }
      }
    }

    if (!branchOffPC) continue; // truly orphan branch — no connector

    edgePrimitives.push({
      kind: 'path',
      d: cubicBezierPath(branchOffPC.x, branchOffPC.y, positioned.x, positioned.y),
      fill: 'none',
      stroke: branch.color,
      strokeWidth: tk.branchStrokeWidth,
      strokeLinecap: 'round',
      opacity: 1.0,
    } satisfies PathPrimitive);
  }

  // ── Merge / cherry-pick connectors + commit dots ───────────────────────────
  for (const commit of doc.commits) {
    const positioned = positionedCommits.get(commit.id);
    if (!positioned) continue;

    // Merge: bold S-curve from the source-branch tip up to the merge commit.
    if (commit.isMerge && commit.parents.length > 1) {
      const sourcePC = positionedCommits.get(commit.parents[1]!);
      if (sourcePC) {
        edgePrimitives.push({
          kind: 'path',
          d: cubicBezierPath(sourcePC.x, sourcePC.y, positioned.x, positioned.y),
          fill: 'none',
          stroke: sourcePC.color,
          strokeWidth: tk.branchStrokeWidth,
          strokeLinecap: 'round',
          opacity: 1.0,
        } satisfies PathPrimitive);
      }
    }

    // Cherry-pick: dashed S-curve from the picked commit to the target.
    if (commit.isCherryPick && commit.cherryPickSource) {
      const sourcePC = positionedCommits.get(commit.cherryPickSource);
      if (sourcePC) {
        edgePrimitives.push({
          kind: 'path',
          d: cubicBezierPath(sourcePC.x, sourcePC.y, positioned.x, positioned.y),
          fill: 'none',
          stroke: sourcePC.color,
          strokeWidth: Math.max(1, tk.branchStrokeWidth - 1),
          dashArray: '4,4',
          strokeLinecap: 'round',
          opacity: 0.8,
        } satisfies PathPrimitive);
      }
    }

    // Commit dot rendering.
    if (commit.isMerge) {
      // Hollow circle: background fill + thick colored ring.
      commitPrimitives.push({
        kind: 'circle',
        cx: positioned.x,
        cy: positioned.y,
        r: tk.commitRadius,
        fill: tk.background,
        stroke: positioned.color,
        strokeWidth: tk.commitStrokeWidth + 2,
      });
    } else if (commit.type === 'HIGHLIGHT') {
      // Filled square for HIGHLIGHT commits.
      const half = rhuInt(tk.commitRadius * 1.1);
      commitPrimitives.push({
        kind: 'rect',
        x: positioned.x - half,
        y: positioned.y - half,
        width: half * 2,
        height: half * 2,
        fill: tk.highlightFill,
        stroke: positioned.color,
        strokeWidth: tk.commitStrokeWidth,
        rx: 2,
      } satisfies RectPrimitive);
    } else {
      const fill = commit.type === 'REVERSE' ? tk.reverseFill : positioned.color;
      commitPrimitives.push({
        kind: 'circle',
        cx: positioned.x,
        cy: positioned.y,
        r: tk.commitRadius,
        fill,
        stroke: positioned.color,
        strokeWidth: tk.commitStrokeWidth,
      });
    }

    // REVERSE: add dashed ring overlay on top of the circle.
    if (commit.type === 'REVERSE') {
      overlayPrimitives.push({
        kind: 'path',
        d: circlePath(positioned.x, positioned.y, tk.commitRadius),
        fill: 'none',
        stroke: positioned.color,
        strokeWidth: tk.commitStrokeWidth,
        dashArray: '4,3',
      });
    }

    // Commit-ID label below the dot.
    labelPrimitives.push({
      kind: 'text',
      x: positioned.x,
      y: rhuInt(positioned.y + tk.commitLabelOffsetY),
      text: commit.id,
      fontFamily: tk.fontFamily,
      fontSize: tk.commitLabelFontSize,
      fontWeight: 500,
      fill: tk.commitLabelColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);

    // Tag callout: rounded-rect with triangle pointer aiming at the commit dot.
    if (commit.tag) {
      const tipH    = 6;
      const tipY    = rhuInt(positioned.y - tk.tagOffsetY);
      const bodyH   = positioned.tagHeight;
      const bodyW   = positioned.tagWidth;
      const centerY = rhuInt(tipY - tipH - bodyH / 2);

      labelPrimitives.push({
        kind: 'path',
        d: tagCalloutPath(positioned.x, tipY, bodyW, bodyH, tipH),
        fill: tk.tagFill,
        stroke: tk.tagStroke,
        strokeWidth: 1,
      } satisfies PathPrimitive);
      labelPrimitives.push({
        kind: 'text',
        x: positioned.x,
        y: centerY,
        text: commit.tag,
        fontFamily: tk.fontFamily,
        fontSize: tk.tagFontSize,
        fontWeight: tk.tagFontWeight,
        fill: tk.tagColor,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      } satisfies TextPrimitive);
    }
  }

  // ── Branch-label pills ─────────────────────────────────────────────────────
  // Colored rounded-rect pill with white label, drawn over the connectors.
  positionedBranches.forEach((branch) => {
    const textW  = rhuInt(measureText(branch.name, tk.branchLabelFontSize).width);
    const pillW  = rhuInt(textW + 2 * pillPadX);
    const pillX  = rhuInt(tk.marginLeft + (pillLabelWidth - pillW) / 2);
    const pillY  = rhuInt(branch.y - pillHeight / 2);

    pillPrimitives.push({
      kind: 'rect',
      x: pillX,
      y: pillY,
      width: pillW,
      height: pillHeight,
      fill: branch.color,
      rx: rhuInt(pillHeight / 2), // fully rounded pill
    } satisfies RectPrimitive);

    pillPrimitives.push({
      kind: 'text',
      x: rhuInt(pillX + pillW / 2),
      y: branch.y,
      text: branch.name,
      fontFamily: tk.fontFamily,
      fontSize: tk.branchLabelFontSize,
      fontWeight: tk.branchLabelFontWeight,
      fill: '#ffffff',
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  });

  return {
    width,
    height,
    background: tk.background,
    primitives: [
      ...primitives,       // title
      ...lanePrimitives,   // branch lane lines (topology-aware extents)
      ...edgePrimitives,   // branch-off + merge + cherry-pick connectors
      ...commitPrimitives, // commit dots / squares
      ...overlayPrimitives,// REVERSE dashed ring overlay
      ...pillPrimitives,   // colored branch-label pills (above connectors)
      ...labelPrimitives,  // commit-id labels + tag callouts
    ],
  };
}
