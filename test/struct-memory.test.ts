import { describe, it, expect } from 'vitest';
import { memory, layoutMemory } from '../src/diagrams/triton/ds/struct/memory.js';
import { page, layoutPage } from '../src/diagrams/triton/ds/struct/page.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('memory', () => {
  const src = [
    'memory',
    '  title stack -> heap',
    '  region STACK',
    '    var p -> obj',
    '  region HEAP',
    '    object obj : Point : x=1, y=2',
    '',
  ].join('\n');

  it('parses regions, vars and objects', () => {
    const ir = memory.parseMermaid(src);
    expect(ir.regions).toHaveLength(2);
    expect(ir.regions[0]!.name).toBe('STACK');
    expect(ir.regions[0]!.items[0]).toEqual({ kind: 'var', name: 'p', target: 'obj' });
    const obj = ir.regions[1]!.items[0]!;
    expect(obj).toMatchObject({ kind: 'object', id: 'obj', title: 'Point' });
    expect((obj as { fields: unknown[] }).fields).toEqual([{ k: 'x', v: '1' }, { k: 'y', v: '2' }]);
  });

  it('anchors the var and the object, and draws a cross-region pointer', () => {
    const ir = memory.parseMermaid(src);
    const { scene, anchors } = layoutMemory(ir, defaultTheme);
    expect(anchors['p']).toBeDefined();
    expect(anchors['obj']).toBeDefined();
    // the pointer is the only path with the arrow marker
    const arrows = scene.elements.filter(e => e.type === 'path' && e.markerEnd != null);
    expect(arrows.length).toBeGreaterThanOrEqual(1);
    // the object sits to the right of the var (cross-region)
    expect(anchors['obj']!.bounds.x).toBeGreaterThan(anchors['p']!.bounds.x);
  });
});

describe('page', () => {
  it('parses slots and tuples', () => {
    const ir = page.parseMermaid('page\n  title heap page\n  slots 3\n  tuples (10,Ann) (40,Bob) (50,Cy)\n');
    expect(ir.slots).toBe(3);
    expect(ir.tuples).toHaveLength(3);
  });

  it('defaults slot count to tuple count', () => {
    const ir = page.parseMermaid('page\n  tuples (1,a) (2,b)\n');
    const { anchors } = layoutPage(ir, defaultTheme);
    expect(anchors['slot0']).toBeDefined();
    expect(anchors['slot1']).toBeDefined();
    expect(anchors['slot2']).toBeUndefined();
  });

  it('anchors every slot and tuple and draws indirection arrows', () => {
    const ir = page.parseMermaid('page\n  slots 3\n  tuples (10,Ann) (40,Bob) (50,Cy)\n');
    const { scene, anchors } = layoutPage(ir, defaultTheme);
    expect(anchors['slot2']).toBeDefined();
    expect(anchors['tuple2']).toBeDefined();
    const arrows = scene.elements.filter(e => e.type === 'path' && e.markerEnd != null);
    expect(arrows).toHaveLength(3);
  });
});
