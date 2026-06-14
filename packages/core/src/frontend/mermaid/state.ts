/**
 * @file frontend/mermaid/state.ts — Mermaid stateDiagram → StateDocument parser.
 */

import type { StateDocument, StateNode, StateTransition } from '../../grammars/state/types.js';
import { normalizeStateDocument } from '../../grammars/state/schema.js';
import { preprocessMermaid } from './utils.js';

export interface StateParseResult {
  doc: StateDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

interface StateContext {
  owner?: StateNode;
  states: StateNode[];
  depth: number;
  scopeId: string;
}

type StateToken =
  | { kind: 'line'; text: string }
  | { kind: 'note'; side: 'left' | 'right'; stateId: string; text: string };

interface ParseContext {
  nodeById: Map<string, StateNode>;
  transitions: StateTransition[];
}

export function parseStateDiagram(text: string): StateDocument {
  return parseStateDiagramInternal(text).doc;
}

export function parseStateDiagramInternal(text: string): StateParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^statediagram(?:-v2)?\b/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    warnings.push(
      `Expected "stateDiagram" or "stateDiagram-v2" header on first content line; got: "${trimmed}". Parsing anyway.`,
    );
    break;
  }

  const tokens = tokenizeStateLines(lines.slice(Math.max(0, headerIdx + 1)), warnings);
  const rootStates: StateNode[] = [];
  const stack: StateContext[] = [{ states: rootStates, depth: 0, scopeId: 'root' }];
  const context: ParseContext = {
    nodeById: new Map<string, StateNode>(),
    transitions: [],
  };

  for (const token of tokens) {
    const current = stack[stack.length - 1]!;
    if (token.kind === 'note') {
      const state = ensureState(token.stateId, current, context);
      state.note = token.text;
      state.notePosition = token.side;
      continue;
    }

    const stmt = token.text.trim();
    if (!stmt) continue;

    if (stmt === '}') {
      if (stack.length > 1) stack.pop();
      else warnings.push('Unmatched composite-state closing brace skipped.');
      continue;
    }

    if (/^direction\b/i.test(stmt)) {
      warnings.push(`DEFERRED: stateDiagram direction is cosmetic-only for now: "${stmt}"`);
      continue;
    }

    const compositeMatch = stmt.match(/^state\s+(.+?)\s*\{$/i);
    if (compositeMatch) {
      const node = parseStateDeclaration((compositeMatch[1] ?? '').trim(), current, context);
      if (!node) {
        warnings.push(`Unrecognised composite state declaration skipped: "${stmt}"`);
        continue;
      }
      if (!node.children) node.children = [];
      if (current.depth + 1 > 2) {
        warnings.push(
          `DEFERRED: composite nesting deeper than 2 levels will render as a flat state group: "${node.id}"`,
        );
      }
      stack.push({ states: node.children, owner: node, depth: current.depth + 1, scopeId: node.id });
      continue;
    }

    if (/^state\b/i.test(stmt)) {
      const node = parseStateDeclaration(stmt.slice(5).trim(), current, context);
      if (!node) warnings.push(`Unrecognised state declaration skipped: "${stmt}"`);
      continue;
    }

    const descriptionMatch = stmt.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.+)$/);
    if (descriptionMatch) {
      const node = ensureState(descriptionMatch[1] ?? '', current, context);
      const description = (descriptionMatch[2] ?? '').trim();
      node.description = description;
      if (!node.label) node.label = description;
      continue;
    }

    const transition = parseTransition(stmt, current, context);
    if (transition) {
      context.transitions.push(transition);
      continue;
    }

    warnings.push(`Unrecognised stateDiagram line skipped: "${stmt}"`);
  }

  if (stack.length > 1) {
    warnings.push(`Unclosed composite state body for "${stack[stack.length - 1]!.owner?.id ?? 'unknown'}"`);
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTheme = fmTheme ?? directiveTheme;
  const resolvedTitle = fmTitle ?? directiveTitle;

  const doc: StateDocument = normalizeStateDocument({
    version: '1.0',
    metadata: {
      ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
    },
    states: rootStates,
    transitions: context.transitions,
  });

  return { doc, warnings, frontmatter };
}

function tokenizeStateLines(lines: string[], warnings: string[]): StateToken[] {
  const tokens: StateToken[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const noteMatch = trimmed.match(/^note\s+(right|left)\s+of\s+([A-Za-z0-9_.-]+)\s*$/i);
    if (noteMatch) {
      const noteLines: string[] = [];
      let foundEnd = false;
      for (i = i + 1; i < lines.length; i++) {
        const noteLine = lines[i] ?? '';
        if (noteLine.trim().toLowerCase() === 'end note') {
          foundEnd = true;
          break;
        }
        noteLines.push(noteLine.trim());
      }
      if (!foundEnd) warnings.push(`Unclosed note block for state "${noteMatch[2] ?? ''}"`);
      tokens.push({
        kind: 'note',
        side: ((noteMatch[1] ?? 'right').toLowerCase() as 'left' | 'right'),
        stateId: noteMatch[2] ?? '',
        text: noteLines.join('\n').trim(),
      });
      continue;
    }

    for (const text of explodeStateLine(trimmed)) {
      if (text) tokens.push({ kind: 'line', text });
    }
  }
  return tokens;
}

function explodeStateLine(line: string): string[] {
  const pieces: string[] = [];
  let buffer = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuote = !inQuote;
      buffer += ch;
      continue;
    }
    if (!inQuote && (ch === '{' || ch === '}')) {
      const before = buffer.trim();
      if (ch === '{') {
        if (before) pieces.push(`${before} {`);
      } else if (before) {
        pieces.push(before);
      }
      if (ch === '}') pieces.push('}');
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  const tail = buffer.trim();
  if (tail) pieces.push(tail);
  return pieces;
}

function ensureState(id: string, current: StateContext, context: ParseContext): StateNode {
  const trimmed = id.trim();
  const existing = context.nodeById.get(trimmed);
  if (existing) return existing;
  const node: StateNode = { id: trimmed };
  current.states.push(node);
  context.nodeById.set(trimmed, node);
  return node;
}

function ensurePseudo(kind: 'start' | 'end', current: StateContext, context: ParseContext): StateNode {
  const id = current.owner ? `${current.scopeId}__${kind}__` : kind === 'start' ? '__start__' : '__end__';
  const existing = context.nodeById.get(id);
  if (existing) return existing;
  const node: StateNode = { id, isPseudo: kind };
  current.states.push(node);
  context.nodeById.set(id, node);
  return node;
}

function parseStateDeclaration(content: string, current: StateContext, context: ParseContext): StateNode | null {
  const labelAs = content.match(/^"([^"]+)"\s+as\s+([A-Za-z0-9_.-]+)$/i);
  if (labelAs) {
    const node = ensureState(labelAs[2] ?? '', current, context);
    node.displayLabel = labelAs[1] ?? node.displayLabel;
    node.label = node.displayLabel;
    return node;
  }

  const pseudo = content.match(/^([A-Za-z0-9_.-]+)\s+<<\s*(fork|join|choice)\s*>>$/i);
  if (pseudo) {
    const node = ensureState(pseudo[1] ?? '', current, context);
    node.isPseudo = (pseudo[2] ?? '').toLowerCase() as StateNode['isPseudo'];
    return node;
  }

  const bare = content.match(/^([A-Za-z0-9_.-]+)$/);
  if (bare) {
    return ensureState(bare[1] ?? '', current, context);
  }

  const labelOnly = content.match(/^"([^"]+)"$/);
  if (labelOnly) {
    const syntheticId =
      labelOnly[1]!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'state';
    const node = ensureState(syntheticId, current, context);
    node.displayLabel = labelOnly[1];
    node.label = node.displayLabel;
    return node;
  }

  return null;
}

function parseTransition(stmt: string, current: StateContext, context: ParseContext): StateTransition | null {
  const match = stmt.match(/^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.+))?$/);
  if (!match) return null;

  const fromToken = (match[1] ?? '').trim();
  const toToken = (match[2] ?? '').trim();
  const label = match[3]?.trim() || undefined;

  const from =
    fromToken === '[*]'
      ? ensurePseudo('start', current, context).id
      : ensureState(fromToken, current, context).id;
  const to =
    toToken === '[*]'
      ? ensurePseudo('end', current, context).id
      : ensureState(toToken, current, context).id;
  return { from, to, ...(label ? { label } : {}) };
}
