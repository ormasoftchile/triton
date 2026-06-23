/**
 * Timeline grammar tests — two-layer validation.
 *
 * Layer 1 (Mermaid-compatible): proves we parse standard Mermaid timeline syntax.
 * Layer 2 (Triton extensions): proves our superset additions work correctly.
 *
 * The distinction is enforced by `parseMermaidStrict()` which rejects extension
 * syntax — if a test in Layer 1 uses strict mode and passes, we KNOW it's valid Mermaid.
 */
import { describe, it, expect } from 'vitest';
import { timeline, parseMermaidStrict } from '../src/diagrams/timeline/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1: Mermaid-compatible — standard syntax only
// ═══════════════════════════════════════════════════════════════════════════════

describe('timeline grammar — mermaid-compatible (strict mode)', () => {
  const parse = parseMermaidStrict;

  it('parses minimal timeline with one event', () => {
    const doc = parse(`timeline\n    2025 : Project started\n`);
    expect(doc.version).toBe('1.0');
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0].label).toBe('Project started');
  });

  it('parses title directive', () => {
    const doc = parse(`timeline\n    title My Project\n    2025 : Start\n`);
    expect(doc.metadata.title).toBe('My Project');
  });

  it('parses sections with events', () => {
    const doc = parse(`timeline
    title History of Social Media
    section 2002-2006
        2002 : LinkedIn
        2004 : Facebook
        2006 : Twitter
    section 2007-2010
        2010 : Instagram
`);
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections![0].label).toBe('2002-2006');
    expect(doc.sections![1].label).toBe('2007-2010');
    expect(doc.activities).toHaveLength(4);
    expect(doc.activities[0].label).toBe('LinkedIn');
    expect(doc.activities[2].label).toBe('Twitter');
  });

  it('parses multi-word event text', () => {
    const doc = parse(`timeline\n    2025-Q1 : First quarterly review complete\n`);
    expect(doc.activities[0].label).toBe('First quarterly review complete');
  });

  it('handles comments between entries', () => {
    const doc = parse(`timeline
    %% This is a comment
    2025 : Alpha
    %% Another comment
    2026 : Beta
`);
    expect(doc.activities).toHaveLength(2);
  });

  it('handles blank lines', () => {
    const doc = parse(`timeline

    2025 : Start

    2026 : End
`);
    expect(doc.activities).toHaveLength(2);
  });

  it('rejects frontmatter in strict mode', () => {
    expect(() => parse(`---\ntheme: dark\n---\ntimeline\n    2025 : Start\n`))
      .toThrow();
  });

  it('rejects layout directive in strict mode', () => {
    expect(() => parse(`timeline\n    layout vertical-spine\n    2025 : Start\n`))
      .toThrow();
  });

  it('rejects date ranges in strict mode', () => {
    expect(() => parse(`timeline\n    2025-Q1 -- 2025-Q2 : Design : active\n`))
      .toThrow();
  });

  it('milestone keyword has no special meaning in strict mode', () => {
    const doc = parse(`timeline\n    2025-01 : Kickoff : milestone\n`);
    // In strict mode, ': milestone' is just part of the label text
    expect(doc.milestones).toHaveLength(0);
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0].label).toContain('milestone');
  });

  it('track assignment has no special meaning in strict mode', () => {
    const doc = parse(`timeline\n    2025 : Design : active @team\n`);
    // In strict mode, ': active @team' is just label text
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0].label).toContain('@team');
    expect(doc.activities[0].track).toBe('default');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2: Triton extensions — superset features
// ═══════════════════════════════════════════════════════════════════════════════

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
    expect(doc.metadata.author).toBe('Team');
    expect(doc.metadata.theme).toBe('dark');
  });

  it('parses milestone keyword', () => {
    const doc = parse(`timeline\n    2025-01 : Kickoff : milestone\n`);
    expect(doc.milestones).toHaveLength(1);
    expect(doc.milestones[0].label).toBe('Kickoff');
    expect(doc.milestones[0].date).toBe('2025-01');
  });

  it('parses activities with date ranges', () => {
    const doc = parse(`timeline\n    2025-Q1 -- 2025-Q2 : Design Phase : active\n`);
    expect(doc.activities).toHaveLength(1);
    expect(doc.activities[0].start).toBe('2025-Q1');
    expect(doc.activities[0].end).toBe('2025-Q2');
    expect(doc.activities[0].status).toBe('active');
  });

  it('parses track assignments with @', () => {
    const doc = parse(`timeline
    2025-Q1 -- 2025-Q2 : Design : active @design-team
    2025-Q2 -- 2025-Q3 : Build @engineering
`);
    expect(doc.activities[0].track).toBe('design-team');
    expect(doc.activities[1].track).toBe('engineering');
    expect(doc.tracks).toHaveLength(2);
  });

  it('parses point activities with status', () => {
    const doc = parse(`timeline\n    2025-03 : Sprint done : done\n`);
    expect(doc.activities[0].status).toBe('done');
  });

  it('generates slugified IDs from labels', () => {
    const doc = parse(`timeline\n    2025-01 : Alpha Release : milestone\n    2025-06 : Beta Release : milestone\n`);
    expect(doc.milestones[0].id).toBe('alpha-release');
    expect(doc.milestones[1].id).toBe('beta-release');
  });

  it('handles sections with extension entries', () => {
    const doc = parse(`timeline
    section Phase 1
        2025-01 : Kickoff : milestone
        2025-Q1 -- 2025-Q2 : Design : active @platform
    section Phase 2
        2025-Q3 -- 2025-Q4 : Implementation
        2025-09 : Launch : milestone
`);
    expect(doc.sections).toHaveLength(2);
    expect(doc.milestones).toHaveLength(2);
    expect(doc.activities).toHaveLength(2);
  });

  it('parses full complex timeline', () => {
    const doc = parse(`---
theme: dark
---
timeline
    title Engineering Roadmap 2025
    layout horizontal

    section Q1
        2025-01 : Kickoff : milestone
        2025-01 -- 2025-03 : Foundation : active @platform
    section Q2
        2025-04 -- 2025-06 : Feature Sprint : active @product
        2025-06 : MVP : milestone
    section Q3-Q4
        2025-07 -- 2025-12 : Scale and Harden @sre
        2025-09 : GA Launch : milestone
`);
    expect(doc.metadata.title).toBe('Engineering Roadmap 2025');
    expect(doc.metadata.theme).toBe('dark');
    expect(doc.layout).toBe('horizontal');
    expect(doc.sections).toHaveLength(3);
    expect(doc.milestones).toHaveLength(3);
    expect(doc.activities).toHaveLength(3);
    expect(doc.tracks.length).toBeGreaterThanOrEqual(2);
  });

  it('mermaid-compatible syntax still works in extension mode', () => {
    // Prove that Layer 1 is a SUBSET — everything valid in strict is valid here
    const doc = parse(`timeline
    title History
    section Ancient
        3000BC : Writing invented
        500BC : Democracy
    section Modern
        1969 : Moon landing
`);
    expect(doc.activities).toHaveLength(3);
    expect(doc.sections).toHaveLength(2);
    expect(doc.metadata.title).toBe('History');
  });
});
