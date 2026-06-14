import type {
  GitBranch,
  GitCommit,
  GitCommitType,
  GitGraphDocument,
  GitGraphOrientation,
} from '../../grammars/gitgraph/types.js';
import { preprocessMermaid } from './utils.js';

export interface GitGraphParseResult {
  doc: GitGraphDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

const COMMIT_TYPES = new Set<GitCommitType>(['NORMAL', 'REVERSE', 'HIGHLIGHT']);

function parseModifiers(text: string): Record<string, string> {
  const modifiers: Record<string, string> = {};
  const regex = /(\w+):\s*"([^"]*)"|(\w+):\s*([^\s]+)/g;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const key = (match[1] ?? match[3] ?? '').trim();
    const value = (match[2] ?? match[4] ?? '').trim();
    if (key) modifiers[key] = value;
    match = regex.exec(text);
  }
  return modifiers;
}

function normalizeCommitType(raw: string | undefined, warnings: string[], line: string): GitCommitType {
  if (!raw) return 'NORMAL';
  const upper = raw.toUpperCase() as GitCommitType;
  if (COMMIT_TYPES.has(upper)) return upper;
  warnings.push(`Unknown gitGraph commit type "${raw}" in line "${line}". Defaulting to NORMAL.`);
  return 'NORMAL';
}

function splitNameAndModifiers(rest: string, modifierKeys: string[]): { name: string; modifiersText: string } {
  let cut = rest.length;
  for (const key of modifierKeys) {
    const regex = new RegExp(`\\s+(?=${key}\\s*:)`, 'i');
    const match = regex.exec(rest);
    if (match && match.index < cut) cut = match.index;
  }
  if (cut === rest.length) return { name: rest.trim(), modifiersText: '' };
  return {
    name: rest.slice(0, cut).trim(),
    modifiersText: rest.slice(cut).trim(),
  };
}

export function parseGitGraphDiagram(text: string): GitGraphDocument {
  return parseGitGraphDiagramInternal(text).doc;
}

export function parseGitGraphDiagramInternal(text: string): GitGraphParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  let orientation: GitGraphOrientation = 'LR';
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^gitgraph(?:\s+([A-Za-z]+))?\s*:?\s*$/i);
    if (match) {
      headerIdx = i;
      const rawOrientation = (match[1] ?? '').toUpperCase();
      if (rawOrientation === 'TB') {
        orientation = 'TB';
        warnings.push('DEFERRED: gitGraph TB orientation currently falls back to the LR lane layout.');
      } else if (rawOrientation === 'LR' || rawOrientation === '') {
        orientation = 'LR';
      } else if (rawOrientation) {
        warnings.push(`Unknown gitGraph orientation "${rawOrientation}". Defaulting to LR.`);
      }
      break;
    }
    warnings.push(`Expected "gitGraph" header on first content line; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  const branches: GitBranch[] = [{ name: 'main', order: 0 }];
  const branchNames = new Set<string>(['main']);
  const commits: GitCommit[] = [];
  const commitIds = new Set<string>();
  const lastCommitByBranch = new Map<string, string>();
  let currentBranch = 'main';
  let autoCommitIndex = 0;
  let inlineTitle: string | undefined;

  const ensureUniqueCommitId = (requested?: string): string => {
    if (requested && !commitIds.has(requested)) {
      commitIds.add(requested);
      return requested;
    }
    if (requested && commitIds.has(requested)) {
      warnings.push(`Duplicate gitGraph commit id "${requested}" encountered. Auto-generating a stable replacement.`);
    }
    while (commitIds.has(`commit-${autoCommitIndex}`)) autoCommitIndex += 1;
    const generated = `commit-${autoCommitIndex}`;
    commitIds.add(generated);
    autoCommitIndex += 1;
    return generated;
  };

  const ensureBranch = (name: string, reason?: string): void => {
    if (branchNames.has(name)) return;
    if (reason) warnings.push(reason);
    branches.push({ name, order: branches.length });
    branchNames.add(name);
  };

  const pushCommit = (options: {
    id?: string;
    branch: string;
    parents: string[];
    tag?: string;
    type?: GitCommitType;
    isMerge?: boolean;
    isCherryPick?: boolean;
    cherryPickSource?: string;
  }): void => {
    const id = ensureUniqueCommitId(options.id);
    const uniqueParents = [...new Set(options.parents.filter((parent) => parent.length > 0))];
    commits.push({
      id,
      branch: options.branch,
      parents: uniqueParents,
      ...(options.tag ? { tag: options.tag } : {}),
      type: options.type ?? 'NORMAL',
      isMerge: options.isMerge ?? false,
      isCherryPick: options.isCherryPick ?? false,
      ...(options.cherryPickSource ? { cherryPickSource: options.cherryPickSource } : {}),
    });
    lastCommitByBranch.set(options.branch, id);
  };

  for (let i = Math.max(0, headerIdx + 1); i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    if (/^title\b/i.test(trimmed)) {
      const title = trimmed.replace(/^title\s+/i, '').trim();
      if (title) inlineTitle = title;
      continue;
    }

    if (/^branch\b/i.test(trimmed)) {
      const rest = trimmed.replace(/^branch\b/i, '').trim();
      const { name, modifiersText } = splitNameAndModifiers(rest, ['order']);
      if (!name) {
        warnings.push(`Malformed gitGraph branch line skipped: "${trimmed}"`);
        continue;
      }
      if (branchNames.has(name)) {
        warnings.push(`Duplicate gitGraph branch declaration "${name}" ignored.`);
        continue;
      }
      const modifiers = parseModifiers(modifiersText);
      const parsedOrder = modifiers.order !== undefined ? Number.parseInt(modifiers.order, 10) : branches.length;
      const order = Number.isFinite(parsedOrder) ? parsedOrder : branches.length;
      branches.push({ name, order });
      branchNames.add(name);
      continue;
    }

    if (/^(checkout|switch)\b/i.test(trimmed)) {
      const name = trimmed.replace(/^(checkout|switch)\b/i, '').trim();
      if (!name) {
        warnings.push(`Malformed gitGraph checkout line skipped: "${trimmed}"`);
        continue;
      }
      if (!branchNames.has(name)) {
        ensureBranch(name, `Checkout of unknown branch "${name}". Creating it implicitly.`);
      }
      currentBranch = name;
      continue;
    }

    if (/^commit\b/i.test(trimmed)) {
      const modifiers = parseModifiers(trimmed.replace(/^commit\b/i, '').trim());
      pushCommit({
        id: modifiers.id,
        branch: currentBranch,
        parents: lastCommitByBranch.get(currentBranch) ? [lastCommitByBranch.get(currentBranch)!] : [],
        tag: modifiers.tag,
        type: normalizeCommitType(modifiers.type, warnings, trimmed),
      });
      continue;
    }

    if (/^merge\b/i.test(trimmed)) {
      const rest = trimmed.replace(/^merge\b/i, '').trim();
      const { name, modifiersText } = splitNameAndModifiers(rest, ['id', 'tag', 'type']);
      if (!name) {
        warnings.push(`Malformed gitGraph merge line skipped: "${trimmed}"`);
        continue;
      }
      const modifiers = parseModifiers(modifiersText);
      const parents: string[] = [];
      const currentTip = lastCommitByBranch.get(currentBranch);
      if (currentTip) parents.push(currentTip);
      if (!branchNames.has(name)) {
        warnings.push(`Merge of unknown branch "${name}". Source parent omitted.`);
      } else {
        const sourceTip = lastCommitByBranch.get(name);
        if (sourceTip) parents.push(sourceTip);
        else warnings.push(`Merge source branch "${name}" has no commits. Source parent omitted.`);
      }
      pushCommit({
        id: modifiers.id,
        branch: currentBranch,
        parents,
        tag: modifiers.tag,
        type: normalizeCommitType(modifiers.type, warnings, trimmed),
        isMerge: true,
      });
      continue;
    }

    if (/^cherry-pick\b/i.test(trimmed)) {
      const modifiers = parseModifiers(trimmed.replace(/^cherry-pick\b/i, '').trim());
      if (!modifiers.id) {
        warnings.push(`Malformed gitGraph cherry-pick line skipped: "${trimmed}"`);
        continue;
      }
      const parent = modifiers.parent ?? lastCommitByBranch.get(currentBranch);
      pushCommit({
        branch: currentBranch,
        parents: parent ? [parent] : [],
        type: 'NORMAL',
        isCherryPick: true,
        cherryPickSource: modifiers.id,
      });
      continue;
    }

    warnings.push(`Unrecognised gitGraph line skipped: "${trimmed}"`);
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTheme = fmTheme ?? directiveTheme;
  const resolvedTitle = inlineTitle ?? fmTitle ?? directiveTitle;

  return {
    doc: {
      version: '1.0',
      metadata: {
        orientation,
        ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
        ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      },
      branches,
      commits,
    },
    warnings,
    frontmatter,
  };
}
