import { describe, expect, it } from 'vitest';
import { resolveThemeFamily, defaultAppearanceManifest } from '../src/theme/family.js';
import { getThemePreset } from '../src/theme/preset.js';
import { compileSync } from '../src/frontend/index.js';
import { renderSVG } from '../src/render/svg.js';
import { contrastRatio } from '../src/theme/contrast.js';
import { renderWithAppearance } from '../src/frontend/appearance.js';

describe('adaptive theme families', () => {
  it('replays standalone exports from an explicit appearance snapshot', () => {
    const source = 'list\nstyle chevron\n- Author\n- Present\n';
    const first = renderWithAppearance(source, { mode: 'dark' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const replay = renderWithAppearance(source, { snapshot: first.value.appearance });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.svg).toBe(first.value.svg);
    expect(first.value.svg).toContain('fill="#171B1D"');
    expect(first.value.svg).not.toContain('fill="#EF9A86"');
    const fallback = renderWithAppearance(source);
    expect(fallback.ok && fallback.value.appearance.mode).toBe('light');
  });
  it('resolves paired palettes without changing typography or geometry tokens', () => {
    const light = resolveThemeFamily('default', 'light');
    const dark = resolveThemeFamily('default', 'dark');
    expect(light.theme.palette.background).toBe('#FFFFFF');
    expect(dark.theme.palette.background).toBe('#171B1D');
    expect(dark.theme.palette.primary).toBe('#55C6BA');
    expect(dark.theme.typography).toEqual(light.theme.typography);
    expect(dark.theme.spacing).toEqual(light.theme.spacing);
    expect(dark.theme.nodes).toEqual(light.theme.nodes);
    expect(dark.theme.edges).toEqual(light.theme.edges);
    expect(getThemePreset('default').palette.background).toBe('#FFFFFF');
    expect(defaultAppearanceManifest.schemaVersion).toBe(1);
  });

  it.each(['light', 'dark'] as const)('supports high contrast in %s mode', mode => {
    const result = resolveThemeFamily('default', mode, 'high');
    expect(result.mode).toBe(mode);
    expect(result.contrast).toBe('high');
    expect(contrastRatio(result.theme.palette.text, result.theme.palette.background)).toBeGreaterThanOrEqual(7);
    expect(result.theme.typography).toEqual(getThemePreset('default').typography);
  });

  it('retains a legacy preset intrinsic mode with a diagnostic for a mismatch', () => {
    const result = resolveThemeFamily('executive', 'light');
    expect(result.mode).toBe('dark');
    expect(result.theme.palette).toEqual(getThemePreset('executive').palette);
    expect(result.warnings).toHaveLength(1);
  });

  it('falls back deterministically for an unknown family', () => {
    const result = resolveThemeFamily('missing-style', 'dark');
    expect(result.style).toBe('default');
    expect(result.mode).toBe('dark');
    expect(result.warnings).toHaveLength(1);
  });

  it('controls canvas and font painting without clearing the scene background', () => {
    const result = compileSync('flowchart LR\nA[Author] --> B[Present]\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const scene = result.value.scene;
    const opaque = renderSVG(scene);
    const transparent = renderSVG(scene, { background: 'transparent', fonts: 'external' });
    expect(opaque).toContain('fill="#FFFFFF"');
    expect(opaque).toContain('@font-face');
    expect(transparent).not.toContain('fill="#FFFFFF"');
    expect(transparent).not.toContain('@font-face');
    expect(transparent).toContain('Author');
    expect(scene.background).toBe('#FFFFFF');
  });
});