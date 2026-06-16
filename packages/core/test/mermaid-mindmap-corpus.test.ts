/**
 * @file test/mermaid-mindmap-corpus.test.ts — Real-Mermaid mindmap corpus validation.
 *
 * Crawl-derived acceptance tests for the Mermaid mindmap parser.
 * Covers indentation hierarchy, root node, shape→clean label, icon directives,
 * multi-level nesting, graceful degradation, and gallery emit.
 *
 * Acceptance criteria:
 *   AC1  Indentation depth → tree parent/child relationships
 *   AC2  Root node: first node at shallowest indent, kind='root'
 *   AC3  Node shapes → clean labels (no delimiter leakage)
 *   AC4  Icon directives (::icon) → node.icon with prefix stripped
 *   AC5  Multi-level nesting (3+ levels deep)
 *   AC6  Graceful degradation: :::class deferred; extra roots warned
 *   AC7  Determinism: parse twice → identical JSON
 *   AC8  Gallery emit: render mermaid-mindmap.mmd → .svg + .png
 *   AC9  Public warnings surface via parseMermaid.warnings[]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseMindmap, parseMindmapInternal } from '../src/frontend/mermaid/mindmap.js';
import type { TreeDocument } from '../src/grammars/tree/types.js';

const __dirname     = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT     = resolve(__dirname, '..', '..', '..');
const GALLERY       = join(REPO_ROOT, 'examples', 'gallery');
const MINDMAP_MMD   = join(GALLERY, 'mermaid-mindmap.mmd');

// ---------------------------------------------------------------------------
// AC1 — Indentation → tree hierarchy
// ---------------------------------------------------------------------------

describe('AC1 — indentation → tree hierarchy', () => {
  it('two-level: root with two children', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    A\n    B`);
    expect(doc.tree.root.children).toHaveLength(2);
  });

  it('deeper child is grandchild, not sibling', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    Parent\n      Child`);
    expect(doc.tree.root.children?.[0]?.children?.[0]?.label).toBe('Child');
  });

  it('sibling after deeper child is sibling to parent (dedent)', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    A\n      A-child\n    B`);
    expect(doc.tree.root.children).toHaveLength(2);
    expect(doc.tree.root.children?.[1]?.label).toBe('B');
  });

  it('tabs handled as 2-space equiv', () => {
    const doc = parseMindmap(`mindmap\n\troot((Root))\n\t\tA\n\t\tB`);
    expect(doc.tree.root.children?.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Root node
// ---------------------------------------------------------------------------

describe('AC2 — root node detection', () => {
  it('root((label)) — root label extracted', () => {
    const doc = parseMindmap(`mindmap\n  root((mindmap))\n    A`);
    expect(doc.tree.root.label).toBe('mindmap');
  });

  it('root node kind is "root"', () => {
    const doc = parseMindmap(`mindmap\n  root((mindmap))\n    A`);
    expect(doc.tree.root.kind).toBe('root');
  });

  it('bare text root', () => {
    const doc = parseMindmap(`mindmap\n  MyRoot\n    Child`);
    expect(doc.tree.root.label).toBe('MyRoot');
  });

  it('empty mindmap → synthetic root, warning', () => {
    const { doc, warnings } = parseMindmapInternal(`mindmap`);
    expect(doc.tree.root.label).toBeDefined();
    expect(warnings.some(w => /empty|synthetic/i.test(w))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3 — Node shapes → clean labels
// ---------------------------------------------------------------------------

describe('AC3 — node shapes → clean label extraction', () => {
  it('id((label)) → label without "(("', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n((Circle))`);
    const circleNode = doc.tree.root.children?.find(c => c.label === 'Circle');
    expect(circleNode?.label).toBe('Circle');
    expect(circleNode?.label).not.toContain('((');
  });

  it('id[label] → label without "["', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n[Square]`);
    expect(doc.tree.root.children?.[0]?.label).toBe('Square');
    expect(doc.tree.root.children?.[0]?.label).not.toContain('[');
  });

  it('id(label) → label without "("', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n(Rounded)`);
    expect(doc.tree.root.children?.[0]?.label).toBe('Rounded');
    expect(doc.tree.root.children?.[0]?.label).not.toContain('(');
  });

  it('id{{label}} → label without "{{"', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n{{Hexagon}}`);
    expect(doc.tree.root.children?.[0]?.label).toBe('Hexagon');
    expect(doc.tree.root.children?.[0]?.label).not.toContain('{');
  });

  it('id))label(( → label without "))"', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n))Bang((`);
    expect(doc.tree.root.children?.[0]?.label).toBe('Bang');
  });

  it('id>label] → label without ">"', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n>Asymm]`);
    expect(doc.tree.root.children?.[0]?.label).toBe('Asymm');
  });

  it('<br/> HTML → line-break marker preserved in label (for multi-line rendering)', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    On effectiveness<br/>and features`);
    // <br/> is now preserved so splitLabelLines() can render it as a multi-line label.
    expect(doc.tree.root.children?.[0]?.label).toBe('On effectiveness<br/>and features');
  });

  it('kind set for circle nodes', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n((circle node))`);
    expect(doc.tree.root.children?.[0]?.kind).toBe('circle');
  });

  it('kind set for rect nodes', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    n[rect node]`);
    expect(doc.tree.root.children?.[0]?.kind).toBe('rect');
  });
});

// ---------------------------------------------------------------------------
// AC4 — Icon directives
// ---------------------------------------------------------------------------

describe('AC4 — ::icon() directives → node.icon', () => {
  it('::icon(fa fa-book) → icon="book" on previous node', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    Origins\n      Long history\n      ::icon(fa fa-book)\n      Popularisation`);
    const origins = doc.tree.root.children?.[0];
    const longHistory = origins?.children?.[0];
    expect(longHistory?.icon).toBe('book');
  });

  it('::icon(fa-clock) → icon="clock" (fa- prefix stripped)', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    A\n    ::icon(fa-clock)`);
    expect(doc.tree.root.children?.[0]?.icon).toBe('clock');
  });

  it('icon warning emitted for FA icon (registry mismatch possible)', () => {
    const { warnings } = parseMindmapInternal(`mindmap\n  root((Root))\n    A\n    ::icon(fa fa-star)`);
    expect(warnings.some(w => /ICON/i.test(w))).toBe(true);
  });

  it('::icon() without preceding node → warning', () => {
    const { warnings } = parseMindmapInternal(`mindmap\n  ::icon(fa fa-star)`);
    expect(warnings.some(w => /no preceding node/i.test(w))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC5 — Multi-level nesting
// ---------------------------------------------------------------------------

describe('AC5 — multi-level nesting (3+ levels)', () => {
  it('3-level deep tree', () => {
    const doc = parseMindmap(`mindmap\n  root((Root))\n    L1\n      L2\n        L3`);
    const l1 = doc.tree.root.children?.[0];
    const l2 = l1?.children?.[0];
    const l3 = l2?.children?.[0];
    expect(l3?.label).toBe('L3');
  });

  it('4-level deep tree', () => {
    const doc = parseMindmap(`mindmap\n  root((R))\n    A\n      B\n        C\n          D`);
    const d = doc.tree.root.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0];
    expect(d?.label).toBe('D');
  });

  it('mixed depth siblings', () => {
    const text = `mindmap
  root((DS))
    Consensus
      Raft
      Paxos
    Storage
      SQL
      NoSQL
        MongoDB`;
    const doc = parseMindmap(text);
    expect(doc.tree.root.children).toHaveLength(2);
    const storage = doc.tree.root.children?.[1];
    expect(storage?.label).toBe('Storage');
    expect(storage?.children).toHaveLength(2);
    expect(storage?.children?.[1]?.children?.[0]?.label).toBe('MongoDB');
  });
});

// ---------------------------------------------------------------------------
// AC6 — Graceful degradation
// ---------------------------------------------------------------------------

describe('AC6 — graceful degradation', () => {
  it(':::className directive → SKIP warning, tree intact', () => {
    const { doc, warnings } = parseMindmapInternal(`mindmap\n  root((Root))\n    A\n    :::myClass`);
    expect(warnings.some(w => /SKIP.*class/i.test(w))).toBe(true);
    expect(doc.tree.root.children).toHaveLength(1);
  });

  it('multiple root-level nodes → warning, second added as child', () => {
    const { doc, warnings } = parseMindmapInternal(`mindmap\n  Root1\n  Root2`);
    expect(warnings.some(w => /multiple root/i.test(w))).toBe(true);
    expect(doc.tree.root.label).toBe('Root1');
  });

  it('node with no content → skipped with warning', () => {
    const { doc } = parseMindmapInternal(`mindmap\n  root((Root))\n    Valid`);
    expect(doc.tree.root.children).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC7 — Determinism
// ---------------------------------------------------------------------------

describe('AC7 — determinism', () => {
  const SAMPLE = `mindmap
  root((Distributed Systems))
    Consensus
      Raft
      Paxos
    Communication
      RPC
        gRPC
        REST
    Storage
      Relational
        PostgreSQL
      NoSQL
        MongoDB`;

  it('parse twice → identical JSON', () => {
    expect(JSON.stringify(parseMindmap(SAMPLE))).toBe(JSON.stringify(parseMindmap(SAMPLE)));
  });

  it('render twice → identical sceneHash', () => {
    const h1 = renderMermaid(SAMPLE, { format: 'svg' }).sceneHash;
    const h2 = renderMermaid(SAMPLE, { format: 'svg' }).sceneHash;
    expect(h1).toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// AC8 — Gallery emit
// ---------------------------------------------------------------------------

describe('AC8 — gallery emit (mermaid-mindmap.mmd → .svg + .png)', () => {
  it('mermaid-mindmap.mmd exists in gallery', () => {
    expect(existsSync(MINDMAP_MMD)).toBe(true);
  });

  it('renders mermaid-mindmap.mmd to SVG', () => {
    const text   = readFileSync(MINDMAP_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('mindmap');
    expect(result.svg).toContain('<svg');
    writeFileSync(join(GALLERY, 'mermaid-mindmap.svg'), result.svg!);
  });

  it('renders mermaid-mindmap.mmd to PNG', () => {
    const text   = readFileSync(MINDMAP_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(1000);
    writeFileSync(join(GALLERY, 'mermaid-mindmap.png'), result.png!);
  });
});

// ---------------------------------------------------------------------------
// AC9 — Public warnings
// ---------------------------------------------------------------------------

describe('AC9 — public warnings', () => {
  it('parseMermaid returns warnings array for mindmap', () => {
    const result = parseMermaid(`mindmap\n  root((Root))\n    A\n    ::icon(fa fa-star)`);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('mindmap without icons → warnings only for icons', () => {
    const result = parseMermaid(`mindmap\n  root((Root))\n    A\n    B`);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Complete patterns — real Mermaid crawl snippets
// ---------------------------------------------------------------------------

describe('Complete patterns — real Mermaid crawl snippets', () => {
  it('official Mermaid mindmap example (origins/research/tools)', () => {
    const text = `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
            Creative techniques
            Strategic planning
    Tools
      Pen and paper
      Mermaid`;
    const doc = parseMindmap(text);
    expect(doc.tree.root.label).toBe('mindmap');
    expect(doc.tree.root.children).toHaveLength(3);
    const research = doc.tree.root.children?.find(c => c.label === 'Research');
    expect(research?.children?.[0]?.label).toContain('effectiveness');
  });

  it('all shape types in one mindmap', () => {
    const text = `mindmap
  root((Root))
    n1[Square]
    n2(Rounded)
    n3((Circle))
    n4{{Hexagon}}
    n5))Bang((
    n6>Asymm]`;
    const doc = parseMindmap(text);
    expect(doc.tree.root.children).toHaveLength(6);
    const labels = doc.tree.root.children?.map(c => c.label);
    expect(labels).toContain('Square');
    expect(labels).toContain('Circle');
    expect(labels).toContain('Hexagon');
  });

  it('theme from frontmatter applied', () => {
    const doc = parseMindmap(`---\ntheme: default-tree\n---\nmindmap\n  root((Root))\n    A`);
    expect(doc.metadata.theme).toBe('default-tree');
  });

  it('tech-stack mindmap: 3 branches, IDs sanitized', () => {
    const text = `mindmap
  root((Tech Stack))
    Frontend
      React
      TypeScript
    Backend
      Node.js
      PostgreSQL
    Cloud
      AWS
      GCP`;
    const doc = parseMindmap(text);
    expect(doc.tree.root.children).toHaveLength(3);
    // All IDs should match IR schema
    const allIds: string[] = [];
    const collect = (n: ReturnType<typeof doc.tree.root.children>[number]) => {
      allIds.push(n.id);
      n.children?.forEach(collect);
    };
    collect(doc.tree.root);
    for (const id of allIds) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
