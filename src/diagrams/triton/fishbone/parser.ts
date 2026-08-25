import type { FishboneDocument, FishboneCategory, FishboneCause } from './ir.js';
import { extractFrontmatter } from '../../../frontend/frontmatter.js';

export function parseFishbone(input: string): FishboneDocument {
  const { metadata, body } = extractFrontmatter(input);
  const lines = body.split(/\r?\n/);

  let effect = 'Effect';
  let title = typeof metadata.title === 'string' ? metadata.title : '';
  const categories: FishboneCategory[] = [];
  let currentCategory: { name: string; causes: FishboneCause[] } | null = null;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('#')) {
      continue;
    }

    if (/^fishbone\b/i.test(trimmed)) {
      continue;
    }

    // title
    const titleMatch = trimmed.match(/^title(?:\s+|:\s*)(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    if (titleMatch) {
      title = (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? '').trim();
      continue;
    }

    // effect
    const effectMatch = trimmed.match(/^effect(?:\s+|:\s*)(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    if (effectMatch) {
      effect = (effectMatch[1] ?? effectMatch[2] ?? effectMatch[3] ?? '').trim();
      continue;
    }

    // category
    const catMatch = trimmed.match(/^category(?:\s+|:\s*)(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    if (catMatch) {
      const name = (catMatch[1] ?? catMatch[2] ?? catMatch[3] ?? '').trim();
      currentCategory = { name, causes: [] };
      categories.push(currentCategory);
      continue;
    }

    // cause under current category
    if (currentCategory) {
      const causeText = trimmed
        .replace(/^-\s*/, '')
        .replace(/^"([^"]+)"$/, '$1')
        .replace(/^'([^']+)'$/, '$1')
        .trim();
      if (causeText) {
        currentCategory.causes.push({ label: causeText });
      }
    }
  }

  return {
    version: '1',
    metadata: { ...metadata, title },
    effect,
    categories,
  };
}
