/**
 * Tests for cross-link resolution and rendering.
 */

import { describe, it, expect } from 'vitest';
import { resolveCrossLinks } from '../src/crosslink/resolve.js';
import { renderCrossLinks } from '../src/crosslink/render.js';
import { resolveTheme } from '../src/theme/resolver.js';
import { defaultTheme } from '../src/theme/preset.js';
import { registerRouter } from '../src/routing/registry.js';
import { orthogonalRouter } from '../src/routing/router.js';
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
