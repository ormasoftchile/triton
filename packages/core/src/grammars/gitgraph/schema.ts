import { z } from 'zod';

import type {
  GitBranch,
  GitCommit,
  GitCommitType,
  GitGraphDocument,
  GitGraphMetadata,
  GitGraphOrientation,
} from './types.js';

const GIT_COMMIT_TYPES = ['NORMAL', 'REVERSE', 'HIGHLIGHT'] as const;
const GIT_GRAPH_ORIENTATIONS = ['LR', 'TB'] as const;

const gitCommitSchema: z.ZodType<GitCommit> = z.object({
  id: z.string(),
  branch: z.string(),
  parents: z.array(z.string()),
  tag: z.string().optional(),
  type: z.enum(GIT_COMMIT_TYPES) as z.ZodType<GitCommitType>,
  isMerge: z.boolean(),
  isCherryPick: z.boolean(),
  cherryPickSource: z.string().optional(),
});

const gitBranchSchema: z.ZodType<GitBranch> = z.object({
  name: z.string(),
  order: z.number().int(),
  color: z.string().optional(),
});

const gitGraphMetadataSchema: z.ZodType<GitGraphMetadata> = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
  orientation: z.enum(GIT_GRAPH_ORIENTATIONS) as z.ZodType<GitGraphOrientation>,
});

export const gitGraphDocumentSchema: z.ZodType<GitGraphDocument> = z
  .object({
    version: z.string(),
    metadata: gitGraphMetadataSchema,
    branches: z.array(gitBranchSchema),
    commits: z.array(gitCommitSchema),
  })
  .superRefine((doc, ctx) => {
    const branchNames = new Set<string>();
    for (let i = 0; i < doc.branches.length; i++) {
      const branch = doc.branches[i]!;
      if (branchNames.has(branch.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branches', i, 'name'],
          message: `Duplicate branch name: '${branch.name}'`,
        });
      }
      branchNames.add(branch.name);
    }

    const commitIds = new Set<string>();
    for (let i = 0; i < doc.commits.length; i++) {
      const commit = doc.commits[i]!;
      if (commitIds.has(commit.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['commits', i, 'id'],
          message: `Duplicate commit id: '${commit.id}'`,
        });
      }
      commitIds.add(commit.id);
      if (!branchNames.has(commit.branch)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['commits', i, 'branch'],
          message: `Commit '${commit.id}' references unknown branch '${commit.branch}'`,
        });
      }
    }

    for (let i = 0; i < doc.commits.length; i++) {
      const commit = doc.commits[i]!;
      for (let j = 0; j < commit.parents.length; j++) {
        const parentId = commit.parents[j]!;
        if (!commitIds.has(parentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['commits', i, 'parents', j],
            message: `Commit '${commit.id}' references unknown parent '${parentId}'`,
          });
        }
      }
    }
  });

export type GitGraphDocumentInput = z.input<typeof gitGraphDocumentSchema>;
