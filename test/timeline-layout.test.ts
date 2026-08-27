import { describe, it, expect } from 'vitest';
import { layoutTimeline } from '../src/diagrams/mermaid/timeline/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { TimelineDocument } from '../src/diagrams/mermaid/timeline/ir.js';

const doc: TimelineDocument = {
  version: '1.0',
  metadata: { title: 'Project Milestones' },
  layout: 'horizontal',
  tracks: [{ id: 'main', label: 'Main' }],
  activities: [
    {
      id: 'design',
      label: 'Design Phase',
      track: 'main',
      start: '2025-Q1',
      end: '2025-Q2',
      status: 'done',
    },
    {
      id: 'impl',
      label: 'Implementation',
      track: 'main',
      start: '2025-Q2',
      end: '2025-Q3',
      status: 'active',
    },
  ],
  milestones: [
    { id: 'kickoff', label: 'Kickoff', date: '2025-01' },
    { id: 'mvp', label: 'MVP', date: '2025-06' },
    { id: 'launch', label: 'Launch', date: '2025-09' },
  ],
};

describe('timeline layout', () => {
  it('produces a valid scene', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    expect(scene.viewBox.width).toBeGreaterThan(0);
    expect(scene.viewBox.height).toBeGreaterThan(0);
    expect(scene.elements.length).toBeGreaterThan(0);
    expect(scene.background).toBe(defaultTheme.palette.background);
  });

  it('title appears in elements', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const texts = scene.elements.filter((e) => e.type === 'text') as any[];
    expect(texts.some((t) => t.content === 'Project Milestones')).toBe(true);
  });

  it('milestones render as path elements (diamond)', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const paths = scene.elements.filter((e) => e.type === 'path') as any[];
    // Axis line + diamond paths for 3 milestones
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it('milestone dates map to different x positions', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    // Milestones are paths — check their `d` attributes contain different x values
    const texts = scene.elements.filter((e) => e.type === 'text') as any[];
    const dateLabels = texts.filter((t: any) =>
      ['2025-01', '2025-06', '2025-09'].includes(t.content),
    );
    expect(dateLabels.length).toBe(3);
    const xs = dateLabels.map((t: any) => t.position.x);
    // All three should be at different positions
    expect(new Set(xs).size).toBe(3);
    // They should be in ascending order (left to right)
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
  });

  it('later dates are positioned further right than earlier dates', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const texts = scene.elements.filter((e) => e.type === 'text') as any[];
    const kickoffX = texts.find((t: any) => t.content === '2025-01')?.position.x ?? 0;
    const launchX = texts.find((t: any) => t.content === '2025-09')?.position.x ?? 0;
    expect(launchX).toBeGreaterThan(kickoffX);
  });

  it('activities produce rect elements', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const rects = scene.elements.filter((e) => e.type === 'rect') as any[];
    // At least 2 rects for the two activities
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('theme colors are used for fills', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const fills = collectFills(scene.elements);
    expect(fills.some((f) => f?.includes(defaultTheme.palette.primary))).toBe(true);
  });

  it('sections produce rect backgrounds when present', () => {
    const withSections: TimelineDocument = {
      ...doc,
      sections: [{ id: 'q1', label: 'Q1', start: '2025-01', end: '2025-03' }],
    };
    const { scene } = layoutTimeline(withSections, defaultTheme);
    const rects = scene.elements.filter((e) => e.type === 'rect') as any[];
    // Should have section background + activity bars
    expect(rects.length).toBeGreaterThan(2);
  });

  it('multiple tracks produce separate rows of activities', () => {
    const multiTrack: TimelineDocument = {
      ...doc,
      tracks: [
        { id: 'frontend', label: 'Frontend' },
        { id: 'backend', label: 'Backend' },
      ],
      activities: [
        { id: 'fe', label: 'FE Work', track: 'frontend', start: '2025-Q1', end: '2025-Q2' },
        { id: 'be', label: 'BE Work', track: 'backend', start: '2025-Q1', end: '2025-Q2' },
      ],
      milestones: [],
    };
    const { scene } = layoutTimeline(multiTrack, defaultTheme);
    const rects = scene.elements.filter((e) => e.type === 'rect') as any[];
    const activityRects = rects.filter((r) => r.fill !== defaultTheme.palette.background);
    // Both activities should have different y positions
    if (activityRects.length >= 2) {
      const ys = activityRects.map((r: any) => r.bounds.y);
      expect(new Set(ys).size).toBeGreaterThan(1);
    }
  });

  describe('wave layout', () => {
    const waveDoc: TimelineDocument = {
      version: '1.0',
      metadata: { title: 'Key Components' },
      layout: 'wave',
      tracks: [{ id: 'default', label: 'Default' }],
      activities: [
        { id: 'll', label: 'Linked Lists', track: 'default', start: '1' },
        { id: 'st', label: 'Stacks', track: 'default', start: '2' },
        { id: 'qu', label: 'Queues', track: 'default', start: '3' },
        { id: 'tr', label: 'Trees', track: 'default', start: '4' },
        { id: 'gr', label: 'Graphs', track: 'default', start: '5' },
      ],
      milestones: [],
    };

    it('renders continuous wave ribbon with linear gradient def', () => {
      const { scene } = layoutTimeline(waveDoc, defaultTheme);
      expect(scene.defs?.length).toBeGreaterThan(0);
      expect(scene.defs?.[0]).toContain('linearGradient');
      expect(scene.defs?.[0]).toContain('id="triton-wave-ribbon-grad"');
      const paths = scene.elements.filter((e) => e.type === 'path') as any[];
      const ribbon = paths.find((p) => p.stroke === 'url(#triton-wave-ribbon-grad)');
      expect(ribbon).toBeDefined();
      expect(ribbon.strokeWidth).toBeGreaterThanOrEqual(20);
    });

    it('renders white medallion circles with step numbers', () => {
      const { scene } = layoutTimeline(waveDoc, defaultTheme);
      const circles = scene.elements.filter((e) => e.type === 'circle') as any[];
      expect(circles.length).toBe(5);
      expect(circles.every((c) => c.fill === '#FFFFFF')).toBe(true);

      const texts = scene.elements.filter((e) => e.type === 'text') as any[];
      expect(texts.some((t) => t.content === '01')).toBe(true);
      expect(texts.some((t) => t.content === '05')).toBe(true);
      expect(texts.some((t) => t.content === 'Linked Lists')).toBe(true);
      expect(texts.some((t) => t.content === 'Graphs')).toBe(true);
    });

    it('oscillates y-coordinates between peaks and valleys', () => {
      const { scene } = layoutTimeline(waveDoc, defaultTheme);
      const circles = scene.elements.filter((e) => e.type === 'circle') as any[];
      const ys = circles.map((c) => c.center.y);
      expect(ys[0]).toBe(ys[2]); // valley 0 and valley 2 have same Y
      expect(ys[1]).toBe(ys[3]); // peak 1 and peak 3 have same Y
      expect(ys[0]).toBeGreaterThan(ys[1]); // valley Y is lower (greater Y) than peak Y
    });
  });
});

function collectFills(elements: any[]): string[] {
  const fills: string[] = [];
  for (const el of elements) {
    if (el.fill) fills.push(el.fill);
    if (el.children) fills.push(...collectFills(el.children));
  }
  return fills;
}
