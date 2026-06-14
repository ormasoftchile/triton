/**
 * @file frontend/mermaid/er.ts — Mermaid erDiagram → ERDocument parser.
 */

import type { ErAttribute, ErCardinality, ErDocument, ErEntity, ErRelationship } from '../../grammars/er/types.js';
import { preprocessMermaid } from './utils.js';

export interface ErParseResult {
  doc: ErDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

interface ParseContext {
  entities: Map<string, ErEntity>;
  relationships: ErRelationship[];
  warnings: string[];
}

const RELATIONSHIP_REGEX =
  /^([A-Za-z][A-Za-z0-9_-]*)\s*(\|o|o\||\|\||\}o|o\{|\}\||\|\{|\{\||\{o)\s*(--|\.\.)\s*(o\||\|o|\|\||o\{|\}o|\|\{|\}\||\|\}|o\})\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+)$/;

export function parseErDiagram(text: string): ErDocument {
  return parseErDiagramInternal(text).doc;
}

export function parseErDiagramInternal(text: string): ErParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^erdiagram\b/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    warnings.push(`Expected "erDiagram" header on first content line; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  const context: ParseContext = {
    entities: new Map<string, ErEntity>(),
    relationships: [],
    warnings,
  };

  let openEntity: string | undefined;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    if (openEntity) {
      if (trimmed === '}') {
        openEntity = undefined;
        continue;
      }
      parseAttribute(openEntity, trimmed, context);
      continue;
    }

    const entityOpen = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*\{$/);
    if (entityOpen) {
      const name = entityOpen[1] ?? '';
      ensureEntity(name, context);
      openEntity = name;
      continue;
    }

    const inlineEntity = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*\{\s*(.*?)\s*\}$/);
    if (inlineEntity) {
      const name = inlineEntity[1] ?? '';
      ensureEntity(name, context);
      const bodyText = inlineEntity[2]?.trim() ?? '';
      if (bodyText) {
        for (const stmt of bodyText.split(';').map((part) => part.trim()).filter(Boolean)) {
          parseAttribute(name, stmt, context);
        }
      }
      continue;
    }

    const relationship = parseRelationship(trimmed, context);
    if (relationship) {
      context.relationships.push(relationship);
      continue;
    }

    warnings.push(`Unrecognised erDiagram line skipped: "${trimmed}"`);
  }

  if (openEntity) warnings.push(`Unclosed entity block for "${openEntity}"`);

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTheme = fmTheme ?? directiveTheme;
  const resolvedTitle = fmTitle ?? directiveTitle;

  const doc: ErDocument = {
    version: '1.0',
    metadata: {
      ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
    },
    entities: Array.from(context.entities.values()),
    relationships: context.relationships,
  };

  return { doc, warnings, frontmatter };
}

function ensureEntity(name: string, context: ParseContext): ErEntity {
  const existing = context.entities.get(name);
  if (existing) return existing;
  const entity: ErEntity = { name, attributes: [] };
  context.entities.set(name, entity);
  return entity;
}

function parseRelationship(line: string, context: ParseContext): ErRelationship | null {
  const match = line.match(RELATIONSHIP_REGEX);
  if (!match) return null;
  const entityA = match[1] ?? '';
  const tokenA = match[2] ?? '';
  const operator = match[3] ?? '--';
  const tokenB = match[4] ?? '';
  const entityB = match[5] ?? '';
  const labelRaw = (match[6] ?? '').trim();
  const label = stripQuotes(labelRaw);

  ensureEntity(entityA, context);
  ensureEntity(entityB, context);

  return {
    entityA,
    entityB,
    cardinalityA: mapCardinality(tokenA),
    cardinalityB: mapCardinality(tokenB),
    identifying: operator === '--',
    label,
  };
}

function parseAttribute(entityName: string, line: string, context: ParseContext): void {
  const entity = ensureEntity(entityName, context);
  const commentMatch = line.match(/^(.*?)(?:\s+"([^"]*)")?$/);
  const core = (commentMatch?.[1] ?? line).trim();
  const comment = commentMatch?.[2];
  const tokens = core.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    context.warnings.push(`Could not parse ER attribute in "${entityName}": "${line}"`);
    return;
  }
  const type = tokens.shift()!;
  const name = tokens.shift()!;
  const keys = tokens.filter((token): token is 'PK' | 'FK' | 'UK' => token === 'PK' || token === 'FK' || token === 'UK');
  const attribute: ErAttribute = {
    type,
    name,
    ...(keys.length > 0 ? { keys } : {}),
    ...(comment !== undefined ? { comment } : {}),
  };
  entity.attributes.push(attribute);
}

function stripQuotes(text: string): string {
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function mapCardinality(token: string): ErCardinality {
  const normalized = token.replace(/\{/g, '}').replace(/\|\}/g, '}|').replace(/o\}/g, '}o');
  switch (normalized) {
    case '|o':
    case 'o|':
      return 'zero-or-one';
    case '||':
      return 'exactly-one';
    case '}o':
    case 'o}':
      return 'zero-or-many';
    case '}|':
    case '|}':
      return 'one-or-many';
    default:
      return 'exactly-one';
  }
}
