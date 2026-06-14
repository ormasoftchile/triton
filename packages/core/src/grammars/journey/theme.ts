export interface JourneyTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;

  /** Minimum vertical distance from contentTop to the journey spine. */
  spineY: number;
  spineStroke: string;
  spineStrokeWidth: number;

  sectionLabelFontSize: number;
  sectionLabelFontWeight: number | string;
  sectionLabelColor: string;
  sectionBandFill: string;
  sectionBandFill2: string;

  /** Radius of the satisfaction marker circle (also the face glyph radius). */
  taskRadius: number;
  taskStrokeWidth: number;
  taskLabelFontSize: number;
  taskLabelFontWeight: number | string;
  taskLabelColor: string;

  scoreFills: string[];
  scoreStrokes: string[];

  actorFontSize: number;
  actorColor: string;
  /** Kept for interface compat; no longer used in the curve layout. */
  actorChipFill: string;
  /** Kept for interface compat; no longer used in the curve layout. */
  actorChipRadius: number;

  taskGapX: number;
  sectionGapX: number;
  /** Kept for interface compat; unused in the curve layout. */
  taskLabelOffsetY: number;
  /** Kept for interface compat; unused in the curve layout. */
  actorOffsetY: number;
  /** Kept for interface compat; unused in the curve layout. */
  scoreBarHeight: number;

  // ── Emotional curve (score → vertical position) ──────────────────────────
  /** Drop from spine to face circle at score 5 (best). */
  minDrop: number;
  /** Drop from spine to face circle at score 1 (worst). */
  maxDrop: number;
  /** Stroke color of dashed droplines connecting spine to face marker. */
  droplineStroke: string;
  /** CSS stroke-dasharray for droplines (e.g. '4,4'). */
  droplineDash: string;
  /** Stroke color of the emotional-journey curve through face markers. */
  curveStroke: string;
  curveStrokeWidth: number;

  // ── Task box (above spine, holds label + actor dots) ─────────────────────
  taskBoxFill: string;
  taskBoxStroke: string;
  taskBoxStrokeWidth: number;
  taskBoxRadius: number;

  // ── Per-actor distinct colors ─────────────────────────────────────────────
  /** Color palette cycled across actors in appearance order. */
  actorPalette: string[];
  /** Radius of per-actor indicator dots inside task boxes and in the legend. */
  actorDotRadius: number;
}

export const defaultJourneyTheme: JourneyTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 48,
  marginRight: 48,
  marginTop: 48,
  marginBottom: 48,

  spineY: 152,
  spineStroke: '#64748b',
  spineStrokeWidth: 2,

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

  minDrop: 16,
  maxDrop: 140,
  droplineStroke: '#94a3b8',
  droplineDash: '4,4',
  curveStroke: '#94a3b8',
  curveStrokeWidth: 1.5,

  taskBoxFill: '#ffffff',
  taskBoxStroke: '#cbd5e1',
  taskBoxStrokeWidth: 1,
  taskBoxRadius: 6,

  actorPalette: ['#4ade80', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#34d399', '#fb923c', '#22d3ee'],
  actorDotRadius: 5,
};

export const darkJourneyTheme: JourneyTheme = {
  ...defaultJourneyTheme,
  background: '#020617',
  spineStroke: '#475569',
  sectionLabelColor: '#e2e8f0',
  sectionBandFill: '#0f172a',
  sectionBandFill2: '#111827',
  taskLabelColor: '#e2e8f0',
  actorColor: '#cbd5e1',
  actorChipFill: '#1e293b',
  taskBoxFill: '#1e293b',
  taskBoxStroke: '#334155',
  droplineStroke: '#475569',
  curveStroke: '#475569',
};

export const JOURNEY_THEME_REGISTRY: Record<string, JourneyTheme> = {
  'default-journey': defaultJourneyTheme,
  'dark-journey': darkJourneyTheme,
};

export function resolveJourneyTheme(name?: string): JourneyTheme {
  if (!name) return defaultJourneyTheme;
  return JOURNEY_THEME_REGISTRY[name] ?? defaultJourneyTheme;
}
