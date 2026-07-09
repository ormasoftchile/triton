import { describe, it, expect } from 'vitest';
import { renderSVG } from '../src/render/svg.js';
import type { Scene } from '../src/contracts/index.js';

const emptyScene: Scene = {
  viewBox: { x: 0, y: 0, width: 200, height: 100 },
  elements: [],
};

describe('renderSVG', () => {
  it('produces a valid SVG opening and closing tag', () => {
    const svg = renderSVG(emptyScene);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('encodes viewBox correctly', () => {
    const svg = renderSVG(emptyScene);
    expect(svg).toContain('viewBox="0 0 200 100"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="100"');
  });

  it('emits background rect when background is set', () => {
    const svg = renderSVG({ ...emptyScene, background: '#fff' });
    expect(svg).toContain('fill="#fff"');
  });

  it('does not emit background rect when background is absent', () => {
    const svg = renderSVG(emptyScene);
    expect(svg).not.toContain('width="100%"');
  });

  it('emits <defs> block when defs are provided', () => {
    const svg = renderSVG({ ...emptyScene, defs: ['<marker id="a" />'] });
    expect(svg).toContain('<defs>');
    expect(svg).toContain('<marker id="a" />');
    expect(svg).toContain('</defs>');
  });

  it('renders rect element', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'rect', bounds: { x: 10, y: 20, width: 80, height: 40 }, fill: '#eee', stroke: '#999', strokeWidth: 1 }],
    });
    expect(svg).toContain('<rect');
    expect(svg).toContain('x="10"');
    expect(svg).toContain('fill="#eee"');
  });

  it('renders circle element', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'circle', center: { x: 50, y: 50 }, radius: 20, fill: '#abc', stroke: '#def', strokeWidth: 2 }],
    });
    expect(svg).toContain('<circle');
    expect(svg).toContain('cx="50"');
    expect(svg).toContain('r="20"');
  });

  it('renders text element and escapes XML entities', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'text', content: 'A & <B>', position: { x: 10, y: 30 }, fontSize: 14, fontFamily: 'sans-serif', fill: '#000' }],
    });
    expect(svg).toContain('<text');
    expect(svg).toContain('A &amp; &lt;B&gt;');
  });

  it('renders path element', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'path', d: 'M 0 0 L 100 100', stroke: '#000', strokeWidth: 1.5 }],
    });
    expect(svg).toContain('<path');
    expect(svg).toContain('d="M 0 0 L 100 100"');
    expect(svg).toContain('fill="none"');
  });

  it('path with fill overrides the default none', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'path', d: 'M 0 0', stroke: '#000', strokeWidth: 1, fill: '#red' }],
    });
    expect(svg).toContain('fill="#red"');
  });

  it('renders empty fills as none while preserving real fills', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [
        { type: 'rect', bounds: { x: 0, y: 0, width: 10, height: 10 }, fill: '', stroke: '#111', strokeWidth: 1 },
        { type: 'circle', center: { x: 20, y: 20 }, radius: 5, fill: '   ', stroke: '#222', strokeWidth: 1 },
        { type: 'text', content: 'T', position: { x: 0, y: 20 }, fontSize: 12, fontFamily: 'sans-serif', fill: '' },
        { type: 'path', d: 'M 0 0 L 1 1', stroke: '#333', strokeWidth: 1, fill: '' },
        { type: 'rect', bounds: { x: 30, y: 0, width: 10, height: 10 }, fill: '#123456', stroke: '#444', strokeWidth: 1 },
      ],
    });
    expect(svg).not.toContain('fill=""');
    expect(svg.match(/fill="none"/g)).toHaveLength(4);
    expect(svg).toContain('fill="#123456"');
  });

  it('renders group element with children', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{
        type: 'group',
        id: 'my-group',
        children: [{ type: 'circle', center: { x: 5, y: 5 }, radius: 5, fill: '#f00', stroke: '#000', strokeWidth: 1 }],
      }],
    });
    expect(svg).toContain('<g id="my-group">');
    expect(svg).toContain('<circle');
    expect(svg).toContain('</g>');
  });

  it('renders empty group as self-closing', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'group', children: [] }],
    });
    expect(svg).toContain('<g />');
  });

  it('renders group transform', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'group', children: [], transform: 'translate(10, 20)' }],
    });
    expect(svg).toContain('transform="translate(10, 20)"');
  });

  it('renders markerEnd on path', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'path', d: 'M 0 0 L 10 10', stroke: '#000', strokeWidth: 1, markerEnd: 'arrow' }],
    });
    expect(svg).toContain('marker-end="url(#arrow)"');
  });

  it('renders strokeDasharray on path', () => {
    const svg = renderSVG({
      ...emptyScene,
      elements: [{ type: 'path', d: 'M 0 0', stroke: '#000', strokeWidth: 1, strokeDasharray: '4 2' }],
    });
    expect(svg).toContain('stroke-dasharray="4 2"');
  });
});
