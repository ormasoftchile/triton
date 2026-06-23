import { describe, it, expect } from 'vitest';
import { compileOverlays } from '../src/overlay/compiler.js';
import { layoutOverlays } from '../src/overlay/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { Scene } from '../src/contracts/index.js';

const baseScene: Scene = {
  viewBox: { x: 0, y: 0, width: 400, height: 300 },
  background: '#fff',
  elements: [
    { type: 'group', id: 'node-a', children: [{ type: 'rect', bounds: { x: 50, y: 100, width: 120, height: 40 }, fill: '#eee', stroke: '#999', strokeWidth: 1 }] },
  ],
};

describe('compileOverlays', () => {
  it('empty array returns empty annotations and no legend', () => {
    const result = compileOverlays([]);
    expect(result.annotations).toHaveLength(0);
    expect(result.legend).toBeUndefined();
  });

  it('note produces an annotation with elementId anchor', () => {
    const result = compileOverlays([{ type: 'note', text: 'Hello', target: 'node-a' }]);
    expect(result.annotations).toHaveLength(1);
    const ann = result.annotations[0]!;
    expect(ann.text).toBe('Hello');
    expect('elementId' in ann.anchor).toBe(true);
    if ('elementId' in ann.anchor) expect(ann.anchor.elementId).toBe('node-a');
  });

  it('note with offset applies offset as position', () => {
    const result = compileOverlays([{ type: 'note', text: 'Hi', target: 'x', offset: { dx: 20, dy: -30 } }]);
    expect(result.annotations[0]!.position).toEqual({ x: 20, y: -30 });
  });

  it('note without offset uses default offset (0, -60)', () => {
    const result = compileOverlays([{ type: 'note', text: 'Hi', target: 'x' }]);
    expect(result.annotations[0]!.position).toEqual({ x: 0, y: -60 });
  });

  it('legend produces a legend with parsed corner', () => {
    const result = compileOverlays([{ type: 'legend', corner: 'top-left', title: 'My Legend', entries: [{ key: 'v', value: '1.0' }] }]);
    expect(result.legend).toBeDefined();
    expect(result.legend!.corner).toBe('top-left');
    expect(result.legend!.title).toBe('My Legend');
    expect(result.legend!.entries).toHaveLength(1);
  });

  it('invalid corner defaults to bottom-right', () => {
    const result = compileOverlays([{ type: 'legend', corner: 'center', entries: [] }]);
    expect(result.legend!.corner).toBe('bottom-right');
  });

  it('multiple notes produce multiple annotations with unique IDs', () => {
    const result = compileOverlays([
      { type: 'note', text: 'A', target: 'alpha' },
      { type: 'note', text: 'B', target: 'beta' },
    ]);
    expect(result.annotations).toHaveLength(2);
    expect(result.annotations[0]!.id).not.toBe(result.annotations[1]!.id);
  });
});

describe('layoutOverlays', () => {
  it('returns no elements and unchanged viewBox for empty overlays', () => {
    const { elements, viewBox } = layoutOverlays({ annotations: [] }, baseScene, defaultTheme);
    expect(elements).toHaveLength(0);
    expect(viewBox).toEqual(baseScene.viewBox);
  });

  it('annotation for unknown element ID is skipped', () => {
    const compiled = compileOverlays([{ type: 'note', text: 'Hi', target: 'nonexistent' }]);
    const { elements } = layoutOverlays(compiled, baseScene, defaultTheme);
    expect(elements).toHaveLength(0);
  });

  it('annotation for known element ID produces group elements', () => {
    const compiled = compileOverlays([{ type: 'note', text: 'Important', target: 'node-a' }]);
    const { elements } = layoutOverlays(compiled, baseScene, defaultTheme);
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0]!.type).toBe('group');
  });

  it('legend produces a group element', () => {
    const compiled = compileOverlays([{ type: 'legend', corner: 'bottom-right', entries: [{ key: 'Author', value: 'Team' }] }]);
    const { elements } = layoutOverlays(compiled, baseScene, defaultTheme);
    expect(elements.length).toBeGreaterThan(0);
  });

  it('bottom-right legend is positioned within the viewBox', () => {
    const compiled = compileOverlays([{ type: 'legend', corner: 'bottom-right', entries: [{ key: 'k', value: 'v' }] }]);
    const { viewBox } = layoutOverlays(compiled, baseScene, defaultTheme);
    // viewBox should not shrink
    expect(viewBox.width).toBeGreaterThanOrEqual(baseScene.viewBox.width);
    expect(viewBox.height).toBeGreaterThanOrEqual(baseScene.viewBox.height);
  });

  it('annotation outside scene bounds expands the viewBox', () => {
    // Place annotation way above the scene
    const scene: Scene = { ...baseScene, elements: [
      { type: 'group', id: 'far', children: [{ type: 'rect', bounds: { x: 10, y: 10, width: 60, height: 30 }, fill: '#eee', stroke: '#999', strokeWidth: 1 }] },
    ]};
    const compiled = compileOverlays([{ type: 'note', text: 'Way above', target: 'far', offset: { dx: 0, dy: -200 } }]);
    const { viewBox } = layoutOverlays(compiled, scene, defaultTheme);
    expect(viewBox.y).toBeLessThan(0);
  });
});
