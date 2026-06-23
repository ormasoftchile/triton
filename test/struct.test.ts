import { describe, it, expect } from 'vitest';
import { array, layoutArray } from '../src/diagrams/struct/array.js';
import { linkedlist, layoutList } from '../src/diagrams/struct/linkedlist.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('array', () => {
  it('parses the directive form', () => {
    const ir = array.parseMermaid('array\n  title nums\n  cells 5 8 13\n  index\n  ptr i -> 1\n');
    expect(ir.cells).toEqual(['5', '8', '13']);
    expect(ir.index).toBe(true);
    expect(ir.title).toBe('nums');
    expect(ir.ptrs).toEqual([{ name: 'i', idx: 1 }]);
  });

  it('parses the inline shorthand', () => {
    const ir = array.parseMermaid('array 5 8 13 21 34');
    expect(ir.cells).toHaveLength(5);
    expect(ir.index).toBe(false);
  });

  it('renders a slot anchor per cell and an arrow marker', () => {
    const ir = array.parseMermaid('array 5 8 13');
    const { scene, anchors } = layoutArray(ir, defaultTheme);
    expect(Object.keys(anchors)).toEqual(['c0', 'c1', 'c2']);
    expect(scene.defs?.[0]).toContain('marker');
    expect(scene.viewBox.width).toBeGreaterThan(0);
  });

  it('ignores out-of-range pointers gracefully', () => {
    const ir = array.parseMermaid('array\n  cells 1 2\n  ptr p -> 9\n');
    expect(() => layoutArray(ir, defaultTheme)).not.toThrow();
  });
});

describe('linkedlist', () => {
  it('parses values inline and on indented lines', () => {
    expect(linkedlist.parseMermaid('linkedlist 3 7 9').values).toEqual(['3', '7', '9']);
    expect(linkedlist.parseMermaid('linkedlist\n  title q\n  3 7 9\n').values).toEqual(['3', '7', '9']);
  });

  it('renders one node anchor per value', () => {
    const ir = linkedlist.parseMermaid('linkedlist 3 7 9 12');
    const { scene, anchors } = layoutList(ir, defaultTheme);
    expect(Object.keys(anchors)).toEqual(['n0', 'n1', 'n2', 'n3']);
    expect(scene.elements.length).toBeGreaterThan(0);
  });

  it('handles an empty list', () => {
    const ir = linkedlist.parseMermaid('linkedlist');
    expect(() => layoutList(ir, defaultTheme)).not.toThrow();
  });
});
