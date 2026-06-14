/**
 * @file test/mermaid-timeline-corpus.test.ts — Real-Mermaid timeline corpus validation.
 *
 * Crawl-derived acceptance tests for the Mermaid timeline parser.
 * Covers title parsing, sections→tracks, period→IRDate mapping,
 * events→milestones/activities, continuation lines, and gallery emit.
 *
 * Acceptance criteria:
 *   AC1  title directive → metadata.title
 *   AC2  section directive → one track per section
 *   AC3  Period labels → valid IRDates (year, year-month, sequential)
 *   AC4  Events → IR activities with correct span/start
 *   AC5  Continuation lines (: event) extend current period
 *   AC6  Period anchor milestones created per unique period
 *   AC7  Determinism: parse twice → identical JSON
 *   AC8  Gallery emit: render mermaid-timeline.mmd → .svg + .png
 *   AC9  Public warnings surface via parseMermaid.warnings[]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseTimeline, parseTimelineInternal } from '../src/frontend/mermaid/timeline.js';
import type { IRDocument } from '../src/types.js';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT    = resolve(__dirname, '..', '..', '..');
const GALLERY      = join(REPO_ROOT, 'examples', 'gallery');
const TIMELINE_MMD = join(GALLERY, 'mermaid-timeline.mmd');

// ---------------------------------------------------------------------------
// AC1 — title directive
// ---------------------------------------------------------------------------

describe('AC1 — title directive → metadata.title', () => {
  it('body title directive used', () => {
    const doc = parseTimeline(`timeline\n    title History of AI\n    2020 : GPT-3`);
    expect(doc.metadata.title).toBe('History of AI');
  });

  it('frontmatter title used when no body title', () => {
    const doc = parseTimeline(`---\ntitle: FM Title\n---\ntimeline\n    2020 : Event`);
    expect(doc.metadata.title).toBe('FM Title');
  });

  it('body title takes precedence? both title sources', () => {
    // Both present: frontmatter set first, body directive overrides
    const doc = parseTimeline(`---\ntitle: FM\n---\ntimeline\n    title Body\n    2020 : Event`);
    expect(doc.metadata.title).toBe('Body');
  });
});

// ---------------------------------------------------------------------------
// AC2 — sections → tracks
// ---------------------------------------------------------------------------

describe('AC2 — sections → IR tracks', () => {
  it('no section → single default track', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2020 : Event`);
    expect(doc.tracks).toHaveLength(1);
  });

  it('two sections → two tracks in declaration order', () => {
    const doc = parseTimeline(`timeline\n    title T\n    section Wave 1\n    2020 : E1\n    section Wave 2\n    2022 : E2`);
    expect(doc.tracks).toHaveLength(2);
    expect(doc.tracks[0]!.label).toBe('Wave 1');
    expect(doc.tracks[1]!.label).toBe('Wave 2');
  });

  it('section track id is sanitized', () => {
    const doc = parseTimeline(`timeline\n    title T\n    section Social Networks\n    2002 : LinkedIn`);
    expect(doc.tracks[0]!.id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});

// ---------------------------------------------------------------------------
// AC3 — Period labels → IRDates
// ---------------------------------------------------------------------------

describe('AC3 — period labels → valid IRDates', () => {
  it('4-digit year period → year IRDate as activity span', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : LinkedIn`);
    expect(doc.activities[0]!.span).toBe('2002');
  });

  it('year-month period → year-month span', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2024-03 : Event`);
    expect(doc.activities[0]!.span).toBe('2024-03');
  });

  it('ISO date period → start+end activities', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2024-03-01 : Launch`);
    expect(doc.activities[0]!.start).toBe('2024-03-01');
    expect(doc.activities[0]!.end).toBeDefined();
  });

  it('non-parseable period → sequential month fallback', () => {
    const doc = parseTimeline(`timeline\n    title T\n    Industrial Revolution : Steam engines`);
    // Should produce a valid IRDate
    expect(doc.activities[0]!.span).toMatch(/^\d{4}(-\d{2})?$/);
  });

  it('multiple year periods produce distinct span values', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : E1\n    2004 : E2\n    2006 : E3`);
    const spans = doc.activities.map(a => a.span);
    expect(spans).toContain('2002');
    expect(spans).toContain('2004');
    expect(spans).toContain('2006');
  });
});

// ---------------------------------------------------------------------------
// AC4 — Events → activities
// ---------------------------------------------------------------------------

describe('AC4 — events → IR activities', () => {
  it('single event → one activity', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2020 : GPT-3`);
    expect(doc.activities.filter(a => a.label === 'GPT-3')).toHaveLength(1);
  });

  it('multiple events on same line → multiple activities', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : LinkedIn : XING`);
    expect(doc.activities.filter(a => a.span === '2002')).toHaveLength(2);
  });

  it('activity label matches event text', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2004 : Facebook launched`);
    expect(doc.activities[0]!.label).toBe('Facebook launched');
  });

  it('activity assigned to current section track', () => {
    const doc = parseTimeline(`timeline\n    title T\n    section A\n    2020 : E1`);
    expect(doc.activities[0]!.track).toBe(doc.tracks[0]!.id);
  });
});

// ---------------------------------------------------------------------------
// AC5 — Continuation lines
// ---------------------------------------------------------------------------

describe('AC5 — continuation lines (: event) extend current period', () => {
  it('continuation without period label adds to current period', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : LinkedIn\n         : XING`);
    const events2002 = doc.activities.filter(a => a.span === '2002');
    expect(events2002).toHaveLength(2);
    expect(events2002.map(a => a.label)).toContain('XING');
  });

  it('three continuation lines all get same span', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2010 : E1\n         : E2\n         : E3`);
    expect(doc.activities.filter(a => a.span === '2010')).toHaveLength(3);
  });

  it('new period after continuation starts fresh period', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : E1\n         : E2\n    2004 : E3`);
    expect(doc.activities.find(a => a.label === 'E3')?.span).toBe('2004');
  });
});

// ---------------------------------------------------------------------------
// AC6 — Period anchor milestones
// ---------------------------------------------------------------------------

describe('AC6 — period anchor milestones', () => {
  it('each unique period produces one period milestone', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : E1\n    2004 : E2\n    2006 : E3`);
    expect(doc.milestones?.length).toBeGreaterThanOrEqual(3);
  });

  it('period milestone label matches period name', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : LinkedIn`);
    expect(doc.milestones?.some(m => m.label === '2002')).toBe(true);
  });

  it('period milestone date matches computed IRDate', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2002 : Event`);
    const periodM = doc.milestones?.find(m => m.label === '2002');
    expect(periodM?.date).toBe('2002');
  });
});

// ---------------------------------------------------------------------------
// AC7 — Determinism
// ---------------------------------------------------------------------------

describe('AC7 — determinism', () => {
  const SAMPLE = `timeline
    title History of Social Media
    section Early
        2002 : LinkedIn
             : XING
        2004 : Facebook
    section Modern
        2009 : WhatsApp
        2010 : Instagram`;

  it('parse twice → identical JSON', () => {
    expect(JSON.stringify(parseTimeline(SAMPLE))).toBe(JSON.stringify(parseTimeline(SAMPLE)));
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

describe('AC8 — gallery emit (mermaid-timeline.mmd → .svg + .png)', () => {
  it('mermaid-timeline.mmd exists in gallery', () => {
    expect(existsSync(TIMELINE_MMD)).toBe(true);
  });

  it('renders mermaid-timeline.mmd to SVG', () => {
    const text   = readFileSync(TIMELINE_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('timeline');
    expect(result.svg).toContain('<svg');
    writeFileSync(join(GALLERY, 'mermaid-timeline.svg'), result.svg!);
  });

  it('renders mermaid-timeline.mmd to PNG', () => {
    const text   = readFileSync(TIMELINE_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(1000);
    writeFileSync(join(GALLERY, 'mermaid-timeline.png'), result.png!);
  });
});

// ---------------------------------------------------------------------------
// AC9 — Public warnings
// ---------------------------------------------------------------------------

describe('AC9 — public warnings', () => {
  it('parseMermaid returns warnings array for timeline', () => {
    const result = parseMermaid(`timeline\n    title T\n    disableMulticolor on\n    2020 : E`);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('clean timeline → empty warnings', () => {
    const result = parseMermaid(`timeline\n    title T\n    2020 : Event`);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Complete patterns
// ---------------------------------------------------------------------------

describe('Complete patterns — real Mermaid crawl snippets', () => {
  it('official Mermaid history-of-social-media example', () => {
    const text = `timeline
    title History of Social Media Platform
    2002 : LinkedIn
    2004 : Facebook
         : Google
    2005 : Youtube
    2006 : Twitter`;
    const doc = parseTimeline(text);
    expect(doc.activities.length).toBeGreaterThanOrEqual(5);
    expect(doc.milestones?.length).toBeGreaterThanOrEqual(4);
  });

  it('sections with years: multiple tracks', () => {
    const text = `timeline
    title Product History
    section 2022
        Q1 : Planning
        Q2 : Alpha
    section 2023
        Q1 : Beta
        Q2 : GA`;
    const doc = parseTimeline(text);
    expect(doc.tracks).toHaveLength(2);
  });

  it('theme from frontmatter', () => {
    const doc = parseTimeline(`---\ntheme: ai-timeline\n---\ntimeline\n    title T\n    2024 : Event`);
    expect(doc.metadata.theme).toBe('ai-timeline');
  });

  it('time_range computed from period dates', () => {
    const doc = parseTimeline(`timeline\n    title T\n    2000 : E1\n    2010 : E2`);
    expect(doc.metadata.time_range.start).toMatch(/^2000/);
    expect(doc.metadata.time_range.end).toMatch(/^2010/);
  });
});
