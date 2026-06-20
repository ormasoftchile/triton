/**
 * Tests for the Peggy flowchart grammar.
 * Run: npx tsx test/flowchart.test.ts
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../src/diagrams/flowchart/parser.js';

describe('flowchart grammar', () => {
  it('parses basic flowchart', () => {
    const result = parse(`flowchart TD
A[Start] --> B{Decision}
B -->|Yes| C[OK]
B -->|No| D[Fail]
`);
    expect(result.flow.nodes).toHaveLength(4);
    expect(result.flow.edges).toHaveLength(3);
    expect(result.direction).toBe('TD');
  });

  it('parses chain edges', () => {
    const result = parse(`graph LR
A[Input] --> B[Process] --> C[Output]
`);
    expect(result.flow.edges).toHaveLength(2);
    expect(result.flow.nodes).toHaveLength(3);
  });

  it('handles multiple edge types', () => {
    const result = parse(`flowchart TD
A --> B
C -.-> D
E ==> F
G --- H
I -.- J
`);
    expect(result.flow.edges).toHaveLength(5);
    expect(result.flow.edges[1].style).toBe('dotted');
    expect(result.flow.edges[1].kind).toBe('async');
  });

  it('parses all node shapes', () => {
    const result = parse(`flowchart LR
A[Rectangle]
B(Rounded)
C((Circle))
D{Diamond}
E([Stadium])
F[[Subroutine]]
`);
    expect(result.flow.nodes).toHaveLength(6);
  });

  it('parses subgraphs', () => {
    const result = parse(`flowchart TD
subgraph api Backend
  A[Server] --> B[DB]
end
C[Client] --> A
`);
    expect(result.flow.edges).toHaveLength(2);
  });

  it('skips comments', () => {
    const result = parse(`flowchart LR
%% This is a comment
A --> B
%% Another comment
B --> C
`);
    expect(result.flow.edges).toHaveLength(2);
    expect(result.flow.nodes).toHaveLength(3);
  });

  it('parses frontmatter', () => {
    const result = parse(`---
title: My Flow
theme: dark
---
flowchart TD
A --> B
`);
    expect(result.metadata.title).toBe('My Flow');
    expect(result.metadata.theme).toBe('dark');
  });

  it('handles bidirectional edges', () => {
    const result = parse(`flowchart LR
A <--> B
C <==> D
E <-.-> F
`);
    expect(result.flow.edges).toHaveLength(3);
  });

  it('strips quotes from labels', () => {
    const result = parse(`flowchart TD
A["Hello World"] --> B["Goodbye"]
`);
    expect(result.flow.nodes).toHaveLength(2);
    expect(result.flow.edges).toHaveLength(1);
  });

  it('handles long chains', () => {
    const result = parse(`flowchart LR
A --> B --> C --> D --> E --> F
`);
    expect(result.flow.edges).toHaveLength(5);
    expect(result.flow.nodes).toHaveLength(6);
  });

  describe('performance', () => {
    it('parses 200-edge graph under 5ms', () => {
      const lines = ['flowchart LR'];
      for (let i = 0; i < 200; i++) {
        lines.push(`N${i}[Node ${i}] --> N${i + 1}[Node ${i + 1}]`);
      }
      const input = lines.join('\n') + '\n';

      const start = performance.now();
      const result = parse(input);
      const elapsed = performance.now() - start;

      expect(result.flow.edges).toHaveLength(200);
      expect(elapsed).toBeLessThan(5);
    });
  });
});
