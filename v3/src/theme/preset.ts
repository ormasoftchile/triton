import type { ResolvedTheme } from '../contracts/index.js';

export const defaultTheme: ResolvedTheme = {
  name: 'default',
  palette: {
    primary:    '#4A90D9',
    secondary:  '#7C3AED',
    background: '#FFFFFF',
    surface:    '#F8FAFC',
    border:     '#CBD5E1',
    text:       '#1E293B',
    textMuted:  '#64748B',
    success:    '#22C55E',
    warning:    '#F59E0B',
    error:      '#EF4444',
  },
  typography: {
    fontFamily:     'Inter, system-ui, -apple-system, sans-serif',
    monoFamily:     'JetBrains Mono, Fira Code, monospace',
    baseFontSize:   14,
    titleFontSize:  18,
    smallFontSize:  11,
    lineHeight:     1.4,
  },
  spacing: {
    unit:          8,
    nodePadding:   12,
    nodeGap:       40,
    diagramMargin: 24,
  },
  edges: {
    strokeWidth:   1.5,
    arrowSize:     8,
    labelFontSize: 12,
    curveTension:  0.4,
  },
} as const;
