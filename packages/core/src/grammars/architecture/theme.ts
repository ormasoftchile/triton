/**
 * @file grammars/architecture/theme.ts — ArchitectureTheme token surface.
 */

export interface ArchitectureTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  gridCellWidth: number;
  gridCellHeight: number;
  componentGapCols: number;
  serviceMinWidth: number;
  servicePadX: number;
  servicePadTop: number;
  servicePadBottom: number;
  serviceRx: number;
  serviceFill: string;
  serviceStroke: string;
  serviceStrokeWidth: number;
  serviceTitleFontSize: number;
  serviceTitleFontWeight: number | string;
  serviceTitleColor: string;
  serviceIconSize: number;
  serviceIconColor: string;
  iconStrokeWidth: number;
  junctionRadius: number;
  junctionFill: string;
  junctionStroke: string;
  junctionStrokeWidth: number;
  groupFill: string;
  groupStroke: string;
  groupStrokeWidth: number;
  groupDashArray: string;
  groupPaddingX: number;
  groupPaddingY: number;
  groupHeaderHeight: number;
  groupTitleFontSize: number;
  groupTitleFontWeight: number | string;
  groupTitleColor: string;
  groupIconSize: number;
  edgeStroke: string;
  edgeStrokeWidth: number;
  edgeStub: number;
  arrowSize: number;
  titleFontSize: number;
  titleFontWeight: number | string;
  titleColor: string;
}

export const defaultArchitectureTheme: ArchitectureTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 40,
  marginRight: 40,
  marginTop: 40,
  marginBottom: 40,
  gridCellWidth: 140,
  gridCellHeight: 120,
  componentGapCols: 2,
  serviceMinWidth: 116,
  servicePadX: 14,
  servicePadTop: 14,
  servicePadBottom: 14,
  serviceRx: 12,
  serviceFill: '#f8fafc',
  serviceStroke: '#94a3b8',
  serviceStrokeWidth: 1.5,
  serviceTitleFontSize: 12,
  serviceTitleFontWeight: 600,
  serviceTitleColor: '#334155',
  serviceIconSize: 24,
  serviceIconColor: '#475569',
  iconStrokeWidth: 1.35,
  junctionRadius: 8,
  junctionFill: '#64748b',
  junctionStroke: '#475569',
  junctionStrokeWidth: 1,
  groupFill: '#f8fafc',
  groupStroke: '#94a3b8',
  groupStrokeWidth: 1.25,
  groupDashArray: '6,4',
  groupPaddingX: 18,
  groupPaddingY: 18,
  groupHeaderHeight: 28,
  groupTitleFontSize: 12,
  groupTitleFontWeight: 700,
  groupTitleColor: '#475569',
  groupIconSize: 14,
  edgeStroke: '#64748b',
  edgeStrokeWidth: 1.5,
  edgeStub: 14,
  arrowSize: 7,
  titleFontSize: 18,
  titleFontWeight: 700,
  titleColor: '#0f172a',
};

export const darkArchitectureTheme: ArchitectureTheme = {
  ...defaultArchitectureTheme,
  background: '#0f172a',
  serviceFill: '#1e293b',
  serviceStroke: '#64748b',
  serviceTitleColor: '#e2e8f0',
  serviceIconColor: '#cbd5e1',
  junctionFill: '#cbd5e1',
  junctionStroke: '#94a3b8',
  groupFill: '#111827',
  groupStroke: '#475569',
  groupTitleColor: '#cbd5e1',
  edgeStroke: '#cbd5e1',
  titleColor: '#f8fafc',
};

export const ARCHITECTURE_THEME_REGISTRY: Record<string, ArchitectureTheme> = {
  'default-architecture': defaultArchitectureTheme,
  'dark-architecture': darkArchitectureTheme,
};

export function resolveArchitectureTheme(name?: string): ArchitectureTheme {
  if (!name) return defaultArchitectureTheme;
  return ARCHITECTURE_THEME_REGISTRY[name] ?? defaultArchitectureTheme;
}
