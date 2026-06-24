import { describe, it, expect } from 'vitest';
import { queue, layoutQueue } from '../src/diagrams/ds/queue/queue.js';
import { cqueue, layoutCQueue } from '../src/diagrams/ds/queue/cqueue.js';
import { deque, layoutDeque } from '../src/diagrams/ds/queue/deque.js';
import { pqueue, layoutPQueue } from '../src/diagrams/ds/queue/pqueue.js';
import { render } from '../src/frontend/index.js';
import { detect } from '../src/frontend/detect.js';
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
});

describe('deque', () => {
  it('parses cells and renders double-headed end arrows', () => {
    const ir = deque.parseMermaid('deque A B C');
    expect(ir.cells).toEqual(['A', 'B', 'C']);
    const { scene } = layoutDeque(ir, defaultTheme);
    const doubleHeaded = scene.elements.filter(
      e => e.type === 'path'
        && (e as { markerStart?: string }).markerStart != null
        && (e as { markerEnd?: string }).markerEnd != null,
    );
    expect(doubleHeaded.length).toBe(2);
  });
});

describe('priority queue', () => {
  it('parses item label + trailing priority', () => {
    const ir = pqueue.parseMermaid('pqueue\n  item Deploy job 9\n  item Lint 2\n');
    expect(ir.items).toEqual([
      { label: 'Deploy job', priority: 9 },
      { label: 'Lint', priority: 2 },
    ]);
  });

  it('orders highest priority at the top (smallest y)', () => {
    const ir = pqueue.parseMermaid('pqueue\n  item Low 1\n  item High 9\n  item Mid 5\n');
    const { scene } = layoutPQueue(ir, defaultTheme);
    const labelOf = (s: string) => scene.elements.find(
      e => e.type === 'text' && (e as { content: string }).content === s,
    ) as { position: { y: number } };
    expect(labelOf('High').position.y).toBeLessThan(labelOf('Mid').position.y);
    expect(labelOf('Mid').position.y).toBeLessThan(labelOf('Low').position.y);
  });

  it('shows the priority value per cell', () => {
    const ir = pqueue.parseMermaid('pqueue\n  item A 3\n  item B 8\n');
    const { scene } = layoutPQueue(ir, defaultTheme);
    const texts = scene.elements.filter(e => e.type === 'text').map(e => (e as { content: string }).content);
    expect(texts).toContain('3');
    expect(texts).toContain('8');
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
