import type { RectPrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
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

function circlePath(cx: number, cy: number, r: number): string {
  const left = rhuInt(cx - r);
  const right = rhuInt(cx + r);
  return `M ${left} ${cy} A ${r} ${r} 0 1 0 ${right} ${cy} A ${r} ${r} 0 1 0 ${left} ${cy}`;
}

function buildCurvePath(from: PositionedCommit, to: PositionedCommit): string {
  if (from.y === to.y) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  const midX = rhuInt((from.x + to.x) / 2);
  return `M ${from.x} ${from.y} Q ${midX} ${from.y} ${to.x} ${to.y}`;
}

function titleFontSize(tk: GitGraphTheme): number {
  return tk.branchLabelFontSize + 6;
}

export function layoutGitGraph(doc: GitGraphDocument, themeOverride?: GitGraphTheme): Scene {
  const tk = themeOverride ?? resolveGitGraphTheme(doc.metadata.theme);
  const titleSize = titleFontSize(tk);
  const branchLabelWidth = Math.max(
    tk.branchLabelWidth,
    ...doc.branches.map((branch) => rhuInt(measureText(branch.name, tk.branchLabelFontSize).width + 24)),
  );
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
  const firstCommitCenterX = rhuInt(tk.marginLeft + branchLabelWidth + tk.commitGapX / 2);
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

  const lastCommit = doc.commits.length > 0 ? positionedCommits.get(doc.commits[doc.commits.length - 1]!.id) : undefined;
  const rightOverhang = lastCommit ? Math.max(lastCommit.labelWidth / 2, lastCommit.tagWidth / 2, tk.commitRadius) : tk.commitGapX / 2;
  const baseWidth = rhuInt(tk.marginLeft + branchLabelWidth + Math.max(1, numColumns) * tk.commitGapX + tk.marginRight);
  const width = Math.max(baseWidth, rhuInt((lastCommit?.x ?? firstCommitCenterX) + rightOverhang + tk.marginRight), rhuInt(titleWidth + tk.marginLeft + tk.marginRight));
  const height = rhuInt(contentTop + Math.max(1, sortedBranches.length) * tk.branchLaneSize + tk.marginBottom);

  const laneStartX = rhuInt(tk.marginLeft + branchLabelWidth);
  const laneEndX = rhuInt(width - tk.marginRight);
  const primitives: ScenePrimitive[] = [];

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

  positionedBranches.forEach((branch) => {
    primitives.push({
      kind: 'line',
      x1: laneStartX,
      y1: branch.y,
      x2: laneEndX,
      y2: branch.y,
      stroke: branch.color,
      strokeWidth: tk.branchStrokeWidth,
      opacity: 0.6,
    });
    primitives.push({
      kind: 'text',
      x: rhuInt(tk.marginLeft + branchLabelWidth - 12),
      y: branch.y,
      text: branch.name,
      fontFamily: tk.fontFamily,
      fontSize: tk.branchLabelFontSize,
      fontWeight: tk.branchLabelFontWeight,
      fill: tk.branchLabelColor,
      textAnchor: 'end',
      dominantBaseline: 'middle',
    } satisfies TextPrimitive);
  });

  const edgePrimitives: ScenePrimitive[] = [];
  const commitPrimitives: ScenePrimitive[] = [];
  const overlayPrimitives: ScenePrimitive[] = [];
  const labelPrimitives: ScenePrimitive[] = [];

  for (const commit of doc.commits) {
    const positioned = positionedCommits.get(commit.id);
    if (!positioned) continue;

    if (commit.isMerge && commit.parents.length > 1) {
      const sourceParent = positionedCommits.get(commit.parents[1]!);
      if (sourceParent) {
        edgePrimitives.push({
          kind: 'path',
          d: buildCurvePath(sourceParent, positioned),
          fill: 'none',
          stroke: sourceParent.color,
          strokeWidth: tk.mergeEdgeStrokeWidth,
          strokeLinecap: 'round',
          opacity: 0.9,
        });
      }
    }

    if (commit.isCherryPick && commit.cherryPickSource) {
      const source = positionedCommits.get(commit.cherryPickSource);
      if (source) {
        edgePrimitives.push({
          kind: 'path',
          d: buildCurvePath(source, positioned),
          fill: 'none',
          stroke: source.color,
          strokeWidth: Math.max(1, tk.mergeEdgeStrokeWidth - 0.5),
          dashArray: '4,4',
          strokeLinecap: 'round',
          opacity: 0.8,
        });
      }
    }

    const fill = commit.type === 'HIGHLIGHT'
      ? tk.highlightFill
      : commit.type === 'REVERSE'
        ? tk.reverseFill
        : positioned.color;

    commitPrimitives.push({
      kind: 'circle',
      cx: positioned.x,
      cy: positioned.y,
      r: tk.commitRadius,
      fill,
      stroke: positioned.color,
      strokeWidth: tk.commitStrokeWidth,
    });

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

    if (commit.tag) {
      const tagCenterY = rhuInt(positioned.y - tk.tagOffsetY);
      labelPrimitives.push({
        kind: 'rect',
        x: rhuInt(positioned.x - positioned.tagWidth / 2),
        y: rhuInt(tagCenterY - positioned.tagHeight / 2),
        width: positioned.tagWidth,
        height: positioned.tagHeight,
        fill: tk.tagFill,
        stroke: tk.tagStroke,
        strokeWidth: 1,
        rx: 8,
      } satisfies RectPrimitive);
      labelPrimitives.push({
        kind: 'text',
        x: positioned.x,
        y: rhuInt(tagCenterY + 1),
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

  return {
    width,
    height,
    background: tk.background,
    primitives: [...primitives, ...edgePrimitives, ...commitPrimitives, ...overlayPrimitives, ...labelPrimitives],
  };
}
