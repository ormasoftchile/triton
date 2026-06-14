/**
 * @file grammars/class/theme.ts — ClassTheme token surface.
 */

export interface ClassTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  classPadX: number;
  classPadY: number;
  minClassWidth: number;
  compartmentDividerStroke: string;
  compartmentDividerWidth: number;
  titleFill: string;
  titleStroke: string;
  titleStrokeWidth: number;
  titleRx: number;
  titleTextColor: string;
  titleFontSize: number;
  titleFontWeight: number | string;
  stereotypeFontSize: number;
  stereotypeColor: string;
  bodyFill: string;
  bodyStroke: string;
  bodyStrokeWidth: number;
  memberFontSize: number;
  memberFontWeight: number | string;
  memberTextColor: string;
  edgeStroke: string;
  edgeStrokeWidth: number;
  edgeDash: string;
  arrowSize: number;
  classGapX: number;
  classGapY: number;
  lineHeight: number;
  edgeLabelFontSize: number;
  edgeLabelColor: string;
  cardinalityFontSize: number;
  cardinalityColor: string;
}

export const defaultClassTheme: ClassTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 48,
  marginRight: 48,
  marginTop: 48,
  marginBottom: 48,
  classPadX: 14,
  classPadY: 10,
  minClassWidth: 180,
  compartmentDividerStroke: '#94a3b8',
  compartmentDividerWidth: 1.2,
  titleFill: '#dbeafe',
  titleStroke: '#3b82f6',
  titleStrokeWidth: 1.5,
  titleRx: 10,
  titleTextColor: '#1e3a8a',
  titleFontSize: 16,
  titleFontWeight: 700,
  stereotypeFontSize: 12,
  stereotypeColor: '#475569',
  bodyFill: '#f8fafc',
  bodyStroke: '#cbd5e1',
  bodyStrokeWidth: 1.2,
  memberFontSize: 13,
  memberFontWeight: 500,
  memberTextColor: '#0f172a',
  edgeStroke: '#334155',
  edgeStrokeWidth: 1.5,
  edgeDash: '6,4',
  arrowSize: 12,
  classGapX: 96,
  classGapY: 48,
  lineHeight: 20,
  edgeLabelFontSize: 11,
  edgeLabelColor: '#334155',
  cardinalityFontSize: 11,
  cardinalityColor: '#475569',
};

export const darkClassTheme: ClassTheme = {
  ...defaultClassTheme,
  background: '#0f172a',
  titleFill: '#1e3a5f',
  titleStroke: '#2dd4bf',
  titleTextColor: '#e2e8f0',
  stereotypeColor: '#93c5fd',
  bodyFill: '#1e293b',
  bodyStroke: '#14b8a6',
  compartmentDividerStroke: '#2dd4bf',
  memberTextColor: '#e2e8f0',
  edgeStroke: '#5eead4',
  edgeLabelColor: '#ccfbf1',
  cardinalityColor: '#99f6e4',
};

export const CLASS_THEME_REGISTRY: Record<string, ClassTheme> = {
  'default-class': defaultClassTheme,
  'dark-class': darkClassTheme,
};

export function resolveClassTheme(name?: string): ClassTheme {
  if (!name) return defaultClassTheme;
  return CLASS_THEME_REGISTRY[name] ?? defaultClassTheme;
}
