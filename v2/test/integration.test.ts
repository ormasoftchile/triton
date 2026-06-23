/**
 * Integration test: proves the unified architecture works.
 *
 * 1. Flowchart, Timeline, and Poster all satisfy DiagramModule
 * 2. One theme applies uniformly to all three
 * 3. Poster correctly embeds Flow + Timeline as children
 * 4. All produce valid Scenes with identical theme colors
 */
import { describe, it, expect } from 'vitest';
import { layoutFlowchart } from '../src/diagrams/flowchart/layout.js';
import { layoutTimeline } from '../src/diagrams/timeline/layout.js';
import { layoutPoster } from '../src/diagrams/poster/layout.js';
import { defaultTheme } from '../src/theme/presets/default.js';
import { renderSVG } from '../src/render/svg.js';
import type { FlowDocument } from '../src/diagrams/flowchart/ir.js';
import type { TimelineDocument } from '../src/diagrams/timeline/ir.js';
import type { PosterDocument } from '../src/diagrams/poster/ir.js';
import type { Scene } from '../src/scene/types.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const flowDoc: FlowDocument = {
  version: '1.0',
  metadata: { title: 'CI Pipeline' },
  direction: 'LR',
  nodes: [
    { id: 'build', label: 'Build', shape: 'rect' },
    { id: 'test', label: 'Test', shape: 'rounded-rect' },
    { id: 'deploy', label: 'Deploy', shape: 'stadium' },
  ],
  edges: [
    { from: 'build', to: 'test', kind: 'sync', style: 'solid' },
    { from: 'test', to: 'deploy', kind: 'sync', style: 'solid', label: 'pass' },
  ],
  subgraphs: [],
};

const timelineDoc: TimelineDocument = {
  version: '1.0',
  metadata: { title: 'Project Milestones' },
  layout: 'horizontal',
  tracks: [{ id: 'main', label: 'Main' }],
  activities: [
    { id: 'design', label: 'Design Phase', track: 'main', start: '2025-Q1', end: '2025-Q2' },
    { id: 'impl', label: 'Implementation', track: 'main', start: '2025-Q2', end: '2025-Q3' },
  ],
  milestones: [
    { id: 'kickoff', label: 'Kickoff', date: '2025-01' },
    { id: 'mvp', label: 'MVP', date: '2025-06' },
    { id: 'launch', label: 'Launch', date: '2025-09' },
  ],
};

const posterDoc: PosterDocument = {
  version: '1.0',
  metadata: { title: 'Architecture Overview' },
  grid: { columns: 2 },
  cells: [
    {
      id: 'pipeline',
      title: 'CI/CD Pipeline',
      content: { kind: 'flow', doc: flowDoc },
    },
    {
      id: 'timeline',
      title: 'Roadmap',
      content: { kind: 'timeline', doc: timelineDoc },
    },
    {
      id: 'stats',
      title: 'Metrics',
      content: { kind: 'stat', value: '99.9%', label: 'Uptime' },
    },
    {
      id: 'note',
      content: { kind: 'text', text: 'All systems nominal.' },
    },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('unified architecture', () => {
  describe('individual diagrams produce valid Scenes', () => {
    it('flowchart → Scene', () => {
      const scene = layoutFlowchart(flowDoc, defaultTheme);
      assertValidScene(scene);
      expect(scene.elements.length).toBeGreaterThan(0);
      expect(scene.background).toBe(defaultTheme.palette.background);
    });

    it('timeline → Scene', () => {
      const scene = layoutTimeline(timelineDoc, defaultTheme);
      assertValidScene(scene);
      expect(scene.elements.length).toBeGreaterThan(0);
      expect(scene.background).toBe(defaultTheme.palette.background);
    });
  });

  describe('theme uniformity', () => {
    it('same palette.primary appears in both flow edges and timeline markers', () => {
      const flowScene = layoutFlowchart(flowDoc, defaultTheme);
      const timelineScene = layoutTimeline(timelineDoc, defaultTheme);

      const flowColors = extractFills(flowScene);
      const timelineColors = extractFills(timelineScene);

      // Both use the same primary color from theme
      expect(flowColors).toContain(defaultTheme.palette.primary);
      expect(timelineColors).toContain(defaultTheme.palette.primary);
    });

    it('changing theme affects all diagrams identically', () => {
      const darkTheme = {
        ...defaultTheme,
        name: 'dark',
        palette: {
          ...defaultTheme.palette,
          primary: '#FF6B6B',
          background: '#1a1a2e',
          surface: '#16213e',
          text: '#eaeaea',
        },
      };

      const flowScene = layoutFlowchart(flowDoc, darkTheme);
      const timelineScene = layoutTimeline(timelineDoc, darkTheme);
      const posterScene = layoutPoster(posterDoc, darkTheme);

      // All use the new dark theme colors
      expect(flowScene.background).toBe('#1a1a2e');
      expect(timelineScene.background).toBe('#1a1a2e');
      expect(posterScene.background).toBe('#1a1a2e');

      expect(extractFills(flowScene)).toContain('#FF6B6B');
      expect(extractFills(timelineScene)).toContain('#FF6B6B');
    });
  });

  describe('poster composition', () => {
    it('poster layout produces a valid Scene', () => {
      const scene = layoutPoster(posterDoc, defaultTheme);
      assertValidScene(scene);
      expect(scene.elements.length).toBeGreaterThan(0);
    });

    it('poster embeds both flow and timeline as groups', () => {
      const scene = layoutPoster(posterDoc, defaultTheme);
      const groups = scene.elements.filter(e => e.type === 'group');
      // Each cell with a diagram child gets a <g> with transform
      expect(groups.length).toBeGreaterThanOrEqual(2);
      // Groups have transform with translate+scale
      for (const g of groups) {
        expect(g.transform).toMatch(/translate\(.+\) scale\(.+\)/);
      }
    });

    it('poster contains cell titles', () => {
      const scene = layoutPoster(posterDoc, defaultTheme);
      const texts = scene.elements
        .filter(e => e.type === 'text')
        .map(e => (e as any).content);
      expect(texts).toContain('CI/CD Pipeline');
      expect(texts).toContain('Roadmap');
      expect(texts).toContain('Metrics');
    });

    it('poster respects grid columns (2 cols → cells side by side)', () => {
      const scene = layoutPoster(posterDoc, defaultTheme);
      // Poster width should accommodate 2 columns
      expect(scene.viewBox.width).toBeGreaterThan(400);
    });
  });

  describe('SVG render', () => {
    it('all three render to valid SVG', () => {
      const scenes = [
        layoutFlowchart(flowDoc, defaultTheme),
        layoutTimeline(timelineDoc, defaultTheme),
        layoutPoster(posterDoc, defaultTheme),
      ];

      for (const scene of scenes) {
        const svg = renderSVG(scene);
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
        expect(svg).toContain('viewBox=');
      }
    });

    it('poster SVG contains nested groups for embedded diagrams', () => {
      const svg = renderSVG(layoutPoster(posterDoc, defaultTheme));
      // Groups with transforms represent embedded diagrams
      expect(svg).toContain('<g');
      expect(svg).toContain('transform="translate');
    });
  });
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function assertValidScene(scene: Scene) {
  expect(scene.viewBox).toBeDefined();
  expect(scene.viewBox.width).toBeGreaterThan(0);
  expect(scene.viewBox.height).toBeGreaterThan(0);
  expect(scene.elements).toBeDefined();
  expect(Array.isArray(scene.elements)).toBe(true);
}

function extractFills(scene: Scene): string[] {
  const fills: string[] = [];
  function walk(elements: any[]) {
    for (const el of elements) {
      if (el.fill) fills.push(el.fill);
      if (el.stroke) fills.push(el.stroke);
      if (el.children) walk(el.children);
    }
  }
  walk(scene.elements);
  return fills;
}
