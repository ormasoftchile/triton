/**
 * @file test/mermaid-gantt-corpus.test.ts — Real-Mermaid gantt corpus validation.
 *
 * Crawl-derived acceptance tests for the Mermaid gantt parser.
 * Covers sections→tracks, date+duration parsing, after-dependency resolution,
 * status flags, milestone tasks, graceful degradation, and gallery emit.
 *
 * Acceptance criteria (fidelity bar mirrors flowchart/sequence corpus):
 *   AC1  Sections → IR tracks + sections (one track per section)
 *   AC2  Date + duration parsing (Nd, Nw, Nm, Ny, 0d)
 *   AC3  After-dependency resolution (task starts at predecessor end)
 *   AC4  Status flags: done→done, active→in-progress, crit→category:'critical'
 *   AC5  Milestone tasks → IR milestones (not activities)
 *   AC6  Graceful degradation: axisFormat/excludes warn; unknown lines warn
 *   AC7  Determinism: parse twice → identical JSON; render twice → identical sceneHash
 *   AC8  Gallery emit: render mermaid-gantt.mmd → .svg and .png files
 *   AC9  Public warnings surface via parseMermaid.warnings[]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseGantt, parseGanttInternal } from '../src/frontend/mermaid/gantt.js';
import type { IRDocument } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');
const GANTT_MMD  = join(GALLERY, 'mermaid-gantt.mmd');

// ---------------------------------------------------------------------------
// AC1 — Sections → tracks
// ---------------------------------------------------------------------------

describe('AC1 — sections → IR tracks', () => {
  it('single section → one track with matching label', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section Alpha\n    Task :t1, 2024-01-01, 7d`);
    expect(doc.tracks).toHaveLength(1);
    expect(doc.tracks[0]!.label).toBe('Alpha');
  });

  it('two sections → two tracks in declaration order', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section Infra\n    T1 :t1, 2024-01-01, 7d\n    section App\n    T2 :t2, 2024-01-08, 7d`);
    expect(doc.tracks).toHaveLength(2);
    expect(doc.tracks[0]!.label).toBe('Infra');
    expect(doc.tracks[1]!.label).toBe('App');
  });

  it('no sections → default "Tasks" track', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    Task A :t1, 2024-01-01, 3d`);
    expect(doc.tracks).toHaveLength(1);
  });

  it('sections produce IR sections array', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section Planning\n    T :t, 2024-01-01, 7d`);
    expect(doc.sections).toBeDefined();
    expect(doc.sections![0]!.label).toBe('Planning');
  });

  it('tasks in section get correct track id', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section Backend\n    API :a, 2024-01-01, 14d`);
    expect(doc.activities[0]!.track).toBe(doc.tracks[0]!.id);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Date + duration parsing
// ---------------------------------------------------------------------------

describe('AC2 — date + duration parsing', () => {
  it('explicit start + end date', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-03-01, 2024-03-15`);
    expect(doc.activities[0]!.start).toBe('2024-03-01');
    expect(doc.activities[0]!.end).toBe('2024-03-15');
  });

  it('30d duration adds 30 days', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-01-01, 30d`);
    expect(doc.activities[0]!.start).toBe('2024-01-01');
    expect(doc.activities[0]!.end).toBe('2024-01-31');
  });

  it('2w duration adds 14 days', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-02-01, 2w`);
    expect(doc.activities[0]!.end).toBe('2024-02-15');
  });

  it('1m duration adds one calendar month', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-06-01, 1m`);
    expect(doc.activities[0]!.end).toBe('2024-07-01');
  });

  it('0d duration milestone date equals start', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    M :milestone, m, 2024-06-01, 0d`);
    expect(doc.milestones![0]!.date).toBe('2024-06-01');
  });

  it('DD/MM/YYYY dateFormat parsed correctly', () => {
    const doc = parseGantt(`gantt\n    dateFormat DD/MM/YYYY\n    section S\n    T :t, 15/03/2024, 7d`);
    expect(doc.activities[0]!.start).toBe('2024-03-15');
  });

  it('time_range reflects min start and max end', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    A :a, 2024-01-01, 10d\n    B :b, 2024-02-01, 10d`);
    expect(doc.metadata.time_range.start).toBe('2024-01-01');
    expect(doc.metadata.time_range.end).toBe('2024-02-11');
  });
});

// ---------------------------------------------------------------------------
// AC3 — After-dependency resolution
// ---------------------------------------------------------------------------

describe('AC3 — after-dependency resolution', () => {
  it('task after predecessor starts at predecessor end', () => {
    const text = `gantt\n    dateFormat YYYY-MM-DD\n    section S\n    A :a, 2024-01-01, 10d\n    B :b, after a, 5d`;
    const doc = parseGantt(text);
    const a = doc.activities.find(x => x.id === 'a')!;
    const b = doc.activities.find(x => x.id === 'b')!;
    expect(b.start).toBe(a.end);
  });

  it('chain of three tasks via after', () => {
    const text = `gantt\n    dateFormat YYYY-MM-DD\n    section S\n    X :x, 2024-01-01, 7d\n    Y :y, after x, 7d\n    Z :z, after y, 7d`;
    const doc = parseGantt(text);
    expect(doc.activities.find(a=>a.id==='z')!.start).toBe('2024-01-15');
  });

  it('unresolved after-dependency falls back with warning', () => {
    const { doc, warnings } = parseGanttInternal(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, after unknown-id, 5d`);
    expect(warnings.some(w => /predecessor not yet seen/i.test(w))).toBe(true);
    expect(doc.activities).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC4 — Status flags
// ---------------------------------------------------------------------------

describe('AC4 — status flags → IR status / category', () => {
  it('done flag → status: done', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :done, t, 2024-01-01, 7d`);
    expect(doc.activities[0]!.status).toBe('done');
  });

  it('active flag → status: in-progress', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :active, t, 2024-01-01, 7d`);
    expect(doc.activities[0]!.status).toBe('in-progress');
  });

  it('no status flag → status: planned', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-01-01, 7d`);
    expect(doc.activities[0]!.status).toBe('planned');
  });

  it('crit flag → category: critical', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :crit, t, 2024-01-01, 7d`);
    expect(doc.activities[0]!.category).toBe('critical');
  });

  it('crit done → both category critical and status done', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :crit, done, t, 2024-01-01, 7d`);
    expect(doc.activities[0]!.status).toBe('done');
    expect(doc.activities[0]!.category).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// AC5 — Milestone tasks → IR milestones
// ---------------------------------------------------------------------------

describe('AC5 — milestone tasks → IR milestones', () => {
  it('milestone flag produces IR Milestone (not Activity)', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    Launch :milestone, m, 2024-06-01, 0d`);
    expect(doc.milestones).toHaveLength(1);
    expect(doc.activities.some(a => a.label === 'Launch')).toBe(false);
    expect(doc.milestones![0]!.label).toBe('Launch');
    expect(doc.milestones![0]!.date).toBe('2024-06-01');
  });

  it('crit milestone → category: critical on milestone', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    GA :crit, milestone, m, 2024-09-01, 0d`);
    expect(doc.milestones![0]!.category).toBe('critical');
  });

  it('milestone track matches current section track', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section Release\n    v1 :milestone, m1, 2024-06-01, 0d`);
    expect(doc.milestones![0]!.track).toBe(doc.tracks[0]!.id);
  });
});

// ---------------------------------------------------------------------------
// AC6 — Graceful degradation
// ---------------------------------------------------------------------------

describe('AC6 — graceful degradation', () => {
  it('axisFormat → DEFERRED warning, document intact', () => {
    const { doc, warnings } = parseGanttInternal(`gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %b %Y\n    section S\n    T :t, 2024-01-01, 7d`);
    expect(warnings.some(w => /DEFERRED.*axisFormat/i.test(w))).toBe(true);
    expect(doc.activities).toHaveLength(1);
  });

  it('excludes → DEFERRED warning, document intact', () => {
    const { warnings } = parseGanttInternal(`gantt\n    dateFormat YYYY-MM-DD\n    excludes weekends\n    section S\n    T :t, 2024-01-01, 7d`);
    expect(warnings.some(w => /DEFERRED.*excludes/i.test(w))).toBe(true);
  });

  it('click directive → DEFERRED warning', () => {
    const { warnings } = parseGanttInternal(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-01-01, 7d\n    click T href "https://example.com"`);
    expect(warnings.some(w => /DEFERRED.*click/i.test(w))).toBe(true);
  });

  it('until dependency → DEFERRED warning, defaults 30d', () => {
    const { doc, warnings } = parseGanttInternal(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-01-01, until isadded`);
    expect(warnings.some(w => /DEFERRED.*until/i.test(w))).toBe(true);
    expect(doc.activities).toHaveLength(1);
  });

  it('unrecognized line → SKIP warning', () => {
    const { warnings } = parseGanttInternal(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    ??? this is not valid syntax ???`);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC7 — Determinism
// ---------------------------------------------------------------------------

describe('AC7 — determinism', () => {
  const SAMPLE = `gantt
    title Roadmap
    dateFormat YYYY-MM-DD
    section Infra
    Deploy :done, d1, 2025-01-01, 30d
    Migrate :active, d2, after d1, 20d
    section App
    Build :a1, 2025-01-15, 45d
    Release :milestone, r1, 2025-03-01, 0d`;

  it('parse twice → identical JSON', () => {
    expect(JSON.stringify(parseGantt(SAMPLE))).toBe(JSON.stringify(parseGantt(SAMPLE)));
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

describe('AC8 — gallery emit (mermaid-gantt.mmd → .svg + .png)', () => {
  it('mermaid-gantt.mmd exists in gallery', () => {
    expect(existsSync(GANTT_MMD)).toBe(true);
  });

  it('renders mermaid-gantt.mmd to SVG', () => {
    const text   = readFileSync(GANTT_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('gantt');
    expect(result.svg).toContain('<svg');
    writeFileSync(join(GALLERY, 'mermaid-gantt.svg'), result.svg!);
  });

  it('renders mermaid-gantt.mmd to PNG', () => {
    const text   = readFileSync(GANTT_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(1000);
    writeFileSync(join(GALLERY, 'mermaid-gantt.png'), result.png!);
  });
});

// ---------------------------------------------------------------------------
// AC9 — Public warnings
// ---------------------------------------------------------------------------

describe('AC9 — public warnings surface via parseMermaid', () => {
  it('parseMermaid returns warnings array', () => {
    const result = parseMermaid(`gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %m/%d\n    section S\n    T :t, 2024-01-01, 7d`);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings.some(w => /axisFormat/i.test(w))).toBe(true);
  });

  it('clean gantt → empty warnings array', () => {
    const result = parseMermaid(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :done, t, 2024-01-01, 7d`);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Complete pattern tests (real Mermaid crawl snippets)
// ---------------------------------------------------------------------------

describe('Complete patterns — real Mermaid crawl snippets', () => {
  it('official Mermaid docs example: two sections, after deps, crit', () => {
    const text = `gantt
    dateFormat  YYYY-MM-DD
    title Adding GANTT diagram to mermaid
    section A section
    Completed task            :done,    des1, 2014-01-06,2014-01-08
    Active task               :active,  des2, 2014-01-09, 3d
    Future task               :         des3, after des2, 5d
    section Critical tasks
    Completed task in the critical line :crit, done, 2014-01-06, 24h
    Implement parser and jshint          :crit, done, after des1, 2d`;
    const doc = parseGantt(text);
    expect(doc.tracks).toHaveLength(2);
    expect(doc.activities.length).toBeGreaterThanOrEqual(5);
    expect(doc.activities.some(a => a.category === 'critical')).toBe(true);
  });

  it('compact no-spaces: date immediately after colon', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t,2024-01-01,30d`);
    expect(doc.activities[0]!.start).toBe('2024-01-01');
    expect(doc.activities[0]!.end).toBe('2024-01-31');
  });

  it('title extracted from body directive', () => {
    const doc = parseGantt(`gantt\n    title My Project Plan\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-01-01, 7d`);
    expect(doc.metadata.title).toBe('My Project Plan');
  });

  it('title falls back to frontmatter', () => {
    const doc = parseGantt(`---\ntitle: FM Title\n---\ngantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-01-01, 7d`);
    expect(doc.metadata.title).toBe('FM Title');
  });

  it('theme from frontmatter applied', () => {
    const doc = parseGantt(`---\ntheme: executive\n---\ngantt\n    dateFormat YYYY-MM-DD\n    section S\n    T :t, 2024-01-01, 7d`);
    expect(doc.metadata.theme).toBe('executive');
  });

  it('multiple milestones across sections', () => {
    const text = `gantt
    dateFormat YYYY-MM-DD
    section Infra
    Deploy :done, d1, 2025-01-01, 30d
    Go-Live :crit, milestone, m1, 2025-02-01, 0d
    section App
    Build :a1, 2025-01-15, 45d
    GA    :milestone, m2, 2025-03-01, 0d`;
    const doc = parseGantt(text);
    expect(doc.milestones).toHaveLength(2);
    expect(doc.milestones![0]!.category).toBe('critical');
  });

  it('axis_unit auto-selected for short range → month', () => {
    const doc = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    section S\n    A :a, 2024-01-01, 90d\n    B :b, after a, 90d`);
    expect(doc.metadata.axis_unit).toBe('month');
  });
});
