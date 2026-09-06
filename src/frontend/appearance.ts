import type { Result, ThemeInput, ResolvedTheme } from '../contracts/index.js';
import { ok } from '../contracts/index.js';
import { compileSync } from './index.js';
import { renderSVG } from '../render/svg.js';
import { resolveThemeFamily, type ColorMode, type ContrastMode } from '../theme/family.js';
import { resolveTheme } from '../theme/resolver.js';

export interface AppearanceRenderOptions {
  style?: string;
  mode?: ColorMode;
  contrast?: ContrastMode;
  snapshot?: { style: string; mode: ColorMode; contrast: ContrastMode; theme: ThemeInput };
  background?: 'opaque' | 'transparent';
}

export function renderWithAppearance(input: string, options: AppearanceRenderOptions = {}): Result<{
  svg: string;
  appearance: { style: string; mode: ColorMode; contrast: ContrastMode; theme: ResolvedTheme };
  warnings: readonly string[];
}> {
  const snapshot = options.snapshot;
  const family = resolveThemeFamily(options.style ?? snapshot?.style,
    options.mode ?? snapshot?.mode, options.contrast ?? snapshot?.contrast);
  const replaySnapshot = snapshot && !options.style && !options.mode && !options.contrast;
  const theme = replaySnapshot ? resolveTheme(snapshot.theme, family.theme) : family.theme;
  const compiled = compileSync(input, theme, family.style);
  if (!compiled.ok) return compiled;
  return ok({
    svg: renderSVG(compiled.value.scene, { background: options.background ?? 'opaque' }),
    appearance: { style: family.style, mode: family.mode, contrast: family.contrast, theme },
    warnings: family.warnings,
  });
}