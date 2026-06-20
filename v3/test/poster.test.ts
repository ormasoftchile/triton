import { describe, it, expect } from 'vitest';
import { layoutPoster } from '../src/diagrams/poster/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import { resolveTheme } from '../src/theme/resolver.js';
import type { PosterDocument } from '../src/diagrams/poster/ir.js';
import type { FlowDocument } from '../src/diagrams/flowchart/ir.js';
import type { TimelineDocument } from '../src/diagrams/timeline/ir.js';

const flowDoc: FlowDocument = {
  version: '1.0', metadata: { title: 'CI' }, direction: 'LR',
  nodes: [{ id: 'a', label: 'A', shape: 'rect' }, { id: 'b', label: 'B', shape: 'rect' }],
  edges: [{ from: 'a', to: 'b', kind: 'sync', style: 'solid' }],
  subgraphs: [],
};

const timelineDoc: TimelineDocument = {
  version: '1.0', metadata: { title: 'Road' }, layout: 'horizontal',
  tracks: [{ id: 'main', label: 'Main' }],
  activities: [{ id: 'a1', label: 'Phase 1', track: 'main', start: '2025-Q1', end: '2025-Q2' }],
  milestones: [{ id: 'm1', label: 'Launch', date: '2025-06' }],
};

const posterDoc: PosterDocument = {
  version: '1.0',
  metadata: { title: 'Architecture Overview' },
  grid: { columns: 2 },
  cells: [
    { id: 'flow',     title: 'Pipeline', content: { kind: 'flow',     doc: flowDoc } },
    { id: 'timeline', title: 'Roadmap',  content: { kind: 'timeline', doc: timelineDoc } },
    { id: 'stat',     title: 'Uptime',   content: { kind: 'stat', value: '99.9%', label: 'Availability' } },
    { id: 'note',                         content: { kind: 'text', text: 'All systems nominal.' } },
  ],
};

describe('poster layout', () => {
  it('produces a valid scene', () => {
    const scene = layoutPoster(posterDoc, defaultTheme);
    expect(scene.viewBox.width).toBeGreaterThan(0);
    expect(scene.viewBox.height).toBeGreaterThan(0);
    expect(scene.elements.length).toBeGreaterThan(0);
  });

  it('title appears in elements', () => {
    const scene = layoutPoster(posterDoc, defaultTheme);
    const texts = scene.elements.filter(e => e.type === 'text') as any[];
    expect(texts.some(t => t.content === 'Architecture Overview')).toBe(true);
  });

  it('produces cell border rects for all 4 cells', () => {
    const scene = layoutPoster(posterDoc, defaultTheme);
    const rects = scene.elements.filter(e => e.type === 'rect') as any[];
    // 4 cell borders + possibly more from child scenes
    expect(rects.length).toBeGreaterThanOrEqual(4);
  });

  it('embeds child scenes as groups with transforms', () => {
    const scene = layoutPoster(posterDoc, defaultTheme);
    const groups = scene.elements.filter(e => e.type === 'group') as any[];
    const withTransform = groups.filter((g: any) => g.transform);
    expect(withTransform.length).toBeGreaterThan(0);
  });

  it('stat cell renders value text', () => {
    const scene = layoutPoster(posterDoc, defaultTheme);
    const allTexts = collectTexts(scene.elements);
    expect(allTexts.some(t => t === '99.9%')).toBe(true);
  });

  it('text cell renders its content', () => {
    const scene = layoutPoster(posterDoc, defaultTheme);
    const allTexts = collectTexts(scene.elements);
    expect(allTexts.some(t => t === 'All systems nominal.')).toBe(true);
  });

  it('auto-assigns row/col to cells without explicit position', () => {
    // All cells lack row/col → auto-assigned; should not throw
    expect(() => layoutPoster(posterDoc, defaultTheme)).not.toThrow();
  });

  it('theme change propagates to all child diagrams', () => {
    const dark = resolveTheme({ palette: { background: '#1a1a2e', primary: '#FF6B6B' } }, defaultTheme);
    const scene = layoutPoster(posterDoc, dark);
    expect(scene.background).toBe('#1a1a2e');
  });

  it('columns=1 stacks cells vertically', () => {
    const single: PosterDocument = { ...posterDoc, grid: { columns: 1 } };
    const scene = layoutPoster(single, defaultTheme);
    expect(scene.viewBox.height).toBeGreaterThan(scene.viewBox.width * 0.5);
  });
});

function collectTexts(elements: any[]): string[] {
  const out: string[] = [];
  for (const el of elements) {
    if (el.type === 'text') out.push(el.content);
    if (el.children) out.push(...collectTexts(el.children));
  }
  return out;
}
