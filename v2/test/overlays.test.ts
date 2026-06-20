/**
 * Overlay tests — annotations (comment blocks) and legends (title/metadata blocks).
 *
 * These are scene-level components that work with any diagram type.
 */
import { describe, it, expect } from 'vitest';
import { layoutFlowchart } from '../src/diagrams/flowchart/layout.js';
import { layoutTimeline } from '../src/diagrams/timeline/layout.js';
import { layoutOverlays } from '../src/scene/overlays.js';
import { renderSVG } from '../src/render/svg.js';
import { defaultTheme } from '../src/theme/presets/default.js';
import type { FlowDocument } from '../src/diagrams/flowchart/ir.js';
import type { TimelineDocument } from '../src/diagrams/timeline/ir.js';
import type { Scene, Annotation, Legend } from '../src/scene/types.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const flowDoc: FlowDocument = {
  version: '1.0',
  metadata: {},
  direction: 'LR',
  nodes: [
    { id: 'a', label: 'Auth', shape: 'rect' },
    { id: 'b', label: 'API', shape: 'rounded-rect' },
    { id: 'c', label: 'DB', shape: 'cylinder' },
  ],
  edges: [
    { from: 'a', to: 'b', kind: 'sync', style: 'solid' },
    { from: 'b', to: 'c', kind: 'sync', style: 'solid' },
  ],
  subgraphs: [],
};

const timelineDoc: TimelineDocument = {
  version: '1.0',
  metadata: { title: 'Roadmap' },
  layout: 'horizontal',
  tracks: [{ id: 'main', label: 'Main' }],
  activities: [
    { id: 'dev', label: 'Development', track: 'main', start: '2025-Q1', end: '2025-Q3' },
  ],
  milestones: [
    { id: 'launch', label: 'Launch', date: '2025-09' },
  ],
};

// ─── Annotation Tests ──────────────────────────────────────────────────────────

describe('annotations (comment blocks)', () => {
  it('produces annotation group with connector line', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'note1',
        text: 'This handles OAuth2 flow',
        position: { x: 20, y: -60 },
        anchor: { point: { x: 84, y: 24 } }, // pointing at Auth node
      },
    ];

    const { elements } = layoutOverlays(scene, defaultTheme);
    expect(elements).toHaveLength(1);

    const group = elements[0];
    expect(group.type).toBe('group');
    if (group.type === 'group') {
      expect(group.id).toBe('annotation-note1');
      // Should contain: connector line, box path, fold triangle, text
      const types = group.children.map(c => c.type);
      expect(types).toContain('path'); // connector + box + fold
      expect(types).toContain('text'); // comment text
    }
  });

  it('renders dashed connector line', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'note1',
        text: 'Rate limited endpoint',
        position: { x: 200, y: -40 },
        anchor: { point: { x: 244, y: 24 } },
      },
    ];

    const svg = renderSVG(scene, defaultTheme);
    expect(svg).toContain('stroke-dasharray="4 3"');
  });

  it('renders annotation text', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'note1',
        text: 'Important note here',
        position: { x: 0, y: -50 },
        anchor: { point: { x: 60, y: 20 } },
      },
    ];

    const svg = renderSVG(scene, defaultTheme);
    expect(svg).toContain('Important note here');
    expect(svg).toContain('annotation-note1');
  });

  it('supports multiple annotations', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'note1',
        text: 'First comment',
        position: { x: 0, y: -50 },
        anchor: { point: { x: 60, y: 20 } },
      },
      {
        id: 'note2',
        text: 'Second comment',
        position: { x: 300, y: -50 },
        anchor: { point: { x: 244, y: 20 } },
      },
    ];

    const { elements } = layoutOverlays(scene, defaultTheme);
    expect(elements).toHaveLength(2);
  });

  it('expands viewBox when annotation is outside bounds', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    const originalTop = scene.viewBox.y;
    scene.annotations = [
      {
        id: 'above',
        text: 'Placed above the diagram',
        position: { x: 20, y: -80 },
        anchor: { point: { x: 60, y: 24 } },
      },
    ];

    const { viewBox } = layoutOverlays(scene, defaultTheme);
    expect(viewBox.y).toBeLessThan(originalTop);
  });

  it('wraps long text into multiple lines', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'long',
        text: 'This is a very long annotation that should wrap across multiple lines because it exceeds the maximum width',
        position: { x: 0, y: -100 },
        anchor: { point: { x: 60, y: 20 } },
      },
    ];

    const { elements } = layoutOverlays(scene, defaultTheme);
    const group = elements[0];
    if (group.type === 'group') {
      const textElements = group.children.filter(c => c.type === 'text');
      expect(textElements.length).toBeGreaterThan(1); // wrapped into multiple lines
    }
  });

  it('works on timeline diagrams too', () => {
    const scene = layoutTimeline(timelineDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'note',
        text: 'Critical milestone',
        position: { x: 300, y: -40 },
        anchor: { point: { x: 350, y: 20 } },
      },
    ];

    const svg = renderSVG(scene, defaultTheme);
    expect(svg).toContain('Critical milestone');
  });
});

// ─── Legend Tests ──────────────────────────────────────────────────────────────

describe('legend (title/metadata block)', () => {
  const baseLegend: Legend = {
    title: 'System Architecture',
    entries: [
      { key: 'Version', value: '2.1.0' },
      { key: 'Author', value: 'Engineering Team' },
      { key: 'Date', value: '2025-06-19' },
    ],
    corner: 'bottom-right',
  };

  it('produces legend group with title and entries', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.legend = baseLegend;

    const { elements } = layoutOverlays(scene, defaultTheme);
    expect(elements).toHaveLength(1);

    const group = elements[0];
    expect(group.type).toBe('group');
    if (group.type === 'group') {
      expect(group.id).toBe('legend');
      const texts = group.children
        .filter(c => c.type === 'text')
        .map(c => (c as any).content);
      expect(texts).toContain('System Architecture');
      expect(texts).toContain('Version');
      expect(texts).toContain('2.1.0');
      expect(texts).toContain('Author');
      expect(texts).toContain('Engineering Team');
    }
  });

  it('renders in SVG with border and text', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.legend = baseLegend;

    const svg = renderSVG(scene, defaultTheme);
    expect(svg).toContain('System Architecture');
    expect(svg).toContain('Version');
    expect(svg).toContain('2.1.0');
    expect(svg).toContain('id="legend"');
  });

  it('has divider line under title', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.legend = baseLegend;

    const { elements } = layoutOverlays(scene, defaultTheme);
    const group = elements[0];
    if (group.type === 'group') {
      const paths = group.children.filter(c => c.type === 'path');
      // At least one path for the divider line
      expect(paths.length).toBeGreaterThanOrEqual(1);
    }
  });

  it.each([
    'top-left', 'top-right', 'bottom-left', 'bottom-right',
  ] as const)('positions legend in %s corner', (corner) => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.legend = { ...baseLegend, corner };

    const { elements } = layoutOverlays(scene, defaultTheme);
    const group = elements[0];
    expect(group.type).toBe('group');
    if (group.type === 'group') {
      // Just verify it produces elements without error
      expect(group.children.length).toBeGreaterThan(0);
    }
  });

  it('positions bottom-right near viewBox edge', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.legend = { ...baseLegend, corner: 'bottom-right' };

    const { elements, viewBox } = layoutOverlays(scene, defaultTheme);
    const group = elements[0];
    if (group.type === 'group') {
      const rect = group.children.find(c => c.type === 'rect');
      if (rect && rect.type === 'rect') {
        // Legend should be within (or extending) the viewBox, near the right/bottom
        expect(rect.bounds.x + rect.bounds.width).toBeLessThanOrEqual(viewBox.x + viewBox.width);
        expect(rect.bounds.y + rect.bounds.height).toBeLessThanOrEqual(viewBox.y + viewBox.height);
      }
    }
  });

  it('legend without title skips divider', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.legend = {
      entries: [{ key: 'Status', value: 'Production' }],
      corner: 'top-right',
    };

    const { elements } = layoutOverlays(scene, defaultTheme);
    const group = elements[0];
    if (group.type === 'group') {
      const texts = group.children
        .filter(c => c.type === 'text')
        .map(c => (c as any).content);
      expect(texts).toContain('Status');
      expect(texts).toContain('Production');
      // No title, no divider path
      const paths = group.children.filter(c => c.type === 'path');
      expect(paths).toHaveLength(0);
    }
  });

  it('works on timeline diagrams', () => {
    const scene = layoutTimeline(timelineDoc, defaultTheme);
    scene.legend = {
      title: 'Project Info',
      entries: [{ key: 'Team', value: 'Platform' }],
      corner: 'bottom-left',
    };

    const svg = renderSVG(scene, defaultTheme);
    expect(svg).toContain('Project Info');
    expect(svg).toContain('Platform');
  });
});

// ─── Combined Tests ────────────────────────────────────────────────────────────

describe('annotations + legend combined', () => {
  it('renders both annotations and legend on same diagram', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'note',
        text: 'Secured endpoint',
        position: { x: 200, y: -40 },
        anchor: { point: { x: 244, y: 24 } },
      },
    ];
    scene.legend = {
      title: 'API Architecture',
      entries: [
        { key: 'Version', value: '3.0' },
        { key: 'Status', value: 'Production' },
      ],
      corner: 'bottom-right',
    };

    const svg = renderSVG(scene, defaultTheme);
    expect(svg).toContain('Secured endpoint');
    expect(svg).toContain('API Architecture');
    expect(svg).toContain('annotation-note');
    expect(svg).toContain('id="legend"');
  });

  it('viewBox accommodates both overlays', () => {
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    scene.annotations = [
      {
        id: 'above',
        text: 'Placed above',
        position: { x: 0, y: -100 },
        anchor: { point: { x: 60, y: 24 } },
      },
    ];
    scene.legend = {
      entries: [{ key: 'Note', value: 'Expanded' }],
      corner: 'bottom-right',
    };

    const { viewBox } = layoutOverlays(scene, defaultTheme);
    expect(viewBox.y).toBeLessThanOrEqual(-100);
    expect(viewBox.height).toBeGreaterThan(scene.viewBox.height);
  });

  it('existing tests still pass without overlays', () => {
    // Scene with no annotations/legend → renderSVG works as before
    const scene = layoutFlowchart(flowDoc, defaultTheme);
    const svg = renderSVG(scene);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});
