export interface JourneyTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;

  spineY: number;
  spineStroke: string;
  spineStrokeWidth: number;

  sectionLabelFontSize: number;
  sectionLabelFontWeight: number | string;
  sectionLabelColor: string;
  sectionBandFill: string;
  sectionBandFill2: string;

  taskRadius: number;
  taskStrokeWidth: number;
  taskLabelFontSize: number;
  taskLabelFontWeight: number | string;
  taskLabelColor: string;

  scoreFills: string[];
  scoreStrokes: string[];

  actorFontSize: number;
  actorColor: string;
  actorChipFill: string;
  actorChipRadius: number;

  taskGapX: number;
  sectionGapX: number;
  taskLabelOffsetY: number;
  actorOffsetY: number;
  scoreBarHeight: number;
}

export const defaultJourneyTheme: JourneyTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 48,
  marginRight: 48,
  marginTop: 48,
  marginBottom: 48,

  spineY: 92,
  spineStroke: '#64748b',
  spineStrokeWidth: 3,

  sectionLabelFontSize: 14,
  sectionLabelFontWeight: 700,
  sectionLabelColor: '#0f172a',
  sectionBandFill: '#f8fafc',
  sectionBandFill2: '#eef2ff',

  taskRadius: 20,
  taskStrokeWidth: 2,
  taskLabelFontSize: 12,
  taskLabelFontWeight: 600,
  taskLabelColor: '#0f172a',

  scoreFills: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
  scoreStrokes: ['#b91c1c', '#c2410c', '#a16207', '#4d7c0f', '#15803d'],

  actorFontSize: 11,
  actorColor: '#1f2937',
  actorChipFill: '#e2e8f0',
  actorChipRadius: 10,

  taskGapX: 120,
  sectionGapX: 24,
  taskLabelOffsetY: 42,
  actorOffsetY: 26,
  scoreBarHeight: 6,
};

export const darkJourneyTheme: JourneyTheme = {
  ...defaultJourneyTheme,
  background: '#020617',
  spineStroke: '#64748b',
  sectionLabelColor: '#e2e8f0',
  sectionBandFill: '#0f172a',
  sectionBandFill2: '#111827',
  taskLabelColor: '#e2e8f0',
  actorColor: '#cbd5e1',
  actorChipFill: '#1e293b',
};

export const JOURNEY_THEME_REGISTRY: Record<string, JourneyTheme> = {
  'default-journey': defaultJourneyTheme,
  'dark-journey': darkJourneyTheme,
};

export function resolveJourneyTheme(name?: string): JourneyTheme {
  if (!name) return defaultJourneyTheme;
  return JOURNEY_THEME_REGISTRY[name] ?? defaultJourneyTheme;
}
