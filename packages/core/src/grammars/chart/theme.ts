/**
 * @file grammars/chart/theme.ts — Chart Grammar theme tokens.
 */

export interface ChartTheme {
  background: string;
  fontFamily: string;
  titleFontSize: number;
  titleFontWeight: number | string;
  titleColor: string;
  canvasWidth: number;
  canvasHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  axisColor: string;
  axisStrokeWidth: number;
  tickLength: number;
  tickLabelFontSize: number;
  tickLabelColor: string;
  axisTitleFontSize: number;
  axisTitleColor: string;
  gridlineColor: string;
  gridlineDash: string;
  barStroke: string;
  barStrokeWidth: number;
  lineStrokeWidth: number;
  pointRadius: number;
  piePalette: string[];
  pieLabelFontSize: number;
  pieLabelColor: string;
  pieLeaderLineColor: string;
  legendFontSize: number;
  legendSwatchSize: number;
  legendGap: number;
}

const PIE_PALETTE = ['#4C72B0', '#DD8452', '#55A868', '#C44E52', '#8172B3', '#937860', '#DA8BC3', '#8C8C8C'];

export const defaultChartTheme: ChartTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  titleFontSize: 22,
  titleFontWeight: 700,
  titleColor: '#1a1a2e',
  canvasWidth: 920,
  canvasHeight: 560,
  marginTop: 28,
  marginBottom: 28,
  marginLeft: 32,
  marginRight: 32,
  axisColor: '#334155',
  axisStrokeWidth: 1.5,
  tickLength: 6,
  tickLabelFontSize: 12,
  tickLabelColor: '#475569',
  axisTitleFontSize: 13,
  axisTitleColor: '#1f2937',
  gridlineColor: '#e2e8f0',
  gridlineDash: '4,4',
  barStroke: '#ffffff',
  barStrokeWidth: 1,
  lineStrokeWidth: 3,
  pointRadius: 4,
  piePalette: PIE_PALETTE,
  pieLabelFontSize: 12,
  pieLabelColor: '#1f2937',
  pieLeaderLineColor: '#64748b',
  legendFontSize: 12,
  legendSwatchSize: 12,
  legendGap: 10,
};

export const darkChartTheme: ChartTheme = {
  ...defaultChartTheme,
  background: '#1a1a2e',
  titleColor: '#f8fafc',
  axisColor: '#cbd5e1',
  tickLabelColor: '#cbd5e1',
  axisTitleColor: '#e2e8f0',
  gridlineColor: '#334155',
  barStroke: '#1a1a2e',
  pieLabelColor: '#f8fafc',
  pieLeaderLineColor: '#cbd5e1',
};

export const CHART_THEME_REGISTRY: Record<string, ChartTheme> = {
  'default-chart': defaultChartTheme,
  'dark-chart': darkChartTheme,
};

export function resolveChartTheme(name?: string): ChartTheme {
  if (!name) return defaultChartTheme;
  return CHART_THEME_REGISTRY[name] ?? defaultChartTheme;
}
