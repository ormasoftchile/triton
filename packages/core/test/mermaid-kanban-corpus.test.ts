/**
 * @file test/mermaid-kanban-corpus.test.ts — Kanban grammar corpus tests.
 *
 * Tests the full pipeline: parseMermaid → KanbanDocument → renderMermaid → Scene + SVG.
 * Covers: canonical syntax, indentation variants, metadata blocks, priority badges,
 * empty columns, degenerate inputs, dark theme.
 * Emits gallery files: examples/gallery/mermaid-kanban.{mmd,svg,png}.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  kanbanDocumentSchema,
  resolveKanbanTheme,
  buildKanbanScene,
} from '../src/grammars/kanban/index.js';
import type { KanbanDocument } from '../src/grammars/kanban/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import {
  parseKanbanDiagram,
  parseKanbanDiagramInternal,
} from '../src/frontend/mermaid/kanban.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT   = resolve(__dirname, '..', '..', '..');
const GALLERY     = join(REPO_ROOT, 'examples', 'gallery');
const KANBAN_MMD  = join(GALLERY, 'mermaid-kanban.mmd');
const KANBAN_SVG  = join(GALLERY, 'mermaid-kanban.svg');
const KANBAN_PNG  = join(GALLERY, 'mermaid-kanban.png');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function texts(rendered: ReturnType<typeof renderMermaid>): string[] {
  return rendered.scene.primitives.flatMap((p) => {
    if (p.kind === 'text') return [p.text];
    if (p.kind === 'multitext') return p.lines;
    return [] as string[];
  });
}

function rectCount(rendered: ReturnType<typeof renderMermaid>): number {
  return rendered.scene.primitives.filter((p) => p.kind === 'rect').length;
}

// ---------------------------------------------------------------------------
// Corpus cases
// ---------------------------------------------------------------------------

interface KanbanCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: KanbanDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

const KANBAN_CASES: KanbanCase[] = [
  // 1. Minimal 3-column board (real Mermaid example)
  {
    name: 'minimal 3-column board',
    text: `kanban
  Todo
    t1[Design API]
  Doing
    t2[Build backend]
  Done
    t3[Write spec]`,
    assert: (doc, _w, rendered) => {
      expect(doc.columns).toHaveLength(3);
      expect(doc.columns[0]?.label).toBe('Todo');
      expect(doc.columns[1]?.label).toBe('Doing');
      expect(doc.columns[2]?.label).toBe('Done');
      expect(doc.columns[0]?.cards).toHaveLength(1);
      expect(doc.columns[0]?.cards[0]?.label).toBe('Design API');
      expect(rendered.svg).toBeDefined();
      const t = texts(rendered);
      expect(t).toContain('Todo');
      expect(t).toContain('Design API');
    },
  },

  // 2. Column with multiple cards
  {
    name: 'column with multiple cards',
    text: `kanban
  Todo
    t1[Task one]
    t2[Task two]
    t3[Task three]`,
    assert: (doc) => {
      expect(doc.columns[0]?.cards).toHaveLength(3);
      expect(doc.columns[0]?.cards[2]?.label).toBe('Task three');
    },
  },

  // 3. Empty column (no cards)
  {
    name: 'empty column with no cards',
    text: `kanban
  Empty
  Has Items
    t1[Item]`,
    assert: (doc) => {
      expect(doc.columns[0]?.cards).toHaveLength(0);
      expect(doc.columns[1]?.cards).toHaveLength(1);
    },
  },

  // 4. Card with id[label] syntax
  {
    name: 'card id[label] syntax extracts id and label',
    text: `kanban
  Todo
    abc123[My Task Label]`,
    assert: (doc) => {
      expect(doc.columns[0]?.cards[0]?.id).toBe('abc123');
      expect(doc.columns[0]?.cards[0]?.label).toBe('My Task Label');
    },
  },

  // 5. Bare card label (no id prefix)
  {
    name: 'bare card label auto-derives id',
    text: `kanban
  Todo
    Design the API`,
    assert: (doc) => {
      expect(doc.columns[0]?.cards[0]?.label).toBe('Design the API');
      expect(doc.columns[0]?.cards[0]?.id).toBeTruthy();
    },
  },

  // 6. Header only — empty board
  {
    name: 'header only — empty board',
    text: `kanban`,
    assert: (doc) => {
      expect(doc.columns).toHaveLength(0);
    },
  },

  // 7. detectDiagramType identifies kanban
  {
    name: 'detectDiagramType returns kanban',
    text: `kanban
  Todo
    t1[Task]`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.kind).toBe('kanban');
    },
  },

  // 8. Four columns
  {
    name: 'four columns — full sprint board',
    text: `kanban
  Backlog
    b1[Feature A]
    b2[Feature B]
  In Progress
    p1[Feature C]
  Review
    r1[Feature D]
  Done
    d1[Feature E]
    d2[Feature F]`,
    assert: (doc, _w, rendered) => {
      expect(doc.columns).toHaveLength(4);
      expect(doc.columns[0]?.cards).toHaveLength(2);
      expect(doc.columns[3]?.cards).toHaveLength(2);
      const t = texts(rendered);
      expect(t.some((s) => s === 'Backlog')).toBe(true);
      expect(t.some((s) => s === 'Done')).toBe(true);
    },
  },

  // 9. Card metadata @{ priority: "high" }
  {
    name: 'card metadata @{ priority } is parsed',
    text: `kanban
  Todo
    t1[Urgent task]
    @{ priority: "high" }`,
    assert: (doc) => {
      const card = doc.columns[0]?.cards[0];
      expect(card?.metadata?.priority).toBe('high');
    },
  },

  // 10. Card metadata @{ assigned, ticket }
  {
    name: 'card metadata with assigned and ticket keys',
    text: `kanban
  In Progress
    t2[Fix bug]
    @{ assigned: "alice", ticket: "JIRA-123" }`,
    assert: (doc) => {
      const card = doc.columns[0]?.cards[0];
      expect(card?.metadata?.assigned).toBe('alice');
      expect(card?.metadata?.ticket).toBe('JIRA-123');
    },
  },

  // 11. Column id[label] syntax
  {
    name: 'column id[label] syntax extracts id and label',
    text: `kanban
  col1[To Do]
    t1[Task]`,
    assert: (doc) => {
      expect(doc.columns[0]?.id).toBe('col1');
      expect(doc.columns[0]?.label).toBe('To Do');
    },
  },

  // 12. Scene has correct number of rect primitives (at least 1 per column header + 1 per card)
  {
    name: 'scene has rects for column headers and cards',
    text: `kanban
  A
    c1[Card 1]
    c2[Card 2]
  B
    c3[Card 3]`,
    assert: (_doc, _w, rendered) => {
      // At least 2 (col bg) + 2 (header) + 3 (cards) = 7 rects
      expect(rectCount(rendered)).toBeGreaterThanOrEqual(7);
    },
  },

  // 13. Scene width > height for wide boards
  {
    name: 'wide 4-column board has width > height',
    text: `kanban
  A
    c1[Task 1]
  B
    c2[Task 2]
  C
    c3[Task 3]
  D
    c4[Task 4]`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.scene.width).toBeGreaterThan(rendered.scene.height);
    },
  },

  // 14. Long card label wraps gracefully
  {
    name: 'long card label renders without error',
    text: `kanban
  Todo
    t1[This is a very long task label that should wrap across multiple lines in the card box]`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(200);
    },
  },

  // 15. Case-insensitive header
  {
    name: 'case-insensitive KANBAN header',
    text: `KANBAN
  Todo
    t1[Task]`,
    assert: (doc) => {
      expect(doc.columns).toHaveLength(1);
    },
  },

  // 16. Tab indentation
  {
    name: 'tab indentation works as column/card separator',
    text: 'kanban\n\tTodo\n\t\tt1[Tab task]',
    assert: (doc) => {
      expect(doc.columns).toHaveLength(1);
      expect(doc.columns[0]?.cards).toHaveLength(1);
      expect(doc.columns[0]?.cards[0]?.label).toBe('Tab task');
    },
  },

  // 17. Blank lines between columns ignored
  {
    name: 'blank lines between columns are ignored',
    text: `kanban

  Todo

    t1[Task 1]

  Done

    t2[Task 2]
`,
    assert: (doc) => {
      expect(doc.columns).toHaveLength(2);
      expect(doc.columns[0]?.cards).toHaveLength(1);
      expect(doc.columns[1]?.cards).toHaveLength(1);
    },
  },

  // 18. Schema validation passes
  {
    name: 'schema validation passes for well-formed document',
    text: `kanban
  Todo
    t1[Design API]
  Done
    t2[Write spec]`,
    assert: (doc) => {
      expect(() => kanbanDocumentSchema.parse(doc)).not.toThrow();
    },
  },

  // 19. All column header texts appear in SVG
  {
    name: 'all column labels appear in rendered SVG',
    text: `kanban
  Alpha
    a1[Task A]
  Beta
    b1[Task B]
  Gamma
    g1[Task G]`,
    assert: (_doc, _w, rendered) => {
      const t = texts(rendered);
      expect(t).toContain('Alpha');
      expect(t).toContain('Beta');
      expect(t).toContain('Gamma');
    },
  },

  // 20. All card labels appear in SVG
  {
    name: 'all card labels appear in rendered SVG',
    text: `kanban
  Col
    t1[First Card]
    t2[Second Card]
    t3[Third Card]`,
    assert: (_doc, _w, rendered) => {
      const t = texts(rendered);
      expect(t).toContain('First Card');
      expect(t).toContain('Second Card');
      expect(t).toContain('Third Card');
    },
  },

  // 21. Empty string → empty document
  {
    name: 'empty string → empty document',
    text: 'kanban',
    assert: (doc) => {
      expect(doc.columns).toHaveLength(0);
    },
  },

  // 22. Single column many cards
  {
    name: 'single column with 5 cards',
    text: `kanban
  Backlog
    c1[Card 1]
    c2[Card 2]
    c3[Card 3]
    c4[Card 4]
    c5[Card 5]`,
    assert: (doc) => {
      expect(doc.columns[0]?.cards).toHaveLength(5);
    },
  },

  // 23. Card order preserved
  {
    name: 'card order is preserved',
    text: `kanban
  Col
    t1[First]
    t2[Second]
    t3[Third]`,
    assert: (doc) => {
      const labels = doc.columns[0]?.cards.map((c) => c.label);
      expect(labels).toEqual(['First', 'Second', 'Third']);
    },
  },

  // 24. Column order preserved
  {
    name: 'column order is preserved left to right',
    text: `kanban
  First
    t1[Task]
  Second
    t2[Task]
  Third
    t3[Task]`,
    assert: (doc) => {
      const labels = doc.columns.map((c) => c.label);
      expect(labels).toEqual(['First', 'Second', 'Third']);
    },
  },

  // 25. Metadata with all three standard keys
  {
    name: 'metadata with all three standard keys',
    text: `kanban
  Todo
    t1[Task]
    @{ assigned: "bob", priority: "medium", ticket: "GH-42" }`,
    assert: (doc) => {
      const meta = doc.columns[0]?.cards[0]?.metadata;
      expect(meta?.assigned).toBe('bob');
      expect(meta?.priority).toBe('medium');
      expect(meta?.ticket).toBe('GH-42');
    },
  },

  // 26. High priority badge appears in SVG
  {
    name: 'high priority badge text appears in SVG',
    text: `kanban
  Todo
    t1[Critical task]
    @{ priority: "high" }`,
    assert: (_doc, _w, rendered) => {
      const t = texts(rendered);
      expect(t.some((s) => s.toLowerCase().includes('high'))).toBe(true);
    },
  },

  // 27. Dark theme renders without error
  {
    name: 'dark theme renders without error',
    text: `kanban
  Todo
    t1[Dark task]
  Done
    t2[Completed]`,
    assert: (_doc, _w) => {
      const result = renderMermaid(
        `kanban\n  Todo\n    t1[Dark task]\n  Done\n    t2[Completed]`,
        { format: 'svg', theme: 'dark-kanban' },
      );
      expect(result.svg).toBeDefined();
      expect(result.svg!.length).toBeGreaterThan(200);
    },
  },

  // 28. Columns have positive x positions in scene (side by side)
  {
    name: 'columns have increasing x positions (side-by-side)',
    text: `kanban
  Col1
    t1[A]
  Col2
    t2[B]`,
    assert: (_doc, _w, rendered) => {
      // Find all rect primitives and check column headers are at different x
      const rects = rendered.scene.primitives.filter((p) => p.kind === 'rect');
      const xs = rects.map((p) => (p as { x: number }).x);
      const uniqueXs = new Set(xs);
      // At least 2 distinct x positions
      expect(uniqueXs.size).toBeGreaterThanOrEqual(2);
    },
  },

  // 29. Column with id[label] syntax and cards
  {
    name: 'column with bracket syntax renders correctly',
    text: `kanban
  sprint1[Sprint 1]
    t1[Task Alpha]
    t2[Task Beta]`,
    assert: (doc, _w, rendered) => {
      expect(doc.columns[0]?.label).toBe('Sprint 1');
      const t = texts(rendered);
      expect(t).toContain('Sprint 1');
    },
  },

  // 30. Large board — 4 columns × 4 cards
  {
    name: 'large board 4×4 renders correctly',
    text: `kanban
  Backlog
    b1[Story 1]
    b2[Story 2]
    b3[Story 3]
    b4[Story 4]
  In Progress
    p1[Story 5]
    p2[Story 6]
    p3[Story 7]
    p4[Story 8]
  Review
    r1[Story 9]
    r2[Story 10]
    r3[Story 11]
    r4[Story 12]
  Done
    d1[Story 13]
    d2[Story 14]
    d3[Story 15]
    d4[Story 16]`,
    assert: (doc, _w, rendered) => {
      expect(doc.columns).toHaveLength(4);
      const totalCards = doc.columns.reduce((s, c) => s + c.cards.length, 0);
      expect(totalCards).toBe(16);
      expect(rendered.svg).toBeDefined();
      expect(rendered.scene.width).toBeGreaterThan(600);
    },
  },
];

// ---------------------------------------------------------------------------
// Run corpus tests
// ---------------------------------------------------------------------------

describe('mermaid-kanban-corpus', () => {
  it('detectDiagramType recognises kanban', () => {
    expect(detectDiagramType('kanban\n  Todo\n    t1[Task]')).toBe('kanban');
    expect(detectDiagramType('KANBAN\n  Todo\n    t1[Task]')).toBe('kanban');
  });

  for (const tc of KANBAN_CASES) {
    it(tc.name, () => {
      const normalised = tc.text.trim() || 'kanban';
      const { doc: rawDoc, warnings } = parseMermaid(normalised);
      const doc = rawDoc as KanbanDocument;

      // Schema validates
      kanbanDocumentSchema.parse(doc);

      // Render SVG
      const rendered = renderMermaid(normalised, { format: 'svg' });
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(10);

      if (tc.warningPattern) {
        expect(warnings.some((w) => tc.warningPattern!.test(w))).toBe(true);
      }

      tc.assert(doc, warnings, rendered);
    });
  }

  // ── Gallery emission ─────────────────────────────────────────────────────

  it('emits mermaid-kanban.svg to examples/gallery/', () => {
    const text = readFileSync(KANBAN_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('kanban');
    writeFileSync(KANBAN_SVG, result.svg!, 'utf8');
    expect(statSync(KANBAN_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-kanban.png to examples/gallery/', () => {
    const text = readFileSync(KANBAN_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(KANBAN_PNG, result.png!);
    expect(statSync(KANBAN_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts kanban gallery files exist and are non-empty', () => {
    expect(existsSync(KANBAN_SVG)).toBe(true);
    expect(existsSync(KANBAN_PNG)).toBe(true);
    expect(statSync(KANBAN_SVG).size).toBeGreaterThan(1000);
    expect(statSync(KANBAN_PNG).size).toBeGreaterThan(1000);
  });
});
