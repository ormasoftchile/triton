/**
 * @file grammars/er/theme.ts — ER Grammar theme tokens.
 */

export interface ErTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  entityPadX: number;
  entityPadY: number;
  minEntityWidth: number;
  titleFill: string;
  titleStroke: string;
  titleStrokeWidth: number;
  titleRx: number;
  titleTextColor: string;
  titleFontSize: number;
  titleFontWeight: number | string;
  bodyFill: string;
  bodyStroke: string;
  bodyStrokeWidth: number;
  attrTypeFontSize: number;
  attrTypeColor: string;
  attrNameFontSize: number;
  attrNameColor: string;
  attrKeyFontSize: number;
  attrKeyColor: string;
  compartmentDividerStroke: string;
  compartmentDividerWidth: number;
  edgeStroke: string;
  edgeStrokeWidth: number;
  edgeDash: string;
  crowFootSize: number;
  entityGapX: number;
  entityGapY: number;
  lineHeight: number;
  edgeLabelFontSize: number;
  edgeLabelColor: string;
}

export const defaultErTheme: ErTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 48,
  marginRight: 48,
  marginTop: 48,
  marginBottom: 48,
  entityPadX: 14,
  entityPadY: 10,
  minEntityWidth: 220,
  titleFill: '#dbeafe',
  titleStroke: '#3b82f6',
  titleStrokeWidth: 1.5,
  titleRx: 10,
  titleTextColor: '#1e3a8a',
  titleFontSize: 16,
  titleFontWeight: 700,
  bodyFill: '#f8fafc',
  bodyStroke: '#cbd5e1',
  bodyStrokeWidth: 1.2,
  attrTypeFontSize: 12,
  attrTypeColor: '#475569',
  attrNameFontSize: 13,
  attrNameColor: '#0f172a',
  attrKeyFontSize: 11,
  attrKeyColor: '#1d4ed8',
  compartmentDividerStroke: '#94a3b8',
  compartmentDividerWidth: 1.2,
  edgeStroke: '#334155',
  edgeStrokeWidth: 1.5,
  edgeDash: '6,4',
  crowFootSize: 12,
  entityGapX: 120,
  entityGapY: 56,
  lineHeight: 20,
  edgeLabelFontSize: 11,
  edgeLabelColor: '#334155',
};

export const darkErTheme: ErTheme = {
  ...defaultErTheme,
  background: '#0f172a',
  titleFill: '#1e3a5f',
  titleStroke: '#2dd4bf',
  titleTextColor: '#e2e8f0',
  bodyFill: '#1e293b',
  bodyStroke: '#14b8a6',
  attrTypeColor: '#93c5fd',
  attrNameColor: '#e2e8f0',
  attrKeyColor: '#99f6e4',
  compartmentDividerStroke: '#2dd4bf',
  edgeStroke: '#5eead4',
  edgeLabelColor: '#ccfbf1',
};

export const ER_THEME_REGISTRY: Record<string, ErTheme> = {
  'default-er': defaultErTheme,
  'dark-er': darkErTheme,
};

export function resolveErTheme(name?: string): ErTheme {
  if (!name) return defaultErTheme;
  return ER_THEME_REGISTRY[name] ?? defaultErTheme;
}
