import type { ResolvedTheme, ThemePalette } from '../contracts/theme.js';
import { defaultTheme, getThemePreset, themePresetNames } from './preset.js';
import { isDarkTheme } from './contrast.js';

export type ColorMode = 'light' | 'dark';
export type ContrastMode = 'normal' | 'high';

const lightPalette: ThemePalette = { ...defaultTheme.palette, border: '#7B8C88' };
const darkPalette: ThemePalette = {
  primary: '#55C6BA', secondary: '#EF9A86', background: '#171B1D',
  surface: '#22292C', border: '#788B87', text: '#EFF4F3', textMuted: '#B4C0BE',
  success: '#76D69D', warning: '#E7BD70', error: '#FF929C',
};
const highLightPalette: ThemePalette = {
  primary: '#005A53', secondary: '#8A3023', background: '#FFFFFF',
  surface: '#FFFFFF', border: '#20282B', text: '#000000', textMuted: '#303030',
  success: '#14532D', warning: '#694100', error: '#8E1531',
};
const highDarkPalette: ThemePalette = {
  primary: '#83F3E4', secondary: '#FFB9A7', background: '#000000',
  surface: '#000000', border: '#FFFFFF', text: '#FFFFFF', textMuted: '#DEDEDE',
  success: '#A3FFC0', warning: '#FFE298', error: '#FFB8C1',
};

function variant(mode: ColorMode, contrast: ContrastMode, palette: ThemePalette) {
  return {
    mode, contrast, palette,
    connector: palette.textMuted,
    onPrimary: mode === 'dark' ? '#14201F' : '#FFFFFF',
    onSecondary: mode === 'dark' ? '#14201F' : '#FFFFFF',
  };
}

export const defaultAppearanceManifest = {
  schemaVersion: 1,
  style: 'default',
  typography: defaultTheme.typography,
  spacing: defaultTheme.spacing,
  edges: defaultTheme.edges,
  nodes: defaultTheme.nodes,
  font: { family: 'Source Sans 3', revision: 'fontsource-5.3.0-latin-400-700' },
  variants: {
    'light-normal': variant('light', 'normal', lightPalette),
    'dark-normal': variant('dark', 'normal', darkPalette),
    'light-high': variant('light', 'high', highLightPalette),
    'dark-high': variant('dark', 'high', highDarkPalette),
  },
} as const;

export interface ResolvedThemeFamily {
  readonly style: string;
  readonly mode: ColorMode;
  readonly contrast: ContrastMode;
  readonly theme: ResolvedTheme;
  readonly warnings: readonly string[];
}

export function resolveThemeFamily(
  style = 'default', mode: ColorMode = 'light', contrast: ContrastMode = 'normal',
): ResolvedThemeFamily {
  const warnings: string[] = [];
  if (!(themePresetNames as readonly string[]).includes(style)) {
    warnings.push(`Unknown style "${style}"; using default.`);
    style = 'default';
  }
  if (style === 'default') {
    const selected = defaultAppearanceManifest.variants[`${mode}-${contrast}`];
    return { style, mode, contrast, theme: { ...defaultTheme, palette: selected.palette }, warnings };
  }
  const theme = getThemePreset(style);
  const intrinsicMode = isDarkTheme(theme) ? 'dark' : 'light';
  if (mode !== intrinsicMode || contrast !== 'normal') {
    warnings.push(`Style "${style}" only supports ${intrinsicMode}/normal; retaining its native palette.`);
  }
  return { style, mode: intrinsicMode, contrast: 'normal', theme, warnings };
}