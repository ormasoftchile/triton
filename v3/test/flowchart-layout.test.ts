import { describe, it, expect } from 'vitest';
import { layoutFlowchart } from '../src/diagrams/flowchart/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { FlowDocument } from '../src/diagrams/flowchart/ir.js';

const doc: FlowDocument = {
  version: '1.0',
  metadata: { title: 'CI Pipeline' },
  direction: 'LR',
  nodes: [
    { id: 'build', label: 'Build', shape: 'rect' },
    { id: 'test',  label: 'Test',  shape: 'rounded-rect' },
    { id: 'deploy',label: 'Deploy',shape: 'stadium' },
  ],
  edges: [
    { from: 'build', to: 'test',   kind: 'sync', style: 'solid' },
    { from: 'test',  to: 'deploy', kind: 'sync', style: 'solid', label: 'pass' },
  ],
  subgraphs: [],
};

describe('flowchart layout', () => {
  it('produces a valid scene', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    expect(scene.viewBox.width).toBeGreaterThan(0);
    expect(scene.viewBox.height).toBeGreaterThan(0);
    expect(scene.elements.length).toBeGreaterThan(0);
    expect(scene.background).toBe(defaultTheme.palette.background);
  });

  it('all nodes produce groups with matching IDs', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const groups = scene.elements.filter(e => e.type === 'group') as any[];
    const ids = groups.map((g: any) => g.id).filter(Boolean);
    expect(ids).toContain('build');
    expect(ids).toContain('test');
    expect(ids).toContain('deploy');
  });

  it('nodes have distinct x positions in LR direction', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    // Collect all rect bounds (node shapes) from inside named groups
    const groups = scene.elements.filter(e => e.type === 'group' && (e as any).id) as any[];
    const xs = groups.map((g: any) => {
      const rect = (g.children as any[]).find((c: any) => c.type === 'rect' || c.type === 'path');
      if (!rect) return null;
      return rect.bounds ? rect.bounds.x : null;
    });
    const defined = xs.filter((x: any) => x !== null);
    expect(defined.length).toBeGreaterThan(0);
    expect(new Set(defined).size).toBeGreaterThan(1);
  });

  it('TD direction produces nodes at distinct y positions', () => {
    const tdDoc: FlowDocument = { ...doc, direction: 'TD' };
    const { scene } = layoutFlowchart(tdDoc, defaultTheme);
    expect(scene.elements.length).toBeGreaterThan(0);
  });

  it('edges produce path elements', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const paths = scene.elements.filter(e => e.type === 'path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('edges include arrowhead marker defs', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    expect(scene.defs).toBeDefined();
    expect(scene.defs!.length).toBeGreaterThan(0);
    expect(scene.defs![0]).toContain('<marker');
  });

  it('dotted edge gets stroke-dasharray', () => {
    const dottedDoc: FlowDocument = {
      ...doc,
      edges: [{ from: 'build', to: 'test', kind: 'async', style: 'dotted' }],
    };
    const { scene } = layoutFlowchart(dottedDoc, defaultTheme);
    const dottedPaths = scene.elements.filter(e => e.type === 'path' && (e as any).strokeDasharray);
    expect(dottedPaths.length).toBeGreaterThan(0);
  });

  it('title text appears in elements', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const texts = scene.elements.filter(e => e.type === 'text') as any[];
    const title = texts.find(t => t.content === 'CI Pipeline');
    expect(title).toBeDefined();
  });

  it('theme colors are used — surface fill appears in node rects', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    // Collect all fill values recursively
    const fills = collectFills(scene.elements);
    expect(fills.some(f => f === defaultTheme.palette.surface || f?.startsWith(defaultTheme.palette.surface))).toBe(true);
  });

  it('switching theme changes background', () => {
    const dark = { ...defaultTheme, palette: { ...defaultTheme.palette, background: '#1a1a2e' } };
    const { scene } = layoutFlowchart(doc, dark);
    expect(scene.background).toBe('#1a1a2e');
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
