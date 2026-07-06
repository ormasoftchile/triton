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
    { id: 'design', label: 'Design Phase', track: 'main', start: '2025-Q1', end: '2025-Q2', status: 'done' },
    { id: 'impl',   label: 'Implementation', track: 'main', start: '2025-Q2', end: '2025-Q3', status: 'active' },
  ],
  milestones: [
    { id: 'kickoff', label: 'Kickoff', date: '2025-01' },
    { id: 'mvp',     label: 'MVP',     date: '2025-06' },
    { id: 'launch',  label: 'Launch',  date: '2025-09' },
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
    const texts = scene.elements.filter(e => e.type === 'text') as any[];
    expect(texts.some(t => t.content === 'Project Milestones')).toBe(true);
  });

  it('milestones render as path elements (diamond)', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const paths = scene.elements.filter(e => e.type === 'path') as any[];
    // Axis line + diamond paths for 3 milestones
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it('milestone dates map to different x positions', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    // Milestones are paths — check their `d` attributes contain different x values
    const texts = scene.elements.filter(e => e.type === 'text') as any[];
    const dateLabels = texts.filter((t: any) =>
      ['2025-01', '2025-06', '2025-09'].includes(t.content)
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
    const texts = scene.elements.filter(e => e.type === 'text') as any[];
    const kickoffX = texts.find((t: any) => t.content === '2025-01')?.position.x ?? 0;
    const launchX  = texts.find((t: any) => t.content === '2025-09')?.position.x ?? 0;
    expect(launchX).toBeGreaterThan(kickoffX);
  });

  it('activities produce rect elements', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const rects = scene.elements.filter(e => e.type === 'rect') as any[];
    // At least 2 rects for the two activities
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('theme colors are used for fills', () => {
    const { scene } = layoutTimeline(doc, defaultTheme);
    const fills = collectFills(scene.elements);
    expect(fills.some(f => f?.includes(defaultTheme.palette.primary))).toBe(true);
  });

  it('sections produce rect backgrounds when present', () => {
    const withSections: TimelineDocument = {
      ...doc,
      sections: [{ id: 'q1', label: 'Q1', start: '2025-01', end: '2025-03' }],
    };
    const { scene } = layoutTimeline(withSections, defaultTheme);
    const rects = scene.elements.filter(e => e.type === 'rect') as any[];
    // Should have section background + activity bars
    expect(rects.length).toBeGreaterThan(2);
  });

  it('multiple tracks produce separate rows of activities', () => {
    const multiTrack: TimelineDocument = {
      ...doc,
      tracks: [{ id: 'frontend', label: 'Frontend' }, { id: 'backend', label: 'Backend' }],
      activities: [
        { id: 'fe', label: 'FE Work', track: 'frontend', start: '2025-Q1', end: '2025-Q2' },
        { id: 'be', label: 'BE Work', track: 'backend',  start: '2025-Q1', end: '2025-Q2' },
      ],
      milestones: [],
    };
    const { scene } = layoutTimeline(multiTrack, defaultTheme);
    const rects = scene.elements.filter(e => e.type === 'rect') as any[];
    const activityRects = rects.filter(r => r.fill !== defaultTheme.palette.background);
    // Both activities should have different y positions
    if (activityRects.length >= 2) {
      const ys = activityRects.map((r: any) => r.bounds.y);
      expect(new Set(ys).size).toBeGreaterThan(1);
    }
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
