import { describe, it, expect } from 'vitest';
import { stack, layoutStack } from '../src/diagrams/triton/ds/stack/stack.js';
import { hashmap, layoutHashmap } from '../src/diagrams/triton/ds/hashmap/hashmap.js';
import { matrix, layoutMatrix } from '../src/diagrams/triton/ds/matrix/matrix.js';
import { render } from '../src/frontend/index.js';
import { detect } from '../src/frontend/detect.js';
import type { Scene, SceneElement, ScenePath, SceneRect, SceneText } from '../src/contracts/index.js';
import { measureText } from '../src/text/metrics.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('ds detection', () => {
  it('routes each header to its own kind', () => {
    expect(detect('stack A B C').diagramType).toBe('stack');
    expect(detect('hashmap\n  buckets 4').diagramType).toBe('hashmap');
    expect(detect('matrix\n  row 1 2').diagramType).toBe('matrix');
  });
});

describe('stack', () => {
  it('parses inline and directive forms', () => {
    expect(stack.parseMermaid('stack A B C').cells).toEqual(['A', 'B', 'C']);
    const ir = stack.parseMermaid('stack\n  title s\n  cells A B\n  capacity 5\n');
    expect(ir.cells).toEqual(['A', 'B']);
    expect(ir.capacity).toBe(5);
    expect(ir.title).toBe('s');
    expect(ir.axis).toBe('vertical');
    expect(stack.parseMermaid('stack\n  axis horizontal\n').axis).toBe('horizontal');
  });

  it('renders one slot anchor per capacity cell, with push/pop and top markers', () => {
    const ir = stack.parseMermaid('stack\n  cells A B C\n  capacity 5\n');
    const { scene, anchors } = layoutStack(ir, defaultTheme);
    expect(Object.keys(anchors)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
    const texts = scene.elements.filter(e => e.type === 'text').map(e => (e as { content: string }).content);
    expect(texts).toContain('push / pop');
    expect(texts).toContain('top');
  });

  it('draws the top-of-stack (last pushed) at the smallest y', () => {
    // A B C → C is on top, drawn highest; with capacity the empties sit above.
    const ir = stack.parseMermaid('stack A B C');
    const { scene } = layoutStack(ir, defaultTheme);
    const labelOf = (s: string) => scene.elements.find(
      e => e.type === 'text' && (e as { content: string }).content === s,
    ) as { position: { y: number } };
    expect(labelOf('C').position.y).toBeLessThan(labelOf('B').position.y);
    expect(labelOf('B').position.y).toBeLessThan(labelOf('A').position.y);
  });

  it('axis horizontal lays stack slots across and moves the top marker below the top cell', () => {
    const ir = stack.parseMermaid('stack\n  cells A B C\n  axis horizontal\n');
    const { scene, anchors } = layoutStack(ir, defaultTheme);
    expect(anchors.c1!.bounds.x).toBeGreaterThan(anchors.c0!.bounds.x);
    expect(anchors.c1!.bounds.y).toBe(anchors.c0!.bounds.y);
    expect(textOf(scene, 'top').position.y).toBeGreaterThan(anchors.c0!.bounds.y + anchors.c0!.bounds.height);
    expect(JSON.stringify(scene.elements)).not.toContain('rotate(');
    expectSceneFits(scene);
  });

  it('handles an empty stack', () => {
    expect(() => layoutStack(stack.parseMermaid('stack'), defaultTheme)).not.toThrow();
  });
});

describe('hashmap', () => {
  it('parses bucket count and chained entries', () => {
    const ir = hashmap.parseMermaid('hashmap\n  buckets 5\n  bucket 0: alice->1, bob->2\n  bucket 2: carol->3\n');
    expect(ir.buckets).toBe(5);
    expect(ir.chains).toHaveLength(2);
    expect(ir.chains[0]).toEqual({ index: 0, entries: [{ key: 'alice', value: '1' }, { key: 'bob', value: '2' }] });
    expect(ir.chains[1]!.index).toBe(2);
  });

  it('grows the bucket count to fit the highest referenced index', () => {
    const ir = hashmap.parseMermaid('hashmap\n  bucket 4: x->1\n');
    expect(ir.buckets).toBe(5);
  });

  it('renders one anchor per bucket plus one per chained entry', () => {
    const ir = hashmap.parseMermaid('hashmap\n  buckets 4\n  bucket 0: a->1, b->2\n  bucket 2: c->3\n');
    const { anchors } = layoutHashmap(ir, defaultTheme);
    const keys = Object.keys(anchors);
    expect(keys).toContain('b0');
    expect(keys).toContain('b1');
    expect(keys).toContain('b2');
    expect(keys).toContain('b3');
    // chain entries
    expect(keys).toContain('b0e0');
    expect(keys).toContain('b0e1');
    expect(keys).toContain('b2e0');
    // bucket count cells = 4
    expect(keys.filter(k => /^b\d+$/.test(k))).toHaveLength(4);
  });

  it('wires a pointer arrow into each chained entry', () => {
    const ir = hashmap.parseMermaid('hashmap\n  buckets 3\n  bucket 1: a->1, b->2\n');
    const { scene } = layoutHashmap(ir, defaultTheme);
    const arrows = scene.elements.filter(
      e => e.type === 'path' && (e as { markerEnd?: string }).markerEnd != null,
    );
    // two entries → two pointer arrows
    expect(arrows.length).toBe(2);
  });
});

describe('matrix', () => {
  it('parses rows and infers dimensions', () => {
    const ir = matrix.parseMermaid('matrix\n  row 1 2 3\n  row 4 5 6\n');
    expect(ir.rows).toHaveLength(2);
    expect(ir.rows[0]).toEqual(['1', '2', '3']);
  });

  it('supports the RxC shorthand for an empty grid', () => {
    const ir = matrix.parseMermaid('matrix 3x4');
    expect(ir.rows).toHaveLength(3);
    expect(ir.rows[0]).toHaveLength(4);
  });

  it('renders one anchor per cell (rows × cols)', () => {
    const ir = matrix.parseMermaid('matrix\n  row 1 2 3 4\n  row 5 6 7 8\n  row 9 10 11 12\n');
    const { anchors } = layoutMatrix(ir, defaultTheme);
    expect(Object.keys(anchors)).toHaveLength(12);
    expect(anchors).toHaveProperty('r0c0');
    expect(anchors).toHaveProperty('r2c3');
  });

  it('pads ragged rows so the grid stays rectangular', () => {
    const ir = matrix.parseMermaid('matrix\n  row 1 2 3\n  row 4\n');
    const { anchors } = layoutMatrix(ir, defaultTheme);
    expect(Object.keys(anchors)).toHaveLength(6);
  });

  it('lays cells out left→right and rows top→down', () => {
    const ir = matrix.parseMermaid('matrix\n  row 1 2\n  row 3 4\n');
    const { anchors } = layoutMatrix(ir, defaultTheme);
    expect(anchors.r0c0!.bounds.x).toBeLessThan(anchors.r0c1!.bounds.x);
    expect(anchors.r0c0!.bounds.y).toBeLessThan(anchors.r1c0!.bounds.y);
  });

  // ── Feature 1: matrix highlight ──────────────────────────────────────────

  it('parses highlight directive as r,c pairs', () => {
    const ir = matrix.parseMermaid('matrix\n  row 1 2 3\n  highlight 0,1 1,2\n');
    expect(ir.highlights).toEqual([[0, 1], [1, 2]]);
  });

  it('renders highlighted cells with primary fill', () => {
    const ir = matrix.parseMermaid('matrix\n  row a b c\n  row d e f\n  highlight 0,0 1,2\n');
    const { scene } = layoutMatrix(ir, defaultTheme);
    const allRects: SceneRect[] = [];
    const collectRects = (els: readonly SceneElement[]) => {
      for (const el of els) {
        if (el.type === 'rect') allRects.push(el as SceneRect);
        if ((el as any).children) collectRects((el as any).children);
      }
    };
    collectRects(scene.elements);
    const highlighted = allRects.filter(r => r.fillOpacity !== undefined && r.fillOpacity < 1);
    expect(highlighted.length).toBeGreaterThanOrEqual(2);
    expect(highlighted[0]!.fill).toBe(defaultTheme.palette.primary);
  });
});

describe('ds B1 renders to SVG', () => {
  const cases: [string, string][] = [
    ['stack', 'stack\n  cells main parse layout\n  capacity 5\n'],
    ['hashmap', 'hashmap\n  buckets 5\n  bucket 0: a->1, b->2\n  bucket 2: c->3\n'],
    ['matrix', 'matrix\n  row 1 2 3 4\n  row 5 6 7 8\n  row 9 10 11 12\n'],
  ];
  for (const [name, src] of cases) {
    it(`renders ${name} to valid SVG`, async () => {
      const result = await render(src);
      if (!result.ok) throw new Error(`${name}: ${result.error.code} — ${result.error.message}`);
      expect(result.value.startsWith('<svg')).toBe(true);
      expect(result.value).toContain('</svg>');
    });
  }
});

function textOf(scene: Scene, content: string): SceneText {
  const found = scene.elements.find((e): e is SceneText => e.type === 'text' && e.content === content);
  if (!found) throw new Error(`missing text ${content}`);
  return found;
}

function expectSceneFits(scene: Scene): void {
  for (const element of scene.elements) {
    const bounds = elementBounds(element);
    if (!bounds) continue;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(scene.viewBox.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(scene.viewBox.height);
  }
}

function elementBounds(element: SceneElement): SceneRect['bounds'] | undefined {
  if (element.type === 'rect') return element.bounds;
  if (element.type === 'path') return pathBounds(element);
  if (element.type === 'text') return textBounds(element);
  if (element.type === 'circle') {
    return {
      x: element.center.x - element.radius,
      y: element.center.y - element.radius,
      width: element.radius * 2,
      height: element.radius * 2,
    };
  }
  if (element.type === 'group') {
    const bounds = element.children.map(elementBounds).filter((b): b is SceneRect['bounds'] => b !== undefined);
    if (bounds.length === 0) return undefined;
    const minX = Math.min(...bounds.map(b => b.x));
    const minY = Math.min(...bounds.map(b => b.y));
    const maxX = Math.max(...bounds.map(b => b.x + b.width));
    const maxY = Math.max(...bounds.map(b => b.y + b.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

function textBounds(text: SceneText): SceneRect['bounds'] {
  const measured = measureText(text.content, text.fontSize);
  const x = text.anchor === 'middle'
    ? text.position.x - measured.width / 2
    : text.anchor === 'end'
      ? text.position.x - measured.width
      : text.position.x;
  return { x, y: text.position.y - text.fontSize, width: measured.width, height: text.fontSize * 1.25 };
}

function pathBounds(path: ScenePath): SceneRect['bounds'] {
  const nums = [...path.d.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const pad = path.strokeWidth / 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
