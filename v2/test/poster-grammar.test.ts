/**
 * Poster grammar tests — validates the Triton-original composition syntax.
 *
 * Poster is NOT a Mermaid type — it's a Triton original. No "strict mode" needed.
 * The grammar parses structure, then the module delegates inner content to sub-parsers.
 */
import { describe, it, expect } from 'vitest';
import { poster } from '../src/diagrams/poster/index.js';
import type { PosterDocument } from '../src/diagrams/poster/ir.js';

describe('poster grammar', () => {
  it('parses minimal poster with a text cell', () => {
    const doc = poster.parseMermaid(`poster "Hello"
    columns 1

    cell :: text
        Hello world.
    end
`);
    expect(doc.version).toBe('1.0');
    expect(doc.metadata.title).toBe('Hello');
    expect(doc.grid.columns).toBe(1);
    expect(doc.cells).toHaveLength(1);
    expect(doc.cells[0].content.kind).toBe('text');
    if (doc.cells[0].content.kind === 'text') {
      expect(doc.cells[0].content.text).toBe('Hello world.');
    }
  });

  it('parses poster title', () => {
    const doc = poster.parseMermaid(`poster "Architecture Overview"
    columns 2

    cell :: text
        placeholder
    end
`);
    expect(doc.metadata.title).toBe('Architecture Overview');
  });

  it('parses columns directive', () => {
    const doc = poster.parseMermaid(`poster "Grid"
    columns 3

    cell :: text
        a
    end
`);
    expect(doc.grid.columns).toBe(3);
  });

  it('parses stat cells', () => {
    const doc = poster.parseMermaid(`poster "Metrics"
    columns 2

    cell "Uptime" :: stat
        99.9% | System Uptime
    end
`);
    expect(doc.cells).toHaveLength(1);
    expect(doc.cells[0].title).toBe('Uptime');
    const content = doc.cells[0].content;
    expect(content.kind).toBe('stat');
    if (content.kind === 'stat') {
      expect(content.value).toBe('99.9%');
      expect(content.label).toBe('System Uptime');
    }
  });

  it('parses cell with flow content (delegates to flowchart parser)', () => {
    const doc = poster.parseMermaid(`poster "Pipeline"
    columns 1

    cell "CI/CD" :: flow
        flowchart LR
            Build --> Test --> Deploy
    end
`);
    expect(doc.cells).toHaveLength(1);
    expect(doc.cells[0].title).toBe('CI/CD');
    const content = doc.cells[0].content;
    expect(content.kind).toBe('flow');
    if (content.kind === 'flow') {
      expect(content.doc.nodes.length).toBeGreaterThanOrEqual(3);
      expect(content.doc.edges.length).toBeGreaterThanOrEqual(2);
      expect(content.doc.direction).toBe('LR');
    }
  });

  it('parses cell with timeline content (delegates to timeline parser)', () => {
    const doc = poster.parseMermaid(`poster "Roadmap"
    columns 1

    cell "Schedule" :: timeline
        timeline
            title Q1 Goals
            2025-01 : Kickoff : milestone
            2025-01 -- 2025-03 : Design : active
    end
`);
    expect(doc.cells).toHaveLength(1);
    const content = doc.cells[0].content;
    expect(content.kind).toBe('timeline');
    if (content.kind === 'timeline') {
      expect(content.doc.milestones).toHaveLength(1);
      expect(content.doc.activities).toHaveLength(1);
      expect(content.doc.metadata.title).toBe('Q1 Goals');
    }
  });

  it('parses multiple cells', () => {
    const doc = poster.parseMermaid(`poster "Dashboard"
    columns 2

    cell "Pipeline" :: flow
        flowchart LR
            A --> B
    end

    cell "Stats" :: stat
        42 | Deployments
    end

    cell "Notes" :: text
        Everything looks good.
    end
`);
    expect(doc.cells).toHaveLength(3);
    expect(doc.cells[0].content.kind).toBe('flow');
    expect(doc.cells[1].content.kind).toBe('stat');
    expect(doc.cells[2].content.kind).toBe('text');
  });

  it('parses poster without title', () => {
    const doc = poster.parseMermaid(`poster
    columns 1

    cell :: text
        No title poster.
    end
`);
    expect(doc.metadata.title).toBeUndefined();
  });

  it('parses cell without title', () => {
    const doc = poster.parseMermaid(`poster "Test"
    columns 1

    cell :: text
        Anonymous cell.
    end
`);
    expect(doc.cells[0].title).toBeUndefined();
  });

  it('parses frontmatter', () => {
    const doc = poster.parseMermaid(`---
theme: dark
author: Team
---
poster "Overview"
    columns 2

    cell :: text
        Content here.
    end
`);
    expect(doc.metadata.theme).toBe('dark');
    expect(doc.metadata.author).toBe('Team');
  });

  it('handles comments in cell list', () => {
    const doc = poster.parseMermaid(`poster "Test"
    columns 1
    %% this is a comment

    cell :: text
        Hello.
    end
    %% another comment
`);
    expect(doc.cells).toHaveLength(1);
  });

  it('full composition: flow + timeline + stat + text', () => {
    const doc = poster.parseMermaid(`---
theme: corporate
---
poster "Engineering Dashboard"
    columns 2

    cell "CI/CD Pipeline" :: flow
        flowchart LR
            Build --> Test --> Deploy
    end

    cell "Roadmap" :: timeline
        timeline
            title 2025 Plan
            section Q1
                2025-01 : Kickoff : milestone
                2025-01 -- 2025-03 : Foundation : active
            section Q2
                2025-04 -- 2025-06 : Features
                2025-06 : MVP : milestone
    end

    cell "Uptime" :: stat
        99.99% | System Availability
    end

    cell "Status" :: text
        All systems operational. Next maintenance window: 2025-07-01.
    end
`);
    expect(doc.metadata.title).toBe('Engineering Dashboard');
    expect(doc.metadata.theme).toBe('corporate');
    expect(doc.grid.columns).toBe(2);
    expect(doc.cells).toHaveLength(4);

    // Flow cell
    const flow = doc.cells[0].content;
    expect(flow.kind).toBe('flow');
    if (flow.kind === 'flow') {
      expect(flow.doc.nodes.length).toBe(3);
    }

    // Timeline cell
    const tl = doc.cells[1].content;
    expect(tl.kind).toBe('timeline');
    if (tl.kind === 'timeline') {
      expect(tl.doc.milestones).toHaveLength(2);
      expect(tl.doc.activities).toHaveLength(2);
      expect(tl.doc.sections).toHaveLength(2);
    }

    // Stat cell
    const stat = doc.cells[2].content;
    expect(stat.kind).toBe('stat');
    if (stat.kind === 'stat') {
      expect(stat.value).toBe('99.99%');
      expect(stat.label).toBe('System Availability');
    }

    // Text cell
    const text = doc.cells[3].content;
    expect(text.kind).toBe('text');
    if (text.kind === 'text') {
      expect(text.text).toContain('All systems operational');
    }
  });
});
