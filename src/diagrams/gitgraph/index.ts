import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { GitgraphDocument, GitCommit, GitBranchPoint, GitCommitType } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutGitgraph } from './layout.js';
import * as parser from './parser.js';

export type { GitgraphDocument, GitCommit, GitBranchPoint } from './ir.js';

interface Stmt { t: string; name?: string; id?: string; tag?: string; type?: string }
interface RawDoc { version: string; metadata: GitgraphDocument['metadata']; statements: Stmt[] }

function commitType(raw?: string): GitCommitType {
  const t = (raw || '').toUpperCase();
  return t === 'HIGHLIGHT' ? 'highlight' : t === 'REVERSE' ? 'reverse' : 'normal';
}

export const gitgraph: DiagramModule<GitgraphDocument> = {
  parseMermaid(input: string): GitgraphDocument {
    const raw = parser.parse(input) as RawDoc;
    const laneOf = new Map<string, number>([['main', 0]]);
    const laneNames = ['main'];
    const lastX = new Map<number, number>();          // lane → x of last commit
    const commits: GitCommit[] = [];
    const branchPoints: GitBranchPoint[] = [];
    let current = 'main';
    let nextLane = 1;
    let order = 0;
    let auto = 0;

    for (const s of raw.statements) {
      if (s.t === 'commit') {
        const lane = laneOf.get(current)!;
        commits.push({ id: s.id || `c${auto++}`, lane, x: order, type: commitType(s.type), isMerge: false, ...(s.tag ? { tag: s.tag } : {}) });
        lastX.set(lane, order); order++;
      } else if (s.t === 'branch') {
        if (!laneOf.has(s.name!)) { laneOf.set(s.name!, nextLane); laneNames[nextLane] = s.name!; nextLane++; }
        const lane = laneOf.get(s.name!)!;
        const parentLane = laneOf.get(current)!;
        branchPoints.push({ lane, parentLane, x: order, parentX: lastX.get(parentLane) ?? 0 });
        current = s.name!;
      } else if (s.t === 'checkout') {
        if (laneOf.has(s.name!)) current = s.name!;
      } else if (s.t === 'merge') {
        const lane = laneOf.get(current)!;
        const fromLane = laneOf.get(s.name!) ?? lane;
        commits.push({ id: s.id || `m${auto++}`, lane, x: order, type: commitType(s.type), isMerge: true, fromLane, fromX: lastX.get(fromLane) ?? order, ...(s.tag ? { tag: s.tag } : {}) });
        lastX.set(lane, order); order++;
      }
    }

    return { version: raw.version, metadata: raw.metadata, lanes: nextLane, laneNames, commits, branchPoints };
  },

  parseYaml(input: string): GitgraphDocument {
    return JSON.parse(input) as GitgraphDocument;
  },

  layout(ir: GitgraphDocument, theme: ResolvedTheme): LayoutResult {
    return layoutGitgraph(ir, theme);
  },
};
