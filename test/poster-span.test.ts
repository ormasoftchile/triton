import { describe, it, expect } from 'vitest';
import { assignPositions } from '../src/diagrams/poster/layout.js';
import type { PosterCell } from '../src/diagrams/poster/ir.js';

const cell = (id: string, span?: { colSpan?: number; rowSpan?: number }): PosterCell =>
  ({ id, content: { kind: 'text', text: id }, ...span } as PosterCell);

const at = (placed: PosterCell[], id: string) => placed.find(c => c.id === id)!;

describe('poster grid placement', () => {
  it('flows single cells left-to-right, wrapping at the column count', () => {
    const placed = assignPositions([cell('a'), cell('b'), cell('c'), cell('d')], 3);
    expect(at(placed, 'a')).toMatchObject({ row: 0, col: 0 });
    expect(at(placed, 'c')).toMatchObject({ row: 0, col: 2 });
    expect(at(placed, 'd')).toMatchObject({ row: 1, col: 0 });
  });

  it('advances by colSpan so a [2] cell occupies two columns', () => {
    const placed = assignPositions([cell('wide', { colSpan: 2 }), cell('x'), cell('y')], 3);
    expect(at(placed, 'wide')).toMatchObject({ row: 0, col: 0 });
    expect(at(placed, 'x')).toMatchObject({ row: 0, col: 2 });
    expect(at(placed, 'y')).toMatchObject({ row: 1, col: 0 });
  });

  it('reserves rows a rowSpan covers so later cells skip the occupied column', () => {
    const placed = assignPositions(
      [cell('tall', { rowSpan: 2 }), cell('a'), cell('b'), cell('c'), cell('d')], 3);
    expect(at(placed, 'tall')).toMatchObject({ row: 0, col: 0 });
    expect(at(placed, 'a')).toMatchObject({ row: 0, col: 1 });
    expect(at(placed, 'b')).toMatchObject({ row: 0, col: 2 });
    // col 0 of row 1 is still occupied by `tall`, so `c` must skip to col 1
    expect(at(placed, 'c')).toMatchObject({ row: 1, col: 1 });
    expect(at(placed, 'd')).toMatchObject({ row: 1, col: 2 });
  });

  it('clamps a colSpan wider than the grid', () => {
    const placed = assignPositions([cell('huge', { colSpan: 5 }), cell('next')], 3);
    expect(at(placed, 'huge')).toMatchObject({ row: 0, col: 0 });
    expect(at(placed, 'next')).toMatchObject({ row: 1, col: 0 });
  });
});
