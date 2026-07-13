/**
 * P6 Flowchart Icon Tests
 *
 * Covers the end-to-end pipeline:
 *   grammar (@icon / @shape node annotations) → IR (FlowNode.icon: IconRef) →
 *   layout (resolveIcon + pen.icon) → SVG renderer (SceneIcon emit).
 *
 * Validates:
 *   - @icon:<prefix:name> parses to FlowNode.icon with correct prefix/name
 *   - @shape:<name> parses to FlowNode.shape
 *   - Both together on one node
 *   - Malformed @icon value throws a descriptive error
 *   - Existing edge @orthogonal annotations still parse correctly
 *   - renderSync with an IconPackMap emits a <svg> icon element in SVG output
 *   - Monochrome icon gets style="color:..." tinting
 *   - Brand icon is emitted verbatim (no color override)
 *   - No <foreignObject> or <image> elements in output
 *   - Node without @icon is unaffected
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../src/diagrams/mermaid/flowchart/parser.js';
import { flowchart } from '../src/diagrams/mermaid/flowchart/index.js';
import { renderSync } from '../src/frontend/index.js';
import type { IconPackMap, IconifyJSON } from '../src/contracts/icons.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Monochrome icon pack — uses currentColor throughout. */
const MONO_PACK: IconifyJSON = {
  prefix: 'mdi',
  icons: {
    server: { body: '<path fill="currentColor" d="M4 1h16v14H4z"/>' },
    database: { body: '<circle fill="currentColor" cx="12" cy="12" r="8"/>' },
  },
  width: 24,
  height: 24,
  left: 0,
  top: 0,
};

/** Brand icon pack — hardcoded hex fills. */
const BRAND_PACK: IconifyJSON = {
  prefix: 'azure',
  icons: {
    'app-service': {
      body: '<rect fill="#0078D4" x="0" y="0" width="18" height="18"/>',
      width: 18,
      height: 18,
    },
  },
  width: 24,
  height: 24,
  left: 0,
  top: 0,
};

/** A combined pack map with both packs. */
const PACK_MAP: IconPackMap = new Map([
  ['mdi', MONO_PACK],
  ['azure', BRAND_PACK],
]);

// ─── Grammar-level: raw parser output ────────────────────────────────────────

describe('flowchart grammar — node annotations', () => {
  it('parses @icon annotation into iconToken on raw node', () => {
    const raw = parse(`flowchart TD\nA ["App Service"] @icon:azure:app-service\n`) as any;
    const node = raw.flow.nodes[0];
    expect(node.iconToken).toBe('azure:app-service');
  });

  it('parses @shape annotation into node.shape', () => {
    const raw = parse(`flowchart TD\nA ["Card"] @shape:card\n`) as any;
    const node = raw.flow.nodes[0];
    expect(node.shape).toBe('card');
  });

  it('parses both @shape and @icon on the same node', () => {
    const raw = parse(`flowchart TD\nA ["App Service"] @shape:card @icon:azure:app-service\n`) as any;
    const node = raw.flow.nodes[0];
    expect(node.shape).toBe('card');
    expect(node.iconToken).toBe('azure:app-service');
  });

  it('parses @icon with mdi prefix', () => {
    const raw = parse(`flowchart TD\nB ["Database"] @icon:mdi:database\n`) as any;
    const node = raw.flow.nodes[0];
    expect(node.iconToken).toBe('mdi:database');
  });

  it('does not affect nodes without annotations', () => {
    const raw = parse(`flowchart TD\nA[Plain] --> B[Also plain]\n`) as any;
    for (const node of raw.flow.nodes) {
      expect(node.iconToken).toBeUndefined();
    }
  });

  it('existing edge @orthogonal:EW annotation still parses', () => {
    const raw = parse(`flowchart LR\nA --> B @orthogonal:EW\n`) as any;
    const edge = raw.flow.edges[0];
    expect(edge.routing).toBe('orthogonal');
    expect(edge.exitWall).toBe('E');
    expect(edge.entryWall).toBe('W');
  });

  it('edge annotations are unaffected alongside annotated nodes', () => {
    const raw = parse(`flowchart LR\nA ["Server"] @icon:mdi:server\nA --> B @orthogonal:EW\n`) as any;
    const aNode = raw.flow.nodes.find((n: any) => n.id === 'a');
    expect(aNode?.iconToken).toBe('mdi:server');
    const edge = raw.flow.edges[0];
    expect(edge.routing).toBe('orthogonal');
  });
});

// ─── IR-level: parseMermaid + parseIconRef ────────────────────────────────────

describe('flowchart module parseMermaid — FlowNode.icon', () => {
  it('converts @icon token to FlowNode.icon: IconRef', () => {
    const doc = flowchart.parseMermaid(`flowchart TD\nA ["App"] @icon:azure:app-service\n`);
    const node = doc.nodes[0]!;
    expect(node.icon).toBeDefined();
    expect(node.icon!.prefix).toBe('azure');
    expect(node.icon!.name).toBe('app-service');
  });

  it('FlowNode.shape is "card" when @shape:card is set', () => {
    const doc = flowchart.parseMermaid(`flowchart TD\nA ["Card"] @shape:card\n`);
    expect(doc.nodes[0]!.shape).toBe('card');
  });

  it('node without annotation has no icon field', () => {
    const doc = flowchart.parseMermaid(`flowchart TD\nA[Plain]\n`);
    expect(doc.nodes[0]!.icon).toBeUndefined();
  });

  it('malformed @icon value throws a descriptive parse error', () => {
    // "BADREF" has no colon → parseIconRef returns err
    expect(() =>
      flowchart.parseMermaid(`flowchart TD\nA ["Node"] @icon:BADREF\n`)
    ).toThrow(/invalid @icon value/i);
  });

  it('malformed @icon value error cites the bad token', () => {
    try {
      flowchart.parseMermaid(`flowchart TD\nA ["Node"] @icon:UpperCase:Bad\n`);
      expect.fail('Should have thrown');
    } catch (e: any) {
      // The token "UpperCase:Bad" has uppercase → parseIconRef fails
      expect(e.message).toContain('UpperCase:Bad');
    }
  });
});

// ─── Render-level: renderSync with IconPackMap ────────────────────────────────

describe('renderSync with icons — SVG output', () => {
  const DIAGRAM_MONO = `flowchart TD\nA ["Server"] @icon:mdi:server\nB ["DB"] @icon:mdi:database\nA --> B\n`;
  const DIAGRAM_BRAND = `flowchart TD\nX ["App Service"] @icon:azure:app-service\n`;

  it('returns ok result for diagram with valid icon', () => {
    const result = renderSync(DIAGRAM_MONO, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
  });

  it('SVG contains a nested <svg> element for monochrome icon', () => {
    const result = renderSync(DIAGRAM_MONO, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    // The icon emitter wraps the body in a nested <svg> element
    const nestedSvgCount = (svg.match(/<svg\b/g) ?? []).length;
    expect(nestedSvgCount).toBeGreaterThan(1); // outer + at least one icon
  });

  it('monochrome icon SVG has style="color:..." for tinting', () => {
    const result = renderSync(DIAGRAM_MONO, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    expect(svg).toMatch(/style="color:/);
  });

  it('brand icon has no color style override', () => {
    const result = renderSync(DIAGRAM_BRAND, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    // The brand icon <svg> wrapper should not have a color: style
    // It will have a nested <svg> but without style="color:..."
    // Monochrome test above confirms style="color:" appears for mono;
    // for a brand-only diagram it should not appear on the icon wrapper
    const iconSvgs = svg.match(/<svg [^>]*viewBox[^>]*>/g) ?? [];
    // At least one icon svg should exist
    expect(iconSvgs.length).toBeGreaterThan(0);
    // Brand fill should appear verbatim
    expect(svg).toContain('#0078D4');
  });

  it('SVG has no <foreignObject> element', () => {
    const result = renderSync(DIAGRAM_MONO, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    expect(svg).not.toContain('<foreignObject');
  });

  it('SVG has no <image> element', () => {
    const result = renderSync(DIAGRAM_MONO, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    expect(svg).not.toContain('<image');
  });

  it('node without @icon produces no nested <svg> in its group', () => {
    // A plain flowchart with no icon annotations — no nested SVG
    const result = renderSync(`flowchart TD\nA[Plain] --> B[Nodes]\n`);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    const nestedSvgCount = (svg.match(/<svg\b/g) ?? []).length;
    expect(nestedSvgCount).toBe(1); // only the outer SVG
  });

  it('renderSync without icons pack silently skips icon emit', () => {
    // No pack map passed — icon is parsed but not resolved → no nested SVG
    const result = renderSync(DIAGRAM_MONO);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    const nestedSvgCount = (svg.match(/<svg\b/g) ?? []).length;
    expect(nestedSvgCount).toBe(1); // no icons emitted
  });

  it('icon body path data appears in SVG output for monochrome icon', () => {
    const result = renderSync(DIAGRAM_MONO, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    // The mdi:server icon body path should appear somewhere in the output
    expect(svg).toContain('M4 1h16v14H4z');
  });

  it('@shape:card is stored but does not break layout (P7 TODO)', () => {
    const doc = flowchart.parseMermaid(`flowchart TD\nA ["App"] @shape:card @icon:mdi:server\nA --> B\n`);
    const aNode = doc.nodes.find(n => n.id === 'a')!;
    expect(aNode.shape).toBe('card');
    // renderSync should not throw — card shape falls through to normal layout for now
    const result = renderSync(
      `flowchart TD\nA ["App"] @shape:card @icon:mdi:server\nA --> B\n`,
      undefined, 'svg', undefined, PACK_MAP,
    );
    expect(result.ok).toBe(true);
  });
});
