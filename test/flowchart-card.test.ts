/**
 * P7 Card Node Tests
 *
 * Validates the full card node pipeline:
 *   grammar (@shape:card @icon) → IR → layout (per-node sizing, two-region)
 *   → SVG (bg rect + icon + title + body)
 *
 * Covers:
 *   - Title/body split on literal newline and \n escape
 *   - Card width grows with longer text (content-driven sizing)
 *   - Card width clamp [CARD_MIN_W=192, CARD_MAX_W=400]
 *   - Card without icon renders text-only (no icon crash)
 *   - Icon rendered at left region, text at right region
 *   - Body wraps/truncates to ≤3 lines
 *   - Non-card nodes are unaffected (still 120×40)
 *   - Edges attach to card's actual bounds (not phantom 120×40)
 *   - No <foreignObject> or <image> in output
 *   - Background rect has rx attribute (rounded corners)
 *   - Bold title emitted for card nodes
 */

import { describe, it, expect } from 'vitest';
import { layoutFlowchart } from '../src/diagrams/mermaid/flowchart/layout.js';
import { flowchart } from '../src/diagrams/mermaid/flowchart/index.js';
import { renderSync } from '../src/frontend/index.js';
import { defaultTheme } from '../src/theme/preset.js';
import type { FlowDocument } from '../src/diagrams/mermaid/flowchart/ir.js';
import type { IconPackMap, IconifyJSON } from '../src/contracts/icons.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MONO_PACK: IconifyJSON = {
  prefix: 'mdi',
  icons: {
    server:   { body: '<path fill="currentColor" d="M4 1h16v14H4z"/>' },
    database: { body: '<circle fill="currentColor" cx="12" cy="12" r="8"/>' },
    cloud:    { body: '<path fill="currentColor" d="M12 2a7 7 0 017 7c0 4-3 7-7 7s-7-3-7-7a7 7 0 017-7z"/>' },
  },
  width: 24, height: 24, left: 0, top: 0,
};

const PACK_MAP: IconPackMap = new Map([['mdi', MONO_PACK]]);

// ─── Layout-level helpers ─────────────────────────────────────────────────────

function makeCardDoc(nodes: FlowDocument['nodes'], edges: FlowDocument['edges'] = []): FlowDocument {
  return {
    version: '1.0',
    metadata: {},
    direction: 'TD',
    nodes,
    edges,
    subgraphs: [],
  };
}

function getNodeRect(doc: FlowDocument, id: string) {
  const result = layoutFlowchart(doc, defaultTheme);
  return result.anchors[id]?.bounds;
}

function getGroupChildren(svg: string, id: string): string {
  // Extract children of the group with the given id
  const groupMatch = svg.match(new RegExp(`<g id="${id}"[^>]*>([\\s\\S]*?)</g>`));
  return groupMatch?.[1] ?? '';
}

// ─── Title / body split ───────────────────────────────────────────────────────

describe('card node — title/body split', () => {
  it('label with actual newline: first line = title, rest = body', () => {
    const doc = makeCardDoc([{
      id: 'a', shape: 'card', label: 'App Service\nHTTP routing and load balancing',
    }]);
    const result = layoutFlowchart(doc, defaultTheme, { icons: PACK_MAP });
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const texts = group.children.filter((c: any) => c.type === 'text');
    const title = texts[0];
    expect(title?.content).toBe('App Service');
    expect(title?.fontWeight).toBe('bold');
  });

  it('label without newline: entire label is title, no body', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Just a title' }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const texts = group.children.filter((c: any) => c.type === 'text');
    expect(texts.length).toBe(1);
    expect(texts[0]?.content).toBe('Just a title');
  });

  it('label with \\n escape sequence: title = first part, body = second part', () => {
    // Simulate \n as two-char escape (as written in .mmd files)
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Title\\nBody text here' }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const texts = group.children.filter((c: any) => c.type === 'text');
    expect(texts[0]?.content).toBe('Title');
    expect(texts[0]?.fontWeight).toBe('bold');
  });

  it('body text appears as separate text elements below title', () => {
    const doc = makeCardDoc([{
      id: 'a', shape: 'card',
      label: 'App Service\nHandles HTTP requests and routes to backend services',
    }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const texts = group.children.filter((c: any) => c.type === 'text');
    expect(texts.length).toBeGreaterThan(1); // title + at least one body line
    // Body text should be below title (higher y value)
    expect(texts[1]?.position.y).toBeGreaterThan(texts[0]?.position.y);
  });
});

// ─── Content-driven sizing ─────────────────────────────────────────────────────

describe('card node — content-driven sizing', () => {
  it('card with short title: width ≥ CARD_MIN_W (192)', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Hi' }]);
    const rect = getNodeRect(doc, 'a');
    expect(rect?.width).toBeGreaterThanOrEqual(192);
  });

  it('card with very long title: width ≤ CARD_MAX_W (400)', () => {
    const long = 'A'.repeat(200);
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: long }]);
    const rect = getNodeRect(doc, 'a');
    expect(rect?.width).toBeLessThanOrEqual(400);
  });

  it('longer title produces wider card than shorter title', () => {
    const short = makeCardDoc([{ id: 'a', shape: 'card', label: 'Hi' }]);
    const long  = makeCardDoc([{ id: 'a', shape: 'card', label: 'A very long title that is much wider than Hi' }]);
    const shortRect = getNodeRect(short, 'a');
    const longRect  = getNodeRect(long,  'a');
    expect(longRect!.width).toBeGreaterThan(shortRect!.width);
  });

  it('card with multi-line body is taller than card without body', () => {
    // Body that definitely wraps to 2+ lines: forces textH > CARD_ICON_BOX (40px)
    const longBody = 'Handles HTTP request routing load balancing and traffic shaping in the DMZ zone';
    const noBody = makeCardDoc([{ id: 'a', shape: 'card', label: 'Title' }]);
    const withBody = makeCardDoc([{ id: 'a', shape: 'card', label: `Title\n${longBody}` }]);
    const noBodyRect = getNodeRect(noBody, 'a');
    const bodyRect   = getNodeRect(withBody, 'a');
    expect(bodyRect!.height).toBeGreaterThan(noBodyRect!.height);
  });

  it('card height ≥ icon box height (40px) + 2*padding (8px each)', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Hi' }]);
    const rect = getNodeRect(doc, 'a');
    expect(rect?.height).toBeGreaterThanOrEqual(40 + 2 * 8); // CARD_ICON_BOX + 2*CARD_PAD
  });
});

// ─── Card structure in layout ─────────────────────────────────────────────────

describe('card node — layout structure', () => {
  it('card node group contains a background rect', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Service\nDoes stuff' }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const rect = group.children.find((c: any) => c.type === 'rect');
    expect(rect).toBeDefined();
    expect(rect?.rx).toBe(6); // rounded corners
  });

  it('card background rect has fillOpacity 0.85', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Service' }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const rect = group.children.find((c: any) => c.type === 'rect');
    expect(rect?.fillOpacity).toBe(0.85);
  });

  it('card group with icon contains an icon element', () => {
    const doc = makeCardDoc([{
      id: 'a', shape: 'card', label: 'Server',
      icon: { prefix: 'mdi', name: 'server' },
    }]);
    const result = layoutFlowchart(doc, defaultTheme, { icons: PACK_MAP });
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const icon = group.children.find((c: any) => c.type === 'icon');
    expect(icon).toBeDefined();
  });

  it('icon is positioned left of text (icon x < text x)', () => {
    const doc = makeCardDoc([{
      id: 'a', shape: 'card', label: 'Server',
      icon: { prefix: 'mdi', name: 'server' },
    }]);
    const result = layoutFlowchart(doc, defaultTheme, { icons: PACK_MAP });
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const icon = group.children.find((c: any) => c.type === 'icon');
    const text = group.children.find((c: any) => c.type === 'text');
    expect(icon?.x).toBeLessThan(text?.position.x);
  });

  it('card without icon still renders title (no crash)', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Title\nBody' }]);
    const result = layoutFlowchart(doc, defaultTheme); // no icons
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const texts = group.children.filter((c: any) => c.type === 'text');
    expect(texts.length).toBeGreaterThan(0);
    const iconEl = group.children.find((c: any) => c.type === 'icon');
    expect(iconEl).toBeUndefined();
  });

  it('title has bold font weight', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Bold Title' }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const title = group.children.find((c: any) => c.type === 'text');
    expect(title?.fontWeight).toBe('bold');
  });
});

// ─── Body wrapping ────────────────────────────────────────────────────────────

describe('card node — body wrapping', () => {
  it('body with many words wraps to ≤3 lines', () => {
    const longBody = 'This is a very long body text that should wrap across multiple lines because it exceeds the available width of the card region completely';
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: `Title\n${longBody}` }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const bodyTexts = group.children.filter((c: any) =>
      c.type === 'text' && c.fontWeight !== 'bold',
    );
    expect(bodyTexts.length).toBeLessThanOrEqual(3);
    expect(bodyTexts.length).toBeGreaterThan(0);
  });

  it('short body renders as a single text element', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'card', label: 'Title\nShort body' }]);
    const result = layoutFlowchart(doc, defaultTheme);
    const group = result.scene.elements.find(e => e.type === 'group' && (e as any).id === 'a') as any;
    const bodyTexts = group.children.filter((c: any) =>
      c.type === 'text' && c.fontWeight !== 'bold',
    );
    expect(bodyTexts.length).toBe(1);
  });
});

// ─── Edge attachment ──────────────────────────────────────────────────────────

describe('card node — edge bounds', () => {
  it('edges attach to card actual bounds, not phantom 120×40', () => {
    const doc = makeCardDoc(
      [
        { id: 'src', shape: 'rect', label: 'Source' },
        { id: 'card', shape: 'card', label: 'App Service\nRoutes HTTP traffic to backend' },
      ],
      [{ from: 'src', to: 'card', style: 'solid' }],
    );
    const result = layoutFlowchart(doc, defaultTheme);
    const cardBounds = result.anchors['card']?.bounds;
    expect(cardBounds).toBeDefined();
    // Card must be wider than the default 120px
    expect(cardBounds!.width).toBeGreaterThan(120);
    // Port W (left side) should be at card's actual x
    expect(result.anchors['card']?.ports.W.x).toBe(cardBounds!.x);
    // Port E (right side) should be at card's actual right edge
    expect(result.anchors['card']?.ports.E.x).toBe(cardBounds!.x + cardBounds!.width);
  });

  it('non-card nodes are unaffected (width = 120, height = 40)', () => {
    const doc = makeCardDoc([{ id: 'a', shape: 'rect', label: 'Plain' }]);
    const rect = getNodeRect(doc, 'a');
    expect(rect?.width).toBe(120);
    expect(rect?.height).toBe(40);
  });
});

// ─── SVG safety ───────────────────────────────────────────────────────────────

describe('card node — SVG safety (no foreignObject / image)', () => {
  const CARD_DIAGRAM = `flowchart TD
A ["App Service\\nHTTP routing"] @shape:card @icon:mdi:server
B ["DB\\nPrimary store"] @shape:card @icon:mdi:database
A --> B
`;

  it('SVG output contains no <foreignObject>', () => {
    const result = renderSync(CARD_DIAGRAM, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    expect(svg).not.toContain('<foreignObject');
  });

  it('SVG output contains no <image>', () => {
    const result = renderSync(CARD_DIAGRAM, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    expect(svg).not.toContain('<image');
  });

  it('SVG output contains card background rect with rx', () => {
    const result = renderSync(CARD_DIAGRAM, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    expect(svg).toMatch(/rx="6"/);
  });

  it('SVG output contains nested svg for icon', () => {
    const result = renderSync(CARD_DIAGRAM, undefined, 'svg', undefined, PACK_MAP);
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    const nestedSvg = (svg.match(/<svg\b/g) ?? []).length;
    expect(nestedSvg).toBeGreaterThan(1); // outer + at least one icon
  });

  it('card renders ok even without an icon pack', () => {
    const result = renderSync(CARD_DIAGRAM); // no pack
    expect(result.ok).toBe(true);
  });
});

// ─── Grammar integration ──────────────────────────────────────────────────────

describe('card node — grammar integration', () => {
  it('parses @shape:card and @icon together via renderSync', () => {
    const result = renderSync(
      'flowchart TD\nA ["Service\\nDoes things"] @shape:card @icon:mdi:server\n',
      undefined, 'svg', undefined, PACK_MAP,
    );
    expect(result.ok).toBe(true);
  });

  it('@shape:card without @icon renders title-only card', () => {
    const result = renderSync(
      'flowchart TD\nA ["Plain Card"] @shape:card\n',
    );
    expect(result.ok).toBe(true);
  });

  it('existing non-card diagram is unaffected', () => {
    const result = renderSync(
      'flowchart LR\nA[Build] --> B[Test] --> C[Deploy]\n',
    );
    expect(result.ok).toBe(true);
    const svg = result.ok ? result.value : '';
    // Should not have rx=6 (card-style corners)
    expect(svg).not.toMatch(/rx="6"/);
  });
});
