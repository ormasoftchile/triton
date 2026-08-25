import type { LoopDocument, LoopStep } from './ir.js';
import { extractFrontmatter } from '../../../frontend/frontmatter.js';

export function parseLoop(input: string): LoopDocument {
  const { metadata, body } = extractFrontmatter(input);
  const lines = body.split(/\r?\n/);

  let title = typeof metadata.title === 'string' ? metadata.title : '';
  let hub: string | undefined;
  const steps: LoopStep[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('#')) {
      continue;
    }

    if (/^(loop|flywheel)\b/i.test(trimmed)) {
      continue;
    }

    // title
    const titleMatch = trimmed.match(/^title(?:\s+|:\s*)(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    if (titleMatch) {
      title = (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? '').trim();
      continue;
    }

    // hub
    const hubMatch = trimmed.match(/^hub(?:\s+|:\s*)(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    if (hubMatch) {
      hub = (hubMatch[1] ?? hubMatch[2] ?? hubMatch[3] ?? '').trim();
      continue;
    }

    // step
    let stepLine = trimmed.replace(/^step\s+/i, '').replace(/^-\s*/, '');
    const isFocal = /(:{1,3}focal\b|\bfocal\b)/i.test(stepLine);
    stepLine = stepLine.replace(/(:{1,3}focal\b|\bfocal\b)/gi, '').trim();

    // extract label and optional desc
    let label = stepLine;
    let desc: string | undefined;

    const colonIdx = stepLine.indexOf(':');
    if (colonIdx > 0 && !stepLine.startsWith('http')) {
      label = stepLine.slice(0, colonIdx).trim();
      desc = stepLine.slice(colonIdx + 1).trim();
    }

    label = label.replace(/^["']|["']$/g, '').trim();
    if (desc) {
      desc = desc.replace(/^["']|["']$/g, '').trim();
    }

    if (label) {
      steps.push({
        label,
        ...(desc ? { desc } : {}),
        ...(isFocal ? { isFocal: true } : {}),
      });
    }
  }

  return {
    version: '1',
    metadata: { ...metadata, title },
    ...(hub ? { hub } : {}),
    steps,
  };
}
