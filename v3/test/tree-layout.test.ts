import { describe, it, expect } from 'vitest';
import { treeLayout, type TreeNodeInput } from '../src/graph/tree.js';

const n = (id: string, children: string[] = [], width = 40, height = 30): TreeNodeInput =>
  ({ id, width, height, children });

const centerX = (b: { x: number; width: number }) => b.x + b.width / 2;
const centerY = (b: { y: number; height: number }) => b.y + b.height / 2;

describe('treeLayout', () => {
  it('places a single node at the margin', () => {
    const r = treeLayout([n('a')], { margin: 10 });
    const a = r.boxes.get('a')!;
    expect(a.x).toBe(10);
    expect(a.y).toBe(10);
  });

  it('centers a parent over two children (TB)', () => {
    const r = treeLayout([n('root', ['l', 'r']), n('l'), n('r')]);
    const root = r.boxes.get('root')!, l = r.boxes.get('l')!, rr = r.boxes.get('r')!;
    expect(centerX(root)).toBeCloseTo((centerX(l) + centerX(rr)) / 2, 5);
    // children are deeper than the parent
    expect(l.y).toBeGreaterThan(root.y);
    expect(rr.y).toBe(l.y);
  });

  it('does not overlap sibling subtrees', () => {
    const nodes = [n('root', ['a', 'b']), n('a', ['a1', 'a2']), n('b', ['b1', 'b2']),
      n('a1'), n('a2'), n('b1'), n('b2')];
    const r = treeLayout(nodes, { siblingGap: 20 });
    const a2 = r.boxes.get('a2')!, b1 = r.boxes.get('b1')!;
    expect(a2.x + a2.width).toBeLessThanOrEqual(b1.x); // no horizontal overlap
  });

  it('LR direction stacks siblings vertically and depth horizontally', () => {
    const r = treeLayout([n('root', ['l', 'r']), n('l'), n('r')], { direction: 'LR' });
    const root = r.boxes.get('root')!, l = r.boxes.get('l')!, rr = r.boxes.get('r')!;
    expect(l.x).toBeGreaterThan(root.x);        // children to the right
    expect(centerY(root)).toBeCloseTo((centerY(l) + centerY(rr)) / 2, 5);
  });

  it('reports a bounding size covering all boxes', () => {
    const r = treeLayout([n('root', ['l', 'r']), n('l'), n('r')], { margin: 12 });
    for (const b of r.boxes.values()) {
      expect(b.x + b.width).toBeLessThanOrEqual(r.width);
      expect(b.y + b.height).toBeLessThanOrEqual(r.height);
    }
  });

  it('is deterministic', () => {
    const nodes = [n('root', ['a', 'b']), n('a'), n('b')];
    expect(treeLayout(nodes)).toEqual(treeLayout(nodes));
  });
});
