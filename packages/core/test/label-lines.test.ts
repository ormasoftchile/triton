/**
 * @file test/label-lines.test.ts — Unit tests for the splitLabelLines utility.
 *
 * Covers:
 *  1. No-marker labels → single-element array (unchanged behaviour).
 *  2. HTML <br> variants (<br>, <br/>, <br />, mixed case).
 *  3. Literal backslash-n in source (`\n` two-character sequence).
 *  4. Actual embedded newline character.
 *  5. Mixed markers in one label.
 *  6. Trailing empty lines are stripped.
 *  7. Flow node with multi-line label → scene contains a `multitext` primitive
 *     with the correct number of lines, and node is sized for N lines.
 *  8. Tree node with multi-line label → same guarantees.
 *  9. Single-line node labels remain `text` primitives (no regression).
 */

import { describe, expect, it } from 'vitest';

import { splitLabelLines } from '../src/util/label-lines.js';
import { buildFlowScene } from '../src/grammars/flow/index.js';
import { buildTreeScene } from '../src/grammars/tree/index.js';
import type { FlowDocument } from '../src/grammars/flow/index.js';
import type { TreeDocument } from '../src/grammars/tree/index.js';
import type { MultiTextPrimitive, TextPrimitive } from '../src/scene.js';

// ---------------------------------------------------------------------------
// 1 – splitLabelLines: no-marker pass-through
// ---------------------------------------------------------------------------

describe('splitLabelLines — no break markers', () => {
  it('returns a single-element array for a plain label', () => {
    expect(splitLabelLines('Hello World')).toEqual(['Hello World']);
  });

  it('returns a single-element array for an empty string', () => {
    expect(splitLabelLines('')).toEqual(['']);
  });

  it('returns a single-element array for a label with only spaces', () => {
    expect(splitLabelLines('  step  ')).toEqual(['  step  ']);
  });
});

// ---------------------------------------------------------------------------
// 2 – splitLabelLines: <br> HTML break markers
// ---------------------------------------------------------------------------

describe('splitLabelLines — HTML <br> markers', () => {
  it('splits on <br>', () => {
    expect(splitLabelLines('Line one<br>Line two')).toEqual(['Line one', 'Line two']);
  });

  it('splits on <br/> (self-closing, no space)', () => {
    expect(splitLabelLines('A<br/>B')).toEqual(['A', 'B']);
  });

  it('splits on <br /> (self-closing, with space)', () => {
    expect(splitLabelLines('A<br />B')).toEqual(['A', 'B']);
  });

  it('splits on <BR> (uppercase)', () => {
    expect(splitLabelLines('X<BR>Y')).toEqual(['X', 'Y']);
  });

  it('splits on <Br/> (mixed case)', () => {
    expect(splitLabelLines('X<Br/>Y')).toEqual(['X', 'Y']);
  });

  it('splits on multiple <br> markers into 3 lines', () => {
    expect(splitLabelLines('A<br>B<br>C')).toEqual(['A', 'B', 'C']);
  });

  it('strips a trailing <br> that produces an empty last segment', () => {
    expect(splitLabelLines('A<br>B<br>')).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// 3 – splitLabelLines: literal backslash-n
// ---------------------------------------------------------------------------

describe('splitLabelLines — literal \\n sequence', () => {
  it('splits on literal \\n (two-character sequence)', () => {
    // In a JS string literal, '\\n' is the two characters: backslash + n
    expect(splitLabelLines('Line one\\nLine two')).toEqual(['Line one', 'Line two']);
  });

  it('splits on multiple \\n markers', () => {
    expect(splitLabelLines('A\\nB\\nC')).toEqual(['A', 'B', 'C']);
  });

  it('strips a trailing \\n that produces an empty last segment', () => {
    expect(splitLabelLines('A\\nB\\n')).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// 4 – splitLabelLines: actual embedded newline character
// ---------------------------------------------------------------------------

describe('splitLabelLines — embedded newline character', () => {
  it('splits on an actual newline character (\\u000A)', () => {
    expect(splitLabelLines('Line one\nLine two')).toEqual(['Line one', 'Line two']);
  });

  it('strips a trailing actual newline that produces an empty last segment', () => {
    expect(splitLabelLines('A\nB\n')).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// 5 – splitLabelLines: mixed markers
// ---------------------------------------------------------------------------

describe('splitLabelLines — mixed markers', () => {
  it('handles <br> and \\n together', () => {
    expect(splitLabelLines('A<br>B\\nC')).toEqual(['A', 'B', 'C']);
  });

  it('handles <br/> and actual newline together', () => {
    expect(splitLabelLines('A<br/>B\nC')).toEqual(['A', 'B', 'C']);
  });
});

// ---------------------------------------------------------------------------
// 6 – splitLabelLines: trailing empty line trimming
// ---------------------------------------------------------------------------

describe('splitLabelLines — trailing empty line trimming', () => {
  it('trims a single trailing empty line', () => {
    expect(splitLabelLines('A\nB\n')).toHaveLength(2);
  });

  it('trims multiple trailing empty lines', () => {
    expect(splitLabelLines('A\n\n\n')).toHaveLength(1);
    expect(splitLabelLines('A\n\n\n')[0]).toBe('A');
  });

  it('does not strip a lone non-empty label that contains only whitespace per line', () => {
    // A single-element result should always be returned even if that element is blank-ish
    expect(splitLabelLines('')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 7 – Flow grammar: multi-line node label scene assertions
// ---------------------------------------------------------------------------

describe('Flow grammar — multi-line node labels', () => {
  function makeFlowDoc(label: string): FlowDocument {
    return {
      version: '1.0',
      metadata: {},
      flow: {
        nodes: [
          { id: 'a', label },
          { id: 'b', label: 'Single line' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      },
    };
  }

  it('node with <br> label → multitext primitive with 2 lines', () => {
    const doc = makeFlowDoc('Line one<br>Line two');
    const scene = buildFlowScene(doc);
    const multitext = scene.primitives.filter(
      (p): p is MultiTextPrimitive => p.kind === 'multitext',
    );
    expect(multitext.length).toBeGreaterThanOrEqual(1);
    const nodeLabel = multitext.find((p) => p.lines.length === 2);
    expect(nodeLabel).toBeDefined();
    expect(nodeLabel!.lines).toEqual(['Line one', 'Line two']);
  });

  it('node with \\n label → multitext primitive with 2 lines', () => {
    const doc = makeFlowDoc('Step A\\nStep B');
    const scene = buildFlowScene(doc);
    const multitext = scene.primitives.filter(
      (p): p is MultiTextPrimitive => p.kind === 'multitext',
    );
    const nodeLabel = multitext.find((p) => p.lines.length === 2);
    expect(nodeLabel).toBeDefined();
    expect(nodeLabel!.lines).toEqual(['Step A', 'Step B']);
  });

  it('node with no break markers → text primitive (no regression)', () => {
    const doc = makeFlowDoc('Single line node');
    const scene = buildFlowScene(doc);
    // No multitext for node labels
    const multitext = scene.primitives.filter(
      (p): p is MultiTextPrimitive => p.kind === 'multitext',
    );
    expect(multitext.length).toBe(0);
    // Should have text primitive with the exact label
    const textPrims = scene.primitives.filter(
      (p): p is TextPrimitive => p.kind === 'text' && p.text === 'Single line node',
    );
    expect(textPrims.length).toBeGreaterThanOrEqual(1);
  });

  it('multi-line node is taller than a same-width single-line node', () => {
    const single = buildFlowScene(makeFlowDoc('Alpha'));
    const multi = buildFlowScene(makeFlowDoc('Alpha<br>Beta'));
    // The multi-line scene should be taller because the node box grows
    expect(multi.height).toBeGreaterThan(single.height);
  });
});

// ---------------------------------------------------------------------------
// 8 – Tree grammar: multi-line node label scene assertions
// ---------------------------------------------------------------------------

describe('Tree grammar — multi-line node labels', () => {
  function makeTreeDoc(rootLabel: string): TreeDocument {
    return {
      version: '1.0',
      metadata: {},
      tree: {
        root: {
          id: 'root',
          label: rootLabel,
          children: [
            { id: 'child1', label: 'Child one' },
            { id: 'child2', label: 'Child two' },
          ],
        },
      },
    };
  }

  it('root with <br> label → multitext primitive with 2 lines', () => {
    const doc = makeTreeDoc('Root Line 1<br>Root Line 2');
    const scene = buildTreeScene(doc);
    const multitext = scene.primitives.filter(
      (p): p is MultiTextPrimitive => p.kind === 'multitext',
    );
    expect(multitext.length).toBeGreaterThanOrEqual(1);
    const rootLabel = multitext.find((p) => p.lines[0] === 'Root Line 1');
    expect(rootLabel).toBeDefined();
    expect(rootLabel!.lines).toEqual(['Root Line 1', 'Root Line 2']);
  });

  it('root with \\n label → multitext primitive with 2 lines', () => {
    const doc = makeTreeDoc('Row one\\nRow two');
    const scene = buildTreeScene(doc);
    const multitext = scene.primitives.filter(
      (p): p is MultiTextPrimitive => p.kind === 'multitext',
    );
    const rootLabel = multitext.find((p) => p.lines[0] === 'Row one');
    expect(rootLabel).toBeDefined();
    expect(rootLabel!.lines).toEqual(['Row one', 'Row two']);
  });

  it('node with no break markers → text primitive (no regression)', () => {
    const doc = makeTreeDoc('Root Node');
    const scene = buildTreeScene(doc);
    // All node labels should be text primitives (no multitext)
    const multitext = scene.primitives.filter(
      (p): p is MultiTextPrimitive => p.kind === 'multitext',
    );
    expect(multitext.length).toBe(0);
    const textPrims = scene.primitives.filter(
      (p): p is TextPrimitive => p.kind === 'text' && p.text === 'Root Node',
    );
    expect(textPrims.length).toBeGreaterThanOrEqual(1);
  });

  it('multi-line tree leaf node is taller than a single-line leaf node', () => {
    // Build trees where the LEAF (depth=1) has the multi-line label,
    // so the depth-based y positioning reflects the taller node height.
    function makeLeafDoc(childLabel: string): TreeDocument {
      return {
        version: '1.0',
        metadata: {},
        tree: {
          root: {
            id: 'root',
            label: 'Root',
            children: [{ id: 'child1', label: childLabel }],
          },
        },
      };
    }
    const single = buildTreeScene(makeLeafDoc('Alpha'));
    const multi = buildTreeScene(makeLeafDoc('Alpha<br>Beta'));
    expect(multi.height).toBeGreaterThan(single.height);
  });
});
