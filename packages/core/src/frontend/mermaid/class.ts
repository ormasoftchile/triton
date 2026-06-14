/**
 * @file frontend/mermaid/class.ts — Mermaid classDiagram → ClassDocument parser.
 */

import type {
  ClassDef,
  ClassDocument,
  ClassMember,
  ClassRelationship,
} from '../../grammars/class/types.js';
import { preprocessMermaid } from './utils.js';

export interface ClassParseResult {
  doc: ClassDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

type Visibility = '+' | '-' | '#' | '~';
type MemberModifier = 'abstract' | 'static';

interface ParseContext {
  rawToId: Map<string, string>;
  classes: Map<string, ClassDef>;
  relationships: ClassRelationship[];
  warnings: string[];
  genericWarnings: Set<string>;
}

const CLASS_TOKEN_PATTERN = '[A-Za-z0-9_.~]+';
const RELATIONSHIP_REGEX = new RegExp(
  `^(${CLASS_TOKEN_PATTERN})\\s*(?:"([^"]+)")?\\s*(<\\|--|--\\|>|<\\|\\.\\.|\\.\\.\\|>|\\*--|--\\*|o--|--o|<--|-->|<\\.\\.|\\.\\.>|--|\\.\\.)\\s*(?:"([^"]+)")?\\s*(${CLASS_TOKEN_PATTERN})\\s*(?::\\s*(.+))?$`,
);
const MEMBER_ASSIGNMENT_REGEX = new RegExp(`^(${CLASS_TOKEN_PATTERN})\\s*:\\s*(.+)$`);

export function parseClassDiagram(text: string): ClassDocument {
  return parseClassDiagramInternal(text).doc;
}

export function parseClassDiagramInternal(text: string): ClassParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^classdiagram(?:-v2)?\b/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    warnings.push(
      `Expected "classDiagram" header on first content line; got: "${trimmed}". Parsing anyway.`,
    );
    break;
  }

  const context: ParseContext = {
    rawToId: new Map<string, string>(),
    classes: new Map<string, ClassDef>(),
    relationships: [],
    warnings,
    genericWarnings: new Set<string>(),
  };

  let openClassId: string | undefined;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (openClassId) {
      const closeIdx = trimmed.indexOf('}');
      if (closeIdx >= 0) {
        const before = trimmed.slice(0, closeIdx).trim();
        if (before) parseClassBodyEntries(openClassId, before, context);
        openClassId = undefined;
        const trailing = trimmed.slice(closeIdx + 1).trim();
        if (trailing) {
          const nextOpen = processStatement(trailing, context);
          if (nextOpen) openClassId = nextOpen;
        }
      } else {
        parseClassBodyEntries(openClassId, trimmed, context);
      }
      continue;
    }

    const nextOpen = processStatement(trimmed, context);
    if (nextOpen) openClassId = nextOpen;
  }

  if (openClassId) {
    warnings.push(`Unclosed class body for "${context.classes.get(openClassId)?.name ?? openClassId}"`);
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTheme = fmTheme ?? directiveTheme;
  const resolvedTitle = fmTitle ?? directiveTitle;

  const doc: ClassDocument = {
    version: '1.0',
    metadata: {
      ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
    },
    classes: Array.from(context.classes.values()),
    relationships: context.relationships,
  };

  return { doc, warnings, frontmatter };
}

function processStatement(stmt: string, context: ParseContext): string | undefined {
  if (stmt === '}') return undefined;

  if (/^direction\b/i.test(stmt)) {
    context.warnings.push(`DEFERRED: classDiagram direction has no layout effect yet: "${stmt}"`);
    return undefined;
  }

  if (/^namespace\b/i.test(stmt)) {
    const braceIdx = stmt.indexOf('{');
    if (braceIdx >= 0) {
      const inner = stmt.slice(braceIdx + 1).replace(/}\s*$/, '').trim();
      if (inner) return processStatement(inner, context);
    }
    return undefined;
  }

  const classOpen = tryParseClassDeclaration(stmt, context);
  if (classOpen.handled) return classOpen.openClassId;

  const relationship = parseRelationship(stmt, context);
  if (relationship) {
    context.relationships.push(relationship);
    return undefined;
  }

  const memberMatch = stmt.match(MEMBER_ASSIGNMENT_REGEX);
  if (memberMatch) {
    const rawClass = memberMatch[1] ?? '';
    const memberText = memberMatch[2] ?? '';
    const classId = ensureClass(rawClass, context);
    const member = parseMember(memberText);
    if (member) {
      context.classes.get(classId)?.members.push(member);
    } else {
      context.warnings.push(`Could not parse member assignment: "${stmt}"`);
    }
    return undefined;
  }

  context.warnings.push(`Unrecognised classDiagram line skipped: "${stmt}"`);
  return undefined;
}

function tryParseClassDeclaration(
  stmt: string,
  context: ParseContext,
): { handled: boolean; openClassId?: string } {
  const match = stmt.match(/^class\s+([A-Za-z0-9_.~]+)\s*(.*)$/i);
  if (!match) return { handled: false };

  const rawName = match[1] ?? '';
  const rest = (match[2] ?? '').trim();
  const classId = ensureClass(rawName, context);

  if (!rest) return { handled: true };
  if (!rest.startsWith('{')) {
    context.warnings.push(`Unrecognised class declaration suffix skipped: "${stmt}"`);
    return { handled: true };
  }

  const afterBrace = rest.slice(1);
  const closeIdx = afterBrace.indexOf('}');
  if (closeIdx >= 0) {
    const body = afterBrace.slice(0, closeIdx).trim();
    if (body) parseClassBodyEntries(classId, body, context);
    const trailing = afterBrace.slice(closeIdx + 1).trim();
    if (trailing) processStatement(trailing, context);
    return { handled: true };
  }

  const inlineBody = afterBrace.trim();
  if (inlineBody) parseClassBodyEntries(classId, inlineBody, context);
  return { handled: true, openClassId: classId };
}

function parseClassBodyEntries(classId: string, content: string, context: ParseContext): void {
  const entries = content
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    if (/^<<.+>>$/.test(entry)) {
      const cls = context.classes.get(classId);
      if (cls) cls.stereotype = entry;
      continue;
    }

    const member = parseMember(entry);
    if (member) {
      context.classes.get(classId)?.members.push(member);
    } else {
      context.warnings.push(`Could not parse class member in "${context.classes.get(classId)?.name ?? classId}": "${entry}"`);
    }
  }
}

function parseRelationship(stmt: string, context: ParseContext): ClassRelationship | null {
  const match = stmt.match(RELATIONSHIP_REGEX);
  if (!match) return null;

  const leftRaw = match[1] ?? '';
  const leftCard = match[2] ?? undefined;
  const operator = match[3] ?? '';
  const rightCard = match[4] ?? undefined;
  const rightRaw = match[5] ?? '';
  const label = match[6]?.trim() || undefined;

  const leftId = ensureClass(leftRaw, context);
  const rightId = ensureClass(rightRaw, context);

  const base: Omit<ClassRelationship, 'kind' | 'from' | 'to'> = {
    ...(label ? { label } : {}),
  };

  switch (operator) {
    case '<|--':
      return {
        from: rightId,
        to: leftId,
        kind: 'inheritance',
        ...(rightCard ? { fromCardinality: rightCard } : {}),
        ...(leftCard ? { toCardinality: leftCard } : {}),
        ...base,
      };
    case '--|>':
      return {
        from: leftId,
        to: rightId,
        kind: 'inheritance',
        ...(leftCard ? { fromCardinality: leftCard } : {}),
        ...(rightCard ? { toCardinality: rightCard } : {}),
        ...base,
      };
    case '<|..':
      return {
        from: rightId,
        to: leftId,
        kind: 'realization',
        ...(rightCard ? { fromCardinality: rightCard } : {}),
        ...(leftCard ? { toCardinality: leftCard } : {}),
        ...base,
      };
    case '..|>':
      return {
        from: leftId,
        to: rightId,
        kind: 'realization',
        ...(leftCard ? { fromCardinality: leftCard } : {}),
        ...(rightCard ? { toCardinality: rightCard } : {}),
        ...base,
      };
    case '*--':
      return {
        from: leftId,
        to: rightId,
        kind: 'composition',
        ...(leftCard ? { fromCardinality: leftCard } : {}),
        ...(rightCard ? { toCardinality: rightCard } : {}),
        ...base,
      };
    case '--*':
      return {
        from: rightId,
        to: leftId,
        kind: 'composition',
        ...(rightCard ? { fromCardinality: rightCard } : {}),
        ...(leftCard ? { toCardinality: leftCard } : {}),
        ...base,
      };
    case 'o--':
      return {
        from: leftId,
        to: rightId,
        kind: 'aggregation',
        ...(leftCard ? { fromCardinality: leftCard } : {}),
        ...(rightCard ? { toCardinality: rightCard } : {}),
        ...base,
      };
    case '--o':
      return {
        from: rightId,
        to: leftId,
        kind: 'aggregation',
        ...(rightCard ? { fromCardinality: rightCard } : {}),
        ...(leftCard ? { toCardinality: leftCard } : {}),
        ...base,
      };
    case '<--':
      return {
        from: rightId,
        to: leftId,
        kind: 'association',
        ...(rightCard ? { fromCardinality: rightCard } : {}),
        ...(leftCard ? { toCardinality: leftCard } : {}),
        ...base,
      };
    case '-->':
    case '--':
      return {
        from: leftId,
        to: rightId,
        kind: 'association',
        ...(leftCard ? { fromCardinality: leftCard } : {}),
        ...(rightCard ? { toCardinality: rightCard } : {}),
        ...base,
      };
    case '<..':
      return {
        from: rightId,
        to: leftId,
        kind: 'dependency',
        ...(rightCard ? { fromCardinality: rightCard } : {}),
        ...(leftCard ? { toCardinality: leftCard } : {}),
        ...base,
      };
    case '..>':
    case '..':
      return {
        from: leftId,
        to: rightId,
        kind: 'dependency',
        ...(leftCard ? { fromCardinality: leftCard } : {}),
        ...(rightCard ? { toCardinality: rightCard } : {}),
        ...base,
      };
    default:
      return null;
  }
}

function parseMember(raw: string): ClassMember | null {
  let text = raw.trim();
  if (!text) return null;

  const { core, modifiers } = extractModifiers(text);
  text = core;
  if (!text) return null;

  let visibility: Visibility | undefined;
  if (/^[+\-#~]/.test(text)) {
    visibility = text[0] as Visibility;
    text = text.slice(1).trim();
  }
  if (!text) return null;

  const methodMatch = text.match(/^(.+?)\((.*?)\)\s*(.*)$/);
  if (methodMatch) {
    const beforeParen = (methodMatch[1] ?? '').trim();
    const params = normalizeTypeText(methodMatch[2] ?? '');
    const trailingType = normalizeTypeText(methodMatch[3] ?? '');
    if (!beforeParen) return null;

    let name = beforeParen;
    let type: string | undefined;
    const colonIdx = beforeParen.indexOf(':');
    if (colonIdx >= 0) {
      name = beforeParen.slice(0, colonIdx).trim();
      type = normalizeTypeText(beforeParen.slice(colonIdx + 1));
    } else {
      const parts = beforeParen.split(/\s+/).filter(Boolean);
      name = parts.pop() ?? '';
      if (parts.length > 0) type = normalizeTypeText(parts.join(' '));
    }
    if (trailingType) type = trailingType;
    if (!name || !isValidMemberName(name)) return null;

    return {
      ...(visibility ? { visibility } : {}),
      name,
      ...(type ? { type } : {}),
      isMethod: true,
      ...(params ? { params } : {}),
      ...(modifiers ? { modifiers } : {}),
    };
  }

  const colonIdx = text.indexOf(':');
  if (colonIdx >= 0) {
    const name = text.slice(0, colonIdx).trim();
    const type = normalizeTypeText(text.slice(colonIdx + 1));
    if (!name || !isValidMemberName(name)) return null;
    return {
      ...(visibility ? { visibility } : {}),
      name,
      ...(type ? { type } : {}),
      isMethod: false,
      ...(modifiers ? { modifiers } : {}),
    };
  }

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    if (!isValidMemberName(parts[0]!)) return null;
    return {
      ...(visibility ? { visibility } : {}),
      name: parts[0]!,
      isMethod: false,
      ...(modifiers ? { modifiers } : {}),
    };
  }

  const name = parts[parts.length - 1] ?? '';
  const type = normalizeTypeText(parts.slice(0, -1).join(' '));
  if (!name || !isValidMemberName(name)) return null;

  return {
    ...(visibility ? { visibility } : {}),
    name,
    ...(type ? { type } : {}),
    isMethod: false,
    ...(modifiers ? { modifiers } : {}),
  };
}

function extractModifiers(text: string): { core: string; modifiers?: MemberModifier[] } {
  let core = text.trim();
  const modifiers: MemberModifier[] = [];

  while (core.endsWith('$') || core.endsWith('*')) {
    const marker = core[core.length - 1];
    core = core.slice(0, -1).trimEnd();
    if (marker === '$' && !modifiers.includes('static')) modifiers.unshift('static');
    if (marker === '*' && !modifiers.includes('abstract')) modifiers.unshift('abstract');
  }

  return modifiers.length > 0 ? { core, modifiers } : { core };
}

function ensureClass(rawToken: string, context: ParseContext): string {
  const normalized = normalizeClassToken(rawToken, context);
  const existing = context.rawToId.get(rawToken) ?? context.rawToId.get(normalized.canonical);
  if (existing) {
    context.rawToId.set(rawToken, existing);
    context.rawToId.set(normalized.canonical, existing);
    const cls = context.classes.get(existing);
    if (cls && !cls.name) cls.name = normalized.displayName;
    return existing;
  }

  const id = sanitizeClassId(normalized.canonical, context.rawToId);
  context.rawToId.set(rawToken, id);
  context.rawToId.set(normalized.canonical, id);
  context.classes.set(id, {
    id,
    name: normalized.displayName,
    members: [],
  });
  return id;
}

function normalizeClassToken(rawToken: string, context: ParseContext): { canonical: string; displayName: string } {
  const trimmed = rawToken.trim();
  const genericIdx = trimmed.indexOf('~');
  if (genericIdx >= 0) {
    const canonical = trimmed.slice(0, genericIdx) || trimmed;
    if (!context.genericWarnings.has(trimmed)) {
      context.genericWarnings.add(trimmed);
      context.warnings.push(`Generic class name "${trimmed}" stripped to "${canonical}" for classDiagram compatibility.`);
    }
    return { canonical, displayName: canonical };
  }
  return { canonical: trimmed, displayName: trimmed };
}

function sanitizeClassId(rawId: string, rawToId: Map<string, string>): string {
  let s = rawId.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) s = 'class';
  if (/^\d/.test(s)) s = `c${s}`;

  const existingValues = new Set(rawToId.values());
  if (!existingValues.has(s)) return s;

  let candidate = s;
  let counter = 2;
  while (existingValues.has(candidate)) {
    candidate = `${s}-${counter}`;
    counter++;
  }
  return candidate;
}

function normalizeTypeText(text: string): string {
  return text.replace(/~([^~]+)~/g, '<$1>').trim();
}

function isValidMemberName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
