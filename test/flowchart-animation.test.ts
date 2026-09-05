import { describe, expect, it } from 'vitest';
import { flowchart } from '../src/diagrams/mermaid/flowchart/index.js';
import { renderSync } from '../src/frontend/index.js';

describe('flowchart connector animation', () => {
  it('carries animation and routing annotations through the parser', () => {
    const doc = flowchart.parseMermaid('flowchart LR\nA --> B @orthogonal:EW @anim:particle\n');
    expect(doc.edges[0]).toMatchObject({ animation: 'particle', routing: 'orthogonal', exitWall: 'E', entryWall: 'W' });
  });

  it('gives annotations precedence over property blocks', () => {
    const doc = flowchart.parseMermaid('flowchart LR\nA --> B @anim:comet { anim: pulse }\n');
    expect(doc.edges[0]).toMatchObject({ animation: 'comet' });
  });

  it.each(['particle', 'comet', 'stream', 'draw', 'pulse', 'glow', 'flow', 'colorcycle', 'march'])(
    'renders %s on forward edges, feedback edges, and self loops', animation => {
      for (const body of ['A -_-> B', 'A --> B\nB -_-> A', 'A -_-> A']) {
        const result = renderSync(`flowchart LR\n${body} @anim:${animation}\n`);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toContain('<animate');
      }
    },
  );

  it('can disable animation and rejects unknown effects', () => {
    const result = renderSync('flowchart LR\nA --> B @anim:none\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toContain('<animate');
    expect(() => flowchart.parseMermaid('flowchart LR\nA --> B @anim:invalid\n')).toThrow();
  });
});