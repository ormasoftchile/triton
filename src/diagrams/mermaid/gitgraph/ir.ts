import type { BaseIR } from '../../../contracts/index.js';

export type GitCommitType = 'normal' | 'highlight' | 'reverse';

export interface GitCommit {
  readonly id: string;
  readonly lane: number;
  readonly x: number;
  readonly type: GitCommitType;
  readonly tag?: string;
  readonly isMerge: boolean;
  /** For merge commits: the lane + x of the merged branch tip. */
  readonly fromLane?: number;
  readonly fromX?: number;
}

export interface GitBranchPoint {
  readonly lane: number;
  readonly parentLane: number;
  readonly x: number;
  readonly parentX: number;
}

export interface GitgraphDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly lanes: number;
  readonly laneNames: readonly string[];
  readonly commits: readonly GitCommit[];
  readonly branchPoints: readonly GitBranchPoint[];
}
