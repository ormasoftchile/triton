import type { JourneyDocument, JourneySection, JourneyTask } from '../../grammars/journey/types.js';
import { preprocessMermaid } from './utils.js';

export interface JourneyParseResult {
  doc: JourneyDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

function clampJourneyScore(raw: string | undefined, warnings: string[], line: string): number {
  if (!raw) {
    warnings.push(`Missing journey score in line "${line}". Defaulting to 3.`);
    return 3;
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    warnings.push(`Invalid journey score "${raw}" in line "${line}". Defaulting to 3.`);
    return 3;
  }

  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 5) {
    warnings.push(`Journey score ${raw} is out of range in line "${line}". Clamping to 1–5.`);
  }
  return Math.max(1, Math.min(5, rounded));
}

function parseJourneyTask(trimmed: string, warnings: string[]): JourneyTask {
  const firstColon = trimmed.indexOf(':');
  if (firstColon === -1) {
    warnings.push(`Journey task line "${trimmed}" has no score delimiter. Defaulting to score 3 with no actors.`);
    return { name: trimmed, score: 3, actors: [] };
  }

  const name = trimmed.slice(0, firstColon).trim() || 'Task';
  const remainder = trimmed.slice(firstColon + 1).trim();
  const secondColon = remainder.indexOf(':');
  const scoreRaw = secondColon === -1 ? remainder : remainder.slice(0, secondColon).trim();
  const actorsRaw = secondColon === -1 ? '' : remainder.slice(secondColon + 1).trim();
  const score = clampJourneyScore(scoreRaw || undefined, warnings, trimmed);
  const actors = actorsRaw
    ? actorsRaw.split(',').map((actor) => actor.trim()).filter((actor) => actor.length > 0)
    : [];
  return { name, score, actors };
}

export function parseJourneyDiagram(text: string): JourneyDocument {
  return parseJourneyDiagramInternal(text).doc;
}

export function parseJourneyDiagramInternal(text: string): JourneyParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^journey\s*$/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    warnings.push(`Expected "journey" header on first content line; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  const sections: JourneySection[] = [];
  const preambleTasks: JourneyTask[] = [];
  let currentSection: JourneySection | undefined;
  let inlineTitle: string | undefined;

  for (let i = Math.max(0, headerIdx + 1); i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    if (/^title\b/i.test(trimmed)) {
      const title = trimmed.replace(/^title\s+/i, '').trim();
      if (title) inlineTitle = title;
      continue;
    }

    if (/^section\b/i.test(trimmed)) {
      const name = trimmed.replace(/^section\s+/i, '').trim();
      currentSection = { name, tasks: [] };
      sections.push(currentSection);
      continue;
    }

    const task = parseJourneyTask(trimmed, warnings);
    if (currentSection) currentSection.tasks.push(task);
    else preambleTasks.push(task);
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTitle = inlineTitle ?? fmTitle ?? directiveTitle;
  const resolvedTheme = fmTheme ?? directiveTheme;

  return {
    doc: {
      version: '1.0',
      metadata: {
        ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
        ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      },
      sections,
      preambleTasks,
    },
    warnings,
    frontmatter,
  };
}
