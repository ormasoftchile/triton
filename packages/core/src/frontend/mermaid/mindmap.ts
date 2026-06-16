/**
 * @file frontend/mermaid/mindmap.ts — Mermaid mindmap → TreeDocument parser.
 *
 * Translates Mermaid `mindmap` syntax into the Tree Grammar Domain IR
 * (TreeDocument). Follows the tokenizer fidelity bar established by
 * flowchart.ts hardening: whitespace-independent, graceful degradation,
 * public warnings, validated by a real-data corpus.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IMPLEMENTED
 * ─────────────────────────────────────────────────────────────────────────
 *   Header
 *     mindmap  (case-insensitive)
 *
 *   Indentation hierarchy
 *     Indentation depth (spaces or 2-space-equiv tabs) determines parent/child
 *     relationships. Root is the first non-empty content node.
 *
 *   Node shapes → clean label extraction
 *     root((text))     → kind='root',    label='text'   (double paren)
 *     id((text))       → kind='circle',  label='text'
 *     id[text]         → kind='rect',    label='text'
 *     id(text)         → kind='rounded', label='text'
 *     id{{text}}       → kind='hexagon', label='text'
 *     id))text((       → kind='bang',    label='text'   (inverse stadium)
 *     id>text]         → kind='asymm',   label='text'   (asymmetric)
 *     "text"           → label='text'   (quoted)
 *     text             → label='text'   (bare)
 *     HTML <br/> tags  → preserved in label as-is for multi-line rendering
 *     Other HTML tags  → stripped from label
 *
 *   Icon directives
 *     ::icon(fa fa-x)  → strips "fa fa-" / "fa-" prefix; sets node.icon
 *                         on the last parsed sibling node
 *     Unrecognised icon names → warning (icon not set)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEFERRED
 * ─────────────────────────────────────────────────────────────────────────
 *   1. :::className directives → warn + skip
 *   2. Multi-root documents    → second root becomes child of first + warn
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ERROR POLICY
 * ─────────────────────────────────────────────────────────────────────────
 *   Unrecognised lines → skip with collected warning. NEVER throws on syntax
 *   errors. Always returns a valid (possibly partial) TreeDocument.
 *   If no nodes are found, a synthetic root is created.
 */

import type { TreeDocument, TreeNode } from '../../grammars/tree/types.js';
import { preprocessMermaid } from './utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MindmapParseResult {
  doc: TreeDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ID sanitization (shared algorithm)
// ---------------------------------------------------------------------------

function sanitizeId(raw: string, idMap: Map<string, string>, usedIds: Set<string>): string {
  if (idMap.has(raw)) return idMap.get(raw)!;

  let s = raw;
  s = s.replace(/([a-z])([A-Z])/g, '$1-$2');
  s = s.toLowerCase();
  s = s.replace(/[_\s]+/g, '-');
  s = s.replace(/[^a-z0-9-]/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  if (/^\d/.test(s)) s = 'n' + s;
  if (!s) s = 'node';

  const base = s;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    idMap.set(raw, base);
    return base;
  }
  let i = 2;
  while (usedIds.has(`${base}-${i}`)) i++;
  const final = `${base}-${i}`;
  usedIds.add(final);
  idMap.set(raw, final);
  return final;
}

// ---------------------------------------------------------------------------
// Node label / shape extraction
// ---------------------------------------------------------------------------

interface NodeInfo {
  label: string;
  explicitId?: string;
  kind?: string;
}

/**
 * Extract a clean label (and optional explicit ID) from a Mermaid mindmap
 * node definition line. Shape delimiters are stripped; HTML tags removed.
 *
 * Patterns matched (most specific first):
 *   id((label))  — circle
 *   id[[label]]  — database/subroutine  
 *   id[label]    — rect
 *   id(label)    — rounded rect
 *   id{{label}}  — hexagon
 *   id))label((  — bang/inverse-stadium
 *   id>label]    — asymmetric
 *   ((label))    — pure shape, no explicit id
 *   [[label]]    — pure shape
 *   [label]      — pure shape
 *   (label)      — pure shape
 *   {{label}}    — pure shape
 *   ))label((    — pure shape
 *   >label]      — pure shape
 *   "label"      — quoted
 *   label        — bare
 */
function extractNodeInfo(content: string): NodeInfo {
  const s = content.trim();

  // Helper: strip HTML tags other than <br> variants, but preserve <br> markers for multi-line rendering.
  // <br>, <br/>, <br /> are kept as-is so splitLabelLines() can split on them later.
  const clean = (t: string) =>
    t.replace(/<(?!br[\s/>])[^>]*>/gi, '').trim();

  // id((label)) — circle
  let m = s.match(/^(\w+)\(\((.+)\)\)$/s);
  if (m) return { explicitId: m[1], label: clean(m[2]!), kind: 'circle' };

  // id[[label]] — database
  m = s.match(/^(\w+)\[\[(.+)\]\]$/s);
  if (m) return { explicitId: m[1], label: clean(m[2]!), kind: 'database' };

  // id[label] — rect
  m = s.match(/^(\w+)\[(.+)\]$/s);
  if (m) return { explicitId: m[1], label: clean(m[2]!), kind: 'rect' };

  // id(label) — rounded
  m = s.match(/^(\w+)\((.+)\)$/s);
  if (m) return { explicitId: m[1], label: clean(m[2]!), kind: 'rounded' };

  // id{{label}} — hexagon
  m = s.match(/^(\w+)\{\{(.+)\}\}$/s);
  if (m) return { explicitId: m[1], label: clean(m[2]!), kind: 'hexagon' };

  // id))label(( — bang
  m = s.match(/^(\w+)\)\)(.+)\(\($/s);
  if (m) return { explicitId: m[1], label: clean(m[2]!), kind: 'bang' };

  // id>label] — asymmetric
  m = s.match(/^(\w+)>(.+)\]$/s);
  if (m) return { explicitId: m[1], label: clean(m[2]!), kind: 'asymm' };

  // Pure shapes (no explicit id):
  // ((label))
  m = s.match(/^\(\((.+)\)\)$/s);
  if (m) return { label: clean(m[1]!), kind: 'circle' };

  // [[label]]
  m = s.match(/^\[\[(.+)\]\]$/s);
  if (m) return { label: clean(m[1]!), kind: 'database' };

  // [label]
  m = s.match(/^\[(.+)\]$/s);
  if (m) return { label: clean(m[1]!), kind: 'rect' };

  // (label)
  m = s.match(/^\((.+)\)$/s);
  if (m) return { label: clean(m[1]!), kind: 'rounded' };

  // {{label}}
  m = s.match(/^\{\{(.+)\}\}$/s);
  if (m) return { label: clean(m[1]!), kind: 'hexagon' };

  // ))label((
  m = s.match(/^\)\)(.+)\(\($/s);
  if (m) return { label: clean(m[1]!), kind: 'bang' };

  // >label]
  m = s.match(/^>(.+)\]$/s);
  if (m) return { label: clean(m[1]!), kind: 'asymm' };

  // "quoted"
  m = s.match(/^"(.+)"$/s);
  if (m) return { label: clean(m[1]!) };

  // Bare — whole content is label
  return { label: clean(s) };
}

// ---------------------------------------------------------------------------
// Indentation counter
// ---------------------------------------------------------------------------

/**
 * Count effective leading spaces. Tabs count as 2 spaces (Mermaid convention).
 */
function countIndent(line: string): number {
  let spaces = 0;
  for (const ch of line) {
    if (ch === ' ')  { spaces++;  continue; }
    if (ch === '\t') { spaces += 2; continue; }
    break;
  }
  return spaces;
}

// ---------------------------------------------------------------------------
// Icon name resolution
// ---------------------------------------------------------------------------

/**
 * Strip FontAwesome class prefixes and return a plain icon name.
 * Returns the cleaned name (may not be in our registry — caller warns if needed).
 */
function stripFAPrefix(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^fas?\s+fa-/, '');   // "fa fa-book" | "fas fa-book"
  s = s.replace(/^far\s+fa-/, '');    // "far fa-book"
  s = s.replace(/^fa-/, '');          // "fa-book"
  return s || raw.trim();
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseMindmapInternal(text: string): MindmapParseResult {
  const { body, frontmatter, directiveTheme } = preprocessMermaid(text);
  const warnings: string[] = [];
  const idMap   = new Map<string, string>();
  const usedIds = new Set<string>();

  // Split into content lines (skip empty and the 'mindmap' header)
  const contentLines = body
    .split('\n')
    .filter((l) => l.trim() && !/^mindmap\s*$/i.test(l.trim()));

  if (contentLines.length === 0) {
    const fallbackRoot: TreeNode = { id: 'root', label: 'Root', kind: 'root', children: [] };
    warnings.push('WARN: empty mindmap; synthetic root node added.');
    const doc: TreeDocument = {
      version: '1.0',
      metadata: { title: 'Mindmap', theme: 'dark-tree' },
      tree: { root: fallbackRoot },
    };
    return { doc, warnings, frontmatter };
  }

  // Build tree using an indent stack
  interface StackEntry {
    node:   TreeNode;
    indent: number;
  }

  const stack:    StackEntry[]      = [];
  let   root:     TreeNode | undefined;
  let   lastNode: TreeNode | undefined; // target for the next ::icon() directive

  for (const line of contentLines) {
    const indent  = countIndent(line);
    const content = line.trimStart();

    // Class directive :::className → skip
    if (/^:::/.test(content)) {
      warnings.push(`SKIP: class directive "${content}" deferred.`);
      continue;
    }

    // Icon directive ::icon(...)
    if (/^::icon\(/i.test(content)) {
      const m = content.match(/^::icon\(([^)]+)\)/i);
      if (m && lastNode) {
        const iconName = stripFAPrefix(m[1]!);
        lastNode.icon  = iconName;
        // Warn about FontAwesome icon (may not be in our registry)
        warnings.push(
          `ICON: "${m[1]!.trim()}" → icon="${iconName}" assigned to "${lastNode.label}". ` +
          `FontAwesome icons may not match the built-in icon registry.`,
        );
      } else if (!lastNode) {
        warnings.push(`WARN: ::icon() directive has no preceding node to attach to.`);
      }
      continue;
    }

    // Normal node line
    const { label, explicitId, kind } = extractNodeInfo(content);
    if (!label) {
      warnings.push(`SKIP: empty label for line: "${content}"`);
      continue;
    }

    const idKey = explicitId ?? label;
    const id    = sanitizeId(idKey, idMap, usedIds);

    const node: TreeNode = {
      id,
      label,
      ...(kind ? { kind } : {}),
      children: [],
    };

    // Pop stack until we find an entry with strictly smaller indent
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      // This is at root level
      if (!root) {
        root      = node;
        node.kind = 'root'; // tree root always gets kind 'root' (shape is cosmetic)
      } else {
        // Multiple root-level nodes → make them children of existing root
        warnings.push(
          `WARN: multiple root-level nodes; "${label}" added as child of "${root.label}".`,
        );
        root.children = root.children ?? [];
        root.children.push(node);
        // push root to stack so this node is a child
        stack.push({ node: root, indent: -1 });
        stack.push({ node, indent });
        lastNode = node;
        continue;
      }
    } else {
      const parent = stack[stack.length - 1]!.node;
      parent.children = parent.children ?? [];
      parent.children.push(node);
    }

    lastNode = node;
    stack.push({ node, indent });
  }

  // Fallback root if parsing produced nothing
  if (!root) {
    root = { id: 'root', label: 'Root', kind: 'root', children: [] };
    warnings.push('WARN: no root node found; synthetic root added.');
  }

  // Title & theme
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const title   = fmTitle ?? root.label;
  const theme   = fmTheme ?? directiveTheme ?? 'dark-tree';

  const doc: TreeDocument = {
    version:  '1.0',
    metadata: { title, theme },
    tree:     { root },
  };

  return { doc, warnings, frontmatter };
}

/**
 * Simple wrapper — parse Mermaid mindmap text and return the TreeDocument.
 */
export function parseMindmap(text: string): TreeDocument {
  return parseMindmapInternal(text).doc;
}
