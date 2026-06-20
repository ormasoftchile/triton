import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../src/theme/resolver.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('resolveTheme', () => {
  it('empty input returns base unchanged', () => {
    const result = resolveTheme({}, defaultTheme);
    expect(result.name).toBe(defaultTheme.name);
    expect(result.palette.primary).toBe(defaultTheme.palette.primary);
    expect(result.typography.baseFontSize).toBe(defaultTheme.typography.baseFontSize);
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

  it('full override produces independent object (does not mutate base)', () => {
    const input = { palette: { primary: '#aaa', secondary: '#bbb', background: '#ccc', surface: '#ddd', border: '#eee', text: '#fff', textMuted: '#000', success: '#111', warning: '#222', error: '#333' } };
    resolveTheme(input, defaultTheme);
    expect(defaultTheme.palette.primary).toBe('#4A90D9'); // unchanged
  });
});
