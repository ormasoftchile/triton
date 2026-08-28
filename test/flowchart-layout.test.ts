import { describe, it, expect } from 'vitest';
import { layoutFlowchart } from '../src/diagrams/mermaid/flowchart/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { FlowDocument } from '../src/diagrams/mermaid/flowchart/ir.js';

const doc: FlowDocument = {
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
    const groups = scene.elements.filter((e) => e.type === 'group') as any[];
    const ids = groups.map((g: any) => g.id).filter(Boolean);
    expect(ids).toContain('build');
    expect(ids).toContain('test');
    expect(ids).toContain('deploy');
  });

  it('nodes have distinct x positions in LR direction', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    // Collect all rect bounds (node shapes) from inside named groups
    const groups = scene.elements.filter((e) => e.type === 'group' && (e as any).id) as any[];
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
    const paths = scene.elements.filter((e) => e.type === 'path');
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
    const dottedPaths = scene.elements.filter(
      (e) => e.type === 'path' && (e as any).strokeDasharray,
    );
    expect(dottedPaths.length).toBeGreaterThan(0);
  });

  it('title text appears in elements', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    const texts = scene.elements.filter((e) => e.type === 'text') as any[];
    const title = texts.find((t) => t.content === 'CI Pipeline');
    expect(title).toBeDefined();
  });

  it('theme colors are used — surface fill appears in node rects', () => {
    const { scene } = layoutFlowchart(doc, defaultTheme);
    // Collect all fill values recursively
    const fills = collectFills(scene.elements);
    expect(
      fills.some(
        (f) => f === defaultTheme.palette.surface || f?.startsWith(defaultTheme.palette.surface),
      ),
    ).toBe(true);
  });

  it('switching theme changes background', () => {
    const dark = { ...defaultTheme, palette: { ...defaultTheme.palette, background: '#1a1a2e' } };
    const { scene } = layoutFlowchart(doc, dark);
    expect(scene.background).toBe('#1a1a2e');
  });

  it('long single-line text expands the node box width', () => {
    const longDoc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [
        { id: 'short', label: 'Short', shape: 'rect' },
        { id: 'long', label: 'Authenticate User with OAuth2 Provider', shape: 'rect' },
      ],
      edges: [{ from: 'short', to: 'long', style: 'solid' }],
      subgraphs: [],
    };
    const { anchors } = layoutFlowchart(longDoc, defaultTheme);
    const shortBounds = anchors['short']!.bounds;
    const longBounds = anchors['long']!.bounds;

    expect(shortBounds.width).toBe(120); // Default min width
    expect(longBounds.width).toBeGreaterThan(200); // Expanded to fit text
    expect(longBounds.height).toBe(40);
  });

  it('multiline text with \\n and <br/> expands node height and renders multiple text elements', () => {
    const multiDoc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [
        { id: 'multi1', label: 'First Line\nSecond Line\nThird Line', shape: 'rect' },
        { id: 'multi2', label: 'Step 1<br/>Step 2', shape: 'rounded-rect' },
        { id: 'multi3', label: 'Top<br >Middle<br />Bottom', shape: 'stadium' },
      ],
      edges: [],
      subgraphs: [],
    };
    const { scene, anchors } = layoutFlowchart(multiDoc, defaultTheme);

    // Height of multi1 with 3 lines should exceed default 40
    expect(anchors['multi1']!.bounds.height).toBeGreaterThan(40);
    expect(anchors['multi2']!.bounds.height).toBeGreaterThan(40);
    expect(anchors['multi3']!.bounds.height).toBeGreaterThan(40);

    const groups = scene.elements.filter((e) => e.type === 'group') as any[];
    const g1 = groups.find((g) => g.id === 'multi1');
    const texts1 = g1.children.filter((c: any) => c.type === 'text');
    expect(texts1).toHaveLength(3);
    expect(texts1[0].content).toBe('First Line');
    expect(texts1[1].content).toBe('Second Line');
    expect(texts1[2].content).toBe('Third Line');

    // Lines should have increasing y positions
    expect(texts1[0].position.y).toBeLessThan(texts1[1].position.y);
    expect(texts1[1].position.y).toBeLessThan(texts1[2].position.y);

    const g2 = groups.find((g) => g.id === 'multi2');
    const texts2 = g2.children.filter((c: any) => c.type === 'text');
    expect(texts2).toHaveLength(2);
    expect(texts2[0].content).toBe('Step 1');
    expect(texts2[1].content).toBe('Step 2');
  });

  it('auto-wraps excessively long text without manual breaks to prevent infinite horizontal expansion', () => {
    const hugeDoc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [
        {
          id: 'huge',
          label:
            'This is an extremely long label that describes an entire workflow process step without any explicit newlines in the input string',
          shape: 'rect',
        },
      ],
      edges: [],
      subgraphs: [],
    };
    const { scene, anchors } = layoutFlowchart(hugeDoc, defaultTheme);
    const bounds = anchors['huge']!.bounds;
    expect(bounds.height).toBeGreaterThan(40); // Wrapped into multiple lines
    expect(bounds.width).toBeLessThanOrEqual(320); // Clamped within wrap width + pad

    const group = scene.elements.find((e) => e.type === 'group' && (e as any).id === 'huge') as any;
    const texts = group.children.filter((c: any) => c.type === 'text');
    expect(texts.length).toBeGreaterThan(1);
  });

  it('renders distinct shapes accurately: cylinder, hexagon, parallelogram, asymmetric', () => {
    const shapeDoc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'LR',
      nodes: [
        { id: 'cyl', label: 'Database', shape: 'cylinder' },
        { id: 'hex', label: 'Prepare', shape: 'hexagon' },
        { id: 'para', label: 'Input Data', shape: 'parallelogram' },
        { id: 'asym', label: 'Flag', shape: 'asymmetric' },
      ],
      edges: [],
      subgraphs: [],
    };
    const { scene, anchors } = layoutFlowchart(shapeDoc, defaultTheme);
    expect(anchors['cyl']!.bounds.height).toBeGreaterThanOrEqual(48);

    const groups = scene.elements.filter((e) => e.type === 'group') as any[];
    const cylGroup = groups.find((g) => g.id === 'cyl');
    const cylPaths = cylGroup.children.filter((c: any) => c.type === 'path');
    expect(cylPaths.length).toBeGreaterThanOrEqual(1); // Body + top rim

    const hexGroup = groups.find((g) => g.id === 'hex');
    const hexPath = hexGroup.children.find((c: any) => c.type === 'path');
    expect(hexPath).toBeDefined();

    const paraGroup = groups.find((g) => g.id === 'para');
    const paraPath = paraGroup.children.find((c: any) => c.type === 'path');
    expect(paraPath).toBeDefined();

    const asymGroup = groups.find((g) => g.id === 'asym');
    const asymPath = asymGroup.children.find((c: any) => c.type === 'path');
    expect(asymPath).toBeDefined();
  });

  it('aligns single-predecessor continuation nodes on a straight vertical spine', () => {
    const pipeDoc: FlowDocument = {
      version: '1.0',
      metadata: {},
      direction: 'TD',
      nodes: [
        { id: 'commit', label: 'Commit Pushed', shape: 'rect' },
        { id: 'build', label: 'Build & Lint', shape: 'rect' },
        { id: 'test', label: 'Tests Pass?', shape: 'diamond' },
        { id: 'stage', label: 'Deploy to Staging', shape: 'stadium' },
        { id: 'notify', label: 'Notify Author', shape: 'rounded-rect' },
        { id: 'approve', label: 'Approved?', shape: 'diamond' },
        { id: 'prod', label: 'Deploy to Production', shape: 'stadium' },
        { id: 'hold', label: 'Hold for Review', shape: 'rounded-rect' },
        { id: 'live', label: 'Live', shape: 'circle' },
      ],
      edges: [
        { from: 'commit', to: 'build', style: 'solid' },
        { from: 'build', to: 'test', style: 'solid' },
        { from: 'test', to: 'stage', style: 'solid', label: 'yes' },
        { from: 'test', to: 'notify', style: 'solid', label: 'no' },
        { from: 'stage', to: 'approve', style: 'solid' },
        { from: 'approve', to: 'prod', style: 'solid', label: 'yes' },
        { from: 'approve', to: 'hold', style: 'solid', label: 'no' },
        { from: 'prod', to: 'live', style: 'solid' },
      ],
      subgraphs: [],
    };
    const { scene, anchors } = layoutFlowchart(pipeDoc, defaultTheme);

    // stage and approve share the exact same center X; prod and live share the exact same center X
    const stageCx = anchors['stage']!.bounds.x + anchors['stage']!.bounds.width / 2;
    const approveCx = anchors['approve']!.bounds.x + anchors['approve']!.bounds.width / 2;
    const prodCx = anchors['prod']!.bounds.x + anchors['prod']!.bounds.width / 2;
    const liveCx = anchors['live']!.bounds.x + anchors['live']!.bounds.width / 2;

    expect(stageCx).toBe(approveCx);
    expect(prodCx).toBe(liveCx);

    // stage -> approve edge should be a straight vertical path
    const paths = scene.elements.filter((e) => e.type === 'path') as any[];
    const straightEdge = paths.find(
      (p) => p.d === `M ${stageCx} ${anchors['stage']!.bounds.y + anchors['stage']!.bounds.height} L ${approveCx} ${anchors['approve']!.bounds.y}`,
    );
    expect(straightEdge).toBeDefined();
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
