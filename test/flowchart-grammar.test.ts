import { describe, it, expect } from 'vitest';
import { parse } from '../src/diagrams/mermaid/flowchart/parser.js';

describe('flowchart grammar', () => {
  it('parses basic flowchart', () => {
    const r = parse(`flowchart TD\nA[Start] --> B{Decision}\nB -->|Yes| C[OK]\nB -->|No| D[Fail]\n`);
    expect(r.flow.nodes).toHaveLength(4);
    expect(r.flow.edges).toHaveLength(3);
    expect(r.direction).toBe('TD');
  });

  it('parses graph keyword as alias for flowchart', () => {
    const r = parse(`graph LR\nA --> B\n`);
    expect(r.direction).toBe('LR');
  });

  it('parses chain edges: A --> B --> C', () => {
    const r = parse(`flowchart LR\nA[Input] --> B[Process] --> C[Output]\n`);
    expect(r.flow.edges).toHaveLength(2);
    expect(r.flow.nodes).toHaveLength(3);
  });

  it('handles dotted edges -.->', () => {
    const r = parse(`flowchart TD\nA -.-> B\n`);
    expect(r.flow.edges[0]!.style).toBe('dotted');
    expect(r.flow.edges[0]!.kind).toBe('async');
  });

  it('parses all node shapes', () => {
    const r = parse(`flowchart LR\nA[Rect]\nB(Rounded)\nC((Circle))\nD{Diamond}\nE([Stadium])\nF[[Sub]]\n`);
    expect(r.flow.nodes).toHaveLength(6);
    const shapes = r.flow.nodes.map((n: any) => n.shape);
    expect(shapes).toContain('rect');
    expect(shapes).toContain('rounded-rect');
    expect(shapes).toContain('circle');
    expect(shapes).toContain('diamond');
    expect(shapes).toContain('stadium');
    expect(shapes).toContain('subroutine');
  });

  it('parses edge label |text|', () => {
    const r = parse(`flowchart TD\nA -->|pass| B\n`);
    expect(r.flow.edges[0]!.label).toBe('pass');
  });

  it('skips comments', () => {
    const r = parse(`flowchart LR\n%% This is a comment\nA --> B\n%% Another\nB --> C\n`);
    expect(r.flow.edges).toHaveLength(2);
  });

  it('parses frontmatter', () => {
    const r = parse(`---\ntitle: My Flow\ntheme: dark\n---\nflowchart TD\nA --> B\n`);
    expect(r.metadata.title).toBe('My Flow');
    expect(r.metadata.theme).toBe('dark');
  });

  it('parses subgraph', () => {
    const r = parse(`flowchart TD\nsubgraph api Backend\n  A[Server] --> B[DB]\nend\nC[Client] --> A\n`);
    expect(r.flow.edges).toHaveLength(2);
  });

  it('handles bidirectional edges <-->', () => {
    const r = parse(`flowchart LR\nA <--> B\n`);
    expect(r.flow.edges).toHaveLength(1);
  });

  it('strips quotes from node labels', () => {
    const r = parse(`flowchart TD\nA["Hello World"] --> B["Goodbye"]\n`);
    expect(r.flow.nodes[0]!.label).toBe('Hello World');
  });

  it('parses long chain', () => {
    const r = parse(`flowchart LR\nA --> B --> C --> D --> E --> F\n`);
    expect(r.flow.edges).toHaveLength(5);
    expect(r.flow.nodes).toHaveLength(6);
  });

  it('parses 200-edge graph under 50ms', () => {
    const lines = ['flowchart LR'];
    for (let i = 0; i < 200; i++) lines.push(`N${i}[Node${i}] --> N${i + 1}[Node${i + 1}]`);
    const start = performance.now();
    const r = parse(lines.join('\n') + '\n');
    const elapsed = performance.now() - start;
    expect(r.flow.edges).toHaveLength(200);
    expect(elapsed).toBeLessThan(50);
  });

  it('parses an edge wall hint: @orthogonal:EW', () => {
    const r = parse(`flowchart TD\nA[Start] --> B[Middle]\nB --> C[End] @orthogonal:EW\n`);
    expect(r.flow.edges).toHaveLength(2);
    const hinted = r.flow.edges[1]!;
    expect(hinted.routing).toBe('orthogonal');
    expect(hinted.exitWall).toBe('E');
    expect(hinted.entryWall).toBe('W');
    // Un-hinted edges carry no routing/wall fields.
    expect(r.flow.edges[0]!.routing).toBeUndefined();
    expect(r.flow.edges[0]!.exitWall).toBeUndefined();
    expect(r.flow.edges[0]!.entryWall).toBeUndefined();
  });

  it('parses routing-style hints for every style: straight, bezier, polyline', () => {
    const r = parse(
      `flowchart TD\nA --> B @straight\nB --> C @bezier\nC --> D @polyline\nD --> E @orthogonal\n`,
    );
    expect(r.flow.edges.map((e: any) => e.routing)).toEqual([
      'straight',
      'bezier',
      'polyline',
      'orthogonal',
    ]);
  });

  it('parses a routing style combined with a wall pair: @straight:EN', () => {
    const r = parse(`flowchart LR\nA --> B\nB --> C @straight:EN\n`);
    const hinted = r.flow.edges[1]!;
    expect(hinted.routing).toBe('straight');
    expect(hinted.exitWall).toBe('E');
    expect(hinted.entryWall).toBe('N');
  });

  it('parses a single-wall exit hint and a routing-word-only hint', () => {
    const r = parse(`flowchart TD\nA[Start] --> B[Middle] @orthogonal:S\nB --> C[End] @straight\n`);
    expect(r.flow.edges[0]!.exitWall).toBe('S');
    expect(r.flow.edges[0]!.entryWall).toBeUndefined();
    // A routing word with no wall pair sets routing but leaves walls unset.
    expect(r.flow.edges[1]!.routing).toBe('straight');
    expect(r.flow.edges[1]!.exitWall).toBeUndefined();
    expect(r.flow.edges[1]!.entryWall).toBeUndefined();
  });
});
