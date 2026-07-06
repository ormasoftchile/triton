import { describe, it, expect } from 'vitest';
import '../src/frontend/index.js'; // registers diagram modules
import { layoutFlowchart } from '../src/diagrams/mermaid/flowchart/layout.js';
import { layoutTimeline } from '../src/diagrams/mermaid/timeline/layout.js';
import { layoutPoster } from '../src/diagrams/triton/poster/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { FlowDocument } from '../src/diagrams/mermaid/flowchart/ir.js';
import type { TimelineDocument } from '../src/diagrams/mermaid/timeline/ir.js';
import type { PosterDocument } from '../src/diagrams/triton/poster/ir.js';

const flowDoc: FlowDocument = {
  version: '1.0',
  metadata: {},
  direction: 'LR',
  nodes: [
    { id: 'A', label: 'Start', shape: 'rect' },
    { id: 'B', label: 'End',   shape: 'rect' },
  ],
  edges: [{ from: 'A', to: 'B', kind: 'sync', style: 'solid' }],
  subgraphs: [],
};

const timelineDoc: TimelineDocument = {
  version: '1.0',
  metadata: {},
  layout: 'horizontal',
  tracks: [{ id: 'default', label: 'Default' }],
  activities: [{ id: 'a1', label: 'Task', start: '2025-01', track: 'default' }],
  milestones: [{ id: 'm1', label: 'Launch', date: '2025-06' }],
};

describe('anchor registry', () => {
  describe('flowchart anchors', () => {
    it('produces anchors for every node', () => {
      const { anchors } = layoutFlowchart(flowDoc, defaultTheme);
      expect(Object.keys(anchors)).toContain('A');
      expect(Object.keys(anchors)).toContain('B');
    });

    it('anchor bounds have positive dimensions', () => {
      const { anchors } = layoutFlowchart(flowDoc, defaultTheme);
      const a = anchors['A']!;
      expect(a.bounds.width).toBeGreaterThan(0);
      expect(a.bounds.height).toBeGreaterThan(0);
    });

    it('anchors include cardinal ports', () => {
      const { anchors } = layoutFlowchart(flowDoc, defaultTheme);
      const a = anchors['A']!;
      expect(a.ports).toBeDefined();
      expect(a.ports!.N).toBeDefined();
      expect(a.ports!.S).toBeDefined();
      expect(a.ports!.E).toBeDefined();
      expect(a.ports!.W).toBeDefined();
    });

    it('port N is at top center of bounds', () => {
      const { anchors } = layoutFlowchart(flowDoc, defaultTheme);
      const a = anchors['A']!;
      expect(a.ports!.N!.x).toBeCloseTo(a.bounds.x + a.bounds.width / 2);
      expect(a.ports!.N!.y).toBeCloseTo(a.bounds.y);
    });

    it('port E is at right center of bounds', () => {
      const { anchors } = layoutFlowchart(flowDoc, defaultTheme);
      const a = anchors['A']!;
      expect(a.ports!.E!.x).toBeCloseTo(a.bounds.x + a.bounds.width);
      expect(a.ports!.E!.y).toBeCloseTo(a.bounds.y + a.bounds.height / 2);
    });
  });

  describe('timeline anchors', () => {
    it('returns empty anchors (non-linkable)', () => {
      const { anchors } = layoutTimeline(timelineDoc, defaultTheme);
      expect(Object.keys(anchors)).toHaveLength(0);
    });
  });

  describe('poster hierarchical anchors', () => {
    const posterDoc: PosterDocument = {
      version: '1.0',
      metadata: { title: 'Test Poster' },
      grid: { columns: 2 },
      cells: [
        {
          id: 'left',
          title: 'Flow',
          content: { kind: 'diagram', diagramKind: 'flowchart', doc: flowDoc },
        },
        {
          id: 'right',
          title: 'Timeline',
          content: { kind: 'diagram', diagramKind: 'timeline', doc: timelineDoc },
        },
      ],
    };

    it('prefixes child anchors with cell id', async () => {
      const { anchors } = await layoutPoster(posterDoc, defaultTheme);
      expect(Object.keys(anchors)).toContain('left.A');
      expect(Object.keys(anchors)).toContain('left.B');
    });

    it('non-linkable cells contribute no anchors', async () => {
      const { anchors } = await layoutPoster(posterDoc, defaultTheme);
      const rightKeys = Object.keys(anchors).filter(k => k.startsWith('right.'));
      expect(rightKeys).toHaveLength(0);
    });

    it('child anchors are transformed to poster coordinates', async () => {
      const { anchors: posterAnchors } = await layoutPoster(posterDoc, defaultTheme);
      const { anchors: localAnchors } = layoutFlowchart(flowDoc, defaultTheme);

      const posterA = posterAnchors['left.A']!;
      const localA = localAnchors['A']!;

      // Poster coordinates should be offset (not at 0,0 like local)
      // The exact values depend on padding + grid, but they should differ
      // unless scale=1 and offset=0 (unlikely with poster padding)
      expect(posterA.bounds.x).not.toBe(localA.bounds.x);
    });

    it('nested poster propagates anchors with compound paths', async () => {
      const nestedPoster: PosterDocument = {
        version: '1.0',
        metadata: {},
        grid: { columns: 2 },
        cells: [
          {
            id: 'inner',
            content: { kind: 'diagram', diagramKind: 'flowchart', doc: flowDoc },
          },
          {
            id: 'other',
            content: { kind: 'text', text: 'hello' },
          },
        ],
      };

      const { anchors } = await layoutPoster(nestedPoster, defaultTheme);
      expect(Object.keys(anchors)).toContain('inner.A');
      expect(Object.keys(anchors)).toContain('inner.B');
    });
  });
});
