/**
 * @file frontend/mermaid/architecture.ts — Mermaid architecture-beta → ArchitectureDocument parser.
 */

import { hasIcon } from '../../icons.js';
import type {
  ArchitectureDocument,
  ArchEdge,
  ArchGroup,
  ArchJunction,
  ArchService,
  ArrowType,
  PortSide,
} from '../../grammars/architecture/types.js';
import { preprocessMermaid } from './utils.js';

export interface ArchitectureParseResult {
  doc: ArchitectureDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

interface GroupScope {
  indent: number;
  id: string;
}

function countIndent(rawLine: string): number {
  let width = 0;
  for (const ch of rawLine) {
    if (ch === ' ') width += 1;
    else if (ch === '\t') width += 2;
    else break;
  }
  return width;
}

function normalizeSide(raw: string): PortSide {
  return raw.toUpperCase() as PortSide;
}

function arrowTypeFromToken(token: string): ArrowType {
  if (token === '-->') return 'arrow';
  if (token === '<--') return 'arrow-left';
  if (token === '<-->') return 'arrow-both';
  return 'none';
}

export function parseArchitectureDiagram(text: string): ArchitectureDocument {
  return parseArchitectureDiagramInternal(text).doc;
}

export function parseArchitectureDiagramInternal(text: string): ArchitectureParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const warnings: string[] = [];
  const services: ArchService[] = [];
  const groups: ArchGroup[] = [];
  const junctions: ArchJunction[] = [];
  const edges: ArchEdge[] = [];
  const lines = body.split('\n');
  const groupStack: GroupScope[] = [];
  const seenIds = new Set<string>();
  let headerSeen = false;
  let explicitTitle: string | undefined;

  const currentParentGroup = (): string | undefined => groupStack[groupStack.length - 1]?.id;

  const ensureUniqueId = (id: string, lineNo: number): boolean => {
    if (seenIds.has(id)) {
      warnings.push(`Line ${lineNo}: duplicate architecture id '${id}' skipped`);
      return false;
    }
    seenIds.add(id);
    return true;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex] ?? '';
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    const indent = countIndent(rawLine);
    while (groupStack.length > 0 && indent <= groupStack[groupStack.length - 1]!.indent) {
      groupStack.pop();
    }

    if (!headerSeen) {
      if (/^architecture(?:-beta)?\b/i.test(trimmed)) {
        headerSeen = true;
        continue;
      }
      warnings.push(`Line ${lineIndex + 1}: expected architecture-beta header before '${trimmed}'`);
      headerSeen = true;
    }

    if (/^title\s+/iu.test(trimmed)) {
      explicitTitle = trimmed.replace(/^title\s+/iu, '').trim();
      continue;
    }

    const groupMatch = /^group\s+([A-Za-z0-9_-]+)\(([^)]+)\)\[([^\]]+)\](?:\s+in\s+([A-Za-z0-9_-]+))?$/u.exec(trimmed);
    if (groupMatch) {
      const [, id, icon, title, explicitParent] = groupMatch;
      if (!ensureUniqueId(id!, lineIndex + 1)) continue;
      if (!hasIcon(icon!)) {
        warnings.push(`Line ${lineIndex + 1}: unknown architecture icon '${icon}' on group '${id}'`);
      }
      const parentGroup = explicitParent ?? currentParentGroup();
      groups.push({ id: id!, icon: icon!, title: title!, ...(parentGroup ? { parentGroup } : {}) });
      groupStack.push({ indent, id: id! });
      continue;
    }

    const serviceMatch = /^service\s+([A-Za-z0-9_-]+)\(([^)]+)\)\[([^\]]+)\](?:\s+in\s+([A-Za-z0-9_-]+))?$/u.exec(trimmed);
    if (serviceMatch) {
      const [, id, icon, title, explicitParent] = serviceMatch;
      if (!ensureUniqueId(id!, lineIndex + 1)) continue;
      if (!hasIcon(icon!)) {
        warnings.push(`Line ${lineIndex + 1}: unknown architecture icon '${icon}' on service '${id}'`);
      }
      const parentGroup = explicitParent ?? currentParentGroup();
      services.push({ id: id!, icon: icon!, title: title!, ...(parentGroup ? { parentGroup } : {}) });
      continue;
    }

    const junctionMatch = /^junction\s+([A-Za-z0-9_-]+)(?:\s+in\s+([A-Za-z0-9_-]+))?$/u.exec(trimmed);
    if (junctionMatch) {
      const [, id, explicitParent] = junctionMatch;
      if (!ensureUniqueId(id!, lineIndex + 1)) continue;
      const parentGroup = explicitParent ?? currentParentGroup();
      junctions.push({ id: id!, ...(parentGroup ? { parentGroup } : {}) });
      continue;
    }

    const edgeMatch = /^([A-Za-z0-9_-]+):([LRBTlrbt])\s*(<-->|<--|-->|--)\s*([LRBTlrbt]):([A-Za-z0-9_-]+)$/u.exec(trimmed);
    if (edgeMatch) {
      const [, fromId, fromSide, arrowToken, toSide, toId] = edgeMatch;
      edges.push({
        fromId: fromId!,
        fromSide: normalizeSide(fromSide!),
        toId: toId!,
        toSide: normalizeSide(toSide!),
        arrowType: arrowTypeFromToken(arrowToken!),
      });
      continue;
    }

    warnings.push(`Line ${lineIndex + 1}: could not parse architecture statement '${trimmed}'; skipped`);
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const allIds = new Set<string>([
    ...services.map((service) => service.id),
    ...groups.map((group) => group.id),
    ...junctions.map((junction) => junction.id),
  ]);

  const normalizeParent = <T extends { parentGroup?: string; id: string }>(items: T[], kind: string): T[] => items.map((item) => {
    if (item.parentGroup && !groupIds.has(item.parentGroup)) {
      warnings.push(`${kind} '${item.id}' references unknown parent group '${item.parentGroup}'; treating as top-level`);
      const { parentGroup: _removed, ...rest } = item;
      return rest as T;
    }
    return item;
  });

  const filteredEdges = edges.filter((edge) => {
    let ok = true;
    if (!allIds.has(edge.fromId)) {
      warnings.push(`Edge '${edge.fromId}:${edge.fromSide}' references unknown source '${edge.fromId}'; skipped`);
      ok = false;
    }
    if (!allIds.has(edge.toId)) {
      warnings.push(`Edge '${edge.toSide}:${edge.toId}' references unknown target '${edge.toId}'; skipped`);
      ok = false;
    }
    return ok;
  });

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  return {
    doc: {
      version: '1.0',
      metadata: {
        title: explicitTitle ?? fmTitle ?? (typeof directiveTitle === 'string' ? directiveTitle : undefined),
        theme: fmTheme ?? (typeof directiveTheme === 'string' ? directiveTheme : undefined),
      },
      services: normalizeParent(services, 'Service'),
      groups: normalizeParent(groups, 'Group'),
      junctions: normalizeParent(junctions, 'Junction'),
      edges: filteredEdges,
    },
    warnings,
    frontmatter,
  };
}
