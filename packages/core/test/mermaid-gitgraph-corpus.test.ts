import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { gitGraphDocumentSchema, resolveGitGraphTheme } from '../src/grammars/gitgraph/index.js';
import type { GitGraphDocument } from '../src/grammars/gitgraph/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseGitGraphDiagram, parseGitGraphDiagramInternal } from '../src/frontend/mermaid/gitgraph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const GITGRAPH_MMD = join(GALLERY, 'mermaid-gitgraph.mmd');
const GITGRAPH_SVG = join(GALLERY, 'mermaid-gitgraph.svg');
const GITGRAPH_PNG = join(GALLERY, 'mermaid-gitgraph.png');

const STANDARD_GRAPH = `gitGraph
   commit id: "init"
   branch develop
   checkout develop
   commit id: "feat-1"
   commit id: "feat-2"
   checkout main
   merge develop id: "merge-develop" tag: "v1.0"`;

const RELEASE_MODEL = `gitGraph
   commit id: "initial"
   branch develop
   checkout develop
   commit id: "setup"
   branch release/1.0
   checkout release/1.0
   commit id: "stabilize"
   checkout main
   merge release/1.0 id: "release-1.0" tag: "v1.0"
   checkout develop
   merge release/1.0 id: "backmerge"`;

const CHERRY_PICK_SAMPLE = `gitGraph
   commit id: "init"
   branch feature/ui
   checkout feature/ui
   commit id: "feat-1"
   checkout main
   cherry-pick id: "feat-1"`;

interface GitGraphCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: GitGraphDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

function sceneTexts(rendered: ReturnType<typeof renderMermaid>): string[] {
  return rendered.scene.primitives.flatMap((primitive) => {
    if (primitive.kind === 'text') return [primitive.text];
    if (primitive.kind === 'multitext') return primitive.lines;
    return [] as string[];
  });
}

const GITGRAPH_CASES: GitGraphCase[] = [
  {
    name: 'minimal gitGraph with one commit',
    text: 'gitGraph\n  commit',
    assert: (doc) => {
      expect(doc.branches.map((branch) => branch.name)).toEqual(['main']);
      expect(doc.commits).toHaveLength(1);
      expect(doc.commits[0]!.parents).toEqual([]);
    },
  },
  {
    name: 'single branch multiple commits',
    text: 'gitGraph\n  commit\n  commit\n  commit',
    assert: (doc) => {
      expect(doc.commits).toHaveLength(3);
      expect(doc.commits[2]!.parents).toEqual(['commit-1']);
    },
  },
  {
    name: 'branch checkout commits',
    text: 'gitGraph\n  commit id: "init"\n  branch develop\n  checkout develop\n  commit id: "feat"',
    assert: (doc) => {
      expect(doc.branches.map((branch) => branch.name)).toEqual(['main', 'develop']);
      expect(doc.commits[1]!.branch).toBe('develop');
    },
  },
  {
    name: 'merge from branch to main',
    text: STANDARD_GRAPH,
    assert: (doc, _warnings, rendered) => {
      const mergeCommit = doc.commits[doc.commits.length - 1]!;
      expect(mergeCommit.isMerge).toBe(true);
      expect(mergeCommit.parents).toHaveLength(2);
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'path')).toBe(true);
    },
  },
  {
    name: 'multiple branches',
    text: 'gitGraph\n  commit\n  branch develop\n  branch hotfix\n  checkout develop\n  commit\n  checkout hotfix\n  commit',
    assert: (doc) => {
      expect(doc.branches).toHaveLength(3);
    },
  },
  {
    name: 'commit with id',
    text: 'gitGraph\n  commit id: "init"',
    assert: (doc) => {
      expect(doc.commits[0]!.id).toBe('init');
    },
  },
  {
    name: 'commit with tag',
    text: 'gitGraph\n  commit id: "init" tag: "v1.0"',
    assert: (doc, _warnings, rendered) => {
      expect(doc.commits[0]!.tag).toBe('v1.0');
      const theme = resolveGitGraphTheme('default-gitgraph');
      // Tags are now rendered as path callouts (rounded-rect + triangle pointer).
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'path' && primitive.fill === theme.tagFill)).toBe(true);
    },
  },
  {
    name: 'commit type normal',
    text: 'gitGraph\n  commit id: "init" type: NORMAL',
    assert: (doc) => {
      expect(doc.commits[0]!.type).toBe('NORMAL');
    },
  },
  {
    name: 'commit type highlight',
    text: 'gitGraph\n  commit id: "hotfix" type: HIGHLIGHT',
    assert: (doc, _warnings, rendered) => {
      expect(doc.commits[0]!.type).toBe('HIGHLIGHT');
      const theme = resolveGitGraphTheme('default-gitgraph');
      // HIGHLIGHT commits are now rendered as filled squares (rect), not circles.
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'rect' && primitive.fill === theme.highlightFill)).toBe(true);
    },
  },
  {
    name: 'commit type reverse',
    text: 'gitGraph\n  commit id: "rollback" type: REVERSE',
    assert: (doc, _warnings, rendered) => {
      expect(doc.commits[0]!.type).toBe('REVERSE');
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'path' && primitive.dashArray === '4,3')).toBe(true);
    },
  },
  {
    name: 'cherry pick commit',
    text: CHERRY_PICK_SAMPLE,
    assert: (doc, _warnings, rendered) => {
      const last = doc.commits[doc.commits.length - 1]!;
      expect(last.isCherryPick).toBe(true);
      expect(last.cherryPickSource).toBe('feat-1');
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'path' && primitive.dashArray === '4,4')).toBe(true);
    },
  },
  {
    name: 'switch alias for checkout',
    text: 'gitGraph\n  branch develop\n  switch develop\n  commit id: "feat"',
    assert: (doc) => {
      expect(doc.commits[0]!.branch).toBe('develop');
    },
  },
  {
    name: 'checkout unknown branch warns and creates',
    text: 'gitGraph\n  checkout preview\n  commit id: "feat"',
    warningPattern: /Checkout of unknown branch/i,
    assert: (doc) => {
      expect(doc.branches.some((branch) => branch.name === 'preview')).toBe(true);
      expect(doc.commits[0]!.branch).toBe('preview');
    },
  },
  {
    name: 'merge unknown branch warns',
    text: 'gitGraph\n  commit id: "init"\n  merge missing id: "merge-missing"',
    warningPattern: /Merge of unknown branch/i,
    assert: (doc) => {
      expect(doc.commits[1]!.parents).toHaveLength(1);
    },
  },
  {
    name: 'duplicate branch declaration warns',
    text: 'gitGraph\n  branch develop\n  branch develop\n  checkout develop\n  commit',
    warningPattern: /Duplicate gitGraph branch declaration/i,
    assert: (doc) => {
      expect(doc.branches.filter((branch) => branch.name === 'develop')).toHaveLength(1);
    },
  },
  {
    name: 'empty branch still renders lane',
    text: 'gitGraph\n  commit id: "init"\n  branch feature',
    assert: (doc, _warnings, rendered) => {
      expect(doc.branches).toHaveLength(2);
      const theme = resolveGitGraphTheme('default-gitgraph');
      const laneLines = rendered.scene.primitives.filter((primitive) => primitive.kind === 'line' && primitive.strokeWidth === theme.branchStrokeWidth);
      expect(laneLines.length).toBeGreaterThanOrEqual(2);
    },
  },
  {
    name: 'explicit LR orientation',
    text: 'gitGraph LR:\n  commit\n  commit',
    assert: (doc) => {
      expect(doc.metadata.orientation).toBe('LR');
    },
  },
  {
    name: 'explicit TB orientation falls back with warning',
    text: 'gitGraph TB:\n  commit\n  branch develop\n  checkout develop\n  commit',
    warningPattern: /falls back to the LR lane layout/i,
    assert: (doc, warnings, rendered) => {
      expect(doc.metadata.orientation).toBe('TB');
      expect(warnings.some((warning) => /falls back/i.test(warning))).toBe(true);
      expect(rendered.scene.width).toBeGreaterThan(0);
    },
  },
  {
    name: 'compact syntax no spaces in modifiers',
    text: 'gitGraph LR:\ncommit id:"init" tag:"v0"\nbranch develop\ncheckout develop\ncommit id:"feat"',
    assert: (doc) => {
      expect(doc.commits[0]!.id).toBe('init');
      expect(doc.commits[0]!.tag).toBe('v0');
      expect(doc.commits[1]!.id).toBe('feat');
    },
  },
  {
    name: 'deeply branched graph',
    text: `gitGraph
  commit id: "init"
  branch develop
  checkout develop
  commit id: "dev-1"
  branch feature/ui
  checkout feature/ui
  commit id: "ui-1"
  checkout develop
  merge feature/ui id: "merge-ui"
  branch hotfix
  checkout hotfix
  commit id: "hotfix-1"
  checkout main
  merge develop id: "release"
  merge hotfix id: "hotfix-merge"`,
    assert: (doc) => {
      expect(doc.branches).toHaveLength(4);
      expect(doc.commits.length).toBeGreaterThanOrEqual(7);
    },
  },
  {
    name: 'merge with id and tag',
    text: 'gitGraph\n  commit id: "init"\n  branch develop\n  checkout develop\n  commit id: "feat"\n  checkout main\n  merge develop id: "release" tag: "v1.0"',
    assert: (doc) => {
      const merge = doc.commits[doc.commits.length - 1]!;
      expect(merge.id).toBe('release');
      expect(merge.tag).toBe('v1.0');
    },
  },
  {
    name: 'auto generated commit ids are stable',
    text: 'gitGraph\n  commit\n  commit\n  commit',
    assert: (doc) => {
      expect(doc.commits.map((commit) => commit.id)).toEqual(['commit-0', 'commit-1', 'commit-2']);
    },
  },
  {
    name: 'tag rendering includes label text',
    text: 'gitGraph\n  commit id: "init" tag: "v2.0"',
    assert: (_doc, _warnings, rendered) => {
      expect(sceneTexts(rendered)).toContain('v2.0');
    },
  },
  {
    name: 'branch order modifier is stored',
    text: 'gitGraph\n  branch develop order: 7\n  checkout develop\n  commit',
    assert: (doc) => {
      const develop = doc.branches.find((branch) => branch.name === 'develop');
      expect(develop?.order).toBe(7);
    },
  },
  {
    name: 'many commits preserve chronological order',
    text: `gitGraph
  commit
  commit
  commit
  commit
  commit
  commit
  commit
  commit
  commit
  commit`,
    assert: (doc) => {
      expect(doc.commits).toHaveLength(10);
      expect(doc.commits[9]!.id).toBe('commit-9');
    },
  },
  {
    name: 'real Mermaid crawl sample standard graph',
    text: STANDARD_GRAPH,
    assert: (doc) => {
      expect(doc.branches).toHaveLength(2);
      expect(doc.commits).toHaveLength(4);
    },
  },
  {
    name: 'real Mermaid crawl sample release branching model',
    text: RELEASE_MODEL,
    assert: (doc) => {
      expect(doc.branches.some((branch) => branch.name === 'release/1.0')).toBe(true);
      expect(doc.commits.some((commit) => commit.tag === 'v1.0')).toBe(true);
    },
  },
  {
    name: 'real Mermaid crawl sample cherry pick flow',
    text: CHERRY_PICK_SAMPLE,
    assert: (doc) => {
      expect(doc.commits.some((commit) => commit.isCherryPick)).toBe(true);
    },
  },
  {
    name: 'frontmatter theme override is preserved',
    text: '---\ntheme: dark-gitgraph\n---\ngitGraph\n  commit id: "init"',
    assert: (doc) => {
      expect(doc.metadata.theme).toBe('dark-gitgraph');
    },
  },
  {
    name: 'directive title fallback applies',
    text: '%%{init: {"title": "Directive Graph"}}%%\ngitGraph\n  commit id: "init"',
    assert: (doc) => {
      expect(doc.metadata.title).toBe('Directive Graph');
    },
  },
  {
    name: 'frontmatter title fallback applies',
    text: '---\ntitle: FM Graph\n---\ngitGraph\n  commit id: "init"',
    assert: (doc) => {
      expect(doc.metadata.title).toBe('FM Graph');
    },
  },
  {
    name: 'unknown commit type warns and defaults',
    text: 'gitGraph\n  commit id: "init" type: SURPRISE',
    warningPattern: /Unknown gitGraph commit type/i,
    assert: (doc) => {
      expect(doc.commits[0]!.type).toBe('NORMAL');
    },
  },
];

describe('Mermaid gitGraph corpus', () => {
  it.each(GITGRAPH_CASES)('$name', ({ text, warningPattern, assert }) => {
    expect(detectDiagramType(text)).toBe('gitGraph');
    expect(() => parseGitGraphDiagram(text)).not.toThrow();

    const parsed = parseGitGraphDiagramInternal(text);
    const viaIndex = parseMermaid(text);
    expect(viaIndex.kind).toBe('gitGraph');

    const doc = viaIndex.doc as GitGraphDocument;
    const rendered = renderMermaid(text, { format: 'svg' });
    expect(rendered.kind).toBe('gitGraph');
    expect(rendered.svg).toContain('<svg');

    if (warningPattern) {
      expect(parsed.warnings.some((warning) => warningPattern.test(warning))).toBe(true);
    }

    assert(doc, parsed.warnings, rendered);
  });

  it('detectDiagramType returns gitGraph', () => {
    expect(detectDiagramType('gitGraph\n  commit')).toBe('gitGraph');
  });

  it('parseMermaid dispatches to gitGraph', () => {
    const result = parseMermaid(STANDARD_GRAPH);
    expect(result.kind).toBe('gitGraph');
    expect((result.doc as GitGraphDocument).commits).toHaveLength(4);
  });

  it('GitGraphDocument schema validation succeeds for valid docs', () => {
    expect(() => gitGraphDocumentSchema.parse(parseGitGraphDiagram(STANDARD_GRAPH))).not.toThrow();
  });

  it('GitGraphDocument schema validation rejects unknown parent references', () => {
    expect(() => gitGraphDocumentSchema.parse({
      version: '1.0',
      metadata: { orientation: 'LR' },
      branches: [{ name: 'main', order: 0 }],
      commits: [{
        id: 'init',
        branch: 'main',
        parents: ['missing'],
        type: 'NORMAL',
        isMerge: false,
        isCherryPick: false,
      }],
    })).toThrow();
  });

  it('mermaid-gitgraph.mmd exists', () => {
    expect(existsSync(GITGRAPH_MMD)).toBe(true);
  });

  it('emits mermaid-gitgraph.svg to examples/gallery/', () => {
    const text = readFileSync(GITGRAPH_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('gitGraph');
    writeFileSync(GITGRAPH_SVG, result.svg!, 'utf8');
    expect(statSync(GITGRAPH_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-gitgraph.png to examples/gallery/', () => {
    const text = readFileSync(GITGRAPH_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(GITGRAPH_PNG, result.png!);
    expect(statSync(GITGRAPH_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts gitGraph gallery files exist and are non-empty', () => {
    expect(existsSync(GITGRAPH_SVG)).toBe(true);
    expect(existsSync(GITGRAPH_PNG)).toBe(true);
    expect(statSync(GITGRAPH_SVG).size).toBeGreaterThan(1000);
    expect(statSync(GITGRAPH_PNG).size).toBeGreaterThan(1000);
  });
});
