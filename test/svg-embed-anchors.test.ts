import { describe, it, expect } from 'vitest';
import { embedAnchorManifest } from '../src/render/svg.js';
import { compileAndRenderSync } from '../src/frontend/index.js';
import '../src/frontend/index.js'; // registers diagram modules

// ─── embedAnchorManifest unit tests ──────────────────────────────────────────

const baseSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n</svg>';

describe('embedAnchorManifest', () => {
  it('inserts a parseable JSON <script> block before </svg>', () => {
    const anchors = { n0: { bounds: { x: 0, y: 0, width: 50, height: 30 } } };
    const result = embedAnchorManifest(baseSvg, anchors);
    expect(result).toContain('<script type="application/json" id="triton-anchors">');
    expect(result).toContain('</script>');
    expect(result).toMatch(/<\/svg>$/);
    const match = result.match(/<script type="application\/json" id="triton-anchors">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed.n0.bounds.width).toBe(50);
  });

  it('places the manifest immediately before the closing </svg>', () => {
    const anchors = { a: { bounds: { x: 0, y: 0, width: 10, height: 10 } } };
    const result = embedAnchorManifest(baseSvg, anchors);
    const scriptClose = result.lastIndexOf('</script>');
    const svgClose = result.lastIndexOf('</svg>');
    // </script> must appear before </svg>
    expect(scriptClose).toBeLessThan(svgClose);
    // and nothing significant between them (just whitespace/newline)
    const between = result.slice(scriptClose + '</script>'.length, svgClose);
    expect(between.trim()).toBe('');
  });

  it('sorts keys deterministically', () => {
    const anchors = {
      z_node: { bounds: { x: 5, y: 5, width: 10, height: 10 } },
      a_node: { bounds: { x: 0, y: 0, width: 10, height: 10 } },
      m_node: { bounds: { x: 2, y: 2, width: 10, height: 10 } },
    };
    const result = embedAnchorManifest(baseSvg, anchors);
    const match = result.match(/<script type="application\/json" id="triton-anchors">([\s\S]*?)<\/script>/);
    const parsed = JSON.parse(match![1]);
    const keys = Object.keys(parsed);
    expect(keys).toEqual(['a_node', 'm_node', 'z_node']);
  });

  it('produces identical output on two calls (deterministic)', () => {
    const anchors = {
      b: { bounds: { x: 1, y: 2, width: 3, height: 4 } },
      a: { bounds: { x: 5, y: 6, width: 7, height: 8 } },
    };
    expect(embedAnchorManifest(baseSvg, anchors)).toBe(embedAnchorManifest(baseSvg, anchors));
  });

  it('preserves the original SVG content before </svg>', () => {
    const anchors = { n0: { bounds: { x: 0, y: 0, width: 50, height: 50 } } };
    const result = embedAnchorManifest(baseSvg, anchors);
    expect(result).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">');
  });

  it('escapes </ sequences in JSON values to prevent script tag break-out', () => {
    const anchors = {
      'evil</script>': { bounds: { x: 0, y: 0, width: 10, height: 10 } },
    };
    const result = embedAnchorManifest(baseSvg, anchors);
    // The raw string </script> must not appear inside the script content
    // (only the closing tag itself is allowed)
    const scriptContent = result.match(
      /<script type="application\/json" id="triton-anchors">([\s\S]*?)<\/script>/,
    );
    expect(scriptContent).not.toBeNull();
    // The inner content must not contain an unescaped </
    expect(scriptContent![1]).not.toContain('</');
    // But it should round-trip correctly via JSON.parse
    const parsed = JSON.parse(scriptContent![1].replace(/<\\\//g, '</'));
    expect(Object.keys(parsed)).toContain('evil</script>');
  });

  it('handles empty anchors gracefully', () => {
    const result = embedAnchorManifest(baseSvg, {});
    expect(result).toContain('<script type="application/json" id="triton-anchors">');
    const match = result.match(/<script type="application\/json" id="triton-anchors">([\s\S]*?)<\/script>/);
    expect(JSON.parse(match![1])).toEqual({});
  });
});

// ─── compileAndRenderSync integration tests ───────────────────────────────────

const treeInput = `tree
  Root
    Left
    Right
`;

const flowchartInput = `flowchart LR
  X --> Y
`;

describe('compileAndRenderSync', () => {
  it('returns ok result with svg and anchors for a tree diagram', () => {
    const result = compileAndRenderSync(treeInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toBeTruthy();
    expect(typeof result.value.svg).toBe('string');
    expect(result.value.anchors).toBeTruthy();
    expect(typeof result.value.anchors).toBe('object');
  });

  it('svg contains the embedded anchor manifest script tag', () => {
    const result = compileAndRenderSync(treeInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg).toContain('<script type="application/json" id="triton-anchors">');
  });

  it('embedded manifest is valid JSON matching the returned anchors', () => {
    const result = compileAndRenderSync(flowchartInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const match = result.value.svg.match(
      /<script type="application\/json" id="triton-anchors">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(Object.keys(parsed)).toEqual(Object.keys(result.value.anchors).sort());
  });

  it('anchors object is populated (has at least one entry for linkable diagrams)', () => {
    const result = compileAndRenderSync(flowchartInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.anchors).length).toBeGreaterThan(0);
  });

  it('returns err result for unknown diagram type', () => {
    const result = compileAndRenderSync('not_a_diagram\nfoo bar');
    expect(result.ok).toBe(false);
  });

  it('svg still ends with </svg>', () => {
    const result = compileAndRenderSync(treeInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.svg.trimEnd()).toMatch(/<\/svg>$/);
  });
});
