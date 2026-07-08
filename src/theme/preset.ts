import type { ResolvedTheme } from '../contracts/index.js';

// ─── Shared base tokens (typography / spacing / edges) ──────────────────────────
// Palettes vary per theme; structure stays constant so every diagram responds
// identically to a theme switch.

const SANS = 'Inter, system-ui, -apple-system, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'JetBrains Mono, Fira Code, monospace';

const baseTypography = {
  fontFamily:    SANS,
  monoFamily:    MONO,
  baseFontSize:  14,
  titleFontSize: 18,
  smallFontSize: 11,
  lineHeight:    1.4,
} as const;

const baseSpacing = {
  unit:          8,
  nodePadding:   12,
  nodeGap:       40,
  diagramMargin: 24,
} as const;

const baseEdges = {
  strokeWidth:   1.5,
  arrowSize:     8,
  labelFontSize: 12,
  curveTension:  0.4,
} as const;

// Default panel/cell-title chrome: plain text, top-left, inside the frame.
const basePanel = {
  titleAlign:    'left',
  titlePosition: 'inside',
  titleChrome:   'none',
} as const;

// ─── Themes ─────────────────────────────────────────────────────────────────────

export const defaultTheme: ResolvedTheme = {
  name: 'default',
  palette: {
    primary:    '#4A90D9',
    secondary:  '#7C3AED',
    background: '#FFFFFF',
    surface:    '#F8FAFC',
    border:     '#CBD5E1',
    text:       '#1E293B',
    textMuted:  '#64748B',
    success:    '#22C55E',
    warning:    '#F59E0B',
    error:      '#EF4444',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      basePanel,
} as const;

/** Boardroom / presentation aesthetic — deep navy canvas, light text. */
export const executiveTheme: ResolvedTheme = {
  name: 'executive',
  palette: {
    primary:    '#3A86C8',
    secondary:  '#7986CB',
    background: '#0D1B2A',
    surface:    '#16263B',
    border:     '#2A4060',
    text:       '#E8EEF5',
    textMuted:  '#8BAAC8',
    success:    '#2DD4BF',
    warning:    '#F4A742',
    error:      '#E05252',
  },
  typography: { ...baseTypography, fontFamily: SERIF },
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'center', titlePosition: 'on-border', titleChrome: 'box' },
} as const;

/** Greyscale, ink-on-paper minimalism. */
export const minimalTheme: ResolvedTheme = {
  name: 'minimal',
  palette: {
    primary:    '#525252',
    secondary:  '#A3A3A3',
    background: '#FFFFFF',
    surface:    '#F5F5F5',
    border:     '#E5E5E5',
    text:       '#171717',
    textMuted:  '#737373',
    success:    '#737373',
    warning:    '#A3A3A3',
    error:      '#404040',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      basePanel,
} as const;

/** Navy + amber on white — classic consulting deck. */
export const consultingTheme: ResolvedTheme = {
  name: 'consulting',
  palette: {
    primary:    '#1F497D',
    secondary:  '#D97706',
    background: '#FFFFFF',
    surface:    '#F4F6FA',
    border:     '#D6DEE8',
    text:       '#111111',
    textMuted:  '#555555',
    success:    '#1F8A5B',
    warning:    '#D97706',
    error:      '#DC2626',
  },
  typography: { ...baseTypography, fontFamily: SERIF },
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'left', titlePosition: 'on-border', titleChrome: 'none' },
} as const;

/** Modern SaaS product — violet + blue on white. */
export const productTheme: ResolvedTheme = {
  name: 'product',
  palette: {
    primary:    '#3B82F6',
    secondary:  '#8B5CF6',
    background: '#FFFFFF',
    surface:    '#F9FAFB',
    border:     '#E5E7EB',
    text:       '#111827',
    textMuted:  '#6B7280',
    success:    '#10B981',
    warning:    '#F59E0B',
    error:      '#EF4444',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'center', titlePosition: 'inside', titleChrome: 'pill' },
} as const;

/** Release-management palette — vivid status hues. */
export const releaseTheme: ResolvedTheme = {
  name: 'release',
  palette: {
    primary:    '#2563EB',
    secondary:  '#16A34A',
    background: '#FFFFFF',
    surface:    '#F8FAFC',
    border:     '#E2E8F0',
    text:       '#111111',
    textMuted:  '#6B7280',
    success:    '#16A34A',
    warning:    '#D97706',
    error:      '#DC2626',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'left', titlePosition: 'inside', titleChrome: 'box' },
} as const;

/** Indigo accent on near-white — the AI-timeline editorial look. */
export const aiTimelineTheme: ResolvedTheme = {
  name: 'ai-timeline',
  palette: {
    primary:    '#5B4FCF',
    secondary:  '#0EA5A8',
    background: '#F8F9FF',
    surface:    '#FFFFFF',
    border:     '#C0C4DF',
    text:       '#1A1A2E',
    textMuted:  '#4A4A6A',
    success:    '#2D9E67',
    warning:    '#D97706',
    error:      '#E05B5B',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'left', titlePosition: 'above', titleChrome: 'none' },
} as const;

/** ByteByteGo-style dark infographic — navy canvas, vivid teal accent. */
export const byteByteGoTheme: ResolvedTheme = {
  name: 'bytebytego',
  palette: {
    primary:    '#2DD4BF',
    secondary:  '#4D9AFF',
    background: '#111827',
    surface:    '#1F2937',
    border:     '#374151',
    text:       '#F9FAFB',
    textMuted:  '#9CA3AF',
    success:    '#2DD4BF',
    warning:    '#FFB800',
    error:      '#FF4D6D',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'center', titlePosition: 'on-border', titleChrome: 'pill' },
} as const;

/** Gitline dark-card look — deep navy canvas, periwinkle-blue accent. */
export const gitlineTheme: ResolvedTheme = {
  name: 'gitline',
  palette: {
    primary:    '#4D9AFF',
    secondary:  '#2C6EA8',
    background: '#0A1628',
    surface:    '#132035',
    border:     '#1C3558',
    text:       '#E8EDF5',
    textMuted:  '#6B8FAF',
    success:    '#3FB950',
    warning:    '#D29922',
    error:      '#F85149',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'left', titlePosition: 'on-border', titleChrome: 'box' },
} as const;

/** "Our Timeline" infographic — white canvas, navy + amber. */
export const ourTimelineTheme: ResolvedTheme = {
  name: 'our-timeline',
  palette: {
    primary:    '#1F497D',
    secondary:  '#D97706',
    background: '#FFFFFF',
    surface:    '#F4F6FA',
    border:     '#CCCCCC',
    text:       '#111111',
    textMuted:  '#555555',
    success:    '#1F8A5B',
    warning:    '#D97706',
    error:      '#DC2626',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'center', titlePosition: 'above', titleChrome: 'none' },
} as const;

/** Subject Timeline dark theme — deep navy, vivid cyan + pink accents. */
export const subjectTimelineTheme: ResolvedTheme = {
  name: 'subject-timeline',
  palette: {
    primary:    '#22D3EE',
    secondary:  '#EC4899',
    background: '#1A1A2E',
    surface:    '#2A2A48',
    border:     '#3A3A5C',
    text:       '#E8EEF4',
    textMuted:  '#8A9BB0',
    success:    '#34D399',
    warning:    '#F59E0B',
    error:      '#EC4899',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'center', titlePosition: 'on-border', titleChrome: 'pill' },
} as const;

/** Showcase Tier-3 aesthetic — deep navy canvas, electric-cyan accent. */
export const showcaseTheme: ResolvedTheme = {
  name: 'showcase',
  palette: {
    primary:    '#00D4FF',
    secondary:  '#9B8FDF',
    background: '#0D1B2A',
    surface:    '#132035',
    border:     '#1E3A5A',
    text:       '#E8EEF5',
    textMuted:  '#7AACCC',
    success:    '#00CC88',
    warning:    '#FFB800',
    error:      '#FF4D6D',
  },
  typography: baseTypography,
  spacing:    baseSpacing,
  edges:      baseEdges,
  panel:      { titleAlign: 'center', titlePosition: 'on-border', titleChrome: 'box' },
} as const;

// ─── Registry ─────────────────────────────────────────────────────────────────

/** Named theme presets. Selected via a diagram's `theme:` / metadata.theme. */
export const THEMES: Readonly<Record<string, ResolvedTheme>> = {
  default:           defaultTheme,
  executive:         executiveTheme,
  minimal:           minimalTheme,
  consulting:        consultingTheme,
  product:           productTheme,
  release:           releaseTheme,
  'ai-timeline':     aiTimelineTheme,
  bytebytego:        byteByteGoTheme,
  gitline:           gitlineTheme,
  'our-timeline':    ourTimelineTheme,
  'subject-timeline': subjectTimelineTheme,
  showcase:          showcaseTheme,
};

/** Ordered names of every built-in theme preset. */
export const themePresetNames = Object.freeze(Object.keys(THEMES)) as readonly string[];

/** Resolve a theme preset by name, falling back to the default theme. */
export function getThemePreset(name?: string): ResolvedTheme {
  return (name !== undefined && THEMES[name]) || defaultTheme;
}
