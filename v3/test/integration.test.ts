import { describe, it, expect } from 'vitest';
import { render, compile } from '../src/frontend/index.js';
import { detect } from '../src/frontend/detect.js';

// ─── Detection ────────────────────────────────────────────────────────────────

describe('detect', () => {
  it('detects Mermaid flowchart', () => {
    expect(detect('flowchart TD\nA --> B\n').diagramType).toBe('flowchart');
    expect(detect('flowchart TD\nA --> B\n').format).toBe('mermaid');
  });

  it('detects graph keyword as flowchart', () => {
    expect(detect('graph LR\nA --> B\n').diagramType).toBe('flowchart');
  });

  it('detects timeline', () => {
    expect(detect('timeline\n    2025 : Start\n').diagramType).toBe('timeline');
  });

  it('detects poster', () => {
    expect(detect('poster "My Poster"\n    columns 2\n').diagramType).toBe('poster');
  });

  it('detects YAML format by type field', () => {
    const r = detect('type: flowchart\nnodes: []');
    expect(r.format).toBe('yaml');
    expect(r.diagramType).toBe('flowchart');
  });

  it('defaults to flowchart for unrecognised input', () => {
    expect(detect('something random').diagramType).toBe('flowchart');
  });
});

// ─── Full pipeline ────────────────────────────────────────────────────────────

describe('render — flowchart', () => {
  const input = `flowchart LR\nBuild[Build] --> Test[Test] --> Deploy[Deploy]\n`;

  it('produces SVG string', async () => {
    const result = await render(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatch(/^<svg /);
    expect(result.value).toMatch(/<\/svg>$/);
  });

  it('SVG contains node labels', async () => {
    const result = await render(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('Build');
    expect(result.value).toContain('Test');
    expect(result.value).toContain('Deploy');
  });

  it('theme override changes primary color in output', async () => {
    const result = await render(input, { palette: { primary: '#DEADBE' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('#DEADBE');
  });
});

describe('render — timeline', () => {
  const input = `timeline\n    title My Roadmap\n    2025-01 : Start : milestone\n    2025-06 : Launch : milestone\n`;

  it('produces SVG string', async () => {
    const result = await render(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatch(/^<svg /);
  });

  it('SVG contains milestone labels', async () => {
    const result = await render(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('Start');
    expect(result.value).toContain('Launch');
  });

  it('SVG contains title', async () => {
    const result = await render(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('My Roadmap');
  });
});

describe('compile', () => {
  it('returns a Result with a Scene with valid viewBox', async () => {
    const result = await compile('flowchart TD\nA --> B\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scene.viewBox.width).toBeGreaterThan(0);
    expect(result.value.scene.viewBox.height).toBeGreaterThan(0);
  });

  it('returns error result for unregistered diagram types', async () => {
    // `packet` is a recognised kind but has no registered module yet.
    const result = await compile('packet-beta\n0-15: "Header"\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNKNOWN_DIAGRAM');
  });

  it('returns error result for malformed input', async () => {
    const result = await compile('flowchart TD\n---malformed!!!\n');
    expect(result.ok).toBe(false);
  });
});

describe('render — unknown renderer', () => {
  it('returns UNKNOWN_RENDERER error for unregistered renderer', async () => {
    const result = await render('flowchart TD\nA --> B\n', undefined, 'pdf');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNKNOWN_RENDERER');
  });
});

describe('theme propagation end-to-end', () => {
  it('dark theme background appears in rendered SVG', async () => {
    const result = await render('flowchart TD\nA --> B\n', { palette: { background: '#0d0d0d' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('#0d0d0d');
  });

  it('same input with different themes produces different SVG', async () => {
    const input = 'flowchart TD\nA --> B\n';
    const light = await render(input);
    const dark  = await render(input, { palette: { background: '#111', primary: '#f00' } });
    expect(light.ok && dark.ok).toBe(true);
    if (!light.ok || !dark.ok) return;
    expect(light.value).not.toBe(dark.value);
  });
});

