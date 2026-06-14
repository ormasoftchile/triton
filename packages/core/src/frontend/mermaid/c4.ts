/**
 * @file frontend/mermaid/c4.ts — Mermaid C4 → C4Document parser.
 */

import type {
  C4Boundary,
  C4DiagramKind,
  C4Document,
  C4Element,
  C4ElementKind,
  C4Rel,
  C4RelKind,
} from '../../grammars/c4/types.js';
import { preprocessMermaid } from './utils.js';

const HEADER_TO_KIND: Record<string, C4DiagramKind> = {
  c4context: 'C4Context',
  c4container: 'C4Container',
  c4component: 'C4Component',
  c4dynamic: 'C4Dynamic',
  c4deployment: 'C4Deployment',
};

const ELEMENT_KINDS = new Set<C4ElementKind>([
  'Person', 'Person_Ext',
  'System', 'System_Ext', 'SystemDb', 'SystemDb_Ext', 'SystemQueue', 'SystemQueue_Ext',
  'Container', 'Container_Ext', 'ContainerDb', 'ContainerDb_Ext', 'ContainerQueue', 'ContainerQueue_Ext',
  'Component', 'Component_Ext', 'ComponentDb', 'ComponentDb_Ext', 'ComponentQueue', 'ComponentQueue_Ext',
]);

const BOUNDARY_KINDS = new Set<C4Boundary['boundaryKind']>([
  'Boundary',
  'Enterprise_Boundary',
  'System_Boundary',
  'Container_Boundary',
]);

const REL_KINDS = new Set<C4RelKind>(['Rel', 'BiRel', 'Rel_U', 'Rel_D', 'Rel_L', 'Rel_R', 'Rel_Back']);

interface TopLevelOrderEntry {
  kind: 'element' | 'boundary';
  alias: string;
}

interface C4DocumentWithOrder extends C4Document {
  __topLevelOrder?: TopLevelOrderEntry[];
}

export interface C4ParseResult {
  doc: C4Document;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

export function parseC4Diagram(text: string): C4Document {
  return parseC4DiagramInternal(text).doc;
}

export function parseC4DiagramInternal(text: string): C4ParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  let diagramKind: C4DiagramKind = 'C4Context';
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    const header = HEADER_TO_KIND[trimmed.toLowerCase()];
    if (header) {
      headerIdx = i;
      diagramKind = header;
      break;
    }
    warnings.push(`Expected a C4 header on first content line; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  const elements: C4Element[] = [];
  const boundaries: C4Boundary[] = [];
  const rels: C4Rel[] = [];
  const topLevelOrder: TopLevelOrderEntry[] = [];
  const boundaryStack: C4Boundary[] = [];
  let inlineTitle: string | undefined;
  let warnedDirectionalRel = false;
  let warnedDeploymentNode = false;

  for (let i = Math.max(0, headerIdx + 1); i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    if (trimmed === '}') {
      if (boundaryStack.length > 0) boundaryStack.pop();
      else warnings.push('Unmatched C4 boundary closing brace skipped.');
      continue;
    }

    if (/^title\b/i.test(trimmed)) {
      inlineTitle = trimmed.replace(/^title\s+/i, '').trim() || inlineTitle;
      continue;
    }

    if (/^(UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig|UpdateBoundaryStyle)\b/.test(trimmed)) {
      continue;
    }

    if (/^LAYOUT_/i.test(trimmed)) {
      continue;
    }

    const openCall = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*\{$/);
    if (openCall) {
      const ctor = openCall[1] ?? '';
      const args = tokenizeArgs(openCall[2] ?? '');

      if (BOUNDARY_KINDS.has(ctor as C4Boundary['boundaryKind'])) {
        const boundary = parseBoundary(ctor as C4Boundary['boundaryKind'], args, warnings);
        if (boundary) attachBoundary(boundary, boundaryStack, boundaries, topLevelOrder);
        if (boundary) boundaryStack.push(boundary);
        continue;
      }

      if (ctor === 'Deployment_Node') {
        if (!warnedDeploymentNode) {
          warnings.push('DEFERRED: Deployment_Node is approximated as a generic Boundary for now.');
          warnedDeploymentNode = true;
        }
        const boundary = parseBoundary('Boundary', args, warnings);
        if (boundary) attachBoundary(boundary, boundaryStack, boundaries, topLevelOrder);
        if (boundary) boundaryStack.push(boundary);
        continue;
      }
    }

    const call = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/);
    if (!call) {
      warnings.push(`Unrecognised C4 line skipped: "${trimmed}"`);
      continue;
    }

    const ctor = call[1] ?? '';
    const args = tokenizeArgs(call[2] ?? '');

    if (ELEMENT_KINDS.has(ctor as C4ElementKind)) {
      const element = parseElement(ctor as C4ElementKind, args, warnings);
      if (element) attachElement(element, boundaryStack, elements, topLevelOrder);
      continue;
    }

    if (REL_KINDS.has(ctor as C4RelKind) || ctor === 'Rel_Ext') {
      if ((ctor === 'Rel_U' || ctor === 'Rel_D' || ctor === 'Rel_L' || ctor === 'Rel_R') && !warnedDirectionalRel) {
        warnings.push('DEFERRED: directional C4 relationship hints (Rel_U/D/L/R) are parsed but layout remains straight-line.');
        warnedDirectionalRel = true;
      }
      if (ctor === 'Rel_Ext') {
        warnings.push('DEFERRED: Rel_Ext is treated as Rel for now.');
      }
      const rel = parseRel((ctor === 'Rel_Ext' ? 'Rel' : ctor) as C4RelKind, args, warnings);
      if (rel) rels.push(rel);
      continue;
    }

    if (ctor === 'Deployment_Node') {
      if (!warnedDeploymentNode) {
        warnings.push('DEFERRED: Deployment_Node is approximated as a generic Boundary for now.');
        warnedDeploymentNode = true;
      }
      const boundary = parseBoundary('Boundary', args, warnings);
      if (boundary) attachBoundary(boundary, boundaryStack, boundaries, topLevelOrder);
      continue;
    }

    warnings.push(`Unrecognised C4 constructor skipped: "${trimmed}"`);
  }

  if (boundaryStack.length > 0) {
    warnings.push(`Unclosed boundary block for "${boundaryStack[boundaryStack.length - 1]!.alias}"`);
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTheme = fmTheme ?? directiveTheme;
  const resolvedTitle = inlineTitle ?? fmTitle ?? directiveTitle;

  const doc = {
    version: '1.0',
    metadata: {
      ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
      ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      diagramKind,
    },
    elements,
    boundaries,
    rels,
    __topLevelOrder: topLevelOrder,
  } as C4DocumentWithOrder;

  return { doc, warnings, frontmatter };
}

export function tokenizeArgs(argStr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < argStr.length; i++) {
    const ch = argStr[i]!;

    if (quote) {
      if (ch === '\\' && i + 1 < argStr.length) {
        current += ch + (argStr[i + 1] ?? '');
        i++;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === ',') {
      pushToken(tokens, current);
      current = '';
      continue;
    }

    current += ch;
  }

  pushToken(tokens, current);
  return tokens.filter((token) => !token.startsWith('$'));
}

function pushToken(tokens: string[], raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  tokens.push(stripOuterQuotes(trimmed));
}

function stripOuterQuotes(token: string): string {
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  return token;
}

function attachElement(
  element: C4Element,
  stack: C4Boundary[],
  elements: C4Element[],
  topLevelOrder: TopLevelOrderEntry[],
): void {
  const current = stack[stack.length - 1];
  if (current) {
    current.children.push(element);
  } else {
    elements.push(element);
    topLevelOrder.push({ kind: 'element', alias: element.alias });
  }
}

function attachBoundary(
  boundary: C4Boundary,
  stack: C4Boundary[],
  boundaries: C4Boundary[],
  topLevelOrder: TopLevelOrderEntry[],
): void {
  const current = stack[stack.length - 1];
  if (current) {
    current.children.push(boundary);
  } else {
    boundaries.push(boundary);
    topLevelOrder.push({ kind: 'boundary', alias: boundary.alias });
  }
}

function parseBoundary(
  boundaryKind: C4Boundary['boundaryKind'],
  args: string[],
  warnings: string[],
): C4Boundary | null {
  if (args.length < 2) {
    warnings.push(`Could not parse C4 boundary ${boundaryKind}: expected alias and label.`);
    return null;
  }

  return {
    alias: args[0] ?? '',
    label: args[1] ?? '',
    boundaryKind,
    ...(args[2] ? { boundaryType: args[2] } : {}),
    children: [],
  };
}

export function parseElement(kind: C4ElementKind, args: string[], warnings: string[]): C4Element | null {
  if (args.length < 2) {
    warnings.push(`Could not parse C4 element ${kind}: expected alias and label.`);
    return null;
  }

  const alias = args[0] ?? '';
  const label = args[1] ?? '';
  const isContainerLike = kind.startsWith('Container') || kind.startsWith('Component');

  if (isContainerLike) {
    return {
      alias,
      kind,
      label,
      ...(args[2] ? { technology: args[2] } : {}),
      ...(args[3] ? { description: args[3] } : {}),
    };
  }

  return {
    alias,
    kind,
    label,
    ...(args[2] ? { description: args[2] } : {}),
  };
}

export function parseRel(kind: C4RelKind, args: string[], warnings: string[]): C4Rel | null {
  const tokens = [...args];
  let order: number | undefined;

  if (tokens.length > 0 && /^\d+$/.test(tokens[0] ?? '')) {
    order = Number.parseInt(tokens.shift()!, 10);
  }

  if (tokens.length < 3) {
    warnings.push(`Could not parse C4 relationship ${kind}: expected from, to, and label.`);
    return null;
  }

  let from = tokens[0] ?? '';
  let to = tokens[1] ?? '';
  const label = tokens[2] ?? '';
  const technology = tokens[3] ?? undefined;

  if (kind === 'Rel_Back') {
    const originalFrom = from;
    from = to;
    to = originalFrom;
  }

  return {
    kind,
    from,
    to,
    label,
    ...(technology ? { technology } : {}),
    ...(order !== undefined ? { order } : {}),
  };
}
