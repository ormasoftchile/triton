/**
 * @file grammars/block/theme.ts — BlockTheme token surface.
 */

export interface BlockTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  cellWidth: number;
  cellHeight: number;
  cellGapX: number;
  cellGapY: number;
  blockFill: string;
  blockStroke: string;
  blockStrokeWidth: number;
  blockRx: number;
  blockFontSize: number;
  blockFontWeight: number | string;
  blockTextColor: string;
  circleFill: string;
  circleStroke: string;
  diamondFill: string;
  diamondStroke: string;
  groupFill: string;
  groupStroke: string;
  groupLabelFontSize: number;
  groupLabelColor: string;
  arrowStroke: string;
  arrowStrokeWidth: number;
  arrowFontSize: number;
  arrowLabelColor: string;
}

export const defaultBlockTheme: BlockTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 40,
  marginRight: 40,
  marginTop: 40,
  marginBottom: 40,
  cellWidth: 120,
  cellHeight: 50,
  cellGapX: 16,
  cellGapY: 16,
  blockFill: '#f0f4ff',
  blockStroke: '#5b7fde',
  blockStrokeWidth: 1.5,
  blockRx: 4,
  blockFontSize: 14,
  blockFontWeight: 600,
  blockTextColor: '#1e293b',
  circleFill: '#e0f2fe',
  circleStroke: '#0284c7',
  diamondFill: '#fef9c3',
  diamondStroke: '#ca8a04',
  groupFill: '#f8fafc',
  groupStroke: '#94a3b8',
  groupLabelFontSize: 12,
  groupLabelColor: '#64748b',
  arrowStroke: '#334155',
  arrowStrokeWidth: 1.5,
  arrowFontSize: 11,
  arrowLabelColor: '#334155',
};

export const darkBlockTheme: BlockTheme = {
  ...defaultBlockTheme,
  background: '#0f172a',
  blockFill: '#1e293b',
  blockStroke: '#60a5fa',
  blockTextColor: '#e2e8f0',
  circleFill: '#082f49',
  circleStroke: '#38bdf8',
  diamondFill: '#422006',
  diamondStroke: '#facc15',
  groupFill: '#111827',
  groupStroke: '#475569',
  groupLabelColor: '#cbd5e1',
  arrowStroke: '#cbd5e1',
  arrowLabelColor: '#e2e8f0',
};

export const BLOCK_THEME_REGISTRY: Record<string, BlockTheme> = {
  'default-block': defaultBlockTheme,
  'dark-block': darkBlockTheme,
};

export function resolveBlockTheme(name?: string): BlockTheme {
  if (!name) return defaultBlockTheme;
  return BLOCK_THEME_REGISTRY[name] ?? defaultBlockTheme;
}
