import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFontFamilyStack, registerBundledFont, resolveThemeFont, resolveThemeFontFromIndex, type IndexedFontFace } from '../src/export/fonts.js';

const index: IndexedFontFace[] = [
  { family: 'Fallback Sans', subfamily: 'Regular', fullName: 'Fallback Sans Regular', path: 'fallback-regular.ttf' },
  { family: 'Theme Sans', subfamily: 'Regular', fullName: 'Theme Sans Regular', path: 'theme-regular.ttf' },
  { family: 'Theme Sans', subfamily: 'Bold', fullName: 'Theme Sans Bold', path: 'theme-bold.ttf' },
  { family: 'Theme Serif', subfamily: 'Regular', fullName: 'Theme Serif Regular', path: 'theme-serif.ttf' },
  { family: 'Theme Mono', subfamily: 'Regular', fullName: 'Theme Mono Regular', path: 'theme-mono.ttf' },
];

async function fakeRead(path: string): Promise<Uint8Array> {
  return new Uint8Array([...path].map((ch) => ch.charCodeAt(0) & 0xff));
}

describe('theme font resolver', () => {
  it('parses CSS font-family stacks with quoted names', () => {
    expect(parseFontFamilyStack('Inter, "Theme Sans", \'Theme Serif\', sans-serif')).toEqual([
      'Inter',
      'Theme Sans',
      'Theme Serif',
      'sans-serif',
    ]);
  });

  it('honors first installed family precedence and returns regular plus bold faces', async () => {
    const resolved = await resolveThemeFontFromIndex('Missing, "Theme Sans", Fallback Sans', index, fakeRead);
    expect(resolved?.family).toBe('Theme Sans');
    expect(resolved?.buffers).toHaveLength(2);
    expect(new TextDecoder().decode(resolved?.buffers[0])).toBe('theme-regular.ttf');
    expect(new TextDecoder().decode(resolved?.buffers[1])).toBe('theme-bold.ttf');
  });

  it('maps generic CSS families to matching installed faces', async () => {
    await expect(resolveThemeFontFromIndex('sans-serif', index, fakeRead)).resolves.toMatchObject({ family: 'Fallback Sans' });
    await expect(resolveThemeFontFromIndex('serif', index, fakeRead)).resolves.toMatchObject({ family: 'Theme Serif' });
    await expect(resolveThemeFontFromIndex('monospace', index, fakeRead)).resolves.toMatchObject({ family: 'Theme Mono' });
  });

  it('returns undefined when no stack entry resolves', async () => {
    await expect(resolveThemeFontFromIndex('Missing, Fantasy', [], fakeRead)).resolves.toBeUndefined();
  });

  it('registers bundled Inter ahead of system faces for the default theme stack', async () => {
    const fontDir = join(process.cwd(), 'assets', 'fonts', 'inter');
    const regular = new Uint8Array(await readFile(join(fontDir, 'Inter-Regular.ttf')));
    const bold = new Uint8Array(await readFile(join(fontDir, 'Inter-Bold.ttf')));
    registerBundledFont({
      family: 'Inter',
      faces: [
        { subfamily: 'Regular', fullName: 'Inter Regular', bytes: regular },
        { subfamily: 'Bold', fullName: 'Inter Bold', bytes: bold },
      ],
    });

    const resolved = await resolveThemeFont('Inter, system-ui, -apple-system, sans-serif');
    expect(resolved?.family).toBe('Inter');
    expect(resolved?.buffers).toHaveLength(2);
    expect(resolved?.buffers[0]).toEqual(regular);
    expect(resolved?.buffers[1]).toEqual(bold);

    const fakeSystemInter: IndexedFontFace[] = [
      { family: 'Inter', subfamily: 'Regular', fullName: 'Inter Regular', path: 'system-inter-regular.ttf' },
      { family: 'Inter', subfamily: 'Bold', fullName: 'Inter Bold', path: 'system-inter-bold.ttf' },
    ];
    const fromIndex = await resolveThemeFontFromIndex('Inter, sans-serif', fakeSystemInter, fakeRead);
    expect(fromIndex?.buffers[0]).toEqual(regular);
    expect(fromIndex?.buffers[1]).toEqual(bold);
  });
});
