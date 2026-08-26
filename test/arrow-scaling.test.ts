import { describe, it, expect } from 'vitest';
import { renderSync } from '../src/index.js';

describe('Universal Arrowhead Scaling across all diagram types', () => {
  it('scales sequence diagram arrowheads with custom arrowSize', () => {
    const src = `sequenceDiagram
      A->>B: msg1
      B--)A: msg2
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="seq-arrow" markerWidth="6" markerHeight="4.2" refX="5" refY="2.1"');
    expect(res.value).toContain('id="seq-open" markerWidth="7" markerHeight="4.8" refX="6" refY="2.4"');
  });

  it('scales state diagram arrowheads with custom arrowSize', () => {
    const src = `stateDiagram-v2
      [*] --> State1
      State1 --> [*]
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="state-arrow" markerWidth="6" markerHeight="4.2" refX="5" refY="2.1"');
  });

  it('scales c4 diagram arrowheads with custom arrowSize', () => {
    const src = `C4Context
      Person(p, "User")
      System(s, "API")
      Rel(p, s, "Uses")
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="c4-arrow" markerWidth="6" markerHeight="4.2" refX="5" refY="2.1"');
  });

  it('scales architecture diagram arrowheads with custom arrowSize', () => {
    const src = `architecture-beta
      service s1(server)[S1]
      service s2(server)[S2]
      s1:R --> L:s2
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="arch-arrow-end" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="9.75" refX="10.8" refY="4.88"');
  });

  it('scales requirement diagram arrowheads with custom arrowSize', () => {
    const src = `requirementDiagram
      requirement req1 {
        id: 1
        text: test
      }
      element el1 {
        type: module
      }
      el1 - satisfies -> req1
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="req-arrow" markerWidth="7" markerHeight="4.8" refX="6" refY="2.4"');
  });

  it('scales block diagram arrowheads with custom arrowSize', () => {
    const src = `block-beta
      columns 2
      b1["Block 1"] b2["Block 2"]
      b1 --> b2
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="block-arrow" markerWidth="6" markerHeight="4.2" refX="5" refY="2.1"');
  });

  it('scales ds graph diagram arrowheads with custom arrowSize', () => {
    const src = `nodegraph
      directed
      A -> B
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="dsgraph-arrow" markerWidth="6" markerHeight="4.2" refX="5" refY="2.1"');
  });

  it('scales queue diagram arrowheads with custom arrowSize', () => {
    const src = `queue
      1 -> 2 -> 3
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('id="queue-arrow-fwd" markerWidth="7" markerHeight="6" refX="5" refY="3"');
  });

  it('scales struct array and linkedlist arrowheads with custom arrowSize', () => {
    const src = `array
      [1, 2, 3]
      p1 = 0
    `;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    // 6 * 1.5 = 9
    expect(res.value).toContain('id="struct-arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5"');
  });

  it('scales crosslink arrowheads in posters with markerUnits=userSpaceOnUse and custom arrowSize', () => {
    const src = `poster "Cross Link Test"
    columns 2

    cell q "Plan" :: plan
        plan
            Hash Join
                Seq Scan orders
                Index Scan customers
    end

    cell a "Array" :: array
        array 5 8 13
    end

    link q.n2 --> a.c0 "uses index"
`;
    const res = renderSync(src, { edges: { arrowSize: 6 } }, 'svg');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Crosslink marker should use markerUnits="userSpaceOnUse" so it does not balloon with line stroke
    expect(res.value).toMatch(/<marker id="triton-crosslink-arrow-[^"]+" markerWidth="6" markerHeight="4.2" refX="5" refY="2.1" orient="auto" markerUnits="userSpaceOnUse">/);
  });
});
