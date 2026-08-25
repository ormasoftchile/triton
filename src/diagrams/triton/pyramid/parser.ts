import type { PyramidDocument, PyramidTier } from './ir.js';
import { extractFrontmatter } from '../../../frontend/frontmatter.js';

export function parsePyramid(input: string): PyramidDocument {
  const { metadata, body } = extractFrontmatter(input);
  const lines = body.split(/\r?\n/);

  let direction: 'pyramid' | 'funnel' = 'pyramid';
  let title = typeof metadata.title === 'string' ? metadata.title : '';
  const tiers: PyramidTier[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('#')) {
      continue;
    }

    if (/^funnel\b/i.test(trimmed)) {
      direction = 'funnel';
      continue;
    }
    if (/^pyramid\b/i.test(trimmed)) {
      direction = 'pyramid';
      continue;
    }

    // title
    const titleMatch = trimmed.match(/^title(?:\s+|:\s*)(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    if (titleMatch) {
      title = (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? '').trim();
      continue;
    }

    // tier line
    let lineContent = trimmed.replace(/^tier\s+/i, '').replace(/^-\s*/, '');
    const isFocal = /(:{1,3}focal\b|\bfocal\b)/i.test(lineContent);
    lineContent = lineContent.replace(/(:{1,3}focal\b|\bfocal\b)/gi, '').trim();

    // label and optional value: "Label" : Value or Label: Value
    const colonIdx = lineContent.lastIndexOf(':');
    let label = lineContent;
    let value: string | undefined;

    if (colonIdx > 0 && !lineContent.startsWith('http')) {
      label = lineContent.slice(0, colonIdx).trim();
      value = lineContent.slice(colonIdx + 1).trim();
    }

    label = label.replace(/^["']|["']$/g, '').trim();
    if (value) {
      value = value.replace(/^["']|["']$/g, '').trim();
    }

    if (label) {
      tiers.push({
        label,
        ...(value !== undefined ? { value } : {}),
        ...(isFocal ? { isFocal: true } : {}),
      });
    }
  }

  return {
    version: '1',
    metadata: { ...metadata, title },
    direction,
    tiers,
  };
}
