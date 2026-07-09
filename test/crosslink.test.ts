/**
 * Tests for cross-link resolution and rendering.
 */

import { describe, it, expect } from 'vitest';
import { resolveCrossLinks } from '../src/crosslink/resolve.js';
import { renderCrossLinks } from '../src/crosslink/render.js';
import { crossLinksToConnectorSpecs, routeConnectors } from '../src/crosslink/connectors.js';
import { routeAndRenderCrossLinks3 } from '../src/crosslink/engine3.js';
import { renderSVG } from '../src/render/svg.js';
import { resolveTheme } from '../src/theme/resolver.js';
import { defaultTheme } from '../src/theme/preset.js';
import { registerRouter } from '../src/routing/registry.js';
import { countRouteCollisions, orthogonalRouter } from '../src/routing/router.js';
import type { NodeAnchorRegistry } from '../src/contracts/anchors.js';
import type { CrossLink } from '../src/contracts/crosslink.js';

// Ensure orthogonal router is registered
registerRouter('orthogonal', orthogonalRouter);

const theme = resolveTheme({}, defaultTheme);

// ─── Test anchor registry ─────────────────────────────────────────────────────

const anchors: NodeAnchorRegistry = {
  'A.node1': {
    bounds: { x: 10, y: 10, width: 100, height: 40 },
    ports: { N: { x: 60, y: 10 }, S: { x: 60, y: 50 }, E: { x: 110, y: 30 }, W: { x: 10, y: 30 } },
  },
  'A.node2': {
    bounds: { x: 10, y: 80, width: 100, height: 40 },
    ports: { N: { x: 60, y: 80 }, S: { x: 60, y: 120 }, E: { x: 110, y: 100 }, W: { x: 10, y: 100 } },
  },
  'B.node1': {
    bounds: { x: 300, y: 10, width: 100, height: 40 },
    ports: { N: { x: 350, y: 10 }, S: { x: 350, y: 50 }, E: { x: 400, y: 30 }, W: { x: 300, y: 30 } },
  },
  'B.node2': {
    bounds: { x: 300, y: 80, width: 100, height: 40 },
    ports: { N: { x: 350, y: 80 }, S: { x: 350, y: 120 }, E: { x: 400, y: 100 }, W: { x: 300, y: 100 } },
  },
};

// ─── Resolution Tests ─────────────────────────────────────────────────────────

describe('resolveCrossLinks', () => {
  it('resolves a valid link between two cells', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'directed',
      style: 'solid',
    }];

    const result = resolveCrossLinks(links, anchors);

    expect(result.resolved).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(0);

    const r = result.resolved[0]!;
    expect(r.fromSide).toBe('E');  // Closest ports: A.node1.E → B.node1.W
    expect(r.toSide).toBe('W');
    expect(r.fromPort).toEqual({ x: 110, y: 30 });
    expect(r.toPort).toEqual({ x: 300, y: 30 });
  });

  it('resolves multiple links', () => {
    const links: CrossLink[] = [
      {
        from: { cellPath: ['A'], nodeId: 'node1' },
        to:   { cellPath: ['B'], nodeId: 'node1' },
        direction: 'directed',
        style: 'solid',
      },
      {
        from: { cellPath: ['A'], nodeId: 'node2' },
        to:   { cellPath: ['B'], nodeId: 'node2' },
        direction: 'bidirectional',
        style: 'dashed',
      },
    ];

    const result = resolveCrossLinks(links, anchors);
    expect(result.resolved).toHaveLength(2);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('reports diagnostic for missing source node', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['C'], nodeId: 'missing' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'directed',
      style: 'solid',
    }];

    const result = resolveCrossLinks(links, anchors);
    expect(result.resolved).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain('C.missing');
    expect(result.diagnostics[0]!.message).toContain('source');
  });

  it('reports diagnostic for missing target node', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'nonexistent' },
      direction: 'directed',
      style: 'solid',
    }];

    const result = resolveCrossLinks(links, anchors);
    expect(result.resolved).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain('target');
  });

  it('selects nearest port pair (vertical nodes select S→N)', () => {
    // A.node1 is above B.node1 if we adjust registry
    const vertAnchors: NodeAnchorRegistry = {
      'A.top': {
        bounds: { x: 100, y: 10, width: 80, height: 40 },
        ports: { N: { x: 140, y: 10 }, S: { x: 140, y: 50 }, E: { x: 180, y: 30 }, W: { x: 100, y: 30 } },
      },
      'B.bottom': {
        bounds: { x: 100, y: 200, width: 80, height: 40 },
        ports: { N: { x: 140, y: 200 }, S: { x: 140, y: 240 }, E: { x: 180, y: 220 }, W: { x: 100, y: 220 } },
      },
    };

    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'top' },
      to:   { cellPath: ['B'], nodeId: 'bottom' },
      direction: 'directed',
      style: 'solid',
    }];

    const result = resolveCrossLinks(links, vertAnchors);
    expect(result.resolved[0]!.fromSide).toBe('S');
    expect(result.resolved[0]!.toSide).toBe('N');
  });

  it('handles nested cell paths', () => {
    const nestedAnchors: NodeAnchorRegistry = {
      'poster1.A.node1': {
        bounds: { x: 10, y: 10, width: 80, height: 40 },
      },
      'poster1.B.node1': {
        bounds: { x: 300, y: 10, width: 80, height: 40 },
      },
    };

    const links: CrossLink[] = [{
      from: { cellPath: ['poster1', 'A'], nodeId: 'node1' },
      to:   { cellPath: ['poster1', 'B'], nodeId: 'node1' },
      direction: 'undirected',
      style: 'dotted',
    }];

    const result = resolveCrossLinks(links, nestedAnchors);
    expect(result.resolved).toHaveLength(1);
  });
});

// ─── Rendering Tests ──────────────────────────────────────────────────────────

describe('renderCrossLinks', () => {
  it('produces path elements for resolved links', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'directed',
      style: 'solid',
    }];

    const { resolved } = resolveCrossLinks(links, anchors);
    const result = renderCrossLinks(resolved, theme);

    expect(result.elements.length).toBeGreaterThanOrEqual(1);
    const pathEl = result.elements[0]!;
    expect(pathEl.type).toBe('path');
    expect(result.defs.length).toBeGreaterThanOrEqual(1);
    expect(result.defs[0]).toContain('triton-crosslink-arrow');
  });

  it('renders labels when present', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'directed',
      style: 'solid',
      label: 'calls',
    }];

    const { resolved } = resolveCrossLinks(links, anchors);
    const result = renderCrossLinks(resolved, theme);

    const textEls = result.elements.filter(e => e.type === 'text');
    expect(textEls).toHaveLength(1);
    expect((textEls[0] as any).content).toBe('calls');
  });

  it('applies dashed stroke for dashed style', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'directed',
      style: 'dashed',
    }];

    const { resolved } = resolveCrossLinks(links, anchors);
    const result = renderCrossLinks(resolved, theme);

    const pathEl = result.elements.find(e => e.type === 'path') as any;
    expect(pathEl.strokeDasharray).toBe('8 4');
  });

  it('applies dotted stroke for dotted style', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node2' },
      to:   { cellPath: ['B'], nodeId: 'node2' },
      direction: 'undirected',
      style: 'dotted',
    }];

    const { resolved } = resolveCrossLinks(links, anchors);
    const result = renderCrossLinks(resolved, theme);

    const pathEl = result.elements.find(e => e.type === 'path') as any;
    expect(pathEl.strokeDasharray).toBe('4 3');
  });

  it('renders bidirectional markers', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'bidirectional',
      style: 'solid',
    }];

    const { resolved } = resolveCrossLinks(links, anchors);
    const result = renderCrossLinks(resolved, theme);

    const pathEl = result.elements.find(e => e.type === 'path') as any;
    expect(pathEl.markerEnd).toBe('triton-crosslink-arrow');
    expect(pathEl.markerStart).toBe('triton-crosslink-arrow-both');
    expect(result.defs).toHaveLength(2);
  });

  it('no markers for undirected links', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'undirected',
      style: 'solid',
    }];

    const { resolved } = resolveCrossLinks(links, anchors);
    const result = renderCrossLinks(resolved, theme);

    const pathEl = result.elements.find(e => e.type === 'path') as any;
    expect(pathEl.markerEnd).toBeUndefined();
    expect(pathEl.markerStart).toBeUndefined();
    expect(result.defs).toHaveLength(0);
  });
});

describe('routeConnectors', () => {
  it('adapts poster cross-links to the shared connector seam without changing engine3 output', () => {
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'node1' },
      to:   { cellPath: ['B'], nodeId: 'node1' },
      direction: 'directed',
      style: 'solid',
      label: 'same',
      routing: 'orthogonal',
    }];

    const direct = routeAndRenderCrossLinks3(links, theme, anchors);
    const shared = routeConnectors({
      anchors,
      connectors: crossLinksToConnectorSpecs(links),
      theme,
    });

    expect(shared.diagnostics).toHaveLength(0);
    expect(shared.defs).toEqual(direct.defs);
    expect(shared.elements).toEqual(direct.elements);
    expect(shared.pathElements).toEqual(direct.elements.filter(e => e.type !== 'text'));
    expect(shared.labelElements).toEqual(direct.elements.filter(e => e.type === 'text'));
  });

  it('forced N→N link between vertically stacked boxes routes around endpoint boxes', () => {
    const wallAnchors: NodeAnchorRegistry = {
      'A.top': {
        bounds: { x: 0, y: 0, width: 100, height: 40 },
      },
      'B.bottom': {
        bounds: { x: 0, y: 200, width: 100, height: 40 },
      },
      'A.tuple': {
        bounds: { x: 20, y: 70, width: 80, height: 40 },
      },
      'B.tuple': {
        bounds: { x: 20, y: 270, width: 80, height: 40 },
      },
    };
    const cellRects = new Map([
      ['A', { x: -20, y: -40, width: 180, height: 180 }],
      ['B', { x: -20, y: 160, width: 180, height: 180 }],
    ]);
    const links: CrossLink[] = [{
      from: { cellPath: ['A'], nodeId: 'top' },
      to:   { cellPath: ['B'], nodeId: 'bottom' },
      direction: 'directed',
      style: 'solid',
      routing: 'orthogonal',
      exitWall: 'N',
      entryWall: 'N',
    }];

    const result = routeAndRenderCrossLinks3(links, theme, wallAnchors, undefined, undefined, undefined, cellRects);
    const path = result.elements.find(e => e.type === 'path') as { d: string } | undefined;
    expect(path?.d).toBeDefined();
    const pts = pathPoints(path!.d);
    expect(pts.some(p => p.y < 0)).toBe(true);
    expect(pts.some(p => p.x < -20 || p.x > 160)).toBe(true);
    expect(countRouteCollisions(pts, [wallAnchors['A.tuple']!.bounds, wallAnchors['B.tuple']!.bounds])).toBe(0);
  });

  it('threads every connector animation value to scene paths and SVG SMIL', () => {
    const cases = [
      { anim: 'march', style: 'dashed', expect: 'attributeName="stroke-dashoffset"' },
      { anim: 'particle', expect: '<animateMotion dur="1.5s"' },
      { anim: 'draw', expect: 'values="0;' },
      { anim: 'pulse', expect: 'attributeName="stroke-width"' },
      { anim: 'glow', expect: 'attributeName="stroke-opacity"' },
      { anim: 'comet', expect: 'begin="-0.36s"' },
      { anim: 'stream', expect: 'begin="-1.5s"' },
      { anim: 'flow', expect: '<linearGradient id="triton-flow-' },
      { anim: 'colorcycle', expect: 'attributeName="stroke" values="#4A90D9;#9b51e0;#e54444;#2ecc71;#4A90D9"' },
    ] as const;

    for (const c of cases) {
      const { path, svg } = renderAnimatedConnector(c.anim, c.style ?? 'solid');
      expect(path.animated).toBe(c.anim);
      expect(svg).toContain(c.expect);
    }
  });

  it('emits the expected particle counts for particle, comet, and stream animations', () => {
    expect(countOccurrences(renderAnimatedConnector('particle').svg, '<animateMotion ')).toBe(1);
    expect(countOccurrences(renderAnimatedConnector('comet').svg, '<animateMotion ')).toBe(3);
    expect(countOccurrences(renderAnimatedConnector('stream').svg, '<animateMotion ')).toBe(4);
  });

  it('trims particle, comet, and stream motion paths short of the visible connector endpoint', () => {
    for (const anim of ['particle', 'comet', 'stream'] as const) {
      const { path, svg } = renderAnimatedConnector(anim);
      expect(svg).toContain(`<path d="${path.d}"`);

      const visiblePts = pathPoints(path.d);
      const visibleEnd = visiblePts[visiblePts.length - 1]!;
      const visiblePrev = visiblePts[visiblePts.length - 2]!;
      const visibleLastSegment = Math.hypot(visibleEnd.x - visiblePrev.x, visibleEnd.y - visiblePrev.y);
      const motionPaths = animateMotionPaths(svg);
      expect(motionPaths.length).toBeGreaterThan(0);

      for (const motionPath of motionPaths) {
        expect(motionPath).not.toBe(path.d);
        const motionPts = pathPoints(motionPath);
        const motionEnd = motionPts[motionPts.length - 1]!;
        expect(Math.hypot(visibleEnd.x - motionEnd.x, visibleEnd.y - motionEnd.y)).toBeCloseTo(12, 5);
        expect(Math.hypot(motionEnd.x - visiblePrev.x, motionEnd.y - visiblePrev.y)).toBeCloseTo(visibleLastSegment - 12, 5);
      }
    }
  });

  it('clamps short animated motion segments without inverting them', () => {
    const svg = renderSVG({
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      elements: [{
        type: 'path',
        d: 'M 0 0 L 5 0',
        stroke: '#000',
        strokeWidth: 1,
        fill: 'none',
        markerEnd: 'arrow',
        animated: 'particle',
      }],
    });
    const motionPts = pathPoints(animateMotionPaths(svg)[0]!);
    expect(svg).toContain('<path d="M 0 0 L 5 0"');
    expect(motionPts[motionPts.length - 1]).toEqual({ x: 1, y: 0 });
  });

  it('emits flow gradients and draw dashoffset animation constructs', () => {
    const flow = renderAnimatedConnector('flow').svg;
    expect(flow).toContain('gradientUnits="userSpaceOnUse"');
    expect(flow).toContain('attributeName="offset"');
    expect(flow).toContain('stroke="url(#triton-flow-');

    const draw = renderAnimatedConnector('draw').svg;
    expect(draw).toContain('stroke-dasharray="190 190"');
    expect(draw).toContain('attributeName="stroke-dashoffset"');
  });

  it('renders none and unknown animation values as plain paths', () => {
    for (const anim of ['none', 'unknown-animation'] as const) {
      const { path, svg } = renderAnimatedConnector(anim);
      expect(path.animated).toBeUndefined();
      expect(svg).not.toContain('<animate');
      expect(svg).not.toContain('<animateMotion');
      expect(svg).not.toContain('<linearGradient');
    }
  });
});

function pathPoints(d: string): Array<{ x: number; y: number }> {
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i]!, y: nums[i + 1]! });
  }
  return pts;
}

function renderAnimatedConnector(anim: string, style: 'solid' | 'dashed' | 'dotted' = 'solid') {
  const result = routeConnectors({
    anchors,
    connectors: [{
      fromKey: 'A.node1',
      toKey: 'B.node1',
      direction: 'undirected',
      style,
      animation: anim as any,
    }],
    theme,
  });
  const path = result.pathElements.find(e => e.type === 'path');
  if (!path || path.type !== 'path') throw new Error(`No path for ${anim}`);
  const svg = renderSVG({
    viewBox: { x: 0, y: 0, width: 420, height: 140 },
    elements: result.elements,
    defs: result.defs,
  });
  return { path, svg };
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function animateMotionPaths(svg: string): string[] {
  return [...svg.matchAll(/<animateMotion\b[^>]*\bpath="([^"]+)"/g)].map(m => m[1]!);
}
