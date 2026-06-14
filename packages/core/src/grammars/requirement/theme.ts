/**
 * @file grammars/requirement/theme.ts — RequirementTheme token surface.
 *
 * Matches real Mermaid requirementDiagram visual style: white compartment boxes
 * with a light blue-grey title band, stereotype in italics, attribute list below,
 * directed edges with a centered «kind» pill label.
 */

export interface RequirementTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  nodePadX: number;
  nodePadY: number;
  minNodeWidth: number;
  /** Title band fill color. */
  titleFill: string;
  titleStroke: string;
  titleStrokeWidth: number;
  titleRx: number;
  titleTextColor: string;
  titleFontSize: number;
  titleFontWeight: number | string;
  /** Stereotype line (italic smaller text above title). */
  stereotypeFontSize: number;
  stereotypeColor: string;
  /** Body compartment (attributes). */
  bodyFill: string;
  bodyStroke: string;
  bodyStrokeWidth: number;
  attrFontSize: number;
  attrFontWeight: number | string;
  attrTextColor: string;
  attrLabelColor: string;
  compartmentDividerStroke: string;
  compartmentDividerWidth: number;
  lineHeight: number;
  /** Edge styling. */
  edgeStroke: string;
  edgeStrokeWidth: number;
  arrowSize: number;
  /** Pill label on edge. */
  pillFill: string;
  pillStroke: string;
  pillStrokeWidth: number;
  pillRx: number;
  pillTextColor: string;
  pillFontSize: number;
  pillPadX: number;
  pillPadY: number;
  /** Layout: gap between nodes. */
  nodeGapX: number;
  nodeGapY: number;
}

export const defaultRequirementTheme: RequirementTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 48,
  marginRight: 48,
  marginTop: 48,
  marginBottom: 48,
  nodePadX: 14,
  nodePadY: 10,
  minNodeWidth: 190,
  titleFill: '#dbeafe',
  titleStroke: '#3b82f6',
  titleStrokeWidth: 1.5,
  titleRx: 6,
  titleTextColor: '#1e3a8a',
  titleFontSize: 15,
  titleFontWeight: 700,
  stereotypeFontSize: 11,
  stereotypeColor: '#475569',
  bodyFill: '#f8fafc',
  bodyStroke: '#94a3b8',
  bodyStrokeWidth: 1.2,
  attrFontSize: 12,
  attrFontWeight: 400,
  attrTextColor: '#0f172a',
  attrLabelColor: '#475569',
  compartmentDividerStroke: '#94a3b8',
  compartmentDividerWidth: 1,
  lineHeight: 19,
  edgeStroke: '#334155',
  edgeStrokeWidth: 1.5,
  arrowSize: 10,
  pillFill: '#ffffff',
  pillStroke: '#64748b',
  pillStrokeWidth: 1,
  pillRx: 8,
  pillTextColor: '#334155',
  pillFontSize: 11,
  pillPadX: 8,
  pillPadY: 3,
  nodeGapX: 80,
  nodeGapY: 56,
};

export const darkRequirementTheme: RequirementTheme = {
  ...defaultRequirementTheme,
  background: '#0f172a',
  titleFill: '#1e3a5f',
  titleStroke: '#2dd4bf',
  titleTextColor: '#e2e8f0',
  stereotypeColor: '#93c5fd',
  bodyFill: '#1e293b',
  bodyStroke: '#14b8a6',
  compartmentDividerStroke: '#2dd4bf',
  attrTextColor: '#e2e8f0',
  attrLabelColor: '#94a3b8',
  edgeStroke: '#5eead4',
  pillFill: '#0f172a',
  pillStroke: '#5eead4',
  pillTextColor: '#ccfbf1',
};

export const REQUIREMENT_THEME_REGISTRY: Record<string, RequirementTheme> = {
  'default-requirement': defaultRequirementTheme,
  'dark-requirement': darkRequirementTheme,
};

export function resolveRequirementTheme(name?: string): RequirementTheme {
  if (!name) return defaultRequirementTheme;
  return REQUIREMENT_THEME_REGISTRY[name] ?? defaultRequirementTheme;
}
