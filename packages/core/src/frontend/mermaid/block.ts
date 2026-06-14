/**
 * @file frontend/mermaid/block.ts — Mermaid block-beta → BlockDocument parser.
 */

import type { BlockArrow, BlockDocument, BlockGroup, BlockItem, BlockShape } from '../../grammars/block/types.js';
import { preprocessMermaid } from './utils.js';

export interface BlockParseResult {
  doc: BlockDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

interface GroupContext {
  id: string;
}

function parseSpan(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function scanTokens(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let square = 0;
  let paren = 0;
  let brace = 0;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      current += ch;
      if (ch === quote && line[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[') square += 1;
    else if (ch === ']') square = Math.max(0, square - 1);
    else if (ch === '(') paren += 1;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '{') brace += 1;
    else if (ch === '}') brace = Math.max(0, brace - 1);

    if (/\s/.test(ch) && square === 0 && paren === 0 && brace === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parseArrow(line: string): BlockArrow | null {
  const labeled = /^(\S+)\s+--\s+"([^"]+)"\s+-->\s+(\S+)$/u.exec(line);
  if (labeled) {
    return { from: labeled[1]!, to: labeled[3]!, label: labeled[2]! };
  }
  const plain = /^(\S+)\s+-->\s+(\S+)$/u.exec(line);
  if (plain) {
    return { from: plain[1]!, to: plain[2]! };
  }
  return null;
}

function parseGroupStart(token: string): { id: string; label: string; span: number } | null {
  const match = /^block:([A-Za-z0-9_-]+)\["([^"]+)"\](?::(\d+))?$/u.exec(token);
  if (!match) return null;
  return { id: match[1]!, label: match[2]!, span: parseSpan(match[3]) };
}

function parseItemToken(token: string, warnings: string[], lineNo: number): Omit<BlockItem, 'group' | 'order'> | null {
  const space = /^space(?::(\d+))?$/iu.exec(token);
  if (space) {
    return { id: '', label: '', shape: 'space', span: parseSpan(space[1]), isSpace: true };
  }

  const patterns: Array<[BlockShape, RegExp]> = [
    ['circle', /^([A-Za-z0-9_-]+)\(\("([^"]*)"\)\)(?::(\d+))?$/u],
    ['rounded', /^([A-Za-z0-9_-]+)\("([^"]*)"\)(?::(\d+))?$/u],
    ['diamond', /^([A-Za-z0-9_-]+)\{"([^"]*)"\}(?::(\d+))?$/u],
    ['flag', /^([A-Za-z0-9_-]+)>"([^"]*)"\](?::(\d+))?$/u],
    ['rect', /^([A-Za-z0-9_-]+)\["([^"]*)"\](?::(\d+))?$/u],
  ];

  for (const [shape, pattern] of patterns) {
    const match = pattern.exec(token);
    if (match) {
      return { id: match[1]!, label: match[2]!, shape, span: parseSpan(match[3]), isSpace: false };
    }
  }

  const bare = /^([A-Za-z0-9_-]+)$/u.exec(token);
  if (bare) {
    return { id: bare[1]!, label: bare[1]!, shape: 'rect', span: 1, isSpace: false };
  }

  warnings.push(`Line ${lineNo}: could not parse block token '${token}'; skipped`);
  return null;
}

export function parseBlockDiagram(text: string): BlockDocument {
  return parseBlockDiagramInternal(text).doc;
}

export function parseBlockDiagramInternal(text: string): BlockParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const warnings: string[] = [];
  const items: BlockItem[] = [];
  const groups: BlockGroup[] = [];
  const arrows: BlockArrow[] = [];
  const rawLines = body.split('\n');
  const groupStack: GroupContext[] = [];
  const usedIds = new Set<string>();
  let columns = 1;
  let order = 0;
  let autoSpace = 0;
  let headerSeen = false;
  let explicitTitle: string | undefined;

  function currentGroupId(): string | undefined {
    return groupStack[groupStack.length - 1]?.id;
  }

  function attachToParent(id: string): void {
    const parentId = currentGroupId();
    if (!parentId) return;
    const parent = groups.find((group) => group.id === parentId);
    parent?.childIds.push(id);
  }

  function ensureUniqueId(base: string): string {
    let candidate = base;
    let idx = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${idx}`;
      idx += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const rawLine = rawLines[lineIndex] ?? '';
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (!headerSeen) {
      if (/^block-beta\b/i.test(trimmed)) {
        headerSeen = true;
        continue;
      }
      warnings.push(`Line ${lineIndex + 1}: expected block-beta header before '${trimmed}'`);
      headerSeen = true;
    }

    const columnsMatch = /^columns\s+(\d+)$/iu.exec(trimmed);
    if (columnsMatch) {
      columns = Math.max(1, Number.parseInt(columnsMatch[1]!, 10) || 1);
      continue;
    }

    const arrow = parseArrow(trimmed);
    if (arrow) {
      arrows.push(arrow);
      continue;
    }

    if (/^title\s+/iu.test(trimmed)) {
      // Supported as a convenience, though not required by the Mermaid block-beta spec.
      explicitTitle = trimmed.replace(/^title\s+/iu, '').trim();
      continue;
    }

    const tokens = scanTokens(trimmed);
    for (const token of tokens) {
      if (/^end$/iu.test(token)) {
        if (groupStack.length === 0) {
          warnings.push(`Line ${lineIndex + 1}: stray 'end' with no open block group`);
        } else {
          groupStack.pop();
        }
        continue;
      }

      const groupStart = parseGroupStart(token);
      if (groupStart) {
        const id = ensureUniqueId(groupStart.id);
        const group: BlockGroup = {
          id,
          label: groupStart.label,
          span: groupStart.span,
          childIds: [],
          group: currentGroupId(),
          order: order++,
        };
        groups.push(group);
        attachToParent(group.id);
        groupStack.push({ id: group.id });
        continue;
      }

      const parsed = parseItemToken(token, warnings, lineIndex + 1);
      if (!parsed) continue;
      const id = parsed.isSpace ? ensureUniqueId(`__space_${++autoSpace}`) : ensureUniqueId(parsed.id);
      const item: BlockItem = {
        ...parsed,
        id,
        group: currentGroupId(),
        order: order++,
      };
      items.push(item);
      attachToParent(item.id);
    }
  }

  if (groupStack.length > 0) {
    warnings.push(`Unclosed block group(s): ${groupStack.map((g) => g.id).join(', ')}`);
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  const doc: BlockDocument = {
    version: '1.0',
    metadata: {
      title: explicitTitle ?? fmTitle ?? (typeof directiveTitle === 'string' ? directiveTitle : undefined),
      theme: fmTheme ?? (typeof directiveTheme === 'string' ? directiveTheme : undefined),
    },
    columns,
    items,
    groups,
    arrows,
  };

  return { doc, warnings, frontmatter };
}
