import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../src/theme/resolver.js';
import {
  defaultTheme,
  executiveTheme,
  minimalTheme,
  themePresetNames,
} from '../src/theme/preset.js';
import { compileSync, renderSync } from '../src/frontend/index.js';
import { readFileSync } from 'node:fs';

describe('resolveTheme', () => {
  it('empty input returns base unchanged', () => {
    const result = resolveTheme({}, defaultTheme);
    expect(result.name).toBe(defaultTheme.name);
    expect(result.palette.primary).toBe(defaultTheme.palette.primary);
    expect(result.typography.baseFontSize).toBe(defaultTheme.typography.baseFontSize);
  });

  describe('theme preset selection', () => {
    it('exports the ordered built-in preset names', () => {
      expect(themePresetNames).toEqual([
        'default',
        'executive',
        'minimal',
        'editorial',
        'editorial-dark',
        'bw-light',
        'bw-dark',
        'consulting',
        'product',
        'release',
        'ai-timeline',
        'bytebytego',
        'gitline',
        'our-timeline',
        'subject-timeline',
        'showcase',
        'spectrum',
      ]);
    });

    it('forced preset wins over diagram metadata', () => {
      const result = compileSync(
        '---\ntheme: minimal\n---\nflowchart TD\nA --> B\n',
        undefined,
        'executive',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scene.background).toBe(executiveTheme.palette.background);
    });

    it('diagram metadata is used when no forced preset is provided', () => {
      const result = compileSync('---\ntheme: executive\n---\nflowchart TD\nA --> B\n');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scene.background).toBe(executiveTheme.palette.background);
    });

    it('unknown forced preset falls back safely to default', () => {
      const result = compileSync(
        '---\ntheme: executive\n---\nflowchart TD\nA --> B\n',
        undefined,
        'not-a-theme',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scene.background).toBe(defaultTheme.palette.background);
    });

    it('forced presets produce distinct SVG for the array example', () => {
      const input = readFileSync('examples/triton/ds/array/array.mmd', 'utf8');
      const minimal = renderSync(input, undefined, 'svg', minimalTheme.name);
      const executive = renderSync(input, undefined, 'svg', executiveTheme.name);
      expect(minimal.ok && executive.ok).toBe(true);
      if (!minimal.ok || !executive.ok) return;
      expect(minimal.value).not.toBe(executive.value);
    });
  });

  it('overrides name', () => {
    const result = resolveTheme({ name: 'dark' }, defaultTheme);
    expect(result.name).toBe('dark');
  });

  it('merges palette partially — only provided fields change', () => {
    const result = resolveTheme({ palette: { primary: '#FF0000' } }, defaultTheme);
    expect(result.palette.primary).toBe('#FF0000');
    expect(result.palette.secondary).toBe(defaultTheme.palette.secondary);
    expect(result.palette.background).toBe(defaultTheme.palette.background);
  });

  it('merges typography partially', () => {
    const result = resolveTheme({ typography: { baseFontSize: 16 } }, defaultTheme);
    expect(result.typography.baseFontSize).toBe(16);
    expect(result.typography.fontFamily).toBe(defaultTheme.typography.fontFamily);
  });

  it('merges spacing partially', () => {
    const result = resolveTheme({ spacing: { nodeGap: 60 } }, defaultTheme);
    expect(result.spacing.nodeGap).toBe(60);
    expect(result.spacing.unit).toBe(defaultTheme.spacing.unit);
  });

  it('merges edges partially', () => {
    const result = resolveTheme({ edges: { strokeWidth: 3 } }, defaultTheme);
    expect(result.edges.strokeWidth).toBe(3);
    expect(result.edges.arrowSize).toBe(defaultTheme.edges.arrowSize);
  });

  it('merges nodes semantic tokens partially', () => {
    const result = resolveTheme(
      { nodes: { standard: { cornerRadius: 10, borderWidth: 2.5 } } },
      defaultTheme,
    );
    expect(result.nodes?.standard.cornerRadius).toBe(10);
    expect(result.nodes?.standard.borderWidth).toBe(2.5);
    expect(result.nodes?.standard.padding).toBe(defaultTheme.nodes?.standard.padding);
    expect(result.nodes?.leaf.cornerRadius).toBe(defaultTheme.nodes?.leaf.cornerRadius);
  });

  it('renders coherent borders and typography across flowchart, tree, and nodegraph', () => {
    const flow = renderSync(`flowchart TD
  source[Incoming Records]
  parse[Parse Payload]
  source -->|batch| parse
`);
    const tree = renderSync(`tree TD
  title Record Processing
  Incoming Records :box
    Parse Payload :box
`);
    const graph = renderSync(`nodegraph
  directed
  title Record Processing
  node source : Incoming Records
  node parse : Parse Payload
  source -> parse : batch
`);

    expect(flow.ok && tree.ok && graph.ok).toBe(true);
    if (!flow.ok || !tree.ok || !graph.ok) return;

    // Standard nodes have rx=6, strokeWidth=1.5, stroke=#CBD5E1 across all three
    expect(flow.value).toContain('rx="6"');
    expect(flow.value).toContain('stroke="#CBD5E1"');
    expect(flow.value).toContain('stroke-width="1.5"');

    expect(tree.value).toContain('rx="6"');
    expect(tree.value).toContain('stroke="#CBD5E1"');
    expect(tree.value).toContain('stroke-width="1.5"');

    expect(graph.value).toContain('rx="6"');
    expect(graph.value).toContain('stroke="#CBD5E1"');
    expect(graph.value).toContain('stroke-width="1.5"');

    // Edge labels use font-size="12"
    expect(flow.value).toContain('font-size="12"');
    expect(graph.value).toContain('font-size="12"');
  });

  it('full override produces independent object (does not mutate base)', () => {
    const input = {
      palette: {
        primary: '#aaa',
        secondary: '#bbb',
        background: '#ccc',
        surface: '#ddd',
        border: '#eee',
        text: '#fff',
        textMuted: '#000',
        success: '#111',
        warning: '#222',
        error: '#333',
      },
    };
    resolveTheme(input, defaultTheme);
    expect(defaultTheme.palette.primary).toBe('#4A90D9'); // unchanged
  });
});
