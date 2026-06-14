export type GitCommitType = 'NORMAL' | 'REVERSE' | 'HIGHLIGHT';
export type GitGraphOrientation = 'LR' | 'TB';

export interface GitCommit {
  id: string;
  branch: string;
  parents: string[];
  tag?: string;
  type: GitCommitType;
  isMerge: boolean;
  isCherryPick: boolean;
  cherryPickSource?: string;
}

export interface GitBranch {
  name: string;
  order: number;
  color?: string;
}

export interface GitGraphMetadata {
  title?: string;
  theme?: string;
  orientation: GitGraphOrientation;
}

export interface GitGraphDocument {
  version: string;
  metadata: GitGraphMetadata;
  branches: GitBranch[];
  commits: GitCommit[];
}
