import { describe, it, expect } from 'vitest';
import { timeline, parseMermaidStrict } from '../src/diagrams/mermaid/timeline/index.js';

// ─── Layer 1: Mermaid-compatible ──────────────────────────────────────────────

describe('timeline grammar — mermaid-compatible (strict)', () => {
  const parse = parseMermaidStrict;

  it('parses minimal timeline', () => {
    const doc = parse(`timeline\n    2025 : Project started\n`);
    expect(doc.version).toBe('1.0');
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0]!.label).toBe('Project started');
  });

  it('parses title directive', () => {
    const doc = parse(`timeline\n    title My Project\n    2025 : Start\n`);
    expect(doc.metadata.title).toBe('My Project');
  });

  it('parses sections with events', () => {
    const doc = parse(`timeline\n    section 2002-2006\n        2002 : LinkedIn\n        2004 : Facebook\n    section 2007-2010\n        2010 : Instagram\n`);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections![0]!.label).toBe('2002-2006');
    expect(doc.activities).toHaveLength(3);
  });

  it('parses multi-word event text', () => {
    const doc = parse(`timeline\n    2025-Q1 : First quarterly review complete\n`);
    expect(doc.activities[0]!.label).toBe('First quarterly review complete');
  });

  it('handles comments', () => {
    const doc = parse(`timeline\n    %% comment\n    2025 : Alpha\n    2026 : Beta\n`);
    expect(doc.activities).toHaveLength(2);
  });

  it('handles blank lines', () => {
    const doc = parse(`timeline\n\n    2025 : Start\n\n    2026 : End\n`);
    expect(doc.activities).toHaveLength(2);
  });

  it('rejects frontmatter in strict mode', () => {
    expect(() => parse(`---\ntheme: dark\n---\ntimeline\n    2025 : Start\n`)).toThrow();
  });

  it('rejects layout directive in strict mode', () => {
    expect(() => parse(`timeline\n    layout vertical-spine\n    2025 : Start\n`)).toThrow();
  });

  it('rejects date ranges in strict mode', () => {
    expect(() => parse(`timeline\n    2025-Q1 -- 2025-Q2 : Design : active\n`)).toThrow();
  });

  it('milestone keyword is just label text in strict mode', () => {
    const doc = parse(`timeline\n    2025-01 : Kickoff : milestone\n`);
    expect(doc.milestones).toHaveLength(0);
    expect(doc.activities[0]!.label).toContain('milestone');
  });
});

// ─── Layer 2: Triton extensions ───────────────────────────────────────────────

describe('timeline grammar — triton extensions', () => {
  const parse = (input: string) => timeline.parseMermaid(input);

  it('parses layout directive', () => {
    const doc = parse(`timeline\n    layout vertical-spine\n    2025-01 : Start : milestone\n`);
    expect(doc.layout).toBe('vertical-spine');
  });

  it('defaults layout to horizontal', () => {
    const doc = parse(`timeline\n    2025-01 : Start : milestone\n`);
    expect(doc.layout).toBe('horizontal');
  });

  it('parses frontmatter', () => {
    const doc = parse(`---\nauthor: Team\ntheme: dark\n---\ntimeline\n    2025-01 : Start : milestone\n`);
    expect(doc.metadata['author']).toBe('Team');
  });

  it('parses milestone keyword', () => {
    const doc = parse(`timeline\n    2025-01 : Kickoff : milestone\n`);
    expect(doc.milestones).toHaveLength(1);
    expect(doc.milestones[0]!.label).toBe('Kickoff');
    expect(doc.milestones[0]!.date).toBe('2025-01');
  });

  it('parses date range with status', () => {
    const doc = parse(`timeline\n    2025-Q1 -- 2025-Q2 : Design Phase : active\n`);
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0]!.start).toBe('2025-Q1');
    expect(doc.activities[0]!.end).toBe('2025-Q2');
    expect(doc.activities[0]!.status).toBe('active');
  });

  it('parses track assignment with @', () => {
    const doc = parse(`timeline\n    2025-Q1 -- 2025-Q2 : Design : active @design-team\n`);
    expect(doc.activities[0]!.track).toBe('design-team');
    expect(doc.tracks.some(t => t.id === 'design-team')).toBe(true);
  });

  it('parses point activity with status', () => {
    const doc = parse(`timeline\n    2025-03 : Sprint done : done\n`);
    expect(doc.activities[0]!.status).toBe('done');
  });

  it('generates slugified IDs', () => {
    const doc = parse(`timeline\n    2025-01 : Alpha Release : milestone\n    2025-06 : Beta Release : milestone\n`);
    expect(doc.milestones[0]!.id).toBe('alpha-release');
    expect(doc.milestones[1]!.id).toBe('beta-release');
  });

  it('parses sections with extension entries', () => {
    const doc = parse(`timeline\n    section Phase 1\n        2025-01 : Kickoff : milestone\n        2025-Q1 -- 2025-Q2 : Design : active @platform\n`);
    expect(doc.sections).toHaveLength(1);
    expect(doc.milestones).toHaveLength(1);
    expect(doc.activities).toHaveLength(1);
  });

  it('parses full complex timeline', () => {
    const doc = parse(`---\ntheme: dark\n---\ntimeline\n    title Engineering Roadmap 2025\n    layout horizontal\n    section Q1\n        2025-01 : Kickoff : milestone\n        2025-01 -- 2025-03 : Foundation : active @platform\n    section Q2\n        2025-04 -- 2025-06 : Feature Sprint : active @product\n        2025-06 : MVP : milestone\n`);
    expect(doc.metadata.title).toBe('Engineering Roadmap 2025');
    expect(doc.layout).toBe('horizontal');
    expect(doc.milestones).toHaveLength(2);
    expect(doc.activities).toHaveLength(2);
  });
});
