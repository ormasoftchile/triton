import { describe, expect, it } from 'vitest';
import { compileSync, renderSync } from '../src/frontend/index.js';
import { defaultTheme, executiveTheme, productTheme } from '../src/theme/preset.js';
import { contrastRatio, readableText } from '../src/theme/contrast.js';
import { resolveThemeFontFromIndex } from '../src/export/fonts.js';
import { exportStaticPng } from '../src/export/index.js';
import { renderSVG } from '../src/render/svg.js';
import type { Scene, SceneElement } from '../src/contracts/index.js';

function textElements(elements: readonly SceneElement[]): SceneElement[] {
  return elements.flatMap(element => element.type === 'group'
    ? textElements(element.children)
    : element.type === 'text' ? [element] : []);
}

describe('default theme visual contract', () => {
  it('uses charcoal, teal, and coral on a neutral light canvas', () => {
    expect(defaultTheme.palette).toMatchObject({
      primary: '#087F78',
      secondary: '#B9503F',
      background: '#FFFFFF',
      surface: '#F3F6F5',
      border: '#899796',
      text: '#20282B',
      textMuted: '#576567',
    });
    expect(defaultTheme.edges.strokeWidth).toBe(2);
    expect(defaultTheme.nodes?.standard.cornerRadius).toBe(4);
  });

  it('keeps small text and connectors legible', () => {
    const palette = defaultTheme.palette;
    for (const canvas of [palette.background, palette.surface]) {
      expect(contrastRatio(palette.text, canvas)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(palette.textMuted, canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.border, canvas)).toBeGreaterThanOrEqual(2.5);
    }
    for (const fill of [palette.primary, palette.secondary, palette.success,
      palette.warning, palette.error]) {
      expect(contrastRatio(readableText(fill, defaultTheme), fill), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    'flowchart LR\n  source[Markdown] --> target[Presentation] @anim:particle\n',
    'list\nstyle chevron\n- Author\n- Present\n- Record\n',
    'list\nstyle tree\nreveal layer\n- Story\n  - Markdown\n- Evidence\n  - Tests\n',
    'poster "Delivery"\n  columns 2\n  cell live\n    list\n    - Explain\n    - Run\n  end\n  cell video\n    list\n    - Narrate\n    - Share\n  end\n',
  ])('uses Source Sans 3 throughout %s', source => {
    const result = compileSync(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const labels = textElements(result.value.scene.elements);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      if (label.type !== 'text') continue;
      expect(label.fontFamily).toContain('Source Sans 3');
      expect(label.fontFamily).toContain('sans-serif');
    }
  });

  it('does not restyle other named presets', () => {
    expect(productTheme.palette.primary).toBe('#3B82F6');
    expect(productTheme.typography.fontFamily).toContain('Inter');
    expect(executiveTheme.typography.fontFamily).toContain('Georgia');
    expect(productTheme.edges.strokeWidth).toBe(1.5);
  });

  it('embeds licensed regular and bold fonts only when the scene uses them', () => {
    const source = 'list\nstyle tree\n- Story\n  - Markdown\n- Evidence\n  - Tests\n';
    const rendered = renderSync(source);
    const otherTheme = renderSync(source, undefined, 'svg', 'product');
    expect(rendered.ok && otherTheme.ok).toBe(true);
    if (!rendered.ok || !otherTheme.ok) return;
    expect(rendered.value.match(/@font-face/g)).toHaveLength(2);
    expect(rendered.value).toContain('data:font/woff2;base64,');
    expect(rendered.value).toContain('font-weight:400');
    expect(rendered.value).toContain('font-weight:700');
    expect(rendered.value).toContain('SIL OPEN FONT LICENSE');
    expect(otherTheme.value).not.toContain('data:font/woff2');
  });

  it('renders native-export glyphs without any system fonts', async () => {
    const fonts = await resolveThemeFontFromIndex(defaultTheme.typography.fontFamily, []);
    expect(fonts?.family).toBe('Source Sans 3');
    if (!fonts) return;
    const scene: Scene = {
      viewBox: { x: 0, y: 0, width: 220, height: 70 },
      background: defaultTheme.palette.background,
      elements: [{
        type: 'text',
        position: { x: 12, y: 42 },
        content: 'Source Sans 3',
        fontFamily: defaultTheme.typography.fontFamily,
        fontSize: 24,
        fill: defaultTheme.palette.text,
      }],
    };
    const rendered = await exportStaticPng(renderSVG(scene), { fonts });
    const blank = await exportStaticPng(renderSVG({ ...scene, elements: [] }), { fonts });
    expect(Buffer.from(rendered).equals(Buffer.from(blank))).toBe(false);
  });
});