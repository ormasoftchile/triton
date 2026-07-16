import { describe, expect, it } from 'vitest';
import { parseFontFamilyStack, resolveThemeFontFromIndex, type IndexedFontFace } from '../src/export/fonts.js';

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
});
