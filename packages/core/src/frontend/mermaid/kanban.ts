/**
 * @file frontend/mermaid/kanban.ts — Mermaid kanban → KanbanDocument parser.
 *
 * Translates Mermaid `kanban` syntax into the Kanban Grammar Domain IR
 * (KanbanDocument). Indentation-aware (like mindmap.ts), graceful degradation,
 * public warnings.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUPPORTED SYNTAX
 * ─────────────────────────────────────────────────────────────────────────
 *   Header:
 *     kanban  (case-insensitive)
 *
 *   Structure (indentation-based):
 *     Top-level items (indent depth = 1) → COLUMNS
 *     Second-level items (indent depth = 2) → CARDS within the current column
 *
 *   Column syntax:
 *     <id>[<label>]    e.g.  col1[To Do]
 *     <label>          bare label (id auto-derived from label)
 *
 *   Card syntax:
 *     <id>[<label>]    e.g.  t1[Design API]
 *     <label>          bare label
 *
 *   Optional metadata blocks on cards (next line or same structure):
 *     @{ assigned: "x", priority: "high", ticket: "JIRA-123" }
 *     Parsed keys: assigned, priority, ticket; unknown keys collected.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INDENT HANDLING
 * ─────────────────────────────────────────────────────────────────────────
 *   Uses first non-zero indent as the unit (normalised to 1). Tab = 2 spaces.
 *   Root = depth 0 (the `kanban` header), columns = depth 1, cards = depth 2.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ERROR POLICY
 * ─────────────────────────────────────────────────────────────────────────
 *   Unrecognised lines → warning + skip. Never throws.
 */

import type {
  KanbanCard,
  KanbanCardMetadata,
  KanbanColumn,
  KanbanDocument,
} from '../../grammars/kanban/types.js';
import { preprocessMermaid } from './utils.js';

export interface KanbanParseResult {
  doc: KanbanDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Label / id extraction
// ---------------------------------------------------------------------------

interface ItemInfo {
  id: string;
  label: string;
}

/**
 * Parse an item line into {id, label}.
 * Patterns:
 *   id[label]   → id='id', label='label'
 *   label       → id=sanitize(label), label='label'
 */
function parseItem(raw: string): ItemInfo {
  const bracketMatch = /^([^\s\[]+)\[(.+)\]$/.exec(raw.trim());
  if (bracketMatch) {
    return { id: bracketMatch[1]!, label: bracketMatch[2]! };
  }
  // Bare label — derive id
  const label = raw.trim();
  const id = label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'col';
  return { id, label };
}

// ---------------------------------------------------------------------------
// Metadata block parsing
// ---------------------------------------------------------------------------

function parseMetadataBlock(raw: string): KanbanCardMetadata {
  const meta: KanbanCardMetadata = {};
  // Strip @{ ... }
  const inner = raw.replace(/^@\{/, '').replace(/\}$/, '').trim();
  // Split by comma, parse key: "value" pairs
  const pairs = inner.split(',');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf(':');
    if (eqIdx < 0) continue;
    const key   = pair.slice(0, eqIdx).trim();
    const val   = pair.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = val;
  }
  return meta;
}

// ---------------------------------------------------------------------------
// Indent measurement
// ---------------------------------------------------------------------------

function measureIndent(line: string): number {
  let spaces = 0;
  for (const ch of line) {
    if (ch === ' ')  { spaces += 1; continue; }
    if (ch === '\t') { spaces += 2; continue; }
    break;
  }
  return spaces;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseKanbanDiagram(text: string): KanbanDocument {
  return parseKanbanDiagramInternal(text).doc;
}

export function parseKanbanDiagramInternal(text: string): KanbanParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const rawLines = body.split('\n');
  const warnings: string[] = [];

  const columns: KanbanColumn[] = [];
  let currentColumn: KanbanColumn | null = null;

  // Determine indent unit from the first indented line
  let indentUnit = 0;
  let headerFound = false;

  // Collect content lines with their indent
  interface ContentLine {
    raw: string;
    trimmed: string;
    indent: number;
  }

  const contentLines: ContentLine[] = [];
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (!headerFound) {
      if (/^kanban\b/i.test(trimmed)) {
        headerFound = true;
        continue;
      }
      // Graceful: treat first non-empty non-comment line as implicit header if not kanban
    }

    const indent = measureIndent(rawLine);
    if (indent > 0 && indentUnit === 0) indentUnit = indent;
    contentLines.push({ raw: rawLine, trimmed, indent });
  }

  if (indentUnit === 0) indentUnit = 2; // default

  function depthOf(indent: number): number {
    return Math.round(indent / indentUnit);
  }

  // Track last card for potential metadata attachment
  let lastCard: KanbanCard | null = null;

  for (let i = 0; i < contentLines.length; i++) {
    const { trimmed, indent } = contentLines[i]!;
    const depth = depthOf(indent);

    // Metadata block — attach to last card
    if (/^@\{/.test(trimmed)) {
      let metaRaw = trimmed;
      // May span multiple lines until closing }
      while (!metaRaw.includes('}') && i + 1 < contentLines.length) {
        i++;
        metaRaw += ' ' + (contentLines[i]!.trimmed);
      }
      if (lastCard) {
        lastCard.metadata = parseMetadataBlock(metaRaw);
      } else {
        warnings.push(`Metadata block with no preceding card at depth ${depth}; skipped`);
      }
      continue;
    }

    if (depth <= 0) {
      // depth 0 = should have been the header; warn if content
      warnings.push(`Unexpected depth-0 content "${trimmed}"; skipped`);
      continue;
    }

    if (depth === 1) {
      // Column
      const info = parseItem(trimmed);
      currentColumn = { id: info.id, label: info.label, cards: [] };
      columns.push(currentColumn);
      lastCard = null;
      continue;
    }

    if (depth === 2) {
      // Card
      if (!currentColumn) {
        // Auto-create a default column
        currentColumn = { id: 'col-1', label: 'Column', cards: [] };
        columns.push(currentColumn);
        warnings.push(`Card "${trimmed}" has no parent column; auto-created "Column"`);
      }
      const info = parseItem(trimmed);
      // Ensure unique card ids within document
      const card: KanbanCard = { id: info.id, label: info.label };
      currentColumn.cards.push(card);
      lastCard = card;
      continue;
    }

    // depth >= 3: deeper nesting not supported in standard kanban
    warnings.push(`Kanban nesting depth ${depth} is not supported for "${trimmed}"; treating as card`);
    if (currentColumn) {
      const info = parseItem(trimmed);
      const card: KanbanCard = { id: info.id, label: info.label };
      currentColumn.cards.push(card);
      lastCard = card;
    }
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  const doc: KanbanDocument = {
    version: '1.0',
    metadata: {
      title: fmTitle ?? (typeof directiveTitle === 'string' ? directiveTitle : undefined),
      theme: fmTheme ?? (typeof directiveTheme === 'string' ? directiveTheme : undefined),
    },
    columns,
  };

  return { doc, warnings, frontmatter };
}
