import { describe, it, expect } from 'vitest';
import { memory, layoutMemory } from '../src/diagrams/triton/ds/struct/memory.js';
import { page, layoutPage } from '../src/diagrams/triton/ds/struct/page.js';
import type { ScenePath, SceneRect, SceneText, TextAnchor } from '../src/contracts/index.js';
import { renderSVG } from '../src/render/svg.js';
import { measureText } from '../src/text/metrics.js';
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

  it('parses quoted multi-word labels without changing bare labels', () => {
    const ir = memory.parseMermaid([
      'memory',
      '  region "Stack Frame"',
      '    var "head pointer" -> obj',
      '  region HEAP',
      '    object obj : "Point Record" : x=1',
      '',
    ].join('\n'));
    expect(ir.regions[0]!.name).toBe('Stack Frame');
    expect(ir.regions[0]!.items[0]).toEqual({ kind: 'var', name: 'head pointer', target: 'obj' });
    expect(ir.regions[1]!.name).toBe('HEAP');
    expect(ir.regions[1]!.items[0]).toMatchObject({ kind: 'object', id: 'obj', title: 'Point Record' });
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

  it('uses theme-derived translucent fills for memory panels', () => {
    const theme = {
      ...defaultTheme,
      palette: {
        ...defaultTheme.palette,
        surface: '#123456',
        border: '#654321',
        primary: '#abcdef',
      },
    };
    const ir = memory.parseMermaid([
      'memory',
      '  region STACK',
      '    var p -> obj',
      '  region HEAP',
      '    object obj : Point : x=1',
      '',
    ].join('\n'));
    const { scene } = layoutMemory(ir, theme);
    const rects = scene.elements.filter((e): e is SceneRect => e.type === 'rect');
    const [regionRect, varRect, , objectRect] = rects;

    expect(regionRect!.fill).toBe(theme.palette.surface);
    expect(regionRect!.fill).not.toBe('#fbfbfd');
    expect(regionRect!.stroke).toBe(theme.palette.border);
    expect(regionRect!.fillOpacity).toBe(0.26);

    expect(varRect!.fill).toBe(theme.palette.surface);
    expect(varRect!.stroke).toBe(theme.palette.border);
    expect(varRect!.fillOpacity).toBeGreaterThan(regionRect!.fillOpacity!);

    expect(objectRect!.fill).toBe(theme.palette.surface);
    expect(objectRect!.stroke).toBe(theme.palette.primary);
    expect(objectRect!.fillOpacity).toBeGreaterThan(regionRect!.fillOpacity!);

    const svg = renderSVG(scene);
    expect(svg).toContain('fill="#123456" fill-opacity="0.26"');
    expect(svg).not.toContain('#fbfbfd');
  });

  it('expands the viewBox to include a wide quoted region label', () => {
    const wide = 'Stack frame region label wide enough to grow the memory box';
    const ir = memory.parseMermaid(`memory\n  region "${wide}"\n    var p\n`);
    const { scene } = layoutMemory(ir, defaultTheme);
    const label = scene.elements.find((e): e is SceneText => e.type === 'text' && e.content === wide);
    expect(label).toBeDefined();
    const bounds = textBounds(label!);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(scene.viewBox.width);
  });
});

describe('page', () => {
  it('parses slots and tuples', () => {
    const ir = page.parseMermaid('page\n  title heap page\n  slots 3\n  tuples (10,Ann) (40,Bob) (50,Cy)\n');
    expect(ir.slots).toBe(3);
    expect(ir.tuples).toHaveLength(3);
  });

  it('parses quoted multi-word tuple labels without changing bare labels', () => {
    const ir = page.parseMermaid('page\n  tuples "(10,Ann Smith)" (40,Bob)\n');
    expect(ir.tuples).toEqual(['(10,Ann Smith)', '(40,Bob)']);
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

  it('centers slots above tuples and keeps arrows short and vertical', () => {
    const ir = page.parseMermaid('page\n  slots 4\n  tuples "(10,Alice Smith)" "(40,Bob)" "(90,Charlie Delta)"\n');
    const { scene, anchors } = layoutPage(ir, defaultTheme);
    const arrows = scene.elements.filter((e): e is ScenePath => e.type === 'path' && e.markerEnd != null);

    expect(arrows).toHaveLength(3);
    for (let i = 0; i < arrows.length; i++) {
      const slot = anchors[`slot${i}`]!.bounds;
      const tuple = anchors[`tuple${i}`]!.bounds;
      expect(centerX(slot)).toBeCloseTo(centerX(tuple), 6);
      expect(tuple.y - (slot.y + slot.height)).toBeLessThanOrEqual(52);
      expect(uniquePathXCoords(arrows[i]!.d)).toHaveLength(1);
    }
    expect(anchors['slot3']).toBeDefined();
    expect(anchors['tuple3']).toBeUndefined();
  });

  it('uses theme-derived fills for page panels and slots', () => {
    const theme = {
      ...defaultTheme,
      palette: {
        ...defaultTheme.palette,
        surface: '#123456',
        border: '#654321',
        primary: '#abcdef',
      },
    };
    const ir = page.parseMermaid('page\n  slots 2\n  tuples "(10,Alice Smith)" "(40,Bob Jones)"\n');
    const { scene } = layoutPage(ir, theme);
    const rects = scene.elements.filter((e): e is SceneRect => e.type === 'rect');
    const [pageRect, headerRect, slotRect] = rects;

    expect(pageRect!.fill).toBe(theme.palette.surface);
    expect(pageRect!.stroke).toBe(theme.palette.border);
    expect(headerRect!.fill).toBe(theme.palette.primary);
    expect(slotRect!.fill).toBe(theme.palette.primary);
    expect(slotRect!.fillOpacity).toBeGreaterThan(0);
    expect(slotRect!.fillOpacity).toBeLessThan(1);

    const svg = renderSVG(scene);
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('fill="#abcdef" fill-opacity=');
    expect(svg).not.toContain('#fbfbfd');
    expect(svg).not.toContain('#eef2ff');
  });

  it('expands the viewBox to include a wide quoted tuple label', () => {
    const wide = '(10,Alice Smith with a tuple payload wide enough to expand the page)';
    const ir = page.parseMermaid(`page\n  slots 1\n  tuples "${wide}"\n`);
    const { scene } = layoutPage(ir, defaultTheme);
    const label = scene.elements.find((e): e is SceneText => e.type === 'text' && e.content === wide);
    expect(label).toBeDefined();
    const bounds = textBounds(label!);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(scene.viewBox.width);
  });
});

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

function centerX(rect: { x: number; width: number }): number {
  return rect.x + rect.width / 2;
}

function uniquePathXCoords(d: string): number[] {
  const coords = [...d.matchAll(/[ML] ([0-9.]+) [0-9.]+/g)].map(match => Number(match[1]));
  return [...new Set(coords)];
}
