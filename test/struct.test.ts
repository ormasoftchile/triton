import { describe, it, expect } from 'vitest';
import { array, layoutArray } from '../src/diagrams/triton/ds/struct/array.js';
import { linkedlist, layoutList } from '../src/diagrams/triton/ds/struct/linkedlist.js';
import type { ScenePath, SceneRect, SceneText, TextAnchor } from '../src/contracts/index.js';
import { measureText } from '../src/text/metrics.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('array', () => {
  it('parses the directive form', () => {
    const ir = array.parseMermaid('array\n  title nums\n  cells 5 8 13\n  index\n  ptr i -> 1\n');
    expect(ir.cells).toEqual([
      { kind: 'value', value: '5' },
      { kind: 'value', value: '8' },
      { kind: 'value', value: '13' },
    ]);
    expect(ir.index.show).toBe(true);
    expect(ir.title).toBe('nums');
    expect(ir.ptrs).toEqual([{ id: 'i', target: { raw: '1', value: 1 } }]);
  });

  it('parses the inline shorthand', () => {
    const ir = array.parseMermaid('array 5 8 13 21 34');
    expect(ir.cells).toHaveLength(5);
    expect(ir.index.show).toBe(false);
  });

  it('parses axis, index bottom/reverse modifiers, labels, semantic targets, and gaps', () => {
    const ir = array.parseMermaid([
      'array',
      '  cells 5 8 ... 34',
      '  axis vertical',
      '  index reverse bottom',
      '  ptr p -> 2 "slow pointer"',
      '  ptr q -> clast',
    ].join('\n'));
    expect(ir.axis).toBe('vertical');
    expect(ir.index).toEqual({ show: true, side: 'after', order: 'reverse' });
    expect(ir.cells[2]).toEqual({ kind: 'gap' });
    expect(ir.ptrs[0]).toEqual({ id: 'p', target: { raw: '2', value: 2 }, label: 'slow pointer' });
    expect(ir.ptrs[1]).toEqual({ id: 'q', target: { raw: 'clast', anchor: 'clast' } });
  });

  it('accepts combined index modifiers in either order', () => {
    expect(array.parseMermaid('array\n  cells 1 2\n  index bottom reverse\n').index).toEqual({ show: true, side: 'after', order: 'reverse' });
    expect(array.parseMermaid('array\n  cells 1 2\n  index reverse bottom\n').index).toEqual({ show: true, side: 'after', order: 'reverse' });
  });

  it('renders a slot anchor per cell and an arrow marker', () => {
    const ir = array.parseMermaid('array 5 8 13');
    const { scene, anchors } = layoutArray(ir, defaultTheme);
    expect(Object.keys(anchors)).toEqual(['c0', 'c1', 'c2', 'cfirst', 'clast']);
    expect(scene.defs?.[0]).toContain('marker');
    expect(scene.viewBox.width).toBeGreaterThan(0);
  });

  it('ignores out-of-range pointers gracefully', () => {
    const ir = array.parseMermaid('array\n  cells 1 2\n  ptr p -> 9\n');
    expect(() => layoutArray(ir, defaultTheme)).not.toThrow();
  });

  it('lays vertical slots down the y axis without rotating text', () => {
    const ir = array.parseMermaid('array\n  cells 1 2 3\n  axis vertical\n  index\n');
    const { scene, anchors } = layoutArray(ir, defaultTheme);
    expect(anchors.c1!.bounds.y).toBeGreaterThan(anchors.c0!.bounds.y);
    expect(JSON.stringify(scene.elements)).not.toContain('rotate(');
  });

  it('index bottom flips pointers to the opposite side', () => {
    const topIndex = layoutArray(array.parseMermaid('array\n  cells 1\n  index\n  ptr p -> 0\n'), defaultTheme);
    const bottomIndex = layoutArray(array.parseMermaid('array\n  cells 1\n  index bottom\n  ptr p -> 0\n'), defaultTheme);
    const topPath = topIndex.scene.elements.find(e => e.type === 'path') as any;
    const bottomPath = bottomIndex.scene.elements.find(e => e.type === 'path') as any;
    const topNums = topPath.d.match(/[-\d.]+/g).map(Number);
    const bottomNums = bottomPath.d.match(/[-\d.]+/g).map(Number);
    expect(topNums[1]).toBeGreaterThan(topNums[3]);
    expect(bottomNums[1]).toBeLessThan(bottomNums[3]);
  });

  it('reverse makes numeric pointers and cN anchors use logical indexes', () => {
    const ir = array.parseMermaid('array\n  cells 10 20 30\n  index reverse\n  ptr p -> 0\n');
    const { scene, anchors } = layoutArray(ir, defaultTheme);
    expect(anchors.c0!.bounds.x).toBeGreaterThan(anchors.c2!.bounds.x);
    const path = scene.elements.find(e => e.type === 'path') as any;
    const x = Number(path.d.match(/[-\d.]+/g)[0]);
    expect(x).toBeCloseTo(anchors.c0!.bounds.x + anchors.c0!.bounds.width / 2);
  });

  it('exports cfirst, clast, and cgap while omitting a numeric index for the gap', () => {
    const ir = array.parseMermaid('array\n  cells 5 8 ... 34\n  index\n  ptr probe -> cgap "gap label"\n');
    const { scene, anchors } = layoutArray(ir, defaultTheme);
    expect(anchors.cfirst).toEqual({ bounds: anchors.c0!.bounds });
    expect(anchors.clast).toEqual({ bounds: anchors.c2!.bounds });
    expect(anchors.cgap).toBeDefined();
    expect(anchors.c3).toBeUndefined();
    expect(collectTexts(scene.elements)).not.toContain('3');
    expect(collectTexts(scene.elements)).toContain('gap label');
  });

  it('staggers overlapping horizontal pointer labels into distinct lanes', () => {
    const ir = array.parseMermaid([
      'array',
      '  cells 1 2',
      '  ptr p -> 0 "very long pointer label"',
      '  ptr q -> 1 "very long pointer label"',
    ].join('\n'));
    const { scene } = layoutArray(ir, defaultTheme);
    const labels = (scene.elements.filter(e => e.type === 'text') as any[])
      .filter(e => e.content === 'very long pointer label');
    expect(new Set(labels.map(e => e.position.y)).size).toBe(2);
  });

  it('expands the viewBox to include wide title, index, and pointer labels', () => {
    const ir = array.parseMermaid([
      'array',
      '  title Symbolic array with a deliberately wide title',
      '  cells 5 8 ... 34',
      '  axis vertical',
      '  index bottom reverse',
      '  ptr head -> 0 "start of the run with a wide label"',
      '  ptr tail -> clast "last live element with a wide label"',
      '  ptr probe -> cgap "somewhere in the middle with a wide label"',
    ].join('\n'));
    const { scene } = layoutArray(ir, defaultTheme);
    for (const text of scene.elements.filter((e): e is SceneText => e.type === 'text')) {
      const bounds = textBounds(text);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(scene.viewBox.width);
    }
  });

  it('assigns co-located vertical pointers to distinct arrow coordinates', () => {
    const ir = array.parseMermaid([
      'array',
      '  cells 5 8 ... 34',
      '  axis vertical',
      '  index bottom reverse',
      '  ptr head -> 0 "start of the run"',
      '  ptr tail -> clast "last live element"',
    ].join('\n'));
    const { scene } = layoutArray(ir, defaultTheme);
    const paths = scene.elements.filter((e): e is ScenePath => e.type === 'path');
    expect(paths).toHaveLength(2);
    expect(paths[0]!.d).not.toBe(paths[1]!.d);
  });

  it('keeps vertical array content near the top of the tight content bounds', () => {
    const ir = array.parseMermaid([
      'array',
      '  title Symbolic array',
      '  cells 5 8 ... 34',
      '  axis vertical',
      '  index bottom reverse',
      '  ptr head -> 0 "start of the run"',
      '  ptr tail -> clast "last live element"',
      '  ptr probe -> cgap "somewhere in the middle"',
    ].join('\n'));
    const { scene } = layoutArray(ir, defaultTheme);
    const minCellY = Math.min(...scene.elements
      .filter((e): e is SceneRect => e.type === 'rect' && e.strokeWidth === 1.5)
      .map(e => e.bounds.y));
    expect(minCellY).toBeLessThanOrEqual(defaultTheme.spacing.diagramMargin + defaultTheme.typography.titleFontSize + 16);
    expect(minCellY).toBeLessThan(scene.viewBox.height / 3);
  });

  it('rejects leading, trailing, and multiple gaps', () => {
    expect(() => array.parseMermaid('array\n  cells ... 1\n')).toThrow();
    expect(() => array.parseMermaid('array\n  cells 1 ...\n')).toThrow();
    expect(() => array.parseMermaid('array\n  cells 1 ... 2 ... 3\n')).toThrow();
  });

  // ── Feature 1: highlight and window directives ──────────────────────────

  it('parses highlight directive (individual cells)', () => {
    const ir = array.parseMermaid('array\n  cells 1 2 3 4 5\n  highlight 1 3\n');
    expect(ir.highlights).toEqual([1, 3]);
    expect(ir.window).toBeUndefined();
  });

  it('parses window directive (contiguous range)', () => {
    const ir = array.parseMermaid('array\n  cells 1 2 3 4 5\n  window 1-3\n');
    expect(ir.window).toEqual({ start: 1, end: 3 });
    expect(ir.highlights).toBeUndefined();
  });

  it('renders highlighted cells with primary fill and text', () => {
    const ir = array.parseMermaid('array\n  cells 10 20 30\n  highlight 1\n');
    const { scene } = layoutArray(ir, defaultTheme);
    // cell 1 should have a primary-colored rect
    const rects = scene.elements.filter((e): e is SceneRect => e.type === 'rect');
    const highlightRect = rects.find(r => r.fillOpacity !== undefined && r.fillOpacity < 1);
    expect(highlightRect).toBeDefined();
    expect(highlightRect!.fill).toBe(defaultTheme.palette.primary);
  });

  it('renders window-highlighted cells (range 1-2)', () => {
    const ir = array.parseMermaid('array\n  cells A B C D\n  window 1-2\n');
    const { scene } = layoutArray(ir, defaultTheme);
    const highlightRects = scene.elements.filter(
      (e): e is SceneRect => e.type === 'rect' && e.fillOpacity !== undefined,
    );
    // logical indices 1 and 2 should be highlighted
    expect(highlightRects.length).toBe(2);
  });

});

describe('linkedlist', () => {
  it('parses values inline and on indented lines', () => {
    expect(linkedlist.parseMermaid('linkedlist 3 7 9').values).toEqual(['3', '7', '9']);
    expect(linkedlist.parseMermaid('linkedlist\n  title q\n  3 7 9\n').values).toEqual(['3', '7', '9']);
  });

  it('parses quoted multi-word node labels without changing bare labels', () => {
    expect(linkedlist.parseMermaid('linkedlist "alpha beta" gamma').values).toEqual(['alpha beta', 'gamma']);
    expect(linkedlist.parseMermaid('linkedlist\n  nodes bare "two words"\n').values).toEqual(['bare', 'two words']);
  });

  it('renders one node anchor per value', () => {
    const ir = linkedlist.parseMermaid('linkedlist 3 7 9 12');
    const { scene, anchors } = layoutList(ir, defaultTheme);
    expect(Object.keys(anchors)).toEqual(['n0', 'n1', 'n2', 'n3']);
    expect(scene.elements.length).toBeGreaterThan(0);
  });

  it('expands the viewBox to include a wide quoted node label', () => {
    const wide = 'node label with enough words to widen the linked list cell';
    const ir = linkedlist.parseMermaid(`linkedlist "${wide}"`);
    const { scene } = layoutList(ir, defaultTheme);
    const label = scene.elements.find((e): e is SceneText => e.type === 'text' && e.content === wide);
    expect(label).toBeDefined();
    const bounds = textBounds(label!);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(scene.viewBox.width);
  });

  it('handles an empty list', () => {
    const ir = linkedlist.parseMermaid('linkedlist');
    expect(() => layoutList(ir, defaultTheme)).not.toThrow();
  });
});

function collectTexts(elements: readonly any[]): string[] {
  const out: string[] = [];
  for (const el of elements) {
    if (el.type === 'text') out.push(el.content);
    if (el.children) out.push(...collectTexts(el.children));
  }
  return out;
}

function textBounds(text: {
  content: string;
  position: { x: number; y: number };
  fontSize: number;
  anchor?: TextAnchor;
}): { x: number; width: number } {
  const width = measureText(text.content, text.fontSize).width;
  const x = text.anchor === 'middle'
    ? text.position.x - width / 2
    : text.anchor === 'end'
      ? text.position.x - width
      : text.position.x;
  return { x, width };
}
