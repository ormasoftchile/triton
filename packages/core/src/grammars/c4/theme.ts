/**
 * @file grammars/c4/theme.ts — C4 Grammar theme tokens.
 */

export interface C4Theme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;

  elementPadX: number;
  elementPadY: number;
  elementMinWidth: number;
  elementGapX: number;
  elementGapY: number;

  stereotypeFontSize: number;
  stereotypeColor: string;
  nameFontSize: number;
  nameFontWeight: number | string;
  nameColor: string;
  descFontSize: number;
  descColor: string;
  descLineHeight: number;
  descMaxWidth: number;

  personFill: string;
  personStroke: string;
  personTextColor: string;
  systemFill: string;
  systemStroke: string;
  systemTextColor: string;
  containerFill: string;
  containerStroke: string;
  containerTextColor: string;
  componentFill: string;
  componentStroke: string;
  componentTextColor: string;

  extFill: string;
  extStroke: string;
  extTextColor: string;

  boundaryStroke: string;
  boundaryStrokeWidth: number;
  boundaryDash: string;
  boundaryFill: string;
  boundaryRx: number;
  boundaryHeaderHeight: number;
  boundaryLabelFontSize: number;
  boundaryLabelColor: string;
  boundaryPadX: number;
  boundaryPadY: number;
  boundaryGapX: number;
  boundaryGapY: number;

  relStroke: string;
  relStrokeWidth: number;
  relArrowSize: number;
  relLabelFontSize: number;
  relLabelColor: string;
  relTechFontSize: number;
  relTechColor: string;

  elementRx: number;
  dbArcHeight: number;
  lineHeight: number;
}

export const defaultC4Theme: C4Theme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 48,
  marginRight: 48,
  marginTop: 48,
  marginBottom: 48,

  elementPadX: 18,
  elementPadY: 14,
  elementMinWidth: 160,
  elementGapX: 80,
  elementGapY: 60,

  stereotypeFontSize: 11,
  stereotypeColor: '#dbeafe',
  nameFontSize: 15,
  nameFontWeight: 700,
  nameColor: '#ffffff',
  descFontSize: 11,
  descColor: '#eff6ff',
  descLineHeight: 16,
  descMaxWidth: 140,

  personFill: '#1168bd',
  personStroke: '#0b4f92',
  personTextColor: '#ffffff',
  systemFill: '#0f5aa7',
  systemStroke: '#0b3d73',
  systemTextColor: '#ffffff',
  containerFill: '#438dd5',
  containerStroke: '#2563a9',
  containerTextColor: '#ffffff',
  componentFill: '#85bbf0',
  componentStroke: '#4d93d6',
  componentTextColor: '#082f49',

  extFill: '#9ca3af',
  extStroke: '#6b7280',
  extTextColor: '#ffffff',

  boundaryStroke: '#64748b',
  boundaryStrokeWidth: 1.5,
  boundaryDash: '8,5',
  boundaryFill: '#f8fafc',
  boundaryRx: 12,
  boundaryHeaderHeight: 36,
  boundaryLabelFontSize: 13,
  boundaryLabelColor: '#334155',
  boundaryPadX: 24,
  boundaryPadY: 20,
  boundaryGapX: 80,
  boundaryGapY: 60,

  relStroke: '#334155',
  relStrokeWidth: 1.5,
  relArrowSize: 12,
  relLabelFontSize: 12,
  relLabelColor: '#0f172a',
  relTechFontSize: 10,
  relTechColor: '#475569',

  elementRx: 8,
  dbArcHeight: 12,
  lineHeight: 20,
};

export const darkC4Theme: C4Theme = {
  ...defaultC4Theme,
  background: '#0f172a',
  stereotypeColor: '#dbeafe',
  nameColor: '#e2e8f0',
  descColor: '#cbd5e1',
  personFill: '#1d4ed8',
  personStroke: '#60a5fa',
  personTextColor: '#eff6ff',
  systemFill: '#1e40af',
  systemStroke: '#60a5fa',
  systemTextColor: '#eff6ff',
  containerFill: '#2563eb',
  containerStroke: '#93c5fd',
  containerTextColor: '#eff6ff',
  componentFill: '#1e3a8a',
  componentStroke: '#93c5fd',
  componentTextColor: '#e0f2fe',
  extFill: '#475569',
  extStroke: '#94a3b8',
  extTextColor: '#e2e8f0',
  boundaryStroke: '#60a5fa',
  boundaryFill: '#111827',
  boundaryLabelColor: '#cbd5e1',
  relStroke: '#93c5fd',
  relLabelColor: '#e2e8f0',
  relTechColor: '#cbd5e1',
};

export const C4_THEME_REGISTRY: Record<string, C4Theme> = {
  'default-c4': defaultC4Theme,
  'dark-c4': darkC4Theme,
};

export function resolveC4Theme(name?: string): C4Theme {
  if (!name) return defaultC4Theme;
  return C4_THEME_REGISTRY[name] ?? defaultC4Theme;
}
