/**
 * @file grammars/state/theme.ts — State Grammar theme tokens.
 */

export interface StateTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  statePadX: number;
  statePadY: number;
  minStateWidth: number;
  stateFill: string;
  stateStroke: string;
  stateStrokeWidth: number;
  stateRx: number;
  stateTextColor: string;
  stateFontSize: number;
  stateFontWeight: number | string;
  descFontSize: number;
  descTextColor: string;
  pseudoRadius: number;
  pseudoFill: string;
  pseudoStroke: string;
  pseudoStrokeWidth: number;
  forkBarWidth: number;
  forkBarHeight: number;
  forkBarFill: string;
  choiceSize: number;
  choiceFill: string;
  choiceStroke: string;
  edgeStroke: string;
  edgeStrokeWidth: number;
  edgeDash: string;
  arrowSize: number;
  stateGapX: number;
  stateGapY: number;
  lineHeight: number;
  edgeLabelFontSize: number;
  edgeLabelColor: string;
  compositeHeaderHeight: number;
  compositeFill: string;
  compositeStroke: string;
  compositeStrokeWidth: number;
  compositeRx: number;
  compositeTitleColor: string;
  compositeTitleFontSize: number;
  /** Inner horizontal padding for composite body (children area). Larger than statePadX for breathing room. */
  compositeBodyPadX: number;
  /** Inner vertical padding for composite body (top/bottom of children row). */
  compositeBodyPadY: number;
}

export const defaultStateTheme: StateTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 56,
  marginRight: 56,
  marginTop: 48,
  marginBottom: 48,
  statePadX: 16,
  statePadY: 12,
  minStateWidth: 180,
  stateFill: '#f8fafc',
  stateStroke: '#64748b',
  stateStrokeWidth: 1.4,
  stateRx: 12,
  stateTextColor: '#0f172a',
  stateFontSize: 15,
  stateFontWeight: 700,
  descFontSize: 12,
  descTextColor: '#475569',
  pseudoRadius: 10,
  pseudoFill: '#0f172a',
  pseudoStroke: '#0f172a',
  pseudoStrokeWidth: 1.5,
  forkBarWidth: 60,
  forkBarHeight: 10,
  forkBarFill: '#0f172a',
  choiceSize: 16,
  choiceFill: '#e2e8f0',
  choiceStroke: '#334155',
  edgeStroke: '#334155',
  edgeStrokeWidth: 1.5,
  edgeDash: '6,4',
  arrowSize: 12,
  stateGapX: 36,
  stateGapY: 34,
  lineHeight: 20,
  edgeLabelFontSize: 11,
  edgeLabelColor: '#334155',
  compositeHeaderHeight: 34,
  compositeFill: '#f8fafc',
  compositeStroke: '#3b82f6',
  compositeStrokeWidth: 1.5,
  compositeRx: 14,
  compositeTitleColor: '#1e3a8a',
  compositeTitleFontSize: 14,
  compositeBodyPadX: 22,
  compositeBodyPadY: 14,
};

export const darkStateTheme: StateTheme = {
  ...defaultStateTheme,
  background: '#0f172a',
  stateFill: '#1e293b',
  stateStroke: '#38bdf8',
  stateTextColor: '#e2e8f0',
  descTextColor: '#cbd5e1',
  pseudoFill: '#5eead4',
  pseudoStroke: '#5eead4',
  forkBarFill: '#5eead4',
  choiceFill: '#1e3a5f',
  choiceStroke: '#5eead4',
  edgeStroke: '#5eead4',
  edgeLabelColor: '#ccfbf1',
  compositeFill: '#1e293b',
  compositeStroke: '#2dd4bf',
  compositeTitleColor: '#ccfbf1',
};

export const STATE_THEME_REGISTRY: Record<string, StateTheme> = {
  'default-state': defaultStateTheme,
  'dark-state': darkStateTheme,
};

export function resolveStateTheme(name?: string): StateTheme {
  if (!name) return defaultStateTheme;
  return STATE_THEME_REGISTRY[name] ?? defaultStateTheme;
}
