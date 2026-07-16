import { describe, it, expect } from 'vitest';
import * as parser from '../src/diagrams/triton/block/parser.js';
import type { BlockDocument, BlockEdge } from '../src/diagrams/triton/block/ir.js';
import type { ScenePath } from '../src/contracts/index.js';
import { layoutBlock } from '../src/diagrams/triton/block/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import { renderSync } from '../src/frontend/index.js';

function parse(src: string): BlockDocument {
  return parser.parse(src) as BlockDocument;
}

function header(body: string): string {
  return `block-beta\ncolumns 2\n  A["A"] B["B"]\n  ${body}\n`;
}

function edge(token: string, tail = ''): BlockEdge {
  const ir = parse(header(`A ${token} B${tail}`));
  expect(ir.edges).toHaveLength(1);
  return ir.edges[0]!;
}

function edgePath(token: string, tail = ''): ScenePath {
  const scene = layoutBlock(parse(header(`A ${token} B${tail}`)), defaultTheme).scene;
  const paths = scene.elements.filter((el): el is ScenePath => el.type === 'path');
  expect(paths).toHaveLength(1);
  return paths[0]!;
}

function edgeSvg(token: string, tail = ''): string {
  const result = renderSync(header(`A ${token} B${tail}`));
  expect(result.ok).toBe(true);
  if (!result.ok) return '';
  const match = result.value.match(/<path\b[\s\S]*?<\/path>|<path\b[^>]*\/>/);
  expect(match).not.toBeNull();
  return match![0]!;
}

describe('block connector grammar', () => {
  it.each([
    ['-->', 'solid', 'none', 'arrow'],
    ['-.->', 'dotted', 'none', 'arrow'],
    ['-_->', 'dashed', 'none', 'arrow'],
    ['==>', 'thick', 'none', 'arrow'],
    ['-~->', 'wavy', 'none', 'arrow'],
    ['---', 'solid', 'none', 'none'],
    ['-.-', 'dotted', 'none', 'none'],
    ['-_-', 'dashed', 'none', 'none'],
    ['===', 'thick', 'none', 'none'],
    ['-~-', 'wavy', 'none', 'none'],
    ['<-->', 'solid', 'arrow', 'arrow'],
    ['<-.->', 'dotted', 'arrow', 'arrow'],
    ['<-_->', 'dashed', 'arrow', 'arrow'],
    ['<==>', 'thick', 'arrow', 'arrow'],
    ['<-~->', 'wavy', 'arrow', 'arrow'],
  ] as const)('parses %s as %s with %s/%s markers', (token, style, startMarker, endMarker) => {
    const e = edge(token);
    expect(e.style).toBe(style);
    expect(e.startMarker).toBe(startMarker);
    expect(e.endMarker).toBe(endMarker);
  });

  it('preserves labels and parses annotation animation form', () => {
    const e = edge('-->', ' @anim:flow');
    expect(e.animation).toBe('flow');

    const labelled = parse(header('A --> |calls| B @anim:flow')).edges[0]!;
    expect(labelled.label).toBe('calls');
    expect(labelled.animation).toBe('flow');
  });

  it('parses property-block animation form', () => {
    expect(edge('-->', ' {anim: march}').animation).toBe('march');
  });

  it('parses none animation opt-out', () => {
    expect(edge('-->', ' @anim:none').animation).toBe('none');
    expect(edge('-->', ' {anim: none}').animation).toBe('none');
  });

  it('rejects invalid animation names', () => {
    expect(() => parse(header('A --> B @anim:spin'))).toThrow();
    expect(() => parse(header('A --> B {anim: spin}'))).toThrow();
  });
});

describe('block connector layout', () => {
  it('uses space fillers for empty block-beta cells without rendering filler blocks', () => {
    const scene = layoutBlock(parse('block-beta\ncolumns 4\n  A["A"] space:2 B["B"]\n  A --> B\n'), defaultTheme).scene;
    const rects = scene.elements.filter(el => el.type === 'rect');
    const texts = scene.elements.filter(el => el.type === 'text');
    const paths = scene.elements.filter(el => el.type === 'path');

    expect(rects).toHaveLength(2);
    expect(texts).toHaveLength(2);
    expect(paths).toHaveLength(1);
  });

  it('renders wavy connectors with curved geometry', () => {
    const solid = edgePath('-->');
    const wavy = edgePath('-~->');
    expect(wavy.d).not.toBe(solid.d);
    expect(wavy.d).toContain('C');
  });

  it('renders thick connectors with double stroke width', () => {
    expect(edgePath('==>').strokeWidth).toBe(3.2);
  });

  it('renders dashed connectors with a dash pattern', () => {
    expect(edgePath('-_->').strokeDasharray).toBe('8 4');
  });

  it('defaults dotted connectors to marching animation', () => {
    expect(edgePath('-.->').animated).toBe('march');
    expect(edgeSvg('-.->')).toContain('attributeName="stroke-dashoffset"');
  });

  it('defaults dashed connectors to marching animation', () => {
    expect(edgePath('-_->').animated).toBe('march');
    expect(edgeSvg('-_->')).toContain('attributeName="stroke-dashoffset"');
  });

  it('keeps solid connectors static by default', () => {
    expect(edgePath('-->').animated).toBeUndefined();
    expect(edgeSvg('-->')).not.toContain('<animate');
  });

  it('lets explicit dotted connector animation override default march', () => {
    const svg = edgeSvg('-.->', ' @anim:glow');
    expect(edgePath('-.->', ' @anim:glow').animated).toBe('glow');
    expect(svg).toContain('attributeName="stroke-opacity"');
    expect(svg).not.toContain('attributeName="stroke-dashoffset"');
  });

  it('lets none suppress dotted connector default animation', () => {
    expect(edgePath('-.->', ' @anim:none').animated).toBeUndefined();
    expect(edgeSvg('-.->', ' @anim:none')).not.toContain('<animate');
  });

  it('renders bidirectional connectors with a start marker', () => {
    const path = edgePath('<-->');
    expect(path.markerStart).toBe('block-arrow-start');
    expect(path.markerEnd).toBe('block-arrow');
  });

  it('renders connector animations on paths', () => {
    expect(edgePath('-->', ' @anim:flow').animated).toBe('flow');
  });
});
