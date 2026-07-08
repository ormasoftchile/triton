import { describe, it, expect } from 'vitest';
import { queue, layoutQueue } from '../src/diagrams/triton/ds/queue/queue.js';
import { cqueue, layoutCQueue } from '../src/diagrams/triton/ds/queue/cqueue.js';
import { deque, layoutDeque } from '../src/diagrams/triton/ds/queue/deque.js';
import { pqueue, layoutPQueue } from '../src/diagrams/triton/ds/queue/pqueue.js';
import { render } from '../src/frontend/index.js';
import { detect } from '../src/frontend/detect.js';
import type { Scene, SceneElement, ScenePath, SceneRect, SceneText } from '../src/contracts/index.js';
import { measureText } from '../src/text/metrics.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('queue detection', () => {
  it('routes each header to its own kind', () => {
    expect(detect('queue A B C').diagramType).toBe('queue');
    expect(detect('cqueue\n  capacity 4').diagramType).toBe('cqueue');
    expect(detect('deque A B').diagramType).toBe('deque');
    expect(detect('pqueue\n  item A 3').diagramType).toBe('pqueue');
  });
});

describe('linear queue', () => {
  it('parses inline and directive forms', () => {
    expect(queue.parseMermaid('queue A B C').cells).toEqual(['A', 'B', 'C']);
    const ir = queue.parseMermaid('queue\n  title q\n  cells A B\n  capacity 5\n');
    expect(ir.cells).toEqual(['A', 'B']);
    expect(ir.capacity).toBe(5);
    expect(ir.title).toBe('q');
    expect(ir.axis).toBe('horizontal');
    expect(queue.parseMermaid('queue\n  axis vertical\n').axis).toBe('vertical');
  });

  it('renders one slot anchor per capacity cell and front/rear pointers', () => {
    const ir = queue.parseMermaid('queue\n  cells A B C\n  capacity 5\n');
    const { scene, anchors } = layoutQueue(ir, defaultTheme);
    expect(Object.keys(anchors)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
    const texts = scene.elements.filter(e => e.type === 'text').map(e => (e as { content: string }).content);
    expect(texts).toContain('enqueue');
    expect(texts).toContain('dequeue');
    expect(texts).toContain('front');
    expect(texts).toContain('rear');
  });

  it('front sits left of rear', () => {
    const ir = queue.parseMermaid('queue A B C D');
    const { anchors } = layoutQueue(ir, defaultTheme);
    expect(anchors.c0!.bounds.x).toBeLessThan(anchors.c3!.bounds.x);
  });

  it('axis vertical lays slots down and moves front/rear markers to the side', () => {
    const ir = queue.parseMermaid('queue\n  cells A B C\n  capacity 5\n  axis vertical\n');
    const { scene, anchors } = layoutQueue(ir, defaultTheme);
    expect(anchors.c1!.bounds.y).toBeGreaterThan(anchors.c0!.bounds.y);
    expect(anchors.c1!.bounds.x).toBe(anchors.c0!.bounds.x);
    expect(textOf(scene, 'front').position.x).toBeGreaterThan(anchors.c0!.bounds.x + anchors.c0!.bounds.width);
    expect(textOf(scene, 'rear').position.x).toBeGreaterThan(anchors.c2!.bounds.x + anchors.c2!.bounds.width);
    expectSceneFits(scene);
    expectNoRotatedText(scene);
  });

  it('handles an empty queue', () => {
    expect(() => layoutQueue(queue.parseMermaid('queue'), defaultTheme)).not.toThrow();
  });
});

describe('circular queue', () => {
  it('pads cells to capacity and infers front/rear from occupancy', () => {
    const ir = cqueue.parseMermaid('cqueue\n  capacity 6\n  cells _ B C D\n');
    expect(ir.cells).toHaveLength(6);
    expect(ir.cells[0]).toBeNull();
    expect(ir.front).toBe(1);
    expect(ir.rear).toBe(3);
  });

  it('honours explicit front/rear and draws a wrap arc (cubic path)', () => {
    const ir = cqueue.parseMermaid('cqueue\n  capacity 5\n  cells A B _ _ E\n  front 4\n  rear 1\n');
    expect(ir.front).toBe(4);
    expect(ir.rear).toBe(1);
    const { scene, anchors } = layoutCQueue(ir, defaultTheme);
    expect(Object.keys(anchors)).toHaveLength(5);
    const hasCurve = scene.elements.some(e => e.type === 'path' && (e as { d: string }).d.includes('C'));
    expect(hasCurve).toBe(true);
  });

  it('axis vertical moves slots down, indexes left, and front/rear markers right', () => {
    const ir = cqueue.parseMermaid('cqueue\n  capacity 4\n  cells A B _ D\n  front 0\n  rear 3\n  axis vertical\n');
    const { scene, anchors } = layoutCQueue(ir, defaultTheme);
    expect(anchors.c1!.bounds.y).toBeGreaterThan(anchors.c0!.bounds.y);
    expect(textOf(scene, '0').position.x).toBeLessThan(anchors.c0!.bounds.x);
    expect(textOf(scene, 'front').position.x).toBeGreaterThan(anchors.c0!.bounds.x + anchors.c0!.bounds.width);
    expect(textOf(scene, 'rear').position.x).toBeGreaterThan(anchors.c3!.bounds.x + anchors.c3!.bounds.width);
    const wrap = scene.elements.find((e): e is ScenePath => e.type === 'path' && e.d.includes('C'));
    expect(wrap?.d).toBeDefined();
    expectSceneFits(scene);
    expectNoRotatedText(scene);
  });
});

describe('deque', () => {
  it('parses cells and renders double-headed end arrows', () => {
    const ir = deque.parseMermaid('deque A B C');
    expect(ir.cells).toEqual(['A', 'B', 'C']);
    expect(ir.axis).toBe('horizontal');
    const { scene } = layoutDeque(ir, defaultTheme);
    const doubleHeaded = scene.elements.filter(
      e => e.type === 'path'
        && (e as { markerStart?: string }).markerStart != null
        && (e as { markerEnd?: string }).markerEnd != null,
    );
    expect(doubleHeaded.length).toBe(2);
  });

  it('axis vertical lays slots down and keeps labels horizontal', () => {
    const ir = deque.parseMermaid('deque\n  cells A B C\n  axis vertical\n');
    const { scene, anchors } = layoutDeque(ir, defaultTheme);
    expect(anchors.c1!.bounds.y).toBeGreaterThan(anchors.c0!.bounds.y);
    expect(textOf(scene, 'front').position.x).toBeGreaterThan(anchors.c0!.bounds.x + anchors.c0!.bounds.width);
    expect(textOf(scene, 'rear').position.x).toBeGreaterThan(anchors.c2!.bounds.x + anchors.c2!.bounds.width);
    expectSceneFits(scene);
    expectNoRotatedText(scene);
  });
});

describe('priority queue', () => {
  it('parses item label + trailing priority', () => {
    const ir = pqueue.parseMermaid('pqueue\n  item Deploy job 9\n  item Lint 2\n');
    expect(ir.items).toEqual([
      { label: 'Deploy job', priority: 9 },
      { label: 'Lint', priority: 2 },
    ]);
    expect(ir.axis).toBe('horizontal');
    expect(pqueue.parseMermaid('pqueue\n  axis vertical\n').axis).toBe('vertical');
  });

  it('orders highest priority first on the default horizontal axis', () => {
    const ir = pqueue.parseMermaid('pqueue\n  item Low 1\n  item High 9\n  item Mid 5\n');
    const { anchors } = layoutPQueue(ir, defaultTheme);
    expect(anchors.c0!.bounds.x).toBeLessThan(anchors.c1!.bounds.x);
    expect(anchors.c1!.bounds.x).toBeLessThan(anchors.c2!.bounds.x);
  });

  it('shows the priority value per cell', () => {
    const ir = pqueue.parseMermaid('pqueue\n  item A 3\n  item B 8\n');
    const { scene } = layoutPQueue(ir, defaultTheme);
    const texts = scene.elements.filter(e => e.type === 'text').map(e => (e as { content: string }).content);
    expect(texts).toContain('3');
    expect(texts).toContain('8');
  });

  it('axis vertical stacks priorities down without rotating text', () => {
    const ir = pqueue.parseMermaid('pqueue\n  axis vertical\n  item Low 1\n  item High 9\n  item Mid 5\n');
    const { scene, anchors } = layoutPQueue(ir, defaultTheme);
    expect(anchors.c1!.bounds.y).toBeGreaterThan(anchors.c0!.bounds.y);
    expect(textOf(scene, 'High').position.y).toBeLessThan(textOf(scene, 'Mid').position.y);
    expect(textOf(scene, 'Mid').position.y).toBeLessThan(textOf(scene, 'Low').position.y);
    expectSceneFits(scene);
    expectNoRotatedText(scene);
  });
});

describe('queue family renders to SVG', () => {
  const cases: [string, string][] = [
    ['queue', 'queue\n  cells A B C\n  capacity 5\n'],
    ['cqueue', 'cqueue\n  capacity 6\n  cells _ B C D _ _\n  front 1\n  rear 3\n'],
    ['deque', 'deque A B C D'],
    ['pqueue', 'pqueue\n  item Deploy 9\n  item Build 5\n  item Lint 2\n'],
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

function expectNoRotatedText(scene: Scene): void {
  expect(JSON.stringify(scene.elements)).not.toContain('rotate(');
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

function elementBounds(element: SceneElement): { x: number; y: number; width: number; height: number } | undefined {
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
